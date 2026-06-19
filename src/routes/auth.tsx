import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/brand";
import { Loader2 } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  role: z.enum(["patient", "staff"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

const credSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [isSignup, setIsSignup] = useState(search.mode === "signup");
  const [signupRole, setSignupRole] = useState<"patient" | "staff">(search.role ?? "patient");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Redirect already-authenticated users to their home.
  useEffect(() => {
    if (!loading && user) {
      navigate({ to: role === "staff" || role === "admin" ? "/staff" : "/app", replace: true });
    }
  }, [loading, user, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = credSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim(), role: signupRole },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome aboard!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
      // Navigation handled by the effect once auth state updates.
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(
        msg.includes("already registered")
          ? "That email is already registered. Try signing in."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <div className="px-6 py-5 max-w-7xl mx-auto w-full">
        <Logo />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md bg-surface ring-1 ring-border rounded-3xl p-8 shadow-sm animate-entrance">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {isSignup ? "Join the queue or manage your facility." : "Sign in to track your queue."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Full name
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    maxLength={100}
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    I am a
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(["patient", "staff"] as const).map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setSignupRole(r)}
                        className={`rounded-xl border px-4 py-2.5 text-sm font-semibold capitalize transition-colors ${
                          signupRole === r
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input hover:bg-accent"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary text-primary-foreground font-semibold py-3 hover:bg-primary/90 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="text-sm text-muted-foreground mt-6 text-center">
            {isSignup ? "Already have an account?" : "New to Valence Health?"}{" "}
            <button
              onClick={() => setIsSignup((v) => !v)}
              className="font-semibold text-primary hover:underline"
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
          <p className="text-xs text-muted-foreground/70 mt-4 text-center">
            <Link to="/" className="hover:underline">
              ← Back home
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
