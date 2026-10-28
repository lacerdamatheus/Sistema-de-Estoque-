import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRole } from "@/hooks/useRole";

export const Route = createFileRoute("/_authenticated/cadastros")({
  component: CadastrosPage,
});

function CadastrosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastros</h1>
        <p className="text-sm text-muted-foreground">Gerencie categorias e responsáveis.</p>
      </div>
      <Tabs defaultValue="categorias">
        <TabsList>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="fornecedores">Responsáveis</TabsTrigger>
        </TabsList>
        <TabsContent value="categorias" className="pt-4"><CategoriasTab /></TabsContent>
        <TabsContent value="fornecedores" className="pt-4"><FornecedoresTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CategoriasTab() {
  const qc = useQueryClient();
  const role = useRole();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const list = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await supabase.from("categorias").select("*").order("nome")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categorias").insert({ nome, descricao: descricao || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria criada");
      setNome(""); setDescricao("");
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["categorias-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["categorias"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {role.isGerente && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nova categoria</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
            <div className="flex items-end"><Button onClick={() => create.mutate()} disabled={!nome || create.isPending}><Plus className="mr-2 h-4 w-4" /> Adicionar</Button></div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead className="w-20"></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.data?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{c.descricao ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {role.isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FornecedoresTab() {
  const qc = useQueryClient();
  const role = useRole();
  const [f, setF] = useState({ nome: "", cnpj: "", email: "", telefone: "", endereco: "" });

  const list = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => (await supabase.from("fornecedores").select("*").order("nome")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || null]));
      payload.nome = f.nome;
      const { error } = await supabase.from("fornecedores").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsável criado");
      setF({ nome: "", cnpj: "", email: "", telefone: "", endereco: "" });
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      qc.invalidateQueries({ queryKey: ["fornecedores-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["fornecedores"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {role.isGerente && (
        <Card>
          <CardHeader><CardTitle className="text-base">Novo responsável</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>CNPJ</Label><Input value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Endereço</Label><Input value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} /></div>
            <div className="flex items-end md:col-span-3"><Button onClick={() => create.mutate()} disabled={!f.nome || create.isPending}><Plus className="mr-2 h-4 w-4" /> Adicionar</Button></div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>CNPJ</TableHead><TableHead>Contato</TableHead><TableHead className="w-20"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {list.data?.map((x: any) => (
                <TableRow key={x.id}>
                  <TableCell className="font-medium">{x.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{x.cnpj ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[x.email, x.telefone].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {role.isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => del.mutate(x.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
