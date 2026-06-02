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

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
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
          street: body.street ?? fallbackPractice.street,
          city: body.city ?? fallbackPractice.city,
          postalCode: body.postalCode ?? fallbackPractice.postalCode,
          latitude:
            body.latitude !== undefined && body.latitude !== ""
              ? Number(body.latitude)
              : fallbackPractice.latitude,
          longitude:
            body.longitude !== undefined && body.longitude !== ""
              ? Number(body.longitude)
              : fallbackPractice.longitude,
          pickupNotificationEmail:
            body.pickupNotificationEmail ?? fallbackPractice.pickupNotificationEmail,
          trialStartsAt:
            body.trialStartsAt !== undefined
              ? parseDate(body.trialStartsAt)
              : fallbackPractice.trialStartsAt,
          trialEndsAt:
            body.trialEndsAt !== undefined
              ? parseDate(body.trialEndsAt)
              : fallbackPractice.trialEndsAt,
          pmsType: (body.pmsType as PmsType | undefined) ?? fallbackPractice.pmsType,
          pmsSystemLabel: body.pmsSystemLabel ?? fallbackPractice.pmsSystemLabel,
          pmsApiBaseUrl: body.pmsApiBaseUrl ?? fallbackPractice.pmsApiBaseUrl,
          pmsApiKeyMasked: maskKey(body.pmsApiKey) ?? fallbackPractice.pmsApiKeyMasked,
          catalogSource:
            (body.catalogSource as CatalogSource | undefined) ?? fallbackPractice.catalogSource,
          catalogProviderLabel:
            body.catalogProviderLabel ?? fallbackPractice.catalogProviderLabel,
          catalogApiBaseUrl: body.catalogApiBaseUrl ?? fallbackPractice.catalogApiBaseUrl,
          catalogApiKeyMasked:
            maskKey(body.catalogApiKey) ?? fallbackPractice.catalogApiKeyMasked,
          stripeCustomerRef: body.stripeCustomerRef ?? fallbackPractice.stripeCustomerRef,
          stripeSubscriptionRef:
            body.stripeSubscriptionRef ?? fallbackPractice.stripeSubscriptionRef,
          stripeCheckoutUrl: body.stripeCheckoutUrl ?? fallbackPractice.stripeCheckoutUrl,
          swexTenantRef: body.swexTenantRef ?? fallbackPractice.swexTenantRef,
          renderWorkspaceSlug:
            body.renderWorkspaceSlug ?? fallbackPractice.renderWorkspaceSlug,
          renderServiceName: body.renderServiceName ?? fallbackPractice.renderServiceName,
          copyToOwnRenderOnActivation:
            body.copyToOwnRenderOnActivation ?? fallbackPractice.copyToOwnRenderOnActivation,
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
          street: body.street ?? null,
          city: body.city ?? null,
          postalCode: body.postalCode ?? null,
          latitude:
            body.latitude !== undefined && body.latitude !== "" ? Number(body.latitude) : null,
          longitude:
            body.longitude !== undefined && body.longitude !== "" ? Number(body.longitude) : null,
          pickupNotificationEmail: body.pickupNotificationEmail ?? null,
          trialStartsAt:
            body.trialStartsAt !== undefined ? parseDate(body.trialStartsAt) : null,
          trialEndsAt: body.trialEndsAt !== undefined ? parseDate(body.trialEndsAt) : null,
          pmsType: (body.pmsType as PmsType | undefined) ?? PmsType.GENERIC_PMS,
          pmsSystemLabel: body.pmsSystemLabel ?? "Neues PMS",
          pmsApiBaseUrl: body.pmsApiBaseUrl ?? null,
          pmsApiKeyMasked: maskKey(body.pmsApiKey),
          catalogSource:
            (body.catalogSource as CatalogSource | undefined) ?? CatalogSource.PMS_CATALOG,
          catalogProviderLabel: body.catalogProviderLabel ?? null,
          catalogApiBaseUrl: body.catalogApiBaseUrl ?? null,
          catalogApiKeyMasked: maskKey(body.catalogApiKey),
          stripeCustomerRef: body.stripeCustomerRef ?? null,
          stripeSubscriptionRef: body.stripeSubscriptionRef ?? null,
          stripeCheckoutUrl: body.stripeCheckoutUrl ?? null,
          swexTenantRef: body.swexTenantRef ?? null,
          renderWorkspaceSlug: body.renderWorkspaceSlug ?? null,
          renderServiceName: body.renderServiceName ?? null,
          copyToOwnRenderOnActivation: body.copyToOwnRenderOnActivation ?? false,
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
