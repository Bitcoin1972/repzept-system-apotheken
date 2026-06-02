import { redirect } from "next/navigation";

import { ensurePracticeContext } from "@/lib/bootstrap";
import { getPracticeAccessState } from "@/lib/practice-access";
import { prisma } from "@/lib/prisma";

import { PharmacyWorkspace } from "./PharmacyWorkspace";

export const dynamic = "force-dynamic";

export default async function PharmacyPage() {
  const practice = await ensurePracticeContext();
  const access = getPracticeAccessState(practice);

  if (access.status !== "active") {
    redirect("/billing/expired");
  }

  const [practices, pharmacies] = await Promise.all([
    prisma.practice.findMany({
      include: {
        doctors: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.pharmacyAccount.findMany({
      include: {
        practiceConnections: {
          include: {
            practice: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  return (
    <PharmacyWorkspace
      practices={practices.map((practice) => ({
        id: practice.id,
        name: `${practice.name}${practice.doctors[0] ? ` · ${practice.doctors[0].name}` : ""}`,
      }))}
      pharmacies={pharmacies.map((pharmacy) => ({
        id: pharmacy.id,
        name: pharmacy.name,
        email: pharmacy.email,
        street: pharmacy.street,
        city: pharmacy.city,
        postalCode: pharmacy.postalCode,
        latitude: pharmacy.latitude,
        longitude: pharmacy.longitude,
        verificationCode: pharmacy.verificationCode,
        practiceConnections: pharmacy.practiceConnections.map((connection) => ({
          id: connection.id,
          practiceName: connection.practice.name,
          practiceId: connection.practice.id,
          verificationStatus: connection.verificationStatus,
        })),
      }))}
    />
  );
}
