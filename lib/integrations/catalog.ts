import { CatalogSource, type Practice } from "@prisma/client";

export function describeCatalogStrategy(
  practice: Pick<
    Practice,
    "catalogSource" | "pmsSystemLabel" | "catalogProviderLabel" | "catalogApiBaseUrl"
  >,
) {
  if (practice.catalogSource === CatalogSource.PMS_CATALOG) {
    return {
      source: "PMS",
      description: `${practice.pmsSystemLabel ?? "Praxis-PMS"} liefert den Medikamentenkatalog nur lokal fuer den Rezeptfluss.`,
    };
  }

  return {
    source: practice.catalogProviderLabel ?? "External API",
    description: `${
      practice.catalogApiBaseUrl ?? "Externer Arzneimittelkatalog"
    } ist als getrennte Quelle hinterlegt, wenn das PMS keinen eigenen Katalog liefert.`,
  };
}
