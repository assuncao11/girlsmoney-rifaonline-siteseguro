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

const ADMIN_EMAIL = "agnysassuncao11@gmail.com";

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");

  useEffect(() => {
    // Detect Supabase recovery callback (type=recovery in URL hash)
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setMode("reset");
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && !window.location.hash.includes("type=recovery")) navigate({ to: "/admin" });
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
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Conta criada — faça login.");
      setMode("signin");
      return;
    }

    if (mode === "forgot") {
      if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
        setLoading(false);
        toast.error("Este e-mail não tem permissão para redefinir a senha.");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/auth",
      });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Enviamos um link de redefinição para o seu e-mail.");
      setMode("signin");
      return;
    }

    if (mode === "reset") {
      if (password.length < 8) {
        setLoading(false);
        toast.error("A senha deve ter ao menos 8 caracteres.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Senha atualizada! Faça login novamente.");
      await supabase.auth.signOut();
      window.location.hash = "";
      setPassword("");
      setMode("signin");
      return;
    }
  }

  const titles: Record<typeof mode, { title: string; sub: string; cta: string }> = {
    signin: { title: "Área Administrativa", sub: "Acesso restrito", cta: "Entrar" },
    signup: { title: "Criar conta", sub: "Apenas e-mail autorizado vira admin", cta: "Criar conta" },
    forgot: { title: "Recuperar senha", sub: "Enviaremos um link por e-mail", cta: "Enviar link" },
    reset: { title: "Definir nova senha", sub: "Escolha uma senha forte", cta: "Salvar senha" },
  };
  const t = titles[mode];

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--gradient-hero)" }}>
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center text-gold" style={{ background: "var(--gradient-primary)" }}>
            <Lock className="h-4 w-4 icon-gold" />
          </div>
          <div>
            <h1 className="font-semibold tracking-tight">{t.title}</h1>
            <p className="text-xs text-muted-foreground">{t.sub}</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode !== "reset" && (
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          )}
          {mode !== "forgot" && (
            <div>
              <Label htmlFor="pwd">{mode === "reset" ? "Nova senha" : "Senha"}</Label>
              <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "reset" ? 8 : 6} />
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full" style={{ background: "var(--gradient-primary)" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.cta}
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-1.5 text-xs text-center">
          {mode === "signin" && (
            <>
              <button onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-foreground">
                Esqueci minha senha
              </button>
              <button onClick={() => setMode("signup")} className="text-muted-foreground hover:text-foreground">
                Primeiro acesso? Criar conta admin
              </button>
            </>
          )}
          {(mode === "signup" || mode === "forgot") && (
            <button onClick={() => setMode("signin")} className="text-muted-foreground hover:text-foreground">
              Voltar para o login
            </button>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground mt-4 text-center">
          Apenas o e-mail autorizado recebe permissões de administrador automaticamente.
        </p>
      </Card>
    </div>
  );
}
