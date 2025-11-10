# Input Resolution Testing Guide

**Date:** November 10, 2025
**Purpose:** Validate that input resolution reduction works correctly
**Status:** Implementation Complete - Ready for Testing

---

## Critical Fix Applied

The input resolution feature had a bug where changing input W/H values would resize the output streams (zoom effect) instead of only affecting MediaPipe processing.

**Fix Details:**
- Separated display canvas from MediaPipe processing canvas
- Display canvas always rendered at full cropped resolution
- New `processor.mediapipeCanvas` created separately for ML processing
- `processor.mediapipeFrameForHolistic` references correct canvas for MediaPipe

---

## Test Plan

### Test 1: Verify Display Canvas Unaffected (CRITICAL)

**Objective:** Confirm that changing input resolution does NOT resize the output layers

**Steps:**
1. Open application in browser
2. Start with camera/video input
3. Note the current output layer size
4. Open browser console and run:
```javascript
const inputId = input.getActiveInput().id;
input.applyInputResolutionPreset(inputId, '480p');
```
5. Observe the output layers

**Expected Result:**
- ✅ Output layer size remains UNCHANGED
- ✅ No zoom/resize effect on streams
- ✅ Canvas display quality unchanged
- ✅ If RAW stream visible, should show pixelation effect

**Pass/Fail:** `___`

---

### Test 2: Verify FPS Improvement

**Objective:** Confirm that reducing input resolution improves MediaPipe processing speed

**Steps:**
1. Open browser console and run:
```javascript
// Check initial FPS (full resolution)
input.getActiveInput();

// Check Performance Mode state
drawing.getPerformanceMode();

// Enable Performance Mode to isolate MediaPipe timing
drawing.setPerformanceMode(true, {
  disableMediaPipe: false,  // Keep MediaPipe ENABLED
  disableLandmarkRendering: true,
  disableMetrics: false  // Keep visible for monitoring
});

// Note FPS for 30 seconds
```

2. Enable input resolution and recheck:
```javascript
const inputId = input.getActiveInput().id;
input.applyInputResolutionPreset(inputId, '480p');
// Note FPS for 30 seconds
```

3. Return to full resolution:
```javascript
input.applyInputResolutionPreset(inputId, 'full');
```

**Expected Result:**
- ✅ FPS noticeably higher at 480p vs full
- ✅ Expected improvement: 1.5-2x faster (40-60% reduction in processing time)
- ✅ Quality of detection still acceptable

**Full Resolution FPS:** `___`
**480p FPS:** `___`
**Improvement:** `___x faster`

**Pass/Fail:** `___`

---

### Test 3: Test All Presets

**Objective:** Verify each input resolution preset works correctly

**Steps:**
```javascript
const inputId = input.getActiveInput().id;

// Test each preset
const presets = ['720p', '480p', '360p', '240p', 'full'];

for (const preset of presets) {
  input.applyInputResolutionPreset(inputId, preset);
  const res = input.getInputResolution(inputId);
  console.log(`${preset}:`, res);
  // Visually inspect for:
  // - No zoom/resize of output
  // - Correct resolution in console
  // - Expected pixelation on RAW stream
}
```

**Expected Results:**

| Preset | Width | Height | Status |
|--------|-------|--------|--------|
| full | null | null | ✅ Full resolution |
| 720p | 1280 | 720 | ✅ Works |
| 480p | 854 | 480 | ✅ Works |
| 360p | 640 | 360 | ✅ Works |
| 240p | 426 | 240 | ✅ Works |

**Pass/Fail:** `___`

---

### Test 4: Custom Resolutions

**Objective:** Verify custom resolution setting works

**Steps:**
```javascript
const inputId = input.getActiveInput().id;

// Test custom resolution
input.setInputResolution(inputId, 'custom', 800, 450);
const res = input.getInputResolution(inputId);
console.log('Custom 800x450:', res);

// Verify no zoom effect on output
// Check FPS improvement
```

**Expected Result:**
- ✅ Custom resolution applied correctly
- ✅ Output display unaffected
- ✅ FPS improved appropriately

**Pass/Fail:** `___`

---

### Test 5: RAW Stream Display with Pixelation

**Objective:** Verify that RAW stream shows pixelation at reduced resolution

**Steps:**
1. Open application with RAW input stream visible
2. Set input resolution to 480p:
```javascript
const inputId = input.getActiveInput().id;
input.applyInputResolutionPreset(inputId, '480p');
```
3. Observe the RAW stream in the viewport

**Expected Result:**
- ✅ RAW stream shows pixelation/blockiness
- ✅ Effect more pronounced at 240p/360p
- ✅ Less noticeable at 720p
- ✅ Full resolution shows no pixelation

**Pixelation Visible:** `yes / no`
**Pass/Fail:** `___`

---

### Test 6: Crop + Flip + Input Resolution Combined

**Objective:** Verify input resolution works with crop and flip settings

**Steps:**
```javascript
const inputId = input.getActiveInput().id;

// Apply crop
input.setCrop(inputId, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 });

// Apply flip
input.setFlip(inputId, { horizontal: true, vertical: false });

// Apply input resolution
input.applyInputResolutionPreset(inputId, '480p');

// Observe:
// - Crop region visible and correct
// - Horizontal flip applied
// - No zoom effect
// - FPS improved
```

**Expected Result:**
- ✅ All transformations applied correctly
- ✅ No visual conflicts
- ✅ Output size unchanged
- ✅ MediaPipe processes cropped+flipped+reduced image

**Pass/Fail:** `___`

---

### Test 7: Toggle Between Presets

**Objective:** Verify switching between presets doesn't cause artifacts

**Steps:**
```javascript
const inputId = input.getActiveInput().id;

// Rapidly toggle presets
input.applyInputResolutionPreset(inputId, '480p');
// Wait 2 seconds
input.applyInputResolutionPreset(inputId, '720p');
// Wait 2 seconds
input.applyInputResolutionPreset(inputId, 'full');
// Wait 2 seconds
input.applyInputResolutionPreset(inputId, '360p');

// Look for glitches, flickering, or zoom artifacts
```

**Expected Result:**
- ✅ Smooth transitions between presets
- ✅ No flickering or visual artifacts
- ✅ FPS adjusts smoothly
- ✅ No zoom/resize effects

**Pass/Fail:** `___`

---

### Test 8: Performance Mode Integration

**Objective:** Verify input resolution works correctly with Performance Mode

**Steps:**
```javascript
const inputId = input.getActiveInput().id;
drawing.setPerformanceMode(true);
input.applyInputResolutionPreset(inputId, '480p');

// Observe:
// - Very high FPS (60+ expected)
// - Only video input visible
// - No zoom effect on output
// - Smooth editor interactions
```

**Expected Result:**
- ✅ FPS very high (60-120+)
- ✅ Output display quality maintained
- ✅ Editor remains responsive
- ✅ Perfect for setup/calibration

**FPS with Performance Mode + 480p:** `___`
**Pass/Fail:** `___`

---

## Validation Checklist

- [ ] Test 1: Display canvas unaffected by input resolution
- [ ] Test 2: FPS improves with reduced input resolution
- [ ] Test 3: All presets work correctly
- [ ] Test 4: Custom resolutions work
- [ ] Test 5: RAW stream shows pixelation
- [ ] Test 6: Crop + flip + input resolution work together
- [ ] Test 7: Switching presets is smooth
- [ ] Test 8: Performance Mode integration works

---

## Browser Console Commands Reference

### Quick Setup
```javascript
// Get active input
const inputId = input.getActiveInput().id;

// Apply preset
input.applyInputResolutionPreset(inputId, '480p');

// Check current resolution
console.log(input.getInputResolution(inputId));

// Get all inputs
console.log(input.getInputs());
```

### Monitoring
```javascript
// Check rendering FPS
console.log(drawing.getPerformanceMode());

// Check if MediaPipe is bottleneck
drawing.setPerformanceMode(true, { disableMediaPipe: false });

// Disable Performance Mode to see full rendering
drawing.setPerformanceMode(false);
```

### Reset Everything
```javascript
const inputId = input.getActiveInput().id;
input.applyInputResolutionPreset(inputId, 'full');
drawing.setPerformanceMode(false);
```

---

## Known Issues & Workarounds

### Issue: Resolution change seems to take effect slowly
**Cause:** MediaPipe canvas creation is lazy (on first use)
**Workaround:** Wait 1-2 seconds after applying preset for full effect
**Fix:** None needed - expected behavior

### Issue: Custom resolution doesn't apply
**Cause:** Preset name must be 'custom' when using custom dimensions
**Workaround:** Use `setInputResolution(id, 'custom', w, h)` not a preset name
**Fix:** None needed - API working as designed

### Issue: Performance improvement not visible
**Cause:** Bottleneck might be video input, not MediaPipe processing
**Reference:** See docs/optimization/VIDEO_RENDERING_BOTTLENECK.md
**Recommendation:** Test in Performance Mode with MediaPipe disabled to isolate

---

## Success Criteria

✅ **CRITICAL:** No zoom/resize effects on output layers
✅ **IMPORTANT:** FPS improvement measurable (1.5-2x at 480p)
✅ **IMPORTANT:** All presets functional
✅ **NICE:** Pixelation visible on RAW stream at reduced resolutions
✅ **NICE:** Smooth integration with Performance Mode

---

## Test Results Summary

**Date Tested:** `___________`
**Tester:** `___________`
**Overall Result:** `PASS / FAIL`

**Issues Found:**
1. `___`
2. `___`
3. `___`

**Notes:**
```
_________________________________________________________________________

_________________________________________________________________________

_________________________________________________________________________
```

---

**Next Steps if Issues Found:**
1. Check browser console for JavaScript errors
2. Verify input resolution API availability: `typeof input.applyInputResolutionPreset`
3. Review implementation in scripts/mediapipe/index.js lines 108-167
4. Check that `processor.mediapipeFrameForHolistic` is correctly set

---

**Test Completion Date:** November 10, 2025
**Status:** Ready for Testing
