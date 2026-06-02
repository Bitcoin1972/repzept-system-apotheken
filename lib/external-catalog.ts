import { prisma } from "@/lib/prisma";

export type ExternalCatalogResolution = {
  projectId: string;
  source: "practice_swex_tenant" | "pharmacy_swex_tenant" | "env_default";
  practiceId?: string | null;
  pharmacyId?: string | null;
  stripeCustomerId?: string | null;
};

export async function resolveSwexProjectFromCatalog(input: {
  practiceId?: string | null;
  pharmacyId?: string | null;
  stripeCustomerId?: string | null;
}) {
  if (input.practiceId) {
    const practice = await prisma.practice.findUnique({
      where: {
        id: input.practiceId,
      },
      select: {
        id: true,
        swexTenantRef: true,
      },
    });

    if (practice?.swexTenantRef) {
      return {
        projectId: practice.swexTenantRef,
        source: "practice_swex_tenant",
        practiceId: practice.id,
        stripeCustomerId: input.stripeCustomerId ?? null,
      } satisfies ExternalCatalogResolution;
    }
  }

  if (input.pharmacyId || input.stripeCustomerId) {
    const pharmacyWhere = [];

    if (input.pharmacyId) {
      pharmacyWhere.push({
        id: input.pharmacyId,
      });
    }

    if (input.stripeCustomerId) {
      pharmacyWhere.push({
        stripeCustomerRef: input.stripeCustomerId,
      });
    }

    const pharmacy = await prisma.pharmacyAccount.findFirst({
      where: pharmacyWhere.length > 0 ? { OR: pharmacyWhere } : undefined,
      select: {
        id: true,
        swexTenantRef: true,
      },
    });

    if (pharmacy?.swexTenantRef) {
      return {
        projectId: pharmacy.swexTenantRef,
        source: "pharmacy_swex_tenant",
        pharmacyId: pharmacy.id,
        stripeCustomerId: input.stripeCustomerId ?? null,
      } satisfies ExternalCatalogResolution;
    }
  }

  return {
    projectId: process.env.SWEX_DEFAULT_PROJECT_ID ?? "swex-default-project",
    source: "env_default",
    practiceId: input.practiceId ?? null,
    pharmacyId: input.pharmacyId ?? null,
    stripeCustomerId: input.stripeCustomerId ?? null,
  } satisfies ExternalCatalogResolution;
}
