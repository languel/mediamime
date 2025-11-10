# Distribution Guide

This document captures how to produce and share the single-file Mediamime build.

## 1. Prerequisites

- Node.js 18 or later (needed for the bundler and packaging script).
- macOS, Windows, or Linux with the system `zip` utility available (the packaging script shells out to `zip`).

Run `npm install` once if you have not already – the process only needs the `esbuild` dependency.

## 2. Build the Single-File Artifact

```sh
npm run build:single
```

The command invokes `tools/build-single-html.mjs` which produces `build/index.html`. The output file contains:

- All JavaScript bundled and minified via esbuild.
- The project stylesheet inlined inside the `<head>`.
- No external asset references, so it can be opened directly from `file://`.

> Tip: the file is safe to commit alongside source – it will be overwritten next time you run the build.

## 3. Package for Distribution

```sh
npm run package:single
```

The packaging script:

1. Rebuilds the single-file artifact to ensure it is current.
2. Creates `dist/mediamime-<version>/index.html`.
3. Archives the folder to `dist/mediamime-<version>.zip` (version pulled from `package.json`).

You can attach the ZIP to emails, shared drives, or a release page. Recipients simply unzip and double-click `index.html`.

## 4. Running the Standalone Build

- Double-click `build/index.html` or the extracted `dist/mediamime-<version>/index.html`.
- Approve the camera permission request on first load. Offline builds default to the camera because browsers block remote video URLs when running under `file://`.
- Once the app is running you can add local files or network URLs from the **Streams** panel (the bookmarks UI remains available for hosted sessions over `http(s)`).

## 5. Verifying a Release

Before tagging a release:

1. Open the packaged HTML and confirm the camera preview spins up.
2. Add a URL or local clip to ensure the inputs panel still works as expected.
3. Optionally run through the keyboard shortcuts in the README to double-check overlays and MIDI mapping interactions.

That’s it – the `dist/` zip is the hand-off artifact for performers, educators, or collaborators who just need the app without the repo.
