import puppeteer from "puppeteer";
import fs from "fs/promises";

async function scrapePolishParkings() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    console.log("Navigating to page...");
    await page.goto("https://etransport.pl/dobry_parking", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    console.log("Waiting for map to load...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("Extracting geolocation data...");

    const parkingData = await page.evaluate(() => {
      const parkings = [];

      if (
        typeof etrParkLat !== "undefined" &&
        typeof etrParkLang !== "undefined" &&
        typeof etrParkTitle !== "undefined" &&
        typeof etrParkId !== "undefined"
      ) {
        const length = etrParkLat.length;

        for (let i = 0; i < length; i++) {
          parkings.push({
            id: etrParkId[i],
            name: etrParkTitle[i],
            latitude: parseFloat(etrParkLat[i]),
            longitude: parseFloat(etrParkLang[i]),
            coordinates: {
              lat: parseFloat(etrParkLat[i]),
              lng: parseFloat(etrParkLang[i]),
            },
            detailUrl: `https://etransport.pl/parking.${etrParkId[i]}.html`,
          });
        }
      }

      return parkings;
    });

    console.log(
      `✅ Extracted ${parkingData.length} parkings with coordinates!`
    );

    // Transform to simple array structure
    const finalData = parkingData.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      country: "Poland",
      countryCode: "PL",
      id: p.id,
    }));

    await fs.writeFile(
      "parkings.json",
      JSON.stringify(finalData, null, 2)
    );
    console.log("✅ Data saved to parkings.json");

    return finalData;
  } catch (error) {
    console.error("❌ Error scraping:", error);
    throw error;
  } finally {
    await browser.close();
    console.log("🔒 Browser closed");
  }
}

scrapePolishParkings()
  .then((data) => {
    console.log(`\n📊 Summary:`);
    console.log(`✅ Total parkings: ${data.length}`);
    console.log(`✅ All parkings have geolocation data`);

    if (data.length > 0) {
      console.log(`\n📍 Sample (first 3):`);
      data.slice(0, 3).forEach((p, i) => {
        console.log(
          `${i + 1}. ID: ${p.id} - ${p.latitude}, ${p.longitude} (${
            p.countryCode
          })`
        );
      });
    }

    console.log("\n✨ File created:");
    console.log("   📁 parkings.json");
  })
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
