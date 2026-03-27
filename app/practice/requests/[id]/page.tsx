import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PracticeRequestDetailPage({ params }: PageProps) {
  const { id } = await params;

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      responses: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!request) {
    notFound();
  }

  return (
    <main className="page-shell stack">
      <section className="hero-card">
        <p className="hero-kicker">Apotheke / Eingangsansicht</p>
        <h1 className="hero-title">
          Rezept freigabesigniert von {request.signedBy || request.doctorName || "Dr. ..."}
        </h1>
        <p className="hero-copy">
          Die Apotheke sieht den signierten Rezeptdatensatz mit Verordnungsdetails, Rezepttyp
          und uebernommenen Medikamentendaten unmittelbar nach der Freigabe.
        </p>
        <div className="row">
          <span className="status-pill">Status: {request.status}</span>
          <span className="status-pill">Signatur: {request.signatureStatus}</span>
          <span className="status-pill">Typ: {request.prescriptionType}</span>
          <span className="status-pill">
            {request.demoMode ? "Demo-Modus aktiv" : "Demo-Modus aus"}
          </span>
          <Link href="/practice/new" className="secondary-button">
            Neuer Fall
          </Link>
        </div>
      </section>

      <section
        className={`panel stack ${
          request.prescriptionType === "GREEN" ? "detail-prescription-green" : "detail-prescription-red"
        }`}
      >
        <div className="row">
          <h2>Freigabeansicht</h2>
          <span className="status-pill">
            {request.signedAt ? new Date(request.signedAt).toLocaleString("de-DE") : "Noch nicht signiert"}
          </span>
        </div>
        <div className="preview-grid">
          <div className="preview-item">
            <dt>Arzt</dt>
            <dd>{request.doctorName || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Krankenkasse</dt>
            <dd>{request.insuranceProvider || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Ausgestellt</dt>
            <dd>{request.issuedAt ? new Date(request.issuedAt).toLocaleDateString("de-DE") : "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Datenquelle</dt>
            <dd>{request.medicationSource || "-"}</dd>
          </div>
        </div>
        <p>{request.summary || "Keine automatische Zusammenfassung gespeichert."}</p>
      </section>

      <section className="panel stack">
        <h2>Diktat / Freitext</h2>
        <p>{request.transcription}</p>
      </section>

      <section className="panel stack">
        <h2>Rezeptdaten</h2>
        <dl className="preview-grid">
          <div className="preview-item">
            <dt>Patient</dt>
            <dd>{request.patientReference || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Medikament</dt>
            <dd>{request.medicationName || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Produkt</dt>
            <dd>{request.productName || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Hersteller</dt>
            <dd>{request.manufacturer || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Dosierung</dt>
            <dd>{request.dosage || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Form</dt>
            <dd>{request.form || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>PZN</dt>
            <dd>{request.pzn || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Menge</dt>
            <dd>{request.quantity || "-"}</dd>
          </div>
        </dl>
      </section>

      <section className="panel stack">
        <div className="row">
          <h2>Apotheken-Antworten</h2>
          <span className="status-pill">{request.responses.length} Antworten</span>
        </div>
        <div className="response-grid">
          {request.responses.map((response) => (
            <article key={response.id} className="response-card">
              <h3>{response.pharmacyName}</h3>
              <div className="response-meta">
                <span className="status-pill">{response.responseStatus}</span>
              </div>
              <p>{response.message}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
