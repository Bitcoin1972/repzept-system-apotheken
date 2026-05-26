import { NextResponse } from "next/server";
import {
  ConnectionVerificationStatus,
  MedicationSource,
  PharmacyReleaseStatus,
  PrescriptionType,
  RequestDistributionStatus,
  RequestStatus,
  SignatureStatus,
} from "@prisma/client";

import { ensurePracticeContext } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const context = await ensurePracticeContext();
  const practiceId = body.practiceId ?? context.id;
  const releasedByDoctorId = body.releasedByDoctorId ?? context.doctors[0]?.id ?? null;

  const practice = await prisma.practice.findUnique({
    where: {
      id: practiceId,
    },
    include: {
      doctors: true,
      pharmacyConnections: {
        where: {
          verificationStatus: ConnectionVerificationStatus.VERIFIED,
        },
        include: {
          pharmacy: true,
        },
      },
    },
  });

  if (!practice) {
    return NextResponse.json({ error: "Praxis nicht gefunden." }, { status: 404 });
  }

  const now = new Date();
  const outputText = body.outputText ?? body.output ?? body.transcription ?? "";
  const summary =
    body.summary ??
    outputText
      .split("\n")
      .map((line: string) => line.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" ");

  const requestRecord = await prisma.request.create({
    data: {
      practiceId: practice.id,
      releasedByDoctorId,
      doctorName:
        body.doctorName ?? practice.doctors.find((doctor) => doctor.id === releasedByDoctorId)?.name ?? "Praxis",
      insuranceProvider: body.insuranceProvider ?? null,
      patientReference: body.patientReference ?? null,
      prescriptionType:
        (body.prescriptionType as PrescriptionType | undefined) ?? PrescriptionType.ACUTE,
      status: RequestStatus.RELEASED,
      signatureStatus: SignatureStatus.SIGNED,
      pharmacyReleaseStatus:
        practice.pharmacyConnections.length > 0
          ? PharmacyReleaseStatus.PRE_RELEASED
          : PharmacyReleaseStatus.NOT_RELEASED,
      normalFlowPending: practice.pharmacyConnections.length > 0,
      releasedToPharmacyAt: practice.pharmacyConnections.length > 0 ? now : null,
      signedAt: now,
      issuedAt: body.issuedAt ? new Date(body.issuedAt) : now,
      summary: summary || null,
      transcription: body.transcription ?? outputText,
      outputText,
      medicationName: body.medicationName ?? null,
      medicationStrength: body.medicationStrength ?? null,
      medicationPzn: body.medicationPzn ?? null,
      medicationSource:
        (body.medicationSource as MedicationSource | undefined) ?? MedicationSource.MANUAL_INPUT,
      clinicalPayload: {
        inputLanguage: body.inputLanguage ?? "Deutsch",
        recipePreview: body.recipePreview ?? summary,
        source: "practice_release_ui",
      },
      responses: {
        create: {
          kind: "release_preview",
          payload: {
            inputLanguage: body.inputLanguage ?? "Deutsch",
            outputText,
            summary,
          },
        },
      },
      requestDistributions: {
        create: practice.pharmacyConnections.map((connection) => ({
          pharmacyId: connection.pharmacyId,
          connectionId: connection.id,
          status: RequestDistributionStatus.RELEASED,
          releasedAt: now,
          note: "Vorabfreigabe an verbundene Apotheke. Normaler Rezeptweg folgt noch.",
        })),
      },
      dispenseLogs: {
        create: practice.pharmacyConnections.map((connection) => ({
          pharmacyId: connection.pharmacyId,
          eventType: "PRE_RELEASED",
          eventNote: `Vorabfreigabe an ${connection.pharmacy.name}.`,
        })),
      },
    },
    include: {
      practice: true,
      releasedByDoctor: true,
      requestDistributions: {
        include: {
          pharmacy: true,
          connection: true,
        },
      },
      responses: true,
    },
  });

  return NextResponse.json(requestRecord, { status: 201 });
}
