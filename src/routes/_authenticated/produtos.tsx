import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, FileSpreadsheet, FileText, AlertTriangle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductForm } from "@/components/products/ProductForm";
import { useRole } from "@/hooks/useRole";
import { num, dateBR, daysUntil } from "@/lib/formatters";
import { exportToExcel, exportToPDF } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: ProdutosPage,
});

function ProdutosPage() {
  const qc = useQueryClient();
  const role = useRole();
  const [q, setQ] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  const produtos = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*, categorias(nome), fornecedores(nome)")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!produtos.data) return [];
    const term = q.toLowerCase();
    return produtos.data.filter(
      (p: any) =>
        !term ||
        p.nome.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.codigo_barras ?? "").toLowerCase().includes(term),
    );
  }, [produtos.data, q]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto excluído");
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleExportExcel = () => {
    exportToExcel(
      filtered.map((p: any) => ({
        SKU: p.sku,
        Nome: p.nome,
        Categoria: p.categorias?.nome ?? "",
        Responsável: p.fornecedores?.nome ?? "",
        "Código de Barras": p.codigo_barras ?? "",
        "Estoque Atual": Number(p.estoque_atual),
        "Estoque Mínimo": Number(p.estoque_minimo),
        Unidade: p.unidade,
        Validade: p.validade ?? "",
        Ativo: p.ativo ? "Sim" : "Não",
      })),
      "produtos",
    );
  };

  const handleExportPDF = () => {
    exportToPDF(
      "Relatório de Produtos",
      ["SKU", "Nome", "Categoria", "Estoque", "Mínimo", "Validade"],
      filtered.map((p: any) => [
        p.sku,
        p.nome,
        p.categorias?.nome ?? "",
        `${num(p.estoque_atual, 0)} ${p.unidade}`,
        num(p.estoque_minimo, 0),
        p.validade ? dateBR(p.validade) : "",
      ]),
      "produtos",
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie seu catálogo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
          {role.isGerente && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpenForm(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Novo produto
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, SKU ou código..."
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <span className="text-sm text-muted-foreground">{filtered.length} itens</span>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Carregando...</TableCell></TableRow>
                )}
                {!produtos.isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>
                )}
                {/* preços removidos: sistema apenas de controle de estoque */}
                {filtered.map((p: any) => {
                  const baixo = Number(p.estoque_atual) <= Number(p.estoque_minimo);
                  const dvenc = daysUntil(p.validade);
                  const venc = dvenc !== null && dvenc >= 0 && dvenc <= 30;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{p.categorias?.nome ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className={baixo ? "text-warning-foreground" : ""}>
                          {num(p.estoque_atual, 0)} {p.unidade}
                        </span>
                        {baixo && (
                          <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-warning-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{num(p.estoque_minimo, 0)}</TableCell>
                      <TableCell>
                        {p.validade ? (
                          <span className={venc ? "text-destructive" : ""}>{dateBR(p.validade)}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {p.ativo ? (
                          <Badge variant="secondary" className="bg-success/15 text-success">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {role.isGerente && (
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpenForm(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {role.isAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleting(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <ProductForm initial={editing ?? undefined} onDone={() => setOpenForm(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e também remove todas as movimentações do produto <b>{deleting?.nome}</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && del.mutate(deleting.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
