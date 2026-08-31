import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const SCREENSHOTS_DIR = path.resolve('screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function captureHeroScreenshots() {
  console.log('Launching Playwright Chromium for Hero Screenshots...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  // Disable tutorial
  await page.addInitScript(() => {
    localStorage.setItem('geoGenesis_tutorial_seen', 'true');
  });

  await page.goto('http://localhost:3456');
  await page.waitForTimeout(2000);

  // Helper to click topology
  async function selectTopology(name) {
    await page.click('button:has-text("TOPOLOGY")');
    await page.waitForTimeout(200);
    await page.click(`button:has-text("${name}")`);
    await page.waitForTimeout(500);
  }

  // Helper to select theme
  async function selectTheme(name) {
    await page.click('button:has-text("PHOSPHOR")');
    await page.waitForTimeout(200);
    await page.click(`button:has-text("${name}")`);
    await page.waitForTimeout(500);
  }

  // Helper to set unfurl progress
  async function setUnfurl(progress) {
    await page.evaluate((val) => {
      const slider = document.querySelector('input[type="range"]');
      if (slider) {
        slider.value = val.toString();
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, progress);
    await page.waitForTimeout(600);
  }

  // Helper to select flight preset
  async function selectFlightPreset(index = 0) {
    await page.click('button:has-text("PRESETS")');
    await page.waitForTimeout(300);
    const presetButtons = await page.locator('div:has-text("POPULAR TRANSCONTINENTAL ROUTES:") ~ div button').all();
    if (presetButtons.length > index) {
      await presetButtons[index].click();
      await page.waitForTimeout(600);
    }
  }

  // 1. Hero 1: spherical-orthographic.png
  console.log('Capturing 1/4: spherical-orthographic.png...');
  await selectTheme('Amber CRT');
  await selectTopology('Orthographic');
  await setUnfurl(0.0);
  // Let starfield and animation settle
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'spherical-orthographic.png') });

  // 2. Hero 2: mid-unfurl-pythagorean.png
  console.log('Capturing 2/4: mid-unfurl-pythagorean.png...');
  await selectTheme('Cyber Cyan');
  await selectTopology('Winkel Tripel');
  await setUnfurl(0.50);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mid-unfurl-pythagorean.png') });

  // 3. Hero 3: flat-flight-matrix.png
  console.log('Capturing 3/4: flat-flight-matrix.png...');
  await selectTheme('Phosphor Green');
  await selectTopology('Equirectangular');
  await setUnfurl(1.0);
  await selectFlightPreset(0); // JFK -> LHR or popular route
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'flat-flight-matrix.png') });

  // 4. Hero 4: crt-phosphor-themes.png (Capture 4 themes and build 2x2 matrix)
  console.log('Capturing 4 themes for matrix composite...');
  const themes = [
    { name: 'Amber CRT', topo: 'Orthographic', unfurl: 0.0 },
    { name: 'Phosphor Green', topo: 'Equirectangular', unfurl: 1.0 },
    { name: 'Cyber Cyan', topo: 'Winkel Tripel', unfurl: 0.5 },
    { name: 'Obsidian Mono', topo: 'Mollweide', unfurl: 0.85 }
  ];

  const tempShots = [];
  for (let i = 0; i < themes.length; i++) {
    const t = themes[i];
    await selectTheme(t.name);
    await selectTopology(t.topo);
    await setUnfurl(t.unfurl);
    await page.waitForTimeout(800);
    const tempPath = path.join(SCREENSHOTS_DIR, `temp-theme-${i}.png`);
    await page.screenshot({ path: tempPath });
    tempShots.push(tempPath);
  }

  // Composite 2x2 grid with ffmpeg
  console.log('Compositing crt-phosphor-themes.png 2x2 matrix...');
  const themeMatrixPath = path.join(SCREENSHOTS_DIR, 'crt-phosphor-themes.png');
  const ffmpegCmd = `ffmpeg -y -i "${tempShots[0]}" -i "${tempShots[1]}" -i "${tempShots[2]}" -i "${tempShots[3]}" -filter_complex "[0:v][1:v]hstack=inputs=2[top];[2:v][3:v]hstack=inputs=2[bottom];[top][bottom]vstack=inputs=2,scale=1920:1080:flags=lanczos" "${themeMatrixPath}"`;
  execSync(ffmpegCmd);

  // Clean up temp files
  tempShots.forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });

  console.log('All hero screenshots successfully generated!');
  await browser.close();
}

captureHeroScreenshots().catch((err) => {
  console.error('Error capturing hero screenshots:', err);
  process.exit(1);
});
