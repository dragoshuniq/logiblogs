import fs from "fs/promises";
import fsSync from "fs";
import https from "https";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import * as cheerio from "cheerio";
import dayjs from "dayjs";
import { getCountryCode, getCurrency } from "./constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "https://energy.ec.europa.eu";
const BULLETIN_PAGE = `${BASE_URL}/data-and-analysis/weekly-oil-bulletin_en`;

/**
 * Fetches HTML content from a URL
 */
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        if (
          response.statusCode === 301 ||
          response.statusCode === 302
        ) {
          // Handle redirects
          return fetchHtml(response.headers.location)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Failed to fetch: ${response.statusCode} ${response.statusMessage}`
            )
          );
          return;
        }

        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          resolve(data);
        });
      })
      .on("error", reject);
  });
}

/**
 * Downloads a file from a URL
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fsSync.createWriteStream(outputPath);

    protocol
      .get(url, (response) => {
        if (
          response.statusCode === 301 ||
          response.statusCode === 302
        ) {
          // Handle redirects
          return downloadFile(response.headers.location, outputPath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Failed to download: ${response.statusCode} ${response.statusMessage}`
            )
          );
          return;
        }

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fsSync.unlink(outputPath, () => {});
        reject(err);
      });
  });
}

/**
 * Fetches historical exchange rate from ECB (European Central Bank)
 * @param {string} targetCurrency - The target currency code (e.g., 'RON', 'PLN')
 * @param {string} dateString - The date in YYYY-MM-DD format
 * @returns {Promise<number|null>} - The exchange rate or null if failed
 */
async function fetchExchangeRate(targetCurrency, dateString) {
  if (targetCurrency === "EUR") {
    return 1; // No conversion needed
  }

  try {
    // ECB API endpoint for historical exchange rates
    // Format: https://data-api.ecb.europa.eu/service/data/EXR/D.{CURRENCY}.EUR.SP00.A
    // We'll use a simpler approach - the ECB daily reference rates XML/JSON endpoint
    const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${targetCurrency}.EUR.SP00.A?startPeriod=${dateString}&endPeriod=${dateString}&format=jsondata`;

    const response = await fetchHtml(url);
    const data = JSON.parse(response);

    // Parse the ECB JSON response
    if (
      data &&
      data.dataSets &&
      data.dataSets[0] &&
      data.dataSets[0].series
    ) {
      const series = data.dataSets[0].series;
      const seriesKey = Object.keys(series)[0];

      if (seriesKey && series[seriesKey].observations) {
        const observations = series[seriesKey].observations;
        const obsKey = Object.keys(observations)[0];

        if (
          obsKey &&
          observations[obsKey] &&
          observations[obsKey][0]
        ) {
          const rate = parseFloat(observations[obsKey][0]);
          if (!isNaN(rate) && rate > 0) {
            return rate;
          }
        }
      }
    }

    console.warn(
      `   ⚠️  Could not fetch exchange rate for EUR-${targetCurrency} on ${dateString} from ECB`
    );
    return null;
  } catch (error) {
    console.warn(
      `   ⚠️  Error fetching exchange rate for EUR-${targetCurrency}:`,
      error.message
    );
    return null;
  }
}

/**
 * Fetches the HTML page to find the latest XLS download link
 */
async function getLatestXlsUrl() {
  const html = await fetchHtml(BULLETIN_PAGE);
  const $ = cheerio.load(html);

  // Find the download link for "Prices with taxes latest prices"
  // Look for links with xlsx files
  let xlsUrl = null;

  // Try to find link with "Prices with taxes" text
  $('a[href*=".xlsx"], a[href*="/document/download/"]').each(
    (i, elem) => {
      const href = $(elem).attr("href");
      const text = $(elem).text().toLowerCase();
      const dataLabel = $(elem).attr("data-untranslated-label") || "";

      if (
        href &&
        (href.includes(".xlsx") ||
          href.includes("/document/download/")) &&
        (text.includes("prices with taxes") ||
          text.includes("prices with taxes latest") ||
          dataLabel.toLowerCase().includes("prices with taxes"))
      ) {
        // Convert relative URL to absolute
        if (href.startsWith("/")) {
          xlsUrl = `${BASE_URL}${href}`;
        } else if (href.startsWith("http")) {
          xlsUrl = href;
        } else {
          xlsUrl = `${BASE_URL}/${href}`;
        }
        return false; // Break the loop
      }
    }
  );

  // Fallback: find any xlsx link
  if (!xlsUrl) {
    $('a[href*=".xlsx"]').each((i, elem) => {
      const href = $(elem).attr("href");
      if (href) {
        if (href.startsWith("/")) {
          xlsUrl = `${BASE_URL}${href}`;
        } else if (href.startsWith("http")) {
          xlsUrl = href;
        } else {
          xlsUrl = `${BASE_URL}/${href}`;
        }
        return false; // Break the loop
      }
    });
  }

  if (!xlsUrl) {
    throw new Error("Could not find XLS download link on the page");
  }

  return xlsUrl;
}

/**
 * Extracts date from the Excel file (second row, first cell)
 */
function extractDateFromExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Get the second row, first cell (A2 in Excel notation)
  // Row index 1 (0-indexed) = second row
  const cellAddress = XLSX.utils.encode_cell({ r: 1, c: 0 });
  const cell = worksheet[cellAddress];

  if (!cell || !cell.v) {
    // Fallback to current date
    const now = dayjs();
    return {
      year: now.year(),
      month: now.month() + 1,
      day: now.date(),
      dateString: now.format("YYYY-MM-DD"),
    };
  }

  let dateValue = cell.v;

  // If the cell is a date object (Excel date serial number)
  if (cell.t === "n" && cell.w) {
    // Try to parse the formatted cell value
    dateValue = cell.w;
  }

  // Parse different date formats
  let parsedDate;

  // Try DD/MM/YYYY format (like 17/11/2025)
  if (
    typeof dateValue === "string" &&
    dateValue.match(/\d{1,2}\/\d{1,2}\/\d{4}/)
  ) {
    const [day, month, year] = dateValue.split("/");
    parsedDate = dayjs(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    );
  }
  // Try if it's already a Date object or Excel serial number
  else if (cell.t === "d" || typeof dateValue === "number") {
    // XLSX can parse Excel dates
    const excelDate = XLSX.SSF.parse_date_code(cell.v);
    parsedDate = dayjs(
      `${excelDate.y}-${String(excelDate.m).padStart(
        2,
        "0"
      )}-${String(excelDate.d).padStart(2, "0")}`
    );
  }
  // Try to parse as a string
  else {
    parsedDate = dayjs(dateValue);
  }

  return {
    year: parsedDate.year(),
    month: parsedDate.month() + 1,
    day: parsedDate.date(),
    dateString: parsedDate.format("YYYY-MM-DD"),
  };
}

/**
 * Gets month name in English
 */
function getMonthName(monthNumber) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[monthNumber - 1];
}

/**
 * Gets the Thursday of the same week for a given date
 * The week is considered to start on Monday (ISO 8601 standard)
 */
function getThursdayOfSameWeek(date) {
  const d = dayjs(date);
  const currentDay = d.day(); // Sunday = 0, Monday = 1, ..., Saturday = 6

  // Calculate the difference to Thursday (4)
  // If current day is Sunday (0), we need to go back to previous week's Thursday
  const diff = currentDay === 0 ? -3 : 4 - currentDay;

  // Set to Thursday of the same week
  const thursday = d.add(diff, "day");

  return {
    year: thursday.year(),
    month: thursday.month() + 1,
    day: thursday.date(),
    dateString: thursday.format("YYYY-MM-DD"),
  };
}

/**
 * Parses the Excel file and extracts 95 petrol and diesel prices
 */
function parseOilPrices(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON with header row
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });

  const results = [];

  // Find the column indices for country, 95 petrol, and diesel
  // The structure may vary, so we need to be flexible
  let countryCol = null;
  let petrol95Col = null;
  let dieselCol = null;

  // Look for header row (usually first row with data)
  const firstRow = data[0];
  if (firstRow) {
    const headers = Object.keys(firstRow);

    // Find country column (could be "Country", "Member State", etc.)
    countryCol = headers.find(
      (h) =>
        h &&
        (h.toLowerCase().includes("country") ||
          h.toLowerCase().includes("member state") ||
          h.toLowerCase().includes("state"))
    );

    // Find 95 petrol column
    petrol95Col = headers.find(
      (h) =>
        h &&
        (h.toLowerCase().includes("95") ||
          h.toLowerCase().includes("eurosuper") ||
          h.toLowerCase().includes("unleaded"))
    );

    // Find diesel column
    dieselCol = headers.find(
      (h) =>
        h &&
        (h.toLowerCase().includes("diesel") ||
          h.toLowerCase().includes("gasoil"))
    );
  }

  if (!countryCol) {
    // Try alternative: look at raw sheet data
    const range = XLSX.utils.decode_range(worksheet["!ref"]);

    // Scan first few rows for headers
    for (let row = 0; row <= Math.min(5, range.e.r); row++) {
      const rowData = [];
      for (let col = 0; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({
          r: row,
          c: col,
        });
        const cell = worksheet[cellAddress];
        if (cell) {
          rowData.push(cell.v);
        } else {
          rowData.push(null);
        }
      }

      // Check if this row contains headers
      const rowStr = rowData.join(" ").toLowerCase();
      if (
        rowStr.includes("country") &&
        (rowStr.includes("95") || rowStr.includes("diesel"))
      ) {
        // Found header row
        countryCol = rowData.findIndex(
          (v) =>
            v &&
            (v.toString().toLowerCase().includes("country") ||
              v.toString().toLowerCase().includes("member state"))
        );
        petrol95Col = rowData.findIndex(
          (v) =>
            v &&
            (v.toString().toLowerCase().includes("95") ||
              v.toString().toLowerCase().includes("eurosuper"))
        );
        dieselCol = rowData.findIndex(
          (v) =>
            v &&
            (v.toString().toLowerCase().includes("diesel") ||
              v.toString().toLowerCase().includes("gasoil"))
        );
        break;
      }
    }
  }

  // If we found columns, extract data
  if (countryCol !== null && countryCol !== undefined) {
    // Parse using column indices
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    let headerRow = 0;

    // Find header row
    for (let row = 0; row <= Math.min(10, range.e.r); row++) {
      const cellAddress = XLSX.utils.encode_cell({
        r: row,
        c: countryCol,
      });
      const cell = worksheet[cellAddress];
      if (
        cell &&
        cell.v &&
        cell.v.toString().toLowerCase().includes("country")
      ) {
        headerRow = row;
        break;
      }
    }

    // Extract data rows
    for (let row = headerRow + 1; row <= range.e.r; row++) {
      const countryCell =
        worksheet[XLSX.utils.encode_cell({ r: row, c: countryCol })];
      const petrolCell =
        petrol95Col !== null
          ? worksheet[
              XLSX.utils.encode_cell({ r: row, c: petrol95Col })
            ]
          : null;
      const dieselCell =
        dieselCol !== null
          ? worksheet[
              XLSX.utils.encode_cell({ r: row, c: dieselCol })
            ]
          : null;

      if (countryCell && countryCell.v) {
        const country = countryCell.v.toString().trim();

        // Skip empty rows or summary rows
        if (country && country.length > 0 && country.length < 50) {
          const petrol95 =
            petrolCell &&
            petrolCell.v !== null &&
            petrolCell.v !== undefined
              ? parseFloat(petrolCell.v)
              : null;
          const diesel =
            dieselCell &&
            dieselCell.v !== null &&
            dieselCell.v !== undefined
              ? parseFloat(dieselCell.v)
              : null;

          if (petrol95 !== null || diesel !== null) {
            results.push({
              country: country,
              countryCode: getCountryCode(country),
              petrol: petrol95, // Renamed from petrol95
              diesel: diesel,
            });
          }
        }
      }
    }
  } else {
    // Fallback: try to parse from JSON data
    for (const row of data) {
      const country =
        row[countryCol] ||
        row["Country"] ||
        row["Member State"] ||
        row["MemberState"] ||
        Object.values(row)[0];

      if (
        country &&
        typeof country === "string" &&
        country.trim().length > 0
      ) {
        // Try to find petrol and diesel values
        const values = Object.values(row).filter(
          (v) =>
            v !== null && v !== undefined && typeof v === "number"
        );

        // This is a fallback - may need adjustment based on actual file structure
        const petrol95 =
          row[petrol95Col] ||
          row["Eurosuper 95"] ||
          row["Unleaded 95"] ||
          null;
        const diesel =
          row[dieselCol] || row["Diesel"] || row["Gasoil"] || null;

        if (petrol95 !== null || diesel !== null) {
          const countryName = country.toString().trim();
          results.push({
            country: countryName,
            countryCode: getCountryCode(countryName),
            // Renamed from petrol95
            petrol:
              typeof petrol95 === "number"
                ? petrol95
                : parseFloat(petrol95) || null,
            diesel:
              typeof diesel === "number"
                ? diesel
                : parseFloat(diesel) || null,
          });
        }
      }
    }
  }

  // Filter out averages (entries containing "Moyenne", "Weighted average", "Gewichteter", "CE/EC/EG", etc.)
  const filtered = results.filter((item) => {
    const countryLower = item.country.toLowerCase();
    const country = item.country;

    // Check for average-related terms
    const isAverage =
      countryLower.includes("moyenne") ||
      countryLower.includes("weighted average") ||
      countryLower.includes("gewichteter") ||
      countryLower.includes("average") ||
      country.includes("CE/EC/EG") || // EU average indicators
      country.includes("EUR27") || // EU27 average
      country.includes("Euro Area"); // Euro area average

    return !isAverage;
  });

  console.log(
    `   📋 Countries after filtering averages: ${filtered.length}`
  );
  console.log(
    `   📋 Countries: ${filtered.map((f) => f.country).join(", ")}`
  );

  return filtered;
}

/**
 * Adds currency conversions for non-Euro countries
 * @param {Array} prices - Array of price objects
 * @param {string} dateString - The date in YYYY-MM-DD format for historical rates
 * @returns {Promise<Array>} - Array with added currency conversion fields
 */
async function addCurrencyConversions(prices, dateString) {
  console.log(
    `💱 Adding currency conversions for non-Euro countries (date: ${dateString})...`
  );

  // Get unique non-Euro currencies
  const currenciesNeeded = new Set();
  for (const price of prices) {
    const currency = getCurrency(price.countryCode);
    if (currency && currency !== "EUR") {
      currenciesNeeded.add(currency);
    }
  }

  // Fetch exchange rates
  const exchangeRates = {};
  for (const currency of currenciesNeeded) {
    console.log(
      `   Fetching EUR-${currency} rate for ${dateString}...`
    );
    const rate = await fetchExchangeRate(currency, dateString);
    if (rate) {
      exchangeRates[currency] = rate;
      console.log(`   ✅ EUR-${currency}: ${rate.toFixed(4)}`);
    }
  }

  // Add currency-specific fields
  let conversionsAdded = 0;
  for (const price of prices) {
    const currency = getCurrency(price.countryCode);
    if (currency && currency !== "EUR" && exchangeRates[currency]) {
      const rate = exchangeRates[currency];

      // Add home currency fields
      price.currencyHome = currency;

      if (price.petrol !== null) {
        price.petrolHome = parseFloat(
          (price.petrol * rate).toFixed(2)
        );
      }
      if (price.diesel !== null) {
        price.dieselHome = parseFloat(
          (price.diesel * rate).toFixed(2)
        );
      }
      conversionsAdded++;
    }
  }

  console.log(
    `   ✅ Added currency conversions for ${conversionsAdded} countries\n`
  );
  return prices;
}

/**
 * Main function to scrape oil prices
 */
async function scrapeOilPrices() {
  console.log("🚀 Starting oil price scraping...\n");

  try {
    // Step 1: Get the latest XLS file URL
    console.log(
      "📡 Fetching bulletin page to find latest XLS file..."
    );
    const xlsUrl = await getLatestXlsUrl();
    console.log(`   ✅ Found XLS URL: ${xlsUrl}\n`);

    // Step 2: Download the XLS file
    const tempFile = path.join(__dirname, "temp-oil-prices.xlsx");
    console.log("⬇️  Downloading XLS file...");
    await downloadFile(xlsUrl, tempFile);
    console.log(`   ✅ Downloaded to ${tempFile}\n`);

    // Step 3: Extract date from the Excel file (second row, first cell)
    console.log("📅 Extracting date from Excel file...");
    const extractedDate = extractDateFromExcel(tempFile);
    console.log(
      `   📅 Extracted date from Excel: ${extractedDate.dateString}`
    );

    // Step 3b: Convert to Thursday of the same week (for oil prices)
    const dateInfo = getThursdayOfSameWeek(extractedDate.dateString);
    console.log(
      `   📅 Adjusted to Thursday of same week: ${dateInfo.dateString}\n`
    );

    // Step 4: Parse the Excel file
    console.log("📊 Parsing Excel file...");
    let prices = parseOilPrices(tempFile);
    console.log(
      `   ✅ Extracted prices for ${prices.length} countries\n`
    );

    // Step 4b: Add currency conversions (using the same date as oil prices)
    prices = await addCurrencyConversions(
      prices,
      dateInfo.dateString
    );

    // Step 5: Create folder structure and save results
    const yearDir = path.join(
      __dirname,
      "data",
      dateInfo.year.toString()
    );
    const monthName = getMonthName(dateInfo.month);
    const monthDir = path.join(
      yearDir,
      `${dateInfo.month}.${monthName}`
    );
    await fs.mkdir(monthDir, { recursive: true });

    // Create object with date as parent key (not nested in "date" and "countries")
    const outputData = {
      [dateInfo.dateString]: prices,
    };

    const outputFile = path.join(
      monthDir,
      `${dateInfo.dateString}.json`
    );
    await fs.writeFile(
      outputFile,
      JSON.stringify(outputData, null, 2)
    );
    console.log(`💾 Saved results to ${outputFile}\n`);

    // Step 6: Clean up temp file
    await fs.unlink(tempFile);
    console.log("🧹 Cleaned up temporary file\n");

    // Display summary
    console.log("📊 Summary:");
    console.log(`   Total countries: ${prices.length}`);
    const withPetrol = prices.filter((p) => p.petrol !== null).length;
    const withDiesel = prices.filter((p) => p.diesel !== null).length;
    const withCurrencyConversion = prices.filter(
      (p) => p.currencyHome !== undefined
    ).length;
    console.log(`   Countries with petrol data: ${withPetrol}`);
    console.log(`   Countries with diesel data: ${withDiesel}`);
    console.log(
      `   Countries with currency conversions: ${withCurrencyConversion}\n`
    );

    // Show first few results
    console.log("📋 Sample data (first 5 countries):");
    prices.slice(0, 5).forEach((p) => {
      const homeFields = p.currencyHome
        ? `, ${p.currencyHome}: petrolHome=${p.petrolHome}, dieselHome=${p.dieselHome}`
        : "";
      console.log(
        `   ${p.country}: Petrol=${p.petrol ?? "N/A"}, Diesel=${
          p.diesel ?? "N/A"
        }${homeFields}`
      );
    });

    return prices;
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
scrapeOilPrices()
  .then(() => {
    console.log("\n✨ Done!");
  })
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
