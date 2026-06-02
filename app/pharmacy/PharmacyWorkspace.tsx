"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  formatPharmacyReleaseStatus,
  formatRequestDistributionStatus,
  formatVerificationStatus,
} from "@/lib/labels";

type PharmacyWorkspaceProps = {
  allowAccountCreation?: boolean;
  practices: Array<{
    id: string;
    name: string;
  }>;
  pharmacies: Array<{
    id: string;
    name: string;
    email: string | null;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
    verificationCode: string;
    plan?: string;
    monthlyPriceCents?: number;
    subscriptionStatus?: string;
    billingEmail?: string | null;
    stripeCustomerRef?: string | null;
    stripeLatestInvoiceRef?: string | null;
    usageSnapshots?: Array<{
      id: string;
      monthStart: string;
      releasedCount: number;
      dispensedCount: number;
      activeConnections: number;
    }>;
    invoices?: Array<{
      id: string;
      monthStart: string;
      amountCents: number;
      status: string;
      lineItemDescription: string;
    }>;
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
  const allowAccountCreation = props.allowAccountCreation ?? true;
  const [pharmacies, setPharmacies] = useState(props.pharmacies);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState(props.pharmacies[0]?.id ?? "");
  const [selectedPracticeId, setSelectedPracticeId] = useState(props.practices[0]?.id ?? "");
  const [verificationCode, setVerificationCode] = useState("");
  const [connectionState, setConnectionState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pharmacyForm, setPharmacyForm] = useState({
    name: "",
    email: "",
    street: "",
    city: "",
    postalCode: "",
    latitude: "",
    longitude: "",
  });
  const [createState, setCreateState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportState, setSupportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [billingState, setBillingState] = useState<"idle" | "loading" | "done" | "error">("idle");

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
      setPharmacyForm({
        name: "",
        email: "",
        street: "",
        city: "",
        postalCode: "",
        latitude: "",
        longitude: "",
      });
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

  async function prepareMonthlyInvoice() {
    setBillingState("loading");

    try {
      const response = await fetch("/api/billing/monthly-run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error("Monatsabrechnung fehlgeschlagen.");
      }

      const payload = await response.json();
      setPharmacies((current) =>
        current.map((pharmacy) =>
          pharmacy.id === selectedPharmacyId
            ? {
                ...pharmacy,
                stripeLatestInvoiceRef: payload.invoice?.stripeInvoiceId ?? pharmacy.stripeLatestInvoiceRef,
                usageSnapshots: payload.usageSnapshot
                  ? [
                      {
                        id: payload.usageSnapshot.id,
                        monthStart: payload.usageSnapshot.monthStart,
                        releasedCount: payload.usageSnapshot.releasedCount,
                        dispensedCount: payload.usageSnapshot.dispensedCount,
                        activeConnections: payload.usageSnapshot.activeConnections,
                      },
                      ...(pharmacy.usageSnapshots ?? []).filter(
                        (snapshot) => snapshot.id !== payload.usageSnapshot.id,
                      ),
                    ].slice(0, 3)
                  : pharmacy.usageSnapshots,
                invoices: payload.invoice
                  ? [
                      {
                        id: payload.invoice.id,
                        monthStart: payload.invoice.monthStart,
                        amountCents: payload.invoice.amountCents,
                        status: payload.invoice.status,
                        lineItemDescription: payload.invoice.lineItemDescription,
                      },
                      ...(pharmacy.invoices ?? []).filter((invoice) => invoice.id !== payload.invoice.id),
                    ].slice(0, 3)
                  : pharmacy.invoices,
              }
            : pharmacy,
        ),
      );
      setBillingState("done");
    } catch {
      setBillingState("error");
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
          <Link href="/logout" className="secondary-link">
            Abmelden
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
              {allowAccountCreation ? (
                <>
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
                  <label className="field">
                    <span>Strasse</span>
                    <input
                      value={pharmacyForm.street}
                      onChange={(event) =>
                        setPharmacyForm((current) => ({
                          ...current,
                          street: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>PLZ</span>
                    <input
                      value={pharmacyForm.postalCode}
                      onChange={(event) =>
                        setPharmacyForm((current) => ({
                          ...current,
                          postalCode: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Ort</span>
                    <input
                      value={pharmacyForm.city}
                      onChange={(event) =>
                        setPharmacyForm((current) => ({
                          ...current,
                          city: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Breitengrad</span>
                    <input
                      value={pharmacyForm.latitude}
                      onChange={(event) =>
                        setPharmacyForm((current) => ({
                          ...current,
                          latitude: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Laengengrad</span>
                    <input
                      value={pharmacyForm.longitude}
                      onChange={(event) =>
                        setPharmacyForm((current) => ({
                          ...current,
                          longitude: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              ) : null}
            </div>
            <div className="action-row">
              {allowAccountCreation ? (
                <>
                  <button type="button" className="secondary-button" onClick={createPharmacyAccount}>
                    {createState === "loading" ? "Legt an..." : "Apotheke anlegen"}
                  </button>
                  {createState === "done" ? <span className="status-text">Apotheke angelegt.</span> : null}
                </>
              ) : null}
              {selectedPharmacy ? (
                <span className="context-chip">
                  Code: {selectedPharmacy.verificationCode}
                  {selectedPharmacy.street || selectedPharmacy.city
                    ? ` · ${[selectedPharmacy.street, selectedPharmacy.city].filter(Boolean).join(", ")}`
                    : ""}
                </span>
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
                      {formatPharmacyReleaseStatus(item.request.pharmacyReleaseStatus)}. Normaler Weg folgt noch:{" "}
                      {item.request.normalFlowPending ? "ja, nicht doppelt ausgeben." : "nein"}.
                    </div>
                    <span>Status: {formatRequestDistributionStatus(item.status)}</span>
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
                    <span>{formatVerificationStatus(connection.verificationStatus)}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Abo / Abrechnung</p>
                <h2>Monatspaket je Apotheke</h2>
              </div>
            </div>
            {selectedPharmacy ? (
              <div className="stack-list">
                <div className="stack-item">
                  <strong>Tarif</strong>
                  <span>{selectedPharmacy.plan ?? "SMALL"}</span>
                  <span>
                    {new Intl.NumberFormat("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    }).format((selectedPharmacy.monthlyPriceCents ?? 9900) / 100)}
                    {" "}pro Monat
                  </span>
                </div>
                <div className="stack-item">
                  <strong>Status</strong>
                  <span>{selectedPharmacy.subscriptionStatus ?? "INACTIVE"}</span>
                  <span>{selectedPharmacy.billingEmail ?? selectedPharmacy.email ?? "keine Billing-E-Mail"}</span>
                </div>
                <div className="stack-item">
                  <strong>Letzte Stripe-Referenz</strong>
                  <span>{selectedPharmacy.stripeLatestInvoiceRef ?? "noch keine vorbereitet"}</span>
                  <span>{selectedPharmacy.stripeCustomerRef ?? "kein Stripe Customer hinterlegt"}</span>
                </div>
                {(selectedPharmacy.usageSnapshots ?? []).map((snapshot) => (
                  <div key={snapshot.id} className="stack-item">
                    <strong>
                      {new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(
                        new Date(snapshot.monthStart),
                      )}
                    </strong>
                    <span>{snapshot.releasedCount} Freigaben</span>
                    <span>{snapshot.dispensedCount} Abgaben</span>
                    <span>{snapshot.activeConnections} aktive Praxispartner</span>
                  </div>
                ))}
                {(selectedPharmacy.invoices ?? []).map((invoice) => (
                  <div key={invoice.id} className="stack-item">
                    <strong>{invoice.status}</strong>
                    <span>
                      {new Intl.NumberFormat("de-DE", {
                        style: "currency",
                        currency: "EUR",
                      }).format(invoice.amountCents / 100)}
                    </span>
                    <span>{invoice.lineItemDescription}</span>
                  </div>
                ))}
                <div className="action-row">
                  <button type="button" className="secondary-button" onClick={prepareMonthlyInvoice}>
                    {billingState === "loading" ? "Bereitet vor..." : "Monatsrechnung vorbereiten"}
                  </button>
                  {billingState === "done" ? <span className="status-text">Monatsrechnung vorbereitet.</span> : null}
                  {billingState === "error" ? (
                    <span className="status-text error">Monatsrechnung konnte nicht vorbereitet werden.</span>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="muted-copy">Keine Apotheke aktiv.</p>
            )}
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
