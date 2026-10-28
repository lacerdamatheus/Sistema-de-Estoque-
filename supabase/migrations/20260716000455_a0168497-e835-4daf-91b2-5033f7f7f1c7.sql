
-- ============ ENUM ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'gerente', 'operador', 'visualizador');
CREATE TYPE public.mov_tipo AS ENUM ('entrada', 'saida', 'ajuste');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'gerente' THEN 2 WHEN 'operador' THEN 3 ELSE 4 END
  LIMIT 1;
$$;

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGER: NEW USER -> PROFILE + ROLE ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first_user THEN 'admin'::app_role ELSE 'operador'::app_role END);

  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ CATEGORIAS ============
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_select" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat_insert" ON public.categorias FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "cat_update" ON public.categorias FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "cat_delete" ON public.categorias FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tg_cat_upd BEFORE UPDATE ON public.categorias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ FORNECEDORES ============
CREATE TABLE public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "for_select" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "for_insert" ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "for_update" ON public.fornecedores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "for_delete" ON public.fornecedores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tg_for_upd BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ PRODUTOS ============
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  codigo_barras TEXT,
  preco_custo NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_venda NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_atual NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'UN',
  validade DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_produtos_nome ON public.produtos(nome);
CREATE INDEX idx_produtos_categoria ON public.produtos(categoria_id);
CREATE INDEX idx_produtos_barras ON public.produtos(codigo_barras);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_select" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_insert" ON public.produtos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "prod_update" ON public.produtos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "prod_delete" ON public.produtos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tg_prod_upd BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ MOVIMENTACOES ============
CREATE TABLE public.movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo mov_tipo NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
  motivo TEXT,
  observacoes TEXT,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  estoque_anterior NUMERIC(12,3),
  estoque_posterior NUMERIC(12,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mov_produto ON public.movimentacoes(produto_id);
CREATE INDEX idx_mov_created ON public.movimentacoes(created_at DESC);
GRANT SELECT, INSERT ON public.movimentacoes TO authenticated;
GRANT ALL ON public.movimentacoes TO service_role;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mov_select" ON public.movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "mov_insert" ON public.movimentacoes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = usuario_id AND (
      public.has_role(auth.uid(),'admin') OR
      public.has_role(auth.uid(),'gerente') OR
      public.has_role(auth.uid(),'operador')
    )
  );

-- ============ TRIGGER: ATUALIZA ESTOQUE ============
CREATE OR REPLACE FUNCTION public.tg_apply_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur NUMERIC(12,3);
  novo NUMERIC(12,3);
BEGIN
  SELECT estoque_atual INTO cur FROM public.produtos WHERE id = NEW.produto_id FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;

  novo := CASE NEW.tipo
    WHEN 'entrada' THEN cur + NEW.quantidade
    WHEN 'saida' THEN cur - NEW.quantidade
    WHEN 'ajuste' THEN NEW.quantidade
  END;

  IF novo < 0 THEN RAISE EXCEPTION 'Estoque insuficiente. Atual: %, tentativa saída: %', cur, NEW.quantidade; END IF;

  NEW.estoque_anterior := cur;
  NEW.estoque_posterior := novo;

  UPDATE public.produtos SET estoque_atual = novo, updated_at = now() WHERE id = NEW.produto_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tg_mov_apply BEFORE INSERT ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_movement();

-- ============ SEED CATEGORIAS ============
INSERT INTO public.categorias (nome, descricao) VALUES
  ('Alimentos', 'Produtos alimentícios'),
  ('Bebidas', 'Bebidas em geral'),
  ('Limpeza', 'Produtos de limpeza'),
  ('Higiene', 'Produtos de higiene pessoal'),
  ('Eletrônicos', 'Aparelhos e acessórios eletrônicos');
