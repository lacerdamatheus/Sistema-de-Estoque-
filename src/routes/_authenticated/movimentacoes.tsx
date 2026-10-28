import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, ArrowDownCircle, ArrowUpCircle, Settings2, FileSpreadsheet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { num, dateTimeBR } from "@/lib/formatters";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/movimentacoes")({
  component: MovimentacoesPage,
});

const schema = z.object({
  produto_id: z.string().uuid("Selecione um produto"),
  tipo: z.enum(["entrada", "saida", "ajuste"]),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero"),
  motivo: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

function MovimentacoesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const role = useRole();
  const [open, setOpen] = useState(false);
  const [filterTipo, setFilterTipo] = useState<string>("todos");

  const movs = useQuery({
    queryKey: ["movimentacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*, produtos(nome, unidade, sku)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const produtos = useQuery({
    queryKey: ["produtos-select"],
    queryFn: async () =>
      (await supabase.from("produtos").select("id, nome, sku, unidade, estoque_atual").order("nome")).data ?? [],
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { produto_id: "", tipo: "entrada", quantidade: 0, motivo: "", observacoes: "" },
  });

  const create = useMutation({
    mutationFn: async (v: z.infer<typeof schema>) => {
      const { error } = await supabase.from("movimentacoes").insert({
        ...v,
        usuario_id: user!.id,
        motivo: v.motivo || null,
        observacoes: v.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada");
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["produtos-select"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      form.reset({ produto_id: "", tipo: "entrada", quantidade: 0, motivo: "", observacoes: "" });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!movs.data) return [];
    return filterTipo === "todos" ? movs.data : movs.data.filter((m: any) => m.tipo === filterTipo);
  }, [movs.data, filterTipo]);

  const exp = () => {
    exportToExcel(
      filtered.map((m: any) => ({
        Data: dateTimeBR(m.created_at),
        Tipo: m.tipo,
        Produto: m.produtos?.nome ?? "",
        SKU: m.produtos?.sku ?? "",
        Quantidade: Number(m.quantidade),
        "Estoque Anterior": Number(m.estoque_anterior ?? 0),
        "Estoque Posterior": Number(m.estoque_posterior ?? 0),
        Motivo: m.motivo ?? "",
        Observações: m.observacoes ?? "",
      })),
      "movimentacoes",
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Movimentações</h1>
          <p className="text-sm text-muted-foreground">Registre entradas, saídas e ajustes de estoque.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exp}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar
          </Button>
          {role.isOperador && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nova movimentação
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
                <SelectItem value="ajuste">Ajustes</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filtered.length} registros</span>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movs.isLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
                )}
                {!movs.isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Nenhuma movimentação.</TableCell></TableRow>
                )}
                {filtered.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm">{dateTimeBR(m.created_at)}</TableCell>
                    <TableCell><TipoBadge tipo={m.tipo} /></TableCell>
                    <TableCell className="font-medium">
                      {m.produtos?.nome} <span className="text-xs text-muted-foreground">({m.produtos?.sku})</span>
                    </TableCell>
                    <TableCell className="text-right">{num(m.quantidade, 0)} {m.produtos?.unidade}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {num(m.estoque_anterior ?? 0, 0)} → <b className="text-foreground">{num(m.estoque_posterior ?? 0, 0)}</b>
                    </TableCell>
                    <TableCell className="text-sm">{m.motivo ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova movimentação</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Produto</Label>
              <Select
                value={form.watch("produto_id")}
                onValueChange={(v) => form.setValue("produto_id", v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} ({p.sku}) — {num(p.estoque_atual, 0)} {p.unidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.produto_id && (
                <p className="text-xs text-destructive">{form.formState.errors.produto_id.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.watch("tipo")} onValueChange={(v: any) => form.setValue("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="ajuste">Ajuste (define saldo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input type="number" step="0.001" {...form.register("quantidade")} />
                {form.formState.errors.quantidade && (
                  <p className="text-xs text-destructive">{form.formState.errors.quantidade.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Input {...form.register("motivo")} placeholder="Ex: Compra fornecedor, venda, perda..." />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} {...form.register("observacoes")} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Registrando..." : "Registrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  if (tipo === "entrada") return <Badge className="bg-success/15 text-success hover:bg-success/20"><ArrowDownCircle className="mr-1 h-3 w-3" /> Entrada</Badge>;
  if (tipo === "saida") return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20"><ArrowUpCircle className="mr-1 h-3 w-3" /> Saída</Badge>;
  return <Badge variant="secondary"><Settings2 className="mr-1 h-3 w-3" /> Ajuste</Badge>;
}
