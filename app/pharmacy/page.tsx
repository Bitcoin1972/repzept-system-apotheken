import { ensurePracticeContext } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

import { PharmacyWorkspace } from "./PharmacyWorkspace";

export default async function PharmacyPage() {
  await ensurePracticeContext();

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
