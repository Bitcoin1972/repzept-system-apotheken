ALTER TABLE "SupportTicket"
  ADD COLUMN IF NOT EXISTS "swexProjectId" TEXT NOT NULL DEFAULT 'swex-default-project',
  ADD COLUMN IF NOT EXISTS "externalRef" TEXT,
  ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'de';

UPDATE "SupportTicket"
SET "externalRef" = CONCAT('support_ticket_', "id")
WHERE "externalRef" IS NULL;

ALTER TABLE "SupportTicket"
  ALTER COLUMN "externalRef" SET NOT NULL;

DO $$
BEGIN
  CREATE UNIQUE INDEX "SupportTicket_externalRef_key" ON "SupportTicket"("externalRef");
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "StripePaymentRecord" (
  "id" TEXT PRIMARY KEY,
  "practiceId" TEXT,
  "pharmacyId" TEXT,
  "stripeCustomerId" TEXT,
  "stripePaymentIntentId" TEXT NOT NULL,
  "stripeInvoiceId" TEXT,
  "customerName" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "description" TEXT,
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  CREATE UNIQUE INDEX "StripePaymentRecord_stripePaymentIntentId_key"
  ON "StripePaymentRecord"("stripePaymentIntentId");
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

ALTER TABLE "StripePaymentRecord"
  ADD CONSTRAINT "StripePaymentRecord_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "Practice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StripePaymentRecord"
  ADD CONSTRAINT "StripePaymentRecord_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
