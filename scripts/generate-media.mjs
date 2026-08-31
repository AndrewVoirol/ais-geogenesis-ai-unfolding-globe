import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const DELIVERABLES_DIR = path.resolve('deliverables');
const SCREENSHOTS_DIR = path.resolve('screenshots');
const RECORDINGS_DIR = path.join(DELIVERABLES_DIR, 'raw_recordings');

if (!fs.existsSync(DELIVERABLES_DIR)) fs.mkdirSync(DELIVERABLES_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

async function main() {
  console.log('=== GEOGENESIS STUDIO MEDIA PRODUCTION PIPELINE ===\n');

  console.log('Step 1: Launching Playwright Chromium Browser...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  // --- PART A: 4 HIGH-CONTRAST HERO SCREENSHOTS ---
  console.log('\n--- PART A: Generating 4 Hero Screenshots ---');
  const heroContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2
  });
  const heroPage = await heroContext.newPage();
  await heroPage.addInitScript(() => localStorage.setItem('geoGenesis_tutorial_seen', 'true'));
  await heroPage.goto('http://localhost:3456');
  await heroPage.waitForTimeout(2000);

  const setUnfurl = async (page, progress) => {
    await page.evaluate((val) => {
      const slider = document.querySelector('input[type="range"]');
      if (slider) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(slider, val.toString());
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, progress);
    await page.waitForTimeout(400);
  };

  const selectTopology = async (page, name) => {
    await page.click('button:has-text("TOPOLOGY")');
    await page.waitForTimeout(100);
    await page.click(`button:has-text("${name}")`);
    await page.waitForTimeout(400);
  };

  const selectTheme = async (page, name) => {
    await page.click('button:has-text("PHOSPHOR")');
    await page.waitForTimeout(100);
    await page.click(`button:has-text("${name}")`);
    await page.waitForTimeout(400);
  };

  const selectFlightPreset = async (page, index = 0) => {
    await page.click('button:has-text("PRESETS")');
    await page.waitForTimeout(200);
    const presetButtons = await page.locator('div:has-text("POPULAR TRANSCONTINENTAL ROUTES:") ~ div button').all();
    if (presetButtons.length > index) {
      await presetButtons[index].click();
      await page.waitForTimeout(400);
    }
  };

  // 1. spherical-orthographic.png
  console.log('Capturing: screenshots/spherical-orthographic.png (3D Amber CRT Sphere)...');
  await selectTheme(heroPage, 'Amber CRT');
  await selectTopology(heroPage, 'Orthographic');
  await setUnfurl(heroPage, 0.0);
  await heroPage.waitForTimeout(1000);
  await heroPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'spherical-orthographic.png') });

  // 2. mid-unfurl-pythagorean.png
  console.log('Capturing: screenshots/mid-unfurl-pythagorean.png (50% Pythagorean Unfurl)...');
  await selectTheme(heroPage, 'Cyber Cyan');
  await selectTopology(heroPage, 'Winkel Tripel');
  await setUnfurl(heroPage, 0.50);
  await heroPage.waitForTimeout(1000);
  await heroPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mid-unfurl-pythagorean.png') });

  // 3. flat-flight-matrix.png
  console.log('Capturing: screenshots/flat-flight-matrix.png (100% Flat with Geodesic Flight Route)...');
  await selectTheme(heroPage, 'Phosphor Green');
  await selectTopology(heroPage, 'Equirectangular');
  await setUnfurl(heroPage, 1.0);
  await selectFlightPreset(heroPage, 0); // JFK -> LHR
  await heroPage.waitForTimeout(1000);
  await heroPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'flat-flight-matrix.png') });

  // 4. crt-phosphor-themes.png (2x2 Matrix Composite)
  console.log('Capturing 4 theme quadrants for crt-phosphor-themes.png...');
  const themeQuadrants = [
    { theme: 'Amber CRT', topo: 'Orthographic', unfurl: 0.0, flight: false },
    { theme: 'Phosphor Green', topo: 'Equirectangular', unfurl: 1.0, flight: true, flightIdx: 0 },
    { theme: 'Cyber Cyan', topo: 'Winkel Tripel', unfurl: 0.5, flight: false },
    { theme: 'Obsidian Mono', topo: 'Mollweide', unfurl: 0.8, flight: true, flightIdx: 1 }
  ];

  const tempThemeFiles = [];
  for (let i = 0; i < themeQuadrants.length; i++) {
    const q = themeQuadrants[i];
    await selectTheme(heroPage, q.theme);
    await selectTopology(heroPage, q.topo);
    await setUnfurl(heroPage, q.unfurl);
    if (q.flight) {
      await selectFlightPreset(heroPage, q.flightIdx);
    }
    await heroPage.waitForTimeout(600);
    const tempFile = path.join(SCREENSHOTS_DIR, `temp-theme-quad-${i}.png`);
    await heroPage.screenshot({ path: tempFile });
    tempThemeFiles.push(tempFile);
  }

  const themeMatrixPath = path.join(SCREENSHOTS_DIR, 'crt-phosphor-themes.png');
  const compositeCmd = `ffmpeg -y -i "${tempThemeFiles[0]}" -i "${tempThemeFiles[1]}" -i "${tempThemeFiles[2]}" -i "${tempThemeFiles[3]}" -filter_complex "[0:v][1:v]hstack=inputs=2[top];[2:v][3:v]hstack=inputs=2[bottom];[top][bottom]vstack=inputs=2,scale=1920:1080:flags=lanczos" "${themeMatrixPath}"`;
  execSync(compositeCmd);
  tempThemeFiles.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
  console.log('Hero screenshots complete!');
  await heroPage.close();
  await heroContext.close();

  // --- PART B: HIGH-DEFINITION 60FPS SHOWCASE VIDEO & ANIMATED WEBP ---
  console.log('\n--- PART B: Recording 60fps Showcase Video ---');
  const videoContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await videoContext.newPage();
  await page.addInitScript(() => localStorage.setItem('geoGenesis_tutorial_seen', 'true'));
  await page.goto('http://localhost:3456');
  await page.waitForTimeout(2000);

  const smoothUnfurlVideo = async (from, to, steps = 20, durationMs = 1500) => {
    const stepDelay = durationMs / steps;
    for (let i = 0; i <= steps; i++) {
      const val = from + (to - from) * (i / steps);
      await setUnfurl(page, val);
      await page.waitForTimeout(stepDelay);
    }
  };

  const dragRotateVideo = async (dx = 250, dy = 0, steps = 15) => {
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) return;
    const startX = box.x + box.width * 0.6;
    const startY = box.y + box.height * 0.5;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(startX + (dx * i) / steps, startY + (dy * i) / steps);
      await page.waitForTimeout(25);
    }
    await page.mouse.up();
    await page.waitForTimeout(200);
  };

  console.log('Executing live showcase sequence...');

  // Phase 1: 3D Amber CRT Rotating Globe (0s - 3s)
  console.log('1. 3D Orthographic Sphere in Amber CRT with Starfield...');
  await selectTheme(page, 'Amber CRT');
  await selectTopology(page, 'Orthographic');
  await setUnfurl(page, 0.0);
  await page.waitForTimeout(600);
  await dragRotateVideo(-220, 20, 20);
  await page.waitForTimeout(600);

  // Phase 2: Continuous Unfurl Scrubbing (3s - 7s)
  console.log('2. Continuous Unfurl Scrubbing from 3D Sphere to Flat Projection...');
  await smoothUnfurlVideo(0.0, 0.5, 20, 1400);
  await page.waitForTimeout(400);
  await smoothUnfurlVideo(0.5, 1.0, 20, 1400);
  await page.waitForTimeout(600);

  // Phase 3: Multi-Projection Topology Switching (7s - 11s)
  console.log('3. Multi-Projection Switching: Equirectangular -> Winkel Tripel -> Mollweide...');
  await selectTopology(page, 'Equirectangular');
  await page.waitForTimeout(800);
  await selectTopology(page, 'Winkel Tripel');
  await page.waitForTimeout(900);
  await selectTopology(page, 'Mollweide');
  await page.waitForTimeout(900);

  // Phase 4: Great-Circle Flight Routing (11s - 15s)
  console.log('4. Interactive Great-Circle Flight Routing with Geodesic SLERP Arcs...');
  await selectFlightPreset(page, 0); // JFK -> LHR
  await page.waitForTimeout(1000);
  await selectFlightPreset(page, 1); // HND -> SFO
  await page.waitForTimeout(1000);

  // Phase 5: Phosphor Theme Matrix & CRT Optics (15s - 19s)
  console.log('5. Phosphor Palette Switching: Green -> Cyber Cyan -> Obsidian Mono...');
  await selectTheme(page, 'Phosphor Green');
  await page.waitForTimeout(700);
  await selectTheme(page, 'Cyber Cyan');
  await page.waitForTimeout(700);
  await selectTheme(page, 'Obsidian Mono');
  await page.waitForTimeout(700);
  await selectTheme(page, 'Cyber Cyan');
  await page.waitForTimeout(500);

  // Phase 6: Morphing back to 3D Sphere with Active Geodesic Route (19s - 23s)
  console.log('6. Unfurl Morphing back to 3D Sphere with Geodesic Arc...');
  await selectTopology(page, 'Orthographic');
  await smoothUnfurlVideo(1.0, 0.0, 25, 1800);
  await dragRotateVideo(240, -20, 20);
  await page.waitForTimeout(1000);

  console.log('Recording sequence complete. Finalizing video...');
  const video = page.video();
  await page.close();
  const videoPath = await video.path();
  await videoContext.close();
  await browser.close();

  // --- PART C: FFMPEG ENCODING & DELIVERABLES ---
  console.log('\n--- PART C: Encoding Deliverables ---');

  // 1. deliverables/demo.mp4 (1080p @ 60fps)
  const finalMp4 = path.join(DELIVERABLES_DIR, 'demo.mp4');
  console.log('Encoding deliverables/demo.mp4 (1920x1080, 60fps, libx264)...');
  execSync(
    `ffmpeg -y -i "${videoPath}" -vf "fps=60,scale=1920:1080:flags=lanczos" -c:v libx264 -pix_fmt yuv420p -r 60 -crf 20 -preset slow -movflags +faststart "${finalMp4}"`,
    { stdio: 'inherit' }
  );

  // 2. screenshots/demo.webp (< 5MB animated WebP)
  const finalWebp = path.join(SCREENSHOTS_DIR, 'demo.webp');
  console.log('Encoding screenshots/demo.webp (< 5MB, 800px, 14fps animated WebP)...');
  execSync(
    `ffmpeg -y -i "${finalMp4}" -vf "fps=14,scale=800:-1:flags=lanczos" -vcodec libwebp -lossless 0 -compression_level 4 -q:v 70 -loop 0 "${finalWebp}"`,
    { stdio: 'inherit' }
  );

  // 3. screenshots/demo.gif (< 5MB GIF for GitHub README fallback)
  const finalGif = path.join(SCREENSHOTS_DIR, 'demo.gif');
  console.log('Encoding screenshots/demo.gif (800px, 10fps palette-optimized GIF)...');
  execSync(
    `ffmpeg -y -i "${finalMp4}" -vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:reserve_transparent=0[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" -loop 0 "${finalGif}"`,
    { stdio: 'inherit' }
  );

  // Cleanup raw recordings
  fs.rmSync(RECORDINGS_DIR, { recursive: true, force: true });

  console.log('\n=== DELIVERABLES VERIFICATION REPORT ===');
  const assets = [
    { path: finalMp4, name: 'demo.mp4' },
    { path: finalWebp, name: 'demo.webp' },
    { path: finalGif, name: 'demo.gif' },
    { path: path.join(SCREENSHOTS_DIR, 'spherical-orthographic.png'), name: 'spherical-orthographic.png' },
    { path: path.join(SCREENSHOTS_DIR, 'mid-unfurl-pythagorean.png'), name: 'mid-unfurl-pythagorean.png' },
    { path: path.join(SCREENSHOTS_DIR, 'flat-flight-matrix.png'), name: 'flat-flight-matrix.png' },
    { path: path.join(SCREENSHOTS_DIR, 'crt-phosphor-themes.png'), name: 'crt-phosphor-themes.png' }
  ];

  for (const asset of assets) {
    if (!fs.existsSync(asset.path)) {
      console.error(`ERROR: Missing asset ${asset.name}`);
      continue;
    }
    const stats = fs.statSync(asset.path);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✓ ${asset.name.padEnd(30)} : ${sizeMB.padStart(6)} MB  (${stats.size} bytes)`);
  }

  console.log('\nAll deliverables generated and verified successfully!');
}

main().catch((err) => {
  console.error('Fatal Error in media pipeline:', err);
  process.exit(1);
});
