import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient, useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { CheckIcon, SparkIcon } from "../components/icons";

type Mode = "signin" | "signup";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function Auth() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, navigate, next]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "signin"
          ? await authClient.signIn.email({ email: form.email, password: form.password })
          : await authClient.signUp.email({
              email: form.email,
              password: form.password,
              name: form.name,
            });

      if (result.error) {
        const message = result.error.message || "";
        if (/invalid|credential/i.test(message)) {
          throw new Error("Email o password non corretti.");
        }
        if (/exist/i.test(message)) {
          throw new Error("Esiste già un account con questa email.");
        }
        throw new Error(message || "Autenticazione non riuscita.");
      }

      await refresh();
      showToast(mode === "signin" ? "Bentornato su Riuso!" : "Account creato, benvenuto!", "success");
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Autenticazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-aside">
        <span className="eyebrow">
          <SparkIcon width={16} height={16} /> Il marketplace dell'usato
        </span>
        <h1>Meno sprechi. Più stile.</h1>
        <p>
          Crea il tuo account per pubblicare annunci, salvare i preferiti, fare offerte e gestire
          gli ordini.
        </p>
        <ul className="auth-points">
          <li>
            <CheckIcon width={17} height={17} /> Pubblica in meno di un minuto
          </li>
          <li>
            <CheckIcon width={17} height={17} /> Foto su Neon Object Storage
          </li>
          <li>
            <CheckIcon width={17} height={17} /> Pagamenti demo, zero rischi
          </li>
        </ul>
      </section>

      <section className="auth-card">
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
          >
            Accedi
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
          >
            Registrati
          </button>
        </div>

        <form className="form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                autoComplete="name"
                required
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="button button-primary button-large" disabled={busy}>
            {busy ? "Un attimo…" : mode === "signin" ? "Accedi" : "Crea account"}
          </button>
        </form>

        <p className="auth-foot">
          {mode === "signin" ? (
            <>
              Non hai un account?{" "}
              <button type="button" className="text-link" onClick={() => setMode("signup")}>
                Registrati
              </button>
            </>
          ) : (
            <>
              Hai già un account?{" "}
              <button type="button" className="text-link" onClick={() => setMode("signin")}>
                Accedi
              </button>
            </>
          )}
        </p>
        <p className="auth-note">
          Autenticazione gestita da Neon Auth. <Link to="/">Torna al feed</Link>
        </p>
      </section>
    </div>
  );
}
