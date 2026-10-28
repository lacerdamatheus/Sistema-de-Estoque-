import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "gerente" | "operador" | "visualizador";

const RANK: Record<AppRole, number> = { admin: 4, gerente: 3, operador: 2, visualizador: 1 };

export function useRole() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppRole | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      if (!data || data.length === 0) return "visualizador";
      const roles = data.map((r) => r.role as AppRole);
      return roles.sort((a, b) => RANK[b] - RANK[a])[0];
    },
  });

  const role = q.data ?? null;
  const can = (min: AppRole) => (role ? RANK[role] >= RANK[min] : false);

  return {
    role,
    loading: q.isLoading,
    isAdmin: role === "admin",
    isGerente: can("gerente"),
    isOperador: can("operador"),
    can,
  };
}
