import { GoogleGenAI } from "@google/genai";
import mime from "mime";
import { writeFile, readFile, mkdir, readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ImagePrompt {
  blogFolder: string;
  imageTitle: string;
  prompt: string;
}

interface BlogContent {
  type: string;
  src?: string;
  alt?: string;
  caption?: string;
}

interface BlogData {
  image?: string;
  imageAlt?: string;
  content?: BlogContent[];
}

async function extractImagePromptsFromBlogs(): Promise<
  ImagePrompt[]
> {
  const blogsDir = path.join(__dirname, "..", "blogs");
  const folders = await readdir(blogsDir, { withFileTypes: true });
  const prompts: ImagePrompt[] = [];

  for (const folder of folders) {
    if (!folder.isDirectory() || !folder.name.startsWith("["))
      continue;

    const folderPath = path.join(blogsDir, folder.name);
    const enJsonPath = path.join(
      folderPath,
      folder.name.replace(/^\[\d+\]-/, "") + ".en.json"
    );

    if (!existsSync(enJsonPath)) continue;

    const blogData: BlogData = JSON.parse(
      await readFile(enJsonPath, "utf-8")
    );

    if (blogData.image && blogData.imageAlt) {
      const imageTitle = blogData.image.replace(
        /\.(png|jpg|jpeg)$/i,
        ""
      );
      prompts.push({
        blogFolder: folder.name,
        imageTitle,
        prompt: blogData.imageAlt,
      });
    }

    if (blogData.content) {
      for (const item of blogData.content) {
        if (item.type === "image" && item.src && item.alt) {
          const imageTitle = item.src.replace(
            /\.(png|jpg|jpeg)$/i,
            ""
          );
          prompts.push({
            blogFolder: folder.name,
            imageTitle,
            prompt: item.alt,
          });
        }
      }
    }
  }

  return prompts;
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
  imagePrompt: ImagePrompt,
  blogsDir: string,
  retryCount = 0
) {
  const maxRetries = 2;
  const { blogFolder, imageTitle, prompt } = imagePrompt;
  console.log(`\n🎨 Generating: ${blogFolder}/${imageTitle}-orig...`);

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
          text: `Generate a professional, realistic image for a logistics blog article. ${prompt}`,
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

        const outputFolder = path.join(blogsDir, blogFolder);
        const fileName = path.join(
          outputFolder,
          `${imageTitle}-orig.${fileExtension}`
        );
        await saveBinaryFile(fileName, buffer);
        imageGenerated = true;
      } else if (chunk.text) {
        console.log(`  ${chunk.text}`);
      }
    }

    if (!imageGenerated) {
      console.log(`  ⚠️ No image generated for ${imageTitle}`);
    }
  } catch (error: any) {
    if (
      retryCount < maxRetries &&
      (error.message?.includes("terminated") ||
        error.message?.includes("closed") ||
        error.code === "UND_ERR_SOCKET")
    ) {
      console.log(
        `  ⚠️ Connection issue, retrying ${imageTitle} (attempt ${
          retryCount + 1
        }/${maxRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return generateImage(ai, imagePrompt, blogsDir, retryCount + 1);
    }
    console.error(
      `✗ Error generating ${imageTitle}:`,
      error.message || error
    );
  }
}

async function generateImagesInParallel(
  ai: GoogleGenAI,
  prompts: ImagePrompt[],
  blogsDir: string,
  concurrency: number = 3
) {
  const results = [];
  for (let i = 0; i < prompts.length; i += concurrency) {
    const batch = prompts.slice(i, i + concurrency);
    console.log(
      `\n📦 Processing batch ${
        Math.floor(i / concurrency) + 1
      }/${Math.ceil(prompts.length / concurrency)} (${
        batch.length
      } images)...`
    );

    const batchPromises = batch.map((imagePrompt) =>
      generateImage(ai, imagePrompt, blogsDir)
    );

    await Promise.all(batchPromises);
  }
  return results;
}

async function main() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const blogsDir = path.join(__dirname, "..", "blogs");
  const promptsOutputPath = path.join(
    __dirname,
    "blog-image-prompts.json"
  );

  console.log(
    "\n📋 Step 1: Extracting image prompts from blog folders...\n"
  );
  const prompts = await extractImagePromptsFromBlogs();
  console.log(
    `\n✓ Found ${prompts.length} images across all blog folders`
  );

  await writeFile(
    promptsOutputPath,
    JSON.stringify(prompts, null, 2)
  );
  console.log(`✓ Saved prompts to: ${promptsOutputPath}\n`);

  console.log(
    "\n🚀 Step 2: Generating images in parallel (3 at a time)...\n"
  );

  await generateImagesInParallel(ai, prompts, blogsDir, 3);

  console.log(`\n✅ Completed! All images saved with -orig suffix`);
}

main();
