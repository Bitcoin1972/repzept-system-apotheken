"use client";

import Link from "next/link";
import { useState } from "react";

type PracticeSetupWorkspaceProps = {
  practice: {
    id: string;
    name: string;
    pmsType: string;
    pmsSystemLabel: string | null;
    pmsApiBaseUrl: string | null;
    catalogSource: string;
    stripeCustomerRef: string | null;
    stripeSubscriptionRef: string | null;
    swexTenantRef: string | null;
  };
  doctors: Array<{
    id: string;
    name: string;
    email: string | null;
  }>;
  pharmacies: Array<{
    id: string;
    name: string;
    verificationStatus: string;
    verificationCode: string;
  }>;
};

export function PracticeSetupWorkspace(props: PracticeSetupWorkspaceProps) {
  const [formState, setFormState] = useState({
    name: props.practice.name,
    pmsType: props.practice.pmsType,
    pmsSystemLabel: props.practice.pmsSystemLabel ?? "",
    pmsApiBaseUrl: props.practice.pmsApiBaseUrl ?? "",
    pmsApiKey: "",
    catalogSource: props.practice.catalogSource,
    stripeCustomerRef: props.practice.stripeCustomerRef ?? "",
    stripeSubscriptionRef: props.practice.stripeSubscriptionRef ?? "",
    swexTenantRef: props.practice.swexTenantRef ?? "",
    doctorName: "",
    doctorEmail: "",
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function savePracticeSetup() {
    setSaveState("saving");

    try {
      const response = await fetch("/api/practice/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          practiceId: props.practice.id,
          ...formState,
        }),
      });

      if (!response.ok) {
        throw new Error("Setup konnte nicht gespeichert werden.");
      }

      setFormState((current) => ({
        ...current,
        doctorName: "",
        doctorEmail: "",
        pmsApiKey: "",
      }));
      setSaveState("done");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Praxis-Setup-Agent</p>
          <h1>Praxis und PMS anbinden</h1>
          <p className="hero-copy">
            Eine Praxis ist der Mandant. Das PMS haengt an der Praxis und liefert Daten nur fuer den
            Rezeptfluss in dieser App.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/practice/new" className="secondary-link">
            Zur Freigabe
          </Link>
          <Link href="/pharmacy" className="secondary-link">
            Apotheker-Ansicht
          </Link>
        </div>
      </section>

      <section className="composer-layout single-stack">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Schritt 1 bis 4</p>
              <h2>Praxisdaten, PMS, Katalog und Billing</h2>
            </div>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Praxisname</span>
              <input
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>PMS-Typ</span>
              <select
                value={formState.pmsType}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    pmsType: event.target.value,
                  }))
                }
              >
                <option value="GENERIC_PMS">Generic PMS</option>
                <option value="INTERNAL_CATALOG_API">PMS mit Katalog-API</option>
                <option value="EXTERNAL_E_PRESCRIPTION">Externe eRezept-Schnittstelle</option>
              </select>
            </label>
            <label className="field">
              <span>PMS-Bezeichnung</span>
              <input
                value={formState.pmsSystemLabel}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    pmsSystemLabel: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>PMS API URL</span>
              <input
                value={formState.pmsApiBaseUrl}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    pmsApiBaseUrl: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>PMS API Key</span>
              <input
                value={formState.pmsApiKey}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    pmsApiKey: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Katalogquelle</span>
              <select
                value={formState.catalogSource}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    catalogSource: event.target.value,
                  }))
                }
              >
                <option value="PMS_CATALOG">PMS-intern</option>
                <option value="EXTERNAL_API">Externe Arzneimittel-API</option>
              </select>
            </label>
            <label className="field">
              <span>Stripe Customer Ref</span>
              <input
                value={formState.stripeCustomerRef}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    stripeCustomerRef: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Stripe Subscription Ref</span>
              <input
                value={formState.stripeSubscriptionRef}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    stripeSubscriptionRef: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>SWEX Tenant Ref</span>
              <input
                value={formState.swexTenantRef}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    swexTenantRef: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="action-row">
            <button type="button" className="primary-button" onClick={savePracticeSetup}>
              {saveState === "saving" ? "Speichert..." : "Setup speichern"}
            </button>
            {saveState === "done" ? <span className="status-text">Setup gespeichert.</span> : null}
            {saveState === "error" ? (
              <span className="status-text error">Setup konnte nicht gespeichert werden.</span>
            ) : null}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Schritt 5</p>
              <h2>Aerzte zur Praxis hinzufuegen</h2>
            </div>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Name</span>
              <input
                value={formState.doctorName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    doctorName: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>E-Mail</span>
              <input
                value={formState.doctorEmail}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    doctorEmail: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="stack-list">
            {props.doctors.map((doctor) => (
              <div key={doctor.id} className="stack-item">
                <strong>{doctor.name}</strong>
                <span>{doctor.email ?? "ohne E-Mail"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Datenschutzgrenze</p>
              <h2>Clinical Zone gegen SWEX Zone</h2>
            </div>
          </div>
          <div className="privacy-grid">
            <div className="privacy-card">
              <strong>Clinical Zone</strong>
              <p>PMS-Kontext, Rezeptdaten, Arztbezug und Apothekenzuordnung bleiben nur in dieser App.</p>
            </div>
            <div className="privacy-card">
              <strong>SWEX Zone</strong>
              <p>Nur pseudonymisierte Tenant-Referenzen, Ticketmetadaten und Billing-Referenzen.</p>
            </div>
          </div>
          <div className="stack-list">
            {props.pharmacies.map((pharmacy) => (
              <div key={pharmacy.id} className="stack-item">
                <strong>{pharmacy.name}</strong>
                <span>{pharmacy.verificationStatus}</span>
                <span>Apotheken-Code: {pharmacy.verificationCode}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
