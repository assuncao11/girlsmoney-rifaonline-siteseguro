
-- 1) Lock down SECURITY DEFINER functions: revoke broad EXECUTE, grant only where needed
REVOKE EXECUTE ON FUNCTION public.confirmar_pagamento(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancelar_reserva(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.excluir_participante(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.criar_reserva(text, text, text, integer[]) FROM PUBLIC;

-- Admin-only functions: only authenticated users may call (internal has_role check still enforces admin)
GRANT EXECUTE ON FUNCTION public.confirmar_pagamento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_participante(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Reservation creation must remain accessible to guests (public landing page)
GRANT EXECUTE ON FUNCTION public.criar_reserva(text, text, text, integer[]) TO anon, authenticated;

-- 2) Stop exposing participante_id publicly. Replace public table read with a safe view.
DROP POLICY IF EXISTS "anyone can read numeros" ON public.numeros;

-- Admin keeps full SELECT via existing admin policies; add explicit admin SELECT for clarity
DROP POLICY IF EXISTS "admin read numeros" ON public.numeros;
CREATE POLICY "admin read numeros" ON public.numeros
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Revoke broad SELECT from public roles on the base table
REVOKE SELECT ON public.numeros FROM anon;
REVOKE SELECT ON public.numeros FROM authenticated;
GRANT SELECT (numero, status, updated_at) ON public.numeros TO anon, authenticated;

-- Safe public view: only number + status, no participante_id
CREATE OR REPLACE VIEW public.numeros_public
WITH (security_invoker = true) AS
SELECT numero, status, updated_at
FROM public.numeros;

GRANT SELECT ON public.numeros_public TO anon, authenticated;

-- 3) Explicitly document: participantes has no non-admin SELECT policy (PII protected).
-- No change needed; existing "admin all participantes" policy is the only one. Add comment for clarity.
COMMENT ON TABLE public.participantes IS 'Contains PII. SELECT restricted to admins only via RLS. Never add anon/authenticated SELECT policies without row-scoping.';
