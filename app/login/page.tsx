import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, getRoleHomePath } from "@/lib/auth";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(getRoleHomePath(user.role));
  }

  const params = searchParams ? await searchParams : {};
  const error = readParam(params.error);
  const registered = readParam(params.registered);

  return (
    <main className="workspace-shell auth-page">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Login</p>
          <h1>Mit bestehender Session weiterarbeiten</h1>
          <p className="hero-copy">
            Login ist bewusst minimal gehalten: E-Mail, Passwort und anschliessend
            Cookie-basierte Session fuer den passenden Bereich.
          </p>
        </div>
      </section>

      <section className="auth-card">
        {registered === "1" ? (
          <p className="release-banner">Registrierung abgeschlossen. Bitte jetzt einloggen.</p>
        ) : null}
        {error ? <p className="release-banner warning">{error}</p> : null}

        <form action="/api/auth/login" method="post" className="auth-form">
          <label className="field">
            <span>E-Mail</span>
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label className="field">
            <span>Passwort</span>
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <div className="action-row">
            <button type="submit" className="primary-button">
              Login
            </button>
            <Link href="/register" className="secondary-link">
              Noch kein Zugang
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
