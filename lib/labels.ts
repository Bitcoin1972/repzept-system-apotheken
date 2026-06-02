const recipeFormLabels: Record<string, string> = {
  GKV_MUSTER16: "Rosa / GKV Muster 16",
  GREEN: "Gruenes Rezept",
  PRIVATE: "Privatrezept",
  BTM: "BtM-Rezept",
  T_REZEPT: "T-Rezept",
};

const pharmacyReleaseLabels: Record<string, string> = {
  NOT_RELEASED: "Nicht freigegeben",
  PRE_RELEASED: "Vorab freigegeben",
  STANDARD_FLOW_COMPLETED: "Normaler Weg abgeschlossen",
};

const requestDistributionLabels: Record<string, string> = {
  RELEASED: "Freigegeben",
  VIEWED: "Gesehen",
  IN_PROGRESS: "In Bearbeitung",
  DISPENSED: "Abgegeben",
  BLOCKED_DUPLICATE: "Doppelausgabe blockiert",
};

const verificationStatusLabels: Record<string, string> = {
  PENDING: "Pruefung laeuft",
  VERIFIED: "Verifiziert",
  REJECTED: "Abgelehnt",
};

const requestStatusLabels: Record<string, string> = {
  DRAFT: "Entwurf",
  APPROVED: "Freigegeben zur Signatur",
  RELEASED: "Freigegeben",
  DISPENSED: "Abgegeben",
  COMPLETED: "Abgeschlossen",
};

const recipeFlagLabels: Record<string, string> = {
  autIdem: "Aut idem",
  noctu: "Noctu",
  accident: "Unfallkennzeichen",
  bvg: "BVG",
  coPaymentExempt: "Zuzahlungsbefreit",
  tInLabel: "In-Label",
  tOffLabel: "Off-Label",
  tInfoMaterial: "Informationsmaterial",
  tSafetyConfirmed: "Sicherheitsbestaetigung",
};

export function formatRecipeFormType(value?: string | null) {
  return (value && recipeFormLabels[value]) || value || "Unbekannt";
}

export function formatPharmacyReleaseStatus(value?: string | null) {
  return (value && pharmacyReleaseLabels[value]) || value || "Unbekannt";
}

export function formatRequestDistributionStatus(value?: string | null) {
  return (value && requestDistributionLabels[value]) || value || "Unbekannt";
}

export function formatVerificationStatus(value?: string | null) {
  return (value && verificationStatusLabels[value]) || value || "Unbekannt";
}

export function formatRequestStatus(value?: string | null) {
  return (value && requestStatusLabels[value]) || value || "Unbekannt";
}

export function formatRecipeFlag(key: string) {
  return recipeFlagLabels[key] ?? key;
}
