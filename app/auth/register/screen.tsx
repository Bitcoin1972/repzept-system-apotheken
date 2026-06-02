"use client";

import Link from "next/link";
import { useState } from "react";

type RoleChoice = "practice" | "pharmacy";

export function RegisterScreen() {
  const [role, setRole] = useState<RoleChoice>("practice");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [plan, setPlan] = useState("SMALL");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    setState("loading");
    setError("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role,
        displayName,
        email,
        password,
        practiceName,
        pharmacyName,
        billingEmail,
        plan,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setState("error");
      setError(payload.error ?? "Registrierung fehlgeschlagen.");
      return;
    }

    window.location.href = payload.redirectTo;
  }

  return (
    <main className="workspace-shell auth-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Registrierung</p>
          <h1>Praxis oder Apotheke selbst anlegen</h1>
          <p className="hero-copy">
            Praxen landen nach der Registrierung im Setup-Wizard, Apotheken direkt in ihrer
            Partner- und Abrechnungsmaske.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/auth/login" className="secondary-link">
            Bereits Konto vorhanden
          </Link>
        </div>
      </section>

      <section className="composer-layout single-stack">
        <article className="panel">
          <div className="field-grid">
            <label className="field">
              <span>Rolle</span>
              <select value={role} onChange={(event) => setRole(event.target.value as RoleChoice)}>
                <option value="practice">Praxis</option>
                <option value="pharmacy">Apotheke</option>
              </select>
            </label>
            <label className="field">
              <span>Ansprechpartner</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
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
            {role === "practice" ? (
              <label className="field">
                <span>Praxisname</span>
                <input
                  value={practiceName}
                  onChange={(event) => setPracticeName(event.target.value)}
                  placeholder="Musterpraxis Nord"
                />
              </label>
            ) : null}
            {role === "pharmacy" ? (
              <>
                <label className="field">
                  <span>Apothekenname</span>
                  <input
                    value={pharmacyName}
                    onChange={(event) => setPharmacyName(event.target.value)}
                    placeholder="Apotheke am Markt"
                  />
                </label>
                <label className="field">
                  <span>Billing E-Mail</span>
                  <input
                    value={billingEmail}
                    onChange={(event) => setBillingEmail(event.target.value)}
                    type="email"
                  />
                </label>
                <label className="field">
                  <span>Monatstarif</span>
                  <select value={plan} onChange={(event) => setPlan(event.target.value)}>
                    <option value="SMALL">Small · 99 EUR</option>
                    <option value="STANDARD">Standard · 249 EUR</option>
                    <option value="NETWORK">Network · 499 EUR</option>
                  </select>
                </label>
              </>
            ) : null}
          </div>
          <div className="action-row">
            <button type="button" className="primary-button" onClick={submit}>
              {state === "loading" ? "Registriert..." : "Konto anlegen"}
            </button>
            {state === "error" ? <span className="status-text error">{error}</span> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
