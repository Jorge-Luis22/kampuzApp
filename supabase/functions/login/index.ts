// Supabase Edge Function: login
// Inicia sesión con @usuario o correo + contraseña sin exponer el correo de nadie.
// - El @usuario se convierte en correo AQUÍ, con la service role (nunca en el cliente
//   ni con una RPC pública).
// - Devuelve solo la sesión (access_token y refresh_token). Nunca devuelve el correo.
// - Si algo falla, el mensaje es siempre el mismo: no revela si el usuario existe.
//
// Despliegue (la llama gente sin sesión, por eso sin verificación de JWT):
//   supabase functions deploy login --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MSG_CREDENCIALES = "Usuario o contraseña incorrectos.";
const FORMATO_USUARIO = /^[a-z0-9._]{3,30}$/;

const responder = (cuerpo: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return responder({ error: "Método no permitido" }, 405);
  }

  let identificador = "";
  let password = "";
  try {
    const body = await req.json();
    identificador = String(body?.identificador ?? "").trim().toLowerCase().replace(/^@/, "");
    password = String(body?.password ?? "");
  } catch {
    return responder({ error: MSG_CREDENCIALES, codigo: "CREDENCIALES" }, 401);
  }
  if (!identificador || !password || password.length > 200) {
    return responder({ error: MSG_CREDENCIALES, codigo: "CREDENCIALES" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

  try {
    // 1. @usuario → correo, del lado del servidor
    let correo = identificador;
    if (!identificador.includes("@")) {
      if (!FORMATO_USUARIO.test(identificador)) {
        return responder({ error: MSG_CREDENCIALES, codigo: "CREDENCIALES" }, 401);
      }
      const admin = createClient(url, serviceKey, opciones);
      const { data, error } = await admin
        .from("perfiles")
        .select("correo_institucional")
        .eq("usuario", identificador)
        .maybeSingle();
      if (error) throw error;
      if (!data?.correo_institucional) {
        return responder({ error: MSG_CREDENCIALES, codigo: "CREDENCIALES" }, 401);
      }
      correo = data.correo_institucional;
    }

    // 2. Iniciar sesión como el alumno (Supabase Auth valida la contraseña)
    const cliente = createClient(url, anonKey, opciones);
    const { data, error } = await cliente.auth.signInWithPassword({ email: correo, password });

    if (error || !data?.session) {
      const texto = `${error?.code ?? ""} ${error?.message ?? ""}`;
      if (/email_not_confirmed|Email not confirmed/i.test(texto)) {
        // Solo llega aquí con la contraseña correcta: no revela nada a un tercero.
        return responder({ error: "Aún no verificas tu correo.", codigo: "EMAIL_NO_CONFIRMADO" }, 403);
      }
      if (/rate limit|too many/i.test(texto)) {
        return responder({ error: "Demasiados intentos. Espera unos minutos e inténtalo otra vez.", codigo: "LIMITE" }, 429);
      }
      return responder({ error: MSG_CREDENCIALES, codigo: "CREDENCIALES" }, 401);
    }

    // 3. Solo la sesión: el cliente la guarda con supabase.auth.setSession()
    return responder({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (err) {
    console.error("login:", err);
    return responder({ error: "No pudimos iniciar sesión. Inténtalo de nuevo.", codigo: "SERVIDOR" }, 500);
  }
});
