import { describeCatalogStrategy } from "@/lib/integrations/catalog";
import { buildRevenueSnapshot } from "@/lib/integrations/stripe";
import { getPracticeDashboardContext } from "@/lib/bootstrap";

import { PracticeComposer } from "./PracticeComposer";

export default async function PracticeNewPage() {
  const context = await getPracticeDashboardContext();
  const catalog = describeCatalogStrategy(context.practice);
  const revenue = buildRevenueSnapshot(context.practice);

  return (
    <PracticeComposer
      practice={{
        id: context.practice.id,
        name: context.practice.name,
        pmsType: context.practice.pmsType,
        pmsSystemLabel: context.practice.pmsSystemLabel,
        catalogSource: context.practice.catalogSource,
        swexTenantRef: context.practice.swexTenantRef,
        stripeCustomerRef: context.practice.stripeCustomerRef,
      }}
      activeDoctor={
        context.activeDoctor
          ? {
              id: context.activeDoctor.id,
              name: context.activeDoctor.name,
              email: context.activeDoctor.email,
            }
          : null
      }
      pharmacies={context.practice.pharmacyConnections.map((connection) => ({
        id: connection.id,
        verificationStatus: connection.verificationStatus,
        connectedAt: connection.connectedAt?.toISOString() ?? null,
        pharmacyId: connection.pharmacy.id,
        pharmacyName: connection.pharmacy.name,
        verificationCode: connection.pharmacy.verificationCode,
      }))}
      recentRequests={context.recentRequests.map((request) => ({
        id: request.id,
        summary: request.summary,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
        pharmacies: request.requestDistributions.map((distribution) => distribution.pharmacy.name),
      }))}
      catalog={catalog}
      revenue={revenue}
      supportCount={context.recentSupportTickets.length}
    />
  );
}
