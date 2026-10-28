import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BarcodeDisplay } from "./BarcodeDisplay";

const schema = z.object({
  sku: z.string().min(1, "Obrigatório"),
  nome: z.string().min(2, "Nome muito curto"),
  descricao: z.string().optional().nullable(),
  categoria_id: z.string().uuid().optional().nullable(),
  fornecedor_id: z.string().uuid().optional().nullable(),
  codigo_barras: z.string().optional().nullable(),
  estoque_atual: z.coerce.number().min(0),
  estoque_minimo: z.coerce.number().min(0),
  unidade: z.string().min(1),
  validade: z.string().optional().nullable(),
  ativo: z.boolean(),
});

export type ProductFormValues = z.infer<typeof schema>;

export function ProductForm({
  initial,
  onDone,
}: {
  initial?: Partial<ProductFormValues> & { id?: string };
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [barcode, setBarcode] = useState(initial?.codigo_barras ?? "");

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: initial?.sku ?? "",
      nome: initial?.nome ?? "",
      descricao: initial?.descricao ?? "",
      categoria_id: initial?.categoria_id ?? null,
      fornecedor_id: initial?.fornecedor_id ?? null,
      codigo_barras: initial?.codigo_barras ?? "",
      estoque_atual: Number(initial?.estoque_atual ?? 0),
      estoque_minimo: Number(initial?.estoque_minimo ?? 0),
      unidade: initial?.unidade ?? "UN",
      validade: initial?.validade ?? "",
      ativo: initial?.ativo ?? true,
    },
  });

  const categorias = useQuery({
    queryKey: ["categorias-list"],
    queryFn: async () => (await supabase.from("categorias").select("id, nome").order("nome")).data ?? [],
  });
  const fornecedores = useQuery({
    queryKey: ["fornecedores-list"],
    queryFn: async () => (await supabase.from("fornecedores").select("id, nome").order("nome")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const payload = {
        ...values,
        validade: values.validade || null,
        categoria_id: values.categoria_id || null,
        fornecedor_id: values.fornecedor_id || null,
        codigo_barras: values.codigo_barras || null,
      };
      if (initial?.id) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Produto atualizado" : "Produto criado");
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const gerarBarras = () => {
    const code = "789" + Math.floor(1000000000 + Math.random() * 9000000000).toString();
    form.setValue("codigo_barras", code);
    setBarcode(code);
  };

  return (
    <form
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="SKU" error={form.formState.errors.sku?.message}>
        <Input {...form.register("sku")} />
      </Field>
      <Field label="Nome" error={form.formState.errors.nome?.message}>
        <Input {...form.register("nome")} />
      </Field>

      <Field label="Categoria" className="sm:col-span-1">
        <Select
          value={form.watch("categoria_id") ?? "none"}
          onValueChange={(v) => form.setValue("categoria_id", v === "none" ? null : v)}
        >
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sem categoria —</SelectItem>
            {categorias.data?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Responsável">
        <Select
          value={form.watch("fornecedor_id") ?? "none"}
          onValueChange={(v) => form.setValue("fornecedor_id", v === "none" ? null : v)}
        >
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sem responsável —</SelectItem>
            {fornecedores.data?.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Descrição" className="sm:col-span-2">
        <Textarea rows={2} {...form.register("descricao")} />
      </Field>


      <Field label="Estoque atual" error={form.formState.errors.estoque_atual?.message}>
        <Input type="number" step="0.001" {...form.register("estoque_atual")} disabled={!!initial?.id} />
        {initial?.id && (
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste o estoque através de movimentações.
          </p>
        )}
      </Field>
      <Field label="Estoque mínimo" error={form.formState.errors.estoque_minimo?.message}>
        <Input type="number" step="0.001" {...form.register("estoque_minimo")} />
      </Field>

      <Field label="Unidade">
        <Input {...form.register("unidade")} placeholder="UN, KG, L..." />
      </Field>
      <Field label="Validade">
        <Input type="date" {...form.register("validade")} />
      </Field>

      <Field label="Código de barras" className="sm:col-span-2">
        <div className="flex gap-2">
          <Input
            {...form.register("codigo_barras")}
            onChange={(e) => {
              form.setValue("codigo_barras", e.target.value);
              setBarcode(e.target.value);
            }}
          />
          <Button type="button" variant="outline" onClick={gerarBarras}>
            Gerar
          </Button>
        </div>
        {barcode && (
          <div className="mt-2 flex justify-center rounded-md border bg-white p-2">
            <BarcodeDisplay value={barcode} />
          </div>
        )}
      </Field>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Switch
          checked={form.watch("ativo")}
          onCheckedChange={(v) => form.setValue("ativo", v)}
        />
        <Label>Produto ativo</Label>
      </div>

      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancelar</Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
