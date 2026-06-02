-- CreateEnum
CREATE TYPE "SwexEntityType" AS ENUM ('PRACTICE', 'PHARMACY');

-- AlterTable
ALTER TABLE "Practice"
ADD COLUMN "swexCustomerRef" TEXT;

-- AlterTable
ALTER TABLE "PharmacyAccount"
ADD COLUMN "swexCustomerRef" TEXT;

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "objectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "errorMessage" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwexCustomerLink" (
    "id" TEXT NOT NULL,
    "entityType" "SwexEntityType" NOT NULL,
    "practiceId" TEXT,
    "pharmacyId" TEXT,
    "stripeCustomerId" TEXT NOT NULL,
    "swexProjectId" TEXT NOT NULL,
    "swexCustomerRef" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "address" JSONB,
    "lastPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwexCustomerLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwexOrderSync" (
    "id" TEXT NOT NULL,
    "customerLinkId" TEXT,
    "entityType" "SwexEntityType" NOT NULL,
    "practiceId" TEXT,
    "pharmacyId" TEXT,
    "swexProjectId" TEXT NOT NULL,
    "swexCustomerRef" TEXT,
    "swexSaleRef" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "stripeEventId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSubscriptionId" TEXT,
    "productName" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "billingCycle" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwexOrderSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE UNIQUE INDEX "SwexCustomerLink_externalRef_key" ON "SwexCustomerLink"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "SwexCustomerLink_swexProjectId_stripeCustomerId_key" ON "SwexCustomerLink"("swexProjectId", "stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "SwexOrderSync_externalRef_key" ON "SwexOrderSync"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "SwexOrderSync_swexProjectId_stripeCheckoutSessionId_key" ON "SwexOrderSync"("swexProjectId", "stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SwexOrderSync_swexProjectId_stripeInvoiceId_key" ON "SwexOrderSync"("swexProjectId", "stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SwexOrderSync_swexProjectId_stripePaymentIntentId_key" ON "SwexOrderSync"("swexProjectId", "stripePaymentIntentId");

-- AddForeignKey
ALTER TABLE "SwexCustomerLink" ADD CONSTRAINT "SwexCustomerLink_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwexCustomerLink" ADD CONSTRAINT "SwexCustomerLink_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwexOrderSync" ADD CONSTRAINT "SwexOrderSync_customerLinkId_fkey" FOREIGN KEY ("customerLinkId") REFERENCES "SwexCustomerLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwexOrderSync" ADD CONSTRAINT "SwexOrderSync_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwexOrderSync" ADD CONSTRAINT "SwexOrderSync_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
