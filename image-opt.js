import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

// Specify folders to process (relative to blogs directory)
const FOLDERS_TO_PROCESS = ["blogs/[1]-cross-border"];

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

  const imageFiles = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext);
  });

  console.log(`Found ${imageFiles.length} image(s)`);

  for (const file of imageFiles) {
    const inputPath = path.join(folderPath, file);
    const ext = path.extname(file);
    let nameWithoutExt = file.slice(0, -ext.length);

    // Handle double extensions like .png.png
    const secondExt = path.extname(nameWithoutExt);
    if (secondExt.toLowerCase() === ext.toLowerCase()) {
      nameWithoutExt = nameWithoutExt.slice(0, -secondExt.length);
    }

    const outputFileName = `${nameWithoutExt}-min${ext}`;
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
