import { Country, State } from "country-state-city";

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "US",
  uae: "AE",
  uk: "GB",
  "united states of america": "US",
  "united states": "US",
  "united arab emirates": "AE",
  "united kingdom": "GB",
};

/** Map a stored country name or ISO code to a Select-compatible ISO code. */
export function resolveCountryIso(country?: string | null): string {
  if (!country) return "";
  const trimmed = country.trim();
  if (!trimmed) return "";
  if (trimmed.length === 2) {
    const byCode = Country.getCountryByCode(trimmed.toUpperCase());
    return byCode?.isoCode || trimmed.toUpperCase();
  }
  const alias = COUNTRY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  const match = Country.getAllCountries().find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  return match?.isoCode || "";
}

/** Map a stored state name or ISO code to a Select-compatible ISO code. */
export function resolveStateIso(
  state?: string | null,
  countryIso?: string | null
): string {
  if (!state || !countryIso) return "";
  const trimmed = state.trim();
  if (!trimmed) return "";
  const states = State.getStatesOfCountry(countryIso);
  if (states.some((s) => s.isoCode === trimmed)) return trimmed;
  const byName = states.find(
    (s) => s.name.toLowerCase() === trimmed.toLowerCase()
  );
  return byName?.isoCode || "";
}
