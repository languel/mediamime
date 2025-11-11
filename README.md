# Mediamime

Mediamime lets you draw shapes over a live camera feed and map every shape to MIDI messages—no installs, servers, or extra tooling required.

## Quick Start (no build tools required)

1. Download or clone this folder.
2. Double-click `index.html` (or drop it onto a browser window).
3. Approve the camera prompt so the preview has a live source. You can add local videos or URLs later from the **Streams** panel.
4. Use the toolbar at the bottom of the canvas to draw shapes, then open the **Map** panel to assign MIDI notes or CC values.

That’s it—you can rehearse, tweak shapes, and save snapshots without touching Node.js.

### When you are ready to share a single file

1. Install Node.js 18 or later (only needed for packaging).
2. Run `npm install` once.
3. Run `npm run package:single` to rebuild and zip `dist/mediamime-<version>.zip`.
4. Hand the zip (or the `build/index.html` it was created from) to your students or collaborators—they only need to double-click it.

More detail lives in `docs/DISTRIBUTION.md`.

## Keyboard Shortcuts

| Context | Shortcut | Action |
| ------- | -------- | ------ |
| Global | `Cmd/Ctrl + Z` | Undo the last change |
| Global | `Cmd/Ctrl + Shift + Z` | Redo |
| Global | `Cmd/Ctrl + Enter` | Toggle between Edit and Perform modes |
| Global | `Cmd/Ctrl + E` | Show/Hide the drawing toolbar |
| Panels | `Cmd/Ctrl + I / P / L / M` | Toggle Input, Preview, Layers, or Map panels |
| Panels | `Shift + Esc` | Close the most recently focused panel |
| Navigation | Hold `Space` + drag | Temporary pan with any tool |
| Navigation | `+` or `=` / `-` or `_` / `0` | Zoom in, zoom out, or reset zoom |
| Navigation | `F` / `Shift + F` | Frame the selection or frame all shapes |
| Drawing | `V`, `H`, `D`, `L`, `R`, `O`, `E` | Select, Hand/Pan, Freehand, Line, Rectangle, Ellipse, or Eraser tools |
| Drawing | `Q` | Toggle tool lock (keep the current tool active) |
| Drawing | Hold `Shift` | Snap to the 50px grid while drawing or moving points |
| Drawing | Hold `Cmd/Ctrl` | Snap to nearby shape vertices while drawing |
| Drawing | `Alt + Click` on a curve point | Remove the point (curve edit mode) |
| Editing | `Delete` | Remove selected shapes |
| Editing | `Esc` | Cancel the current action or clear the selection |

Tips:

- Double-tap a tool shortcut (for example, press `R` twice quickly) to toggle tool lock without touching the UI.
- While you are drawing, hold `Space` to pan, then release to continue sketching from the same tool.

## Troubleshooting

- **Camera refuses to start:** close other apps that use the camera, then refresh the page. Some browsers only expose cameras to one tab at a time.
- **Need a prerecorded file:** open the **Streams** panel, choose “Add Video,” and pick a local file. When running from `file://`, network URLs stay disabled for security, so prefer local files or switch to a simple static server.
- **Lost your layout:** hold `Shift` and tap `Esc` to close each floating panel, then reopen with the keyboard shortcuts above.

## More resources

- `docs/TECHNICAL_REFERENCE.md` – deep dive into panels, mapping logic, and the data model.
- `docs/DISTRIBUTION.md` – packaging and verification checklist for the single-file build.
- `docs/CHANGELOG.md` – history of recent features and fixes.

Mediamime is a teaching prototype—expect rough edges, share feedback, and fork freely for your own classes.
