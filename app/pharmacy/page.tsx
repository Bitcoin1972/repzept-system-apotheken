import { AuthRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { PharmacyWorkspace } from "./PharmacyWorkspace";

export const dynamic = "force-dynamic";

export default async function PharmacyPage() {
  const user = await requireRole([AuthRole.PHARMACY_USER]);

  if (!user.pharmacyAccountId) {
    redirect("/register?role=pharmacy_user&error=Kein+Apothekenkonto+hinterlegt.");
  }

  const [practices, pharmacy] = await Promise.all([
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
    prisma.pharmacyAccount.findUnique({
      where: {
        id: user.pharmacyAccountId,
      },
      include: {
        practiceConnections: {
          include: {
            practice: true,
          },
        },
        usageSnapshots: {
          orderBy: {
            monthStart: "desc",
          },
          take: 3,
        },
        invoices: {
          orderBy: {
            monthStart: "desc",
          },
          take: 3,
        },
      },
    }),
  ]);

  if (!pharmacy) {
    redirect("/register?role=pharmacy_user&error=Apothekenkonto+nicht+gefunden.");
  }

  return (
    <PharmacyWorkspace
      allowAccountCreation={false}
      practices={practices.map((practice) => ({
        id: practice.id,
        name: `${practice.name}${practice.doctors[0] ? ` · ${practice.doctors[0].name}` : ""}`,
      }))}
      pharmacies={[
        {
          id: pharmacy.id,
          name: pharmacy.name,
          email: pharmacy.email,
          street: pharmacy.street,
          city: pharmacy.city,
          postalCode: pharmacy.postalCode,
          latitude: pharmacy.latitude,
          longitude: pharmacy.longitude,
          verificationCode: pharmacy.verificationCode,
          plan: pharmacy.plan,
          monthlyPriceCents: pharmacy.monthlyPriceCents,
          subscriptionStatus: pharmacy.subscriptionStatus,
          billingEmail: pharmacy.billingEmail,
          stripeCustomerRef: pharmacy.stripeCustomerRef,
          stripeLatestInvoiceRef: pharmacy.stripeLatestInvoiceRef,
          usageSnapshots: pharmacy.usageSnapshots.map((snapshot) => ({
            id: snapshot.id,
            monthStart: snapshot.monthStart.toISOString(),
            releasedCount: snapshot.releasedCount,
            dispensedCount: snapshot.dispensedCount,
            activeConnections: snapshot.activeConnections,
          })),
          invoices: pharmacy.invoices.map((invoice) => ({
            id: invoice.id,
            monthStart: invoice.monthStart.toISOString(),
            amountCents: invoice.amountCents,
            status: invoice.status,
            lineItemDescription: invoice.lineItemDescription,
          })),
          practiceConnections: pharmacy.practiceConnections.map((connection) => ({
            id: connection.id,
            practiceName: connection.practice.name,
            practiceId: connection.practice.id,
            verificationStatus: connection.verificationStatus,
          })),
        },
      ]}
    />
  );
}
