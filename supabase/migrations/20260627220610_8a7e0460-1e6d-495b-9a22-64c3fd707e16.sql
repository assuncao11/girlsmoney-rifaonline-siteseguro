
-- Recreate numeros_public as a security definer view so anon/authenticated can
-- read numero+status without RLS access to base table (which holds participante_id).
DROP VIEW IF EXISTS public.numeros_public;
CREATE VIEW public.numeros_public
WITH (security_invoker=off) AS
  SELECT numero, status, updated_at FROM public.numeros;

ALTER VIEW public.numeros_public OWNER TO postgres;
GRANT SELECT ON public.numeros_public TO anon, authenticated;
