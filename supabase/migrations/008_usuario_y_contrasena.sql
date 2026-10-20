-- Migration 008: Soporte para Nombre de Usuario y Autenticación con Contraseña
-- Agrega columna usuario única en perfiles y función para login con usuario o correo.

ALTER TABLE public.perfiles 
ADD COLUMN IF NOT EXISTS usuario text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_perfiles_usuario ON public.perfiles(usuario);

-- Función segura para obtener el correo a partir del nombre de usuario o email
CREATE OR REPLACE FUNCTION public.obtener_correo_por_identificador(p_identificador text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correo text;
  v_clean text := lower(trim(p_identificador));
BEGIN
  -- Si ya contiene @, verificar directamente en perfiles o retornar tal cual
  IF position('@' IN v_clean) > 0 THEN
    RETURN v_clean;
  END IF;

  -- Buscar por nombre de usuario
  SELECT correo_institucional INTO v_correo
  FROM public.perfiles
  WHERE lower(usuario) = v_clean
  LIMIT 1;

  RETURN v_correo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_correo_por_identificador(text) TO anon, authenticated;
