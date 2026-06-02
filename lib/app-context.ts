import { AuthRole, Prisma } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const practiceInclude = {
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

export async function getAuthenticatedAppContext() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  if (user.role === AuthRole.PHARMACY_USER && user.pharmacyAccountId) {
    const pharmacy = await prisma.pharmacyAccount.findUnique({
      where: {
        id: user.pharmacyAccountId,
      },
      include: {
        practiceConnections: {
          include: {
            practice: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        usageSnapshots: {
          orderBy: {
            monthStart: "desc",
          },
          take: 6,
        },
        invoices: {
          orderBy: {
            monthStart: "desc",
          },
          take: 6,
        },
      },
    });

    return {
      user,
      pharmacy,
      practice: null,
    };
  }

  const practiceId = user.practiceId ?? user.doctorUser?.practiceId ?? null;

  if (!practiceId) {
    return {
      user,
      pharmacy: null,
      practice: null,
    };
  }

  const practice = await prisma.practice.findUnique({
    where: {
      id: practiceId,
    },
    include: practiceInclude,
  });

  return {
    user,
    practice,
    pharmacy: null,
  };
}

export async function getPracticeDashboardContextForUser() {
  const context = await getAuthenticatedAppContext();

  if (!context?.practice) {
    return null;
  }

  const [recentRequests, recentSupportTickets, pharmacies] = await Promise.all([
    prisma.request.findMany({
      where: {
        practiceId: context.practice.id,
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
        practiceId: context.practice.id,
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
    practice: context.practice,
    recentRequests,
    recentSupportTickets,
    pharmacies,
    activeDoctor:
      context.user.doctorUser ??
      context.practice.doctors.find((doctor) => doctor.email === context.user.email) ??
      context.practice.doctors[0] ??
      null,
    user: context.user,
  };
}
