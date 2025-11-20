import fs from "fs/promises";

const API_URL = "https://snapacc.com/api/location/";

// Country name to country code mapping
const COUNTRY_CODES = {
  "United Kingdom": "GB",
  "France": "FR",
  "Germany": "DE",
  "Spain": "ES",
  "Italy": "IT",
  "Netherlands": "NL",
  "Belgium": "BE",
  "Poland": "PL",
  "Portugal": "PT",
  "Austria": "AT",
  "Czech Republic": "CZ",
  "Denmark": "DK",
  "Finland": "FI",
  "Greece": "GR",
  "Hungary": "HU",
  "Ireland": "IE",
  "Luxembourg": "LU",
  "Norway": "NO",
  "Romania": "RO",
  "Slovakia": "SK",
  "Sweden": "SE",
  "Switzerland": "CH",
  "Croatia": "HR",
  "Bulgaria": "BG",
  "Estonia": "EE",
  "Latvia": "LV",
  "Lithuania": "LT",
  "Slovenia": "SI",
  "Turkey": "TR",
  "Ukraine": "UA"
};

async function fetchSnapLocations() {
  console.log("🚀 Fetching SNAP locations from API...");
  console.log(`📍 URL: ${API_URL}\n`);

  try {
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.length} locations`);

    // Transform to match eparkings.json format
    const formatted = data.map((loc) => ({
      latitude: parseFloat(loc.lat || loc.latitude || 0),
      longitude: parseFloat(loc.long || loc.longitude || 0),
      country: loc.address?.country || loc.country || "",
      countryCode: COUNTRY_CODES[loc.address?.country || loc.country] || "",
      id: loc.locationRef || loc.id
    }));

    // Save to file
    await fs.writeFile(
      "/Users/dragostodoroscean/Desktop/Projects/blognode/scrape-parking/snapparkings.json",
      JSON.stringify(formatted, null, 2)
    );

    console.log("\n✅ Data saved to snapparkings.json");

    // Statistics
    const byCountry = {};
    formatted.forEach((loc) => {
      const country = loc.countryCode || "Unknown";
      byCountry[country] = (byCountry[country] || 0) + 1;
    });

    console.log("\n📊 Summary:");
    console.log(`   Total locations: ${formatted.length}`);
    console.log("\n📍 By country:");
    Object.entries(byCountry)
      .sort((a, b) => b[1] - a[1])
      .forEach(([code, count]) => {
        const loc = formatted.find(l => l.countryCode === code);
        console.log(`   ${code}: ${count} (${loc?.country || 'Unknown'})`);
      });

    if (formatted.length > 0) {
      console.log("\n🔍 Sample (first 3):");
      formatted.slice(0, 3).forEach((loc, i) => {
        console.log(`${i + 1}. ${loc.country} (${loc.countryCode})`);
        console.log(`   📍 ${loc.latitude}, ${loc.longitude}`);
        console.log(`   🆔 ID: ${loc.id}`);
      });
    }

    return formatted;
  } catch (error) {
    console.error("❌ Error fetching data:", error.message);
    throw error;
  }
}

fetchSnapLocations()
  .then(() => {
    console.log("\n✨ Done!");
  })
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });

