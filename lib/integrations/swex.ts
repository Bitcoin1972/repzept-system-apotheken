import type { SanitizedSwexPayload } from "@/lib/support";

export async function submitSupportTicketToSwex(payload: SanitizedSwexPayload) {
  const sequence = Math.random().toString(36).slice(2, 8).toUpperCase();

  return {
    ticketRef: `SWEX-${sequence}`,
    acceptedAt: new Date().toISOString(),
    payload,
  };
}
