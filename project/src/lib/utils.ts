import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Country, State } from "country-state-city";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Function to generate vendor invoice number (customer invoice + 2)
export function generateVendorInvoiceNumber(customerInvoiceNumber: string): string {
  const customerNumber = parseInt(customerInvoiceNumber, 10);
  if (isNaN(customerNumber)) {
    return "600002";
  }
  const vendorNumber = customerNumber + 2;
  return vendorNumber.toString().padStart(6, "0");
}

// Function to get full country name from country code
export function getCountryNameFromCode(countryCode: string): string {
  if (!countryCode) return "";

  const country = Country.getCountryByCode(countryCode.toUpperCase());
  return country ? country.name : countryCode;
}

// Function to get full state name from state code (and country code)
export function getStateNameFromCode(stateCode: string, countryCode: string): string {
  if (!stateCode) return "";
  if (!countryCode) return stateCode;
  const state = State.getStateByCodeAndCountry(
    stateCode.trim().toUpperCase(),
    countryCode.toUpperCase()
  );
  return state ? state.name : stateCode;
}

/** Same format as add-shipment / bulk-upload customer & vendor invoice DEBIT lines */
export function buildShipmentDebitTransactionLineDescription(
  trackingId: string,
  country: string,
  packaging: string,
  weightKg: number
): string {
  return `Tracking: ${trackingId} | Country: ${country} | Type: ${packaging} | Weight: ${weightKg}Kg`;
}
