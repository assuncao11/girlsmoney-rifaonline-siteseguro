import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { LogOut, Users, Hash, DollarSign, Clock, CheckCircle2, XCircle, Trash2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Girls Money" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Participante = { id: string; nome: string; email: string; whatsapp: string; created_at: string };
type Numero = { numero: number; status: string; participante_id: string | null };

function AdminPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [numeros, setNumeros] = useState<Numero[]>([]);

  async function loadAll() {
    const [{ data: parts }, { data: nums }] = await Promise.all([
      supabase.from("participantes").select("*").order("created_at", { ascending: false }),
      supabase.from("numeros").select("numero,status,participante_id").order("numero"),
    ]);
    setParticipantes((parts as Participante[]) ?? []);
    setNumeros((nums as Numero[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { navigate({ to: "/auth" }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const admin = !!roles?.some((r) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) loadAll();
    })();
  }, [navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel("admin-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "numeros" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "participantes" }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  async function confirmar(id: string) {
    const { error } = await supabase.rpc("confirmar_pagamento", { _participante_id: id });
    if (error) toast.error(error.message); else { toast.success("Pagamento confirmado"); loadAll(); }
  }
  async function cancelar(id: string) {
    const { error } = await supabase.rpc("cancelar_reserva", { _participante_id: id });
    if (error) toast.error(error.message); else { toast.success("Reserva cancelada"); loadAll(); }
  }
  async function excluir(id: string) {
    if (!confirm("Excluir participante e liberar números?")) return;
    const { error } = await supabase.rpc("excluir_participante", { _participante_id: id });
    if (error) toast.error(error.message); else { toast.success("Excluído"); loadAll(); }
  }

  if (isAdmin === null) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="p-6 max-w-sm text-center">
        <ShieldAlert className="h-8 w-8 mx-auto text-destructive" />
        <h2 className="mt-3 font-semibold">Acesso negado</h2>
        <p className="text-sm text-muted-foreground mt-1">Sua conta não tem permissões de administrador.</p>
        <Button onClick={signOut} variant="outline" className="mt-4">Sair</Button>
      </Card>
    </div>
  );

  const numerosByPart = new Map<string, number[]>();
  numeros.forEach((n) => { if (n.participante_id) { const arr = numerosByPart.get(n.participante_id) ?? []; arr.push(n.numero); numerosByPart.set(n.participante_id, arr); } });
  const statusByPart = new Map<string, string>();
  numeros.forEach((n) => { if (n.participante_id) statusByPart.set(n.participante_id, n.status); });

  const totalVendidos = numeros.filter((n) => n.status !== "disponivel").length;
  const disponiveis = numeros.filter((n) => n.status === "disponivel").length;
  const pagos = numeros.filter((n) => n.status === "pago").length;
  const reservados = numeros.filter((n) => n.status === "reservado").length;
  const arrecadado = participantes.reduce((acc, p) => {
    const nums = numerosByPart.get(p.id) ?? [];
    if (statusByPart.get(p.id) !== "pago") return acc;
    return acc + ({ 1: 20, 2: 30, 3: 40 } as Record<number, number>)[nums.length] || 0;
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg" style={{ background: "var(--gradient-primary)" }} />
            <div>
              <div className="font-semibold tracking-tight text-sm">Girls Money</div>
              <div className="text-[10px] text-muted-foreground">Painel admin</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1.5" /> Sair</Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="participantes">Participantes</TabsTrigger>
            <TabsTrigger value="numeros">Números</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Stat icon={<Users />} label="Participantes" value={participantes.length} />
              <Stat icon={<DollarSign />} label="Total arrecadado (confirmado)" value={`R$ ${arrecadado.toFixed(2).replace(".", ",")}`} />
              <Stat icon={<Hash />} label="Números vendidos" value={totalVendidos} />
              <Stat icon={<Hash />} label="Disponíveis" value={disponiveis} />
              <Stat icon={<Clock />} label="Pagamentos pendentes" value={reservados} />
              <Stat icon={<CheckCircle2 />} label="Pagamentos confirmados" value={pagos} />
            </div>
          </TabsContent>

          <TabsContent value="participantes" className="mt-6">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Números</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participantes.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum participante ainda.</TableCell></TableRow>
                    )}
                    {participantes.map((p) => {
                      const nums = numerosByPart.get(p.id) ?? [];
                      const status = statusByPart.get(p.id) ?? "—";
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.nome}</TableCell>
                          <TableCell><a className="text-primary hover:underline" href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{p.whatsapp}</a></TableCell>
                          <TableCell className="text-muted-foreground">{p.email}</TableCell>
                          <TableCell className="font-mono text-xs">{nums.map((n) => String(n).padStart(3, "0")).join(", ") || "—"}</TableCell>
                          <TableCell>
                            {status === "pago" ? <Badge className="bg-success text-white">Pago</Badge> :
                             status === "reservado" ? <Badge variant="outline" className="border-warning text-warning">Aguardando</Badge> :
                             <Badge variant="outline">—</Badge>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {status !== "pago" && (
                              <Button size="sm" variant="ghost" onClick={() => confirmar(p.id)} className="text-success"><CheckCircle2 className="h-4 w-4" /></Button>
                            )}
                            {status === "reservado" && (
                              <Button size="sm" variant="ghost" onClick={() => cancelar(p.id)} className="text-warning"><XCircle className="h-4 w-4" /></Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => excluir(p.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="numeros" className="mt-6">
            <Card className="p-4">
              <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-15 lg:grid-cols-20 gap-1.5">
                {numeros.map((n) => (
                  <div key={n.numero}
                    className={[
                      "aspect-square rounded-md text-[10px] sm:text-xs font-mono grid place-items-center border",
                      n.status === "disponivel" ? "bg-card border-border text-foreground" :
                      n.status === "reservado" ? "bg-warning/15 border-warning/30 text-warning" :
                      "bg-success/15 border-success/30 text-success",
                    ].join(" ")}>
                    {String(n.numero).padStart(3, "0")}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="p-5" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-card border border-border shadow-elegant">
          <span className="icon-gold">{icon}</span>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        </div>
      </div>
    </Card>
  );
}
