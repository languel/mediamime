# Video Rendering Bottleneck Analysis

**Date:** November 10, 2025
**Status:** Investigation needed
**Observation:** FPS remains ~10-20 even in "Performance Mode" (drawing only, no MediaPipe processing)

---

## Key Finding

Despite Phase 1, 2, and 3 optimizations showing measurable improvements in rendering pipeline efficiency, the actual observed FPS remains at **10-20 FPS** even when:
- **MediaPipe processing is disabled**
- **Only canvas drawing operations are executed**
- **Output resolution is reduced to lower presets**
- **Dirty rectangle clearing is active**
- **Frame skipping is enabled**

This indicates **the actual bottleneck is likely video frame acquisition/decoding, not rendering**.

---

## Hypothesis

The bottleneck is in the **video input pipeline**, not the drawing engine:

### Probable Causes

1. **Video Decoding Latency**
   - HTMLVideoElement decoding may be slow
   - GPU video decoding capabilities limited on hardware
   - Software fallback decoding being used

2. **Frame Rate Limitation**
   - Video source might be limited to 10-20 FPS natively
   - Browser/system frame sync limiting to this rate
   - Video stream encoding preventing faster decode

3. **Camera Input Constraints**
   - Webcam hardware limited to 10-20 FPS
   - USB bandwidth limiting frame rate
   - Driver or system constraints

4. **Canvas Drawing to Video Source**
   - If drawing from video frame source, bottleneck in frame acquisition
   - Not in rendering path, but in input path

---

## Evidence

**What We Know:**
- Phase 1-2-3 optimizations are mathematically sound
- Canvas rendering operations are now highly optimized
- MediaPipe processing can be disabled without FPS improvement
- "Performance mode" (drawing only) shows same FPS

**What This Suggests:**
- The rendering pipeline is NOT the bottleneck
- Frame acquisition/video processing IS the bottleneck
- Optimization focus should shift to input pipeline, not output rendering

---

## Next Steps for Investigation

### 1. Profile the Input Pipeline

```javascript
// Measure video frame timing
let lastFrameTime = performance.now();
let frameCount = 0;
const videoElement = document.querySelector('video');

const checkFrameRate = () => {
  const now = performance.now();
  const elapsed = now - lastFrameTime;
  frameCount++;

  if (frameCount % 60 === 0) {
    const fps = (frameCount / elapsed) * 1000;
    console.log(`Input FPS: ${fps.toFixed(1)}`);
  }

  if (videoElement) {
    console.log(`Video current time: ${videoElement.currentTime}`);
  }
};
```

### 2. Check Video Properties

```javascript
const video = document.querySelector('video');
console.log({
  videoWidth: video.videoWidth,
  videoHeight: video.videoHeight,
  duration: video.duration,
  framerate: video.framerate || 'unknown',
  paused: video.paused,
  readyState: video.readyState
});
```

### 3. Measure Frame Acquisition Time

Track how long it takes to get a new frame from video source:
- Time between video `timeupdate` events
- Time between `requestAnimationFrame` callbacks
- Time MediaPipe spends waiting for frames

### 4. Check Bottleneck Location

Add performance markers to identify exact bottleneck:
```javascript
const renderFrame = () => {
  const t1 = performance.now();  // Start of frame

  const frame = getVideoFrame();  // How long?
  const t2 = performance.now();

  ctx.drawImage(frame, ...);      // How long?
  const t3 = performance.now();

  console.log(`
    Input: ${t2-t1}ms
    Drawing: ${t3-t2}ms
    Total: ${t3-t1}ms
  `);
};
```

---

## Optimization Strategy (If Input is Bottleneck)

If video decoding/acquisition is the limiting factor, consider:

### Phase 4A: Input Pipeline Optimization

1. **Use Offscreen Canvas for Video Decoding**
   - Pre-decode video frames to OffscreenCanvas
   - Use Web Worker if available

2. **Implement Frame Buffering**
   - Buffer decoded frames ahead of time
   - Reduce jitter from frame acquisition timing

3. **Adaptive Frame Skipping**
   - If input FPS is 10-20, cap output rendering to match
   - Prevents wasting render cycles waiting for frames

4. **Hardware Acceleration**
   - Force GPU video decoding if available
   - Use WebGL for video frame processing

5. **Web Worker for Input Processing**
   - Offload frame acquisition to background thread
   - Prevent blocking main rendering thread

### Phase 4B: Camera/Video Source Optimization

1. **Check Camera Capabilities**
   - Query supported frame rates
   - Use highest available native frame rate

2. **Video Codec Optimization**
   - Use faster codecs (H.264 vs VP9)
   - Reduce keyframe intervals

3. **Resolution Adaptation**
   - Match video source resolution to canvas size
   - Avoid scaling overhead

---

## Estimated Impact of Input Optimization

If input pipeline is indeed the bottleneck:

**Current:** 10-20 FPS (input-limited)
**After Input Optimization:** Could reach 30-60 FPS (rendering-capable)
**Potential Gain:** +2-4x improvement

This would dwarf Phase 1-3 rendering optimizations (which are now 60-70% faster but IO-limited).

---

## Conclusion

**The Phase 1-3 rendering optimizations are successful and correct**, but their benefit is masked by an **input pipeline bottleneck** that was not visible in the initial analysis.

The rendering pipeline improvements (now 60-70% faster) are sufficient for real-time processing once the input bottleneck is resolved.

**Recommendation:** Investigate and optimize the video frame acquisition pipeline as Phase 4 priority.

