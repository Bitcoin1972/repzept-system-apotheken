"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parsePrescriptionText } from "@/lib/parsing";
import { demoProducts } from "@/lib/demo-products";

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
    SpeechRecognition?: new () => SpeechRecognition;
  }
}

type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionResult = {
  length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

const todayValue = () => new Date().toISOString().slice(0, 10);

const titleizePrescriptionType = (value: "RED" | "GREEN") =>
  value === "RED" ? "Rotes Rezept" : "Gruenes Rezept";

export function PracticeComposer() {
  const router = useRouter();
  const [doctorName, setDoctorName] = useState("Dr. med. Beispiel");
  const [insuranceProvider, setInsuranceProvider] = useState("AOK Nordost");
  const [prescriptionType, setPrescriptionType] = useState<"RED" | "GREEN">("RED");
  const [issuedAt, setIssuedAt] = useState(todayValue());
  const [text, setText] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [manualManufacturer, setManualManufacturer] = useState("");
  const [manualPzn, setManualPzn] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [isDatabaseOpen, setIsDatabaseOpen] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const parsed = useMemo(() => parsePrescriptionText(text), [text]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return demoProducts.filter((product) => {
      if (!normalizedSearch) {
        return true;
      }

      return [product.productName, product.manufacturer, product.dosage, product.form, product.pzn]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [searchTerm]);

  const autoMatchedProduct = useMemo(() => {
    if (!parsed.medicationName && !parsed.dosage) {
      return null;
    }

    const normalizedMedication = parsed.medicationName.toLowerCase();
    const normalizedDosage = parsed.dosage.toLowerCase();

    return (
      demoProducts.find((product) => {
        const haystack = [
          product.productName,
          product.manufacturer,
          product.dosage,
          product.form,
          product.pzn,
        ]
          .join(" ")
          .toLowerCase();

        const medicationMatch =
          !normalizedMedication || haystack.includes(normalizedMedication);
        const dosageMatch = !normalizedDosage || haystack.includes(normalizedDosage);

        return medicationMatch && dosageMatch;
      }) ?? null
    );
  }, [parsed.dosage, parsed.medicationName]);

  const selectedProduct = useMemo(() => {
    if (selectedProductId) {
      return demoProducts.find((product) => product.id === selectedProductId) ?? null;
    }

    return autoMatchedProduct;
  }, [autoMatchedProduct, selectedProductId]);

  const summary = useMemo(() => {
    return [
      parsed.patientReference,
      selectedProduct?.productName || parsed.medicationName,
      selectedProduct?.dosage || parsed.dosage,
      parsed.quantity,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [parsed.dosage, parsed.medicationName, parsed.patientReference, parsed.quantity, selectedProduct]);

  const preview = useMemo(() => {
    return {
      patientReference: parsed.patientReference,
      medicationName: selectedProduct?.productName || parsed.medicationName,
      productName: selectedProduct?.productName || "",
      manufacturer: selectedProduct?.manufacturer || manualManufacturer,
      dosage: selectedProduct?.dosage || parsed.dosage,
      form: selectedProduct?.form || parsed.form,
      pzn: selectedProduct?.pzn || manualPzn,
      quantity: parsed.quantity,
    };
  }, [manualManufacturer, manualPzn, parsed, selectedProduct]);

  useEffect(() => {
    setSpeechAvailable(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));

    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      setManualManufacturer(selectedProduct.manufacturer);
      setManualPzn(selectedProduct.pzn);
    }
  }, [selectedProduct]);

  const toggleSpeech = () => {
    setError("");

    if (!speechAvailable) {
      setError("Spracherkennung ist im Browser nicht verfuegbar. Bitte Text manuell eingeben.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      setError("Spracherkennung ist im Browser nicht verfuegbar. Bitte Text manuell eingeben.");
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => {
        return event.results[index][0]?.transcript ?? "";
      }).join(" ");

      setText(transcript.trim());
    };

    recognition.onerror = () => {
      setError("Spracherkennung konnte nicht gestartet werden. Bitte Text manuell eingeben.");
      setIsListening(false);
      recognitionRef.current = null;
      recognition.stop();
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
    setIsListening(true);
  };

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError("Bitte erst eine Verordnung diktieren oder eingeben.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcription: text,
          demoMode,
          patientReference: preview.patientReference,
          productName: preview.productName,
          manufacturer: preview.manufacturer,
          dosage: preview.dosage,
          form: preview.form,
          pzn: preview.pzn,
          quantity: preview.quantity,
          doctorName,
          insuranceProvider,
          prescriptionType,
          issuedAt,
          summary,
          medicationSource: selectedProductId ? "database-window" : autoMatchedProduct ? "speech-auto-match" : "speech-only",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Request konnte nicht gespeichert werden.");
      }

      const data = (await response.json()) as { id: string };
      router.push(`/practice/requests/${data.id}`);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unbekannter Fehler beim Freigeben.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="stack">
      <section className="hero-card">
        <p className="hero-kicker">Praxis Orga / E-Rezept</p>
        <h1 className="hero-title">Spracherfassung, Vorschau, Freigabe</h1>
        <p className="hero-copy">
          Die Ansicht bleibt auf drei Bereiche reduziert: Spracheingabe, Output und Rezeptvorschau.
          Produktdetails werden automatisch im Hintergrund uebernommen oder gezielt ueber das Auswahlfenster gesetzt.
        </p>
      </section>

      <section className="panel stack dashboard-input-panel">
        <div className="row">
          <div>
            <h2>Eingabe Sprache</h2>
            <p className="helper-text">Diktat aufnehmen oder Text direkt eingeben. Die Verarbeitung laeuft im Hintergrund.</p>
          </div>
          <button className="microphone-button" type="button" onClick={toggleSpeech}>
            {isListening ? "Aufnahme stoppen" : "Aufnahme starten"}
          </button>
        </div>

        {!speechAvailable ? (
          <p className="helper-text">
            Dieser Browser unterstuetzt keine SpeechRecognition. Die manuelle Eingabe bleibt
            verfuegbar.
          </p>
        ) : null}

        <div>
          <label className="field-label" htmlFor="transcription">
            Verordnung / Diktat
          </label>
          <textarea
            id="transcription"
            className="textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Zum Beispiel: Max Mueller, Ibuprofen 600, 2 Packungen, Filmtabletten, bei Bedarf 1-0-1"
          />
        </div>
      </section>

      <section className="panel stack dashboard-output-panel">
        <div className="row">
          <div>
            <h2>Output</h2>
            <p className="helper-text">Erkanntes Ergebnis und Quelle der Produktdaten.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setIsDatabaseOpen(true)}
          >
            Medikament auswaehlen
          </button>
        </div>

        <section className="summary-strip">
          <span className="summary-strip-label">Automatische Zusammenfassung</span>
          <strong>{summary || "Noch keine strukturierte Zusammenfassung vorhanden."}</strong>
        </section>

        <dl className="output-grid">
          <div className="preview-item">
            <dt>Patient</dt>
            <dd>{preview.patientReference || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Medikament</dt>
            <dd>{preview.medicationName || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Dosierung</dt>
            <dd>{preview.dosage || "-"}</dd>
          </div>
          <div className="preview-item">
            <dt>Quelle</dt>
            <dd>{selectedProductId ? "Datenbankfenster" : autoMatchedProduct ? "Automatischer Treffer" : "Nur Spracheingabe"}</dd>
          </div>
        </dl>
      </section>

      {isDatabaseOpen ? (
        <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Medikamentendatenbank">
          <div className="modal-card">
            <div className="row">
              <div>
                <p className="hero-kicker">Medikamentendatenbank</p>
                <h2 className="modal-title">Suche oeffnen und uebernehmen</h2>
              </div>
              <button className="secondary-button" type="button" onClick={() => setIsDatabaseOpen(false)}>
                Schliessen
              </button>
            </div>

            <div>
              <label className="field-label" htmlFor="product-search">
                Wirkstoff, Produkt oder PZN suchen
              </label>
              <input
                id="product-search"
                className="text-input"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Ibuprofen, PZN oder Hersteller"
              />
            </div>

            <div className="product-list modal-product-list">
              {filteredProducts.map((product) => {
                const isSelected = selectedProduct?.id === product.id;

                return (
                  <button
                    key={product.id}
                    type="button"
                    className={isSelected ? "product-card product-card-selected" : "product-card"}
                    onClick={() => {
                      setSelectedProductId(product.id);
                      setIsDatabaseOpen(false);
                    }}
                  >
                    <strong>{product.productName}</strong>
                    <span>{product.manufacturer}</span>
                    <span>
                      {product.dosage} · {product.form}
                    </span>
                    <span>PZN {product.pzn}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel stack print-hidden dashboard-preview-panel">
        <div className="row">
          <div>
            <h2>Rezeptvorschau</h2>
            <p className="helper-text">Die Vorschau zeigt den Datensatz, der bei Freigabe gespeichert wird.</p>
          </div>
          <button className="secondary-button" type="button" disabled={!text.trim()} onClick={handlePrint}>
            Rezept drucken
          </button>
        </div>

        <article
          className={`prescription-card printable-prescription prescription-card-${prescriptionType.toLowerCase()}`}
        >
          <header className="prescription-card-header">
            <div>
              <p className="prescription-card-kicker">{titleizePrescriptionType(prescriptionType)}</p>
              <h3>Freigabesigniert von {doctorName || "Dr. ..."}</h3>
              <p className="prescription-card-subtitle">
                Apothekensicht: signierter Rezeptdatensatz mit uebernommenen Medikamentendaten.
              </p>
            </div>
            <div className="prescription-card-badge">
              <span>Signatur bereit</span>
            </div>
          </header>

          <div className="prescription-card-stat-grid">
            <div className="prescription-card-stat">
              <span>Patient</span>
              <strong>{preview.patientReference || "Offen"}</strong>
              <small>Empfaenger der Verordnung</small>
            </div>
            <div className="prescription-card-stat">
              <span>Krankenkasse</span>
              <strong>{insuranceProvider || "Offen"}</strong>
              <small>Rabatt- und Kostentraegerlogik spaeter anschliessbar</small>
            </div>
            <div className="prescription-card-stat">
              <span>Datum</span>
              <strong>{issuedAt || todayValue()}</strong>
              <small>Ausstellungsdatum des Rezepts</small>
            </div>
            <div className="prescription-card-stat">
              <span>Signaturstatus</span>
              <strong>SIGNIERT</strong>
              <small>Wird bei Freigabe mit Arztbezug gespeichert</small>
            </div>
          </div>

          <div className="prescription-card-grid">
            <div className="prescription-card-field prescription-card-field-highlight prescription-card-field-wide">
              <span>Verordnender Arzt</span>
              <strong>{doctorName || "Nicht angegeben"}</strong>
            </div>
            <div className="prescription-card-field">
              <span>Medikament</span>
              <strong>{preview.medicationName || "Nicht erkannt"}</strong>
            </div>
            <div className="prescription-card-field">
              <span>Produkt</span>
              <strong>{preview.productName || "Nicht aus Datenbank uebernommen"}</strong>
            </div>
            <div className="prescription-card-field">
              <span>Dosierung</span>
              <strong>{preview.dosage || "Offen"}</strong>
            </div>
            <div className="prescription-card-field">
              <span>Menge</span>
              <strong>{preview.quantity || "Offen"}</strong>
            </div>
            <div className="prescription-card-field">
              <span>Darreichung</span>
              <strong>{preview.form || "Offen"}</strong>
            </div>
            <div className="prescription-card-field">
              <span>Hersteller</span>
              <strong>{preview.manufacturer || "Offen"}</strong>
            </div>
            <div className="prescription-card-field">
              <span>PZN</span>
              <strong>{preview.pzn || "Offen"}</strong>
            </div>
          </div>

          <section className="prescription-card-note prescription-card-note-emphasis">
            <span>Diktat / Verordnungszusammenfassung</span>
            <p>{text.trim() || "Noch kein Rezepttext vorhanden."}</p>
          </section>

          <footer className="prescription-card-footer">
            <span>Systemstatus: an Apotheke freigabesigniert uebergabefaehig</span>
            <span>Quelle: {selectedProductId ? "Medikamentendatenbank" : autoMatchedProduct ? "Automatischer Datenbanktreffer" : "Diktat ohne Match"}</span>
          </footer>
        </article>
      </section>

      <section className="panel stack">
        {error ? <p className="error-text">{error}</p> : null}
        <div className="row">
          <p className="helper-text">
            Beim Freigeben wird der Datensatz signiert gespeichert. Die weiteren Schritte laufen danach ohne zusaetzliche Eingaben weiter.
          </p>
          <button
            className="primary-button"
            type="button"
            disabled={!text.trim() || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Wird freigegeben..." : "Freigeben"}
          </button>
        </div>
      </section>
    </div>
  );
}
