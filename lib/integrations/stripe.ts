type RevenueInput = {
  stripeCustomerRef?: string | null;
  stripeSubscriptionRef?: string | null;
};

export function buildRevenueSnapshot(input: RevenueInput) {
  return {
    connected: Boolean(input.stripeCustomerRef),
    customerRef: input.stripeCustomerRef ?? "nicht verbunden",
    subscriptionRef: input.stripeSubscriptionRef ?? "kein aktives Abo verknuepft",
    visibility: "Nur technische Billing-Referenzen werden an SWEX gespiegelt.",
  };
}
