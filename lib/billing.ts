import { InvoiceStatus, PharmacyPlan } from "@prisma/client";

import {
  createAndSendStripeMonthlyInvoice,
  fetchStripeInvoice,
  mapStripeInvoiceStatus,
} from "@/lib/integrations/stripe";
import { prisma } from "@/lib/prisma";

const PLAN_PRICE_CENTS: Record<PharmacyPlan, number> = {
  [PharmacyPlan.SMALL]: 9900,
  [PharmacyPlan.STANDARD]: 24900,
  [PharmacyPlan.NETWORK]: 49900,
};

export function getPlanPriceCents(plan: PharmacyPlan) {
  return PLAN_PRICE_CENTS[plan];
}

export function getPlanLabel(plan: PharmacyPlan) {
  if (plan === PharmacyPlan.NETWORK) {
    return "Network / Filialverbund";
  }

  if (plan === PharmacyPlan.STANDARD) {
    return "Standard / Stadtapotheke";
  }

  return "Small / Dorfapotheke";
}

export function resolveBillingWindow(month?: string | null) {
  const base = month ? new Date(`${month}-01T00:00:00.000Z`) : new Date();
  const monthStart = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, 0, 0, 0));

  return {
    monthStart,
    monthEnd,
    monthLabel: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

export async function prepareMonthlyInvoiceForPharmacy(pharmacyId: string, month?: string | null) {
  const { monthStart, monthEnd, monthLabel } = resolveBillingWindow(month);

  const pharmacy = await prisma.pharmacyAccount.findUnique({
    where: {
      id: pharmacyId,
    },
    include: {
      practiceConnections: {
        where: {
          connectedAt: {
            lt: monthEnd,
          },
        },
      },
    },
  });

  if (!pharmacy) {
    throw new Error("Apotheke nicht gefunden.");
  }

  const [releasedCount, dispensedCount] = await Promise.all([
    prisma.requestDistribution.count({
      where: {
        pharmacyId,
        releasedAt: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
    }),
    prisma.requestDistribution.count({
      where: {
        pharmacyId,
        dispensedAt: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
    }),
  ]);

  const usageSnapshot = await prisma.pharmacyUsageSnapshot.upsert({
    where: {
      pharmacyId_monthStart: {
        pharmacyId,
        monthStart,
      },
    },
    update: {
      releasedCount,
      dispensedCount,
      activeConnections: pharmacy.practiceConnections.length,
    },
    create: {
      pharmacyId,
      monthStart,
      releasedCount,
      dispensedCount,
      activeConnections: pharmacy.practiceConnections.length,
    },
  });

  const amountCents = pharmacy.monthlyPriceCents || getPlanPriceCents(pharmacy.plan);
  const lineItemDescription = `${getPlanLabel(pharmacy.plan)} · Monat ${monthLabel} · ${releasedCount} Freigaben, ${dispensedCount} Abgaben`;
  const internalReference = `pharmacy_invoice_${pharmacy.id}_${monthLabel.replace("-", "")}`;

  const existingInvoice = await prisma.pharmacyInvoice.findUnique({
    where: {
      pharmacyId_monthStart: {
        pharmacyId,
        monthStart,
      },
    },
  });

  let stripeInvoiceId = existingInvoice?.stripeInvoiceId ?? null;
  let stripeHostedInvoiceUrl = existingInvoice?.stripeHostedInvoiceUrl ?? null;
  let invoiceStatus: InvoiceStatus = existingInvoice?.status ?? InvoiceStatus.DRAFT;

  if (stripeInvoiceId && !stripeInvoiceId.startsWith("draft_")) {
    const stripeInvoice = await fetchStripeInvoice(stripeInvoiceId);
    stripeHostedInvoiceUrl = stripeInvoice.hosted_invoice_url ?? stripeHostedInvoiceUrl;
    invoiceStatus = mapStripeInvoiceStatus(stripeInvoice.status) as InvoiceStatus;
  } else {
    if (!pharmacy.stripeCustomerRef) {
      throw new Error("Fuer diese Apotheke ist keine Stripe Customer Ref hinterlegt.");
    }

    const stripeInvoice = await createAndSendStripeMonthlyInvoice({
      customerId: pharmacy.stripeCustomerRef,
      billingEmail: pharmacy.billingEmail ?? pharmacy.email,
      pharmacyName: pharmacy.name,
      amountCents,
      currency: "eur",
      description: lineItemDescription,
      monthLabel,
      internalReference,
      metadata: {
        pharmacyId: pharmacy.id,
        usageSnapshotId: usageSnapshot.id,
      },
    });

    stripeInvoiceId = stripeInvoice.stripeInvoiceId;
    stripeHostedInvoiceUrl = stripeInvoice.stripeHostedInvoiceUrl;
    invoiceStatus = mapStripeInvoiceStatus(stripeInvoice.status) as InvoiceStatus;
  }

  const invoice = await prisma.pharmacyInvoice.upsert({
    where: {
      pharmacyId_monthStart: {
        pharmacyId,
        monthStart,
      },
    },
    update: {
      usageSnapshotId: usageSnapshot.id,
      monthEnd,
      plan: pharmacy.plan,
      amountCents,
      status: invoiceStatus,
      stripeInvoiceId,
      stripeHostedInvoiceUrl,
      stripeCustomerId: pharmacy.stripeCustomerRef,
      lineItemDescription,
    },
    create: {
      pharmacyId,
      usageSnapshotId: usageSnapshot.id,
      monthStart,
      monthEnd,
      plan: pharmacy.plan,
      amountCents,
      status: invoiceStatus,
      stripeInvoiceId,
      stripeHostedInvoiceUrl,
      stripeCustomerId: pharmacy.stripeCustomerRef,
      lineItemDescription,
    },
  });

  await prisma.pharmacyAccount.update({
    where: {
      id: pharmacy.id,
    },
    data: {
      monthlyPriceCents: amountCents,
      stripeLatestInvoiceRef: stripeInvoiceId,
      currentPeriodStart: monthStart,
      currentPeriodEnd: monthEnd,
    },
  });

  return {
    pharmacy: {
      id: pharmacy.id,
      name: pharmacy.name,
      plan: pharmacy.plan,
      billingEmail: pharmacy.billingEmail ?? pharmacy.email,
      stripeCustomerRef: pharmacy.stripeCustomerRef,
    },
    usageSnapshot,
    invoice,
  };
}
