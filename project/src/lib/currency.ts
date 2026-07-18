// Utility for IP-based geolocation currency matching and live exchange rates.

export function getCurrencyForCountry(countryCode: string | null): string {
  const code = (countryCode || "").toUpperCase().trim();
  if (!code) return "USD";

  // Mapping of common country codes to their default currencies
  const mapping: Record<string, string> = {
    US: "USD",
    PK: "PKR",
    IN: "INR",
    GB: "GBP",
    AE: "AED",
    SA: "SAR",
    CA: "CAD",
    AU: "AUD",
    CN: "CNY",
    JP: "JPY",
    SG: "SGD",
    NZ: "NZD",
    HK: "HKD",
    BD: "BDT",
    LK: "LKR",
    OM: "OMR",
    QA: "QAR",
    KW: "KWD",
    BH: "BHD",
    TR: "TRY",
    MY: "MYR",
    TH: "THB",
    PH: "PHP",
    ID: "IDR",
    EG: "EGP",
    // Eurozone countries
    AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR",
    FR: "EUR", DE: "EUR", GR: "EUR", IE: "EUR", IT: "EUR",
    LV: "EUR", LT: "EUR", LU: "EUR", MT: "EUR", NL: "EUR",
    PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR", HR: "EUR"
  };

  return mapping[code] || "USD"; // Default to USD for other countries
}

export async function fetchExchangeRates(): Promise<Record<string, number>> {
  // Safe fallbacks in case API fails or times out
  let rates: Record<string, number> = {
    USD: 1,
    PKR: 278.0,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
    SAR: 3.75,
    INR: 83.5,
    BDT: 117.0,
    CAD: 1.37,
    AUD: 1.50
  };

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 } // Cache rate for 1 hour in NextJS
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates) {
        rates = { ...rates, ...data.rates };
      }
    }
  } catch (err) {
    console.error("Failed to fetch live exchange rates, using fallbacks:", err);
  }

  return rates;
}
