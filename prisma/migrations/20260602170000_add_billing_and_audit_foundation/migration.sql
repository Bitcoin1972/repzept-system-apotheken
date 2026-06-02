-- CreateEnum
CREATE TYPE "PharmacyPlan" AS ENUM ('SMALL', 'STANDARD', 'NETWORK');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PREPARED', 'ISSUED', 'PAID', 'VOID');

-- AlterTable
ALTER TABLE "PharmacyAccount"
ADD COLUMN "billingEmail" TEXT,
ADD COLUMN "plan" "PharmacyPlan" NOT NULL DEFAULT 'SMALL',
ADD COLUMN "monthlyPriceCents" INTEGER NOT NULL DEFAULT 9900,
ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
ADD COLUMN "stripeSubscriptionRef" TEXT,
ADD COLUMN "stripeLatestInvoiceRef" TEXT,
ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PracticePharmacyConnection"
ADD COLUMN "verificationReason" TEXT;

-- AlterTable
ALTER TABLE "RequestDistribution"
ADD COLUMN "viewedByUserId" TEXT,
ADD COLUMN "processingByUserId" TEXT,
ADD COLUMN "dispensedByUserId" TEXT;

-- AlterTable
ALTER TABLE "DispenseLog"
ADD COLUMN "actorUserId" TEXT,
ADD COLUMN "actorEmail" TEXT,
ADD COLUMN "actorRole" "AuthRole";

-- CreateTable
CREATE TABLE "PharmacyUsageSnapshot" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "monthStart" TIMESTAMP(3) NOT NULL,
    "releasedCount" INTEGER NOT NULL DEFAULT 0,
    "dispensedCount" INTEGER NOT NULL DEFAULT 0,
    "activeConnections" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyUsageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyInvoice" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "usageSnapshotId" TEXT,
    "monthStart" TIMESTAMP(3) NOT NULL,
    "monthEnd" TIMESTAMP(3) NOT NULL,
    "plan" "PharmacyPlan" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "stripeInvoiceId" TEXT,
    "stripeHostedInvoiceUrl" TEXT,
    "stripeCustomerId" TEXT,
    "lineItemDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyUsageSnapshot_pharmacyId_monthStart_key" ON "PharmacyUsageSnapshot"("pharmacyId", "monthStart");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyInvoice_pharmacyId_monthStart_key" ON "PharmacyInvoice"("pharmacyId", "monthStart");

-- AddForeignKey
ALTER TABLE "PharmacyUsageSnapshot" ADD CONSTRAINT "PharmacyUsageSnapshot_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyInvoice" ADD CONSTRAINT "PharmacyInvoice_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyInvoice" ADD CONSTRAINT "PharmacyInvoice_usageSnapshotId_fkey" FOREIGN KEY ("usageSnapshotId") REFERENCES "PharmacyUsageSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
