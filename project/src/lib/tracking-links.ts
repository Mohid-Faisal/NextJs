const trackingLinks: Record<string, (id: string) => string> = {
  // DPEX
  DPEX: (id) => `https://dpexonline.com/trace-and-track/index?id=${id}`,

  // Parcel Force
  PARCEL_FORCE: (id) => `https://www7.parcelforce.com/track-trace?trackNumber=${id}`,

  // FedEx (all variants)
  FEDEX: (id) => `https://www.fedex.com/fedextrack/?trknbr=${id}`,
  FEDEX_LHE: (id) => `https://www.fedex.com/fedextrack/?trknbr=${id}`,
  FEDEX_DXB: (id) => `https://www.fedex.com/fedextrack/?trknbr=${id}`,

  // UPS (all variants)
  UPS: (id) => `https://www.ups.com/track?tracknum=${id}`,
  UPS_RD_LHR: (id) => `https://www.ups.com/track?tracknum=${id}`,
  UPS_SV_DXB: (id) => `https://www.ups.com/track?tracknum=${id}`,
  UPS_C2S: (id) => `https://www.ups.com/track?tracknum=${id}`,

  // DPD Europe & UK
  DPD: (id) => `https://track.dpd.co.uk/parcels/${id}`,
  DPD_EU: (id) => `https://tracking.dpd.de/status/en_US/parcel/${id}`,
  DPD_LHR: (id) => `https://track.dpd.co.uk/parcels/${id}`,

  // DHL (all variants)
  DHL: (id) => `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_LHE: (id) => `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_SIN: (id) => `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_DXB: (id) => `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_AIR_LHR: (id) => `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_RD_LHR: (id) => `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,
  DHL_PK: (id) => `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${id}&submit=1`,

  // SkyNet Worldwide Express
  SNWWE: (id) => `https://www.snwwe.com/pk-en/track-shipment?AWB=${id}`,
  SKYNET: (id) => `https://www.snwwe.com/pk-en/track-shipment?AWB=${id}`,

  // APX
  APX: (id) => `https://apx.net.pk/tracking?awb=${id}`,

  // TCS
  TCS: (id) => `https://www.tcsexpress.com/track/${id}`,

  // Leopards
  LEOPARDS: (id) => `https://www.leopardscourier.com/tracking?track_numbers=${id}`,

  // Trax
  TRAX: (id) => `https://trax.pk/tracking?tracking_number=${id}`,

  // M&P
  MNP: (id) => `https://mulphilog.com/tracking?consignmentNo=${id}`,
};

export function getTrackingUrl(shipment: {
  serviceMode?: string | null;
  vendor?: string | null;
  shippingMode?: string | null;
  trackingId?: string | null;
}): string | null {
  const id = shipment.trackingId?.trim();
  if (!id) return null;

  // Clean tracking number without leading '#'
  const cleanId = id.replace(/^#/, "");

  const mode = shipment.serviceMode?.trim().toUpperCase() || "";
  const vendor = shipment.vendor?.trim().toUpperCase() || "";
  const shippingMode = shipment.shippingMode?.trim().toUpperCase() || "";

  // 1. Direct key match in serviceMode
  if (mode && trackingLinks[mode]) {
    return trackingLinks[mode](cleanId);
  }

  // 2. Pattern heuristic: UPS tracking numbers always start with "1Z"
  if (/^1Z/i.test(cleanId)) {
    return `https://www.ups.com/track?tracknum=${cleanId}`;
  }

  // 3. Provider identification via serviceMode, vendor, or shippingMode
  const combined = `${mode} ${vendor} ${shippingMode}`;

  if (combined.includes("UPS")) {
    return `https://www.ups.com/track?tracknum=${cleanId}`;
  }
  if (combined.includes("FEDEX")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${cleanId}`;
  }
  if (combined.includes("DHL")) {
    return `https://www.dhl.com/pk-en/home/tracking.html?tracking-id=${cleanId}&submit=1`;
  }
  if (combined.includes("DPD")) {
    if (combined.includes("EU") || combined.includes("GERMANY") || combined.includes("DE")) {
      return `https://tracking.dpd.de/status/en_US/parcel/${cleanId}`;
    }
    return `https://track.dpd.co.uk/parcels/${cleanId}`;
  }
  if (combined.includes("DPEX")) {
    return `https://dpexonline.com/trace-and-track/index?id=${cleanId}`;
  }
  if (combined.includes("SKYNET") || combined.includes("SNWWE")) {
    return `https://www.snwwe.com/pk-en/track-shipment?AWB=${cleanId}`;
  }
  if (combined.includes("PARCEL") && combined.includes("FORCE")) {
    return `https://www7.parcelforce.com/track-trace?trackNumber=${cleanId}`;
  }
  if (combined.includes("APX")) {
    return `https://apx.net.pk/tracking?awb=${cleanId}`;
  }
  if (combined.includes("TCS")) {
    return `https://www.tcsexpress.com/track/${cleanId}`;
  }
  if (combined.includes("LEOPARD")) {
    return `https://www.leopardscourier.com/tracking?track_numbers=${cleanId}`;
  }
  if (combined.includes("TRAX")) {
    return `https://trax.pk/tracking?tracking_number=${cleanId}`;
  }
  if (combined.includes("M&P") || combined.includes("MNP") || combined.includes("MULLER")) {
    return `https://mulphilog.com/tracking?consignmentNo=${cleanId}`;
  }

  // 4. Default fallback to internal platform tracking page
  return `/tracking?id=${encodeURIComponent(cleanId)}`;
}

