import fs from "fs/promises";
import https from "https";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";
import * as cheerio from "cheerio";

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
    const file = fs.createWriteStream(outputPath);

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
        fs.unlink(outputPath).catch(() => {});
        reject(err);
      });
  });
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
              petrol95: petrol95,
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
          results.push({
            country: country.toString().trim(),
            petrol95:
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

  return results;
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

    // Step 3: Parse the Excel file
    console.log("📊 Parsing Excel file...");
    const prices = parseOilPrices(tempFile);
    console.log(
      `   ✅ Extracted prices for ${prices.length} countries\n`
    );

    // Step 4: Save results
    const dataDir = path.join(__dirname, "data");
    await fs.mkdir(dataDir, { recursive: true });
    const outputFile = path.join(dataDir, "oil-prices.json");
    await fs.writeFile(outputFile, JSON.stringify(prices, null, 2));
    console.log(`💾 Saved results to ${outputFile}\n`);

    // Step 5: Clean up temp file
    await fs.unlink(tempFile);
    console.log("🧹 Cleaned up temporary file\n");

    // Display summary
    console.log("📊 Summary:");
    console.log(`   Total countries: ${prices.length}`);
    const withPetrol95 = prices.filter(
      (p) => p.petrol95 !== null
    ).length;
    const withDiesel = prices.filter((p) => p.diesel !== null).length;
    console.log(`   Countries with 95 petrol data: ${withPetrol95}`);
    console.log(`   Countries with diesel data: ${withDiesel}\n`);

    // Show first few results
    console.log("📋 Sample data (first 5 countries):");
    prices.slice(0, 5).forEach((p) => {
      console.log(
        `   ${p.country}: 95 Petrol=${p.petrol95 ?? "N/A"}, Diesel=${
          p.diesel ?? "N/A"
        }`
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
