import { mkdir, writeFile, rm, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import {
  PREFILLED_NESTLE_BANNER_CAMPAIGNS,
  buildPrefilledNestleBannerPrompt,
} from '../data/prefilledNestleBanners.js';

const execFile = promisify(execFileCallback);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const generatedRoot = path.join(projectRoot, 'public', 'generated-banners');
const tempRoot = path.join(projectRoot, 'tmp', 'generated-banners');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'high';
const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

if (!OPENAI_API_KEY && !DRY_RUN) {
  console.error('Missing OPENAI_API_KEY. Export the key and rerun this script.');
  process.exit(1);
}

function ensureOk(response, payload) {
  if (response.ok) return;
  const message =
    typeof payload?.error?.message === 'string'
      ? payload.error.message
      : `OpenAI request failed with status ${response.status}`;
  throw new Error(message);
}

function parseDimensions(dimensions) {
  const match = dimensions.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return { width: 1200, height: 628 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

function generationSizeForFormat(width, height) {
  const ratio = width / height;
  if (ratio >= 1.2) return '1536x1024';
  if (ratio <= 0.83) return '1024x1536';
  return '1024x1024';
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generateBaseImage(prompt, size) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size,
      quality: OPENAI_IMAGE_QUALITY,
      output_format: 'png',
    }),
  });

  const payload = await response.json();
  ensureOk(response, payload);

  const base64 =
    payload?.data?.[0]?.b64_json ??
    payload?.output?.find?.((entry) => entry.type === 'image_generation_call')?.result;

  if (!base64) {
    throw new Error('OpenAI did not return base64 image data.');
  }

  return Buffer.from(base64, 'base64');
}

async function runSips(args) {
  await execFile('/usr/bin/sips', args);
}

async function resizeAndCropToFormat(filePath, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  if (sourceRatio <= targetRatio) {
    await runSips(['--resampleWidth', String(targetWidth), filePath]);
  } else {
    await runSips(['--resampleHeight', String(targetHeight), filePath]);
  }

  await runSips(['-c', String(targetHeight), String(targetWidth), filePath]);
}

async function generateFormat(campaign, format) {
  const outputDir = path.join(generatedRoot, campaign.slug);
  const outputPath = path.join(outputDir, format.fileName);
  const alreadyExists = await fileExists(outputPath);

  if (alreadyExists && !FORCE) {
    console.log(`Skipping existing ${campaign.slug}/${format.fileName}`);
    return;
  }

  const prompt = buildPrefilledNestleBannerPrompt(
    campaign.campaignId,
    format.label,
    format.dimensions
  );
  const { width, height } = parseDimensions(format.dimensions);
  const baseSize = generationSizeForFormat(width, height);
  const { width: sourceWidth, height: sourceHeight } = parseDimensions(baseSize.replace('x', ' x '));

  if (DRY_RUN) {
    console.log(`[dry-run] ${campaign.slug}/${format.fileName}`);
    console.log(`  size: ${baseSize} -> ${width}x${height}`);
    console.log(`  prompt: ${prompt}`);
    return;
  }

  const buffer = await generateBaseImage(prompt, baseSize);

  await mkdir(outputDir, { recursive: true });
  await mkdir(tempRoot, { recursive: true });

  const tempFile = path.join(tempRoot, `${campaign.slug}-${format.fileName}`);
  await writeFile(tempFile, buffer);
  await resizeAndCropToFormat(tempFile, sourceWidth, sourceHeight, width, height);
  await writeFile(outputPath, await readFile(tempFile));
  await rm(tempFile, { force: true });

  console.log(`Generated ${campaign.slug}/${format.fileName}`);
}

async function main() {
  await mkdir(generatedRoot, { recursive: true });

  for (const campaign of PREFILLED_NESTLE_BANNER_CAMPAIGNS) {
    for (const format of campaign.formats) {
      await generateFormat(campaign, format);
    }
  }

  if (!DRY_RUN) {
    console.log('Finished generating prefilled Nestlé banner PNGs.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
