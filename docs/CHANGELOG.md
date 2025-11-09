# Changelog

## [Unreleased] - 2025-11-06

### Added - Infinite Canvas & Advanced Drawing Tools

#### Infinite Canvas
- Pan/zoom camera system for truly infinite drawing space
  - Spacebar + drag for panning (overrides any tool)
  - Pinch/scroll gestures for zoom
  - F key to frame selection, Shift+F to frame all shapes
  - Camera transform applied to shapes layer for proper coordinate mapping
- Grid system with three modes (toggle with G key):
  - Off: No grid
  - Line: Subtle line grid (0.05 opacity)
  - Dot: Minimal dot grid (0.05 opacity)
  - 50px cell size matching snap grid

#### Snapping System
- Grid snap (Shift): Snaps to 50px grid cells in pixel space
- Element snap (Cmd): Snaps to nearest shape vertices/centers (15px threshold)
- Combined snap: Both modifiers work together
- Visual feedback: White crosshair indicator (5px, 0.5 opacity) at snap target
- Snap indicator respects camera transform (rendered in shapes layer)

#### Color System Improvements
- Full RGBA color picker integration with HSV color space
- Fixed hue slider gradient direction (0-360° mapping)
- Stroke uses picker color with full opacity
- Fill automatically calculated as 50% relative opacity of stroke
- Colors apply immediately when creating new shapes
- Reduced border radius on color picker for better corner access (4px)

#### Curve Editing Enhancements
- Click to add control points with snap support
- Alt-click to remove control points (avoids shortcut conflicts)
- Auto-detects closed curves: when first and last points are within 0.001 distance, marks as closed for fill rendering
- Snap modifiers work in curve edit mode

#### Export Features
- SVG export button added to map panel
- Auto-calculates bounding box of all shapes (including those outside viewport)
- Adds black background rectangle
- 50px padding around content
- Exports clean SVG with proper viewBox fitting all content
- Filename format: `mediamime-score-{timestamp}.svg`

### Fixed
- Drawing offset issues after camera implementation (inverse transform in pointer handling)
- Performance lag when drawing rect/ellipse/line (added per-node DOM writes)
- Canvas bounds limited to 0-1 view (removed clamping throughout pointer handlers)
- Hue slider wraparound bug (360° modulo to 0° causing yellow selection issues)
- Color picker gradient direction mismatch
- Snap indicator not respecting zoom level
- Selection frame rendering with camera transform

### Technical Improvements
- `getCurrentStyle()` helper function reads color from picker CSS variables
- `getNormalizedPoint()` applies inverse camera transform
- Grid rendering accounts for camera pan/zoom
- Selection and UI overlays moved to appropriate layers
- Shape creation uses dynamic style from color picker instead of hardcoded defaults
- Constants: SNAP_GRID_SIZE=50, SNAP_ELEMENT_THRESHOLD=15

### Keyboard Shortcuts
- G: Cycle grid modes (off → line → dot → off)
- F: Frame selected shapes
- Shift+F: Frame all shapes
- Spacebar: Hold for pan mode (temporarily overrides active tool)
- Shift: Grid snap while drawing/editing
- Cmd: Element snap while drawing/editing
- Alt+Click: Remove control point in curve edit mode

### Performance Optimizations
- Unclamped coordinate system for infinite canvas
- Efficient per-node DOM updates during drawing
- Deep-equal filtering for history snapshots
- 3-step history limit to prevent memory bloat

### Layers, Streams & Inputs (2025-11-07)
- Added re-order controls for both stream and MIDI map lists; drag arrows update rendering order immediately.
- Raw source streams now show the tinted cropped feed, while the new Segmentation stream renders the subject alone with transparent background.
- Segmentation mask option temporarily removed from the UI to reduce confusion.
- Added per-stream “Hide in Main” toggle so layers can stay active in the preview while being muted on the primary canvas.
- Layer viewports no longer paint placeholder rectangles when Holistic data is missing.
- Input crop edits emit real-time state so connected streams update instantly.
- Crop overlay sticks to the cursor regardless of horizontal/vertical flips, and crops are applied after flip transforms inside the pipeline.
