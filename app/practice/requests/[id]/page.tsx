import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  PharmacyReleaseStatus,
  RequestDistributionStatus,
} from "@prisma/client";

import {
  formatPharmacyReleaseStatus,
  formatRecipeFlag,
  formatRecipeFormType,
  formatRequestDistributionStatus,
} from "@/lib/labels";
import { getPracticeAccessState } from "@/lib/practice-access";
import { prisma } from "@/lib/prisma";

type PageContext = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(value?: Date | null) {
  if (!value) {
    return "offen";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function PracticeRequestPage({ params }: PageContext) {
  const resolvedParams = await params;

  const requestRecord = await prisma.request.findUnique({
    where: {
      id: resolvedParams.id,
    },
    include: {
      practice: true,
      releasedByDoctor: true,
      requestDistributions: {
        include: {
          pharmacy: true,
          connection: true,
        },
        orderBy: {
          releasedAt: "asc",
        },
      },
      dispenseLogs: {
        include: {
          pharmacy: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      supportTickets: {
        orderBy: {
          createdAt: "desc",
        },
      },
      responses: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!requestRecord) {
    notFound();
  }

  const access = getPracticeAccessState(requestRecord.practice ?? {});

  if (access.status !== "active") {
    redirect("/billing/expired");
  }

  const formFlags =
    requestRecord.clinicalPayload &&
    typeof requestRecord.clinicalPayload === "object" &&
    "recipeFormFlags" in requestRecord.clinicalPayload
      ? (requestRecord.clinicalPayload.recipeFormFlags as Record<string, boolean>)
      : {};
  const enabledFlags = Object.entries(formFlags)
    .filter(([, enabled]) => enabled)
    .map(([key]) => formatRecipeFlag(key));
  const pickupEmailPreview = requestRecord.responses.find(
    (response) => response.kind === "pickup_email_preview",
  );
  const pickupEmailDelivery = requestRecord.responses.find(
    (response) => response.kind === "pickup_email_delivery",
  );

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Freigabedetail</p>
          <h1>{requestRecord.summary ?? "Rezeptdetail"}</h1>
          <p className="hero-copy">
            {requestRecord.practice?.name ?? "Praxis"} · {requestRecord.releasedByDoctor?.name ?? requestRecord.doctorName}
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/practice/new" className="secondary-link">
            Neue Freigabe
          </Link>
          <Link href="/pharmacy" className="secondary-link">
            Apotheker-Ansicht
          </Link>
        </div>
      </section>

      <section className="composer-layout">
        <div className="composer-main">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Rezeptstatus</p>
                <h2>Freigabe und Normalweg</h2>
              </div>
            </div>
            <div className="stack-list">
              <div className="stack-item">
                <strong>Rezeptformular</strong>
                <span>{formatRecipeFormType(requestRecord.recipeFormType)}</span>
              </div>
              <div className="stack-item">
                <strong>Freigabestatus</strong>
                <span>{formatPharmacyReleaseStatus(requestRecord.pharmacyReleaseStatus)}</span>
              </div>
              <div className="stack-item">
                <strong>Normaler Weg offen</strong>
                <span>{requestRecord.normalFlowPending ? "ja" : "nein"}</span>
              </div>
              <div className="stack-item">
                <strong>Signiert</strong>
                <span>{formatDate(requestRecord.signedAt)}</span>
              </div>
              <div className="stack-item">
                <strong>Rezepttext</strong>
                <span>{requestRecord.outputText ?? requestRecord.transcription ?? "kein Output gespeichert"}</span>
              </div>
              <div className="stack-item">
                <strong>Formular-Kennzeichen</strong>
                <span>{enabledFlags.length > 0 ? enabledFlags.join(", ") : "keine gesetzt"}</span>
              </div>
              <div className="stack-item">
                <strong>Patienten-E-Mail</strong>
                <span>{requestRecord.patientEmail ?? "keine hinterlegt"}</span>
              </div>
            </div>
            {requestRecord.pharmacyReleaseStatus === PharmacyReleaseStatus.PRE_RELEASED ? (
              <div className="release-banner warning">
                Bereits an Apotheke freigegeben. Wenn der regulaere Weg spaeter ankommt, darf nicht
                doppelt ausgegeben werden.
              </div>
            ) : null}
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Apotheken-Verteilung</p>
                <h2>Wer hat das Rezept erhalten?</h2>
              </div>
            </div>
            <div className="stack-list">
              {requestRecord.requestDistributions.map((distribution) => (
                <div key={distribution.id} className="stack-item">
                  <strong>{distribution.pharmacy.name}</strong>
                  <span>{formatRequestDistributionStatus(distribution.status)}</span>
                  <span>Freigegeben: {formatDate(distribution.releasedAt)}</span>
                  {distribution.status === RequestDistributionStatus.BLOCKED_DUPLICATE ? (
                    <span>Doppelausgabe wurde nach bestaetigter Abgabe blockiert.</span>
                  ) : null}
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Apotheken-Verlauf</p>
                <h2>Dispense Log</h2>
              </div>
            </div>
            <div className="stack-list">
              {requestRecord.dispenseLogs.map((log) => (
                <div key={log.id} className="stack-item">
                  <strong>{log.eventType}</strong>
                  <span>{log.pharmacy?.name ?? "System"}</span>
                  <span>{log.eventNote ?? "ohne Zusatzinfo"}</span>
                  <span>{formatDate(log.createdAt)}</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="composer-sidebar">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Abhol-Mail</p>
                <h2>Patientenbenachrichtigung</h2>
              </div>
            </div>
            {pickupEmailPreview ? (
              <div className="stack-list">
                <div className="stack-item">
                  <strong>Absender</strong>
                  <span>{String((pickupEmailPreview.payload as { from?: string }).from ?? "keine Praxis-E-Mail")}</span>
                </div>
                <div className="stack-item">
                  <strong>Betreff</strong>
                  <span>{String((pickupEmailPreview.payload as { subject?: string }).subject ?? "")}</span>
                </div>
                <div className="stack-item">
                  <strong>Empfaenger</strong>
                  <span>{String((pickupEmailPreview.payload as { to?: string }).to ?? "keine E-Mail")}</span>
                </div>
                <div className="stack-item">
                  <strong>Inhalt</strong>
                  <span>{String((pickupEmailPreview.payload as { bodyText?: string }).bodyText ?? "")}</span>
                </div>
                {pickupEmailDelivery ? (
                  <div className="stack-item">
                    <strong>Versandstatus</strong>
                    <span>{JSON.stringify(pickupEmailDelivery.payload)}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="muted-copy">Keine Abhol-Mail vorbereitet.</p>
            )}
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Support</p>
                <h2>Sanitized SWEX Tickets</h2>
              </div>
            </div>
            <div className="stack-list">
              {requestRecord.supportTickets.length === 0 ? (
                <p className="muted-copy">Noch keine Supporttickets zu dieser Freigabe.</p>
              ) : (
                requestRecord.supportTickets.map((ticket) => (
                  <div key={ticket.id} className="stack-item">
                    <strong>{ticket.summary}</strong>
                    <span>{ticket.component}</span>
                    <span>{ticket.swexTicketRef}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Preview</p>
                <h2>Gespeicherte Vorschau</h2>
              </div>
            </div>
            <div className="stack-list">
              {requestRecord.responses.map((response) => (
                <div key={response.id} className="stack-item">
                  <strong>{response.kind}</strong>
                  <span>{JSON.stringify(response.payload)}</span>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
