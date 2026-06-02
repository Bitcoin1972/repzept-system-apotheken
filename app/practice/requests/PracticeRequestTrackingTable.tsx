"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  formatPharmacyReleaseStatus,
  formatRecipeFormType,
  formatRequestDistributionStatus,
  formatRequestStatus,
} from "@/lib/labels";

type DoctorOption = {
  id: string;
  name: string;
};

type TrackingTableProps = {
  doctors: DoctorOption[];
};

type ApiResponse = {
  items: TrackingItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type TrackingItem = {
  id: string;
  summary: string | null;
  status: string;
  pharmacyReleaseStatus: string;
  normalFlowPending: boolean;
  recipeFormType: string;
  doctorName: string;
  doctorId: string | null;
  patientReference: string | null;
  medicationName: string | null;
  medicationStrength: string | null;
  medicationPzn: string | null;
  signedAt: string | null;
  issuedAt: string | null;
  releasedToPharmacyAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestEvent: {
    type: string;
    note: string | null;
    createdAt: string;
  } | null;
  distributionSummary: {
    total: number;
    latestStatus: string | null;
    pharmacyNames: string[];
    counts: {
      released: number;
      viewed: number;
      inProgress: number;
      dispensed: number;
      blockedDuplicate: number;
    };
  };
};

const requestStatusOptions = [
  { value: "all", label: "Alle Freigaben" },
  { value: "RELEASED", label: "Freigegeben" },
  { value: "DISPENSED", label: "Abgegeben" },
  { value: "COMPLETED", label: "Abgeschlossen" },
];

const releaseStatusOptions = [
  { value: "all", label: "Alle Freigabestaende" },
  { value: "PRE_RELEASED", label: "Vorab freigegeben" },
  { value: "STANDARD_FLOW_COMPLETED", label: "Normalweg abgeschlossen" },
  { value: "NOT_RELEASED", label: "Nicht freigegeben" },
];

const distributionStatusOptions = [
  { value: "all", label: "Alle Apothekenstatus" },
  { value: "RELEASED", label: "Freigegeben" },
  { value: "VIEWED", label: "Gesehen" },
  { value: "IN_PROGRESS", label: "In Bearbeitung" },
  { value: "DISPENSED", label: "Abgegeben" },
  { value: "BLOCKED_DUPLICATE", label: "Doppelausgabe blockiert" },
];

const sortOptions = [
  { value: "released_desc", label: "Freigabe neu zuerst" },
  { value: "released_asc", label: "Freigabe alt zuerst" },
  { value: "updated_desc", label: "Letzte Aenderung" },
  { value: "doctor_asc", label: "Arzt A-Z" },
  { value: "summary_asc", label: "Rezept A-Z" },
];

function formatDate(value?: string | null) {
  if (!value) {
    return "offen";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildMedicationLabel(item: TrackingItem) {
  return [item.medicationName, item.medicationStrength, item.medicationPzn ? `PZN ${item.medicationPzn}` : null]
    .filter(Boolean)
    .join(" · ");
}

function buildDistributionLabel(item: TrackingItem) {
  const counts = item.distributionSummary.counts;

  if (counts.dispensed > 0) {
    return `${counts.dispensed}/${item.distributionSummary.total} abgegeben`;
  }

  if (counts.inProgress > 0) {
    return `${counts.inProgress}/${item.distributionSummary.total} in Bearbeitung`;
  }

  if (counts.viewed > 0) {
    return `${counts.viewed}/${item.distributionSummary.total} gesehen`;
  }

  if (counts.blockedDuplicate > 0) {
    return `${counts.blockedDuplicate}/${item.distributionSummary.total} blockiert`;
  }

  return `${counts.released}/${item.distributionSummary.total} freigegeben`;
}

export function PracticeRequestTrackingTable({ doctors }: TrackingTableProps) {
  const [items, setItems] = useState<TrackingItem[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ApiResponse["pagination"]>({
    page: 1,
    pageSize: 12,
    totalItems: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("all");
  const [releaseStatus, setReleaseStatus] = useState("all");
  const [distributionStatus, setDistributionStatus] = useState("all");
  const [doctorId, setDoctorId] = useState("all");
  const [sort, setSort] = useState("released_desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnState, setReturnState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [returnMessage, setReturnMessage] = useState("");

  const deferredSearch = useDeferredValue(search);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "12",
      sort,
    });

    if (deferredSearch.trim()) {
      params.set("q", deferredSearch.trim());
    }

    if (requestStatus !== "all") {
      params.set("requestStatus", requestStatus);
    }

    if (releaseStatus !== "all") {
      params.set("releaseStatus", releaseStatus);
    }

    if (distributionStatus !== "all") {
      params.set("distributionStatus", distributionStatus);
    }

    if (doctorId !== "all") {
      params.set("doctorId", doctorId);
    }

    return params.toString();
  }, [deferredSearch, distributionStatus, doctorId, page, releaseStatus, requestStatus, sort]);

  const exportQueryString = useMemo(() => {
    const params = new URLSearchParams(queryString);
    params.delete("page");
    params.delete("pageSize");
    return params.toString();
  }, [queryString]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/practice/requests?${queryString}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Freigabeliste konnte nicht geladen werden.");
        }

        const payload = (await response.json()) as ApiResponse;
        setItems(payload.items);
        setPagination(payload.pagination);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setItems([]);
        setPagination((current) => ({
          ...current,
          totalItems: 0,
          totalPages: 1,
        }));
        setError(loadError instanceof Error ? loadError.message : "Freigabeliste konnte nicht geladen werden.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [queryString]);

  function resetPage() {
    startTransition(() => {
      setPage(1);
    });
  }

  async function triggerReturn(mode: "auto" | "email") {
    setReturnState("running");
    setReturnMessage("");

    try {
      const response = await fetch("/api/practice/requests/return", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: deferredSearch.trim(),
          doctorId,
          requestStatus,
          releaseStatus,
          distributionStatus,
          sort,
          mode,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Rueckgabe konnte nicht ausgefuehrt werden.");
      }

      if (mode === "email") {
        setReturnMessage(`Rueckgabe-Mail vorbereitet: ${payload.rows} Datensaetze.`);
      } else if (payload.pms?.status === "sent") {
        setReturnMessage(`Rueckgabe ins PMS gesendet: ${payload.rows} Datensaetze.`);
      } else if (payload.email?.status === "sent") {
        setReturnMessage(`PMS nicht erreichbar, Rueckgabe-Mail gesendet: ${payload.rows} Datensaetze.`);
      } else {
        setReturnMessage(`Rueckgabe verarbeitet: ${payload.rows} Datensaetze.`);
      }

      setReturnState("done");
    } catch (submitError) {
      setReturnState("error");
      setReturnMessage(
        submitError instanceof Error ? submitError.message : "Rueckgabe konnte nicht ausgefuehrt werden.",
      );
    }
  }

  return (
    <section className="composer-layout single-stack">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Arzt-Nachverfolgung</p>
            <h2>Freigegebene Rezepte als kompakte Spaltenansicht</h2>
          </div>
          <div className="request-table-header-actions">
            <a
              href={`/api/practice/requests/export?${exportQueryString}&format=csv`}
              className="secondary-link"
            >
              CSV fuer PMS
            </a>
            <a
              href={`/api/practice/requests/export?${exportQueryString}&format=html`}
              className="secondary-link"
              target="_blank"
              rel="noreferrer"
            >
              E-Mail-Tabelle
            </a>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void triggerReturn("auto")}
              disabled={returnState === "running"}
            >
              Rueckgabe auto
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void triggerReturn("email")}
              disabled={returnState === "running"}
            >
              Praxis-Mail senden
            </button>
            <div className="context-chip">
              {pagination.totalItems} Treffer · Seite {pagination.page}/{pagination.totalPages}
            </div>
          </div>
        </div>
        {returnMessage ? (
          <div className={`status-text ${returnState === "error" ? "error" : ""}`}>{returnMessage}</div>
        ) : null}

        <div className="request-table-toolbar">
          <label className="field request-search-field">
            <span>Suche</span>
            <input
              type="search"
              placeholder="Rezept, Arzt, Medikament, PZN oder Apotheke"
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                startTransition(() => {
                  setSearch(value);
                  setPage(1);
                });
              }}
            />
          </label>

          <label className="field">
            <span>Arzt</span>
            <select
              value={doctorId}
              onChange={(event) => {
                setDoctorId(event.target.value);
                resetPage();
              }}
            >
              <option value="all">Alle Aerzte</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Rezeptstatus</span>
            <select
              value={requestStatus}
              onChange={(event) => {
                setRequestStatus(event.target.value);
                resetPage();
              }}
            >
              {requestStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Freigabestatus</span>
            <select
              value={releaseStatus}
              onChange={(event) => {
                setReleaseStatus(event.target.value);
                resetPage();
              }}
            >
              {releaseStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Apothekenstatus</span>
            <select
              value={distributionStatus}
              onChange={(event) => {
                setDistributionStatus(event.target.value);
                resetPage();
              }}
            >
              {distributionStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Sortierung</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                resetPage();
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="request-table-shell">
          <div className="request-table request-table-head" role="presentation">
            <span>Rezept</span>
            <span>Arzt</span>
            <span>Status</span>
            <span>Apotheken</span>
            <span>Freigabe</span>
            <span>Aktion</span>
          </div>

          {loading ? <div className="request-table-empty">Liste wird geladen...</div> : null}
          {error ? <div className="request-table-empty">{error}</div> : null}
          {!loading && !error && items.length === 0 ? (
            <div className="request-table-empty">Keine freigegebenen Rezepte fuer diese Auswahl gefunden.</div>
          ) : null}

          {!loading && !error
            ? items.map((item) => {
                const medicationLabel = buildMedicationLabel(item);

                return (
                  <div key={item.id} className="request-table request-table-row">
                    <div className="request-cell-primary">
                      <strong>{item.summary ?? "Rezept ohne Zusammenfassung"}</strong>
                      <span>{medicationLabel || formatRecipeFormType(item.recipeFormType)}</span>
                      <span>
                        {item.patientReference ? `Patient: ${item.patientReference}` : "Keine Patientenreferenz"}
                      </span>
                    </div>

                    <div className="request-cell-meta">
                      <strong>{item.doctorName}</strong>
                      <span>{formatRecipeFormType(item.recipeFormType)}</span>
                      <span>Signiert: {formatDate(item.signedAt)}</span>
                    </div>

                    <div className="request-cell-meta">
                      <strong>{formatRequestStatus(item.status)}</strong>
                      <span>{formatPharmacyReleaseStatus(item.pharmacyReleaseStatus)}</span>
                      <span>
                        {item.distributionSummary.latestStatus
                          ? formatRequestDistributionStatus(item.distributionSummary.latestStatus)
                          : "Kein Apothekenstatus"}
                      </span>
                    </div>

                    <div className="request-cell-meta">
                      <strong>{buildDistributionLabel(item)}</strong>
                      <span>{item.distributionSummary.pharmacyNames.join(", ")}</span>
                      <span>
                        {item.normalFlowPending ? "Normalweg noch offen" : "Normalweg abgeschlossen"}
                      </span>
                    </div>

                    <div className="request-cell-meta">
                      <strong>{formatDate(item.releasedToPharmacyAt)}</strong>
                      <span>Ausgestellt: {formatDate(item.issuedAt ?? item.createdAt)}</span>
                      <span>
                        {item.latestEvent
                          ? `${item.latestEvent.type} · ${formatDate(item.latestEvent.createdAt)}`
                          : `Aktualisiert: ${formatDate(item.updatedAt)}`}
                      </span>
                    </div>

                    <div className="request-cell-action">
                      <Link href={`/practice/requests/${item.id}`} className="secondary-link">
                        Oeffnen
                      </Link>
                    </div>
                  </div>
                );
              })
            : null}
        </div>

        <div className="request-table-pagination">
          <button
            type="button"
            className="secondary-button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Zurueck
          </button>
          <span className="muted-copy">
            {pagination.totalItems} Freigaben insgesamt
          </span>
          <button
            type="button"
            className="secondary-button"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
          >
            Weiter
          </button>
        </div>
      </article>
    </section>
  );
}
