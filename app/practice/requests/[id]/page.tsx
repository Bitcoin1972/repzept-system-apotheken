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
        <p className="hero-kicker">Praxis / Detailansicht</p>
        <h1 className="hero-title">Fall wurde freigegeben</h1>
        <p className="hero-copy">
          Der gespeicherte Text, die geparsten Felder und die Apotheken-Antworten stehen
          direkt nach der Freigabe bereit.
        </p>
        <div className="row">
          <span className="status-pill">Status: {request.status}</span>
          <span className="status-pill">
            {request.demoMode ? "Demo-Modus aktiv" : "Demo-Modus aus"}
          </span>
          <Link href="/practice/new" className="secondary-button">
            Neuer Fall
          </Link>
        </div>
      </section>

      <section className="panel stack">
        <h2>Erfasster Text</h2>
        <p>{request.transcription}</p>
      </section>

      <section className="panel stack">
        <h2>Strukturierte Daten</h2>
        <dl className="preview-grid">
          <div className="preview-item">
            <dt>patientReference</dt>
            <dd>{request.patientReference || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>medicationName</dt>
            <dd>{request.medicationName || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>productName</dt>
            <dd>{request.productName || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>manufacturer</dt>
            <dd>{request.manufacturer || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>dosage</dt>
            <dd>{request.dosage || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>form</dt>
            <dd>{request.form || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>pzn</dt>
            <dd>{request.pzn || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>quantity</dt>
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
