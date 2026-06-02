import { NextResponse } from "next/server";
import {
  AuthRole,
  PharmacyReleaseStatus,
  RequestDistributionStatus,
  RequestStatus,
} from "@prisma/client";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DispenseAction = "viewed" | "in_progress" | "dispensed";

function mapActionToStatus(action: DispenseAction) {
  if (action === "viewed") {
    return RequestDistributionStatus.VIEWED;
  }

  if (action === "in_progress") {
    return RequestDistributionStatus.IN_PROGRESS;
  }

  return RequestDistributionStatus.DISPENSED;
}

export async function POST(request: Request) {
  const user = await requireRole([AuthRole.PHARMACY_USER]);
  const body = await request.json();
  const action = body.action as DispenseAction;

  if (!body.distributionId || !action) {
    return NextResponse.json({ error: "distributionId und action sind erforderlich." }, { status: 400 });
  }

  const distribution = await prisma.requestDistribution.findUnique({
    where: {
      id: body.distributionId,
    },
    include: {
      request: true,
      pharmacy: true,
    },
  });

  if (!distribution) {
    return NextResponse.json({ error: "Distribution nicht gefunden." }, { status: 404 });
  }

  if (!user.pharmacyAccountId || distribution.pharmacyId !== user.pharmacyAccountId) {
    return NextResponse.json({ error: "Diese Freigabe gehoert nicht zu Ihrem Apothekenkonto." }, { status: 403 });
  }

  const now = new Date();

  if (action === "dispensed") {
    const result = await prisma.$transaction(async (tx) => {
      const updatedDistribution = await tx.requestDistribution.update({
        where: {
          id: distribution.id,
        },
        data: {
          status: RequestDistributionStatus.DISPENSED,
          dispensedAt: now,
          dispensedByUserId: user.id,
          note: body.note ?? distribution.note,
        },
      });

      await tx.requestDistribution.updateMany({
        where: {
          requestId: distribution.requestId,
          id: {
            not: distribution.id,
          },
          status: {
            not: RequestDistributionStatus.DISPENSED,
          },
        },
        data: {
          status: RequestDistributionStatus.BLOCKED_DUPLICATE,
          blockedAt: now,
        },
      });

      await tx.request.update({
        where: {
          id: distribution.requestId,
        },
        data: {
          status: RequestStatus.DISPENSED,
          normalFlowPending: false,
          pharmacyReleaseStatus: PharmacyReleaseStatus.STANDARD_FLOW_COMPLETED,
        },
      });

      await tx.dispenseLog.createMany({
        data: [
          {
            requestId: distribution.requestId,
            pharmacyId: distribution.pharmacyId,
            distributionId: distribution.id,
            eventType: "DISPENSED",
            eventNote: body.note ?? "Apotheke hat die Abgabe bestaetigt.",
            actorUserId: user.id,
            actorEmail: user.email,
            actorRole: user.role,
          },
          {
            requestId: distribution.requestId,
            distributionId: distribution.id,
            eventType: "NORMAL_FLOW_CLOSED",
            eventNote: "Andere Ausgabepfade werden jetzt gegen Doppelausgabe blockiert.",
            actorUserId: user.id,
            actorEmail: user.email,
            actorRole: user.role,
          },
        ],
      });

      return updatedDistribution;
    });

    return NextResponse.json(result);
  }

  const updated = await prisma.requestDistribution.update({
    where: {
      id: distribution.id,
    },
    data: {
      status: mapActionToStatus(action),
      viewedAt: action === "viewed" ? now : distribution.viewedAt,
      processingStartedAt: action === "in_progress" ? now : distribution.processingStartedAt,
      viewedByUserId: action === "viewed" ? user.id : distribution.viewedByUserId,
      processingByUserId: action === "in_progress" ? user.id : distribution.processingByUserId,
      note: body.note ?? distribution.note,
    },
  });

  await prisma.dispenseLog.create({
    data: {
      requestId: distribution.requestId,
      pharmacyId: distribution.pharmacyId,
      distributionId: distribution.id,
      eventType: action.toUpperCase(),
      eventNote:
        body.note ??
        (action === "viewed"
          ? "Apotheke hat die Freigabe gesichtet."
          : "Apotheke bearbeitet die Freigabe."),
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
    },
  });

  return NextResponse.json(updated);
}
