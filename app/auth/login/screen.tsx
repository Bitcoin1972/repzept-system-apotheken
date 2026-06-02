"use client";

import Link from "next/link";
import { useState } from "react";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    setState("loading");
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setState("error");
      setError(payload.error ?? "Login fehlgeschlagen.");
      return;
    }

    window.location.href = payload.redirectTo;
  }

  return (
    <main className="workspace-shell auth-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Login</p>
          <h1>Praxis oder Apotheke anmelden</h1>
          <p className="hero-copy">
            Beide Rollen arbeiten mit demselben System, landen aber nach dem Login direkt in ihrer
            eigenen Arbeitsmaske.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/auth/register" className="secondary-link">
            Neu registrieren
          </Link>
        </div>
      </section>

      <section className="composer-layout single-stack">
        <article className="panel">
          <div className="field-grid single-column">
            <label className="field">
              <span>E-Mail</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
            </label>
            <label className="field">
              <span>Passwort</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
              />
            </label>
          </div>
          <div className="action-row">
            <button type="button" className="primary-button" onClick={submit}>
              {state === "loading" ? "Meldet an..." : "Anmelden"}
            </button>
            {state === "error" ? <span className="status-text error">{error}</span> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
