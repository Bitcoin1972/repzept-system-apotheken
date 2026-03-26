export type ParsedPrescription = {
  patientReference: string;
  medicationName: string;
  dosage: string;
  quantity: string;
  form: string;
};

const dosagePattern = /\b(\d+(?:[.,]\d+)?)\s*(mg|g|ml|mcg|µg)?\b/i;
const quantityPattern =
  /\b(\d+\s*(?:Packungen|Packung|Stk|Stück|Tabletten|Kapseln|Flaschen|Tuben))\b/i;
const formPattern =
  /\b(Tabletten|Filmtabletten|Kapseln|Saft|Tropfen|Dosieraerosol|Creme|Salbe)\b/i;

const normalizeChunk = (value: string) => value.replace(/\s+/g, " ").trim();

export function parsePrescriptionText(input: string): ParsedPrescription {
  const text = normalizeChunk(input);

  if (!text) {
    return {
      patientReference: "",
      medicationName: "",
      dosage: "",
      quantity: "",
      form: "",
    };
  }

  const segments = text
    .split(",")
    .map((segment) => normalizeChunk(segment))
    .filter(Boolean);

  const patientReference = segments[0] ?? "";
  const quantityMatch = text.match(quantityPattern);
  const dosageMatch = text.match(dosagePattern);
  const formMatch = text.match(formPattern);

  let medicationName = segments[1] ?? "";

  if (!medicationName && segments.length > 1) {
    medicationName = segments.slice(1).join(" ");
  }

  if (medicationName && dosageMatch) {
    medicationName = medicationName.replace(dosageMatch[0], "").trim();
  }

  if (medicationName && formMatch) {
    medicationName = medicationName.replace(formMatch[0], "").trim();
  }

  if (!medicationName && segments.length >= 2) {
    medicationName = segments[1].split(/\s+/).slice(0, 2).join(" ").trim();
  }

  if (!medicationName) {
    const withoutPatient = text.replace(patientReference, "").replace(/^,\s*/, "");
    medicationName = withoutPatient.replace(quantityPattern, "").replace(dosagePattern, "").trim();
    medicationName = medicationName.replace(formPattern, "").trim();
  }

  return {
    patientReference,
    medicationName,
    dosage: dosageMatch ? dosageMatch[0].trim() : "",
    quantity: quantityMatch ? quantityMatch[0].trim() : "",
    form: formMatch ? formMatch[0].trim() : "",
  };
}
