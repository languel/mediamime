# Stippulata p5.js Rewrite – Product Requirements Document

## 1. Vision & Goals

Deliver a browser-based interactive art experience that transforms human motion into a dynamic stippled portrait. The experience runs entirely in the browser using p5.js for rendering, MediaPipe Holistic for live landmark extraction, and weighted Voronoi stippling (inspired by StippleGen) to position particles.

Primary objectives:
- Maintain a fluid 30–60 FPS experience on mid-range laptops at default particle counts.
- Expose granular creative controls (forces, overlays, collisions) through a minimal UI so artists can experiment live.
- Support both live webcam and packaged video sources for performances and demos.

## 2. Users & Use Cases

**Target users**
- Creative coders exploring computer-vision-driven generative art.
- Installation artists/performers who need an easily deployable browser proof-of-concept.
- Educators demonstrating MediaPipe landmarks and procedural drawing.

**Key scenarios**
1. The artist loads the demo, switches to the sample video, and adjusts force multipliers until a stylised stipple portrait emerges.
2. A performer grants webcam access and tweaks viscosity/collisions to make particles cling to motion in real time.
3. An educator disables all overlays except pose to show how landmarks influence particle density.

## 3. Functional Requirements

### 3.1 Core Experience
- Load MediaPipe Holistic via CDN; process frames from webcam or bundled MP4.
- Generate a weighted density field from segmentation + landmarks and drive particles via Voronoi relaxation.
- Provide optional overlays for pose, hands, face, and segmentation, each with configurable colours/opacity.

### 3.2 Controls & UI
- Present a lil-gui based control panel containing:
  - Particle count, size, opacity, trail fade, render style.
  - Force sliders + free-form numeric inputs (density, landmark pull, Voronoi strength, random walk, speed cap).
  - Per-feature force multipliers, overlay opacity, and colour pickers.
  - Dynamics: viscosity, repulsion radius, optional particle-to-particle collisions with friction & restitution.
  - Advanced controls: Voronoi sample count and update cadence.
- Supply header actions for source toggling and status text; include reset-to-default button.
- Mirror the webcam feed unless the user disables it; sample video remains unmirrored.

### 3.3 Architecture
- `src/app.js` wires MediaPipe, UI controls, and the p5 sketch loop.
- `src/mediapipeManager.js` abstracts source switching, resizing, and Holistic callbacks.
- `src/stippleSimulation.js` houses particle integration, feature weighting, Voronoi target updates, and collision handling.
- `src/ui.js` defines default config and emits lil-gui controllers with unrestricted numeric inputs.

## 4. Non-Functional Requirements

- **Performance:** maintain ≥30 FPS with ~1k particles and collisions disabled; degrade gracefully when collisions are enabled.
- **Resilience:** fall back to sample video if webcam access fails; surface status messages within the UI overlay.
- **Portability:** run from static hosting with CDN dependencies only.
- **Accessibility:** all controls should be keyboard accessible via lil-gui focus; provide explanatory copy in README.

## 5. Milestones

1. **Scaffold (complete):** p5 sketch, MediaPipe manager, and initial particle system with trails.
2. **Advanced Controls (complete):** add per-feature force/opacity/colour knobs, viscosity, and optional collisions.
3. **Polish:** preset handling, performance profiling, export options (TBD).
4. **Stretch:** integrate pose-only fallback, timeline scrubbing for sample video, or recording.

## 6. Risks & Mitigations

- **Collision overhead:** spatial hash keeps complexity manageable; collisions remain optional and off by default.
- **MediaPipe latency:** allow reducing particle count, lowering Voronoi samples, or disabling face features to recover FPS.
- **Permission failures:** automatic fallback to sample video plus status messaging.

## 7. Open Questions

- Should control presets persist via `localStorage`?
- Do we expose export (PNG/GIF) or recording features in the UI?
- Would shader-based rendering improve performance at high particle counts?

## 8. Success Metrics

- Runs 20+ minutes without freezing or memory creep in Chrome/Edge.
- UI adjustments reflect onscreen within 200 ms.
- Collisions off: ≥30 FPS @ 1k particles; collisions on: ≥20 FPS @ 1k particles on baseline hardware.

---

Prepared by: Codex (GPT-5)
Date: 2025-XX-XX
