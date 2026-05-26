export function buildDemoResponses() {
  return [
    {
      pharmacyName: "Stadt-Apotheke",
      responseStatus: "AVAILABLE",
      message: "sofort abholbereit",
    },
    {
      pharmacyName: "Rosen-Apotheke",
      responseStatus: "ORDERABLE",
      message: "in 2 Stunden",
    },
    {
      pharmacyName: "Markt-Apotheke",
      responseStatus: "UNAVAILABLE",
      message: "heute nicht verfuegbar",
    },
  ];
}
