# Testing & Validation Guide - Phase 1

**Testing Date:** November 10, 2025
**Implementation:** Three critical optimizations
**Expected Improvement:** 2-3x FPS increase

---

## Quick Start Testing (5 minutes)

### 1. Enable Metrics Display
1. Open the application
2. Click "Streams" panel (layers icon)
3. Click "+" to add a new layer
4. Set "Process" to "Metrics"
5. Check "Preview" checkbox
6. Observe FPS counter in top-left corner

### 2. Record Baseline Performance
1. Note FPS value at your target resolution
2. Test with different resolutions (720p, 1080p, 4K if available)
3. Compare against `performance-analysis-baseline` tag

### 3. Visual Verification
- [ ] All layers rendering correctly
- [ ] No flickering or visual artifacts
- [ ] Landmarks display properly (if enabled)
- [ ] Viewport overlays work correctly

---

## Detailed Testing Procedure

### Test 1: Visual Regression Testing

**Objective:** Ensure visual output is identical to baseline

**Steps:**
1. Load the application with a video input (use default sample if available)
2. Add layers for each feature:
   - Pose
   - Hands (if available)
   - Face (if available)
   - Raw Source
3. Compare visual output with baseline version:
   ```bash
   git stash                                    # Save current changes
   git checkout performance-analysis-baseline   # Switch to baseline
   # Run and screenshot
   git checkout main                            # Back to optimized version
   # Run and compare screenshots
   git stash pop                                # Restore changes
   ```
4. Verify visual output is identical

**Expected Result:** No visual differences between baseline and optimized version

---

### Test 2: FPS Performance Measurement

**Objective:** Measure FPS improvement at various resolutions

**Setup:**
1. Install a video file or use camera input
2. Enable Metrics layer (to see FPS display)
3. Set output to full screen or known resolution
4. Close other applications to avoid interference

**Test Procedure:**

**At 720p:**
1. Set canvas size to 1280×720 (or adjust window)
2. Record FPS reading for 30 seconds
3. Note average and minimum FPS
4. Expected improvement: baseline +50% minimum

**At 1080p:**
1. Set canvas size to 1920×1080
2. Record FPS reading for 30 seconds
3. Note average and minimum FPS
4. Expected improvement: baseline +150-200%

**At 4K (if available):**
1. Set canvas size to 3840×2160
2. Record FPS reading for 30 seconds
3. Note average and minimum FPS
4. Expected improvement: baseline +200-300%

**Recording Template:**
```
Resolution: 1920×1080
Metrics:
  - Average FPS: ___ (was ___)
  - Minimum FPS: ___ (was ___)
  - Maximum FPS: ___ (was ___)
  - Gain: ___% improvement
```

---

### Test 3: DevTools Performance Profiling

**Objective:** Identify rendering bottlenecks and confirm optimization impact

**Setup:**
1. Open Chrome/Firefox/Safari DevTools
2. Go to Performance tab
3. Ensure "Screenshots" is checked

**Recording Procedure:**
1. Start recording (Ctrl+Shift+E or via UI)
2. Let application run for 5-10 seconds
3. Interact with layers (enable/disable, add/remove)
4. Stop recording
5. Analyze results

**What to Look For:**

**Frame Rate Graph:**
- Should show sustained FPS at or near target (60)
- Drops indicate processing bottlenecks
- Smoother line = better performance

**Rendering Duration:**
- Check "Rendering" section
- Look for purple/green blocks (render time)
- Blocks should be shorter than baseline
- Fewer yellow warnings (jank)

**Long Tasks:**
- Check for tasks > 50ms
- Should be reduced significantly
- Especially fewer MediaPipe processing tasks

**Main Thread Activity:**
- Should show gaps (idle time) = good
- Continuous activity = overloaded
- Look for more idle time vs baseline

---

### Test 4: Frame Skipping Validation

**Objective:** Confirm frame skipping is working correctly

**Method 1 - Browser Console:**
```javascript
// After application loads, in console:
// Access frame skipping metrics
console.log(state.frameSkipping);

// Expected output:
// {
//   lastFrameTime: 1234567.890,
//   targetFPS: 60,
//   frameCount: 342,
//   skippedFrames: 89
// }

// Should show: skippedFrames > 0 (optimization working)
```

**Method 2 - Add Performance Logging:**

Add this to the render function in console to monitor:
```javascript
// Observe frame skipping in action
let previousTime = 0;
setInterval(() => {
  const now = performance.now();
  const elapsed = now - previousTime;
  const fps = 1000 / elapsed;
  console.log(`Frame time: ${elapsed.toFixed(1)}ms, FPS: ${fps.toFixed(1)}`);
  previousTime = now;
}, 1000);
```

**Expected Result:**
- skippedFrames value increases as app runs
- Confirms optimization is active
- Frame times closer to 16.67ms (60 FPS)

---

### Test 5: Landmark Rendering Verification

**Objective:** Confirm Path2D optimization for landmarks

**Procedure:**
1. Add a "Pose" layer
2. Load a video with clear pose landmarks
3. Compare rendering performance:
   - Enable metrics to see FPS
   - Zoom in and out (should be smooth)
   - Rotate body in different directions
   - Observe FPS remains high

**Browser Console Check:**
```javascript
// Check if Path2D is supported and used:
console.log(typeof Path2D);  // Should be 'function'

// In the renderer, Path2D path will be built:
// New approach: 1 path + 1 fill for all landmarks
// Old approach: N paths × (beginPath + arc + fill)
```

**Expected Result:**
- Smooth landmark rendering at 60 FPS
- No jank when many landmarks visible
- Path2D being used in modern browsers

---

### Test 6: Memory & Resource Usage

**Objective:** Ensure optimizations don't increase memory overhead

**Chrome DevTools - Memory Tab:**
1. Take heap snapshot (baseline)
2. Run application for 1 minute
3. Take second heap snapshot
4. Compare memory growth
5. Expected: Memory stable or slightly reduced

**DevTools - Performance → Memory:**
1. Record performance trace
2. Look at memory graph
3. Should be stable (not continuously growing)
4. No major spikes

**Expected Result:**
- Memory usage stable
- No memory leaks introduced
- Same or slightly better memory profile

---

## Regression Testing Checklist

### Functional Features
- [ ] Camera input still works
- [ ] Video file input still works
- [ ] URL input still works
- [ ] Crop functionality works correctly
- [ ] Flip (horizontal/vertical) works
- [ ] Transport controls (play/pause/scrub) work
- [ ] Playback speed control works
- [ ] Output resolution controls work

### Rendering Features
- [ ] Pose landmarks render correctly
- [ ] Hand landmarks render correctly
- [ ] Face landmarks render correctly
- [ ] Segmentation layer (when enabled) works
- [ ] Raw source layer works
- [ ] Metrics display shows correct values
- [ ] Viewport overlays display correctly
- [ ] Viewport editing (drag handles) works

### Visual Quality
- [ ] No flickering
- [ ] No visual artifacts
- [ ] No clipping or cutoff
- [ ] Colors rendered correctly
- [ ] Text readable (metrics/labels)
- [ ] Smooth interactions

### Performance
- [ ] FPS improved vs baseline
- [ ] No stuttering during interaction
- [ ] No lag during viewport editing
- [ ] No freezing during pan/zoom
- [ ] Responsive to user input

### Console & Errors
- [ ] No console errors
- [ ] No warning messages
- [ ] No performance warnings
- [ ] No deprecation notices

---

## Comparison with Baseline

### Git Commands

**See all changes since baseline:**
```bash
git diff performance-analysis-baseline..HEAD
```

**See only code changes (exclude analysis docs):**
```bash
git diff performance-analysis-baseline..HEAD -- scripts/
```

**Compare specific file:**
```bash
git diff performance-analysis-baseline:scripts/drawing/index.js scripts/drawing/index.js
```

**See commits since baseline:**
```bash
git log performance-analysis-baseline..HEAD --oneline
```

---

## Performance Measurement Template

Use this template to document your testing results:

```markdown
# Phase 1 Performance Testing Results
Date: [DATE]
Tester: [YOUR NAME]
Hardware: [CPU/GPU/RAM]

## FPS Measurements

### Resolution: 720p (1280×720)
- Baseline FPS: ___
- Optimized FPS: ___
- Improvement: ___% (target: +50%)
- Visual artifacts: None / [describe]

### Resolution: 1080p (1920×1080)
- Baseline FPS: ___
- Optimized FPS: ___
- Improvement: ___% (target: +150%)
- Visual artifacts: None / [describe]

### Resolution: 4K (3840×2160)
- Baseline FPS: ___
- Optimized FPS: ___
- Improvement: ___% (target: +200%)
- Visual artifacts: None / [describe]

## DevTools Analysis

### Rendering Performance
- Long tasks (>50ms): ___ (decreased? yes/no)
- Frame rate consistency: Good / Fair / Poor
- Jank events: ___ (decreased? yes/no)

### Memory Usage
- Initial: ___ MB
- After 1 min: ___ MB
- Growth: ___ MB (should be minimal)
- Leaks detected: None / [describe]

## Regression Testing
- Visual regressions: None / [list]
- Functional regressions: None / [list]
- New issues: None / [list]

## Overall Assessment
✓ Ready for Phase 2 / ⚠ Needs adjustment / ✗ Rollback needed

## Notes
[Any additional observations]
```

---

## Troubleshooting

### Issue: FPS didn't improve as expected

**Possible Causes:**
1. MediaPipe still processing heavy model
   - Verify: `holistic.options` shows `modelComplexity: 0`
   - Check console for model loading

2. Frame skipping not active
   - Check: `state.frameSkipping.skippedFrames > 0` in console
   - Verify: FPS target = 60 (check state)

3. Other CPU-intensive processes running
   - Close other applications
   - Disable browser extensions
   - Check system resource usage

4. Hardware limitations
   - GPU might be bottleneck
   - CPU might be bottleneck
   - Check task manager/Activity Monitor

**Solution:** Profile with DevTools to identify actual bottleneck

---

### Issue: Visual artifacts or flickering

**Possible Causes:**
1. Path2D fallback code running
   - Check: `typeof Path2D` in console (should be 'function')

2. Frame skipping too aggressive
   - Adjust: `state.frameSkipping.targetFPS` (increase value)
   - Or: Change threshold from 0.9 to 0.95

3. Canvas clearing issues
   - Check: No changes to clearRect logic
   - Verify: Viewport dimensions correct

**Solution:** Check DevTools console for errors, roll back specific change if needed

---

### Issue: Performance degraded at high resolution

**Expected:** Some FPS reduction at 4K is normal (GPU limited)
**Check:**
- Compare against Phase 1 targets (30-45 FPS @ 4K)
- Verify MediaPipe still at light complexity
- Check if other processes using GPU

**Solution:** Implement Phase 2 (dirty rectangles, resolution downsampling)

---

## Test Sign-Off

When testing is complete:

1. **Verify all critical functionality works**
2. **Document FPS measurements**
3. **Sign off on regression testing**
4. **Decide:** Ready for Phase 2? Ready for deployment?

```markdown
## Testing Sign-Off

- [ ] All visual regressions checked
- [ ] FPS improvements measured (target: 2-3x)
- [ ] Console has no errors
- [ ] Memory usage stable
- [ ] Functionality unchanged
- [ ] Ready for Phase 2 optimizations

Signed: ___________________
Date: ____________________
```

---

## Next Steps

After Phase 1 testing is complete:

1. **If successful:** Proceed to Phase 2 optimizations
2. **If issues found:** Debug and adjust Phase 1
3. **If major issues:** Refer to rollback section

**Expected Timeline:**
- Testing: 30 min - 2 hours
- Phase 2 implementation: 3-5 days
- Full optimization suite: 2-3 weeks

---

**Testing Guide Completed:** November 10, 2025
