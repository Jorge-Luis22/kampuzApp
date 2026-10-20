-- Migration 007: Procedimiento seguro para eliminación irreversible de cuenta (Google Play Store compliance)
-- Permite al estudiante solicitar el borrado total de sus datos y de su cuenta de autenticación.

CREATE OR REPLACE FUNCTION public.eliminar_mi_cuenta()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autenticado');
  END IF;

  -- 1. Eliminar fotos de perfil y archivos de storage del usuario
  DELETE FROM storage.objects 
  WHERE bucket_id = 'avatares' 
    AND (name LIKE v_user_id || '/%' OR name LIKE v_user_id || '.%' OR owner = v_user_id::text);

  -- 2. Eliminar explícitamente registros relacionados si no tuviesen cascade
  DELETE FROM public.respuestas WHERE usuario_id = v_user_id;
  DELETE FROM public.consentimientos WHERE usuario_id = v_user_id;
  DELETE FROM public.perfiles WHERE id = v_user_id;

  -- 3. Eliminar usuario de auth.users (el trigger ON DELETE CASCADE de la FK perfiles se encarga del resto)
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN json_build_object('success', true, 'message', 'Cuenta y datos personales eliminados con éxito.');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_mi_cuenta() TO authenticated;

-- Política de actualización de reportes para moderadores (M33)
DROP POLICY IF EXISTS "Moderadores pueden actualizar estado de reportes" ON public.reportes;
CREATE POLICY "Moderadores pueden actualizar estado de reportes"
    ON public.reportes FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol IN ('moderador', 'admin_universidad')
        )
    );

