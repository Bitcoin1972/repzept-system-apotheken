export type DemoProduct = {
  id: string;
  productName: string;
  manufacturer: string;
  dosage: string;
  form: string;
  pzn: string;
};

export const demoProducts: DemoProduct[] = [
  {
    id: "ibu-600-hexal-filmtabletten",
    productName: "Ibuprofen 600",
    manufacturer: "Hexal",
    dosage: "600 mg",
    form: "Filmtabletten",
    pzn: "01234567",
  },
  {
    id: "ibu-400-ratiopharm-filmtabletten",
    productName: "Ibuprofen 400",
    manufacturer: "ratiopharm",
    dosage: "400 mg",
    form: "Filmtabletten",
    pzn: "02345678",
  },
  {
    id: "amoxi-1000-stada-tabletten",
    productName: "Amoxicillin 1000",
    manufacturer: "STADA",
    dosage: "1000 mg",
    form: "Tabletten",
    pzn: "03456789",
  },
  {
    id: "pantoprazol-40-1a-tabletten",
    productName: "Pantoprazol 40",
    manufacturer: "1A Pharma",
    dosage: "40 mg",
    form: "Tabletten",
    pzn: "04567890",
  },
  {
    id: "salbutamol-al-spray",
    productName: "Salbutamol AL",
    manufacturer: "ALIUD",
    dosage: "100 mcg",
    form: "Dosieraerosol",
    pzn: "05678901",
  },
];
