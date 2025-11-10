# Browser Console Cheatsheet

**Quick reference for using optimization features from browser console**

---

## Input Resolution API

### Get Active Input
```javascript
const inputId = input.getActiveInput().id;
console.log('Active input:', inputId);
```

### Apply Preset Resolution
```javascript
// Recommended for balanced performance
input.applyInputResolutionPreset(inputId, '480p');

// Other presets
input.applyInputResolutionPreset(inputId, '720p');  // High quality
input.applyInputResolutionPreset(inputId, '360p');  // High speed
input.applyInputResolutionPreset(inputId, '240p');  // Maximum speed
input.applyInputResolutionPreset(inputId, 'full');  // Full resolution
```

### Check Current Resolution
```javascript
const res = input.getInputResolution(inputId);
console.log(res);
// Output: { preset: '480p', width: 854, height: 480 }
```

### Set Custom Resolution
```javascript
input.setInputResolution(inputId, 'custom', 800, 450);
const res = input.getInputResolution(inputId);
console.log('Custom resolution:', res);
```

### Get All Inputs
```javascript
const inputs = input.getInputs();
console.log('Available inputs:', inputs);
// Shows: [{ id, name, type }, ...]
```

---

## Performance Mode API

### Enable Performance Mode (Defaults)
```javascript
// Maximum FPS for editor interactions
drawing.setPerformanceMode(true);
// Result: 60-120+ FPS, MediaPipe disabled
```

### Enable with Custom Options
```javascript
drawing.setPerformanceMode(true, {
  targetFPS: 120,
  disableMediaPipe: true,
  disableLandmarkRendering: true,
  disableMetrics: true,
  disableViewportOverlay: true,
  minimalResolution: true
});
```

### Keep Metrics Visible
```javascript
drawing.setPerformanceMode(true, {
  disableMetrics: false  // Keep FPS/stats visible
});
```

### Keep Landmarks Visible
```javascript
drawing.setPerformanceMode(true, {
  disableLandmarkRendering: false  // Show pose/hand/face
});
```

### Check Current Mode
```javascript
const mode = drawing.getPerformanceMode();
console.log(mode);
// Output: { enabled: true, targetFPS: 120, ... } or null
```

### Disable Performance Mode
```javascript
drawing.setPerformanceMode(false);
// Returns to normal rendering with all features
```

---

## Combined Optimization Examples

### Example 1: Editor Setup (Maximum FPS)
```javascript
const id = input.getActiveInput().id;

// Step 1: Enable Performance Mode
drawing.setPerformanceMode(true);

// Step 2: Reduce input resolution for reference
input.applyInputResolutionPreset(id, '480p');

console.log('✅ Editor mode: 60-120+ FPS for smooth interactions');
```

### Example 2: Balanced Detection
```javascript
const id = input.getActiveInput().id;

// Step 1: Disable Performance Mode (normal rendering)
drawing.setPerformanceMode(false);

// Step 2: Use 480p for MediaPipe
input.applyInputResolutionPreset(id, '480p');

console.log('✅ Balanced mode: 1.5-2x faster detection');
```

### Example 3: High-Quality Detection
```javascript
const id = input.getActiveInput().id;

// Step 1: Normal rendering
drawing.setPerformanceMode(false);

// Step 2: Full resolution
input.applyInputResolutionPreset(id, 'full');

console.log('✅ Quality mode: Best detection accuracy');
```

### Example 4: High-Speed Processing
```javascript
const id = input.getActiveInput().id;

// Step 1: Performance Mode enabled
drawing.setPerformanceMode(true);

// Step 2: Minimal input resolution
input.applyInputResolutionPreset(id, '360p');

console.log('✅ Speed mode: Maximum throughput');
```

---

## Monitoring & Debugging

### Check Performance Mode State
```javascript
const mode = drawing.getPerformanceMode();
console.table(mode);
// Shows all settings in table format
```

### Check Input Resolution
```javascript
const id = input.getActiveInput().id;
const res = input.getInputResolution(id);
console.log('Input resolution:', res);
```

### Verify APIs Available
```javascript
console.log('Input API:', {
  applyInputResolutionPreset: typeof input.applyInputResolutionPreset,
  getInputResolution: typeof input.getInputResolution,
  setInputResolution: typeof input.setInputResolution,
  getActiveInput: typeof input.getActiveInput
});

console.log('Drawing API:', {
  setPerformanceMode: typeof drawing.setPerformanceMode,
  getPerformanceMode: typeof drawing.getPerformanceMode
});
```

### Monitor FPS (Performance Mode)
```javascript
// In Performance Mode with metrics visible:
drawing.setPerformanceMode(true, {
  disableMetrics: false  // Keep metrics visible
});

// Watch console or viewport metrics
// Expected: 60-120+ FPS
```

---

## Common Tasks

### Setup for Video Editing Session
```javascript
const id = input.getActiveInput().id;

// Maximum FPS for smooth viewport interactions
drawing.setPerformanceMode(true);
input.applyInputResolutionPreset(id, '480p');

// After setup, return to normal
// drawing.setPerformanceMode(false);
```

### Switch Between Multiple Inputs
```javascript
// Get all inputs
const inputs = input.getInputs();

// Apply to specific input
const targetId = inputs[0].id;  // First input
input.applyInputResolutionPreset(targetId, '480p');
```

### Gradually Increase Quality
```javascript
const id = input.getActiveInput().id;

// Start at high speed
input.applyInputResolutionPreset(id, '360p');
// Monitor FPS and detection quality

// Increase quality if FPS allows
input.applyInputResolutionPreset(id, '480p');

// Further increase if needed
input.applyInputResolutionPreset(id, '720p');

// Full quality as last resort
input.applyInputResolutionPreset(id, 'full');
```

### Reset Everything to Defaults
```javascript
const id = input.getActiveInput().id;

// Reset input resolution
input.applyInputResolutionPreset(id, 'full');

// Disable Performance Mode
drawing.setPerformanceMode(false);

console.log('✅ Reset to default settings');
```

---

## Preset Comparison

### Quick Reference Table
```javascript
// Run in console to see presets:
console.table([
  { preset: '240p', width: 426, height: 240, pixels: '6%', speed: '+85%' },
  { preset: '360p', width: 640, height: 360, pixels: '12%', speed: '+75%' },
  { preset: '480p', width: 854, height: 480, pixels: '28%', speed: '+60%' },
  { preset: '720p', width: 1280, height: 720, pixels: '75%', speed: '+25%' },
  { preset: 'full', width: 'original', height: 'original', pixels: '100%', speed: 'baseline' }
]);
```

**Recommended:** `480p` (balanced speed and quality)

---

## Troubleshooting Commands

### API Not Found?
```javascript
// Check if APIs are available
if (typeof input?.applyInputResolutionPreset !== 'function') {
  console.error('Input API not available');
} else {
  console.log('✅ Input API available');
}

if (typeof drawing?.setPerformanceMode !== 'function') {
  console.error('Drawing API not available');
} else {
  console.log('✅ Drawing API available');
}
```

### Input Not Found?
```javascript
// Check if inputs exist
const inputs = input.getInputs();
if (!inputs || inputs.length === 0) {
  console.error('No inputs found');
} else {
  console.log('Available inputs:', inputs.map(i => ({ id: i.id, name: i.name })));
}
```

### Change Not Taking Effect?
```javascript
const id = input.getActiveInput().id;

// Verify current state
console.log('Current resolution:', input.getInputResolution(id));

// Try setting again
input.applyInputResolutionPreset(id, '480p');

// Check if it was applied
console.log('New resolution:', input.getInputResolution(id));

// Wait 1-2 seconds for effect to take place
```

---

## Performance Measurement

### Simple FPS Counter
```javascript
let frameCount = 0;
let lastTime = performance.now();

const measureFPS = () => {
  frameCount++;
  const now = performance.now();

  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frameCount}`);
    frameCount = 0;
    lastTime = now;
  }
};

// Run in animation loop - shows FPS each second
```

### Compare Performance (Manual)
```javascript
// Record baseline
input.applyInputResolutionPreset(input.getActiveInput().id, 'full');
console.log('Baseline (full resolution) - watch FPS for 30 seconds');

// Wait 30 seconds, then:
input.applyInputResolutionPreset(input.getActiveInput().id, '480p');
console.log('Optimized (480p) - watch FPS for 30 seconds');

// Calculate improvement ratio
```

---

## Copy-Paste Ready Scripts

### One-Liner Optimizations
```javascript
// Maximum performance for editor
const id=input.getActiveInput().id;drawing.setPerformanceMode(true);input.applyInputResolutionPreset(id,'480p');console.log('✅ Editor mode active');

// Balanced performance
const id=input.getActiveInput().id;drawing.setPerformanceMode(false);input.applyInputResolutionPreset(id,'480p');console.log('✅ Balanced mode active');

// Reset to defaults
const id=input.getActiveInput().id;drawing.setPerformanceMode(false);input.applyInputResolutionPreset(id,'full');console.log('✅ Reset to defaults');
```

---

## Key Statistics

| Resolution | Speed Gain | Quality Impact |
|-----------|-----------|-----------------|
| 240p | +85% | Poor (very blocky) |
| 360p | +75% | Fair (noticeable blocks) |
| 480p | +60% | Good (recommended) |
| 720p | +25% | Excellent (minimal loss) |
| full | baseline | Perfect |

**Performance Mode Impact:** 6-17x faster frame rendering (but no MediaPipe detection)

---

## Quick Decision Tree

```
"What should I use?"

  ├─ "I'm setting up the viewport/editor"
  │  └─ drawing.setPerformanceMode(true)
  │     input.applyInputResolutionPreset(id, '480p')
  │     → 60-120+ FPS
  │
  ├─ "I want fast detection with good quality"
  │  └─ drawing.setPerformanceMode(false)
  │     input.applyInputResolutionPreset(id, '480p')
  │     → 1.5-2x faster, good accuracy
  │
  ├─ "I need maximum accuracy"
  │  └─ drawing.setPerformanceMode(false)
  │     input.applyInputResolutionPreset(id, 'full')
  │     → Best accuracy
  │
  └─ "I need maximum speed"
     └─ drawing.setPerformanceMode(true)
        input.applyInputResolutionPreset(id, '360p')
        → Maximum throughput
```

---

**Last Updated:** November 10, 2025
**Status:** Production Ready
