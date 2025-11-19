import fs from "fs";
import path from "path";

// Get the path from command line arguments
const targetPath = process.argv[2] || "./blogs/combined-blogs.json";

function analyzeJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    const results = {
      file: path.basename(filePath),
      path: filePath,
      type: Array.isArray(data) ? "array" : typeof data,
    };

    if (Array.isArray(data)) {
      results.length = data.length;
    } else if (typeof data === "object" && data !== null) {
      // Find all array properties
      const arrayProps = {};
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          arrayProps[key] = value.length;
        }
      }
      if (Object.keys(arrayProps).length > 0) {
        results.arrayProperties = arrayProps;
      }
    }

    return results;
  } catch (error) {
    return {
      file: path.basename(filePath),
      path: filePath,
      error: error.message,
    };
  }
}

function analyzeDirectory(dirPath) {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];

  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);

    if (file.isDirectory()) {
      results.push(...analyzeDirectory(fullPath));
    } else if (file.name.endsWith(".json")) {
      results.push(analyzeJSON(fullPath));
    }
  }

  return results;
}

// Main execution
const fullPath = path.resolve(targetPath);
const stats = fs.statSync(fullPath);

let results = [];

if (stats.isDirectory()) {
  console.log(`Analyzing all JSON files in directory: ${fullPath}\n`);
  results = analyzeDirectory(fullPath);
} else if (stats.isFile() && fullPath.endsWith(".json")) {
  console.log(`Analyzing JSON file: ${fullPath}\n`);
  results = [analyzeJSON(fullPath)];
} else {
  console.error("Please provide a valid JSON file or directory path");
  process.exit(1);
}

// Display results
console.log("JSON Array Length Analysis:");
console.log("=".repeat(80));

results.forEach((result, index) => {
  console.log(`\n${index + 1}. ${result.file}`);
  console.log(`   Path: ${result.path}`);

  if (result.error) {
    console.log(`   Error: ${result.error}`);
  } else {
    console.log(`   Type: ${result.type}`);

    if (result.length !== undefined) {
      console.log(`   Length: ${result.length}`);
    }

    if (result.arrayProperties) {
      console.log("   Array properties:");
      for (const [key, length] of Object.entries(
        result.arrayProperties
      )) {
        console.log(`     - ${key}: ${length}`);
      }
    }
  }
});

// Summary
console.log("\n" + "=".repeat(80));
console.log(`Total files analyzed: ${results.length}`);
const totalArrays = results.filter((r) => r.type === "array").length;
const totalObjects = results.filter(
  (r) => r.type === "object"
).length;
console.log(
  `Arrays: ${totalArrays}, Objects with arrays: ${totalObjects}`
);
