import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

// Specify folders to process (relative to blogs directory)
const FOLDERS_TO_PROCESS = [
  "blogs/[1]-cross-border",
  "blogs/[2]-incoterms",
  "blogs/[3]-ftl-groupage",
  "blogs/[4]-transit-times",
  "blogs/[5]-fuel-surcharges",
  "blogs/[6]-seasonality",
  "blogs/[7]-packaging-palletization",
  "blogs/[8]-freight-forwarder",
  "blogs/[9]-damage-claims",
  "blogs/[10]-sustainability",
  "blogs/[11]-ai-route-optimization",
  "blogs/[12]-digital-forwarding",
];

async function optimizeImage(inputPath, outputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const sharpInstance = sharp(inputPath).resize({
    width: 1200,
    withoutEnlargement: true,
  });

  // Keep original format
  if (ext === ".png") {
    await sharpInstance
      .png({
        quality: 80,
        compressionLevel: 9,
      })
      .toFile(outputPath);
  } else if (ext === ".jpg" || ext === ".jpeg") {
    await sharpInstance
      .jpeg({
        quality: 80,
        mozjpeg: true,
      })
      .toFile(outputPath);
  } else if (ext === ".webp") {
    await sharpInstance
      .webp({
        quality: 80,
      })
      .toFile(outputPath);
  } else {
    // Default to original format
    await sharpInstance.toFile(outputPath);
  }

  console.log("✓ Optimized:", outputPath);
}

async function processFolder(folderPath) {
  console.log(`\nProcessing folder: ${folderPath}`);

  const files = await fs.readdir(folderPath);
  const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

  // Only process files ending with -orig before the extension
  const imageFiles = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    if (!imageExtensions.includes(ext)) return false;

    const nameWithoutExt = file.slice(0, -ext.length);
    return nameWithoutExt.endsWith("-orig");
  });

  console.log(
    `Found ${imageFiles.length} -orig image(s) to optimize`
  );

  for (const file of imageFiles) {
    const inputPath = path.join(folderPath, file);
    const ext = path.extname(file);
    const nameWithoutExt = file.slice(0, -ext.length);

    // Remove -orig suffix
    const finalName = nameWithoutExt.slice(0, -5); // Remove "-orig"
    const outputFileName = `${finalName}${ext}`;
    const outputPath = path.join(folderPath, outputFileName);

    try {
      await optimizeImage(inputPath, outputPath);
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
    }
  }
}

async function main() {
  console.log("Starting image optimization...");

  for (const folder of FOLDERS_TO_PROCESS) {
    try {
      await processFolder(folder);
    } catch (error) {
      console.error(
        `✗ Error processing folder ${folder}:`,
        error.message
      );
    }
  }

  console.log("\n✓ All done!");
}

main().catch(console.error);
