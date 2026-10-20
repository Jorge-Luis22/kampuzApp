// Supabase Edge Function: eliminar-cuenta
// Cumple con la exigencia de Google Play Store de eliminación definitiva de cuenta y datos.
// Ejecuta con supabaseAdmin (service_role) para borrar de auth.users y Storage.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Falta cabecera de autorización" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente regular para validar el token del usuario solicitante
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado o token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Cliente de servicio (service_role) con privilegios de administración
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Eliminar avatar en Storage
    try {
      const { data: files } = await supabaseAdmin.storage.from("avatares").list(userId);
      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${userId}/${f.name}`);
        await supabaseAdmin.storage.from("avatares").remove(filePaths);
      }
    } catch (stErr) {
      console.warn("Aviso al limpiar storage:", stErr);
    }

    // 2. Eliminar perfil y registros en cascada
    await supabaseAdmin.from("perfiles").delete().eq("id", userId);

    // 3. Eliminar de auth.users definitivamente
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      throw deleteAuthError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "Cuenta y datos eliminados correctamente" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
