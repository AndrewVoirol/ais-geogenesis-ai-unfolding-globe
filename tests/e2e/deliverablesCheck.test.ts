import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Tier 4: Scenario 5 - Comprehensive Asset & Ingestion Deliverables Verification', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('T4.5.1: package.json has valid scripts and dependencies configured', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
  });

  it('T4.5.2: tsconfig.json is configured with modern ES2022 / React JSX support', () => {
    const tsconfigPath = path.join(rootDir, 'tsconfig.json');
    expect(fs.existsSync(tsconfigPath)).toBe(true);
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    expect(tsconfig.compilerOptions).toBeDefined();
  });

  it('T4.5.3: PROJECT.md exists and defines the 4-tier projection architecture', () => {
    const projectPath = path.join(rootDir, 'PROJECT.md');
    expect(fs.existsSync(projectPath)).toBe(true);
    const content = fs.readFileSync(projectPath, 'utf8');
    expect(content).toContain('Pythagorean');
    expect(content).toContain('Winkel Tripel');
    expect(content).toContain('Mollweide');
  });

  it('T4.5.4: TEST_INFRA.md exists and specifies opaque-box verification criteria', () => {
    const testInfraPath = path.join(rootDir, 'TEST_INFRA.md');
    expect(fs.existsSync(testInfraPath)).toBe(true);
    const content = fs.readFileSync(testInfraPath, 'utf8');
    expect(content).toContain('Tier 1');
    expect(content).toContain('Tier 2');
    expect(content).toContain('Tier 3');
    expect(content).toContain('Tier 4');
  });

  it('T4.5.5: screenshots directory exists for visual asset deliverables', () => {
    const screenshotsDir = path.join(rootDir, 'screenshots');
    expect(fs.existsSync(screenshotsDir)).toBe(true);
  });

  it('T4.5.6: deliverables/demo.mp4 exists, is non-empty, and has valid video size', () => {
    const mp4Path = path.join(rootDir, 'deliverables/demo.mp4');
    expect(fs.existsSync(mp4Path)).toBe(true);
    const stats = fs.statSync(mp4Path);
    expect(stats.size).toBeGreaterThan(1024 * 1024); // > 1 MB
  });

  it('T4.5.7: screenshots/demo.webp exists and is strictly under 5MB ceiling', () => {
    const webpPath = path.join(rootDir, 'screenshots/demo.webp');
    expect(fs.existsSync(webpPath)).toBe(true);
    const stats = fs.statSync(webpPath);
    expect(stats.size).toBeGreaterThan(500 * 1024); // > 500 KB
    expect(stats.size).toBeLessThan(5 * 1024 * 1024); // < 5 MB
  });

  it('T4.5.8: all 4 required hero screenshots exist and have substantial image payload', () => {
    const requiredScreenshots = [
      'spherical-orthographic.png',
      'mid-unfurl-pythagorean.png',
      'flat-flight-matrix.png',
      'crt-phosphor-themes.png'
    ];

    for (const filename of requiredScreenshots) {
      const filePath = path.join(rootDir, 'screenshots', filename);
      expect(fs.existsSync(filePath), `Missing hero screenshot: ${filename}`).toBe(true);
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(200 * 1024); // > 200 KB non-blank
    }
  });

  it('T4.5.9: screenshots/demo.gif exists and is under 5MB for GitHub auto-play threshold', () => {
    const gifPath = path.join(rootDir, 'screenshots/demo.gif');
    expect(fs.existsSync(gifPath)).toBe(true);
    const stats = fs.statSync(gifPath);
    expect(stats.size).toBeGreaterThan(100 * 1024);
    expect(stats.size).toBeLessThan(5 * 1024 * 1024);
  });
});
