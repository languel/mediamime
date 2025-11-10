#!/usr/bin/env node
/**
 * Packages the single-file build into dist/mediamime-<version>.zip.
 * Rebuilds the artifact, drops a README, and zips the folder for distribution.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const runCommand = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  child.on('error', reject);
  child.on('exit', (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(`${command} exited with code ${code}`));
  });
});

async function main() {
  const rootDir = fileURLToPath(new URL('..', import.meta.url));
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  const version = packageJson.version;

  console.log('[mediamime] Building single-file artifact (npm run build:single)...');
  await runCommand('npm', ['run', 'build:single'], { cwd: rootDir, env: process.env });

  const distDirPath = path.join(rootDir, 'dist');
  const bundleFolderName = `mediamime-${version}`;
  const bundleDirPath = path.join(distDirPath, bundleFolderName);
  const buildFilePath = path.join(rootDir, 'build', 'index.html');
  const zipFileName = `${bundleFolderName}.zip`;
  const zipFilePath = path.join(distDirPath, zipFileName);

  await fs.mkdir(distDirPath, { recursive: true });
  await fs.rm(bundleDirPath, { recursive: true, force: true });
  await fs.mkdir(bundleDirPath, { recursive: true });

  await fs.copyFile(buildFilePath, path.join(bundleDirPath, 'index.html'));

  const standaloneReadme = `Mediamime ${version} Standalone\n\nContents:\n- index.html (self-contained build)\n\nHow to launch:\n1. Double-click index.html.\n2. Approve the camera permission prompt so the preview has a live source.\n3. Add additional video or URL sources from the Streams panel once the app is running.\n\nNotes:\n- The bundled sample clip is only available when the app is hosted over http(s).\n- Rebuild and repackage with npm run package:single whenever source code changes.\n`;
  await fs.writeFile(path.join(bundleDirPath, 'README.txt'), standaloneReadme, 'utf8');

  await fs.rm(zipFilePath, { force: true });

  console.log(`[mediamime] Creating ${zipFileName} in dist/ ...`);
  await runCommand('zip', ['-r', zipFileName, bundleFolderName], { cwd: distDirPath, env: process.env });

  console.log(`[mediamime] Done. Package available at dist/${zipFileName}`);
}

main().catch((error) => {
  console.error('[mediamime] Packaging failed:', error.message);
  process.exitCode = 1;
});
