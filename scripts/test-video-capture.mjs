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

async function generateMedia() {
  console.log('1. Launching Playwright with Video Recording...');
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

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  // Suppress tutorial
  await page.addInitScript(() => {
    localStorage.setItem('geoGenesis_tutorial_seen', 'true');
  });

  console.log('2. Navigating to GeoGenesis...');
  await page.goto('http://localhost:3456');
  await page.waitForTimeout(2000);

  // Helper functions
  const setUnfurl = async (progress) => {
    await page.evaluate((val) => {
      const slider = document.querySelector('input[type="range"]');
      if (slider) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(slider, val.toString());
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, progress);
  };

  const smoothUnfurl = async (from, to, steps = 30, durationMs = 2500) => {
    const stepDelay = durationMs / steps;
    for (let i = 0; i <= steps; i++) {
      const val = from + (to - from) * (i / steps);
      await setUnfurl(val);
      await page.waitForTimeout(stepDelay);
    }
  };

  const selectTopology = async (name) => {
    await page.click('button:has-text("TOPOLOGY")');
    await page.waitForTimeout(150);
    await page.click(`button:has-text("${name}")`);
    await page.waitForTimeout(600);
  };

  const selectTheme = async (name) => {
    await page.click('button:has-text("PHOSPHOR")');
    await page.waitForTimeout(150);
    await page.click(`button:has-text("${name}")`);
    await page.waitForTimeout(600);
  };

  const selectFlightPreset = async (index = 0) => {
    await page.click('button:has-text("PRESETS")');
    await page.waitForTimeout(300);
    const presetButtons = await page.locator('div:has-text("POPULAR TRANSCONTINENTAL ROUTES:") ~ div button').all();
    if (presetButtons.length > index) {
      await presetButtons[index].click();
      await page.waitForTimeout(600);
    }
  };

  const dragRotate = async (dx = 300, dy = 0, steps = 20) => {
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) return;
    const startX = box.x + box.width * 0.6;
    const startY = box.y + box.height * 0.5;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(startX + (dx * i) / steps, startY + (dy * i) / steps);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await page.waitForTimeout(300);
  };

  // --- DEMO SEQUENCE ---
  console.log('3. Starting Demo Recording Sequence...');

  // Phase 1: 3D Orthographic Sphere in Amber CRT
  console.log('Phase 1: 3D Sphere in Amber CRT with Starfield & Rotation');
  await selectTheme('Amber CRT');
  await selectTopology('Orthographic');
  await setUnfurl(0.0);
  await page.waitForTimeout(1000);
  // Rotate globe manually
  await dragRotate(-250, 40, 30);
  await page.waitForTimeout(1000);

  // Phase 2: Smooth Unfurl Scrubbing (0% -> 50% -> 100%)
  console.log('Phase 2: Continuous Unfurl Scrubbing (Pythagorean Limb Math)');
  await smoothUnfurl(0.0, 0.5, 25, 2000);
  await page.waitForTimeout(800);
  await smoothUnfurl(0.5, 1.0, 25, 2000);
  await page.waitForTimeout(1000);

  // Phase 3: Multi-Projection Topology Switching
  console.log('Phase 3: Multi-Projection Switching');
  await selectTopology('Equirectangular');
  await page.waitForTimeout(1000);
  await selectTopology('Winkel Tripel');
  await page.waitForTimeout(1200);
  await selectTopology('Mollweide');
  await page.waitForTimeout(1200);

  // Phase 4: Great-Circle Flight Routing
  console.log('Phase 4: Great-Circle Flight Routing with Geodesic SLERP Arcs');
  await selectFlightPreset(0); // JFK -> LHR
  await page.waitForTimeout(1500);
  await selectFlightPreset(1); // HND -> SFO
  await page.waitForTimeout(1500);

  // Phase 5: Phosphor Matrix Switching & CRT Optics
  console.log('Phase 5: Phosphor Matrix Palette Switching');
  await selectTheme('Phosphor Green');
  await page.waitForTimeout(1000);
  await selectTheme('Cyber Cyan');
  await page.waitForTimeout(1000);
  await selectTheme('Obsidian Mono');
  await page.waitForTimeout(1000);
  await selectTheme('Cyber Cyan');
  await page.waitForTimeout(800);

  // Phase 6: Morph back to 3D Sphere with Active Geodesic Route
  console.log('Phase 6: Morphing Flat back to 3D Sphere with active geodesic path');
  await selectTopology('Orthographic');
  await smoothUnfurl(1.0, 0.0, 30, 2500);
  await dragRotate(300, -30, 30);
  await page.waitForTimeout(1500);

  console.log('4. Demo Sequence Finished. Closing Page to finalize recording...');
  const video = page.video();
  await page.close();
  const videoPath = await video.path();
  await browser.close();

  console.log('Raw video saved to:', videoPath);

  // Re-encode to MP4 (1080p, 60fps, high quality H.264)
  const finalMp4 = path.join(DELIVERABLES_DIR, 'demo.mp4');
  console.log('5. Encoding final deliverables/demo.mp4 (1080p @ 60fps)...');
  execSync(
    `ffmpeg -y -i "${videoPath}" -vf "fps=60,scale=1920:1080:flags=lanczos" -c:v libx264 -pix_fmt yuv420p -r 60 -crf 20 -preset slow -movflags +faststart "${finalMp4}"`,
    { stdio: 'inherit' }
  );

  // Generate animated WebP (< 5MB)
  const finalWebp = path.join(SCREENSHOTS_DIR, 'demo.webp');
  console.log('6. Generating screenshots/demo.webp (< 5MB animated WebP)...');
  // Use scale=800:-1, fps=12, optimized quality
  execSync(
    `ffmpeg -y -i "${finalMp4}" -vf "fps=12,scale=800:-1:flags=lanczos" -vcodec libwebp -lossless 0 -compression_level 6 -q:v 70 -loop 0 "${finalWebp}"`,
    { stdio: 'inherit' }
  );

  const mp4Stats = fs.statSync(finalMp4);
  const webpStats = fs.statSync(finalWebp);
  console.log(`\n=== GENERATION SUMMARY ===`);
  console.log(`MP4:  ${finalMp4} (${(mp4Stats.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`WebP: ${finalWebp} (${(webpStats.size / (1024 * 1024)).toFixed(2)} MB)`);

  // Clean up raw recordings
  fs.rmSync(RECORDINGS_DIR, { recursive: true, force: true });
}

generateMedia().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
