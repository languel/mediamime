# Stippulata (p5 Edition)

An interactive art demo that fuses MediaPipe body tracking with weighted Voronoi stippling to render a living portrait made of particles. This iteration targets a p5.js-based implementation with tunable parameters for fast experimentation.

## Status

Prototype planning in progress. The current repository contains the original vanilla JS proof of concept; the next milestone is a p5.js rewrite with a modular UI for controlling particle behaviour and visual layers.

## Planned Features

- Dual video sources (live webcam or bundled sample clip) routed through MediaPipe Holistic.
- Stipple-based particle system rendered on p5 canvases, influenced by segmentation masks and landmark attractors.
- Minimal control panel for particle count, sizing, force weights, and visibility of face/pose/hand features.
- Switchable render styles (points, motion trails, contour overlays).

## Development Notes

1. Complete the Product Requirements Document (`docs/PRD.md`) for a high-level scope.
2. Port the runtime to p5.js (likely using the global mode for simplicity).
3. Encapsulate MediaPipe integration so landmarks can be consumed both by the visual layer and by UI diagnostics.

## Getting Started

```bash
npm install --global live-server   # or any static file server
live-server                        # serve the repository root
```

Then open the served URL, enable camera access when prompted, and flip between live and sample modes via the UI toggle once implemented.

## License

Proprietary – do not distribute without permission.
