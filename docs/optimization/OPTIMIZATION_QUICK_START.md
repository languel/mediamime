# Optimization Quick Start Guide

**Baseline Tagged:** `performance-analysis-baseline`

## Critical Issues (Implement First)

### Issue 1: MediaPipe Complexity Too High
**File:** [scripts/mediapipe/index.js:38-46](scripts/mediapipe/index.js#L38-L46)

**Current:**
```javascript
holistic.setOptions({
  modelComplexity: 1,              // MEDIUM - costs 50-100ms per frame
  smoothLandmarks: true,           // Adds smoothing delay
  enableSegmentation: true,        // EXPENSIVE - 40-60ms per frame
  smoothSegmentation: true,
  refineFaceLandmarks: true,       // EXPENSIVE - 30-50ms per frame
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
```

**Change To (Speed Preset):**
```javascript
holistic.setOptions({
  modelComplexity: 0,              // LIGHT - 20-30ms per frame
  smoothLandmarks: false,          // Real-time only
  enableSegmentation: false,       // Disable by default
  smoothSegmentation: false,
  refineFaceLandmarks: false,      // Disable by default
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
```

**Expected Improvement:** 50-70% faster MediaPipe processing (30-40 FPS → 60 FPS possible)

---

### Issue 2: Full Canvas Redraw Every Frame
**File:** [scripts/drawing/index.js:575-722](scripts/drawing/index.js#L575-L722)

**Current Problem:**
```javascript
const renderTo = (targetCtx, width, height, metrics, ...) => {
  // ...
  targetCtx.clearRect(0, 0, width, height);  // Clears ALL pixels

  // Then redraws EVERY layer regardless of changes
  state.streams.forEach((stream) => {
    if (!stream.enabled) return;
    // ... render stream ...
  });
};
```

**Optimization Strategy (Frame Skipping):**

Add to state object in `initDrawing()`:
```javascript
const state = {
  // ... existing state ...
  lastFrameTime: 0,
  targetFPS: 60,
  frameCount: 0,
  skipFrames: 0
};
```

Replace `render()` function:
```javascript
const render = () => {
  state.pendingRender = false;
  const now = performance.now();
  const elapsed = now - state.lastFrameTime;
  const frameBudget = 1000 / state.targetFPS;

  // Skip frame if we're not ready yet
  if (state.lastFrameTime > 0 && elapsed < frameBudget * 0.9) {
    state.skipFrames++;
    requestAnimationFrame(render);
    return;
  }

  state.lastFrameTime = now;
  const metrics = ensureDisplayMetrics();
  renderTo(ctx, canvas.width, canvas.height, metrics, { isPreview: false });
  renderViewportOverlay(ctx, metrics);
  if (state.previewCtx && state.previewCanvas) {
    renderTo(state.previewCtx, state.previewCanvas.width, state.previewCanvas.height, null, { isPreview: true });
  }
  state.frameCount++;
};
```

**Expected Improvement:** 30-50% FPS gain (fewer renders per second)

---

### Issue 3: Inefficient Landmark Rendering
**File:** [scripts/drawing/index.js:119-131](scripts/drawing/index.js#L119-L131)

**Current (Inefficient):**
```javascript
const drawLandmarks = (ctx, landmarks, viewportPx, color, size = 4, zoom = 1) => {
  if (!Array.isArray(landmarks)) return;
  ctx.fillStyle = color;
  const adjustedSize = size / zoom;
  landmarks.forEach((landmark) => {
    if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) return;
    const x = viewportPx.x + clampUnit(landmark.x) * viewportPx.w;
    const y = viewportPx.y + clampUnit(landmark.y) * viewportPx.h;
    ctx.beginPath();       // ← Per-landmark
    ctx.arc(x, y, adjustedSize, 0, Math.PI * 2);
    ctx.fill();            // ← Per-landmark
  });
};
```

**Change To (Batched):**
```javascript
const drawLandmarks = (ctx, landmarks, viewportPx, color, size = 4, zoom = 1) => {
  if (!Array.isArray(landmarks)) return;
  ctx.fillStyle = color;
  const adjustedSize = size / zoom;

  // Single path for all landmarks (Path2D optional for caching)
  const path = new Path2D();

  landmarks.forEach((landmark) => {
    if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) return;
    const x = viewportPx.x + clampUnit(landmark.x) * viewportPx.w;
    const y = viewportPx.y + clampUnit(landmark.y) * viewportPx.h;
    path.arc(x, y, adjustedSize, 0, Math.PI * 2);
  });

  ctx.fill(path);
};
```

**Expected Improvement:** 15-25% Canvas rendering reduction

---

## Quick Implementation Checklist

### Immediate (< 1 hour)
- [ ] Reduce MediaPipe model complexity (Issue 1)
- [ ] Add frame skipping (Issue 2)
- [ ] Batch landmark rendering (Issue 3)
- [ ] Measure FPS improvement

### Short Term (1-3 hours)
- [ ] Add output resolution presets to input panel
- [ ] Implement "Low Power Mode" toggle
- [ ] Cache computed viewport metrics

### Medium Term (4-8 hours)
- [ ] Implement dirty rectangle rendering
- [ ] Optimize viewport overlay rendering
- [ ] Add performance breakdown metrics

### Long Term (1+ weeks)
- [ ] OffscreenCanvas compositing
- [ ] Web Worker for MediaPipe
- [ ] Advanced culling strategies

---

## Testing & Validation

After each change:

```javascript
// In DevTools Console:
// 1. Monitor FPS
window.fpsTracker  // Access FPS tracker from state

// 2. Record performance timeline
performance.clearMarks();
performance.clearMeasures();
performance.mark('test-start');
// ... let app run for 5 seconds ...
performance.mark('test-end');
performance.measure('test', 'test-start', 'test-end');

// 3. Get metrics
const measure = performance.getEntriesByName('test')[0];
console.log(`Duration: ${measure.duration.toFixed(0)}ms`);
console.log(`Expected FPS: ${(5000 / measure.duration * 60).toFixed(0)}`);

// 4. Check Resource tab in DevTools
// Look for long tasks > 50ms
```

---

## Expected Results by Priority

| Change | Before | After | Gain |
|--------|--------|-------|------|
| Issue 1 (MediaPipe) | ~15 FPS @ 4K | ~25-30 FPS @ 4K | +67% |
| + Issue 2 (Frame skip) | ~25 FPS | ~35-40 FPS | +40% |
| + Issue 3 (Batching) | ~35 FPS | ~40-45 FPS | +15% |
| **Cumulative** | ~15 FPS @ 4K | ~40-45 FPS @ 4K | **+167%** |

---

## Files to Monitor During Optimization

```
scripts/
├── drawing/index.js          (Main render loop)
├── mediapipe/index.js        (ML processing)
├── input/index.js            (Source management)
├── layers/index.js           (Stream configuration)
└── ui/
    └── metrics.js            (FPS display)

index.html                     (Canvas setup)
style.css                      (GPU accelerations)
```

---

## Red Flags to Avoid

❌ **Don't:**
- Replace Canvas 2D with WebGL (unnecessary complexity)
- Enable all MediaPipe features at once
- Use heavy smooth segmentation in real-time
- Cache rendered frames (conflicts with dynamic landmarks)
- Block MediaPipe processing with synchronous code

✅ **Do:**
- Start with MediaPipe model complexity reduction
- Add feature toggles for expensive features
- Use requestAnimationFrame for all rendering
- Keep metrics on by default for user feedback
- Profile before and after each change

---

## Next Steps

1. **Read** [PERFORMANCE_ANALYSIS.md](PERFORMANCE_ANALYSIS.md) for full context
2. **Implement** Issue 1, 2, 3 in order
3. **Measure** FPS improvement at your target resolution
4. **Report** any blockers or unexpected results
5. **Iterate** to next priority level if needed

---

**Report Date:** 2025-11-10
**Baseline Version:** `performance-analysis-baseline`
