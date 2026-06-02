import { NextResponse } from "next/server";

import { resolveSwexProjectFromCatalog } from "@/lib/external-catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await resolveSwexProjectFromCatalog({
    practiceId: searchParams.get("practiceId"),
    pharmacyId: searchParams.get("pharmacyId"),
    stripeCustomerId: searchParams.get("stripeCustomerId"),
  });

  return NextResponse.json(result);
}
