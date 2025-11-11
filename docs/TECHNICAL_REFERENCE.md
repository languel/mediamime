# Technical Reference

This document collects the detailed notes that used to live in the project README. Refer back here whenever you need a deeper explanation of the panels, mapping flow, or data model.

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
- **Input Tab**
  - Add cameras, local videos, or bookmarked URLs.
  - Crop and flip controls with live previews.
  - Transport scrubber, play/pause toggle, and speed control for video clips.
- **Layout**
  - Floating panels remember their size and position (drag by the header, resize from the edges).
  - Hold `Shift` + `Escape` to close the most recently focused panel.

The gesture toolbar (bottom centre of the canvas) provides rectangle, ellipse, polyline, polygon, select, and erase tools. Use the mode toggle to jump between editing and performance views.

## Mapping MIDI Events

Every shape hosts an ordered stack of event cards. Available card types:

| Type | Description |
| ---- | ----------- |
| `MIDI Note` | Emits note-on/off with selectable channel, note, and velocity |
| `MIDI CC` | Sends Control Change messages with channel, CC#, and value |

### Trigger Modes

- `Enter` – fire once when the landmark enters the shape.
- `Exit` – fire once when the landmark leaves.
- `Enter + Exit` – paired on/off behaviour (useful for notes and latching CC values).
- `While Inside` – throttled loop (220 ms minimum) while the landmark remains inside.

### Value Sources

| Source | MIDI Output | Notes |
| ------ | ----------- | ----- |
| `constant` | Stored integer (0–127) | Default for note velocity and CC values |
| `normX` | Normalised X scaled to 0–127 | Based on the landmark position within the shape bounds |
| `normY` | Normalised Y scaled to 0–127 | Based on vertical position within the shape |
| `distance` | Normalised distance scaled to 0–127 | 0 at the centroid, 127 at the furthest shape point |

Shapes remember their event stack, so copy/duplicate workflows remain quick. The Editor tab exposes all controls inline; the pop-out modal is still available via the keyboard shortcut `Enter` if you prefer a focused view.

## Data Model

- The score lives directly inside the editor SVG. Each shape is a `<g data-shape-id>` element whose `data-shape-*` attributes capture normalised geometry, style, and mapping metadata. Editing sessions read from and write to those nodes, so saving the raw `<svg>` produces a complete, portable score without an additional export step.
- JSON snapshots remain available for presets, but the DOM itself is now the canonical storage layer.

## Snapshots

- Use the download icon to export the entire session as a versioned JSON snapshot (shapes, events, overlay state, and MIDI port preference).
- Import a snapshot from the upload icon; Mediamime restores shapes and routing instantly.
- Saved snapshots are ideal for moving between browsers or keeping performance presets in source control.

## Additional Notes

- Double-click the Map panel header to clear the current selection.
- Alt/Option-click a curve control point to remove it while in curve-edit mode.
- SVG exports add a padded black background and capture the current camera transform, so remote viewers see the intended framing.

For even more background, continue with `docs/PRD.md` (product overview) or `docs/CHANGELOG.md` (historical notes).
