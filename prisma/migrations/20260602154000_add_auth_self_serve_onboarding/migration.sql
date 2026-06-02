-- CreateEnum
CREATE TYPE "AuthRole" AS ENUM ('PRACTICE_ADMIN', 'DOCTOR_USER', 'PHARMACY_USER');

-- CreateTable
CREATE TABLE "AuthUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AuthRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "practiceId" TEXT,
    "doctorUserId" TEXT,
    "pharmacyAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_email_key" ON "AuthUser"("email");

-- CreateIndex
CREATE INDEX "AuthUser_practiceId_idx" ON "AuthUser"("practiceId");

-- CreateIndex
CREATE INDEX "AuthUser_doctorUserId_idx" ON "AuthUser"("doctorUserId");

-- CreateIndex
CREATE INDEX "AuthUser_pharmacyAccountId_idx" ON "AuthUser"("pharmacyAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "AuthUser" ADD CONSTRAINT "AuthUser_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthUser" ADD CONSTRAINT "AuthUser_doctorUserId_fkey" FOREIGN KEY ("doctorUserId") REFERENCES "DoctorUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthUser" ADD CONSTRAINT "AuthUser_pharmacyAccountId_fkey" FOREIGN KEY ("pharmacyAccountId") REFERENCES "PharmacyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
