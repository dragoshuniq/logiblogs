import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { FOLDERS_TO_PROCESS } from "./constants.js";

async function optimizeImage(inputPath, outputPath) {
  const ext = path.extname(inputPath).toLowerCase();

  // Load and resize watermark
  const watermark = await sharp("blogo.png")
    .resize({
      width: 150, // Fixed watermark size
      height: 43,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  const sharpInstance = sharp(inputPath).resize({
    width: 1200,
    withoutEnlargement: true,
  });

  // Add watermark to the right side
  const processedImage = await sharpInstance
    .composite([
      {
        input: watermark,
        top: 20, // 20px from top
        left: 1200 - 170, // Position from right edge (1200 - 150 - 20px margin)
        opacity: 0.7, // Semi-transparent
      },
    ])
    .toBuffer();

  // Keep original format
  if (ext === ".png") {
    await sharp(processedImage)
      .png({
        quality: 80,
        compressionLevel: 9,
      })
      .toFile(outputPath);
  } else if (ext === ".jpg" || ext === ".jpeg") {
    await sharp(processedImage)
      .jpeg({
        quality: 80,
        mozjpeg: true,
      })
      .toFile(outputPath);
  } else if (ext === ".webp") {
    await sharp(processedImage)
      .webp({
        quality: 80,
      })
      .toFile(outputPath);
  } else {
    // Default to original format
    await sharp(processedImage).toFile(outputPath);
  }

  console.log("✓ Optimized with watermark:", outputPath);
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
