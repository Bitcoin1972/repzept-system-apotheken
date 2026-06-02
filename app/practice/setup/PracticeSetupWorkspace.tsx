"use client";

import Link from "next/link";
import { useState } from "react";

import { formatVerificationStatus } from "@/lib/labels";

type PracticeSetupWorkspaceProps = {
  practice: {
    id: string;
    name: string;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
    pickupNotificationEmail: string | null;
    trialStartsAt: string | null;
    trialEndsAt: string | null;
    pmsType: string;
    pmsSystemLabel: string | null;
    pmsApiBaseUrl: string | null;
    catalogSource: string;
    catalogProviderLabel: string | null;
    catalogApiBaseUrl: string | null;
    stripeCustomerRef: string | null;
    stripeSubscriptionRef: string | null;
    stripeCheckoutUrl: string | null;
    swexTenantRef: string | null;
    renderWorkspaceSlug: string | null;
    renderServiceName: string | null;
    copyToOwnRenderOnActivation: boolean;
  };
  doctors: Array<{
    id: string;
    name: string;
    email: string | null;
  }>;
  pharmacies: Array<{
    id: string;
    name: string;
    street: string | null;
    city: string | null;
    verificationStatus: string;
    verificationCode: string;
  }>;
};

export function PracticeSetupWorkspace(props: PracticeSetupWorkspaceProps) {
  function formatDateInput(value: string | null) {
    return value ? value.slice(0, 10) : "";
  }

  const [formState, setFormState] = useState({
    name: props.practice.name,
    street: props.practice.street ?? "",
    city: props.practice.city ?? "",
    postalCode: props.practice.postalCode ?? "",
    latitude: props.practice.latitude?.toString() ?? "",
    longitude: props.practice.longitude?.toString() ?? "",
    pickupNotificationEmail: props.practice.pickupNotificationEmail ?? "",
    trialStartsAt: formatDateInput(props.practice.trialStartsAt),
    trialEndsAt: formatDateInput(props.practice.trialEndsAt),
    pmsType: props.practice.pmsType,
    pmsSystemLabel: props.practice.pmsSystemLabel ?? "",
    pmsApiBaseUrl: props.practice.pmsApiBaseUrl ?? "",
    pmsApiKey: "",
    catalogSource: props.practice.catalogSource,
    catalogProviderLabel: props.practice.catalogProviderLabel ?? "",
    catalogApiBaseUrl: props.practice.catalogApiBaseUrl ?? "",
    catalogApiKey: "",
    stripeCustomerRef: props.practice.stripeCustomerRef ?? "",
    stripeSubscriptionRef: props.practice.stripeSubscriptionRef ?? "",
    stripeCheckoutUrl: props.practice.stripeCheckoutUrl ?? "",
    swexTenantRef: props.practice.swexTenantRef ?? "",
    renderWorkspaceSlug: props.practice.renderWorkspaceSlug ?? "",
    renderServiceName: props.practice.renderServiceName ?? "",
    copyToOwnRenderOnActivation: props.practice.copyToOwnRenderOnActivation,
    doctorName: "",
    doctorEmail: "",
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const usesExternalCatalog = formState.catalogSource === "EXTERNAL_API";

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
        catalogApiKey: "",
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
              <p className="eyebrow">Einrichtung beim Kunden</p>
              <h2>Diese Daten brauchen wir vor Ort</h2>
            </div>
          </div>
          <div className="privacy-grid">
            <div className="privacy-card">
              <strong>1. Praxis und Patienten-Mail</strong>
              <p>Praxisname, Adresse, Standort, Praxis-E-Mail fuer Abholhinweise und eine Test-Patientenadresse.</p>
            </div>
            <div className="privacy-card">
              <strong>2. PMS und Katalog</strong>
              <p>PMS-Typ, PMS-URL, API-Key und bei externer Arzneimittelquelle zusaetzlich Anbieter, URL und API-Key.</p>
            </div>
            <div className="privacy-card">
              <strong>3. Billing und Render</strong>
              <p>Stripe Checkout URL, Testphase von/bis und die Render-Zielumgebung des Kunden fuer die spaetere Einzelinstanz.</p>
            </div>
          </div>
        </article>

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
              <span>Strasse</span>
              <input
                value={formState.street}
                onChange={(event) => setFormState((current) => ({ ...current, street: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>PLZ</span>
              <input
                value={formState.postalCode}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, postalCode: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Ort</span>
              <input
                value={formState.city}
                onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Breitengrad</span>
              <input
                value={formState.latitude}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, latitude: event.target.value }))
                }
                placeholder="z.B. 53.5506"
              />
            </label>
            <label className="field">
              <span>Laengengrad</span>
              <input
                value={formState.longitude}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, longitude: event.target.value }))
                }
                placeholder="z.B. 10.0016"
              />
            </label>
            <label className="field">
              <span>Praxis E-Mail fuer Abholhinweise</span>
              <input
                type="email"
                value={formState.pickupNotificationEmail}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    pickupNotificationEmail: event.target.value,
                  }))
                }
                placeholder="abholung@praxis.de"
              />
            </label>
            <label className="field">
              <span>Kostenlose Nutzung von</span>
              <input
                type="date"
                value={formState.trialStartsAt}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    trialStartsAt: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Kostenlose Nutzung bis</span>
              <input
                type="date"
                value={formState.trialEndsAt}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    trialEndsAt: event.target.value,
                  }))
                }
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
            {usesExternalCatalog ? (
              <>
                <label className="field">
                  <span>Katalog Anbieter</span>
                  <input
                    value={formState.catalogProviderLabel}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        catalogProviderLabel: event.target.value,
                      }))
                    }
                    placeholder="z.B. ABDATA, ifap, eigener Anbieter"
                  />
                </label>
                <label className="field">
                  <span>Katalog API URL</span>
                  <input
                    value={formState.catalogApiBaseUrl}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        catalogApiBaseUrl: event.target.value,
                      }))
                    }
                    placeholder="https://catalog.example/api"
                  />
                </label>
                <label className="field">
                  <span>Katalog API Key</span>
                  <input
                    value={formState.catalogApiKey}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        catalogApiKey: event.target.value,
                      }))
                    }
                  />
                </label>
              </>
            ) : null}
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
              <span>Stripe Checkout URL</span>
              <input
                value={formState.stripeCheckoutUrl}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    stripeCheckoutUrl: event.target.value,
                  }))
                }
                placeholder="https://buy.stripe.com/..."
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
            <label className="field">
              <span>Render Workspace</span>
              <input
                value={formState.renderWorkspaceSlug}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    renderWorkspaceSlug: event.target.value,
                  }))
                }
                placeholder="kunde-workspace"
              />
            </label>
            <label className="field">
              <span>Render Service Name</span>
              <input
                value={formState.renderServiceName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    renderServiceName: event.target.value,
                  }))
                }
                placeholder="repzept-kunde-prod"
              />
            </label>
            <label className="checkbox-row checkbox-row-full">
              <input
                type="checkbox"
                checked={formState.copyToOwnRenderOnActivation}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    copyToOwnRenderOnActivation: event.target.checked,
                  }))
                }
              />
              <div>
                <strong>Eigene Render-Instanz nach Aktivierung vorbereiten</strong>
                <p className="muted-copy">
                  Wenn der Kunde spaeter bezahlt, wird diese Praxis fuer die Uebergabe in die eigene
                  Render-Umgebung markiert, damit die gemeinsame Instanz fuer andere Kunden getrennt bleibt.
                </p>
              </div>
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
                <span>{formatVerificationStatus(pharmacy.verificationStatus)}</span>
                <span>{[pharmacy.street, pharmacy.city].filter(Boolean).join(", ") || "ohne Standort"}</span>
                <span>Apotheken-Code: {pharmacy.verificationCode}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
