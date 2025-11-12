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

> Note: we intentionally keep this generated file out of `main` to avoid noisy diffs and merge conflicts. Treat it as a release artifact.

## 3. Package for Distribution

```sh
npm run package:single
```

The packaging script:

1. Rebuilds the single-file artifact to ensure it is current.
2. Creates `dist/mediamime-<version>/index.html`.
3. Archives the folder to `dist/mediamime-<version>.zip` (version pulled from `package.json`).

You can attach the ZIP to emails, shared drives, or a release page. Recipients simply unzip and double-click `index.html`.

## 4. Why the Single-File Build Isn’t Committed

Keeping `build/index.html` out of git keeps the commit history readable and prevents merge conflicts on generated code. Publish the zipped artifact through GitHub Releases (or another delivery channel) whenever you tag a version, and point students to the release download instead of the repository clone when possible.

## 5. Running the Standalone Build

- Double-click `build/index.html` or the extracted `dist/mediamime-<version>/index.html`.
- Approve the camera permission request on first load. Offline builds default to the camera because browsers block remote video URLs when running under `file://`.
- Once the app is running you can add local files or network URLs from the **Streams** panel (the bookmarks UI remains available for hosted sessions over `http(s)`).

## 6. Verifying a Release

Before tagging a release:

1. Open the packaged HTML and confirm the camera preview spins up.
2. Add a URL or local clip to ensure the inputs panel still works as expected.
3. Optionally run through the keyboard shortcuts in the README to double-check overlays and MIDI mapping interactions.

That’s it – the `dist/` zip is the hand-off artifact for performers, educators, or collaborators who just need the app without the repo.

## 7. Hosting on GitHub Pages (no docs/ folder)

If you want a live hosted version without committing generated files, use the provided GitHub Actions workflow:

1. Ensure Pages are enabled for the repository (Settings → Pages → Source: GitHub Actions).
2. The workflow at `.github/workflows/deploy-pages.yml` builds the single-file artifact and publishes the `build/` directory to Pages.
3. Push to `main` (or trigger the workflow manually). The app will be available at:
	- `https://languel.github.io/mediamime/` (replace with your GitHub username/repo if forked).

This keeps `main` clean (no committed build output) and always serves the latest single-file build.
