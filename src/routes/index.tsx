import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trophy, Medal, Award, Sparkles, CheckCircle2, MessageCircle, ShieldCheck, Loader2 } from "lucide-react";
import { z } from "zod";
import logoGirlsMoney from "@/assets/girls-money-logo.png.asset.json";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Girls Money — Escolha seus números" },
      { name: "description", content: "Concorra a R$ 2.000 no Pix, R$ 1.000 no Pix e vale-compras O Boticário de R$ 200." },
    ],
  }),
  component: Index,
});

const PIX_LINKS: Record<number, string> = {
  1: "https://link.picpay.com/p/17824988076a3ec5f789343",
  2: "https://link.picpay.com/p/17824990976a3ec719a2615",
  3: "https://link.picpay.com/p/17824991816a3ec76d6df0d",
};
const PRICES: Record<number, number> = { 1: 20, 2: 30, 3: 40 };
const WHATSAPP_ADMIN = "5547991154611";

type NumeroRow = { numero: number; status: "disponivel" | "reservado" | "pago" };

const cadastroSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(100),
  email: z.string().trim().email("E-mail inválido").max(160),
  whatsapp: z.string().trim().min(10, "WhatsApp inválido").max(20),
});

function Index() {
  const navigate = useNavigate();
  const [numeros, setNumeros] = useState<NumeroRow[] | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [form, setForm] = useState({ nome: "", email: "", whatsapp: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("numeros").select("numero,status").order("numero");
    if (error) { toast.error("Erro ao carregar números"); return; }
    setNumeros(data as NumeroRow[]);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase.channel("numeros-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "numeros" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const total = useMemo(() => PRICES[selecionados.length] ?? 0, [selecionados.length]);

  function toggle(n: number, status: string) {
    if (status !== "disponivel") { toast.warning("Esse número não está disponível"); return; }
    setSelecionados((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= 3) { toast.warning("Máximo de 3 números por compra"); return prev; }
      return [...prev, n].sort((a, b) => a - b);
    });
  }

  async function finalizar() {
    if (selecionados.length === 0) { toast.error("Escolha pelo menos 1 número"); return; }
    const parsed = cadastroSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    const { error } = await supabase.rpc("criar_reserva", {
      _nome: parsed.data.nome,
      _email: parsed.data.email,
      _whatsapp: parsed.data.whatsapp,
      _numeros: selecionados,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message || "Não foi possível reservar"); load(); return; }
    toast.success("Reserva criada! Redirecionando para o pagamento…");
    const link = PIX_LINKS[selecionados.length];
    setTimeout(() => { window.location.href = link; }, 800);
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoGirlsMoney.url} alt="Girls Money" className="h-10 w-10 rounded-full object-cover ring-1 ring-[hsl(var(--gold,42_45%_60%))]/40" />
            <span className="font-semibold tracking-tight">Girls Money</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/auth" })}>Admin</Button>
        </div>
      </header>

      {/* PRÊMIOS */}

      <section id="premios" className="mx-auto max-w-6xl px-4 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Prêmios</h2>
          <p className="text-muted-foreground mt-2">Três chances de ganhar.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          <PrizeCard place="1º Lugar" icon={<Trophy className="h-7 w-7 icon-gold" />} title="Vale-compras O Boticário" amount="R$ 200,00" color="gold" />
          <PrizeCard place="2º Lugar" icon={<Medal className="h-7 w-7 icon-gold" />} title="Pix" amount="R$ 1.000,00" color="silver" />
          <PrizeCard place="3º Lugar" icon={<Award className="h-7 w-7 icon-gold" />} title="Pix" amount="R$ 2.000,00" color="bronze" />
        </div>
      </section>

      {/* VALORES */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Valores</h2>
          <p className="text-muted-foreground mt-2">Quanto mais números, maiores as chances.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          <PriceCard qty={1} price={20} />
          <PriceCard qty={2} price={30} />
          <PriceCard qty={3} price={40} highlight />
        </div>
      </section>

      {/* GRID + RESUMO */}
      <section id="numeros" className="mx-auto max-w-6xl px-4 pb-24">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Escolha seus números</h2>
          <p className="text-muted-foreground mt-2">Selecione até 3 números entre 001 e 350.</p>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8">
          <Card className="p-4 sm:p-6">
            <Legend />
            {numeros === null ? (
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-2 mt-4">
                {Array.from({ length: 80 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-10 gap-2 mt-4">
                {numeros.map((n) => {
                  const sel = selecionados.includes(n.numero);
                  return (
                    <button
                      key={n.numero}
                      onClick={() => toggle(n.numero, n.status)}
                      disabled={n.status !== "disponivel" && !sel}
                      className={[
                        "aspect-square rounded-md text-xs sm:text-sm font-mono font-medium transition-all duration-150",
                        "border focus:outline-none focus:ring-2 focus:ring-ring",
                        sel
                          ? "bg-info text-white border-info scale-105 shadow-elegant"
                          : n.status === "disponivel"
                          ? "bg-card hover:bg-accent hover:scale-105 border-border text-foreground"
                          : n.status === "reservado"
                          ? "bg-warning/15 text-warning border-warning/30 cursor-not-allowed"
                          : "bg-destructive/15 text-destructive border-destructive/30 cursor-not-allowed line-through",
                      ].join(" ")}
                    >
                      {String(n.numero).padStart(3, "0")}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* RESUMO */}
          <div className="lg:sticky lg:top-20 self-start space-y-4">
            <Card className="p-6" style={{ background: "var(--gradient-card)" }}>
              <h3 className="font-semibold text-lg">Resumo da compra</h3>
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Quantidade" value={`${selecionados.length} ${selecionados.length === 1 ? "número" : "números"}`} />
                <Row
                  label="Números"
                  value={selecionados.length ? selecionados.map((n) => String(n).padStart(3, "0")).join(", ") : "—"}
                />
                <div className="h-px bg-border my-3" />
                <div className="flex justify-between items-baseline">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-3xl font-bold tracking-tight">R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div>
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Maria Silva" />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="voce@email.com" />
                </div>
                <div>
                  <Label htmlFor="wpp">WhatsApp</Label>
                  <Input id="wpp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(47) 99999-9999" />
                </div>
              </div>

              <Button onClick={finalizar} disabled={submitting || selecionados.length === 0} className="w-full mt-5" size="lg" style={{ background: "var(--gradient-primary)" }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar pagamento"}
              </Button>
            </Card>

            <Card className="p-4 text-xs text-muted-foreground border-dashed">
              <div className="flex gap-2">
                <MessageCircle className="h-4 w-4 mt-0.5 icon-gold shrink-0" />
                <p>
                  Pagamentos para a gerente <strong className="text-foreground">Agnys Assunção</strong>. Envie o comprovante para o WhatsApp{" "}
                  <a href={`https://wa.me/${WHATSAPP_ADMIN}`} target="_blank" rel="noreferrer" className="text-primary font-medium underline">
                    (47) 99115-4611
                  </a>.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Girls Money. Todos os direitos reservados.
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function PrizeCard({ place, icon, title, amount, color }: { place: string; icon: React.ReactNode; title: string; amount: string; color: "gold" | "silver" | "bronze" }) {
  const colorClass = color === "gold" ? "text-gold" : color === "silver" ? "text-silver" : "text-bronze";
  return (
    <Card className="p-6 hover:shadow-elegant transition-shadow" style={{ background: "var(--gradient-card)" }}>
      <div className={`${colorClass} mb-3`}>{icon}</div>
      <div className="text-sm text-muted-foreground">{place}</div>
      <div className="text-lg font-semibold mt-1">{title}</div>
      <div className="text-2xl font-bold mt-2 tracking-tight">{amount}</div>
    </Card>
  );
}

function PriceCard({ qty, price, highlight }: { qty: number; price: number; highlight?: boolean }) {
  return (
    <Card className={`p-6 relative ${highlight ? "ring-2 ring-gold shadow-glow" : ""}`} style={{ background: "var(--gradient-card)" }}>
      {highlight && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-white border-gold">
          Melhor custo-benefício
        </Badge>
      )}
      <div className="text-sm text-muted-foreground">{qty} {qty === 1 ? "número" : "números"}</div>
      <div className="text-4xl font-bold mt-2 tracking-tight">R$ {price},00</div>
      <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 icon-gold" /> Reserva imediata</li>
        <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 icon-gold" /> Pagamento via Pix</li>
      </ul>
    </Card>
  );
}

function Legend() {
  const items = [
    { c: "bg-card border-border", l: "Disponível" },
    { c: "bg-warning/15 border-warning/30", l: "Reservado" },
    { c: "bg-info border-info", l: "Selecionado" },
    { c: "bg-destructive/15 border-destructive/30", l: "Pago" },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map((it) => (
        <div key={it.l} className="flex items-center gap-1.5">
          <span className={`inline-block h-4 w-4 rounded border ${it.c}`} />
          {it.l}
        </div>
      ))}
    </div>
  );
}
