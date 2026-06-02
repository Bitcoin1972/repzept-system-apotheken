type PracticeAccessInput = {
  trialStartsAt?: Date | null;
  trialEndsAt?: Date | null;
  stripeSubscriptionRef?: string | null;
  stripeCheckoutUrl?: string | null;
};

export type PracticeAccessState = {
  status: "active" | "trial_pending" | "expired";
  reason: string;
  checkoutUrl: string | null;
};

export function getPracticeAccessState(input: PracticeAccessInput): PracticeAccessState {
  const now = new Date();

  if (input.stripeSubscriptionRef) {
    return {
      status: "active",
      reason: "Aktives Stripe-Abo vorhanden.",
      checkoutUrl: input.stripeCheckoutUrl ?? null,
    };
  }

  if (input.trialStartsAt && now < input.trialStartsAt) {
    return {
      status: "trial_pending",
      reason: "Die kostenlose Nutzung ist noch nicht freigeschaltet.",
      checkoutUrl: input.stripeCheckoutUrl ?? null,
    };
  }

  if (input.trialEndsAt && now > input.trialEndsAt) {
    return {
      status: "expired",
      reason: "Die kostenlose Nutzung ist abgelaufen.",
      checkoutUrl: input.stripeCheckoutUrl ?? null,
    };
  }

  return {
    status: "active",
    reason: "Nutzung ist aktiv.",
    checkoutUrl: input.stripeCheckoutUrl ?? null,
  };
}

export function canUsePracticeFeatures(input: PracticeAccessInput) {
  return getPracticeAccessState(input).status === "active";
}
