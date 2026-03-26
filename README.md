# Repzept Praxis-Copilot

Minimaler Next.js-Monolith fuer den angeforderten Praxis-Copilot:

- `/practice/new` als Copilot-Maske mit `Standard` und `Rezeptmodus`
- Rezeptmodus mit Sprachaufnahme-Button, editierbarem Diktat, Live-Parsing und Demo-Modus
- lokale Demo-Produktsuche mit Herstellerfilter und konkreter Produktauswahl
- REST-API zum Speichern eines Requests
- Prisma-Datenmodell fuer `Request` und `PharmacyResponse`
- Detailansicht mit direkten simulierten Apotheken-Antworten nach der Freigabe

## Betroffene Dateien

- `package.json`
- `prisma/schema.prisma`
- `lib/prisma.ts`
- `lib/parsing.ts`
- `lib/demo.ts`
- `lib/demo-products.ts`
- `app/layout.tsx`
- `app/globals.css`
- `app/page.tsx`
- `app/practice/new/page.tsx`
- `app/practice/new/PracticeComposer.tsx`
- `app/practice/requests/[id]/page.tsx`
- `app/api/requests/route.ts`
- `app/api/requests/[id]/route.ts`

## Annahmen

- `DATABASE_URL` zeigt auf eine bestehende PostgreSQL-Datenbank.
- Browser-Spracheingabe nutzt `SpeechRecognition` oder `webkitSpeechRecognition`, sonst bleibt nur die manuelle Eingabe.
- Eine eigenstaendige Copilot-UI war im Workspace nicht vorhanden; die vorhandene Eingabemaske wurde deshalb zur Copilot-Maske erweitert.
- Demo-Modus erzeugt immer drei simulierte Antworten, damit die Detailansicht direkt sichtbar befuellt ist.
- Die Produktauswahl nutzt nur eine lokale Demo-Arzneiliste im Code, keine externe Arzneidatenbank.
- Ohne Demo-Modus wird nur der Request gespeichert, aber keine echte Integration angestossen.

## Start

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Oder kompakt:

```bash
cp .env.example .env
npm run start:local
```
