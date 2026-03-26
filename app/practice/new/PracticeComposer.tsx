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

export function PracticeComposer() {
  const router = useRouter();
  const [mode, setMode] = useState<"standard" | "prescription">("prescription");
  const [text, setText] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [manualManufacturer, setManualManufacturer] = useState("");
  const [manualPzn, setManualPzn] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const parsed = useMemo(() => parsePrescriptionText(text), [text]);
  const manufacturers = useMemo(() => {
    return Array.from(new Set(demoProducts.map((product) => product.manufacturer))).sort();
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return demoProducts.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        [product.productName, product.manufacturer, product.dosage, product.form, product.pzn]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesManufacturer =
        !selectedManufacturer || product.manufacturer === selectedManufacturer;

      return matchesSearch && matchesManufacturer;
    });
  }, [searchTerm, selectedManufacturer]);

  const selectedProduct = useMemo(() => {
    return demoProducts.find((product) => product.id === selectedProductId) ?? null;
  }, [selectedProductId]);

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

  const previewFieldCount = useMemo(() => {
    return [
      preview.patientReference,
      preview.medicationName,
      preview.productName,
      preview.manufacturer,
      preview.dosage,
      preview.form,
      preview.pzn,
      preview.quantity,
    ].filter(Boolean).length;
  }, [preview]);

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
    if (mode !== "prescription") {
      setError("Freigeben ist nur im Rezeptmodus verfuegbar.");
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
          productName: preview.productName,
          manufacturer: preview.manufacturer,
          dosage: preview.dosage,
          form: preview.form,
          pzn: preview.pzn,
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
        <p className="hero-kicker">Praxis Copilot</p>
        <h1 className="hero-title">Diktat aufnehmen oder schreiben und als Rezeptentwurf pruefen</h1>
        <p className="hero-copy">
          Im Rezeptmodus wird Sprache oder Texteingabe als Rezeptdiktat interpretiert. Die
          Vorschau bleibt editierbar und kann vor der Freigabe gezielt verfeinert werden.
        </p>
      </section>

      <section className="dashboard-stat-grid">
        <article className="dashboard-stat-card">
          <p className="dashboard-stat-kicker">Modus</p>
          <strong>{mode === "prescription" ? "Rezeptmodus" : "Standard"}</strong>
          <span>{mode === "prescription" ? "Strukturierter Entwurf aktiv" : "Freitext ohne Rezeptlogik"}</span>
        </article>
        <article className="dashboard-stat-card">
          <p className="dashboard-stat-kicker">Rezeptfelder</p>
          <strong>{previewFieldCount}/8</strong>
          <span>Live aus Diktat und Produktauswahl befuellt</span>
        </article>
        <article className="dashboard-stat-card">
          <p className="dashboard-stat-kicker">Produktstatus</p>
          <strong>{selectedProduct ? "Ausgewaehlt" : "Offen"}</strong>
          <span>{selectedProduct ? selectedProduct.productName : "Noch kein Demo-Produkt gesetzt"}</span>
        </article>
        <article className="dashboard-stat-card">
          <p className="dashboard-stat-kicker">Druckansicht</p>
          <strong>{text.trim() ? "Bereit" : "Warte"}</strong>
          <span>{text.trim() ? "Vorschau kann direkt gedruckt werden" : "Bitte zuerst Rezepttext eingeben"}</span>
        </article>
      </section>

      <section className="panel stack dashboard-focus-panel">
        <div className="row">
          <div>
            <p className="hero-kicker">Rezeptstatus</p>
            <h2 className="dashboard-focus-title">Wie belastbar ist der aktuelle Rezeptentwurf?</h2>
          </div>
          <span className="dashboard-health-pill">
            {previewFieldCount >= 6 ? "Stabil" : previewFieldCount >= 3 ? "In Arbeit" : "Rohentwurf"}
          </span>
        </div>
        <div className="dashboard-focus-score">
          <strong>{Math.round((previewFieldCount / 8) * 100)}/100</strong>
          <p>
            {previewFieldCount >= 6
              ? "Der Entwurf ist weitgehend befuellt und bereit fuer Sichtpruefung oder Ausdruck."
              : "Es fehlen noch strukturierte Angaben fuer einen vollstaendigen Rezeptentwurf."}
          </p>
        </div>
        <ul className="dashboard-focus-list">
          <li>Produktsuche kann Hersteller, Form und PZN direkt in den Entwurf uebernehmen.</li>
          <li>Die Live-Vorschau reagiert sofort auf Diktat, Freitext und manuelle Korrekturen.</li>
          <li>Vor Freigabe oder Ausdruck sollte die fachliche Plausibilitaet geprueft werden.</li>
        </ul>
      </section>

      <section className="panel stack dashboard-input-panel">
        <div className="mode-switch" role="tablist" aria-label="Modus">
          <button
            type="button"
            className={mode === "standard" ? "mode-button mode-button-active" : "mode-button"}
            onClick={() => setMode("standard")}
          >
            Standard
          </button>
          <button
            type="button"
            className={
              mode === "prescription" ? "mode-button mode-button-active" : "mode-button"
            }
            onClick={() => setMode("prescription")}
          >
            Rezeptmodus
          </button>
        </div>

        <div className="row">
          <button className="microphone-button" type="button" onClick={toggleSpeech}>
            {isListening ? "Sprachaufnahme stoppen" : "Sprachaufnahme starten"}
          </button>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(event) => setDemoMode(event.target.checked)}
            />
            Demo-Modus
          </label>
        </div>

        {!speechAvailable ? (
          <p className="helper-text">
            Dieser Browser unterstuetzt keine SpeechRecognition. Die manuelle Texteingabe
            bleibt verfuegbar.
          </p>
        ) : null}

        <div>
          <label className="field-label" htmlFor="transcription">
            {mode === "prescription"
              ? "Rezeptdiktat oder manuell angepasster Text"
              : "Standard-Eingabe"}
          </label>
          <textarea
            id="transcription"
            ref={textAreaRef}
            className="textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              mode === "prescription"
                ? "Zum Beispiel: Mueller, Ibuprofen 600, 2 Packungen, Tabletten"
                : "Freitext fuer den Standardmodus"
            }
          />
        </div>

        {mode === "standard" ? (
          <p className="helper-text">
            Der Standardmodus bleibt eine einfache Copilot-Eingabe. Rezeptentwurf,
            Produktauswahl und Freigabe sind nur im Rezeptmodus aktiv.
          </p>
        ) : null}
      </section>

      {mode === "prescription" ? (
        <section className="panel stack dashboard-product-panel">
          <div className="row">
            <h2>Strukturierte Produktauswahl</h2>
            <span className="status-pill">Demo-Arzneiliste</span>
          </div>

          <div className="search-grid">
            <div>
              <label className="field-label" htmlFor="product-search">
                Medikament suchen
              </label>
              <input
                id="product-search"
                className="text-input"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Zum Beispiel Ibuprofen"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="manufacturer-filter">
                Hersteller optional auswaehlen
              </label>
              <select
                id="manufacturer-filter"
                className="text-input"
                value={selectedManufacturer}
                onChange={(event) => setSelectedManufacturer(event.target.value)}
              >
                <option value="">Alle Hersteller</option>
                {manufacturers.map((manufacturer) => (
                  <option key={manufacturer} value={manufacturer}>
                    {manufacturer}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="product-list">
            {filteredProducts.map((product) => {
              const isSelected = product.id === selectedProductId;

              return (
                <button
                  key={product.id}
                  type="button"
                  className={isSelected ? "product-card product-card-selected" : "product-card"}
                  onClick={() => setSelectedProductId(product.id)}
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

            {!filteredProducts.length ? (
              <p className="helper-text">
                Keine Demo-Produkte gefunden. Die Freigabe bleibt auch nur mit Diktat und
                manueller Korrektur moeglich.
              </p>
            ) : null}
          </div>

          <div className="search-grid">
            <div>
              <label className="field-label" htmlFor="manual-manufacturer">
                manufacturer optional
              </label>
              <input
                id="manual-manufacturer"
                className="text-input"
                type="text"
                value={manualManufacturer}
                onChange={(event) => setManualManufacturer(event.target.value)}
                placeholder="Zum Beispiel Hexal"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="manual-pzn">
                pzn optional
              </label>
              <input
                id="manual-pzn"
                className="text-input"
                type="text"
                value={manualPzn}
                onChange={(event) => setManualPzn(event.target.value)}
                placeholder="Zum Beispiel 01234567"
              />
            </div>
          </div>

          {selectedProduct ? (
            <div className="row">
              <p className="helper-text">
                Die Produktauswahl uebernimmt `productName`, `manufacturer`, `dosage`, `form`
                und `pzn` in den Rezeptentwurf.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedProductId("")}
              >
                Produktauswahl loesen
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {mode === "prescription" ? (
        <section className="panel stack dashboard-data-panel">
          <div className="row">
            <h2>Rezeptentwurf</h2>
            <span className="status-pill">Live geparst</span>
          </div>
          <dl className="preview-grid">
            <div className="preview-item">
              <dt>patientReference</dt>
              <dd>{preview.patientReference || "-"}</dd>
            </div>
            <div className="preview-item">
              <dt>medicationName</dt>
              <dd>{preview.medicationName || "-"}</dd>
            </div>
            <div className="preview-item">
              <dt>dosage</dt>
              <dd>{preview.dosage || "-"}</dd>
            </div>
            <div className="preview-item">
              <dt>quantity</dt>
              <dd>{preview.quantity || "-"}</dd>
            </div>
            <div className="preview-item">
              <dt>form</dt>
              <dd>{preview.form || "-"}</dd>
            </div>
            <div className="preview-item">
              <dt>manufacturer</dt>
              <dd>{preview.manufacturer || "-"}</dd>
            </div>
            <div className="preview-item">
              <dt>pzn</dt>
              <dd>{preview.pzn || "-"}</dd>
            </div>
            <div className="preview-item">
              <dt>productName</dt>
              <dd>{preview.productName || "-"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {mode === "prescription" ? (
        <section className="panel stack print-hidden dashboard-preview-panel">
          <div className="row">
            <div>
              <h2>Rezeptvorschau</h2>
              <p className="helper-text">
                Live-Karte fuer Sichtpruefung und Ausdruck direkt aus dem Browser.
              </p>
            </div>
            <button
              className="secondary-button"
              type="button"
              disabled={!text.trim()}
              onClick={handlePrint}
            >
              Vorschau drucken
            </button>
          </div>

          <article className="prescription-card printable-prescription">
            <header className="prescription-card-header">
              <div>
                <p className="prescription-card-kicker">Rezeptvorschau</p>
                <h3>Praxis Rezeptentwurf</h3>
                <p className="prescription-card-subtitle">
                  Live aus Diktat, Produktauswahl und manueller Korrektur aufgebaut.
                </p>
              </div>
              <div className="prescription-card-badge">
                <span>{demoMode ? "Demo" : "Live"}</span>
              </div>
            </header>

            <div className="prescription-card-stat-grid">
              <div className="prescription-card-stat">
                <span>Patient</span>
                <strong>{preview.patientReference || "Offen"}</strong>
                <small>Patientenbezug im Diktat</small>
              </div>
              <div className="prescription-card-stat">
                <span>Dosierung</span>
                <strong>{preview.dosage || "Offen"}</strong>
                <small>Automatisch erkannt oder manuell</small>
              </div>
              <div className="prescription-card-stat">
                <span>PZN</span>
                <strong>{preview.pzn || "Offen"}</strong>
                <small>Aus Produktwahl oder manueller Eingabe</small>
              </div>
              <div className="prescription-card-stat">
                <span>Status</span>
                <strong>{text.trim() ? "Vorschau bereit" : "Warte auf Text"}</strong>
                <small>Vor dem Versand fachlich pruefen</small>
              </div>
            </div>

            <div className="prescription-card-grid">
              <div className="prescription-card-field prescription-card-field-highlight prescription-card-field-wide">
                <span>Patient</span>
                <strong>{preview.patientReference || "Nicht angegeben"}</strong>
              </div>
              <div className="prescription-card-field">
                <span>Medikament</span>
                <strong>{preview.medicationName || "Nicht erkannt"}</strong>
              </div>
              <div className="prescription-card-field">
                <span>Produkt</span>
                <strong>{preview.productName || "Nicht ausgewaehlt"}</strong>
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
              <span>Freitext aus dem Diktat</span>
              <p>{text.trim() || "Noch kein Rezepttext vorhanden."}</p>
            </section>

            <footer className="prescription-card-footer">
              <span>Praxis Copilot</span>
              <span>Vor dem Versand fachlich pruefen</span>
            </footer>
          </article>
        </section>
      ) : null}

      <section className="panel stack">
        {error ? <p className="error-text">{error}</p> : null}
        <div className="row">
          <p className="helper-text">
            {mode === "prescription"
              ? "Im Rezeptmodus kannst du den Entwurf korrigieren oder direkt als RELEASED freigeben."
              : "Wechsle in den Rezeptmodus, um aus dem Diktat einen strukturierten Entwurf zu erzeugen."}
          </p>
          <div className="action-row">
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                textAreaRef.current?.focus();
                setError("");
              }}
            >
              Korrigieren
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={mode !== "prescription" || !text.trim() || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? "Wird freigegeben..." : "Freigeben"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
