export const trackingLinks: Record<string, (id: string) => string> = {
  // DPEX
  DPEX: (id) =>
    `https://www.dpex.com/track-trace/?trackingNo=${id}`,

  // Parcel Force
  PARCEL_FORCE: (id) =>
    `https://www.parcelforce.com/track-trace?trackNumber=${id}`,

  // FedEx (all variants)
  FEDEX: (id) =>
    `https://www.fedex.com/fedextrack/?tracknumbers=${id}`,
  FEDEX_LHE: (id) =>
    `https://www.fedex.com/fedextrack/?tracknumbers=${id}`,
  FEDEX_DXB: (id) =>
    `https://www.fedex.com/fedextrack/?tracknumbers=${id}`,

  // UPS (all variants)
  UPS_RD_LHR: (id) =>
    `https://www.ups.com/track?tracknum=${id}`,
  UPS_SV_DXB: (id) =>
    `https://www.ups.com/track?tracknum=${id}`,
  UPS_C2S: (id) =>
    `https://www.ups.com/track?tracknum=${id}`,

  // DPD Europe
  DPD_EU: (id) =>
    `https://www.dpd.com/tracking?parcelNumber=${id}`,

  // DHL (all variants)
  DHL: (id) =>
    `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${id}`,
  DHL_LHE: (id) =>
    `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${id}`,
  DHL_SIN: (id) =>
    `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${id}`,
  DHL_DXB: (id) =>
    `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${id}`,
  DHL_AIR_LHR: (id) =>
    `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${id}`,
  DHL_RD_LHR: (id) =>
    `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${id}`,
  DHL_PK: (id) =>
    `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${id}`,

  // SkyNet Worldwide Express
  SNWWE: (id) =>
    `https://www.skynet.net/track/?tracknum=${id}`,
};

export function getTrackingUrl(shipment: {
  serviceMode?: string | null;
  trackingId?: string | null;
}): string | null {
  const mode = shipment.serviceMode?.trim().toUpperCase();
  const id = shipment.trackingId?.trim();
  if (!mode || !id) return null;
  const fn = trackingLinks[mode];
  if (!fn) return null;
  return fn(id);
}
