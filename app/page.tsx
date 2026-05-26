import Link from "next/link";

export default function HomePage() {
  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Repzept Plattform</p>
          <h1>Praxis, Apotheke, SWEX und Support in einem Flow</h1>
          <p className="hero-copy">
            Die Clinical Zone bleibt lokal fuer Rezept- und PMS-Daten. SWEX sieht nur
            pseudonymisierte Betriebs-, Ticket- und Billingreferenzen.
          </p>
        </div>
      </section>

      <section className="hub-grid">
        <Link href="/practice/new" className="hub-card">
          <span className="eyebrow">Praxis</span>
          <h2>Rezept freigeben</h2>
          <p>Minimaler Arzt-Flow mit Eingabesprache, Output, Vorschau und Vorabfreigabe an Apotheken.</p>
        </Link>
        <Link href="/practice/setup" className="hub-card">
          <span className="eyebrow">Setup</span>
          <h2>PMS und Billing anbinden</h2>
          <p>Praxis als Mandant konfigurieren, Aerzte pflegen und Katalog-/Stripe-/SWEX-Referenzen setzen.</p>
        </Link>
        <Link href="/pharmacy" className="hub-card">
          <span className="eyebrow">Apotheke</span>
          <h2>Freigaben empfangen</h2>
          <p>Praxis verbinden, Vorabfreigaben sehen, Doppelausgabe vermeiden und Support an SWEX geben.</p>
        </Link>
      </section>
    </main>
  );
}
