import { NextResponse } from "next/server";
import { CatalogSource, PmsType } from "@prisma/client";

import { ensurePracticeContext } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

function maskKey(value?: string | null) {
  if (!value) {
    return null;
  }

  const visible = value.slice(-4);
  return `••••-${visible}`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const fallbackPractice = await ensurePracticeContext();

  const practice = body.practiceId
    ? await prisma.practice.update({
        where: {
          id: body.practiceId,
        },
        data: {
          name: body.name ?? fallbackPractice.name,
          pmsType: (body.pmsType as PmsType | undefined) ?? fallbackPractice.pmsType,
          pmsSystemLabel: body.pmsSystemLabel ?? fallbackPractice.pmsSystemLabel,
          pmsApiBaseUrl: body.pmsApiBaseUrl ?? fallbackPractice.pmsApiBaseUrl,
          pmsApiKeyMasked: maskKey(body.pmsApiKey) ?? fallbackPractice.pmsApiKeyMasked,
          catalogSource:
            (body.catalogSource as CatalogSource | undefined) ?? fallbackPractice.catalogSource,
          stripeCustomerRef: body.stripeCustomerRef ?? fallbackPractice.stripeCustomerRef,
          stripeSubscriptionRef:
            body.stripeSubscriptionRef ?? fallbackPractice.stripeSubscriptionRef,
          swexTenantRef: body.swexTenantRef ?? fallbackPractice.swexTenantRef,
        },
        include: {
          doctors: true,
          pharmacyConnections: {
            include: {
              pharmacy: true,
            },
          },
        },
      })
    : await prisma.practice.create({
        data: {
          name: body.name ?? "Neue Praxis",
          pmsType: (body.pmsType as PmsType | undefined) ?? PmsType.GENERIC_PMS,
          pmsSystemLabel: body.pmsSystemLabel ?? "Neues PMS",
          pmsApiBaseUrl: body.pmsApiBaseUrl ?? null,
          pmsApiKeyMasked: maskKey(body.pmsApiKey),
          catalogSource:
            (body.catalogSource as CatalogSource | undefined) ?? CatalogSource.PMS_CATALOG,
          stripeCustomerRef: body.stripeCustomerRef ?? null,
          stripeSubscriptionRef: body.stripeSubscriptionRef ?? null,
          swexTenantRef: body.swexTenantRef ?? null,
        },
        include: {
          doctors: true,
          pharmacyConnections: {
            include: {
              pharmacy: true,
            },
          },
        },
      });

  if (body.doctorName) {
    await prisma.doctorUser.create({
      data: {
        practiceId: practice.id,
        name: body.doctorName,
        email: body.doctorEmail ?? null,
      },
    });
  }

  const refreshed = await prisma.practice.findUniqueOrThrow({
    where: {
      id: practice.id,
    },
    include: {
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
    },
  });

  return NextResponse.json(refreshed);
}
