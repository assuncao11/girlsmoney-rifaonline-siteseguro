import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/seed-admin")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const email = "agnysassuncao11@gmail.com";
        const password = "adm123agnys";

        // Check existing
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email === email);

        if (!existing) {
          const { error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
          if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { "content-type": "application/json" } });
        } else {
          // Ensure password and role
          await supabaseAdmin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
          await supabaseAdmin.from("user_roles").upsert({ user_id: existing.id, role: "admin" }, { onConflict: "user_id,role" });
        }

        return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
      },
    },
  },
});
