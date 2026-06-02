import {
  CatalogSource,
  ConnectionVerificationStatus,
  PmsType,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const defaultPracticeInclude = {
  doctors: {
    orderBy: {
      createdAt: "asc",
    },
  },
  pharmacyConnections: {
    include: {
      pharmacy: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.PracticeInclude;

function buildVerificationCode(name: string) {
  return `APO-${name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "DEMO"}-2048`;
}

export async function ensurePracticeContext(practiceId?: string) {
  if (practiceId) {
    return prisma.practice.findUniqueOrThrow({
      where: {
        id: practiceId,
      },
      include: defaultPracticeInclude,
    });
  }

  const existingPractice = await prisma.practice.findFirst({
    include: defaultPracticeInclude,
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingPractice) {
    return existingPractice;
  }

  try {
    const practice = await prisma.practice.create({
      data: {
        name: "Musterpraxis Nord",
        street: "Marktplatz 4",
        city: "Hamburg",
        postalCode: "20095",
        latitude: 53.5506,
        longitude: 10.0016,
        pickupNotificationEmail: "abholung@musterpraxis-nord.de",
        trialStartsAt: new Date("2026-06-01T00:00:00.000Z"),
        trialEndsAt: new Date("2026-06-30T23:59:59.000Z"),
        pmsType: PmsType.GENERIC_PMS,
        pmsSystemLabel: "Demo PMS",
        pmsApiBaseUrl: "https://pms.local",
        pmsApiKeyMasked: "••••-local",
        catalogSource: CatalogSource.PMS_CATALOG,
        catalogProviderLabel: null,
        catalogApiBaseUrl: null,
        catalogApiKeyMasked: null,
        stripeCustomerRef: "cus_demo_practice",
        stripeSubscriptionRef: "sub_demo_practice",
        stripeCheckoutUrl: "https://buy.stripe.com/test_demo_checkout",
        swexTenantRef: "swex_practice_demo",
        renderWorkspaceSlug: "demo-workspace",
        renderServiceName: "repzept-demo-practice",
        copyToOwnRenderOnActivation: true,
        doctors: {
          create: {
            name: "Dr. Lena Winter",
            email: "praxis@example.local",
          },
        },
      },
      include: defaultPracticeInclude,
    });

    const pharmacy = await prisma.pharmacyAccount.upsert({
      where: {
        verificationCode: buildVerificationCode("Apotheke am Markt"),
      },
      update: {
        name: "Apotheke am Markt",
        email: "apotheke@example.local",
        street: "Spitalerstrasse 8",
        city: "Hamburg",
        postalCode: "20095",
        latitude: 53.5519,
        longitude: 10.0034,
        stripeCustomerRef: "cus_demo_pharmacy",
        swexTenantRef: "swex_pharmacy_demo",
      },
      create: {
        name: "Apotheke am Markt",
        email: "apotheke@example.local",
        street: "Spitalerstrasse 8",
        city: "Hamburg",
        postalCode: "20095",
        latitude: 53.5519,
        longitude: 10.0034,
        verificationCode: buildVerificationCode("Apotheke am Markt"),
        stripeCustomerRef: "cus_demo_pharmacy",
        swexTenantRef: "swex_pharmacy_demo",
      },
    });

    await prisma.practicePharmacyConnection.upsert({
      where: {
        practiceId_pharmacyId: {
          practiceId: practice.id,
          pharmacyId: pharmacy.id,
        },
      },
      update: {
        pharmacyVerificationCode: pharmacy.verificationCode,
        verificationStatus: ConnectionVerificationStatus.VERIFIED,
        connectedAt: new Date(),
        verifiedByAiAt: new Date(),
      },
      create: {
        practiceId: practice.id,
        pharmacyId: pharmacy.id,
        pharmacyVerificationCode: pharmacy.verificationCode,
        verificationStatus: ConnectionVerificationStatus.VERIFIED,
        connectedAt: new Date(),
        verifiedByAiAt: new Date(),
      },
    });

    return prisma.practice.findUniqueOrThrow({
      where: {
        id: practice.id,
      },
      include: defaultPracticeInclude,
    });
  } catch {
    return prisma.practice.findFirstOrThrow({
      include: defaultPracticeInclude,
      orderBy: {
        createdAt: "asc",
      },
    });
  }
}

export async function getPracticeDashboardContext(input?: {
  practiceId?: string;
  activeDoctorId?: string | null;
}) {
  const practice = await ensurePracticeContext(input?.practiceId);

  const [recentRequests, recentSupportTickets, pharmacies] = await Promise.all([
    prisma.request.findMany({
      where: {
        practiceId: practice.id,
      },
      include: {
        requestDistributions: {
          include: {
            pharmacy: true,
          },
          orderBy: {
            releasedAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),
    prisma.supportTicket.findMany({
      where: {
        practiceId: practice.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
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

  return {
    practice,
    recentRequests,
    recentSupportTickets,
    pharmacies,
    activeDoctor:
      practice.doctors.find((doctor) => doctor.id === input?.activeDoctorId) ?? practice.doctors[0] ?? null,
  };
}
