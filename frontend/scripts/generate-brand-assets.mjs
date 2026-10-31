import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { optimize } from 'svgo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const brandDir = path.join(publicDir, 'brand');

async function generate() {
  console.log('Generating FlowPeople brand assets...');

  if (!fs.existsSync(brandDir)) {
    fs.mkdirSync(brandDir, { recursive: true });
  }

  const iconSvgPath = path.join(brandDir, 'flowpeople-icon.svg');
  const logoSvgPath = path.join(brandDir, 'flowpeople-logo.svg');
  const faviconSvgPath = path.join(publicDir, 'favicon.svg');

  const iconSvgContent = fs.readFileSync(iconSvgPath);
  const logoSvgContent = fs.readFileSync(logoSvgPath);

  // 1. Export icon-192.png, icon-512.png
  console.log('-> Generating icon-192.png and icon-512.png...');
  await sharp(iconSvgContent).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(iconSvgContent).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));

  // 2. Export apple-touch-icon.png (180px, flatten on #0F766E background)
  console.log('-> Generating apple-touch-icon.png (180x180, flatten on #0F766E)...');
  await sharp(iconSvgContent)
    .resize(180, 180)
    .flatten({ background: '#0F766E' })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // 3. Export icon-maskable-512.png (scale mark to 60% centered on full-bleed teal-to-indigo gradient)
  console.log('-> Generating icon-maskable-512.png...');
  const bgSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#14B8A6"/>
          <stop offset="1" stop-color="#4F46E5"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bg)"/>
    </svg>
  `);

  const markSize = Math.round(512 * 0.6); // 307
  const markOffset = Math.round((512 - markSize) / 2); // 102
  const markPng = await sharp(iconSvgContent).resize(markSize, markSize).png().toBuffer();

  await sharp(bgSvg)
    .composite([
      {
        input: markPng,
        top: markOffset,
        left: markOffset,
      },
    ])
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));

  // 4. Exports 16/32/48 px PNGs and combine into favicon.ico using png-to-ico
  console.log('-> Generating favicon.ico (16, 32, 48px)...');
  const p16 = await sharp(iconSvgContent).resize(16, 16).png().toBuffer();
  const p32 = await sharp(iconSvgContent).resize(32, 32).png().toBuffer();
  const p48 = await sharp(iconSvgContent).resize(48, 48).png().toBuffer();
  const icoBuffer = await pngToIco([p16, p32, p48]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);

  // 5. Build og-image.png (1200x630) with soft light gradient background, horizontal logo centered at ~60% width
  console.log('-> Generating og-image.png (1200x630)...');
  const ogBgSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <linearGradient id="ogbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F0FDFA"/>
          <stop offset="50%" stop-color="#F8FAFC"/>
          <stop offset="100%" stop-color="#EEF2FF"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#ogbg)"/>
    </svg>
  `);

  const ogLogoWidth = 720;
  const ogLogoHeight = Math.round((720 * 140) / 520); // 194
  const ogLogoTop = Math.round((630 - ogLogoHeight) / 2);
  const ogLogoLeft = Math.round((1200 - ogLogoWidth) / 2);

  const logoPng = await sharp(logoSvgContent).resize(ogLogoWidth, ogLogoHeight).png().toBuffer();

  await sharp(ogBgSvg)
    .composite([
      {
        input: logoPng,
        top: ogLogoTop,
        left: ogLogoLeft,
      },
    ])
    .png()
    .toFile(path.join(brandDir, 'og-image.png'));

  // 6. Run svgo on all SVGs
  console.log('-> Optimizing SVGs with svgo...');
  const svgFiles = [
    iconSvgPath,
    logoSvgPath,
    path.join(brandDir, 'flowpeople-logo-dark.svg'),
    path.join(brandDir, 'flowpeople-mono.svg'),
    faviconSvgPath,
  ];

  for (const file of svgFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const result = optimize(content, {
        multipass: true,
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                removeViewBox: false,
              },
            },
          },
        ],
      });
      fs.writeFileSync(file, result.data, 'utf8');
      console.log(`   Optimized: ${path.basename(file)}`);
    }
  }

  console.log('Brand asset generation complete!');
}

generate().catch((err) => {
  console.error('Error generating brand assets:', err);
  process.exit(1);
});

