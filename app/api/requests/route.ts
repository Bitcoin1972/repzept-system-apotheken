import { NextResponse } from "next/server";
import { Prisma, RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePrescriptionText } from "@/lib/parsing";
import { buildDemoResponses } from "@/lib/demo";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    transcription?: string;
    demoMode?: boolean;
    productName?: string;
    manufacturer?: string;
    dosage?: string;
    form?: string;
    pzn?: string;
  };

  const transcription = body.transcription?.trim() ?? "";

  if (!transcription) {
    return NextResponse.json(
      { error: "transcription is required" },
      {
        status: 400,
      },
    );
  }

  const parsed = parsePrescriptionText(transcription);
  const demoMode = Boolean(body.demoMode);
  const productName = body.productName?.trim() ?? "";
  const manufacturer = body.manufacturer?.trim() ?? "";
  const dosage = body.dosage?.trim() ?? parsed.dosage;
  const form = body.form?.trim() ?? "";
  const pzn = body.pzn?.trim() ?? "";
  const medicationName = productName || parsed.medicationName;

  try {
    const created = await prisma.request.create({
      data: {
        status: RequestStatus.RELEASED,
        transcription,
        demoMode,
        patientReference: parsed.patientReference || null,
        medicationName: medicationName || null,
        productName: productName || null,
        manufacturer: manufacturer || null,
        dosage: dosage || null,
        form: form || null,
        pzn: pzn || null,
        quantity: parsed.quantity || null,
        responses: demoMode
          ? {
              create: buildDemoResponses(),
            }
          : undefined,
      },
      include: {
        responses: true,
      },
    });

    return NextResponse.json({
      id: created.id,
      status: created.status,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        {
          error:
            "PostgreSQL ist noch nicht bereit. Bitte Datenbank anlegen und Prisma-Migration ausfuehren.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Request konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
