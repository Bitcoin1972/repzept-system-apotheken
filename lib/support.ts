import { createHash } from "node:crypto";

import {
  SupportComponent,
  SupportSeverity,
  SupportRole,
} from "@prisma/client";

type SupportTenantRefs = {
  practiceId?: string | null;
  pharmacyId?: string | null;
  connectionId?: string | null;
  requestId?: string | null;
  practiceStripeRef?: string | null;
  pharmacyStripeRef?: string | null;
};

export type SanitizedSwexPayload = {
  reporterRole: "practice" | "pharmacy";
  component: string;
  severity: string;
  category: string;
  technicalSignature: string;
  summary: string;
  createdAt: string;
  practiceRef?: string;
  pharmacyRef?: string;
  connectionRef?: string;
  requestRef?: string;
  stripeRefs?: {
    practice?: string;
    pharmacy?: string;
  };
};

const SWEX_SALT = process.env.SWEX_PSEUDONYM_SALT ?? "swex-demo-salt";

export function pseudonymizeRef(prefix: string, rawValue?: string | null) {
  if (!rawValue) {
    return undefined;
  }

  const digest = createHash("sha256")
    .update(`${SWEX_SALT}:${prefix}:${rawValue}`)
    .digest("hex")
    .slice(0, 12);

  return `${prefix}_${digest}`;
}

export function classifySupportComponent(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("stripe") || normalized.includes("umsatz") || normalized.includes("abo")) {
    return SupportComponent.STRIPE_SYNC;
  }

  if (normalized.includes("medikament") || normalized.includes("katalog") || normalized.includes("pzn")) {
    return SupportComponent.CATALOG_API;
  }

  if (normalized.includes("apothek") || normalized.includes("verbinden") || normalized.includes("code")) {
    return SupportComponent.PHARMACY_CONNECTION;
  }

  if (normalized.includes("freigabe") || normalized.includes("rezept")) {
    return SupportComponent.RELEASE_FLOW;
  }

  if (normalized.includes("pms") || normalized.includes("schnittstelle")) {
    return SupportComponent.PMS_CONNECTOR;
  }

  return SupportComponent.SUPPORT_UI;
}

export function buildTechnicalSignature(component: SupportComponent, message: string) {
  return createHash("sha256")
    .update(`${component}:${message.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
}

export function normalizeSeverity(severity?: string | null) {
  switch (severity) {
    case SupportSeverity.LOW:
    case SupportSeverity.HIGH:
    case SupportSeverity.CRITICAL:
      return severity;
    default:
      return SupportSeverity.MEDIUM;
  }
}

export function buildSanitizedSwexPayload(input: {
  role: SupportRole;
  component: SupportComponent;
  severity: SupportSeverity;
  category: string;
  technicalSignature: string;
  createdAt: Date;
  refs: SupportTenantRefs;
}) {
  const reporterRole = input.role === SupportRole.PRACTICE ? "practice" : "pharmacy";

  const payload: SanitizedSwexPayload = {
    reporterRole,
    component: input.component,
    severity: input.severity,
    category: input.category,
    technicalSignature: input.technicalSignature,
    summary: `${reporterRole} reported ${input.component.toLowerCase().replaceAll("_", " ")}`,
    createdAt: input.createdAt.toISOString(),
    practiceRef: pseudonymizeRef("practice", input.refs.practiceId),
    pharmacyRef: pseudonymizeRef("pharmacy", input.refs.pharmacyId),
    connectionRef: pseudonymizeRef("connection", input.refs.connectionId),
    requestRef: pseudonymizeRef("request", input.refs.requestId),
    stripeRefs: {
      practice: pseudonymizeRef("stripe_practice", input.refs.practiceStripeRef),
      pharmacy: pseudonymizeRef("stripe_pharmacy", input.refs.pharmacyStripeRef),
    },
  };

  if (!payload.stripeRefs?.practice && !payload.stripeRefs?.pharmacy) {
    delete payload.stripeRefs;
  }

  return payload;
}
