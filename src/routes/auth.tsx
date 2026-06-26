import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Admin — Girls Money" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Bem-vinda!");
      navigate({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Conta criada — faça login.");
      setMode("signin");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--gradient-hero)" }}>
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center text-gold" style={{ background: "var(--gradient-primary)" }}>
            <Lock className="h-4 w-4 icon-gold" />
          </div>
          <div>
            <h1 className="font-semibold tracking-tight">Área Administrativa</h1>
            <p className="text-xs text-muted-foreground">Acesso restrito</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="pwd">Senha</Label>
            <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 text-xs text-muted-foreground hover:text-foreground w-full">
          {mode === "signin" ? "Primeiro acesso? Criar conta admin" : "Já tenho conta — entrar"}
        </button>
        <p className="text-[10px] text-muted-foreground mt-4 text-center">
          Apenas o e-mail autorizado recebe permissões de administrador automaticamente.
        </p>
      </Card>
    </div>
  );
}
