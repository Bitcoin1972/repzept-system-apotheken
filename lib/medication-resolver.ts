import { CatalogSource, type Practice } from "@prisma/client";

import { parsePrescriptionText } from "@/lib/parsing";

export type MedicationCandidate = {
  medicationName: string;
  medicationStrength: string;
  medicationPzn: string;
  source: "PMS_CATALOG" | "EXTERNAL_API" | "DEMO_CATALOG" | "TEXT_PARSE";
  confidence: "high" | "medium" | "low";
  matchedBy: "exact" | "contains" | "fuzzy" | "parse_only";
};

type CatalogMedication = {
  name: string;
  strength: string;
  pzn: string;
  aliases?: string[];
};

const demoCatalog: CatalogMedication[] = [
  { name: "L-Thyroxin", strength: "75 mcg Tabletten", pzn: "01234567", aliases: ["l thyroxin", "thyroxin", "l-thyroxin"] },
  { name: "Ibuprofen", strength: "600 mg Filmtabletten", pzn: "02468013", aliases: ["ibu", "ibuprofen"] },
  { name: "Ramipril", strength: "5 mg Tabletten", pzn: "09876543", aliases: ["ramipril"] },
  { name: "Pantoprazol", strength: "40 mg Tabletten", pzn: "01357924", aliases: ["panto", "pantoprazol"] },
  { name: "Metformin", strength: "1000 mg Filmtabletten", pzn: "13572468", aliases: ["metformin"] },
  { name: "Novaminsulfon", strength: "500 mg Tabletten", pzn: "24681357", aliases: ["novalgin", "novaminsulfon"] },
  { name: "Amlodipin", strength: "5 mg Tabletten", pzn: "31415926", aliases: ["amlodipin"] },
  { name: "Amoxicillin", strength: "1000 mg Tabletten", pzn: "27182818", aliases: ["amoxicillin"] },
];

function normalizeMedicationText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let index = 0; index <= left.length; index += 1) {
    matrix[index][0] = index;
  }

  for (let index = 0; index <= right.length; index += 1) {
    matrix[0][index] = index;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function scoreCatalogMatch(query: string, medication: CatalogMedication) {
  const normalizedQuery = normalizeMedicationText(query);
  const variants = [medication.name, ...(medication.aliases ?? [])].map(normalizeMedicationText);

  for (const variant of variants) {
    if (variant === normalizedQuery) {
      return { score: 1, matchedBy: "exact" as const };
    }

    if (variant.includes(normalizedQuery) || normalizedQuery.includes(variant)) {
      return { score: 0.9, matchedBy: "contains" as const };
    }
  }

  let bestScore = 0;
  for (const variant of variants) {
    const distance = levenshteinDistance(normalizedQuery, variant);
    const maxLength = Math.max(normalizedQuery.length, variant.length);
    const similarity = maxLength > 0 ? 1 - distance / maxLength : 0;
    if (similarity > bestScore) {
      bestScore = similarity;
    }
  }

  return { score: bestScore, matchedBy: "fuzzy" as const };
}

async function searchConfiguredCatalog(
  practice: Pick<Practice, "catalogSource" | "catalogApiBaseUrl" | "pmsApiBaseUrl" | "pmsApiKeySecret">,
  query: string,
) {
  const baseUrl =
    practice.catalogSource === CatalogSource.PMS_CATALOG ? practice.pmsApiBaseUrl : practice.catalogApiBaseUrl;

  if (!baseUrl) {
    return null;
  }

  try {
    const searchUrl = new URL("/medications/search", baseUrl);
    searchUrl.searchParams.set("q", query);

    const headers: Record<string, string> = {};
    if (practice.catalogSource === CatalogSource.PMS_CATALOG && practice.pmsApiKeySecret) {
      headers.Authorization = `Bearer ${practice.pmsApiKeySecret}`;
    }

    const response = await fetch(searchUrl, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      items?: Array<{
        name?: string;
        strength?: string;
        pzn?: string;
      }>;
    };

    const first = payload.items?.[0];
    if (!first?.name) {
      return null;
    }

    return {
      medicationName: first.name,
      medicationStrength: first.strength ?? "",
      medicationPzn: first.pzn ?? "",
      source: practice.catalogSource === CatalogSource.PMS_CATALOG ? "PMS_CATALOG" : "EXTERNAL_API",
      confidence: "high" as const,
      matchedBy: "exact" as const,
    };
  } catch {
    return null;
  }
}

export async function resolveMedicationFromText(
  practice: Pick<Practice, "catalogSource" | "catalogApiBaseUrl" | "pmsApiBaseUrl" | "pmsApiKeySecret">,
  inputText: string,
) {
  const parsed = parsePrescriptionText(inputText);
  const medicationQuery = parsed.medicationName.trim();

  if (!medicationQuery) {
    return {
      parsed,
      suggestion: null,
    };
  }

  const configuredMatch = await searchConfiguredCatalog(practice, medicationQuery);
  if (configuredMatch) {
    return {
      parsed,
      suggestion: configuredMatch,
    };
  }

  const scoredMatches = demoCatalog
    .map((entry) => ({
      entry,
      ...scoreCatalogMatch(medicationQuery, entry),
    }))
    .sort((left, right) => right.score - left.score);

  const best = scoredMatches[0];

  if (best && best.score >= 0.72) {
    return {
      parsed,
      suggestion: {
        medicationName: best.entry.name,
        medicationStrength: parsed.dosage ? `${parsed.dosage}${best.entry.strength ? ` · ${best.entry.strength}` : ""}` : best.entry.strength,
        medicationPzn: best.entry.pzn,
        source: "DEMO_CATALOG" as const,
        confidence: best.score >= 0.9 ? "high" : "medium",
        matchedBy: best.matchedBy,
      },
    };
  }

  return {
    parsed,
    suggestion: {
      medicationName: parsed.medicationName,
      medicationStrength: parsed.dosage || parsed.form || "",
      medicationPzn: "",
      source: "TEXT_PARSE" as const,
      confidence: "low" as const,
      matchedBy: "parse_only" as const,
    },
  };
}
