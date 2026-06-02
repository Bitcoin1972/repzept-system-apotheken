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
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  projectId: string;
  externalRef: string;
  language: string;
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

export function mapSeverityToPriority(severity: SupportSeverity) {
  switch (severity) {
    case SupportSeverity.LOW:
      return "low" as const;
    case SupportSeverity.HIGH:
      return "high" as const;
    case SupportSeverity.CRITICAL:
      return "urgent" as const;
    default:
      return "medium" as const;
  }
}

export function buildExternalRef(scope: string, rawValue?: string | null) {
  const suffix = rawValue
    ? createHash("sha256").update(`${scope}:${rawValue}`).digest("hex").slice(0, 10)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return `${scope}_${suffix}`;
}

export function buildSanitizedSwexPayload(input: {
  role: SupportRole;
  component: SupportComponent;
  severity: SupportSeverity;
  category: string;
  technicalSignature: string;
  createdAt: Date;
  message: string;
  projectId: string;
  externalRef: string;
  language: string;
  refs: SupportTenantRefs;
}) {
  const reporterRole = input.role === SupportRole.PRACTICE ? "practice" : "pharmacy";
  const descriptionParts = [
    `role=${reporterRole}`,
    `component=${input.component}`,
    `category=${input.category}`,
    `signature=${input.technicalSignature}`,
    `createdAt=${input.createdAt.toISOString()}`,
  ];

  const practiceRef = pseudonymizeRef("practice", input.refs.practiceId);
  const pharmacyRef = pseudonymizeRef("pharmacy", input.refs.pharmacyId);
  const connectionRef = pseudonymizeRef("connection", input.refs.connectionId);
  const requestRef = pseudonymizeRef("request", input.refs.requestId);
  const practiceStripeRef = pseudonymizeRef("stripe_practice", input.refs.practiceStripeRef);
  const pharmacyStripeRef = pseudonymizeRef("stripe_pharmacy", input.refs.pharmacyStripeRef);

  if (practiceRef) descriptionParts.push(`practiceRef=${practiceRef}`);
  if (pharmacyRef) descriptionParts.push(`pharmacyRef=${pharmacyRef}`);
  if (connectionRef) descriptionParts.push(`connectionRef=${connectionRef}`);
  if (requestRef) descriptionParts.push(`requestRef=${requestRef}`);
  if (practiceStripeRef) descriptionParts.push(`practiceStripeRef=${practiceStripeRef}`);
  if (pharmacyStripeRef) descriptionParts.push(`pharmacyStripeRef=${pharmacyStripeRef}`);

  const payload: SanitizedSwexPayload = {
    title: `${reporterRole} ${input.component.toLowerCase().replaceAll("_", " ")} issue`,
    description: descriptionParts.join(" | "),
    priority: mapSeverityToPriority(input.severity),
    projectId: input.projectId,
    externalRef: input.externalRef,
    language: input.language,
  };

  return payload;
}
