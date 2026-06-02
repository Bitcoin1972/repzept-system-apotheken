import { NextResponse } from "next/server";
import {
  SupportComponent,
  SupportRole,
  SupportSeverity,
} from "@prisma/client";

import { submitSupportTicketToSwex } from "@/lib/integrations/swex";
import { prisma } from "@/lib/prisma";
import {
  buildSanitizedSwexPayload,
  buildExternalRef,
  buildTechnicalSignature,
  classifySupportComponent,
  mapSeverityToPriority,
  normalizeSeverity,
} from "@/lib/support";

const supportedComponents = new Set(Object.values(SupportComponent));

export async function POST(request: Request) {
  const body = await request.json();
  const createdAt = new Date();
  const role = body.role === "pharmacy" ? SupportRole.PHARMACY : SupportRole.PRACTICE;
  const component = supportedComponents.has(body.component)
    ? (body.component as SupportComponent)
    : classifySupportComponent(body.message ?? "");
  const severity = normalizeSeverity(body.severity) as SupportSeverity;

  const [practice, pharmacy] = await Promise.all([
    body.practiceId
      ? prisma.practice.findUnique({
          where: {
            id: body.practiceId,
          },
        })
      : Promise.resolve(null),
    body.pharmacyId
      ? prisma.pharmacyAccount.findUnique({
          where: {
            id: body.pharmacyId,
          },
        })
      : Promise.resolve(null),
  ]);
  const customerLinkFilters = [];

  if (body.practiceId) {
    customerLinkFilters.push({
      practiceId: body.practiceId,
    });
  }

  if (body.pharmacyId) {
    customerLinkFilters.push({
      pharmacyId: body.pharmacyId,
    });
  }

  const swexCustomerLink =
    customerLinkFilters.length > 0
      ? await prisma.swexCustomerLink.findFirst({
          where: {
            OR: customerLinkFilters,
          },
          orderBy: {
            updatedAt: "desc",
          },
        })
      : null;

  const category = body.category ?? `${role.toLowerCase()}_${component.toLowerCase()}`;
  const technicalSignature = buildTechnicalSignature(component, body.message ?? "");
  const projectId =
    body.projectId ??
    practice?.swexTenantRef ??
    pharmacy?.swexTenantRef ??
    "swex-default-project";
  const language = body.language ?? "de";
  const externalRef =
    body.externalRef ??
    buildExternalRef("support_ticket", body.requestId ?? body.connectionId ?? body.practiceId ?? body.pharmacyId);

  const swexPayload = buildSanitizedSwexPayload({
    role,
    component,
    severity,
    category,
    technicalSignature,
    createdAt,
    message: body.message ?? "",
    projectId,
    externalRef,
    language,
    refs: {
      practiceId: body.practiceId,
      pharmacyId: body.pharmacyId,
      connectionId: body.connectionId,
      requestId: body.requestId,
      practiceStripeRef: practice?.stripeCustomerRef,
      pharmacyStripeRef: pharmacy?.stripeCustomerRef,
    },
  });

  const swexResult = await submitSupportTicketToSwex({
    ...swexPayload,
    customerRef: swexCustomerLink?.swexCustomerRef ?? null,
    customerName: swexCustomerLink?.customerName ?? practice?.name ?? pharmacy?.name ?? null,
    customerEmail: swexCustomerLink?.customerEmail ?? pharmacy?.billingEmail ?? pharmacy?.email ?? null,
  });

  const ticket = await prisma.supportTicket.create({
    data: {
      practiceId: body.practiceId ?? null,
      pharmacyId: body.pharmacyId ?? null,
      requestId: body.requestId ?? null,
      connectionId: body.connectionId ?? null,
      swexProjectId: projectId,
      externalRef,
      language,
      role,
      component,
      severity,
      category,
      technicalSignature,
      summary: swexPayload.title,
      internalMessage: body.message ?? "",
      internalContext: {
        role,
        component,
        createdFrom: body.createdFrom ?? "manual_ui",
        practiceId: body.practiceId ?? null,
        pharmacyId: body.pharmacyId ?? null,
        connectionId: body.connectionId ?? null,
        requestId: body.requestId ?? null,
        requestedPriority: mapSeverityToPriority(severity),
        swexCustomerRef: swexCustomerLink?.swexCustomerRef ?? null,
      },
      swexPayload,
      swexTicketRef: swexResult.ticketRef,
    },
  });

  return NextResponse.json({
    ticket,
    swex: swexResult,
  });
}
