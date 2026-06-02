import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, getRoleHomePath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(getRoleHomePath(user.role));
  }

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Repzept Plattform</p>
          <h1>Praxis, Apotheke und Patient in einem Rezeptnetz</h1>
          <p className="hero-copy">
            Praxen geben Rezepte schnell frei, Apotheken sehen Vorabfreigaben sofort und Patienten
            erhalten Abholhinweise mit Maps-Link.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/login?role=practice_admin" className="secondary-link">
            Admin-Login
          </Link>
          <Link href="/login?role=doctor_user" className="secondary-link">
            User-Login
          </Link>
          <Link href="/login?role=pharmacy_user" className="primary-button">
            Apotheke-Login
          </Link>
        </div>
      </section>

      <section className="hub-grid">
        <article className="hub-card">
          <span className="eyebrow">Praxis</span>
          <h2>Rezepte freigeben und verfolgen</h2>
          <p>Sprache oder Tippmodus, Vorabfreigabe, Mail an Patienten und spaetere Nachverfolgung.</p>
        </article>
        <article className="hub-card">
          <span className="eyebrow">Apotheke</span>
          <h2>Vorabfreigaben sicher bearbeiten</h2>
          <p>Partnerpraxis verbinden, Doppelausgabe vermeiden und Monatsabo transparent verwalten.</p>
        </article>
        <article className="hub-card">
          <span className="eyebrow">Integration</span>
          <h2>PMS zuerst, API als Fallback</h2>
          <p>Klinische Daten bleiben lokal. SWEX sieht nur pseudonymisierte Support- und Betriebsdaten.</p>
        </article>
      </section>
    </main>
  );
}
