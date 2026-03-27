-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'RELEASED', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PharmacyResponseStatus" AS ENUM ('AVAILABLE', 'ORDERABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "PrescriptionType" AS ENUM ('RED', 'GREEN');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('DRAFT', 'SIGNED');

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "transcription" TEXT NOT NULL,
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "patientReference" TEXT,
    "medicationName" TEXT,
    "productName" TEXT,
    "manufacturer" TEXT,
    "dosage" TEXT,
    "form" TEXT,
    "pzn" TEXT,
    "quantity" TEXT,
    "doctorName" TEXT,
    "insuranceProvider" TEXT,
    "prescriptionType" "PrescriptionType" NOT NULL DEFAULT 'RED',
    "signatureStatus" "SignatureStatus" NOT NULL DEFAULT 'DRAFT',
    "signedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "medicationSource" TEXT,
    "summary" TEXT,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyResponse" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "pharmacyName" TEXT NOT NULL,
    "responseStatus" "PharmacyResponseStatus" NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "PharmacyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PharmacyResponse_requestId_idx" ON "PharmacyResponse"("requestId");

-- AddForeignKey
ALTER TABLE "PharmacyResponse" ADD CONSTRAINT "PharmacyResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
