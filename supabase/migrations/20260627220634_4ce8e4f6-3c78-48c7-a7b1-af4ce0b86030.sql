
-- Revert view to security invoker (satisfies linter)
DROP VIEW IF EXISTS public.numeros_public;
CREATE VIEW public.numeros_public
WITH (security_invoker=on) AS
  SELECT numero, status, updated_at FROM public.numeros;
GRANT SELECT ON public.numeros_public TO anon, authenticated;

-- Column-level grants on base table: anon/authenticated can only read non-sensitive columns.
-- participante_id stays hidden because no SELECT grant on that column for these roles.
REVOKE SELECT ON public.numeros FROM anon, authenticated;
GRANT SELECT (numero, status, updated_at) ON public.numeros TO anon, authenticated;

-- RLS policy enabling row visibility for the limited columns above
DROP POLICY IF EXISTS "public read numeros limited" ON public.numeros;
CREATE POLICY "public read numeros limited"
  ON public.numeros FOR SELECT
  TO anon, authenticated
  USING (true);
