import { CatalogSource, type Practice } from "@prisma/client";

export function describeCatalogStrategy(practice: Pick<Practice, "catalogSource" | "pmsSystemLabel">) {
  if (practice.catalogSource === CatalogSource.PMS_CATALOG) {
    return {
      source: "PMS",
      description: `${practice.pmsSystemLabel ?? "Praxis-PMS"} liefert den Medikamentenkatalog nur lokal fuer den Rezeptfluss.`,
    };
  }

  return {
    source: "External API",
    description: "Externer Arzneimittelkatalog als Fallback, wenn das PMS keinen eigenen Katalog liefert.",
  };
}
