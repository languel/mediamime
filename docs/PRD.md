# Mediamime – Product Requirements (2025)

## 1. Vision & Philosophy

- **Direct, browser-native performance tool.** Mediamime maps MediaPipe Holistic landmarks to MIDI without build tooling, installers, or backend services. Opening `index.html` is the deploy step.
- **Score equals interface.** Shapes live inside the SVG DOM (`<g data-shape-id>`). Editing the canvas edits the saved asset, so exporting SVG or JSON always yields a faithful performance score.
- **Stage-safe minimalism.** Floating panels stay out of frame until needed, controls are keyboard-addressable, and overlays default to a clean performance view.
- **Rapid experimentation.** The project is a work-in-progress prototype that favours iteration speed, transparent state (localStorage + JSON), and simple sharing.

## 2. Product Tenets

1. **Source-agnostic inputs.** Swap between webcams, uploaded clips, or bookmarked URLs without touching code.
2. **Composed overlays.** Layers choose source, Holistic processor (pose, hands, face, segmentation, depth, raw), colour, and viewport, enabling quick rehearsal layouts.
3. **Expressive gesture editing.** Infinite canvas, snap-aware tools, and colour-coordinated shapes keep editing fluid while preserving accuracy.
4. **Deterministic MIDI output.** Every event card makes note/CC routing explicit, throttles continuous triggers, and remembers the selected port.
5. **Portable presets.** JSON + SVG exports capture the entire mapping, and imports can replace or append to the live score.

## 3. Current Release Snapshot — `v0.5 MIDI Core`

- MIDI-only dispatcher with `enter`, `exit`, `enter+exit`, and throttled `inside` triggers (120 ms minimum loop cadence).
- Infinite canvas editor: pan with spacebar+drag, zoom with wheel/pinch or `±`, grid cycling on `G`, frame selection/all via `F` / `Shift+F`.
- Toolbelt: select, temporary hand/pan, freehand, line, rectangle, ellipse, eraser, plus colour-paired stroke/fill derived from the RGBA picker.
- Input panel with multi-source list, cropping (normalised 0–1), flip toggles, transport controls for video, and media bookmarks (including bundled sample clip).
- Streams panel (Layers) with per-stream viewport controls, Holistic process selection, rgba colour chips, background opacity, and reset actions.
- Mapping panel for shape metadata, stream assignment (pose, hands, face, pointer, keyboard), ordered MIDI event stacks, snapshot import/append/export, and SVG export with padded bounding box.
- Layout system stores panel positions/sizes in `localStorage`, exposes keyboard toggles (`I`, `L`, `P`, `M`), and ships hidden-by-default panels for a clean stage view.

## 4. Target Users & Scenarios

- **Performers** map tracked body regions to lighting or instrument layers. Flow: open the preview, choose a webcam, draw gate shapes, assign `MIDI Note` cards with `enter+exit` triggers, test while watching the live status chip, export JSON for backup.
- **Choreographers** rehearse with the bundled clip: load the sample video, mirror the preview, add pose overlays to highlight cues, duplicate shapes for different dancers, and share the SVG to document blocking.
- **Educators & students** use the pointer/keyboard streams to prototype controller ideas in class without external hardware.
- **Instrument hackers / creative coders** sketch CV-to-MIDI remappers, export JSON snapshots, and source-control them alongside other performance assets.

## 5. Experience Map

1. **Acquire sources.** Add camera/video/URL inputs, adjust crop/flip metadata, and bookmark frequently used media.
2. **Compose overlays.** Build Holistic streams that select which input, which processor, the on-canvas viewport, and the overlay colour.
3. **Design gestures.** Use the floating editor to draw, rename, and colour shapes on the infinite canvas while monitoring landmarks.
4. **Map interactions.** Assign streams/landmarks, stack MIDI Note/CC cards, configure triggers/value modes, and preview MIDI activity.
5. **Rehearse.** Toggle overlay density, frame shapes, fine-tune event order, and iterate with live feedback.
6. **Export or restore.** Save JSON snapshots (replace or append) and share SVG renders; import snapshots to reproduce a show file instantly.

## 6. System Overview & Requirements

### 6.1 Inputs & Source Management

- **UI structure.** The Input panel mirrors the editor pattern: source list with activity badges, detail form, media preview (video + canvas), crop sliders (`x`, `y`, `w`, `h` normalized to 0–1), and flip toggles.
- **Supported sources.** Cameras (`getUserMedia`), local videos (via `captureStream()`), and arbitrary URLs (persisted bookmarks with remove buttons). A bundled clip (`scripts/input/default_input.mp4`) is always reachable.
- **State.** `inputs[]` store `{id, name, type, stream, crop, flip, playbackRate, isPaused, sourceMeta}` and persist via `localStorage` (`mediamime:inputs`). Active source changes emit `mediamime:active-input-changed`; list mutations emit `mediamime:input-list-changed`.
- **Feedback.** Inline status chips show bookmark/import errors (`STATUS_TYPES`), while the media preview canvas renders the live crop with flip transforms.
- **Constraints.** Inputs only hold crop & flip metadata; spatial transforms happen later when a stream is placed on the canvas. Cleanup ensures streams are stopped and DOM nodes removed when deleting inputs.
- **Next layer hooks.** The panel exposes public APIs (`getInputs()`, `getActiveInput()`, `dispose()`) so Layers and MediaPipe can subscribe without tight coupling.

### 6.2 Layer Composer & Preview

- **Streams.** Each stream references an input `sourceId`, a Holistic process (`pose`, `hands`, `face`, `segmentation`, `depth`, `raw`), enabled flag, rgba colour (picker-backed), and viewport metadata (`x`, `y`, `w`, `h`, `viewportMode`).
- **Controls.** UI includes add/duplicate/delete, enable toggles, source dropdown (populated from `mediamime:input-list-changed`), process selector, viewport numeric inputs, fit-to-source button, and a dedicated color chip. Background opacity slider and quick layer reset live at the top of the panel.
- **Persistence & events.** Streams persist through `mediamime:layers` (`localStorage`) and broadcast `mediamime:layers-changed` whenever the list mutates so the renderer can re-compose overlays.
- **Rendering expectations.** Streams drive overlay drawing (pose skeleton, hand keypoints, face centroid dots, segmentation, depth, or raw source). Face landmarks intentionally render as highlighted points rather than full meshes for legibility.

### 6.3 Media Pipeline & Rendering

- **Pipeline orchestration.** `scripts/mediapipe/index.js` listens for input/layer events, instantiates one MediaPipe Holistic processor per active input, and maintains `processors` keyed by `sourceId`.
- **Frame prep.** Each processor draws the cropped/flip-corrected frame into an offscreen canvas before calling `holistic.send({ image })`.
- **Event bus.** Pipeline state and Holistic results emit via `mediamime:pipeline-state` and `mediamime:holistic-results`. Downstream modules (drawing, mapping) subscribe without tight coupling.
- **Fallback behaviour.** If Holistic support is unavailable or a camera fails, processors log a warning and fall back to the sample clip when possible; the preview panel surfaces the status chip.

### 6.4 Gesture Editor & Score Model

- **Tools & shortcuts.** Toolbar includes select (`V`), hand/pan (`H` or spacebar hold), freehand (`D`), line (`L`), rectangle (`R`), ellipse (`O`), eraser (`E`), clear-all, and perform-mode toggle. Tool lock lives on `Q`.
- **Infinite canvas & navigation.** Camera transform stores `x`, `y`, `zoom`. Zoom controls: mouse wheel/pinch, `+`/`-`, `0` to reset. `F` frames selection, `Shift+F` frames all shapes. Grid cycle `G` toggles off → line → dot; grid renders at current zoom.
- **Snapping.** Hold `Shift` for 50 px grid snapping or `Cmd/Ctrl` for 15 px element snapping (vertices & centres) with onscreen crosshair indicator.
- **Geometry editing.** Freehand smoothing, path node add/remove (click / Alt+click), auto-closed curves when endpoints match, minimum draw distance guards, and normalized viewBox math ensure precision.
- **Colour system.** Editor, layers, and assignment panels share the RGBA picker. Stroke uses full alpha, fill auto-halves the alpha for immediate contrast. Colour changes apply to future shapes; the assignment picker can override per shape.
- **State handling.** `SvgShapeStore` reflects the live DOM. History keeps three snapshots to balance undo needs with memory usage. Selections are multi-select aware (`Set` of ids) and broadcast to mapping modules.
- **Exfiltration.** SVG export computes a padded bounding box, adds a background rect, and serializes the shape layer exactly as authored.

### 6.5 Interaction & MIDI Mapping

- **Streams & landmarks.** Shapes can listen to `pose`, `leftHand`, `rightHand`, `face`, `pointer`, or `keyboard` streams. Landmark dropdowns are populated from curated catalogs (pose 0–32 joints, hand 0–20 joints, face centroid + nose tip reference, pointer position/button, keyboard codes including modifiers).
- **Event cards.** Each shape maintains an ordered stack of cards: `midiNote`, `midiCc`, or `none`. Cards expose channel, note/CC number, trigger, and value-mode controls. New cards default to `midiNote`, channel 1, note 60, velocity 96.
- **Triggers & value modes.**
  - `enter`, `exit`, `enter+exit`, `inside`. Continuous triggers share a 120 ms throttle window to avoid overlap.
  - Value sources: `constant`, `normX`, `normY`, `distance` (all scaled 0–127, mirrored-aware).
  - Enter/exit pairing tracks active notes so Note Off is guaranteed on exit.
- **Runtime caches.** `eventState.noteOn`, `eventState.lastContinuousAt`, and `eventState.lastMetrics` live per shape to support throttling and smoothing. Pointer mirroring is applied before metrics to ensure consistent values with mirrored previews.
- **MIDI transport.** Navigator MIDI access is requested once; available outputs populate a refreshable dropdown with `All Outputs` broadcast option. Port preference persists in `localStorage` (`mediamime:config`) and inside snapshots.
- **UI guidelines.** Interaction modal opens from the shape list, is draggable via the handle tongue, and mirrors updates back to the sidebar immediately (name, colour, stream indicator). Inline hints explain value modes, and keyboard shortcut `Enter` opens the modal for the selected shape.
- **Snapshots.** JSON import can replace (`Import`) or append (`Append`) to the existing score. Schema:

```json
{
  "version": 1,
  "config": { "midiPort": "broadcast" },
  "overlay": { "streams": [...], "backgroundOpacity": 0.8 },
  "shapes": [
    {
      "id": "uuid",
      "type": "rect|ellipse|freehand|line",
      "name": "Gate A",
      "style": { "stroke": "rgba(...)", "fill": "rgba(...)", "strokeWidth": 2 },
      "interaction": {
        "stream": "pose",
        "landmark": "left_wrist",
        "events": [
          {
            "id": "evt-...",
            "type": "midiNote",
            "trigger": "enterExit",
            "channel": 1,
            "note": 60,
            "velocityMode": "constant",
            "velocityValue": 96
          }
        ]
      }
    }
  ]
}
```

### 6.6 Storage, Export & Recovery

- **Local persistence.** `mediamime:gesture-shapes` mirrors the live SVG data model; `mediamime:config` stores MIDI port + UI prefs; `mediamime:inputs` and `mediamime:layers` persist the upstream panels; `mediamime:modal-layout` stores floating panel positions/sizes.
- **Snapshot workflow.** File input is hidden by default and triggered from toolbar buttons. Imports validate JSON schema before mutating the canvas. Append mode merges shapes while keeping existing ids.
- **SVG export.** `snapshot-export-svg-button` serializes the `<svg>` with bounding box padding, black background, and the current camera transform baked out so remote recipients view the intended framing.

### 6.7 Layout, Panels & Accessibility

- Panels are floating modals with drag handles (`data-modal-handle`), resize affordances (`data-resizable`), and z-index stacking. Layout persists between sessions and clamps to the viewport when restoring.
- Keyboard shortcuts toggle each modal: `I` (Input), `P` (Preview/Streams), `L` (Layers), `M` (Map/Editor). The preview modal doubles as the stream diagnostic surface (mini canvas + status chips).
- ARIA roles/labels are assigned to toolbars, sliders, and modal sections. Colour pickers expose numeric inputs for screen readers, and status text uses `aria-live="polite"` for import feedback.
- Default load opens only the preview canvas to keep the stage uncluttered; other panels remember their previous visibility.

## 7. Non-Functional Requirements

- **Performance.** Maintain 30–60 FPS with a single Holistic instance and several overlay layers on mid-range laptops. Drawing loops avoid layout thrash by batching DOM writes per pointer event.
- **Reliability.** Gracefully handle denied camera permission (fall back to sample clip), invalid media URLs, or missing MIDI support (surface toast + log, continue running).
- **Portability.** Entire experience runs from static assets with CDN-loaded dependencies (`p5`, MediaPipe Holistic, material icons). Works when the repo is opened directly from disk.
- **Accessibility.** Keyboard shortcuts for every editor action, ARIA-respectful sliders and tabs, visible focus rings, and pointer-independent controls for essential flows.
- **Observability.** Console logging is scoped (`[mediamime]` prefix) so rehearsals can capture issues quickly without custom tooling.

## 8. Roadmap & Open Items

1. **Websocket / network output.** Re-introduce OSC-like extensibility via a websocket emitter once the dispatcher abstraction is formalised. Include heartbeat diagnostics in the Streams panel.
2. **Input placement & compositing.** Extend the input system to place cropped/flipped sources as shapes on the canvas with transform matrices (translate/scale/rotate) and opacity controls, then feed those composites into both the preview and Holistic.
3. **Multi-processor Holistic.** Allow multiple simultaneous MediaPipe pipelines so each input can be analysed independently before being combined in Layers.
4. **Preset management.** Snapshot browser/diffing UI, quick duplication (`Cmd/Ctrl + D`), and metadata (author, bpm, venue) attached to JSON exports.
5. **Per-event routing.** Optional per-card port overrides and program-change helpers once websocket/OSC support lands.
6. **Velocity curves & modulation.** Richer value modes (curves, envelopes, smoothing) for more expressive CC output.
7. **Diagnostics.** Surface CPU/GPU load, inference timings, dropped frames, and MIDI throughput in the Streams panel.
8. **Visual effects.** Blend modes, masks, and input chaining (use one source as a mask for another) derived from the deferred transform plan in `scripts/input`.

## 9. Reference Artifacts

- `docs/CHANGELOG.md` — chronological feature log (currently starts at the infinite canvas + advanced drawing tools drop from Nov 2025).
- `README.md` — quick-start guide for opening the prototype and keyboard shortcuts.
- `index.html` — single entry point containing all panels, toolbars, and colour pickers referenced above.

This PRD replaces the previous fragmented documents (`input-layer-system.md`, `score-interaction-prd.md`) by unifying source, editor, and mapping requirements in one place.
