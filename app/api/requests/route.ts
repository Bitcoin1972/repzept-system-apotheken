import { NextResponse } from "next/server";
import {
  AuthRole,
  ConnectionVerificationStatus,
  PharmacyReleaseStatus,
  PrescriptionType,
  RecipeFormType,
  RequestDistributionStatus,
  RequestStatus,
  SignatureStatus,
} from "@prisma/client";

import { requireRole } from "@/lib/auth";
import { sendPickupNotificationEmail } from "@/lib/integrations/mailer";
import { buildPickupNotification } from "@/lib/pickup-notification";
import { getPracticeAccessState } from "@/lib/practice-access";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await requireRole([AuthRole.PRACTICE_ADMIN, AuthRole.DOCTOR_USER]);
  const body = await request.json();
  const practiceId = user.practiceId;

  if (!practiceId) {
    return NextResponse.json({ error: "Kein Praxiskonto hinterlegt." }, { status: 400 });
  }

  const releasedByDoctorId =
    user.role === AuthRole.DOCTOR_USER ? user.doctorUserId ?? null : body.releasedByDoctorId ?? null;

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

  const access = getPracticeAccessState(practice);

  if (access.status !== "active") {
    return NextResponse.json(
      {
        error: "Die kostenlose Nutzung ist abgelaufen.",
        checkoutUrl: access.checkoutUrl,
      },
      { status: 402 },
    );
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

  const pickupNotification =
    practice.pharmacyConnections.length > 0
      ? buildPickupNotification({
          patientEmail: body.patientEmail ?? null,
          senderEmail: practice.pickupNotificationEmail ?? null,
          summary,
          practice: {
            name: practice.name,
            street: practice.street,
            city: practice.city,
            postalCode: practice.postalCode,
            latitude: practice.latitude,
            longitude: practice.longitude,
          },
          pharmacies: practice.pharmacyConnections.map((connection) => ({
            id: connection.pharmacy.id,
            name: connection.pharmacy.name,
            email: connection.pharmacy.email,
            street: connection.pharmacy.street,
            city: connection.pharmacy.city,
            postalCode: connection.pharmacy.postalCode,
            latitude: connection.pharmacy.latitude,
            longitude: connection.pharmacy.longitude,
          })),
        })
      : null;

  const requestRecord = await prisma.request.create({
    data: {
      practiceId: practice.id,
      releasedByDoctorId,
      doctorName:
        body.doctorName ?? practice.doctors.find((doctor) => doctor.id === releasedByDoctorId)?.name ?? "Praxis",
      insuranceProvider: body.insuranceProvider ?? null,
      patientReference: body.patientReference ?? null,
      patientEmail: body.patientEmail ?? null,
      prescriptionType:
        (body.prescriptionType as PrescriptionType | undefined) ?? PrescriptionType.ACUTE,
      recipeFormType:
        (body.recipeFormType as RecipeFormType | undefined) ?? RecipeFormType.GKV_MUSTER16,
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
      medicationSource: body.medicationSource ?? "MANUAL_INPUT",
      clinicalPayload: {
        inputLanguage: body.inputLanguage ?? "Deutsch",
        recipePreview: body.recipePreview ?? summary,
        recipeFormFlags: body.recipeFormFlags ?? {},
        source: "practice_release_ui",
      },
      responses: {
        create: [
          {
            kind: "release_preview",
            payload: {
              inputLanguage: body.inputLanguage ?? "Deutsch",
              outputText,
              summary,
              recipeFormType: body.recipeFormType ?? RecipeFormType.GKV_MUSTER16,
              recipeFormFlags: body.recipeFormFlags ?? {},
            },
          },
          ...(pickupNotification
            ? [
                {
                  kind: "pickup_email_preview",
                  payload: pickupNotification,
                },
              ]
            : []),
        ],
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
        create: [
          ...practice.pharmacyConnections.map((connection) => ({
            pharmacyId: connection.pharmacyId,
            eventType: "PRE_RELEASED",
            eventNote: `Vorabfreigabe an ${connection.pharmacy.name}.`,
            actorUserId: user.id,
            actorEmail: user.email,
            actorRole: user.role,
          })),
          ...(pickupNotification?.to
            ? [
                {
                  eventType: "PATIENT_NOTIFICATION_PREPARED",
                  eventNote: `Abholbenachrichtigung fuer ${pickupNotification.to} vorbereitet.`,
                  actorUserId: user.id,
                  actorEmail: user.email,
                  actorRole: user.role,
                },
              ]
            : []),
        ],
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

  let pickupEmailDelivery:
    | {
        kind: "pickup_email_delivery";
        payload: Record<string, string | null>;
      }
    | null = null;

  if (pickupNotification?.to && pickupNotification.from) {
    const deliveryResult = await sendPickupNotificationEmail({
      from: `${practice.name} <${pickupNotification.from}>`,
      to: pickupNotification.to,
      subject: pickupNotification.subject,
      bodyText: pickupNotification.bodyText,
      replyTo: pickupNotification.replyTo ?? pickupNotification.from,
    });

    pickupEmailDelivery = {
      kind: "pickup_email_delivery",
      payload:
        deliveryResult.status === "sent"
          ? {
              status: "sent",
              messageId: deliveryResult.messageId,
              to: pickupNotification.to,
              from: pickupNotification.from,
            }
          : {
              status: deliveryResult.status,
              reason: deliveryResult.reason,
              to: pickupNotification.to,
              from: pickupNotification.from,
            },
    };

    await prisma.response.create({
      data: {
        requestId: requestRecord.id,
        kind: pickupEmailDelivery.kind,
        payload: pickupEmailDelivery.payload,
      },
    });

    await prisma.dispenseLog.create({
      data: {
        requestId: requestRecord.id,
        eventType:
          deliveryResult.status === "sent"
            ? "PATIENT_NOTIFICATION_SENT"
            : deliveryResult.status === "failed"
              ? "PATIENT_NOTIFICATION_FAILED"
              : "PATIENT_NOTIFICATION_SKIPPED",
        eventNote:
          deliveryResult.status === "sent"
            ? `Abholbenachrichtigung an ${pickupNotification.to} versendet.`
            : deliveryResult.reason,
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
      },
    });
  }

  return NextResponse.json(
    {
      ...requestRecord,
      pickupEmailDelivery,
    },
    { status: 201 },
  );
}
