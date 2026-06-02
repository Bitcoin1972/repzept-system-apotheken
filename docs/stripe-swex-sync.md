# Stripe zu SWEX Tower

## Ausloesende Stripe-Events
- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.created`
- `customer.subscription.updated`
- `payment_intent.succeeded`

## Verarbeitungslogik
- `checkout.session.completed`: erzeugt Customer + Sale, wenn Checkout erfolgreich abgeschlossen ist.
- `invoice.paid`: erzeugt Customer + Sale fuer bezahlte Rechnungen, besonders relevant fuer wiederkehrende Monatsabrechnung.
- `customer.subscription.created` / `customer.subscription.updated`: synchronisiert aktive Subscriptions in den Tower. Wenn kein spaeteres `invoice.paid` vorliegt, wird der Aktivierungsverkauf ueber die Subscription erzeugt.
- `payment_intent.succeeded`: Fallback fuer einmalige Zahlungen ohne Checkout-/Invoice-Pfad.

## Projektauflösung
- Die SWEX `projectId` wird ueber [app/api/external/catalog/route.ts](/Users/joergmolt/Documents/Repzept%20System%20Apotheken/app/api/external/catalog/route.ts) bzw. [lib/external-catalog.ts](/Users/joergmolt/Documents/Repzept%20System%20Apotheken/lib/external-catalog.ts) aufgeloest.
- Reihenfolge:
  1. `Practice.swexTenantRef`
  2. `PharmacyAccount.swexTenantRef`
  3. `SWEX_DEFAULT_PROJECT_ID`

## Verwendete SWEX Tower Endpunkte
- Stripe-/Checkout-Ingest: `POST {SWEX_TOWER_BASE_URL}{SWEX_STRIPE_INGEST_PATH}`
- AI-/Support-Ingest: `POST {SWEX_TOWER_BASE_URL}{SWEX_SUPPORT_INGEST_PATH}`

Standardpfade:
- `/api/ingest/stripe-order`
- `/api/ingest/ai-support-ticket`

Authentifizierung:
- Stripe-/Checkout-Ingest nutzt `Authorization: Bearer {SWEX_STRIPE_INGEST_TOKEN}`
- Support-Ingest nutzt `Authorization: Bearer {SWEX_SUPPORT_INGEST_TOKEN}`
- Beide Payloads senden zusaetzlich `hubId`

## Duplikatvermeidung / Idempotenz
- Jeder Stripe-Webhook wird in `StripeWebhookEvent` ueber `stripeEventId` einzigartig gespeichert.
- Doppelte Webhook-Lieferungen werden dadurch sofort als `duplicate` erkannt.
- Lokale SWEX-Customer-Links werden eindeutig ueber `SwexCustomerLink(swexProjectId, stripeCustomerId)` gemappt.
- SWEX-Sales werden ueber `externalRef` und zusaetzlich ueber diese Stripe-IDs abgesichert:
  - `stripeCheckoutSessionId`
  - `stripeInvoiceId`
  - `stripePaymentIntentId`
- Die `subscriptionId` ist bewusst **nicht** unique, damit Monatsrechnungen derselben Subscription weiterhin als einzelne Sales synchronisiert werden koennen.

## Support-Fallback
- Support-Tickets suchen zuerst einen vorhandenen `SwexCustomerLink`.
- Wenn gefunden, wird dessen `swexCustomerRef` zusammen mit `customerName` und `customerEmail` an das Tower-Ticket mitgegeben.
- Dadurch landet ein spaeterer Supportfall beim bereits synchronisierten Tower-Kunden statt als isoliertes Ticket.
