"use client";

import Link from "next/link";
import { useState } from "react";

type PracticeComposerProps = {
  practice: {
    id: string;
    name: string;
    pmsType: string;
    pmsSystemLabel: string | null;
    catalogSource: string;
    swexTenantRef: string | null;
    stripeCustomerRef: string | null;
  };
  activeDoctor: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  pharmacies: Array<{
    id: string;
    pharmacyId: string;
    pharmacyName: string;
    verificationCode: string;
    verificationStatus: string;
    connectedAt: string | null;
  }>;
  recentRequests: Array<{
    id: string;
    summary: string | null;
    status: string;
    createdAt: string;
    pharmacies: string[];
  }>;
  catalog: {
    source: string;
    description: string;
  };
  revenue: {
    connected: boolean;
    customerRef: string;
    subscriptionRef: string;
    visibility: string;
  };
  supportCount: number;
};

const defaultMedication = {
  medicationName: "",
  medicationStrength: "",
  medicationPzn: "",
};

export function PracticeComposer(props: PracticeComposerProps) {
  const [inputLanguage, setInputLanguage] = useState("Deutsch");
  const [outputText, setOutputText] = useState("");
  const [medication, setMedication] = useState(defaultMedication);
  const [medicationDraft, setMedicationDraft] = useState(defaultMedication);
  const [showMedicationPicker, setShowMedicationPicker] = useState(false);
  const [releaseState, setReleaseState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [releasedRequestId, setReleasedRequestId] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportComponent, setSupportComponent] = useState("SUPPORT_UI");
  const [supportState, setSupportState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const lines = outputText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const medicationLine = medication.medicationName
    ? `Medikation: ${medication.medicationName}${medication.medicationStrength ? `, ${medication.medicationStrength}` : ""}${medication.medicationPzn ? `, PZN ${medication.medicationPzn}` : ""}`
    : "Medikation: wird auswaehlbar im Extrafenster gepflegt";
  const recipePreview =
    lines.length === 0
      ? "Noch keine Vorschau vorhanden. Der finale Rezepttext wird aus dem Output erstellt."
      : [lines.slice(0, 3).join(" "), medicationLine].join("\n");

  async function releasePrescription() {
    setReleaseState("loading");

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          practiceId: props.practice.id,
          releasedByDoctorId: props.activeDoctor?.id ?? null,
          doctorName: props.activeDoctor?.name ?? props.practice.name,
          inputLanguage,
          outputText,
          transcription: outputText,
          summary: recipePreview,
          recipePreview,
          medicationSource:
            props.practice.catalogSource === "PMS_CATALOG" ? "PMS_CATALOG" : "EXTERNAL_API",
          ...medication,
        }),
      });

      if (!response.ok) {
        throw new Error("Rezeptfreigabe fehlgeschlagen.");
      }

      const payload = await response.json();
      setReleasedRequestId(payload.id);
      setReleaseState("done");
      setOutputText("");
    } catch {
      setReleaseState("error");
    }
  }

  async function submitSupportTicket() {
    if (!supportMessage.trim()) {
      return;
    }

    setSupportState("loading");

    try {
      const response = await fetch("/api/support-tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "practice",
          practiceId: props.practice.id,
          component: supportComponent,
          message: supportMessage,
          createdFrom: "practice_composer",
        }),
      });

      if (!response.ok) {
        throw new Error("Supportticket konnte nicht angelegt werden.");
      }

      setSupportState("done");
      setSupportMessage("");
    } catch {
      setSupportState("error");
    }
  }

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Praxis-Layer</p>
          <h1>{props.practice.name}</h1>
          <p className="hero-copy">
            PMS-Daten bleiben in der Clinical Zone. SWEX sieht nur pseudonymisierte Betriebs- und
            Supportreferenzen.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/practice/setup" className="secondary-link">
            Praxis-Setup
          </Link>
          <Link href="/pharmacy" className="secondary-link">
            Apotheker-Ansicht
          </Link>
        </div>
      </section>

      <section className="integration-grid">
        <article className="integration-card">
          <h2>PMS</h2>
          <p>{props.practice.pmsSystemLabel ?? "Kein PMS hinterlegt"}</p>
          <span>{props.practice.pmsType}</span>
        </article>
        <article className="integration-card">
          <h2>Katalog</h2>
          <p>{props.catalog.source}</p>
          <span>{props.catalog.description}</span>
        </article>
        <article className="integration-card">
          <h2>Stripe / SWEX</h2>
          <p>{props.revenue.customerRef}</p>
          <span>{props.revenue.visibility}</span>
        </article>
      </section>

      <section className="composer-layout">
        <div className="composer-main">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Freigabe</p>
                <h2>Rezept vorbereiten</h2>
              </div>
              <div className="context-chip">
                {props.activeDoctor?.name ?? "Praxisnutzer"} · {props.pharmacies.length} verbundene
                Apotheke{props.pharmacies.length === 1 ? "" : "n"}
              </div>
            </div>

            <div className="field-grid single-column">
              <label className="field">
                <span>Eingabe Sprache</span>
                <select value={inputLanguage} onChange={(event) => setInputLanguage(event.target.value)}>
                  <option>Deutsch</option>
                  <option>Englisch</option>
                  <option>Tuerkisch</option>
                </select>
              </label>

              <label className="field">
                <span>Output</span>
                <textarea
                  rows={7}
                  placeholder="Hier kommt der Rezepttext oder die zusammengefasste Ausgabe hinein."
                  value={outputText}
                  onChange={(event) => setOutputText(event.target.value)}
                />
              </label>

              <div className="preview-card">
                <div className="preview-header">
                  <div>
                    <span className="eyebrow">Rezept als Vorschau</span>
                    <h3>Freigabevorschau</h3>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setMedicationDraft(medication);
                      setShowMedicationPicker(true);
                    }}
                  >
                    Medikament auswaehlen
                  </button>
                </div>
                <pre>{recipePreview}</pre>
                <div className="release-banner">
                  Die verbundene Apotheke sieht sofort, dass dieses Rezept bereits freigegeben ist.
                  Der normale Weg bleibt bis zur bestaetigten Abgabe als offen markiert.
                </div>
              </div>
            </div>

            <div className="action-row">
              <button
                type="button"
                className="primary-button"
                onClick={releasePrescription}
                disabled={releaseState === "loading" || !outputText.trim()}
              >
                {releaseState === "loading" ? "Freigabe laeuft..." : "Freigeben"}
              </button>
              {releaseState === "done" && releasedRequestId ? (
                <Link href={`/practice/requests/${releasedRequestId}`} className="secondary-link">
                  Freigabe oeffnen
                </Link>
              ) : null}
              {releaseState === "error" ? (
                <span className="status-text error">Die Freigabe konnte nicht gespeichert werden.</span>
              ) : null}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">KI-Support</p>
                <h2>Was geht nicht?</h2>
              </div>
              <span className="context-chip">{props.supportCount} letzte Tickets</span>
            </div>
            <div className="field-grid single-column">
              <label className="field">
                <span>Betroffene Komponente</span>
                <select
                  value={supportComponent}
                  onChange={(event) => setSupportComponent(event.target.value)}
                >
                  <option value="SUPPORT_UI">Support UI</option>
                  <option value="PMS_CONNECTOR">PMS Connector</option>
                  <option value="CATALOG_API">Katalog</option>
                  <option value="PHARMACY_CONNECTION">Apothekenverbindung</option>
                  <option value="STRIPE_SYNC">Stripe / Umsatz</option>
                  <option value="RELEASE_FLOW">Freigabefluss</option>
                </select>
              </label>
              <label className="field">
                <span>Stoerung beschreiben</span>
                <textarea
                  rows={4}
                  placeholder="Kurz beschreiben, was im Praxis- oder Freigabeprozess nicht funktioniert."
                  value={supportMessage}
                  onChange={(event) => setSupportMessage(event.target.value)}
                />
              </label>
            </div>
            <p className="privacy-note">
              An SWEX gehen nur pseudonymisierte Referenzen, Komponente, Prioritaet und
              Fehlersignatur. Arzt-, Patienten- und PMS-Klartextdaten bleiben lokal.
            </p>
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={submitSupportTicket}
                disabled={supportState === "loading" || !supportMessage.trim()}
              >
                {supportState === "loading" ? "Ticket wird erstellt..." : "Ticket an SWEX senden"}
              </button>
              {supportState === "done" ? <span className="status-text">Ticket erzeugt.</span> : null}
              {supportState === "error" ? (
                <span className="status-text error">Ticket konnte nicht angelegt werden.</span>
              ) : null}
            </div>
          </article>
        </div>

        <aside className="composer-sidebar">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Verbundene Apotheken</p>
                <h2>Empfaengerkreis</h2>
              </div>
            </div>
            <div className="stack-list">
              {props.pharmacies.map((pharmacy) => (
                <div key={pharmacy.id} className="stack-item">
                  <strong>{pharmacy.pharmacyName}</strong>
                  <span>{pharmacy.verificationStatus}</span>
                  <span>Code: {pharmacy.verificationCode}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Verlauf</p>
                <h2>Letzte Freigaben</h2>
              </div>
            </div>
            <div className="stack-list">
              {props.recentRequests.length === 0 ? (
                <p className="muted-copy">Noch keine Freigaben vorhanden.</p>
              ) : (
                props.recentRequests.map((request) => (
                  <Link key={request.id} href={`/practice/requests/${request.id}`} className="stack-item link-card">
                    <strong>{request.summary ?? "Rezept ohne Zusammenfassung"}</strong>
                    <span>{request.status}</span>
                    <span>{request.pharmacies.join(", ") || "Noch keine Apotheke erreicht"}</span>
                  </Link>
                ))
              )}
            </div>
          </article>
        </aside>
      </section>

      {showMedicationPicker ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Medikament auswaehlen">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Extrafenster</p>
                <h2>Medikament auswaehlen</h2>
              </div>
            </div>
            <div className="field-grid single-column">
              <label className="field">
                <span>Medikament</span>
                <input
                  value={medicationDraft.medicationName}
                  onChange={(event) =>
                    setMedicationDraft((current) => ({
                      ...current,
                      medicationName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Staerke / Form</span>
                <input
                  value={medicationDraft.medicationStrength}
                  onChange={(event) =>
                    setMedicationDraft((current) => ({
                      ...current,
                      medicationStrength: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>PZN</span>
                <input
                  value={medicationDraft.medicationPzn}
                  onChange={(event) =>
                    setMedicationDraft((current) => ({
                      ...current,
                      medicationPzn: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowMedicationPicker(false)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setMedication(medicationDraft);
                  setShowMedicationPicker(false);
                }}
              >
                Uebernehmen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
