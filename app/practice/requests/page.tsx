import Link from "next/link";
import { AuthRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { getPracticeDashboardContext } from "@/lib/bootstrap";
import { getPracticeAccessState } from "@/lib/practice-access";

import { PracticeRequestTrackingTable } from "./PracticeRequestTrackingTable";

export const dynamic = "force-dynamic";

export default async function PracticeRequestsPage() {
  const user = await requireRole([AuthRole.PRACTICE_ADMIN, AuthRole.DOCTOR_USER]);
  const context = await getPracticeDashboardContext({
    practiceId: user.practiceId ?? undefined,
    activeDoctorId: user.doctorUserId,
  });
  const access = getPracticeAccessState(context.practice);

  if (access.status !== "active") {
    redirect("/billing/expired");
  }

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Arzt-Nachverfolgung</p>
          <h1>Freigaben im Blick behalten</h1>
          <p className="hero-copy">
            Kompakte Tabellenansicht fuer bereits freigegebene Rezepte inklusive Suchleiste,
            Statusfiltern und paginierter Verlaufssuche ueber alle verbundenen Apotheken.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/practice/new" className="secondary-link">
            Neue Freigabe
          </Link>
        </div>
      </section>

      <PracticeRequestTrackingTable
        doctors={context.practice.doctors.map((doctor) => ({
          id: doctor.id,
          name: doctor.name,
        }))}
      />
    </main>
  );
}
