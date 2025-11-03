# Mediamime

Mediamime is a browser-based gesture mapper that pairs MediaPipe Holistic with an event editor for MIDI-driven performance. Draw shapes over the live feed, assign MIDI actions to tracked landmarks, and automate expressive gestures without leaving the browser.

## Quick Start

1. The project is a work-in-progress prototype meant for personal experimentation and pedagogy. It is not production-ready, ships without warranties, and may change rapidly.
2. Open `index.html` directly in any modern browser (double-click the file or drag it into a tab). If you prefer a server, any static host (for example `npx live-server`) works, but no build tooling is required.
3. Grant webcam permission, or switch to the bundled sample clip from the **Streams** panel.
4. Use the floating editor toggle to reveal the control panel. The **Editor** tab is enabled by default for fast mapping. The overlay toggle buttons are hidden by default—press `Cmd/Ctrl + U` whenever you need them.

## Interface Overview

- **Editor Tab**
  - Global `MIDI Port` selector with refresh; choose `All Outputs` to broadcast.
  - Shape list with activity highlights and quick selection.
  - Detail pane for stream/landmark assignment and an event stack per shape.
- **Streams Tab**
  - Mirror and source buttons.
  - Background opacity slider, optional persistent trails, and a mirrored preview that respects the transparency slider during overlay builds.
  - Layer toggles for pose, hands, face, segmentation, and diagnostics.
  - Mini preview canvas that mirrors the active preview layers plus a status chip.

The gesture toolbar (bottom centre of the canvas) provides rectangle, ellipse, polyline, polygon, select, and erase tools. Use the mode toggle to jump between editing and performance views.

## Mapping MIDI Events

Every shape can host an ordered stack of event cards. Available card types:

| Type       | Description                                                   |
| ---------- | ------------------------------------------------------------- |
| `MIDI Note`| Emits note-on/off with selectable channel, note, and velocity |
| `MIDI CC`  | Sends Control Change messages with channel, CC#, and value    |

### Triggers

- `Enter` – fire once when the landmark enters the shape.
- `Exit` – fire once when the landmark leaves.
- `Enter + Exit` – paired on/off behaviour (useful for notes and latching CC values).
- `While Inside` – throttled loop (220 ms minimum) while the landmark remains inside.

### Value Sources

| Source    | MIDI Output                         | Notes                                                  |
| --------- | ----------------------------------- | ------------------------------------------------------ |
| `constant`| Stored integer (0–127)               | Default for note velocity and CC values                |
| `normX`   | Normalised X scaled to 0–127         | Based on the landmark position within the shape bounds |
| `normY`   | Normalised Y scaled to 0–127         |                                                        |
| `distance`| Normalised distance scaled to 0–127  | 0 at the centroid, 127 at the furthest shape point     |

Shapes remember their event stack, so copy/duplicate workflows remain quick. The Editor tab exposes all controls inline; the pop-out modal is still available via the keyboard shortcut `Enter` if you prefer a focused view.

## Snapshots

- Use the download icon to export the entire session as a versioned JSON snapshot (shapes, events, overlay state, and MIDI port preference).
- Import a snapshot from the upload icon; Mediamime restores shapes and routing instantly.
- Saved snapshots are ideal for moving between browsers or keeping performance presets in source control.

## Shortcuts

- Canvas visibility: `Cmd/Ctrl + ,`
- Toolbar visibility: `Cmd/Ctrl + E`
- Toggle overlay buttons: `Cmd/Ctrl + U`
- Tool keys: `V` (Select), `E` (Eraser), `R` (Rectangle), `O` (Oval), `L` (Polyline), `P` (Polygon)
- Shape focus: `Enter` opens the assignment modal, `Esc` clears selection, `Delete/Backspace` removes the active shape.

## Roadmap

- Add websocket output for remote listeners.
- Expand preset management for switching between multiple mappings mid-performance.
- Surface lightweight analytics (latency, dropped frames) in the Streams tab.

Mediamime is intentionally MIDI-only. Pair it with an external MIDI-to-OSC bridge if you need OSC targets today.
