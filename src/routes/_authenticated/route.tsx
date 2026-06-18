import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/brand";
import { LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { role, fullName, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isStaff = role === "staff" || role === "admin";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  const navItem = (to: string, label: string, Icon: typeof UserIcon) => (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        path === to ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
      }`}
    >
      <Icon className="size-4" /> {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Logo />
          <nav className="flex items-center gap-1">
            {navItem("/app", "My queue", UserIcon)}
            {isStaff && navItem("/staff", "Staff console", LayoutDashboard)}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-muted-foreground">
              {fullName || "Account"}
            </span>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
