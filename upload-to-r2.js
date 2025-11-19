import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

// R2 Configuration - Loaded from .env file
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

// Validate required environment variables
if (
  !R2_ACCOUNT_ID ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET_NAME
) {
  console.error(
    "Error: Missing required R2 configuration in .env file"
  );
  console.error("Please ensure the following variables are set:");
  console.error("  - R2_ACCOUNT_ID");
  console.error("  - R2_ACCESS_KEY_ID");
  console.error("  - R2_SECRET_ACCESS_KEY");
  console.error("  - R2_BUCKET_NAME");
  process.exit(1);
}

// Initialize R2 client (R2 is S3-compatible)
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const BLOGS_DIR = path.join(__dirname, "blogs");
const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
];

/**
 * Check if a file is an image based on extension
 */
function isImage(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Check if filename should be excluded (contains 'orig')
 */
function shouldExclude(filename) {
  return filename.includes("orig");
}

/**
 * Find the base JSON file (without language suffix) in a directory
 */
function findBaseJson(dirPath) {
  const files = fs.readdirSync(dirPath);

  // Look for JSON files
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  // Find the one without language code (e.g., cross-border.json, not cross-border.de.json)
  // Base JSON will have pattern: name.json (not name.XX.json where XX is language code)
  for (const jsonFile of jsonFiles) {
    const parts = jsonFile.split(".");
    // Base JSON: [name, 'json'] -> length 2
    // Language JSON: [name, 'de', 'json'] -> length 3
    if (parts.length === 2) {
      return path.join(dirPath, jsonFile);
    }
  }

  return null;
}

/**
 * Upload a file to R2
 */
async function uploadToR2(filePath, r2Key) {
  try {
    const fileContent = fs.readFileSync(filePath);
    const contentType = getContentType(filePath);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: fileContent,
      ContentType: contentType,
    });

    await r2Client.send(command);
    console.log(`✓ Uploaded: ${r2Key}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to upload ${r2Key}:`, error.message);
    return false;
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
  return contentTypes[ext] || "application/octet-stream";
}

/**
 * Process a single blog subfolder
 */
async function processBlogFolder(folderPath, folderName) {
  console.log(`\nProcessing: ${folderName}`);

  // Find base JSON file
  const jsonPath = findBaseJson(folderPath);
  if (!jsonPath) {
    console.log(`  ⚠ No base JSON file found, skipping`);
    return { success: 0, failed: 0, skipped: 0 };
  }

  // Read and parse JSON to get shortId
  let shortId;
  try {
    const jsonContent = fs.readFileSync(jsonPath, "utf8");
    const data = JSON.parse(jsonContent);
    shortId = data.shortId;

    if (!shortId) {
      console.log(`  ⚠ No shortId found in JSON, skipping`);
      return { success: 0, failed: 0, skipped: 0 };
    }

    console.log(`  shortId: ${shortId}`);
  } catch (error) {
    console.log(`  ✗ Failed to read JSON: ${error.message}`);
    return { success: 0, failed: 0, skipped: 0 };
  }

  // Find all images in the folder
  const files = fs.readdirSync(folderPath);
  const images = files.filter((f) => isImage(f) && !shouldExclude(f));

  if (images.length === 0) {
    console.log(`  ⚠ No images to upload`);
    return { success: 0, failed: 0, skipped: 0 };
  }

  console.log(`  Found ${images.length} image(s) to upload`);

  // Upload each image
  let successCount = 0;
  let failedCount = 0;

  for (const image of images) {
    const imagePath = path.join(folderPath, image);
    const r2Key = `blog/${shortId}/${image}`;

    const uploaded = await uploadToR2(imagePath, r2Key);
    if (uploaded) {
      successCount++;
    } else {
      failedCount++;
    }
  }

  return { success: successCount, failed: failedCount, skipped: 0 };
}

/**
 * Main function
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Cloudflare R2 Image Upload Script");
  console.log("=".repeat(60));
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log(`Source: ${BLOGS_DIR}`);
  console.log("=".repeat(60));

  // Check if blogs directory exists
  if (!fs.existsSync(BLOGS_DIR)) {
    console.error(`Error: Blogs directory not found at ${BLOGS_DIR}`);
    process.exit(1);
  }

  // Get all subdirectories in blogs folder
  const entries = fs.readdirSync(BLOGS_DIR, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  console.log(`\nFound ${folders.length} blog folder(s)\n`);

  // Process each folder
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const folder of folders) {
    const folderPath = path.join(BLOGS_DIR, folder);
    const stats = await processBlogFolder(folderPath, folder);
    totalSuccess += stats.success;
    totalFailed += stats.failed;
    totalSkipped += stats.skipped;
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Upload Summary");
  console.log("=".repeat(60));
  console.log(`✓ Successfully uploaded: ${totalSuccess}`);
  console.log(`✗ Failed: ${totalFailed}`);
  console.log(`⚠ Skipped: ${totalSkipped}`);
  console.log("=".repeat(60));

  if (totalFailed > 0) {
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
