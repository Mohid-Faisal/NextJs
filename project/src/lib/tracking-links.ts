export const trackingLinks: Record<string, (id: string) => string> = {
  // DPEX
  DPEX: (id) =>
    `https://dpexonline.com/trace-and-track/index?id=${id}`,

  // Parcel Force
  PARCEL_FORCE: (id) =>
    `https://www7.parcelforce.com/track-trace?trackNumber=${id}`,

  // FedEx (all variants)
  FEDEX: (id) =>
    `https://www.fedex.com/fedextrack/?trknbr=${id}`,
  FEDEX_LHE: (id) =>
    `https://www.fedex.com/fedextrack/?trknbr=${id}`,
  FEDEX_DXB: (id) =>
    `https://www.fedex.com/fedextrack/?trknbr=${id}`,

  // UPS (all variants)
  UPS_RD_LHR: (id) =>
    `https://www.ups.com/track?tracknum=${id}`,
  UPS_SV_DXB: (id) =>
    `https://www.ups.com/track?tracknum=${id}`,
  UPS_C2S: (id) =>
    `https://www.ups.com/track?tracknum=${id}`,

  // DPD Europe (tracking.dpd.de)
  DPD_EU: (id) =>
    `https://tracking.dpd.de/status/en_US/parcel/${id}`,
  // DPD UK (track.dpd.co.uk)
  DPD_LHE: (id) =>
    `https://track.dpd.co.uk/parcels/${id}`,

  // DHL (all variants)
  DHL: (id) =>
    `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_LHE: (id) =>
    `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_SIN: (id) =>
    `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_DXB: (id) =>
    `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_AIR_LHR: (id) =>
    `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_RD_LHR: (id) =>
    `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_PK: (id) =>
    `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,

  // SkyNet Worldwide Express
  SNWWE: (id) =>
    `https://www.snwwe.com/pk-en/track-shipment?AWB=${id}`,
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
