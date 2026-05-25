import sharp from "sharp";
import { join } from "path";

const src = join(process.cwd(), "public", "TFC0.png");
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  await sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(join(process.cwd(), "public", "icons", `icon-${size}x${size}.png`));
  console.log(`✓ icon-${size}x${size}.png`);
}
