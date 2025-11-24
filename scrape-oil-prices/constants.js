
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

export const COUNTRY_CURRENCIES = {
  "AT": "EUR", "BE": "EUR", "BG": "BGN", "HR": "EUR", "CY": "EUR",
  "CZ": "CZK", "DK": "DKK", "EE": "EUR", "FI": "EUR", "FR": "EUR",
  "DE": "EUR", "GR": "EUR", "HU": "HUF", "IE": "EUR", "IT": "EUR",
  "LV": "EUR", "LT": "EUR", "LU": "EUR", "MT": "EUR", "NL": "EUR",
  "PL": "PLN", "PT": "EUR", "RO": "RON", "SK": "EUR", "SI": "EUR",
  "ES": "EUR", "SE": "SEK",
  "GB": "GBP", "NO": "NOK", "CH": "CHF", "IS": "ISK", "UA": "UAH",
  "TR": "TRY", "RS": "RSD", "AL": "ALL", "BA": "BAM", "MK": "MKD",
  "ME": "EUR", "XK": "EUR"
};


export function getCountryCode(countryName) {
  if (!countryName) return null;
  
  if (COUNTRY_CODES[countryName]) {
    return COUNTRY_CODES[countryName];
  }
  
  const normalized = countryName.trim();
  const entry = Object.entries(COUNTRY_CODES).find(
    ([key]) => key.toLowerCase() === normalized.toLowerCase()
  );
  
  return entry ? entry[1] : null;
}


export function getCurrency(countryCode) {
  if (!countryCode) return null;
  return COUNTRY_CURRENCIES[countryCode] || null;
}
