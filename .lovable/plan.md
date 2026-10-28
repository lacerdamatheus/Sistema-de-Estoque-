## Sistema ERP de Estoque — Plano de Implementação

Vou construir um ERP moderno inspirado em Tiny/Omie, com backend Lovable Cloud, autenticação por níveis, e todos os módulos essenciais. Dado o escopo, entregarei em **duas fases** dentro desta sessão.

### Stack
- TanStack Start + React 19 + Tailwind v4
- Lovable Cloud (auth, database, storage)
- Recharts (gráficos), TanStack Table (tabelas), React Hook Form + Zod (formulários)
- SheetJS (xlsx), jsPDF + autotable (PDF), html5-qrcode (leitura), jsbarcode (geração)
- Lucide React (ícones), Sonner (toasts — já vem no shadcn)

### Design System
Estilo Tiny/Omie: fundo claro suave, cards arredondados generosos, primária azul-esverdeada moderna, sidebar branca com ícones, tipografia Inter, densidade confortável. Dark mode incluído (toggle, não questão de prioridade zero mas usuário pediu).

### Fase 1 — Fundação (esta entrega)
1. **Enable Lovable Cloud** + migração completa:
   - `profiles` (id, nome, avatar)
   - `app_role` enum: admin, gerente, operador, visualizador
   - `user_roles` + função `has_role` (security definer)
   - `categorias` (id, nome)
   - `fornecedores` (id, nome, cnpj, contato)
   - `produtos` (id, sku, nome, descricao, categoria_id, fornecedor_id, codigo_barras, preco_custo, preco_venda, estoque_atual, estoque_minimo, unidade, validade, ativo)
   - `movimentacoes` (id, produto_id, tipo [entrada/saida/ajuste], quantidade, motivo, usuario_id, created_at)
   - Trigger: cria profile + role "operador" no signup
   - Trigger: atualiza `estoque_atual` ao inserir movimentação
   - RLS: todos autenticados leem; escrita conforme role
2. **Auth**: `/auth` (login/signup), layout `_authenticated`, sign-out
3. **Design system** completo em `src/styles.css` (tokens claros/escuros)
4. **Sidebar** com navegação (Dashboard, Produtos, Movimentações, Relatórios, Cadastros, Configurações)
5. **Dashboard**: cards KPI (total produtos, valor estoque, itens em baixa, próximos ao vencimento) + gráficos Recharts (movimentações últimos 30 dias, top produtos)
6. **Produtos**: listagem TanStack Table (busca, ordenação, paginação), CRUD com dialog, geração de código de barras (JsBarcode), controle de validade visível
7. **Movimentações**: registro entrada/saída/ajuste, histórico filtrável
8. **Dark mode toggle** no header
9. **Home pública** `/` com CTA para login (landing simples e elegante)

### Fase 2 — Estender (próxima mensagem, após validar Fase 1)
- Leitura de código de barras via câmera (html5-qrcode)
- Exportação Excel/PDF (produtos, movimentações, relatórios)
- Importação de planilhas
- Relatórios personalizados por período
- Página de gerenciamento de usuários/roles (admin)
- Cadastros de categorias e fornecedores (CRUD)
- Alertas de vencimento e estoque baixo (toasts + badge)

### Estrutura de pastas
```text
src/
  components/
    ui/                  (shadcn)
    layout/              (AppSidebar, Header, AuthLayout)
    dashboard/           (KpiCard, MovementsChart, TopProductsChart)
    products/            (ProductsTable, ProductForm, BarcodeDisplay)
    movements/           (MovementsTable, MovementForm)
  hooks/                 (useAuth, useRole, useTheme)
  lib/                   (utils, queries, formatters)
  routes/
    __root.tsx
    index.tsx            (landing pública)
    auth.tsx             (login/signup)
    _authenticated/
      route.tsx          (gerenciado)
      dashboard.tsx
      produtos.tsx
      movimentacoes.tsx
      relatorios.tsx
      cadastros.tsx
      configuracoes.tsx
  integrations/supabase/ (auto)
supabase/migrations/     (schema)
```

### Detalhes técnicos
- Roles verificados via `has_role(auth.uid(), 'role')` em policies
- Frontend usa hook `useRole()` para ocultar ações conforme permissão
- Página pública `/` mantém `og:*` tags; rotas autenticadas herdam do root
- SEO: sitemap.xml + robots.txt no final

Após aprovação, executo Fase 1 completa em uma sequência de chamadas.