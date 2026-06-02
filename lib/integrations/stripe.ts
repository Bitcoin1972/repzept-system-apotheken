type RevenueInput = {
  stripeCustomerRef?: string | null;
  stripeSubscriptionRef?: string | null;
};

type StripePaymentInput = {
  practiceId?: string | null;
  pharmacyId?: string | null;
  stripeCustomerId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
  customerName?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  status?: string | null;
  description?: string | null;
  paidAt?: string | Date | null;
  failedAt?: string | Date | null;
};

export type StripePaymentRecordInput = {
  practiceId?: string | null;
  pharmacyId?: string | null;
  stripeCustomerId?: string | null;
  stripePaymentIntentId: string;
  stripeInvoiceId?: string | null;
  customerName?: string | null;
  amount: number;
  currency: string;
  status: string;
  description?: string | null;
  paidAt?: Date | null;
  failedAt?: Date | null;
};

export function buildRevenueSnapshot(input: RevenueInput) {
  return {
    connected: Boolean(input.stripeCustomerRef),
    customerRef: input.stripeCustomerRef ?? "nicht verbunden",
    subscriptionRef: input.stripeSubscriptionRef ?? "kein aktives Abo verknuepft",
    visibility: "Nur technische Billing-Referenzen werden an SWEX gespiegelt.",
  };
}

function asDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

export function resolveStripePaymentFields(input: StripePaymentInput): StripePaymentRecordInput {
  if (!input.stripePaymentIntentId) {
    throw new Error("stripePaymentIntentId ist fuer Stripe-Zahlungen erforderlich.");
  }

  return {
    practiceId: input.practiceId ?? null,
    pharmacyId: input.pharmacyId ?? null,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripePaymentIntentId: input.stripePaymentIntentId,
    stripeInvoiceId: input.stripeInvoiceId ?? null,
    customerName: input.customerName ?? null,
    amount: Number(input.amount ?? 0),
    currency: (input.currency ?? "eur").toLowerCase(),
    status: input.status ?? "unknown",
    description: input.description ?? null,
    paidAt: asDate(input.paidAt),
    failedAt: asDate(input.failedAt),
  };
}
