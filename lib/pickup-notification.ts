type LocationContext = {
  name: string;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type PharmacyCandidate = LocationContext & {
  id: string;
  email?: string | null;
};

type PickupNotificationInput = {
  patientEmail?: string | null;
  summary?: string | null;
  senderEmail?: string | null;
  practice: LocationContext;
  pharmacies: PharmacyCandidate[];
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(
  sourceLat: number,
  sourceLng: number,
  targetLat: number,
  targetLng: number,
) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(targetLat - sourceLat);
  const lngDelta = toRadians(targetLng - sourceLng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(sourceLat)) *
      Math.cos(toRadians(targetLat)) *
      Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function buildAddressLine(location: LocationContext) {
  return [location.street, [location.postalCode, location.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function buildMapsLink(location: LocationContext) {
  if (typeof location.latitude === "number" && typeof location.longitude === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  }

  const address = [location.name, location.street, location.postalCode, location.city]
    .filter(Boolean)
    .join(", ");

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function formatDistance(distanceKm?: number | null) {
  if (typeof distanceKm !== "number") {
    return "Entfernung derzeit nicht verfuegbar";
  }

  const meters = Math.round(distanceKm * 1000);
  if (meters < 1000) {
    return `${meters} Meter`;
  }

  return `${distanceKm.toFixed(1).replace(".", ",")} km`;
}

export function buildPickupNotification(input: PickupNotificationInput) {
  const practiceHasCoordinates =
    typeof input.practice.latitude === "number" && typeof input.practice.longitude === "number";

  const pharmacies = input.pharmacies
    .map((pharmacy) => {
      const distanceKm =
        practiceHasCoordinates &&
        typeof pharmacy.latitude === "number" &&
        typeof pharmacy.longitude === "number"
          ? haversineDistanceKm(
              input.practice.latitude as number,
              input.practice.longitude as number,
              pharmacy.latitude,
              pharmacy.longitude,
            )
          : null;

      return {
        id: pharmacy.id,
        name: pharmacy.name,
        addressLine: buildAddressLine(pharmacy),
        mapsLink: buildMapsLink(pharmacy),
        distanceKm,
        distanceText: formatDistance(distanceKm),
      };
    })
    .sort((left, right) => {
      if (left.distanceKm === null && right.distanceKm === null) {
        return left.name.localeCompare(right.name, "de");
      }
      if (left.distanceKm === null) {
        return 1;
      }
      if (right.distanceKm === null) {
        return -1;
      }
      return left.distanceKm - right.distanceKm;
    });

  const lines = [
    "Ihr Rezept ist jetzt zur Abholung bereit.",
    "",
    "Sie koennen es ab sofort in folgenden angebundenen Apotheken einloesen:",
    "",
    ...pharmacies.map((pharmacy, index) => {
      const distanceReason = practiceHasCoordinates
        ? `Diese Apotheke ist ${pharmacy.distanceText} von Ihrer Arztpraxis entfernt.`
        : `${pharmacy.distanceText}.`;

      const addressLine = pharmacy.addressLine ? ` ${pharmacy.addressLine}.` : "";
      return `${index + 1}. ${pharmacy.name} - ${distanceReason}${addressLine} Karte: ${pharmacy.mapsLink}`;
    }),
  ];

  return {
    from: input.senderEmail ?? null,
    replyTo: input.senderEmail ?? null,
    to: input.patientEmail ?? null,
    subject: "Ihr Rezept ist jetzt zur Abholung bereit",
    bodyText: lines.join("\n"),
    pharmacies,
  };
}
