import fs from "fs/promises";

const EPARKINGS_PATH =
  "/Users/dragostodoroscean/Desktop/Projects/blognode/scrape-parking/eparkings.json";
const OUTPUT_PATH =
  "/Users/dragostodoroscean/Desktop/Projects/blognode/scrape-parking/unique-countries.json";

async function getUniqueCountries() {
  console.log("🚀 Extracting unique countries...\n");

  // Read the eparkings file
  console.log("📖 Reading eparkings.json...");
  const parkingsData = JSON.parse(
    await fs.readFile(EPARKINGS_PATH, "utf-8")
  );
  console.log(`   ✅ Loaded ${parkingsData.length} locations\n`);

  // Extract unique countries using a Map keyed by countryCode
  const countriesMap = new Map();

  parkingsData.forEach((location) => {
    const code = location.countryCode;
    const name = location.country;

    if (code && !countriesMap.has(code)) {
      countriesMap.set(code, {
        countryCode: code,
        country: name,
      });
    }
  });

  // Convert Map to sorted array
  const uniqueCountries = Array.from(countriesMap.values()).sort((a, b) =>
    a.country.localeCompare(b.country)
  );

  console.log(`📍 Found ${uniqueCountries.length} unique countries:`);
  uniqueCountries.forEach((country) => {
    console.log(`   ${country.countryCode}: ${country.country}`);
  });

  // Save to JSON file
  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(uniqueCountries, null, 2)
  );
  console.log(`\n✅ Unique countries saved to unique-countries.json`);

  return uniqueCountries;
}

getUniqueCountries()
  .then(() => {
    console.log("\n✨ Done!");
  })
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });



