const ACTIVE_INPUT_EVENT = "mediamime:active-input-changed";
const PIPELINE_STATE_EVENT = "mediamime:pipeline-state";
const HOLISTIC_RESULTS_EVENT = "mediamime:holistic-results";
const HOLISTIC_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/";

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
  // No need to attach to DOM; it simply needs to exist for capture.
  return video;
};

export function initMediaPipeline({ editor }) {
  void editor;
  const state = {
    holistic: null,
    activeInput: null,
    processingVideo: null,
    rafId: null,
    pending: null,
    running: false,
    lastResults: null
  };

  const reportPipelineState = () => {
    dispatchCustomEvent(PIPELINE_STATE_EVENT, {
      running: state.running && Boolean(state.activeInput?.stream) && Boolean(state.holistic),
      activeInput: state.activeInput
        ? {
            id: state.activeInput.id,
            name: state.activeInput.name,
            type: state.activeInput.type
          }
        : null
    });
  };

  const handleResults = (results) => {
    state.lastResults = results || null;
    dispatchCustomEvent(HOLISTIC_RESULTS_EVENT, {
      results,
      source: state.activeInput
        ? {
            id: state.activeInput.id,
            name: state.activeInput.name,
            type: state.activeInput.type
          }
        : null,
      updatedAt: typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
    });
  };

  const ensureHolistic = () => {
    if (state.holistic) return state.holistic;
    if (!hasHolisticSupport()) return null;
    const holistic = new window.Holistic({
      locateFile: (file) => `${HOLISTIC_CDN}${file}`
    });
    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: true,
      smoothSegmentation: true,
      refineFaceLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    holistic.onResults(handleResults);
    state.holistic = holistic;
    return holistic;
  };

  const ensureProcessingVideo = () => {
    if (state.processingVideo) {
      return state.processingVideo;
    }
    state.processingVideo = createProcessingVideo();
    return state.processingVideo;
  };

  const stopProcessing = () => {
    state.running = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    if (state.pending && typeof state.pending.cancel === "function") {
      try {
        state.pending.cancel();
      } catch {
        // ignore; MediaPipe promises do not expose cancel but guard regardless
      }
    }
    state.pending = null;
    if (state.processingVideo) {
      state.processingVideo.pause();
      state.processingVideo.srcObject = null;
    }
    reportPipelineState();
  };

  const scheduleFrame = () => {
    if (!state.running) return;
    state.rafId = requestAnimationFrame(processFrame);
  };

  const processFrame = () => {
    if (!state.running || !state.processingVideo) return;
    const holistic = state.holistic;
    if (!holistic) {
      scheduleFrame();
      return;
    }
    if (state.processingVideo.readyState < 2) {
      scheduleFrame();
      return;
    }
    if (state.pending) {
      scheduleFrame();
      return;
    }
    state.pending = holistic
      .send({ image: state.processingVideo })
      .catch((error) => {
        console.warn("[mediamime] Holistic frame failed.", error);
      })
      .finally(() => {
        state.pending = null;
      });
    scheduleFrame();
  };

  const startProcessing = () => {
    if (!state.activeInput?.stream) {
      stopProcessing();
      return;
    }
    const holistic = ensureHolistic();
    if (!holistic) {
      console.warn("[mediamime] Holistic library not available; skipping pipeline.");
      stopProcessing();
      return;
    }
    const video = ensureProcessingVideo();
    if (video.srcObject !== state.activeInput.stream) {
      video.srcObject = state.activeInput.stream;
    }
    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch((error) => {
        console.warn("[mediamime] Processing source playback failed.", error);
      });
    }
    if (!state.running) {
      state.running = true;
      scheduleFrame();
      reportPipelineState();
    }
  };

  const clearActiveInput = () => {
    state.activeInput = null;
    stopProcessing();
    dispatchCustomEvent(HOLISTIC_RESULTS_EVENT, { results: null, source: null, updatedAt: Date.now() });
  };

  const handleActiveInputChange = (event) => {
    const nextInput = event?.detail?.input || null;
    state.activeInput = nextInput;
    if (nextInput?.stream) {
      startProcessing();
    } else {
      clearActiveInput();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener(ACTIVE_INPUT_EVENT, handleActiveInputChange);
  }

  reportPipelineState();
  console.info("[mediamime] MediaPipe pipeline initialised.");

  return {
    dispose() {
      stopProcessing();
      if (typeof window !== "undefined") {
        window.removeEventListener(ACTIVE_INPUT_EVENT, handleActiveInputChange);
      }
      if (state.holistic && typeof state.holistic.close === "function") {
        state.holistic.close();
      }
      state.holistic = null;
      if (state.processingVideo && typeof state.processingVideo.remove === "function") {
        state.processingVideo.remove();
      }
      state.processingVideo = null;
      dispatchCustomEvent(HOLISTIC_RESULTS_EVENT, { results: null, source: null, updatedAt: Date.now() });
      reportPipelineState();
    }
  };
}
