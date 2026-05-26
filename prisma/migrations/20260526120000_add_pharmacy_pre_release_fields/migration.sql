CREATE TYPE "PharmacyReleaseStatus" AS ENUM (
    'NOT_RELEASED',
    'PRE_RELEASED',
    'STANDARD_FLOW_COMPLETED'
);

ALTER TABLE "Request"
ADD COLUMN     "pharmacyReleaseStatus" "PharmacyReleaseStatus" NOT NULL DEFAULT 'NOT_RELEASED',
ADD COLUMN     "normalFlowPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "releasedToPharmacyAt" TIMESTAMP(3);
