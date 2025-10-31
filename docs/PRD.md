# Mediamime – Product Outline

## 1. Vision

Deliver a compact, browser-native gesture mapper that turns MediaPipe Holistic landmarks into reliable MIDI control. The experience should feel instantaneous, stay uncluttered on stage, and require no build tooling.

## 2. Goals

1. **Minimal surface area.** Keep the interface focused on the essentials: stream visibility, shape editing, and MIDI routing.
2. **Fast iteration.** Switching shapes, tweaking triggers, or changing ports should take one or two interactions.
3. **Shareable presets.** Snapshots must capture everything required to reproduce a performance setup.
4. **Extensible outputs.** The MIDI core ships today; the architecture stays ready for websocket expansion later.

## 3. Target Users & Scenarios

- **Performers** trigger lighting or instrument layers by moving inside defined regions.
- **Choreographers** pre-visualise gesture cues using the bundled sample footage before rehearsals.
- **Makers** prototype computer-vision controllers without writing custom glue code.

Key flows:
1. Load the page, choose a webcam or sample clip, and mirror the feed as needed.
2. Draw a shape, assign a landmark, add a MIDI Note or CC event, and test the trigger live.
3. Export the mapping, move to another machine, import, and keep playing.

## 4. Functional Requirements

### 4.1 Sources & Rendering
- Switch between live webcam and sample footage with visual status feedback.
- Mirror output independently of the camera feed (mirroring is disabled for prerecorded sources).
- Overlay pose, hands, face, segmentation, and diagnostics with per-stream toggles.

### 4.2 Editor
- Provide rectangle, ellipse, polyline, and polygon tools with keyboard shortcuts.
- Maintain a sidebar that lists shapes, shows activity, and exposes per-shape settings.
- Allow multiple MIDI events per shape with ordered evaluation.
- Support triggers: enter, exit, enter+exit, and while-inside (with throttling).
- Value modes: constant, normX, normY, distance (auto-scaled to MIDI 0–127).

### 4.3 MIDI Routing
- Global port selector with broadcast option and refresh.
- Dispatch MIDI Note On/Off and Control Change messages with explicit channel, note/CC, and value.
- Persist routing preferences in `localStorage` and inside exported snapshots.

### 4.4 Presets
- Export/import JSON snapshots containing shapes, events, overlay state, and routing.
- Version snapshots to allow future migrations.

## 5. Non-Functional Requirements

- **Performance:** Sustain 30–60 FPS with ~1k particles on mid-range laptops.
- **Resilience:** Fall back to the sample clip when webcam access fails; surface status in the overlay.
- **Portability:** Pure static hosting with CDN dependencies only.
- **Accessibility:** Keyboard-driven toolbar, editor focus management, and ARIA labels for panel controls.

## 6. Milestones

1. **v0.5 – MIDI Core (current).** Editor defaults to MIDI-only workflow, OSC removed, redundant styling trimmed.
2. **v0.6 – Websocket Bridge.** Optional websocket emitter for external consumers plus heartbeat diagnostics.
3. **v0.7 – Preset Enhancements.** Lightweight preset browser and snapshot diffing.

## 7. Future Considerations

- Surface CPU/GPU load and inference timings directly in the Streams tab.
- Allow per-event port overrides once websocket output lands.
- Explore templated shapes and quick duplication for choreography-heavy setups.

