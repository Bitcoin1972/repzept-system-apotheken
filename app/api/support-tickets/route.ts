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
  buildTechnicalSignature,
  classifySupportComponent,
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

  const category = body.category ?? `${role.toLowerCase()}_${component.toLowerCase()}`;
  const technicalSignature = buildTechnicalSignature(component, body.message ?? "");

  const swexPayload = buildSanitizedSwexPayload({
    role,
    component,
    severity,
    category,
    technicalSignature,
    createdAt,
    refs: {
      practiceId: body.practiceId,
      pharmacyId: body.pharmacyId,
      connectionId: body.connectionId,
      requestId: body.requestId,
      practiceStripeRef: practice?.stripeCustomerRef,
      pharmacyStripeRef: pharmacy?.stripeCustomerRef,
    },
  });

  const swexResult = await submitSupportTicketToSwex(swexPayload);

  const ticket = await prisma.supportTicket.create({
    data: {
      practiceId: body.practiceId ?? null,
      pharmacyId: body.pharmacyId ?? null,
      requestId: body.requestId ?? null,
      connectionId: body.connectionId ?? null,
      role,
      component,
      severity,
      category,
      technicalSignature,
      summary: swexPayload.summary,
      internalMessage: body.message ?? "",
      internalContext: {
        role,
        component,
        createdFrom: body.createdFrom ?? "manual_ui",
        practiceId: body.practiceId ?? null,
        pharmacyId: body.pharmacyId ?? null,
        connectionId: body.connectionId ?? null,
        requestId: body.requestId ?? null,
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
