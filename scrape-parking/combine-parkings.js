import fs from "fs/promises";

const EPARKINGS_PATH = "/eparkings.json";
const SNAPPARKINGS_PATH = "/snapparkings.json";
const OUTPUT_PATH = "/combined-parkings.json";

// Precision for duplicate detection
// 4 decimal places = ~11 meters precision
// 3 decimal places = ~110 meters precision
// 5 decimal places = ~1.1 meters precision
const DECIMAL_PRECISION = 4;

function roundCoordinate(coord, precision) {
  return (
    Math.round(coord * Math.pow(10, precision)) /
    Math.pow(10, precision)
  );
}

function createLocationKey(latitude, longitude, precision) {
  const roundedLat = roundCoordinate(latitude, precision);
  const roundedLon = roundCoordinate(longitude, precision);
  return `${roundedLat},${roundedLon}`;
}

async function combineParkings() {
  console.log("🚀 Starting parking data combination...\n");

  // Read both files
  console.log("📖 Reading eparkings.json...");
  const eParkingsData = JSON.parse(
    await fs.readFile(EPARKINGS_PATH, "utf-8")
  );
  console.log(`   ✅ Loaded ${eParkingsData.length} locations`);

  console.log("📖 Reading snapparkings.json...");
  const snapParkingsData = JSON.parse(
    await fs.readFile(SNAPPARKINGS_PATH, "utf-8")
  );
  console.log(`   ✅ Loaded ${snapParkingsData.length} locations\n`);

  // Remove id field and prepare data
  const eParkings = eParkingsData.map(({ id, ...rest }) => rest);
  const snapParkings = snapParkingsData.map(
    ({ id, ...rest }) => rest
  );

  // Combine all locations
  const allLocations = [...eParkings, ...snapParkings];
  console.log(
    `📊 Total locations before deduplication: ${allLocations.length}`
  );
  console.log(
    `   📍 Precision: ${DECIMAL_PRECISION} decimal places (~${
      DECIMAL_PRECISION === 4
        ? "11m"
        : DECIMAL_PRECISION === 3
        ? "110m"
        : DECIMAL_PRECISION === 5
        ? "1.1m"
        : "varies"
    })\n`
  );

  // Deduplicate based on rounded coordinates
  const uniqueLocations = new Map();
  const duplicates = [];

  allLocations.forEach((location, index) => {
    const key = createLocationKey(
      location.latitude,
      location.longitude,
      DECIMAL_PRECISION
    );

    if (uniqueLocations.has(key)) {
      duplicates.push({
        original: uniqueLocations.get(key),
        duplicate: location,
        key,
      });
    } else {
      uniqueLocations.set(key, {
        ...location,
        source: index < eParkings.length ? "etransport" : "snap",
      });
    }
  });

  const finalLocations = Array.from(uniqueLocations.values());

  console.log("🔍 Deduplication results:");
  console.log(`   ✅ Unique locations: ${finalLocations.length}`);
  console.log(`   ❌ Duplicates removed: ${duplicates.length}\n`);

  // Statistics by source
  const bySource = {
    etransport: finalLocations.filter(
      (l) => l.source === "etransport"
    ).length,
    snap: finalLocations.filter((l) => l.source === "snap").length,
  };
  console.log("📈 Sources:");
  console.log(`   etransport.pl: ${bySource.etransport}`);
  console.log(`   snapacc.com: ${bySource.snap}\n`);

  // Remove source field and round coordinates to precision
  const outputData = finalLocations.map(({ source, ...rest }) => ({
    ...rest,
    latitude: roundCoordinate(rest.latitude, DECIMAL_PRECISION),
    longitude: roundCoordinate(rest.longitude, DECIMAL_PRECISION),
  }));

  // Statistics by country
  const byCountry = {};
  outputData.forEach((loc) => {
    const code = loc.countryCode || "Unknown";
    byCountry[code] = (byCountry[code] || 0) + 1;
  });

  console.log("📍 Top 10 countries:");
  Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([code, count]) => {
      const loc = outputData.find((l) => l.countryCode === code);
      console.log(
        `   ${code}: ${count} (${loc?.country || "Unknown"})`
      );
    });

  // Show some duplicate examples if any
  if (duplicates.length > 0) {
    console.log("\n🔎 Duplicate examples (first 3):");
    duplicates.slice(0, 3).forEach((dup, i) => {
      console.log(`${i + 1}. Location at ${dup.key}`);
      console.log(
        `   Original: ${dup.original.latitude}, ${dup.original.longitude} (${dup.original.country})`
      );
      console.log(
        `   Duplicate: ${dup.duplicate.latitude}, ${dup.duplicate.longitude} (${dup.duplicate.country})`
      );
    });
  }

  // Save combined data
  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(outputData, null, 2)
  );
  console.log("\n✅ Combined data saved to combined-parkings.json");

  console.log("\n📊 Final Summary:");
  console.log(`   Total unique locations: ${outputData.length}`);
  console.log(`   Total countries: ${Object.keys(byCountry).length}`);
  console.log(`   Duplicates removed: ${duplicates.length}`);
  console.log(
    `   Space saved: ${(
      (duplicates.length / allLocations.length) *
      100
    ).toFixed(1)}%`
  );

  return outputData;
}

combineParkings()
  .then(() => {
    console.log("\n✨ Done!");
  })
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
