const INPUT_LIST_EVENT = "mediamime:input-list-changed";
const LAYERS_EVENT = "mediamime:layers-changed";
const PIPELINE_STATE_EVENT = "mediamime:pipeline-state";
const HOLISTIC_RESULTS_EVENT = "mediamime:holistic-results";
const HOLISTIC_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/";

const DEFAULT_CROP = { x: 0, y: 0, w: 1, h: 1 };
const DEFAULT_FLIP = { horizontal: false, vertical: false };

const clamp01 = (value, fallback = 0) => {
  const number = Number.isFinite(value) ? value : fallback;
  if (number <= 0) return 0;
  if (number >= 1) return 1;
  return number;
};

const hasHolisticSupport = () => typeof window !== "undefined" && typeof window.Holistic === "function";

const dispatchCustomEvent = (type, detail) => {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new CustomEvent(type, { detail }));
};

const createProcessingVideo = () => {
  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("data-role", "processing-source");
  return video;
};

const createHolisticInstance = (onResults) => {
  if (!hasHolisticSupport()) return null;
  const holistic = new window.Holistic({
    locateFile: (file) => `${HOLISTIC_CDN}${file}`
  });
  holistic.setOptions({
    modelComplexity: 0,
    smoothLandmarks: false,
    enableSegmentation: false,
    smoothSegmentation: false,
    refineFaceLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  holistic.onResults(onResults);
  return holistic;
};

export function initMediaPipeline({ editor }) {
  void editor;
  const inputsById = new Map();
  const processors = new Map();
  let requiredSources = new Set();

  const buildSourceMeta = (sourceId) => {
    const input = inputsById.get(sourceId);
    if (!input) {
      return sourceId ? { id: sourceId } : null;
    }
    return {
      id: input.id,
      name: input.name,
      type: input.type
    };
  };

  const emitPipelineState = () => {
    dispatchCustomEvent(PIPELINE_STATE_EVENT, {
      running: processors.size > 0,
      sources: Array.from(processors.keys())
    });
  };

const emitResults = (sourceId, results, frame = null) => {
  dispatchCustomEvent(HOLISTIC_RESULTS_EVENT, {
    results,
    frame,
    source: buildSourceMeta(sourceId),
    updatedAt: typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
  });
};

  const drawFrameToCanvas = (processor) => {
    const { video, canvas, ctx, input } = processor;
    const crop = input?.crop || DEFAULT_CROP;
    const flip = input?.flip || DEFAULT_FLIP;
    const inputResolution = input?.inputResolution || { preset: 'full', width: null, height: null };
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return false;
    const cropXNorm = clamp01(crop.x, 0);
    const cropYNorm = clamp01(crop.y, 0);
    const cropWNorm = Math.max(0.01, Math.min(1 - cropXNorm, clamp01(crop.w, 1)));
    const cropHNorm = Math.max(0.01, Math.min(1 - cropYNorm, clamp01(crop.h, 1)));
    let sourceXNorm = cropXNorm;
    let sourceYNorm = cropYNorm;
    const sourceWNorm = cropWNorm;
    const sourceHNorm = cropHNorm;
    if (flip.horizontal) {
      sourceXNorm = Math.max(0, Math.min(1 - sourceWNorm, 1 - cropXNorm - sourceWNorm));
    }
    if (flip.vertical) {
      sourceYNorm = Math.max(0, Math.min(1 - sourceHNorm, 1 - cropYNorm - sourceHNorm));
    }

    // IMPORTANT: Always draw full cropped resolution to canvas
    // The display canvas must always be at full resolution (for proper display in layers)
    // Input resolution scaling is ONLY for MediaPipe processing, not the display canvas
    const cropW = Math.max(1, sourceWNorm * vw);
    const cropH = Math.max(1, sourceHNorm * vh);
    const cropX = sourceXNorm * vw;
    const cropY = sourceYNorm * vh;

    if (canvas.width !== cropW || canvas.height !== cropH) {
      canvas.width = cropW;
      canvas.height = cropH;
    }
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(flip.horizontal ? canvas.width : 0, flip.vertical ? canvas.height : 0);
    ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
    ctx.drawImage(video, cropX, cropY, sourceWNorm * vw, sourceHNorm * vh, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Phase 4: Input resolution scaling for MediaPipe
    // Create a separate canvas at the target resolution for MediaPipe processing
    // This is SEPARATE from the display canvas
    if (inputResolution.preset !== 'full' && inputResolution.width && inputResolution.height) {
      if (!processor.mediapipeCanvas) {
        processor.mediapipeCanvas = document.createElement('canvas');
        processor.mediapipeCtx = processor.mediapipeCanvas.getContext('2d');
      }

      const containerAspect = cropW / cropH;
      const targetAspect = inputResolution.width / inputResolution.height;

      let scaledW = cropW;
      let scaledH = cropH;

      // Scale while maintaining aspect ratio
      if (containerAspect > targetAspect) {
        scaledH = Math.max(1, Math.floor(inputResolution.height));
        scaledW = Math.max(1, Math.floor(scaledH * containerAspect));
      } else {
        scaledW = Math.max(1, Math.floor(inputResolution.width));
        scaledH = Math.max(1, Math.floor(scaledW / containerAspect));
      }

      if (processor.mediapipeCanvas.width !== scaledW || processor.mediapipeCanvas.height !== scaledH) {
        processor.mediapipeCanvas.width = scaledW;
        processor.mediapipeCanvas.height = scaledH;
      }

      // Draw the full canvas to the scaled canvas (this creates the pixelated effect)
      processor.mediapipeCtx.drawImage(canvas, 0, 0, scaledW, scaledH);

      // Store reference to the scaled canvas for MediaPipe to use
      processor.mediapipeFrameForHolistic = processor.mediapipeCanvas;
    } else {
      // No input resolution scaling - use the full canvas
      processor.mediapipeFrameForHolistic = canvas;
    }

    return true;
  };

  const createProcessor = (input) => {
    const video = createProcessingVideo();
    video.srcObject = input.stream;
    video.play().catch(() => {});
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const holistic = createHolisticInstance((results) => emitResults(input.id, results, canvas));
    if (!holistic) {
      console.warn("[mediamime] Holistic not available; skipping processor.");
      return null;
    }
    const processor = {
      sourceId: input.id,
      input,
      video,
      canvas,
      ctx,
      holistic,
      rafId: null,
      pending: null,
      running: false
    };

    const processFrame = () => {
      if (!processor.running) return;
      if (!processor.input?.stream) {
        scheduleNext();
        return;
      }
      if (video.readyState < 2) {
        scheduleNext();
        return;
      }
      if (processor.pending) {
        scheduleNext();
        return;
      }
      const drew = drawFrameToCanvas(processor);
      if (!drew) {
        scheduleNext();
        return;
      }
      processor.pending = processor.holistic
        .send({ image: processor.mediapipeFrameForHolistic })
        .catch((error) => {
          console.warn("[mediamime] Holistic frame failed", error);
        })
        .finally(() => {
          processor.pending = null;
        });
      scheduleNext();
    };

    const scheduleNext = () => {
      if (!processor.running) return;
      processor.rafId = requestAnimationFrame(processFrame);
    };

    processor.updateInput = (nextInput) => {
      processor.input = nextInput;
      if (video.srcObject !== nextInput.stream) {
        video.srcObject = nextInput.stream;
        video.play().catch(() => {});
      }
    };

    processor.start = () => {
      if (processor.running) return;
      processor.running = true;
      scheduleNext();
    };

    processor.stop = () => {
      processor.running = false;
      if (processor.rafId) cancelAnimationFrame(processor.rafId);
      processor.rafId = null;
      if (processor.pending && typeof processor.pending.cancel === "function") {
        try {
          processor.pending.cancel();
        } catch {
          /* noop */
        }
      }
      processor.pending = null;
      video.pause();
      video.srcObject = null;
      if (processor.holistic && typeof processor.holistic.close === "function") {
        processor.holistic.close();
      }
      emitResults(processor.sourceId, null, null);
    };

    processor.start();
    return processor;
  };

  const syncProcessors = () => {
    // Update or remove existing processors
    processors.forEach((processor, sourceId) => {
      const input = inputsById.get(sourceId);
      const shouldExist = requiredSources.has(sourceId) && input && input.stream;
      if (!shouldExist) {
        processor.stop();
        processors.delete(sourceId);
      } else {
        processor.updateInput(input);
      }
    });

    // Create processors for new sources
    requiredSources.forEach((sourceId) => {
      if (processors.has(sourceId)) return;
      const input = inputsById.get(sourceId);
      if (!input || !input.stream) return;
      const processor = createProcessor(input);
      if (processor) {
        processors.set(sourceId, processor);
      }
    });
    emitPipelineState();
  };

  const handleInputListChange = (event) => {
    const inputs = Array.isArray(event?.detail?.inputs) ? event.detail.inputs : [];
    inputsById.clear();
    inputs.forEach((input) => {
      if (!input?.id) return;
      inputsById.set(input.id, input);
    });
    syncProcessors();
  };

  const handleLayerChange = (event) => {
    const streams = Array.isArray(event?.detail?.streams) ? event.detail.streams : [];
    const nextSources = new Set();
    streams.forEach((stream) => {
      if (!stream || !stream.enabled || !stream.sourceId) return;
      nextSources.add(stream.sourceId);
    });
    requiredSources = nextSources;
    syncProcessors();
  };

  if (typeof window !== "undefined") {
    window.addEventListener(INPUT_LIST_EVENT, handleInputListChange);
    window.addEventListener(LAYERS_EVENT, handleLayerChange);
  }

  console.info("[mediamime] MediaPipe pipeline initialised.");

  return {
    dispose() {
      processors.forEach((processor) => processor.stop());
      processors.clear();
      if (typeof window !== "undefined") {
        window.removeEventListener(INPUT_LIST_EVENT, handleInputListChange);
        window.removeEventListener(LAYERS_EVENT, handleLayerChange);
      }
      emitPipelineState();
    }
  };
}
