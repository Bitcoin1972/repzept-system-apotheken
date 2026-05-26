"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PharmacyWorkspaceProps = {
  practices: Array<{
    id: string;
    name: string;
  }>;
  pharmacies: Array<{
    id: string;
    name: string;
    email: string | null;
    verificationCode: string;
    practiceConnections: Array<{
      id: string;
      practiceId: string;
      practiceName: string;
      verificationStatus: string;
    }>;
  }>;
};

type InboxItem = {
  id: string;
  status: string;
  releasedAt: string;
  request: {
    id: string;
    summary: string | null;
    outputText: string | null;
    pharmacyReleaseStatus: string;
    normalFlowPending: boolean;
    medicationName: string | null;
    medicationStrength: string | null;
    medicationPzn: string | null;
    releasedByDoctor: {
      name: string;
    } | null;
    practice: {
      name: string;
    } | null;
  };
};

export function PharmacyWorkspace(props: PharmacyWorkspaceProps) {
  const [pharmacies, setPharmacies] = useState(props.pharmacies);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState(props.pharmacies[0]?.id ?? "");
  const [selectedPracticeId, setSelectedPracticeId] = useState(props.practices[0]?.id ?? "");
  const [verificationCode, setVerificationCode] = useState("");
  const [connectionState, setConnectionState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pharmacyForm, setPharmacyForm] = useState({ name: "", email: "" });
  const [createState, setCreateState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportState, setSupportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [inbox, setInbox] = useState<InboxItem[]>([]);

  async function loadInbox(pharmacyId: string) {
    if (!pharmacyId) {
      setInbox([]);
      return;
    }

    const response = await fetch(`/api/pharmacy/inbox?pharmacyId=${pharmacyId}`);
    if (!response.ok) {
      setInbox([]);
      return;
    }

    const payload = (await response.json()) as InboxItem[];
    setInbox(payload);
  }

  useEffect(() => {
    void loadInbox(selectedPharmacyId);
  }, [selectedPharmacyId]);

  async function createPharmacyAccount() {
    if (!pharmacyForm.name.trim()) {
      return;
    }

    setCreateState("loading");

    try {
      const response = await fetch("/api/pharmacy/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pharmacyForm),
      });

      if (!response.ok) {
        throw new Error("Apotheke konnte nicht angelegt werden.");
      }

      const createdPharmacy = await response.json();
      setPharmacies((current) => [...current, createdPharmacy]);
      setSelectedPharmacyId(createdPharmacy.id);
      setCreateState("done");
      setPharmacyForm({ name: "", email: "" });
    } catch {
      setCreateState("error");
    }
  }

  async function connectPractice() {
    if (!selectedPharmacyId || !selectedPracticeId || !verificationCode.trim()) {
      return;
    }

    setConnectionState("loading");

    try {
      const response = await fetch("/api/pharmacy/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          practiceId: selectedPracticeId,
          pharmacyId: selectedPharmacyId,
          verificationCode,
        }),
      });

      if (!response.ok) {
        throw new Error("Verbindung fehlgeschlagen.");
      }

      const payload = await response.json();
      setPharmacies((current) =>
        current.map((pharmacy) =>
          pharmacy.id === selectedPharmacyId
            ? {
                ...pharmacy,
                practiceConnections: [
                  ...pharmacy.practiceConnections.filter(
                    (connection) => connection.id !== payload.connection.id,
                  ),
                  {
                    id: payload.connection.id,
                    practiceId: payload.connection.practice.id,
                    practiceName: payload.connection.practice.name,
                    verificationStatus: payload.connection.verificationStatus,
                  },
                ],
              }
            : pharmacy,
        ),
      );
      setConnectionState("done");
      setVerificationCode("");
      await loadInbox(selectedPharmacyId);
    } catch {
      setConnectionState("error");
    }
  }

  async function updateDispenseState(distributionId: string, action: "viewed" | "in_progress" | "dispensed") {
    const response = await fetch("/api/pharmacy/dispense", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        distributionId,
        action,
      }),
    });

    if (response.ok) {
      await loadInbox(selectedPharmacyId);
    }
  }

  async function submitSupportTicket() {
    if (!selectedPharmacyId || !supportMessage.trim()) {
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
          role: "pharmacy",
          pharmacyId: selectedPharmacyId,
          component: "SUPPORT_UI",
          message: supportMessage,
          createdFrom: "pharmacy_workspace",
        }),
      });

      if (!response.ok) {
        throw new Error("Supportticket fehlgeschlagen.");
      }

      setSupportMessage("");
      setSupportState("done");
    } catch {
      setSupportState("error");
    }
  }

  const selectedPharmacy = pharmacies.find((pharmacy) => pharmacy.id === selectedPharmacyId) ?? null;

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Apotheker-Layer</p>
          <h1>Apotheke verbinden und Freigaben bearbeiten</h1>
          <p className="hero-copy">
            Die Apotheke bekommt sofort die Vorabfreigabe, sieht den Normalweg als offen und kann
            eine Doppelausgabe aktiv vermeiden.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/practice/new" className="secondary-link">
            Praxis-Freigabe
          </Link>
          <Link href="/practice/setup" className="secondary-link">
            Praxis-Setup
          </Link>
        </div>
      </section>

      <section className="composer-layout">
        <div className="composer-main">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Login / Stammdaten</p>
                <h2>Apotheke waehlen oder anlegen</h2>
              </div>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>Aktive Apotheke</span>
                <select
                  value={selectedPharmacyId}
                  onChange={(event) => setSelectedPharmacyId(event.target.value)}
                >
                  {pharmacies.map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Neue Apotheke</span>
                <input
                  value={pharmacyForm.name}
                  onChange={(event) =>
                    setPharmacyForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Name der Apotheke"
                />
              </label>
              <label className="field">
                <span>E-Mail</span>
                <input
                  value={pharmacyForm.email}
                  onChange={(event) =>
                    setPharmacyForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="action-row">
              <button type="button" className="secondary-button" onClick={createPharmacyAccount}>
                {createState === "loading" ? "Legt an..." : "Apotheke anlegen"}
              </button>
              {createState === "done" ? <span className="status-text">Apotheke angelegt.</span> : null}
              {selectedPharmacy ? (
                <span className="context-chip">Code: {selectedPharmacy.verificationCode}</span>
              ) : null}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Arzt verbinden</p>
                <h2>Praxis per Identifikationscode koppeln</h2>
              </div>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>Praxis</span>
                <select
                  value={selectedPracticeId}
                  onChange={(event) => setSelectedPracticeId(event.target.value)}
                >
                  {props.practices.map((practice) => (
                    <option key={practice.id} value={practice.id}>
                      {practice.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Apotheken-Identifikationscode</span>
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="APO-...."
                />
              </label>
            </div>
            <div className="action-row">
              <button type="button" className="primary-button" onClick={connectPractice}>
                {connectionState === "loading" ? "Prueft..." : "Direkt verbinden"}
              </button>
              {connectionState === "done" ? (
                <span className="status-text">Verbindung automatisch bestaetigt.</span>
              ) : null}
              {connectionState === "error" ? (
                <span className="status-text error">Verbindung konnte nicht hergestellt werden.</span>
              ) : null}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Freigabe-Eingang</p>
                <h2>Bereits freigegebene Rezepte</h2>
              </div>
            </div>
            <div className="stack-list">
              {inbox.length === 0 ? (
                <p className="muted-copy">Noch keine Freigaben fuer diese Apotheke vorhanden.</p>
              ) : (
                inbox.map((item) => (
                  <div key={item.id} className="stack-item inbox-card">
                    <strong>{item.request.summary ?? "Rezept ohne Zusammenfassung"}</strong>
                    <span>
                      {item.request.practice?.name ?? "Praxis"} · {item.request.releasedByDoctor?.name ?? "Arzt"}
                    </span>
                    <span>
                      {item.request.medicationName ?? "Medikament folgt"}{" "}
                      {item.request.medicationStrength ? `· ${item.request.medicationStrength}` : ""}
                      {item.request.medicationPzn ? ` · PZN ${item.request.medicationPzn}` : ""}
                    </span>
                    <div className="release-banner warning">
                      Bereits freigegeben. Normaler Weg folgt noch:{" "}
                      {item.request.normalFlowPending ? "ja, nicht doppelt ausgeben." : "nein"}.
                    </div>
                    <div className="action-row">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => updateDispenseState(item.id, "viewed")}
                      >
                        Gesehen
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => updateDispenseState(item.id, "in_progress")}
                      >
                        In Bearbeitung
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => updateDispenseState(item.id, "dispensed")}
                      >
                        Abgabe bestaetigen
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <aside className="composer-sidebar">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Verbindungen</p>
                <h2>Praxispartner</h2>
              </div>
            </div>
            <div className="stack-list">
              {!selectedPharmacy || selectedPharmacy.practiceConnections.length === 0 ? (
                <p className="muted-copy">Keine Verbindungen vorhanden.</p>
              ) : (
                selectedPharmacy.practiceConnections.map((connection) => (
                  <div key={connection.id} className="stack-item">
                    <strong>{connection.practiceName}</strong>
                    <span>{connection.verificationStatus}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">KI-Support</p>
                <h2>Stoerung an SWEX</h2>
              </div>
            </div>
            <label className="field">
              <span>Was geht nicht?</span>
              <textarea
                rows={5}
                value={supportMessage}
                onChange={(event) => setSupportMessage(event.target.value)}
                placeholder="Fehler aus der Apotheke beschreiben. Personenbezogene Klartexte muessen nicht mitgeschickt werden."
              />
            </label>
            <p className="privacy-note">
              SWEX bekommt nur pseudonymisierte Tenant- und Verbindungsreferenzen, keine Patienten-
              oder Rezeptklartexte.
            </p>
            <div className="action-row">
              <button type="button" className="secondary-button" onClick={submitSupportTicket}>
                {supportState === "loading" ? "Sendet..." : "Ticket an SWEX"}
              </button>
              {supportState === "done" ? <span className="status-text">Ticket erzeugt.</span> : null}
              {supportState === "error" ? (
                <span className="status-text error">Ticket konnte nicht erzeugt werden.</span>
              ) : null}
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
