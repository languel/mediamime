# Score Interaction Revamp – Product Requirements

## 1. Overview

We are evolving the score editor so each shape can emit any combination of MIDI and OSC events with richer value sources. The new workflow must feel tight, compact, and “Ableton Live” minimal: no decorative spacing, no redundant copy, and every control lives only if it serves live performance.

## 2. Goals

1. **Multi-event routing.** A shape holds an ordered list of event cards. Each card can drive a MIDI Note, MIDI CC, or OSC message with its own trigger.
2. **Enter/Exit pairing.** Users can deliberately target both edges of the interaction (enter, exit, or both) without scripting note-off logic.
3. **Normalized value sources.** Velocity, CC amounts, and OSC payloads pull from:
   - `constant` (current behaviour)
   - `normX` — 0..1 inside the shape’s X bounds
   - `normY` — 0..1 inside Y bounds
   - `distance` — 0..1 distance from the shape centroid
   MIDI values must scale to 0–127, OSC values stay 0–1.
4. **Tokenised OSC arguments.** Add `{norm_x}`, `{norm_y}`, `{dist_center}`, `{value127}` and existing `:value`, `:phase`, etc. Document in README.
5. **Global routing remains single-source.** MIDI/OSC outputs stay global, but event cards respect the selected port/host/port.

## 3. Success Criteria

| Theme | Requirement |
| --- | --- |
| UX | Editor panel presents event cards in a dense vertical stack (no excess padding). Labels abbreviated (`Ch`, `Vel`, `CC#`). Tooltip or `title` reveals full wording. |
| UX | Modal mirrors panel layout, shares the same event-card renderer, and auto-refreshes MIDI ports before opening. |
| Engine | Runtime evaluates every event card per frame, dispatching enter/exit/inside behaviour without double-triggering or stuck notes. |
| Engine | Normalised values respect shape bounds even when the canvas is mirrored. |
| Docs | README adds a concise table of value sources and OSC tokens. |

## 4. Core Tasks

1. **Data model**
   - Replace the single `interaction.midi/osc` with `interaction.events[]`.
   - Migrate existing `localStorage` payloads and in-memory state.
   - Reset runtime caches (`eventState`, `lastMetrics`) when shapes mutate.

2. **Evaluation loop**
   - Compute `normX`, `normY`, `distance` per shape-point pair.
   - Normalize values for MIDI/OSC according to the chosen mode.
   - Handle `enter`, `exit`, `enterExit`, `inside` triggers.
   - Support event-scoped state (note-on flags, dwell timers).

3. **UI**
   - Panel editor: stream + landmark up top, event cards list, “+” button, global description hint.
   - Modal editor: mirror event cards with global port/host controls.
   - Compact styling (tight gaps, 1px separators, squared cards).

4. **Documentation**
   - Extend README with the new workflow and OSC token table.

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Legacy data loss | Old saved shapes may break | Provide migration path that converts single-event mappings into cards. |
| Trigger collisions | Notes may stay latched | Track per-event `noteOn`/`lastContinuousAt` state to ensure clean exit. |
| UI density reduces clarity | Users may miss functionality | Use tooltips and consistent iconography to preserve affordances. |

## 6. Milestones

1. **Engine foundation** – Data migration + runtime evaluation.
2. **UI refresh** – Panel + modal cards, styling pass.
3. **Docs & polish** – README tokens, QA smoke test with a few shapes.

