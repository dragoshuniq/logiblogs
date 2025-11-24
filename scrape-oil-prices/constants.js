
export const COUNTRY_CODES = {
  "Austria": "AT",
  "Belgium": "BE",
  "Bulgaria": "BG",
  "Croatia": "HR",
  "Cyprus": "CY",
  "Czech Republic": "CZ",
  "Czechia": "CZ",
  "Denmark": "DK",
  "Estonia": "EE",
  "Finland": "FI",
  "France": "FR",
  "Germany": "DE",
  "Greece": "GR",
  "Hungary": "HU",
  "Ireland": "IE",
  "Italy": "IT",
  "Latvia": "LV",
  "Lithuania": "LT",
  "Luxembourg": "LU",
  "Malta": "MT",
  "Netherlands": "NL",
  "Poland": "PL",
  "Portugal": "PT",
  "Romania": "RO",
  "Slovakia": "SK",
  "Slovenia": "SI",
  "Spain": "ES",
  "Sweden": "SE",
  
  // Non-EU European Countries
  "United Kingdom": "GB",
  "Norway": "NO",
  "Switzerland": "CH",
  "Iceland": "IS",
  "Ukraine": "UA",
  "Turkey": "TR",
  "Serbia": "RS",
  "Albania": "AL",
  "Bosnia and Herzegovina": "BA",
  "North Macedonia": "MK",
  "Montenegro": "ME",
  "Kosovo": "XK",
};

/**
 * Gets the country code for a given country name
 * @param {string} countryName - The country name
 * @returns {string|null} - The 2-letter country code or null if not found
 */
export function getCountryCode(countryName) {
  if (!countryName) return null;
  
  // Direct match
  if (COUNTRY_CODES[countryName]) {
    return COUNTRY_CODES[countryName];
  }
  
  // Try case-insensitive match
  const normalized = countryName.trim();
  const entry = Object.entries(COUNTRY_CODES).find(
    ([key]) => key.toLowerCase() === normalized.toLowerCase()
  );
  
  return entry ? entry[1] : null;
}
