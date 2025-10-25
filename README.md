# Stippulata (p5 Edition)

An interactive art demo that fuses MediaPipe body tracking with weighted Voronoi stippling to render a living portrait made of particles. This p5.js iteration exposes creative controls so you can sculpt the stipple behaviour in real time.

## Status

Interactive prototype with configurable particle forces, per-feature overlays, and optional particle collisions. Webcam and sample video sources are both supported; UI controls are powered by lil-gui.

## Features

- Dual video input: live webcam (mirrored by default) or bundled dance clip for consistent demos.
- Weighted Voronoi stippling driven by MediaPipe Holistic segmentation and landmarks (pose, hands, face).
- Per-feature force multipliers, opacity, and colour pickers to tailor the stipple portrait.
- Adjustable particle dynamics: count, size, viscosity, trail fade, collision friction/restitution, random walk.
- Optional particle-to-particle collisions using a spatial hash for responsiveness at higher particle counts.

## Getting Started

Serve the project with any static file server:

```bash
npm install --global live-server   # or use python -m http.server
live-server                        # serves the repo root
```

Open the served URL, allow camera permissions if prompted, and use the control panel to experiment. Toggle the "Use Sample Dance Video" button to load the built-in clip if the webcam is unavailable.

## Controls Overview

The lil-gui panel (right column) provides:

- **Particles:** Count, size, and opacity.
- **Render:** Style (points/trails/glow), trail fade, source video visibility.
- **Features:** Enable/disable pose, hands, face, segmentation influence; adjust per-feature force multiplier, overlay opacity, and colour.
- **Forces:** Density/brightness attraction, Voronoi strength, landmark pull, random walk, speed cap.
- **Dynamics:** Viscosity, repulsion radius, and optional particle-to-particle collisions with friction/restitution.
- **Advanced:** Voronoi sample count and update interval.

Press the **Reset** button to restore defaults.

## Development Notes

- Code is organised into ES modules under `src/`: `app.js` orchestrates UI + p5, `mediapipeManager.js` handles video sources, `stippleSimulation.js` runs the particle system, and `ui.js` configures the control surface.
- No build tooling is required; dependencies (p5.js, MediaPipe Holistic, lil-gui) load via CDN.
- Collisions are off by default to keep performance predictable; enable them for tighter point packing on capable hardware.

## License

Proprietary – do not distribute without permission.
