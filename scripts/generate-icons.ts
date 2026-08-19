// Generates PNG app icons from public/logo.svg.
// Run with: bun run scripts/generate-icons.ts
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const OUT_DIR = "public/icons";
mkdirSync(OUT_DIR, { recursive: true });

const svg = Buffer.from(await Bun.file("public/logo.svg").text());

// "any" icons at the two sizes Chrome requires for installability.
await sharp(svg).resize(192, 192).png().toFile(`${OUT_DIR}/icon-192.png`);
await sharp(svg).resize(512, 512).png().toFile(`${OUT_DIR}/icon-512.png`);

// Maskable variant: the mark shrunk to 80% on a solid background so Android's
// adaptive-icon mask doesn't clip the compass.
const inset = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
})
  .composite([{ input: inset, gravity: "center" }])
  .png()
  .toFile(`${OUT_DIR}/icon-512-maskable.png`);

console.log("Wrote public/icons/icon-192.png, icon-512.png, icon-512-maskable.png");
