import Link from "next/link";

import { ensurePracticeContext } from "@/lib/bootstrap";
import { getPracticeAccessState } from "@/lib/practice-access";

export const dynamic = "force-dynamic";

function formatDate(value?: Date | null) {
  if (!value) {
    return "nicht gesetzt";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
  }).format(value);
}

export default async function BillingExpiredPage() {
  const practice = await ensurePracticeContext();
  const access = getPracticeAccessState(practice);

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Billing</p>
          <h1>Kostenlose Nutzung abgelaufen</h1>
          <p className="hero-copy">
            {access.reason} Sobald die Aktivierung bestaetigt ist, kann die Praxis wieder freigeben
            und die eigene Render-Instanz fuer diesen Kunden vorbereitet werden.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/practice/setup" className="secondary-link">
            Zurueck ins Setup
          </Link>
          {practice.stripeCheckoutUrl ? (
            <a href={practice.stripeCheckoutUrl} className="primary-button">
              Zu Stripe
            </a>
          ) : null}
        </div>
      </section>

      <section className="composer-layout single-stack">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Trial-Fenster</p>
              <h2>Freigabezeitraum und Aktivierung</h2>
            </div>
          </div>
          <div className="stack-list">
            <div className="stack-item">
              <strong>Praxis</strong>
              <span>{practice.name}</span>
            </div>
            <div className="stack-item">
              <strong>Kostenlose Nutzung von</strong>
              <span>{formatDate(practice.trialStartsAt)}</span>
            </div>
            <div className="stack-item">
              <strong>Kostenlose Nutzung bis</strong>
              <span>{formatDate(practice.trialEndsAt)}</span>
            </div>
            <div className="stack-item">
              <strong>Stripe Checkout</strong>
              <span>{practice.stripeCheckoutUrl ?? "Noch keine Checkout-URL hinterlegt."}</span>
            </div>
            <div className="stack-item">
              <strong>Eigene Render-Instanz</strong>
              <span>
                {practice.copyToOwnRenderOnActivation
                  ? `${practice.renderWorkspaceSlug ?? "Workspace offen"} / ${practice.renderServiceName ?? "Service offen"}`
                  : "Nicht fuer Einzelinstanz markiert"}
              </span>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
