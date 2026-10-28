import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, BarChart3, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/30">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">StockFlow</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">
              Começar agora <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-16 pb-24">
        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            ERP de gestão de estoque
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Controle total do seu <span className="text-primary">estoque</span>,
            em um só lugar.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Cadastro de produtos, movimentações, dashboards, exportação dos dados em
            Excel e PDF, controle de validade e muito mais.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Acessar sistema</Link>
            </Button>
          </div>
        </section>

        <section className="mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Package, title: "Produtos e Lotes", desc: "SKU, código de barras, validade e estoque mínimo." },
            { icon: BarChart3, title: "Dashboards", desc: "KPIs em tempo real e gráficos interativos." },
            { icon: ShieldCheck, title: "Permissões", desc: "Admin, Gerente, Operador e Visualizador." },
            { icon: Zap, title: "Exportação", desc: "Excel, PDF e importação de planilhas." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} StockFlow ERP
      </footer>
    </div>
  );
}
