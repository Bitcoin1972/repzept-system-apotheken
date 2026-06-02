import {
  AuthRole,
  PharmacyReleaseStatus,
  Prisma,
  RequestDistributionStatus,
  RequestStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { getPracticeDashboardContext } from "@/lib/bootstrap";
import { getPracticeAccessState } from "@/lib/practice-access";
import { prisma } from "@/lib/prisma";

const releasedStatuses = [
  RequestStatus.RELEASED,
  RequestStatus.DISPENSED,
  RequestStatus.COMPLETED,
] as const;

const allowedRequestStatuses = new Set<string>(releasedStatuses);
const allowedReleaseStatuses = new Set<string>(Object.values(PharmacyReleaseStatus));
const allowedDistributionStatuses = new Set<string>(Object.values(RequestDistributionStatus));
const defaultPageSize = 12;
const maxPageSize = 50;

type SortKey = "released_desc" | "released_asc" | "updated_desc" | "doctor_asc" | "summary_asc";

function parsePositiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function getSortOrder(sort: string | null): Prisma.RequestOrderByWithRelationInput[] {
  switch (sort as SortKey) {
    case "released_asc":
      return [{ releasedToPharmacyAt: "asc" }, { createdAt: "asc" }];
    case "updated_desc":
      return [{ updatedAt: "desc" }];
    case "doctor_asc":
      return [{ doctorName: "asc" }, { releasedToPharmacyAt: "desc" }];
    case "summary_asc":
      return [{ summary: "asc" }, { releasedToPharmacyAt: "desc" }];
    case "released_desc":
    default:
      return [{ releasedToPharmacyAt: "desc" }, { createdAt: "desc" }];
  }
}

function buildSearchWhere(query: string): Prisma.RequestWhereInput[] {
  return [
    { summary: { contains: query, mode: "insensitive" } },
    { outputText: { contains: query, mode: "insensitive" } },
    { medicationName: { contains: query, mode: "insensitive" } },
    { medicationStrength: { contains: query, mode: "insensitive" } },
    { medicationPzn: { contains: query, mode: "insensitive" } },
    { patientReference: { contains: query, mode: "insensitive" } },
    { doctorName: { contains: query, mode: "insensitive" } },
    {
      requestDistributions: {
        some: {
          pharmacy: {
            name: { contains: query, mode: "insensitive" },
          },
        },
      },
    },
    {
      dispenseLogs: {
        some: {
          eventType: { contains: query, mode: "insensitive" },
        },
      },
    },
  ];
}

function summarizeDistributions(
  distributions: Array<{
    status: RequestDistributionStatus;
    releasedAt: Date;
    updatedAt: Date;
    pharmacy: {
      name: string;
    };
  }>,
) {
  const counts = {
    released: 0,
    viewed: 0,
    inProgress: 0,
    dispensed: 0,
    blockedDuplicate: 0,
  };

  for (const distribution of distributions) {
    if (distribution.status === RequestDistributionStatus.RELEASED) {
      counts.released += 1;
    } else if (distribution.status === RequestDistributionStatus.VIEWED) {
      counts.viewed += 1;
    } else if (distribution.status === RequestDistributionStatus.IN_PROGRESS) {
      counts.inProgress += 1;
    } else if (distribution.status === RequestDistributionStatus.DISPENSED) {
      counts.dispensed += 1;
    } else if (distribution.status === RequestDistributionStatus.BLOCKED_DUPLICATE) {
      counts.blockedDuplicate += 1;
    }
  }

  const latest = [...distributions].sort((left, right) => {
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  })[0];

  return {
    total: distributions.length,
    latestStatus: latest?.status ?? null,
    pharmacyNames: distributions.map((distribution) => distribution.pharmacy.name),
    counts,
  };
}

export async function GET(request: Request) {
  const user = await requireRole([AuthRole.PRACTICE_ADMIN, AuthRole.DOCTOR_USER]);
  const context = await getPracticeDashboardContext({
    practiceId: user.practiceId ?? undefined,
    activeDoctorId: user.doctorUserId,
  });
  const access = getPracticeAccessState(context.practice);

  if (access.status !== "active") {
    return NextResponse.json(
      {
        error: "Die kostenlose Nutzung ist abgelaufen.",
        checkoutUrl: access.checkoutUrl,
      },
      { status: 402 },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const doctorId = searchParams.get("doctorId")?.trim() ?? "";
  const requestStatus = searchParams.get("requestStatus")?.trim() ?? "";
  const releaseStatus = searchParams.get("releaseStatus")?.trim() ?? "";
  const distributionStatus = searchParams.get("distributionStatus")?.trim() ?? "";
  const sort = searchParams.get("sort") ?? "released_desc";
  const page = parsePositiveNumber(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveNumber(searchParams.get("pageSize"), defaultPageSize), maxPageSize);

  const andFilters: Prisma.RequestWhereInput[] = [
    {
      practiceId: context.practice.id,
    },
    {
      requestDistributions: {
        some: {},
      },
    },
    {
      status: {
        in: [...releasedStatuses],
      },
    },
  ];

  if (user.role === AuthRole.DOCTOR_USER && user.doctorUserId) {
    andFilters.push({
      releasedByDoctorId: user.doctorUserId,
    });
  }

  if (doctorId) {
    andFilters.push({
      releasedByDoctorId: doctorId,
    });
  }

  if (requestStatus && allowedRequestStatuses.has(requestStatus)) {
    andFilters.push({
      status: requestStatus as RequestStatus,
    });
  }

  if (releaseStatus && allowedReleaseStatuses.has(releaseStatus)) {
    andFilters.push({
      pharmacyReleaseStatus: releaseStatus as PharmacyReleaseStatus,
    });
  }

  if (distributionStatus && allowedDistributionStatuses.has(distributionStatus)) {
    andFilters.push({
      requestDistributions: {
        some: {
          status: distributionStatus as RequestDistributionStatus,
        },
      },
    });
  }

  if (q) {
    andFilters.push({
      OR: buildSearchWhere(q),
    });
  }

  const where: Prisma.RequestWhereInput = {
    AND: andFilters,
  };

  const [items, totalItems] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: getSortOrder(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        releasedByDoctor: {
          select: {
            id: true,
            name: true,
          },
        },
        requestDistributions: {
          select: {
            id: true,
            status: true,
            releasedAt: true,
            updatedAt: true,
            viewedAt: true,
            processingStartedAt: true,
            dispensedAt: true,
            blockedAt: true,
            pharmacy: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            releasedAt: "desc",
          },
        },
        dispenseLogs: {
          select: {
            eventType: true,
            eventNote: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    }),
    prisma.request.count({
      where,
    }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      summary: item.summary,
      status: item.status,
      pharmacyReleaseStatus: item.pharmacyReleaseStatus,
      normalFlowPending: item.normalFlowPending,
      recipeFormType: item.recipeFormType,
      doctorName: item.releasedByDoctor?.name ?? item.doctorName ?? "Praxis",
      doctorId: item.releasedByDoctor?.id ?? item.releasedByDoctorId ?? null,
      patientReference: item.patientReference,
      medicationName: item.medicationName,
      medicationStrength: item.medicationStrength,
      medicationPzn: item.medicationPzn,
      signedAt: item.signedAt?.toISOString() ?? null,
      issuedAt: item.issuedAt?.toISOString() ?? null,
      releasedToPharmacyAt: item.releasedToPharmacyAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      latestEvent: item.dispenseLogs[0]
        ? {
            type: item.dispenseLogs[0].eventType,
            note: item.dispenseLogs[0].eventNote,
            createdAt: item.dispenseLogs[0].createdAt.toISOString(),
          }
        : null,
      distributionSummary: summarizeDistributions(item.requestDistributions),
    })),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    },
  });
}
