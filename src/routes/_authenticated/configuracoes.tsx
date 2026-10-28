import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useRole, type AppRole } from "@/hooks/useRole";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateBR } from "@/lib/formatters";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfigPage,
});

const roleLabels: Record<AppRole, string> = {
  admin: "Admin",
  gerente: "Gerente",
  operador: "Operador",
  visualizador: "Visualizador",
};

function ConfigPage() {
  const { user } = useAuth();
  const { role, isAdmin } = useRole();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Perfil, sistema e permissões.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meu perfil</CardTitle>
          <CardDescription>Informações da sua conta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Email:</span> {user?.email}</div>
          <div><span className="text-muted-foreground">Papel:</span> <Badge variant="secondary">{role ? roleLabels[role] : "—"}</Badge></div>
        </CardContent>
      </Card>

      {isAdmin && <UsersManagement />}

      <Card>
        <CardHeader>
          <CardTitle>Sobre o sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><b className="text-foreground">StockFlow ERP</b> — controle profissional de estoque.</p>
          <p>Backup automático: os dados são armazenados no  Cloud com replicação e snapshots automáticos.</p>
          <p>Recursos: cadastro de produtos, código de barras, movimentações, dashboards, relatórios, exportação Excel/PDF, controle de validade e permissões.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersManagement() {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const [prof, roles] = await Promise.all([
        supabase.from("profiles").select("id, nome_completo, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (prof.error) throw prof.error;
      if (roles.error) throw roles.error;
      const roleByUser: Record<string, AppRole> = {};
      const rank: Record<AppRole, number> = { admin: 4, gerente: 3, operador: 2, visualizador: 1 };
      for (const r of roles.data as any[]) {
        const cur = roleByUser[r.user_id];
        if (!cur || rank[r.role as AppRole] > rank[cur]) roleByUser[r.user_id] = r.role;
      }
      return (prof.data ?? []).map((p: any) => ({ ...p, role: roleByUser[p.id] ?? "visualizador" }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // remove all existing then insert single new
      const del = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (del.error) throw del.error;
      const ins = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (ins.error) throw ins.error;
    },
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários e permissões</CardTitle>
        <CardDescription>Apenas administradores podem alterar papéis.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-52">Papel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data?.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nome_completo ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{dateBR(u.created_at)}</TableCell>
                <TableCell>
                  <Select
                    value={u.role}
                    onValueChange={(v: AppRole) => setRole.mutate({ userId: u.id, role: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(roleLabels) as AppRole[]).map((r) => (
                        <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
