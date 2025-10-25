# Stippulata p5.js Rewrite – Product Requirements Document

## 1. Vision & Goals

Build a browser-based interactive art experience that transforms human motion into a dynamic stippled portrait. The new iteration leverages p5.js for rendering, MediaPipe Holistic for live landmark extraction, and weighted Voronoi stippling inspired by StippleGen to position particles.

Primary objectives:
- Deliver a stable, responsive demo that runs locally in modern browsers without build tooling.
- Expose creative controls (particle behaviour, render styles, feature visibility) through a minimal UI so artists can experiment quickly.
- Maintain compatibility with both webcam feeds and a packaged sample dance video for predictable demos.

## 2. Users & Use Cases

**Target users**
- Creative coders exploring generative art workflows.
- Installation artists and performers who need a browser-proof-of-concept before stage deployment.
- Educators showcasing computer vision and procedural drawing in the browser.

**Key scenarios**
1. A user opens the demo, switches to a sample dance video, and observes how the particles form a stippled portrait.
2. A user grants webcam access and tweaks particle count, force strengths, and render styles to achieve a specific aesthetic.
3. A user hides individual feature layers (e.g., face mesh or hands) to focus on pose-driven motion.

## 3. Functional Requirements

### 3.1 Core Experience
- Load MediaPipe Holistic via CDN (with graceful fallback messaging) and process frames from either the webcam stream or bundled video.
- Render particles using p5.js, incorporating weighted Voronoi relaxation to nudge dots toward MediaPipe-derived density.
- Maintain optional overlays for face mesh, pose, hands, and segmentation mask (toggled independently).

### 3.2 Controls & UI
- Provide an always-visible control panel with sliders/toggles for:
  - Particle count, particle size, trail fade.
  - Force weights (landmark attraction, Voronoi strength, repulsion).
  - Feature visibility (face, pose, left/right hand, segmentation outline).
  - Render styles (e.g., point render, smoothed trail, contour lines).
- Provide source toggle (webcam vs. sample video) plus optional mirroring on webcam.
- Show lightweight status text (e.g., model loading, camera blocked, video buffering).

### 3.3 Architecture
- Organise code into p5 sketch modules (`sketch.js`, `controls.js`, `mediapipe.js`, etc.) with ES module imports.
- Abstract MediaPipe callbacks so controls and render layers can observe the latest landmarks without direct dependency chains.
- Ensure the sketch resizes responsively, updating particle buffers and weights when the video aspect changes.

## 4. Non-Functional Requirements

- **Performance:** target ≥30 FPS on mid-range laptops with default particle count (~1k) and webcam feed.
- **Graceful degradation:** display a readable error panel if MediaPipe fails to load or camera access is denied.
- **Portability:** run via static hosting without build steps; rely only on CDN-delivered dependencies.
- **Accessibility:** keyboard-accessible UI controls; provide textual hints for camera permissions.

## 5. Milestones

1. **Foundation:** set up p5.js scaffold, integrate MediaPipe input switching, render static particles.  
2. **Stippling Engine:** port weighted Voronoi loop, add particle forces, ensure convergence.  
3. **UI Layer:** implement control panel (likely using `dat.GUI` or a minimal custom slider suite).  
4. **Polish:** add preset saves, refine default forces, document tweaks in README.

## 6. Risks & Mitigations

- **Performance bottlenecks:** Weighted Voronoi iterations can be expensive. Mitigate by throttling updates, sampling subset per frame, and exposing controls to reduce particle count.
- **MediaPipe latency:** Holistic CPU fallback may lag on slower machines. Provide ability to drop to pose-only pipeline if necessary (logged as stretch goal).
- **Browser permission issues:** Include troubleshooting tips and fall back to sample video automatically.

## 7. Open Questions

- Should presets be persisted (e.g., `localStorage`) or kept session-only?
- Would visitors benefit from exporting frames or GIFs (out of scope for MVP)?
- Do we expose timeline playback controls for the sample video?

## 8. Success Metrics

- Demo sustains ≥30 FPS on a 2020 MacBook Air at default settings.
- User can toggle between webcam and sample video without full reload.
- Adjusting particle count and feature visibility updates the sketch within 200 ms.

---

Prepared by: Codex (GPT-5)  
Date: 2025-XX-XX
