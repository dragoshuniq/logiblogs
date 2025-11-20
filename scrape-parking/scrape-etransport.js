import puppeteer from "puppeteer";
import fs from "fs/promises";

const BASE_URL = "https://etransport.pl/";

const COUNTRIES = [
  {
    path: "dobre_parkingi,albania,2",
    country: "Albania",
    countryCode: "AL",
  },
  {
    path: "dobre_parkingi,austria,14",
    country: "Austria",
    countryCode: "AT",
  },
  {
    path: "dobre_parkingi,belgia,20",
    country: "Belgium",
    countryCode: "BE",
  },
  {
    path: "dobre_parkingi,bosnia_i_hercegowina,27",
    country: "Bosnia and Herzegovina",
    countryCode: "BA",
  },
  {
    path: "dobre_parkingi,bulgaria,32",
    country: "Bulgaria",
    countryCode: "BG",
  },
  {
    path: "dobre_parkingi,chorwacja,37",
    country: "Croatia",
    countryCode: "HR",
  },
  {
    path: "dobre_parkingi,czarnogora,40",
    country: "Montenegro",
    countryCode: "ME",
  },
  {
    path: "dobre_parkingi,czechy,41",
    country: "Czech Republic",
    countryCode: "CZ",
  },
  {
    path: "dobre_parkingi,dania,42",
    country: "Denmark",
    countryCode: "DK",
  },
  {
    path: "dobre_parkingi,estonia,50",
    country: "Estonia",
    countryCode: "EE",
  },
  {
    path: "dobre_parkingi,finlandia,55",
    country: "Finland",
    countryCode: "FI",
  },
  {
    path: "dobre_parkingi,francja,56",
    country: "France",
    countryCode: "FR",
  },
  {
    path: "dobre_parkingi,grecja,61",
    country: "Greece",
    countryCode: "GR",
  },
  {
    path: "dobre_parkingi,hiszpania,75",
    country: "Spain",
    countryCode: "ES",
  },
  {
    path: "dobre_parkingi,holandia,76",
    country: "Netherlands",
    countryCode: "NL",
  },
  {
    path: "dobre_parkingi,irlandia,81",
    country: "Ireland",
    countryCode: "IE",
  },
  {
    path: "dobre_parkingi,liechtenstein,107",
    country: "Liechtenstein",
    countryCode: "LI",
  },
  {
    path: "dobre_parkingi,litwa,108",
    country: "Lithuania",
    countryCode: "LT",
  },
  {
    path: "dobre_parkingi,luksemburg,109",
    country: "Luxembourg",
    countryCode: "LU",
  },
  {
    path: "dobre_parkingi,lotwa,110",
    country: "Latvia",
    countryCode: "LV",
  },
  {
    path: "dobre_parkingi,macedonia,111",
    country: "North Macedonia",
    countryCode: "MK",
  },
  {
    path: "dobre_parkingi,moldawia,126",
    country: "Moldova",
    countryCode: "MD",
  },
  {
    path: "dobre_parkingi,niemcy,135",
    country: "Germany",
    countryCode: "DE",
  },
  {
    path: "dobre_parkingi,norwegia,140",
    country: "Norway",
    countryCode: "NO",
  },
  {
    path: "dobre_parkingi,polska,151",
    country: "Poland",
    countryCode: "PL",
  },
  {
    path: "dobre_parkingi,portugalia,153",
    country: "Portugal",
    countryCode: "PT",
  },
  {
    path: "dobre_parkingi,rumunia,157",
    country: "Romania",
    countryCode: "RO",
  },
  {
    path: "dobre_parkingi,serbia,168",
    country: "Serbia",
    countryCode: "RS",
  },
  {
    path: "dobre_parkingi,slowacja,172",
    country: "Slovakia",
    countryCode: "SK",
  },
  {
    path: "dobre_parkingi,slowenia,173",
    country: "Slovenia",
    countryCode: "SI",
  },
  {
    path: "dobre_parkingi,szwajcaria,181",
    country: "Switzerland",
    countryCode: "CH",
  },
  {
    path: "dobre_parkingi,szwecja,182",
    country: "Sweden",
    countryCode: "SE",
  },
  {
    path: "dobre_parkingi,turcja,193",
    country: "Turkey",
    countryCode: "TR",
  },
  {
    path: "dobre_parkingi,ukraina,198",
    country: "Ukraine",
    countryCode: "UA",
  },
  {
    path: "dobre_parkingi,wielka_brytania,205",
    country: "United Kingdom",
    countryCode: "GB",
  },
  {
    path: "dobre_parkingi,wegry,212",
    country: "Hungary",
    countryCode: "HU",
  },
  {
    path: "dobre_parkingi,wlochy,213",
    country: "Italy",
    countryCode: "IT",
  },
];

async function scrapeCountryParkings(page, countryInfo) {
  const url = `${BASE_URL}${countryInfo.path}`;
  console.log(
    `\n🌍 Scraping ${countryInfo.country} (${countryInfo.countryCode})...`
  );
  console.log(`   URL: ${url}`);

  try {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

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
          });
        }
      }

      return parkings;
    });

    console.log(`   ✅ Found ${parkingData.length} parkings`);

    return parkingData.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      country: countryInfo.country,
      countryCode: countryInfo.countryCode,
      id: p.id,
    }));
  } catch (error) {
    console.error(
      `   ❌ Error scraping ${countryInfo.country}:`,
      error.message
    );
    return [];
  }
}

async function scrapeAllParkings() {
  console.log("🚀 Starting etransport.pl parking scraper...");
  console.log(`📋 Countries to scrape: ${COUNTRIES.length}\n`);

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

    let allParkings = [];

    for (const countryInfo of COUNTRIES) {
      const countryParkings = await scrapeCountryParkings(
        page,
        countryInfo
      );
      allParkings = allParkings.concat(countryParkings);

      // Small delay between countries to be respectful
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await fs.writeFile(
      "eparkings.json",
      JSON.stringify(allParkings, null, 2)
    );
    console.log("\n✅ Data saved to parkings.json");

    return allParkings;
  } catch (error) {
    console.error("❌ Error scraping:", error);
    throw error;
  } finally {
    await browser.close();
    console.log("🔒 Browser closed");
  }
}

scrapeAllParkings()
  .then((data) => {
    console.log(`\n📊 Summary:`);
    console.log(`✅ Total parkings scraped: ${data.length}`);

    // Group by country
    const byCountry = {};
    data.forEach((p) => {
      if (!byCountry[p.countryCode]) {
        byCountry[p.countryCode] = {
          country: p.country,
          count: 0,
        };
      }
      byCountry[p.countryCode].count++;
    });

    console.log(`\n📍 Parkings by country:`);
    Object.entries(byCountry)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([code, info]) => {
        console.log(
          `   ${code}: ${info.count} parkings (${info.country})`
        );
      });

    if (data.length > 0) {
      console.log(`\n🔍 Sample (first 3):`);
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
