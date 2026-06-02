"use client";

import Link from "next/link";
import { useState } from "react";

type LoginRole = "practice_admin" | "doctor_user" | "pharmacy_user";

const roleOptions: Array<{
  value: LoginRole;
  label: string;
  title: string;
  description: string;
}> = [
  {
    value: "practice_admin",
    label: "Admin-Login",
    title: "Praxis-Admin",
    description: "Setup, PMS, Billing und angebundene Partner verwalten.",
  },
  {
    value: "doctor_user",
    label: "User-Login",
    title: "Arzt / Bediener",
    description: "Rezepte freigeben, verfolgen und Rueckgabe fuer das PMS vorbereiten.",
  },
  {
    value: "pharmacy_user",
    label: "Apotheke-Login",
    title: "Apotheke",
    description: "Freigaben sehen, Abgabe absichern und Abo verwalten.",
  },
];

type LoginScreenProps = {
  initialRole?: LoginRole;
  initialError?: string | null;
  registered?: boolean;
};

export function LoginScreen({
  initialRole = "practice_admin",
  initialError = null,
  registered = false,
}: LoginScreenProps) {
  const [role, setRole] = useState<LoginRole>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">(initialError ? "error" : "idle");
  const [error, setError] = useState(initialError ?? "");

  async function submit() {
    setState("loading");
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, roleHint: role }),
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
          <h1>Admin, User oder Apotheke anmelden</h1>
          <p className="hero-copy">
            Jede Rolle hat ihre eigene Maske. Deshalb wird der Einstieg bereits vor dem Login sauber getrennt.
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
          {registered ? <p className="release-banner">Registrierung abgeschlossen. Bitte jetzt einloggen.</p> : null}
          <div className="hub-grid compact-role-grid">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`hub-card role-choice-card ${role === option.value ? "active" : ""}`}
                onClick={() => setRole(option.value)}
              >
                <span className="eyebrow">{option.label}</span>
                <h2>{option.title}</h2>
                <p>{option.description}</p>
              </button>
            ))}
          </div>
          <div className="field-grid single-column">
            <label className="field">
              <span>Login-Typ</span>
              <input
                value={roleOptions.find((option) => option.value === role)?.title ?? ""}
                readOnly
              />
            </label>
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
