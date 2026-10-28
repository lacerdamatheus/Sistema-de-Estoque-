import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { num, dateTimeBR } from "@/lib/formatters";
import { exportToExcel, exportToPDF } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const [de, setDe] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [ate, setAte] = useState(() => new Date().toISOString().slice(0, 10));

  const data = useQuery({
    queryKey: ["relatorio", de, ate],
    queryFn: async () => {
      const inicio = new Date(de + "T00:00:00").toISOString();
      const fim = new Date(ate + "T23:59:59").toISOString();
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, produtos(nome, sku, unidade)")
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const rows = data.data ?? [];
    const entradas = rows.filter((r: any) => r.tipo === "entrada").reduce((s, r: any) => s + Number(r.quantidade), 0);
    const saidas = rows.filter((r: any) => r.tipo === "saida").reduce((s, r: any) => s + Number(r.quantidade), 0);
    const ajustes = rows.filter((r: any) => r.tipo === "ajuste").length;
    return { entradas, saidas, ajustes, rows };
  }, [data.data]);

  const excel = () => {
    exportToExcel(
      stats.rows.map((r: any) => ({
        Data: dateTimeBR(r.created_at),
        Tipo: r.tipo,
        Produto: r.produtos?.nome,
        SKU: r.produtos?.sku,
        Quantidade: Number(r.quantidade),
        Unidade: r.produtos?.unidade ?? "",
        "Estoque Posterior": Number(r.estoque_posterior ?? 0),
        Motivo: r.motivo ?? "",
      })),
      `relatorio_${de}_${ate}`,
    );
  };

  const pdf = () => {
    exportToPDF(
      `Relatório de Movimentações — ${de} a ${ate}`,
      ["Data", "Tipo", "Produto", "SKU", "Qtd", "Saldo"],
      stats.rows.map((r: any) => [
        dateTimeBR(r.created_at),
        r.tipo,
        r.produtos?.nome ?? "",
        r.produtos?.sku ?? "",
        num(r.quantidade, 0),
        num(r.estoque_posterior ?? 0, 0),
      ]),
      `relatorio_${de}_${ate}`,
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Histórico de movimentações por período.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label>De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={excel}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
            <Button variant="outline" onClick={pdf}><FileText className="mr-2 h-4 w-4" /> PDF</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total de entradas" value={num(stats.entradas, 0)} />
        <StatCard title="Total de saídas" value={num(stats.saidas, 0)} />
        <StatCard title="Ajustes" value={num(stats.ajustes, 0)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Movimentações no período</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Sem movimentações no período.</TableCell></TableRow>
                )}
                {stats.rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{dateTimeBR(r.created_at)}</TableCell>
                    <TableCell className="capitalize">{r.tipo}</TableCell>
                    <TableCell>{r.produtos?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right">{num(r.quantidade, 0)} {r.produtos?.unidade ?? ""}</TableCell>
                    <TableCell className="text-right">{num(r.estoque_posterior ?? 0, 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
