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
) {
  const maxRetries = 2;
  console.log(`\n🎨 Generating image: ${id}...`);

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
        console.log(`  ${chunk.text}`);
      }
    }

    if (!imageGenerated) {
      console.log(`  ⚠️ No image generated for ${id}`);
    }
  } catch (error: any) {
    if (
      retryCount < maxRetries &&
      (error.message?.includes("terminated") ||
        error.message?.includes("closed") ||
        error.code === "UND_ERR_SOCKET")
    ) {
      console.log(
        `  ⚠️ Connection issue, retrying ${id} (attempt ${
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
  }
}

async function main() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const promptsPath = path.join(__dirname, "prompts-v11.json");
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
    `\n🚀 Starting image generation for ${prompts.length} prompts...\n`
  );

  for (const { id, prompt } of prompts) {
    await generateImage(ai, prompt, id, outputDir, logoBase64);
  }

  console.log(`\n✅ Completed! Images saved in: ${outputDir}`);
}

main();
