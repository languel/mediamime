# Stippulata Score Editor

An interactive score editor for MediaPipe streams. Draw shapes over the live pose, route multiple MIDI/OSC events per shape, and monitor diagnostic layers in a compact, Ableton-inspired UI.

## Quick Start

1. Serve the repository with any static file server:
   ```bash
   npm install --global live-server
   live-server
   ```
2. Open the served URL, grant webcam access if prompted, and keep the control panel open on the right.
3. Use the stream toggles to expose the feeds you need (`Main` affects the canvas, `Preview` feeds the diagnostic mini-map).

## Panel Layout

### Streams Tab
- `Mirror` toggle flips the camera feed; the adjacent `Source` button switches between webcam and the bundled sample clip.
- Each row exposes a MediaPipe layer with separate `Main` and `Preview` toggles. Default mains: `Source`, `Pose`, `LHand`, `RHand`, `Face`, `Score`. Default previews: `Segmentation`, `Depth`, `Performance`, `Score`.
- The preview canvas at the bottom mirrors the active preview layers, and the status chip reports camera/sample state.

### Editor Tab
- Global routing lives directly under the tabs:
  - **MIDI Port** dropdown (with refresh) points all events at a WebMIDI output or broadcasts to every device.
  - **OSC Destination** stores a global host + port per browser session.
- The score list shows every drawn shape, highlights the one under the pointer, and reflects the linked stream/trigger metadata.
- The detail pane keeps landmarks, the event stack, and destructive actions visible even while you tweak shapes on the canvas—no auto-collapse.

### Snapshots
- The download icon in the routing header exports a snapshot (`.json`) containing every shape, its event stack, and the global MIDI/OSC routing.
- Use the upload icon to import a snapshot and restore shapes, routing, and stream layer toggles in one step.
- Snapshots are versioned; keep them in source control alongside your project to track performance setups.

## Event Cards

- Add as many cards as needed; each card can be a **MIDI Note**, **MIDI CC**, or an **OSC** burst.
- Triggers:
  - `Enter` – fires once when the tracked landmark crosses the shape boundary.
  - `Exit` – fires once when the landmark leaves.
  - `Enter + Exit` – emits paired on/off logic (note-on/off or value/zero).
  - `While Inside` – throttled loop (220 ms floor) while the landmark stays in the region.
- MIDI notes clear themselves on exit, even for continuous triggers, to avoid hanging notes.
- OSC dispatch includes metadata (`shapeId`, `eventId`, `phase`, `stream`, `landmark`) so downstream receivers can react contextually.

## Value Sources

| Source    | MIDI Output                     | OSC Output | Description |
|-----------|---------------------------------|------------|-------------|
| `constant`| Stored integer (0–127)          | Stored float (0.0–1.0) | Static value, ideal for fixed velocities or note-off complements. |
| `normX`   | Normalised X × 127              | Normalised X | Landmark X within the shape bounds (0.0 at the left edge, 1.0 at the right). |
| `normY`   | Normalised Y × 127              | Normalised Y | Landmark Y within the shape bounds (0.0 at the top, 1.0 at the bottom). |
| `distance`| Normalised radius × 127         | Normalised radius | Euclidean distance from the shape centroid, clamped to the bounding box radius. |

## OSC Argument Tokens

Comma-separated argument strings can mix literals, tokens, and booleans. Available placeholders:

| Token / Placeholder | Expands To |
|---------------------|-----------|
| `:value`            | Active OSC value (post-normalisation). |
| `:phase`            | Interaction phase: `enter`, `exit`, or `inside`. |
| `:inside`           | `1` while the landmark is inside, `0` otherwise. |
| `:timestamp`        | `performance.now()` (ms). |
| `{norm_x}` / `{norm_x_bound}` | Same as `normX` value. |
| `{norm_y}` / `{norm_y_bound}` | Same as `normY` value. |
| `{dist_center}` / `{distance}`| Distance metric (0–1). |
| `{value127}`        | OSC value scaled to the MIDI 0–127 range. |

If no arguments resolve, the dispatcher sends the computed value as a single float.

## Canvas Tools & Shortcuts

- `Cmd/Ctrl + ,` – toggle the control panel.
- `Cmd/Ctrl + E` – toggle the tool palette without hiding the score layer.
- Tool shortcuts: `V` (Select), `E` (Eraser), `R` (Rectangle), `O` (Oval), `L` (Polyline), `P` (Polygon).
- `Enter` pops the assignment modal for the active shape; `Esc` clears selection; `Delete/Backspace` removes the current shape.
- The editor toolbar stays pinned to the bottom edge; tooltips reveal icon meanings.

## Notes & Troubleshooting

- MIDI port refresh is deferred until the mapping modal opens or you click the refresh buttons—attach devices first.
- `While Inside` triggers respect the global throttling window; adjust expressions on the receiving end if tighter timing is required.
- Mirror mode only affects rendering; shape math always runs in camera-native coordinates for consistent OSC/MIDI output.

## OSC Relay

Web browsers cannot emit UDP OSC directly. To forward the in-browser `mediapipa:osc` events to a desktop target (e.g. TouchDesigner) run the bundled relay:

1. Install dependencies (Node 18+):
   ```bash
   node osc-relay.mjs
   ```
   Optional flags: `--host 127.0.0.1` (target host), `--port 9000` (target UDP port), `--listen 7331` (HTTP port).
2. Launch the score editor (e.g. `live-server`), draw/select a shape, and trigger an OSC event. The relay will log:
   ```
   OSC relay listening on http://127.0.0.1:7331/osc
   Forwarding to udp://127.0.0.1:9000
   ```
3. The web app automatically POSTs every `mediapipa:osc` event to `http://127.0.0.1:7331/osc`; override this by setting `window.MEDIAPIPA_OSC_RELAY_URL` in the dev console before triggering events.
4. Your OSC receiver (TouchDesigner, etc.) should now see the JSON-forwarded payload on the configured host/port. Disable the relay by stopping the Node process (`Ctrl+C`).
