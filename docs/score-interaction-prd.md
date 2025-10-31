# Mediamime Interaction Spec

## 1. Overview

The interaction stack converts MediaPipe landmarks into MIDI events. Each shape owns an ordered list of event cards, and every card reacts to the landmark assigned to the shape. OSC support has been removed; the document reflects the MIDI-only flow.

## 2. Event Model

- `interaction.stream` – `pose`, `leftHand`, `rightHand`, or `face`.
- `interaction.landmark` – key from the corresponding landmark catalogue.
- `interaction.events[]` – ordered array of cards. Each card has:
  - `type` – `midiNote`, `midiCc`, or `none`.
  - `trigger` – `enter`, `exit`, `enterExit`, `inside`.
  - `channel` – MIDI channel (1–16).
  - Type-specific fields:
    - `midiNote`: `note` (0–127), `velocityMode`, `velocityValue`.
    - `midiCc`: `cc` (0–127), `ccValueMode`, `ccValue`.

Runtime caches:
- `eventState.noteOn` – track active note for paired triggers.
- `eventState.lastContinuousAt` – throttle loops to ≥220 ms.
- `eventState.lastMetrics` – last computed `normX`, `normY`, `distance`.

## 3. Value Modes

| Mode      | Calculation (0–1)          | MIDI Scaling            |
| --------- | -------------------------- | ----------------------- |
| constant  | Stored number              | Directly mapped to 0–127 |
| normX     | Landmark X within bounds   | Multiply by 127 and clamp |
| normY     | Landmark Y within bounds   | Multiply by 127 and clamp |
| distance  | Distance to shape centroid | Multiply by 127 and clamp |

All calculations respect mirrored canvases by pre-adjusting the sampled coordinates when the output view is mirrored.

## 4. Trigger Behaviour

| Trigger      | Dispatch Behaviour                                                   |
| ------------ | -------------------------------------------------------------------- |
| `enter`      | Fire once on edge crossing. Pair Note On with stored velocity.       |
| `exit`       | Fire once when leaving. For notes, send Note Off (velocity 0).       |
| `enterExit`  | Fire on both edges. On exit, CC values resolve to zero.              |
| `inside`     | Loop while inside, respecting throttling.                            |

All trigger handlers run in event order. Continuous events share the same throttling window to prevent overlap.

## 5. UI Guidelines

- Default the Editor tab to active state when the panel opens.
- Adding a new event inserts a `midiNote` card pre-populated with channel 1, note 60, velocity 96.
- Card headers remain icon-light with abbreviated labels (`Ch`, `Note`, `Vel`, `CC#`, `Val`, `Amt`).
- “Pop-out editor” button is optional; keyboard shortcut `Enter` still opens the modal.
- Provide inline hint text describing value modes (no OSC references).

## 6. Persistence

- `localStorage` key `mediamime:gesture-shapes` stores the serialized shapes plus interaction data.
- `mediamime:config` holds the selected MIDI port.
- Snapshot schema:
  ```json
  {
    "version": 1,
    "config": { "midiPort": "broadcast" },
    "overlay": { ... },
    "shapes": [
      {
        "id": "uuid",
        "type": "rect|ellipse|polyline|polygon",
        "interaction": { "stream": "...", "landmark": "...", "events": [...] },
        "style": {...}
      }
    ]
  }
  ```
- Future migrations should ingest any `osc` payload silently and discard it.

## 7. Open Items

- Add websocket transport once the event dispatcher abstraction is ready.
- Provide quick duplication (`Cmd/Ctrl + D`) to accelerate choreography workflows.
- Consider velocity curves per value mode for finer expressive control.

