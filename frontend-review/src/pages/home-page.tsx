import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/mock-api";

type AuthMode = "login" | "signup";

export function HomePage({ onSignedIn }: { onSignedIn: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setError("");

    try {
      if (mode === "signup") {
        await api.signUp({
          name: String(formData.get("name")),
          email: String(formData.get("email")),
          password: String(formData.get("password")),
        });
      } else {
        await api.signIn({
          email: String(formData.get("email")),
          password: String(formData.get("password")),
        });
      }
      onSignedIn();
      navigate("/dashboard", { replace: true });
    } catch {
      setError(mode === "signup" ? "Could not create account. The email may already exist." : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_420px]">
        <div>
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">EngageClinic AI</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-normal md:text-5xl">
            Patient engagement dashboard for clinic teams.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Sign in to manage chatbot conversations, bookings, doctors, clinic knowledge, and calendars.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{mode === "login" ? "Log in" : "Create account"}</p>
                <p className="text-sm text-muted-foreground">Use email and password.</p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 rounded-md border p-1">
              <button
                type="button"
                className={mode === "login" ? "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" : "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground"}
                onClick={() => setMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={mode === "signup" ? "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" : "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground"}
                onClick={() => setMode("signup")}
              >
                Sign up
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              {mode === "signup" && <Input name="name" placeholder="Full name" required />}
              <Input name="email" type="email" placeholder="Email" defaultValue={mode === "login" ? "admin@astergrove.example" : ""} required />
              <Input name="password" type="password" placeholder="Password" defaultValue={mode === "login" ? "password123" : ""} required minLength={6} />
              <Button className="w-full" disabled={loading}>
                {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
              </Button>
            </form>

            {error && <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
