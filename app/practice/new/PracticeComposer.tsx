"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  formatRecipeFlag,
  formatRecipeFormType,
  formatRequestStatus,
  formatVerificationStatus,
} from "@/lib/labels";

type PracticeComposerProps = {
  practice: {
    id: string;
    name: string;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
    pickupNotificationEmail: string | null;
    pmsType: string;
    pmsSystemLabel: string | null;
    catalogSource: string;
    catalogProviderLabel: string | null;
    catalogApiBaseUrl: string | null;
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

type RecipeFormType = "GKV_MUSTER16" | "GREEN" | "PRIVATE" | "BTM" | "T_REZEPT";

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

const defaultMedication = {
  medicationName: "",
  medicationStrength: "",
  medicationPzn: "",
};

const defaultRecipeFlags = {
  autIdem: false,
  noctu: false,
  accident: false,
  bvg: false,
  coPaymentExempt: false,
  tInLabel: false,
  tOffLabel: false,
  tInfoMaterial: false,
  tSafetyConfirmed: false,
};

export function PracticeComposer(props: PracticeComposerProps) {
  const [inputLanguage, setInputLanguage] = useState("Deutsch");
  const [outputText, setOutputText] = useState("");
  const [dictationSupported, setDictationSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [dictationState, setDictationState] = useState<"idle" | "listening" | "error">("idle");
  const [dictationError, setDictationError] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [recipeFormType, setRecipeFormType] = useState<RecipeFormType>("GKV_MUSTER16");
  const [recipeFlags, setRecipeFlags] = useState(defaultRecipeFlags);
  const [medication, setMedication] = useState(defaultMedication);
  const [medicationDraft, setMedicationDraft] = useState(defaultMedication);
  const [showMedicationPicker, setShowMedicationPicker] = useState(false);
  const [releaseState, setReleaseState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [releasedRequestId, setReleasedRequestId] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportComponent, setSupportComponent] = useState("SUPPORT_UI");
  const [supportState, setSupportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setDictationSupported(Boolean(SpeechRecognitionCtor));
  }, []);

  const lines = outputText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const medicationLine = medication.medicationName
    ? `Medikation: ${medication.medicationName}${medication.medicationStrength ? `, ${medication.medicationStrength}` : ""}${medication.medicationPzn ? `, PZN ${medication.medicationPzn}` : ""}`
    : "Medikation: wird auswaehlbar im Extrafenster gepflegt";

  const activeFormHints =
    recipeFormType === "GKV_MUSTER16"
      ? ["Aut idem", "Noctu", "Unfall", "BVG", "Zuzahlungsbefreit"]
      : recipeFormType === "T_REZEPT"
        ? ["In-Label", "Off-Label", "Informationsmaterial", "Sicherheitsbestaetigung"]
        : recipeFormType === "GREEN"
          ? ["Empfehlungsrezept ohne GKV-Abrechnungskaestchen"]
          : recipeFormType === "PRIVATE"
            ? ["Privatabrechnung, keine GKV-Kaestchen"]
            : ["BtM-Sonderlogik spaeter erweiterbar"];

  const flagSummary = Object.entries(recipeFlags)
    .filter(([, enabled]) => enabled)
    .map(([key]) => formatRecipeFlag(key))
    .join(", ");

  const recipePreview =
    lines.length === 0
      ? "Noch keine Vorschau vorhanden. Der finale Rezepttext wird aus dem Output erstellt."
      : [
          `Formular: ${formatRecipeFormType(recipeFormType)}`,
          lines.slice(0, 3).join(" "),
          medicationLine,
          flagSummary ? `Kennzeichen: ${flagSummary}` : "Kennzeichen: keine Zusatzfelder markiert",
        ].join("\n");

  function updateFlag(flag: keyof typeof defaultRecipeFlags, checked: boolean) {
    setRecipeFlags((current) => ({
      ...current,
      [flag]: checked,
    }));
  }

  function mapSpeechLanguage(language: string) {
    if (language === "Englisch") {
      return "en-US";
    }

    if (language === "Tuerkisch") {
      return "tr-TR";
    }

    return "de-DE";
  }

  function stopDictation() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
    setDictationState("idle");
  }

  function startDictation() {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setDictationState("error");
      setDictationError("Dieses Geraet unterstuetzt keine Browser-Spracherkennung.");
      return;
    }

    finalTranscriptRef.current = outputText.trim();
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = mapSpeechLanguage(inputLanguage);

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? "";

        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          finalChunk += `${transcript} `;
        } else {
          interimChunk += `${transcript} `;
        }
      }

      if (finalChunk.trim()) {
        finalTranscriptRef.current = [finalTranscriptRef.current, finalChunk.trim()].filter(Boolean).join("\n");
      }

      const nextValue = [finalTranscriptRef.current, interimChunk.trim()].filter(Boolean).join("\n");
      setOutputText(nextValue);
    };

    recognition.onerror = (event) => {
      setDictationState("error");
      setDictationError(
        event.error === "not-allowed"
          ? "Mikrofonzugriff wurde blockiert."
          : "Die Spracheingabe konnte nicht gestartet werden.",
      );
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setOutputText(finalTranscriptRef.current);
      setIsRecording(false);
      setDictationState((current) => (current === "error" ? current : "idle"));
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setDictationError("");
    setDictationState("listening");
    setIsRecording(true);
    recognition.start();
  }

  function toggleDictation() {
    if (isRecording) {
      stopDictation();
      return;
    }

    startDictation();
  }

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
          patientEmail,
          inputLanguage,
          outputText,
          transcription: outputText,
          summary: recipePreview,
          recipePreview,
          recipeFormType,
          recipeFormFlags: recipeFlags,
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
      setPatientEmail("");
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
          <Link href="/practice/requests" className="secondary-link">
            Arzt-Nachverfolgung
          </Link>
          <Link href="/practice/setup" className="secondary-link">
            Praxis-Setup
          </Link>
          <Link href="/pharmacy" className="secondary-link">
            Apotheker-Ansicht
          </Link>
          <Link href="/logout" className="secondary-link">
            Abmelden
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
                <span>Rezeptformular</span>
                <select
                  value={recipeFormType}
                  onChange={(event) => setRecipeFormType(event.target.value as RecipeFormType)}
                >
                  <option value="GKV_MUSTER16">Rosa / GKV Muster 16</option>
                  <option value="GREEN">Gruenes Rezept</option>
                  <option value="PRIVATE">Privatrezept</option>
                  <option value="BTM">BtM-Rezept</option>
                  <option value="T_REZEPT">T-Rezept</option>
                </select>
              </label>

              <div className="preview-card">
                <div className="preview-header">
                  <div>
                    <span className="eyebrow">Pflichtfelder nach Formular</span>
                    <h3>Auswahlhilfe</h3>
                  </div>
                </div>
                <pre>{activeFormHints.join(" · ")}</pre>
              </div>

              {recipeFormType === "GKV_MUSTER16" ? (
                <div className="checkbox-grid">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={recipeFlags.autIdem}
                      onChange={(event) => updateFlag("autIdem", event.target.checked)}
                    />
                    <span>Aut idem ausschliessen</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={recipeFlags.noctu}
                      onChange={(event) => updateFlag("noctu", event.target.checked)}
                    />
                    <span>Noctu</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={recipeFlags.accident}
                      onChange={(event) => updateFlag("accident", event.target.checked)}
                    />
                    <span>Unfallkennzeichen</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={recipeFlags.bvg}
                      onChange={(event) => updateFlag("bvg", event.target.checked)}
                    />
                    <span>BVG</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={recipeFlags.coPaymentExempt}
                      onChange={(event) => updateFlag("coPaymentExempt", event.target.checked)}
                    />
                    <span>Zuzahlungsbefreit</span>
                  </label>
                </div>
              ) : null}

              {recipeFormType === "T_REZEPT" ? (
                <div className="checkbox-grid">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={recipeFlags.tInLabel}
                      onChange={(event) => updateFlag("tInLabel", event.target.checked)}
                    />
                    <span>In-Label</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={recipeFlags.tOffLabel}
                      onChange={(event) => updateFlag("tOffLabel", event.target.checked)}
                    />
                    <span>Off-Label</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={recipeFlags.tInfoMaterial}
                      onChange={(event) => updateFlag("tInfoMaterial", event.target.checked)}
                    />
                    <span>Informationsmaterial ausgehaendigt</span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={recipeFlags.tSafetyConfirmed}
                      onChange={(event) => updateFlag("tSafetyConfirmed", event.target.checked)}
                    />
                    <span>Sicherheitsbestimmungen bestaetigt</span>
                  </label>
                </div>
              ) : null}

              <label className="field">
                <span>Eingabe Sprache</span>
                <select value={inputLanguage} onChange={(event) => setInputLanguage(event.target.value)}>
                  <option>Deutsch</option>
                  <option>Englisch</option>
                  <option>Tuerkisch</option>
                </select>
              </label>

              <label className="field">
                <span>Patienten-E-Mail fuer Abholhinweis</span>
                <input
                  type="email"
                  placeholder="kunde@example.de"
                  value={patientEmail}
                  onChange={(event) => setPatientEmail(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Output</span>
                <div className="action-row compact-action-row">
                  <button
                    type="button"
                    className={`secondary-button microphone-button ${isRecording ? "is-recording" : ""}`}
                    onClick={toggleDictation}
                    disabled={!dictationSupported}
                  >
                    {isRecording ? "Aufnahme stoppen" : "Mikrofon starten"}
                  </button>
                  <span className="status-text">
                    {!dictationSupported
                      ? "Browser-Spracherkennung auf diesem Geraet nicht verfuegbar."
                      : dictationState === "listening"
                        ? "Mikrofon aktiv. Das Diktat wird direkt ins Freitextfeld geschrieben."
                        : "Mikrofon aus. Sie koennen weiter frei tippen oder ein neues Diktat starten."}
                  </span>
                </div>
                <textarea
                  rows={7}
                  placeholder="Hier kommt der Rezepttext oder die zusammengefasste Ausgabe hinein."
                  value={outputText}
                  onChange={(event) => setOutputText(event.target.value)}
                />
                {dictationState === "error" ? (
                  <span className="status-text error">{dictationError}</span>
                ) : null}
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
                  {patientEmail
                    ? ` Fuer den Kunden wird zusaetzlich eine Abhol-E-Mail nach Entfernung sortiert vorbereitet${
                        props.practice.pickupNotificationEmail
                          ? ` und von ${props.practice.pickupNotificationEmail} versendet`
                          : ""
                      }.`
                    : ""}
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
                  <span>{formatVerificationStatus(pharmacy.verificationStatus)}</span>
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
              <Link href="/practice/requests" className="secondary-link">
                Alle Freigaben
              </Link>
            </div>
            <div className="stack-list">
              {props.recentRequests.length === 0 ? (
                <p className="muted-copy">Noch keine Freigaben vorhanden.</p>
              ) : (
                props.recentRequests.map((request) => (
                  <Link key={request.id} href={`/practice/requests/${request.id}`} className="stack-item link-card">
                    <strong>{request.summary ?? "Rezept ohne Zusammenfassung"}</strong>
                    <span>{formatRequestStatus(request.status)}</span>
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
