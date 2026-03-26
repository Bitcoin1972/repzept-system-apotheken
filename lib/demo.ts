import { PharmacyResponseStatus } from "@prisma/client";

export function buildDemoResponses() {
  return [
    {
      pharmacyName: "Stadt-Apotheke",
      responseStatus: PharmacyResponseStatus.AVAILABLE,
      message: "sofort abholbereit",
    },
    {
      pharmacyName: "Rosen-Apotheke",
      responseStatus: PharmacyResponseStatus.ORDERABLE,
      message: "in 2 Stunden",
    },
    {
      pharmacyName: "Markt-Apotheke",
      responseStatus: PharmacyResponseStatus.UNAVAILABLE,
      message: "heute nicht verfuegbar",
    },
  ];
}
