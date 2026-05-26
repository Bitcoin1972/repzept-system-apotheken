import { getPracticeDashboardContext } from "@/lib/bootstrap";

import { PracticeSetupWorkspace } from "./PracticeSetupWorkspace";

export default async function PracticeSetupPage() {
  const context = await getPracticeDashboardContext();

  return (
    <PracticeSetupWorkspace
      practice={{
        id: context.practice.id,
        name: context.practice.name,
        pmsType: context.practice.pmsType,
        pmsSystemLabel: context.practice.pmsSystemLabel,
        pmsApiBaseUrl: context.practice.pmsApiBaseUrl,
        catalogSource: context.practice.catalogSource,
        stripeCustomerRef: context.practice.stripeCustomerRef,
        stripeSubscriptionRef: context.practice.stripeSubscriptionRef,
        swexTenantRef: context.practice.swexTenantRef,
      }}
      doctors={context.practice.doctors.map((doctor) => ({
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
      }))}
      pharmacies={context.practice.pharmacyConnections.map((connection) => ({
        id: connection.id,
        name: connection.pharmacy.name,
        verificationStatus: connection.verificationStatus,
        verificationCode: connection.pharmacy.verificationCode,
      }))}
    />
  );
}
