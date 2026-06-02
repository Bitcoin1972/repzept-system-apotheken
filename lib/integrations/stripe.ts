import Stripe from "stripe";

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

export type StripeMonthlyInvoiceResult = {
  stripeInvoiceId: string;
  stripeHostedInvoiceUrl: string | null;
  stripeCustomerId: string;
  status: string;
};

export function buildRevenueSnapshot(input: RevenueInput) {
  return {
    connected: Boolean(input.stripeCustomerRef),
    customerRef: input.stripeCustomerRef ?? "nicht verbunden",
    subscriptionRef: input.stripeSubscriptionRef ?? "kein aktives Abo verknuepft",
    visibility: "Nur technische Billing-Referenzen werden an SWEX gespiegelt.",
  };
}

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt.");
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
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

export function mapStripeInvoiceStatus(status?: string | null) {
  if (status === "paid") {
    return "PAID";
  }

  if (status === "open") {
    return "ISSUED";
  }

  if (status === "void" || status === "uncollectible") {
    return "VOID";
  }

  if (status === "draft") {
    return "DRAFT";
  }

  return "PREPARED";
}

export async function createAndSendStripeMonthlyInvoice(input: {
  customerId: string;
  billingEmail?: string | null;
  pharmacyName: string;
  amountCents: number;
  currency?: string;
  description: string;
  monthLabel: string;
  internalReference: string;
  metadata?: Record<string, string>;
}): Promise<StripeMonthlyInvoiceResult> {
  const stripe = getStripeClient();
  const currency = (input.currency ?? "eur").toLowerCase();

  const draftInvoice = await stripe.invoices.create({
    customer: input.customerId,
    collection_method: "send_invoice",
    days_until_due: 14,
    auto_advance: false,
    metadata: {
      billing_scope: "pharmacy_monthly_plan",
      internal_reference: input.internalReference,
      month: input.monthLabel,
      pharmacy_name: input.pharmacyName,
      ...(input.metadata ?? {}),
    },
  });

  if (!draftInvoice.id) {
    throw new Error("Stripe hat keine Invoice-ID fuer den Monatslauf geliefert.");
  }

  await stripe.invoiceItems.create({
    customer: input.customerId,
    invoice: draftInvoice.id,
    amount: input.amountCents,
    currency,
    description: input.description,
    metadata: {
      internal_reference: input.internalReference,
      month: input.monthLabel,
      ...(input.metadata ?? {}),
    },
  });

  const finalized = await stripe.invoices.finalizeInvoice(draftInvoice.id, {
    auto_advance: false,
  });

  if (!finalized.id) {
    throw new Error("Stripe hat keine finalisierte Invoice-ID geliefert.");
  }

  const sent = await stripe.invoices.sendInvoice(finalized.id);

  return {
    stripeInvoiceId: sent.id ?? finalized.id,
    stripeHostedInvoiceUrl: sent.hosted_invoice_url ?? null,
    stripeCustomerId: input.customerId,
    status: sent.status ?? "open",
  };
}

export async function fetchStripeInvoice(invoiceId: string) {
  const stripe = getStripeClient();
  return stripe.invoices.retrieve(invoiceId);
}
