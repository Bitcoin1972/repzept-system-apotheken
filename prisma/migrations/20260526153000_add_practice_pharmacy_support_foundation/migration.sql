DO $$
BEGIN
  CREATE TYPE "CatalogSource" AS ENUM ('PMS_CATALOG', 'EXTERNAL_API');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PmsType" AS ENUM ('GENERIC_PMS', 'INTERNAL_CATALOG_API', 'EXTERNAL_E_PRESCRIPTION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ConnectionVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "RequestDistributionStatus" AS ENUM ('RELEASED', 'VIEWED', 'IN_PROGRESS', 'DISPENSED', 'BLOCKED_DUPLICATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SupportRole" AS ENUM ('PRACTICE', 'PHARMACY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SupportComponent" AS ENUM ('PMS_CONNECTOR', 'CATALOG_API', 'PHARMACY_CONNECTION', 'STRIPE_SYNC', 'RELEASE_FLOW', 'SUPPORT_UI');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SupportSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MedicationSource_new" AS ENUM ('MANUAL_INPUT', 'PMS_CATALOG', 'EXTERNAL_API');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Practice" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "pmsType" "PmsType" NOT NULL DEFAULT 'GENERIC_PMS',
  "pmsSystemLabel" TEXT,
  "pmsApiBaseUrl" TEXT,
  "pmsApiKeyMasked" TEXT,
  "catalogSource" "CatalogSource" NOT NULL DEFAULT 'PMS_CATALOG',
  "stripeCustomerRef" TEXT,
  "stripeSubscriptionRef" TEXT,
  "swexTenantRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "DoctorUser" (
  "id" TEXT PRIMARY KEY,
  "practiceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PharmacyAccount" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "contactPhone" TEXT,
  "verificationCode" TEXT NOT NULL UNIQUE,
  "stripeCustomerRef" TEXT,
  "swexTenantRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PracticePharmacyConnection" (
  "id" TEXT PRIMARY KEY,
  "practiceId" TEXT NOT NULL,
  "pharmacyId" TEXT NOT NULL,
  "pharmacyVerificationCode" TEXT NOT NULL,
  "verificationStatus" "ConnectionVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "connectedAt" TIMESTAMP(3),
  "verifiedByAiAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PracticePharmacyConnection_practiceId_pharmacyId_key" UNIQUE ("practiceId", "pharmacyId")
);

CREATE TABLE IF NOT EXISTS "RequestDistribution" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "pharmacyId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "status" "RequestDistributionStatus" NOT NULL DEFAULT 'RELEASED',
  "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "viewedAt" TIMESTAMP(3),
  "processingStartedAt" TIMESTAMP(3),
  "dispensedAt" TIMESTAMP(3),
  "blockedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "DispenseLog" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "pharmacyId" TEXT,
  "distributionId" TEXT,
  "eventType" TEXT NOT NULL,
  "eventNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" TEXT PRIMARY KEY,
  "practiceId" TEXT,
  "pharmacyId" TEXT,
  "requestId" TEXT,
  "connectionId" TEXT,
  "role" "SupportRole" NOT NULL,
  "component" "SupportComponent" NOT NULL,
  "severity" "SupportSeverity" NOT NULL DEFAULT 'MEDIUM',
  "category" TEXT NOT NULL,
  "technicalSignature" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "internalMessage" TEXT NOT NULL,
  "internalContext" JSONB,
  "swexPayload" JSONB NOT NULL,
  "swexTicketRef" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Request"
  ADD COLUMN IF NOT EXISTS "practiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "releasedByDoctorId" TEXT,
  ADD COLUMN IF NOT EXISTS "patientReference" TEXT,
  ADD COLUMN IF NOT EXISTS "outputText" TEXT,
  ADD COLUMN IF NOT EXISTS "medicationName" TEXT,
  ADD COLUMN IF NOT EXISTS "medicationStrength" TEXT,
  ADD COLUMN IF NOT EXISTS "medicationPzn" TEXT,
  ADD COLUMN IF NOT EXISTS "clinicalPayload" JSONB;

DO $$
BEGIN
  ALTER TABLE "Request"
    ALTER COLUMN "medicationSource" TYPE "MedicationSource_new"
    USING CASE
      WHEN "medicationSource"::TEXT = 'SELECTED_PRODUCT' THEN 'PMS_CATALOG'::"MedicationSource_new"
      WHEN "medicationSource"::TEXT = 'MANUAL' THEN 'MANUAL_INPUT'::"MedicationSource_new"
      ELSE "medicationSource"::TEXT::"MedicationSource_new"
    END;
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "MedicationSource" RENAME TO "MedicationSource_legacy";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "MedicationSource_new" RENAME TO "MedicationSource";
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Request"
    ALTER COLUMN "medicationSource" SET DEFAULT 'MANUAL_INPUT';
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;

ALTER TABLE "DoctorUser"
  ADD CONSTRAINT "DoctorUser_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "Practice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticePharmacyConnection"
  ADD CONSTRAINT "PracticePharmacyConnection_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "Practice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticePharmacyConnection"
  ADD CONSTRAINT "PracticePharmacyConnection_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequestDistribution"
  ADD CONSTRAINT "RequestDistribution_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequestDistribution"
  ADD CONSTRAINT "RequestDistribution_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequestDistribution"
  ADD CONSTRAINT "RequestDistribution_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "PracticePharmacyConnection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DispenseLog"
  ADD CONSTRAINT "DispenseLog_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DispenseLog"
  ADD CONSTRAINT "DispenseLog_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DispenseLog"
  ADD CONSTRAINT "DispenseLog_distributionId_fkey"
  FOREIGN KEY ("distributionId") REFERENCES "RequestDistribution"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "Practice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_pharmacyId_fkey"
  FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "PracticePharmacyConnection"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "Practice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_releasedByDoctorId_fkey"
  FOREIGN KEY ("releasedByDoctorId") REFERENCES "DoctorUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
