import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Boxes,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, dateBR, daysUntil } from "@/lib/formatters";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const kpis = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => {
      const [prod, mov] = await Promise.all([
        supabase.from("produtos").select("id, nome, estoque_atual, estoque_minimo, validade, ativo"),
        supabase
          .from("movimentacoes")
          .select("id, tipo, quantidade, created_at, produto_id")
          .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
          .order("created_at"),
      ]);
      if (prod.error) throw prod.error;
      if (mov.error) throw mov.error;

      const produtos = prod.data ?? [];
      const movs = mov.data ?? [];
      const itensTotais = produtos.reduce((s, p) => s + Number(p.estoque_atual), 0);
      const emBaixa = produtos.filter(
        (p) => Number(p.estoque_atual) <= Number(p.estoque_minimo) && p.ativo,
      );
      const vencendo = produtos.filter((p) => {
        const d = daysUntil(p.validade);
        return d !== null && d >= 0 && d <= 30;
      });

      // movimentações por dia
      const porDia: Record<string, { data: string; entradas: number; saidas: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        porDia[key] = { data: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), entradas: 0, saidas: 0 };
      }
      for (const m of movs) {
        const key = m.created_at.slice(0, 10);
        if (!porDia[key]) continue;
        if (m.tipo === "entrada") porDia[key].entradas += Number(m.quantidade);
        else if (m.tipo === "saida") porDia[key].saidas += Number(m.quantidade);
      }

      return {
        totalProdutos: produtos.filter((p) => p.ativo).length,
        itensTotais,
        emBaixa,
        vencendo,
        chart: Object.values(porDia),
      };
    },
  });

  if (kpis.isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (kpis.error) return <div className="text-sm text-destructive">Erro ao carregar dados.</div>;
  const d = kpis.data!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu estoque nos últimos 30 dias.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Produtos ativos" value={num(d.totalProdutos, 0)} icon={Package} tone="info" />
        <Kpi title="Itens em estoque" value={num(d.itensTotais, 0)} icon={Boxes} tone="success" />
        <Kpi title="Itens em baixa" value={num(d.emBaixa.length, 0)} icon={AlertTriangle} tone="warning" />
        <Kpi title="Vencendo em 30 dias" value={num(d.vencendo.length, 0)} icon={Clock} tone="destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimentações — últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.chart}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
              <XAxis dataKey="data" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="entradas" stroke="var(--color-chart-2)" strokeWidth={2} />
              <Line type="monotone" dataKey="saidas" stroke="var(--color-chart-5)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Produtos em baixa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.emBaixa.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item abaixo do estoque mínimo.</p>
            ) : (
              <ul className="space-y-2">
                {d.emBaixa.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{p.nome}</span>
                    <span className="text-warning">
                      {num(p.estoque_atual, 0)} / min {num(p.estoque_minimo, 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-destructive" /> Vencendo em breve
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d.vencendo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item vencendo nos próximos 30 dias.</p>
            ) : (
              <ul className="space-y-2">
                {d.vencendo.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{p.nome}</span>
                    <span className="text-destructive">{dateBR(p.validade)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "info" | "success" | "warning" | "destructive";
}) {
  const toneMap = {
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
