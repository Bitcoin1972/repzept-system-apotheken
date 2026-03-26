import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="hero-kicker">Praxis Copilot</p>
        <h1 className="hero-title">Copilot-Eingabe mit Rezeptmodus fuer Rezeptdiktate</h1>
        <p className="hero-copy">
          Diese Minimal-App deckt den fokussierten Monolith-Flow fuer Rezeptdiktate ab:
          Diktat erfassen, Entwurf pruefen, optional praezisieren und Antworten direkt sehen.
        </p>
        <Link className="primary-button" href="/practice/new">
          Zum Copilot
        </Link>
      </section>
    </main>
  );
}
