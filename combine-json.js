import fs from "fs/promises";
import path from "path";
import { FOLDERS_TO_PROCESS } from "./constants.js";

/**
 * Combines all JSON files from blog folders into a single file
 */
async function combineJsonFiles() {
  console.log("Starting JSON file combination...");

  const combinedData = [];

  for (const folder of FOLDERS_TO_PROCESS) {
    try {
      console.log(`Processing folder: ${folder}`);

      const files = await fs.readdir(folder);

      // Find JSON files in the folder
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      console.log(`Found ${jsonFiles.length} JSON file(s) in ${folder}`);

      for (const jsonFile of jsonFiles) {
        const filePath = path.join(folder, jsonFile);

        try {
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const jsonData = JSON.parse(fileContent);

          combinedData.push(jsonData);
          console.log(`✓ Added: ${jsonFile}`);

        } catch (error) {
          console.error(`✗ Error parsing ${filePath}:`, error.message);
        }
      }

    } catch (error) {
      console.error(`✗ Error processing folder ${folder}:`, error.message);
    }
  }

  // Write combined data to a single file
  const outputFile = 'combined-blogs.json';
  await fs.writeFile(outputFile, JSON.stringify(combinedData, null, 2));

  console.log(`\n✓ Successfully combined ${combinedData.length} blog posts into ${outputFile}`);
  console.log(`Output file: ${outputFile}`);
}

// Run the script
combineJsonFiles().catch(console.error);
