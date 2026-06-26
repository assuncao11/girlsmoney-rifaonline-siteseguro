
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-grant admin to specific email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email = 'agnysassuncao11@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Participantes
CREATE TABLE public.participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participantes TO authenticated;
GRANT ALL ON public.participantes TO service_role;
ALTER TABLE public.participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all participantes" ON public.participantes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Numeros
CREATE TYPE public.numero_status AS ENUM ('disponivel', 'reservado', 'pago');

CREATE TABLE public.numeros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero int NOT NULL UNIQUE CHECK (numero BETWEEN 1 AND 350),
  participante_id uuid REFERENCES public.participantes(id) ON DELETE SET NULL,
  status public.numero_status NOT NULL DEFAULT 'disponivel',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.numeros TO anon, authenticated;
GRANT UPDATE, INSERT, DELETE ON public.numeros TO authenticated;
GRANT ALL ON public.numeros TO service_role;
ALTER TABLE public.numeros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read numeros" ON public.numeros FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin update numeros" ON public.numeros FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed 350 numbers
INSERT INTO public.numeros (numero)
SELECT g FROM generate_series(1, 350) g;

-- Reserve function (public, security definer): creates participant + reserves numbers atomically
CREATE OR REPLACE FUNCTION public.criar_reserva(
  _nome text, _email text, _whatsapp text, _numeros int[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _participante_id uuid;
  _count int;
  _qtd int;
BEGIN
  _qtd := array_length(_numeros, 1);
  IF _qtd IS NULL OR _qtd < 1 OR _qtd > 3 THEN
    RAISE EXCEPTION 'Selecione entre 1 e 3 números';
  END IF;
  IF length(trim(_nome)) = 0 OR length(trim(_email)) = 0 OR length(trim(_whatsapp)) = 0 THEN
    RAISE EXCEPTION 'Preencha todos os campos';
  END IF;

  -- Lock requested rows and check availability
  PERFORM 1 FROM public.numeros WHERE numero = ANY(_numeros) FOR UPDATE;
  SELECT count(*) INTO _count FROM public.numeros
    WHERE numero = ANY(_numeros) AND status = 'disponivel';
  IF _count <> _qtd THEN
    RAISE EXCEPTION 'Um ou mais números já não estão disponíveis';
  END IF;

  INSERT INTO public.participantes (nome, email, whatsapp)
  VALUES (trim(_nome), trim(_email), trim(_whatsapp))
  RETURNING id INTO _participante_id;

  UPDATE public.numeros
  SET status = 'reservado', participante_id = _participante_id, updated_at = now()
  WHERE numero = ANY(_numeros);

  RETURN _participante_id;
END; $$;

REVOKE ALL ON FUNCTION public.criar_reserva(text, text, text, int[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_reserva(text, text, text, int[]) TO anon, authenticated;

-- Admin functions
CREATE OR REPLACE FUNCTION public.confirmar_pagamento(_participante_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  UPDATE public.numeros SET status = 'pago', updated_at = now() WHERE participante_id = _participante_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cancelar_reserva(_participante_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  UPDATE public.numeros SET status = 'disponivel', participante_id = NULL, updated_at = now()
  WHERE participante_id = _participante_id AND status <> 'pago';
END; $$;

CREATE OR REPLACE FUNCTION public.excluir_participante(_participante_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  UPDATE public.numeros SET status = 'disponivel', participante_id = NULL, updated_at = now()
  WHERE participante_id = _participante_id;
  DELETE FROM public.participantes WHERE id = _participante_id;
END; $$;

REVOKE ALL ON FUNCTION public.confirmar_pagamento(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancelar_reserva(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_participante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_pagamento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_participante(uuid) TO authenticated;
