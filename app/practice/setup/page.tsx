import { getPracticeDashboardContext } from "@/lib/bootstrap";

import { PracticeSetupWorkspace } from "./PracticeSetupWorkspace";

export default async function PracticeSetupPage() {
  const context = await getPracticeDashboardContext();

  return (
    <PracticeSetupWorkspace
      practice={{
        id: context.practice.id,
        name: context.practice.name,
        street: context.practice.street,
        city: context.practice.city,
        postalCode: context.practice.postalCode,
        latitude: context.practice.latitude,
        longitude: context.practice.longitude,
        pickupNotificationEmail: context.practice.pickupNotificationEmail,
        trialStartsAt: context.practice.trialStartsAt?.toISOString() ?? null,
        trialEndsAt: context.practice.trialEndsAt?.toISOString() ?? null,
        pmsType: context.practice.pmsType,
        pmsSystemLabel: context.practice.pmsSystemLabel,
        pmsApiBaseUrl: context.practice.pmsApiBaseUrl,
        catalogSource: context.practice.catalogSource,
        catalogProviderLabel: context.practice.catalogProviderLabel,
        catalogApiBaseUrl: context.practice.catalogApiBaseUrl,
        stripeCustomerRef: context.practice.stripeCustomerRef,
        stripeSubscriptionRef: context.practice.stripeSubscriptionRef,
        stripeCheckoutUrl: context.practice.stripeCheckoutUrl,
        swexTenantRef: context.practice.swexTenantRef,
        renderWorkspaceSlug: context.practice.renderWorkspaceSlug,
        renderServiceName: context.practice.renderServiceName,
        copyToOwnRenderOnActivation: context.practice.copyToOwnRenderOnActivation,
      }}
      doctors={context.practice.doctors.map((doctor) => ({
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
      }))}
      pharmacies={context.practice.pharmacyConnections.map((connection) => ({
        id: connection.id,
        name: connection.pharmacy.name,
        street: connection.pharmacy.street,
        city: connection.pharmacy.city,
        verificationStatus: connection.verificationStatus,
        verificationCode: connection.pharmacy.verificationCode,
      }))}
    />
  );
}
