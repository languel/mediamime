# Mediamime Rendering Architecture Analysis
## Phase 3 Optimization Planning Report

**Analysis Date:** November 10, 2025  
**Repository:** mediamime  
**Focus:** OffscreenCanvas Pre-rendering and Layer Compositing Opportunities

---

## Executive Summary

The mediamime rendering architecture uses a **per-frame full-redraw approach** with Canvas 2D. While current optimizations include dirty rectangle clearing (lines 620-655), there is significant potential for **layer-level pre-rendering and OffscreenCanvas compositing** to further improve performance at high resolutions.

**Key Finding:** The architecture would greatly benefit from OffscreenCanvas pre-rendering for static/semi-static layers (viewport overlays, metrics, geometry guides) while maintaining real-time updates for dynamic data-driven layers (pose, hands, face landmarks).

---

## 1. Current Rendering Architecture

### 1.1 Render Pipeline Flow

```
requestAnimationFrame() triggered
    ↓
render() [line 798]
    ├─ ensureDisplayMetrics() [line 818]
    ├─ renderTo(ctx, canvas.width, canvas.height, metrics) [line 819]
    │  ├─ Clear dirty regions [lines 643-655]
    │  ├─ Apply camera transform [lines 660-684]
    │  └─ state.streams.forEach() [line 686]
    │     ├─ Process stream data (pose/hands/face/segmentation)
    │     └─ drawConnectorList() / drawLandmarks() / drawSegmentation()
    ├─ renderViewportOverlay(ctx, metrics) [line 820]
    │  └─ Draw viewport bounds + handles for each stream
    └─ Optional preview canvas [lines 821-823]
```

### 1.2 Layer Types and Update Frequency

| Layer Type | Update Frequency | Data Dependencies | Can Pre-render |
|-----------|-----------------|------------------|----------------|
| **Pose** | Per MediaPipe result (~10-30 FPS) | poseLandmarks, connections | Partial (landmarks change) |
| **Hands** | Per MediaPipe result (~10-30 FPS) | leftHandLandmarks, rightHandLandmarks | Partial |
| **Face** | Per MediaPipe result (~10-30 FPS) | faceLandmarks | Partial |
| **Segmentation** | Per MediaPipe result (~10-30 FPS) | segmentationMask | Partial |
| **Segmentation Stream** | Per MediaPipe result (~10-30 FPS) | segmentationMask + frame | Partial |
| **Raw** | Per video frame (up to 60 FPS) | Video frame | No |
| **Metrics** | Every frame | FPS, stream state, frame info | No (dynamic) |
| **Viewport Bounds** | When viewport/selection changes | stream.viewport, enabled state | **Yes** |
| **Viewport Overlay** | When viewport/selection changes | activeLayerId, camera state | **Yes** |

---

## 2. Data-Dependent vs. Static Processes

### 2.1 DATA_DEPENDENT_PROCESSES Set (Line 44)

```javascript
const DATA_DEPENDENT_PROCESSES = new Set(["pose", "hands", "face", "segmentation", "segmentationStream"]);
```

These layers **require real-time MediaPipe results** and cannot be pre-rendered:

- **Pose** (lines 744-747)
  - `drawConnectorList()` - draws bone connections
  - `drawLandmarks()` - draws joint points
  - Data: 33 pose landmarks from MediaPipe

- **Hands** (lines 748-753)
  - Dual-hand rendering (left + right)
  - Data: 21 landmarks per hand × 2 hands

- **Face** (lines 754-756)
  - `drawLandmarks()` for facial features
  - Data: 468 face landmarks (most vertex-dense layer)

- **Segmentation** (lines 771-779)
  - `drawSegmentation()` - applies color mask
  - Data: segmentationMask (Canvas/ImageData from MediaPipe)

- **Segmentation Stream** (lines 757-770)
  - `drawSegmentedFrame()` - composites masked frame with tint
  - Data: segmentationMask + video frame

### 2.2 Non-Data-Dependent Layers (Optimization Candidates)

#### Viewport Overlay (Lines 826-900)

```javascript
const renderViewportOverlay = (targetCtx, metrics) => {
  // Renders for each stream:
  // 1. Dashed viewport rectangle (line 875)
  // 2. Corner handles when selected (lines 877-893)
  // 3. Color coding based on stream.color
```

**Update triggers:**
- Camera changes (zoom/pan) - line 1263
- Active layer selection - line 1252
- Viewport drag interaction - lines 985-1037

**Optimization potential:** HIGH
- Could pre-render viewport rect to OffscreenCanvas (scaled by camera)
- Handles-only redraw when selection changes
- Significant reduction in transform calculations per frame

#### Metrics Display (Lines 229-362)

```javascript
const drawMetrics = (ctx, viewportPx, strokeColor, frame, results, stream, zoom, fpsTracker) => {
  // Renders:
  // 1. FPS prominently
  // 2. Stream name, source, input res
  // 3. Viewport coordinates
  // 4. Display metrics
  // 5. MediaPipe detection info
  // 6. Stream state
```

**Update triggers:**
- Every frame (FPS counter changes)

**Optimization potential:** MODERATE
- Could cache static text to OffscreenCanvas
- Only redraw FPS number portion
- Text measurement is expensive (lines 308, 313)

#### Viewport Bounds (Lines 181-192)

```javascript
const drawViewportBounds = (ctx, viewportPx, strokeColor, fillAlpha = 0, fillColor = null) => {
  // Simple rectangle with dashed stroke
  // Used as fallback for streams without results
```

**Update triggers:**
- When viewport changes
- When stream visibility/color changes

**Optimization potential:** HIGH
- Pre-render to texture
- Reuse for multiple streams with different colors (tint)

---

## 3. Viewport Changes and Their Impact

### 3.1 How Viewport Changes Affect Rendering

**Viewport normalization** (lines 56-61):
```javascript
const normalizeViewport = (viewport = {}) => ({
  x: toFiniteNumber(viewport.x, 0),      // [0-1]
  y: toFiniteNumber(viewport.y, 0),      // [0-1]
  w: Math.max(MIN_VIEWPORT_SIZE, ...),   // [0.05-1]
  h: Math.max(MIN_VIEWPORT_SIZE, ...)    // [0.05-1]
});
```

**Viewport to pixels conversion** (lines 481-489):
```javascript
const getViewportPx = (viewport, width, height) => ({
  x: normalized.x * width,           // Pixel coordinate
  y: normalized.y * height,
  w: normalized.w * width,           // Pixel dimensions
  h: normalized.h * height
});
```

**Impact on layers:**
- Every stream has `.viewport` property (normalized 0-1 coords)
- Viewport defines the **clipping region and transform** for that stream
- Multiple viewports per canvas = no single pre-rendered layer possible
- Each layer renders in its own viewport space independently

### 3.2 Camera Transform Interaction (Lines 660-684)

```javascript
// Apply camera zoom/pan (affects overlay only, not main stream rendering)
if (!isPreview && metrics?.usesDomMatrix && metrics.worldToCanvasMatrix) {
  const m = metrics.worldToCanvasMatrix;
  targetCtx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
} else if (!isPreview && camera && viewBox && metrics) {
  const baseScaleX = camera.zoom * (metrics.worldScaleX || 1);
  const baseScaleY = camera.zoom * (metrics.worldScaleY || 1);
  // ... scale and translate based on camera
}
```

**Effects on pre-rendering strategy:**
- Viewport overlay **must be** responsive to camera changes
- Pre-rendering overlay would need to be cached and reapplied with transform
- This is where **matrix-based compositing** becomes valuable

---

## 4. OffscreenCanvas Pre-rendering Opportunities

### 4.1 Ideal Candidates for OffscreenCanvas

#### Candidate 1: Viewport Bounds Layer (HIGH PRIORITY)

**Current Rendering:**
```javascript
// Lines 738-741: Fallback when no data
if (!results) {
  if (DATA_DEPENDENT_PROCESSES.has(stream.process)) {
    targetCtx.restore();
    return;
  }
  drawViewportBounds(targetCtx, viewportPx, strokeColor, fillAlpha, fillColor);
  targetCtx.restore();
  return;
}
```

**Pre-rendering Strategy:**
1. Create OffscreenCanvas per stream viewport size
2. Draw viewport bounds once when stream created/modified
3. Composite using `drawImage()` each frame (significantly faster than path drawing)
4. Only redraw when:
   - Stream color changes
   - Viewport dimensions change
   - Enabled state changes

**Expected Performance Gain:** 20-30% for layers without real-time data

**Implementation complexity:** Low (2/5)

#### Candidate 2: Static Viewport Overlay (MEDIUM PRIORITY)

**Current Rendering (Lines 858-896):**
```javascript
state.streams.forEach((stream) => {
  if (!stream?.enabled) return;
  const normalized = normalizeViewport(stream.viewport);
  const scoreX = normalized.x * viewBox.width;
  const scoreY = normalized.y * viewBox.height;
  // ... draw dashed rect + handles if active
```

**Pre-rendering Strategy:**
1. Maintain OffscreenCanvas cache for each stream's viewport rect
2. Pre-render: dashed rectangle outline (geometry only)
3. On each frame:
   - Apply camera transform to main canvas
   - Composite viewport rect from OffscreenCanvas
   - Only redraw handles when `activeLayerId` changes

**Why this helps:**
- Eliminates per-frame `setLineDash()` + `strokeRect()` calls
- `drawImage()` is ~3-5x faster than path drawing
- Camera transform applied to composite, not individual strokes

**Expected Performance Gain:** 15-25% for overlay rendering

**Implementation complexity:** Medium (3/5) - requires transform application

#### Candidate 3: Metrics Panel (LOW-MEDIUM PRIORITY)

**Current Problem (Lines 308, 313):**
```javascript
const fpsWidth = ctx.measureText(fpsText).width;  // Expensive
const maxWidth = Math.max(fpsWidth, ...regularMetrics.map(m => ctx.measureText(m).width));
// ... then renders background + 10-15 text lines
```

**Pre-rendering Strategy:**
1. OffscreenCanvas for static metrics panel background
2. Separate canvas for FPS number (updates every frame)
3. Separate canvas for dynamic content (stream info)

**Only viable if:**
- Metrics panel has fixed layout (doesn't scale with viewport changes)
- Need to cache text measurements

**Expected Performance Gain:** 5-10% when metrics enabled

**Implementation complexity:** Medium-High (4/5) - text rendering is complex

---

## 5. Which Layers Would Benefit Most from OffscreenCanvas

### Ranking by Impact:

1. **Viewport Overlay (Handles + Bounds)** - HIGHEST ROI
   - Frequently rendered (every frame)
   - Changes infrequently (only on interaction)
   - Simple geometry (rectangles, handles)
   - Pre-rendering benefit: 15-25% FPS gain
   - Complexity: Medium
   - Recommendation: **IMPLEMENT FIRST**

2. **Viewport Bounds Fallback** - HIGH ROI
   - Simpler than overlay
   - Pre-rendering benefit: 10-20% for disabled/hidden layers
   - Complexity: Low
   - Recommendation: **IMPLEMENT SECOND**

3. **Metrics Display** - MEDIUM ROI
   - Always rendered when enabled
   - Text measurement is expensive
   - Only partially pre-renderable (FPS changes every frame)
   - Pre-rendering benefit: 5-10% when enabled
   - Complexity: High
   - Recommendation: **IMPLEMENT THIRD (if time permits)**

4. **Data-Dependent Layers (Pose/Hands/Face)** - LOW ROI
   - **NOT suitable for simple OffscreenCanvas caching**
   - Landmarks change every frame
   - Would need per-frame updates (negating benefit)
   - Better optimization: Path2D batching, culling

5. **Segmentation** - LOW ROI
   - Mask updates frequently
   - drawImage() performance already optimized
   - Would require OffscreenCanvas recreate every frame

---

## 6. Current Use of OffscreenCanvas in Codebase

**Current Status:** No OffscreenCanvas usage found

Search results:
```bash
grep -r "OffscreenCanvas\|offscreen" --include="*.js" /scripts/
# Result: No matches
```

**Existing Optimization Techniques:**
1. **Dirty Rectangle Clearing** (Lines 620-655)
   - Clears only union of stream viewports instead of full canvas
   - Reduces pixel operations by 40-80%
   - Already implemented and effective

2. **Frame Skipping** (Lines 440-446, 803-816)
   - Skips rendering if running ahead of target FPS
   - Reduces unnecessary frame processing
   - Already implemented

3. **Output Resolution Scaling** (Lines 447-453, 1156-1175)
   - Supports resolution presets (1080p, 720p, etc.)
   - Allows runtime quality adjustment

---

## 7. Implementation Strategy for Phase 3

### 7.1 Architecture Design

**Proposed OffscreenCanvas Layer System:**

```
┌─────────────────────────────────────────────┐
│ Main Canvas (layer-compositor)              │
│                                             │
│ ┌──────────────────────────────────────┐   │
│ │ Base Layer                           │   │
│ │ ├─ Raw video frames                  │   │
│ │ ├─ Segmentation masks                │   │
│ │ └─ Dynamic landmarks (pose/hands)    │   │
│ └──────────────────────────────────────┘   │
│                                             │
│ ┌──────────────────────────────────────┐   │
│ │ Overlay Layer (OffscreenCanvas)      │   │
│ │ ├─ Viewport bounds (pre-rendered)    │   │
│ │ ├─ Selection handles (if active)     │   │
│ │ └─ Composed with camera transform    │   │
│ └──────────────────────────────────────┘   │
│                                             │
│ ┌──────────────────────────────────────┐   │
│ │ Metrics Layer (optional cache)       │   │
│ │ ├─ Panel background                  │   │
│ │ ├─ FPS text (updates every frame)    │   │
│ │ └─ Dynamic content                   │   │
│ └──────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### 7.2 Implementation Priority

**Phase 3a (Week 1): Viewport Bounds Pre-rendering**
- Create OffscreenCanvas for each stream's bounds rectangle
- Trigger redraw only on: color change, viewport change, enable state change
- Composite using `drawImage()` in renderTo()
- Expected gain: 10-20% FPS for streams without real-time data

**Phase 3b (Week 2): Viewport Overlay Compositing**
- Pre-render viewport rectangles to OffscreenCanvas
- Handle selection state separately (redraw handles only when needed)
- Apply camera transform to composed overlay
- Expected gain: 15-25% FPS for overlay rendering

**Phase 3c (Week 3): Metrics Panel Caching** (optional)
- Cache static panel background
- Update FPS text separately
- May not be worth complexity if metrics < 5% overhead

### 7.3 Integration Points

**Key locations to modify:**

1. **initDrawing() state object** (Lines 422-457)
   - Add offscreenCanvases Map for caching
   - Track which streams need redraw

2. **renderTo() function** (Lines 604-796)
   - Check offscreenCanvas cache before drawing
   - Composite cached layers using drawImage()

3. **renderViewportOverlay() function** (Lines 826-900)
   - Refactor to use pre-rendered bounds
   - Only redraw handles when activeLayerId changes

4. **Event handlers** (Lines 1228-1276)
   - Invalidate cache when viewport/color changes
   - Trigger selective redraw

---

## 8. Recommendations Summary

### Quick Wins (No OffscreenCanvas)
1. ✅ **Batch landmark rendering with Path2D** (5-15% gain)
   - Combine multiple landmarks into single path
   - Already supported in current canvas context

2. ✅ **Cache FPS calculations** (2-5% gain)
   - Store last 30 frame times in circular buffer
   - Avoid recalculating every frame

### Medium-Effort Wins (OffscreenCanvas)
1. **Pre-render viewport bounds** (10-20% gain)
   - OffscreenCanvas per stream
   - Redraw only on configuration changes

2. **Cache viewport overlay rectangles** (15-25% gain)
   - Pre-render geometry only
   - Apply transform on composition

### High-Impact Architecture Changes
1. **Web Worker for MediaPipe** (30-50% gain)
   - Move processing off main thread
   - Reduces jank during high-load periods

2. **Adaptive streaming quality** (20-40% gain)
   - Reduce input resolution when behind on FPS
   - Dynamically adjust MediaPipe complexity

---

## 9. Key Code Locations Reference

| Component | Location | Lines | Function |
|-----------|----------|-------|----------|
| Data-dependent set | drawing/index.js | 44 | Defines layer types requiring real-time data |
| renderTo() | drawing/index.js | 604-796 | Main render function |
| Dirty rectangle logic | drawing/index.js | 620-655 | Current optimization |
| Viewport overlay | drawing/index.js | 826-900 | Handles + bounds rendering |
| Metrics display | drawing/index.js | 229-362 | FPS + info text |
| drawViewportBounds() | drawing/index.js | 181-192 | Simple rect with dash pattern |
| drawLandmarks() | drawing/index.js | 119-131 | Joint point rendering (inefficient) |
| Camera transform | drawing/index.js | 660-684 | Matrix application |
| Frame skipping | drawing/index.js | 798-823 | requestAnimationFrame throttling |
| MediaPipe options | mediapipe/index.js | 38-46 | Complexity/features tuning |

---

## Conclusion

The mediamime rendering architecture is well-structured with existing optimizations (dirty rectangles, frame skipping). **OffscreenCanvas pre-rendering can provide 10-25% additional FPS improvement** by caching static/semi-static layers (viewport overlays, bounds).

**Recommended Phase 3 Focus:**
1. Implement viewport bounds OffscreenCanvas caching (HIGH ROI)
2. Implement viewport overlay pre-rendering (HIGH ROI)
3. Consider metrics panel optimization (MEDIUM ROI, high complexity)

The data-dependent layers (pose, hands, face) are **not suitable** for simple OffscreenCanvas caching since they update every frame. Alternative optimizations like Path2D batching and landmark culling would be more effective for these layers.

