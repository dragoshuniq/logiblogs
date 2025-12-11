import { GoogleGenAI } from "@google/genai";
import mime from "mime";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Prompt {
  id: string;
  prompt: string;
}

interface GenerationResult {
  id: string;
  success: boolean;
  error?: string;
}

async function saveBinaryFile(fileName: string, content: Buffer) {
  try {
    await writeFile(fileName, content);
    console.log(`✓ Saved: ${fileName}`);
  } catch (err) {
    console.error(`✗ Error saving ${fileName}:`, err);
  }
}

async function generateImage(
  ai: GoogleGenAI,
  prompt: string,
  id: string,
  outputDir: string,
  logoBase64: string,
  retryCount = 0
): Promise<GenerationResult> {
  const maxRetries = 2;
  console.log(`🎨 Starting generation: ${id}...`);

  const tools = [
    {
      googleSearch: {},
    },
  ];

  const config = {
    responseModalities: ["IMAGE", "TEXT"],
    imageConfig: {
      imageSize: "4K",
    },
    tools,
    timeout: 180000,
  };

  const model = "gemini-3-pro-image-preview";
  const contents = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: "image/png",
            data: logoBase64,
          },
        },
        {
          text: `${prompt}`,
        },
      ],
    },
  ];

  try {
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let imageGenerated = false;

    for await (const chunk of response) {
      if (
        !chunk.candidates ||
        !chunk.candidates[0].content ||
        !chunk.candidates[0].content.parts
      ) {
        continue;
      }

      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const inlineData =
          chunk.candidates[0].content.parts[0].inlineData;
        const fileExtension = mime.getExtension(
          inlineData.mimeType || ""
        );
        const buffer = Buffer.from(inlineData.data || "", "base64");

        const fileName = path.join(
          outputDir,
          `${id}.${fileExtension}`
        );
        await saveBinaryFile(fileName, buffer);
        imageGenerated = true;
      } else if (chunk.text) {
        console.log(`  [${id}] ${chunk.text}`);
      }
    }

    if (!imageGenerated) {
      console.log(`⚠️ No image generated for ${id}`);
    }

    return { id, success: imageGenerated };
  } catch (error: any) {
    if (
      retryCount < maxRetries &&
      (error.message?.includes("terminated") ||
        error.message?.includes("closed") ||
        error.code === "UND_ERR_SOCKET")
    ) {
      console.log(
        `⚠️ Connection issue, retrying ${id} (attempt ${
          retryCount + 1
        }/${maxRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return generateImage(
        ai,
        prompt,
        id,
        outputDir,
        logoBase64,
        retryCount + 1
      );
    }
    console.error(
      `✗ Error generating ${id}:`,
      error.message || error
    );
    return { id, success: false, error: error.message };
  }
}

async function main() {
  const PARALLEL_LIMIT = 3;

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const promptsPath = path.join(__dirname, "prompts-v10.json");
  const logoPath = path.join(__dirname, "blogo.png");
  const outputDir = path.join(__dirname, "images");

  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }

  if (!existsSync(logoPath)) {
    console.error(`✗ Logo not found: ${logoPath}`);
    process.exit(1);
  }

  const logoBuffer = await readFile(logoPath);
  const logoBase64 = logoBuffer.toString("base64");

  const promptsData = await readFile(promptsPath, "utf-8");
  const prompts: Prompt[] = JSON.parse(promptsData);

  console.log(
    `\n🚀 Starting parallel image generation for ${prompts.length} prompts (${PARALLEL_LIMIT} at a time)...\n`
  );

  const results: GenerationResult[] = [];

  for (let i = 0; i < prompts.length; i += PARALLEL_LIMIT) {
    const batch = prompts.slice(i, i + PARALLEL_LIMIT);
    console.log(
      `\n📦 Processing batch ${
        Math.floor(i / PARALLEL_LIMIT) + 1
      }/${Math.ceil(prompts.length / PARALLEL_LIMIT)} (${batch
        .map((p) => p.id)
        .join(", ")})...\n`
    );

    const batchPromises = batch.map(({ id, prompt }) =>
      generateImage(ai, prompt, id, outputDir, logoBase64)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    console.log(
      `\n✓ Batch ${Math.floor(i / PARALLEL_LIMIT) + 1} completed\n`
    );
  }

  const successful = results.filter((r) => r?.success).length;
  const failed = results.length - successful;

  console.log(`\n✅ Completed! Images saved in: ${outputDir}`);
  console.log(
    `📊 Summary: ${successful} successful, ${failed} failed`
  );
}

main();
