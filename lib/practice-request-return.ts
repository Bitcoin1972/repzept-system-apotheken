import {
  PharmacyReleaseStatus,
  Prisma,
  RequestDistributionStatus,
  RequestStatus,
} from "@prisma/client";

import { formatRecipeFormType } from "@/lib/labels";
import { sendTransactionalEmail } from "@/lib/integrations/mailer";
import { prisma } from "@/lib/prisma";

const releasedStatuses = [
  RequestStatus.RELEASED,
  RequestStatus.DISPENSED,
  RequestStatus.COMPLETED,
] as const;

const allowedRequestStatuses = new Set<string>(releasedStatuses);
const allowedReleaseStatuses = new Set<string>(Object.values(PharmacyReleaseStatus));
const allowedDistributionStatuses = new Set<string>(Object.values(RequestDistributionStatus));

export type PracticeReturnFilters = {
  q?: string;
  doctorId?: string;
  requestStatus?: string;
  releaseStatus?: string;
  distributionStatus?: string;
  sort?: string;
  doctorScopeId?: string | null;
};

export type PracticeReturnRow = {
  requestId: string;
  releasedAt: string;
  issuedAt: string;
  doctorName: string;
  patientReference: string;
  insuranceProvider: string;
  recipeFormType: string;
  summary: string;
  medicationName: string;
  medicationStrength: string;
  form: string;
  quantity: string;
  dosage: string;
  medicationPzn: string;
  pharmacies: string;
  releaseStatus: string;
  normalFlow: string;
};

export function getReturnSortOrder(sort: string | null | undefined): Prisma.RequestOrderByWithRelationInput[] {
  switch (sort) {
    case "released_asc":
      return [{ releasedToPharmacyAt: "asc" }, { createdAt: "asc" }];
    case "updated_desc":
      return [{ updatedAt: "desc" }];
    case "doctor_asc":
      return [{ doctorName: "asc" }, { releasedToPharmacyAt: "desc" }];
    case "summary_asc":
      return [{ summary: "asc" }, { releasedToPharmacyAt: "desc" }];
    case "released_desc":
    default:
      return [{ releasedToPharmacyAt: "desc" }, { createdAt: "desc" }];
  }
}

export function buildReturnSearchWhere(query: string): Prisma.RequestWhereInput[] {
  return [
    { summary: { contains: query, mode: "insensitive" } },
    { outputText: { contains: query, mode: "insensitive" } },
    { medicationName: { contains: query, mode: "insensitive" } },
    { medicationStrength: { contains: query, mode: "insensitive" } },
    { medicationPzn: { contains: query, mode: "insensitive" } },
    { patientReference: { contains: query, mode: "insensitive" } },
    { doctorName: { contains: query, mode: "insensitive" } },
    {
      requestDistributions: {
        some: {
          pharmacy: {
            name: { contains: query, mode: "insensitive" },
          },
        },
      },
    },
  ];
}

export function buildReturnWhere(practiceId: string, filters: PracticeReturnFilters): Prisma.RequestWhereInput {
  const andFilters: Prisma.RequestWhereInput[] = [
    { practiceId },
    { requestDistributions: { some: {} } },
    { status: { in: [...releasedStatuses] } },
  ];

  if (filters.doctorScopeId) {
    andFilters.push({ releasedByDoctorId: filters.doctorScopeId });
  }

  if (filters.doctorId && filters.doctorId !== "all") {
    andFilters.push({ releasedByDoctorId: filters.doctorId });
  }

  if (filters.requestStatus && allowedRequestStatuses.has(filters.requestStatus)) {
    andFilters.push({ status: filters.requestStatus as RequestStatus });
  }

  if (filters.releaseStatus && allowedReleaseStatuses.has(filters.releaseStatus)) {
    andFilters.push({ pharmacyReleaseStatus: filters.releaseStatus as PharmacyReleaseStatus });
  }

  if (filters.distributionStatus && allowedDistributionStatuses.has(filters.distributionStatus)) {
    andFilters.push({
      requestDistributions: {
        some: {
          status: filters.distributionStatus as RequestDistributionStatus,
        },
      },
    });
  }

  if (filters.q?.trim()) {
    andFilters.push({ OR: buildReturnSearchWhere(filters.q.trim()) });
  }

  return { AND: andFilters };
}

function formatDate(value?: Date | string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function csvEscape(value: string | null | undefined) {
  const normalized = value ?? "";
  return `"${normalized.replaceAll('"', '""')}"`;
}

function htmlEscape(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function fetchPracticeReturnRows(practiceId: string, filters: PracticeReturnFilters) {
  const items = await prisma.request.findMany({
    where: buildReturnWhere(practiceId, filters),
    orderBy: getReturnSortOrder(filters.sort),
    include: {
      requestDistributions: {
        select: {
          pharmacy: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return items.map<PracticeReturnRow>((item) => ({
    requestId: item.id,
    releasedAt: formatDate(item.releasedToPharmacyAt),
    issuedAt: formatDate(item.issuedAt),
    doctorName: item.doctorName ?? "",
    patientReference: item.patientReference ?? "",
    insuranceProvider: item.insuranceProvider ?? "",
    recipeFormType: formatRecipeFormType(item.recipeFormType),
    summary: item.summary ?? "",
    medicationName: item.medicationName ?? "",
    medicationStrength: item.medicationStrength ?? "",
    form: item.form ?? "",
    quantity: item.quantity ?? "",
    dosage: item.dosage ?? "",
    medicationPzn: item.medicationPzn ?? "",
    pharmacies: item.requestDistributions.map((distribution) => distribution.pharmacy.name).join(", "),
    releaseStatus: item.pharmacyReleaseStatus,
    normalFlow: item.normalFlowPending ? "Offen" : "Abgeschlossen",
  }));
}

export function buildPracticeReturnCsv(rows: PracticeReturnRow[]) {
  const headers = [
    "Freigegeben",
    "Ausgestellt",
    "Rezept-ID",
    "Arzt",
    "Patient",
    "Kasse",
    "Formular",
    "Zusammenfassung",
    "Medikament",
    "Staerke",
    "Darreichung",
    "Menge",
    "Dosierung",
    "PZN",
    "Apotheken",
    "Freigabestatus",
    "Normalweg",
  ];

  return [
    headers.map((header) => csvEscape(header)).join(";"),
    ...rows.map((row) =>
      [
        row.releasedAt,
        row.issuedAt,
        row.requestId,
        row.doctorName,
        row.patientReference,
        row.insuranceProvider,
        row.recipeFormType,
        row.summary,
        row.medicationName,
        row.medicationStrength,
        row.form,
        row.quantity,
        row.dosage,
        row.medicationPzn,
        row.pharmacies,
        row.releaseStatus,
        row.normalFlow,
      ]
        .map(csvEscape)
        .join(";"),
    ),
  ].join("\n");
}

export function buildPracticeReturnHtmlTable(rows: PracticeReturnRow[]) {
  const headerCells = [
    "Freigegeben",
    "Ausgestellt",
    "Rezept-ID",
    "Arzt",
    "Patient",
    "Kasse",
    "Formular",
    "Zusammenfassung",
    "Medikament",
    "Staerke",
    "Darreichung",
    "Menge",
    "Dosierung",
    "PZN",
    "Apotheken",
    "Normalweg",
  ];

  const tableRows = rows
    .map(
      (row) => `<tr>
<td>${htmlEscape(row.releasedAt)}</td>
<td>${htmlEscape(row.issuedAt)}</td>
<td>${htmlEscape(row.requestId)}</td>
<td>${htmlEscape(row.doctorName)}</td>
<td>${htmlEscape(row.patientReference)}</td>
<td>${htmlEscape(row.insuranceProvider)}</td>
<td>${htmlEscape(row.recipeFormType)}</td>
<td>${htmlEscape(row.summary)}</td>
<td>${htmlEscape(row.medicationName)}</td>
<td>${htmlEscape(row.medicationStrength)}</td>
<td>${htmlEscape(row.form)}</td>
<td>${htmlEscape(row.quantity)}</td>
<td>${htmlEscape(row.dosage)}</td>
<td>${htmlEscape(row.medicationPzn)}</td>
<td>${htmlEscape(row.pharmacies)}</td>
<td>${htmlEscape(row.normalFlow)}</td>
</tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>PMS Rueckgabe Tabelle</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
    h1 { margin-bottom: 8px; }
    p { color: #4b5563; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; text-align: left; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>PMS Rueckgabe Tabelle</h1>
  <p>Diese Tabelle kann direkt in eine E-Mail an die MFA uebernommen oder fuer die Rueckpflege ins PMS verwendet werden.</p>
  <table>
    <thead><tr>${headerCells.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
}

export async function pushPracticeRowsToPms(input: {
  practice: {
    name: string;
    pmsWritebackUrl: string | null;
    pmsApiKeySecret: string | null;
  };
  rows: PracticeReturnRow[];
}) {
  if (!input.practice.pmsWritebackUrl) {
    return { status: "skipped" as const, reason: "Keine PMS-Rueckgabe-URL hinterlegt." };
  }

  const response = await fetch(input.practice.pmsWritebackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.practice.pmsApiKeySecret
        ? { Authorization: `Bearer ${input.practice.pmsApiKeySecret}` }
        : {}),
    },
    body: JSON.stringify({
      practiceName: input.practice.name,
      exportedAt: new Date().toISOString(),
      records: input.rows,
    }),
  });

  const bodyText = await response.text();

  if (!response.ok) {
    return {
      status: "failed" as const,
      reason: `PMS Rueckgabe ${response.status}: ${bodyText}`,
    };
  }

  return {
    status: "sent" as const,
    response: bodyText,
  };
}

export async function sendPracticeReturnEmail(input: {
  practice: {
    name: string;
    pickupNotificationEmail: string | null;
    pmsReturnEmail: string | null;
  };
  rows: PracticeReturnRow[];
}) {
  if (!input.practice.pmsReturnEmail) {
    return { status: "skipped" as const, reason: "Keine Praxis-/MFA-E-Mail fuer die Rueckgabe hinterlegt." };
  }

  return sendTransactionalEmail({
    from: input.practice.pickupNotificationEmail ?? process.env.SMTP_USER ?? "",
    to: input.practice.pmsReturnEmail,
    subject: `Rueckgabe freigegebener Rezepte fuer ${input.practice.name}`,
    bodyText:
      `Anbei die Rueckgabe der freigegebenen Rezepte fuer ${input.practice.name}.\n\n` +
      `Anzahl Datensaetze: ${input.rows.length}\n` +
      `Bitte die Tabelle fuer die Rueckpflege ins PMS verwenden.`,
    html: buildPracticeReturnHtmlTable(input.rows),
    replyTo: input.practice.pickupNotificationEmail ?? null,
  });
}
