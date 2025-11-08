const LAYERS_EVENT = "mediamime:layers-changed";
const HOLO_EVENT = "mediamime:holistic-results";
const ACTIVE_LAYER_CANVAS_ID = "layer-compositor";
const DEFAULT_BG = "rgba(5, 7, 13, 0)";
const POSE_CONNECTIONS_FALLBACK = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [11, 12],
  [23, 24],
  [11, 23],
  [12, 24]
];

const HAND_CONNECTIONS_FALLBACK = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17]
];

const clampUnit = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const normalizeViewport = (viewport = {}) => ({
  x: clampUnit(viewport.x ?? 0),
  y: clampUnit(viewport.y ?? 0),
  w: clampUnit(viewport.w ?? 1) || 1,
  h: clampUnit(viewport.h ?? 1) || 1
});

const hexToRgb = (hex) => {
  if (typeof hex !== "string") return { r: 82, g: 213, b: 255 };
  const normalized = hex.trim().replace(/^#/, "");
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    return { r, g, b };
  }
  if (normalized.length === 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 82, g: 213, b: 255 };
};

const toRgba = (hex, alpha = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
};

const getPoseConnections = () => {
  if (Array.isArray(window?.POSE_CONNECTIONS)) return window.POSE_CONNECTIONS;
  return POSE_CONNECTIONS_FALLBACK;
};

const getHandConnections = () => {
  if (Array.isArray(window?.HAND_CONNECTIONS)) return window.HAND_CONNECTIONS;
  return HAND_CONNECTIONS_FALLBACK;
};

const drawConnectorList = (ctx, landmarks, connections, viewportPx, strokeColor) => {
  if (!landmarks || !connections) return;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  connections.forEach(([startIndex, endIndex]) => {
    const start = landmarks[startIndex];
    const end = landmarks[endIndex];
    if (!start || !end) return;
    if (!Number.isFinite(start.x) || !Number.isFinite(start.y)) return;
    if (!Number.isFinite(end.x) || !Number.isFinite(end.y)) return;
    const startX = viewportPx.x + clampUnit(start.x) * viewportPx.w;
    const startY = viewportPx.y + clampUnit(start.y) * viewportPx.h;
    const endX = viewportPx.x + clampUnit(end.x) * viewportPx.w;
    const endY = viewportPx.y + clampUnit(end.y) * viewportPx.h;
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
  });
  ctx.stroke();
};

const drawLandmarks = (ctx, landmarks, viewportPx, color, size = 4) => {
  if (!Array.isArray(landmarks)) return;
  ctx.fillStyle = color;
  landmarks.forEach((landmark) => {
    if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) return;
    const x = viewportPx.x + clampUnit(landmark.x) * viewportPx.w;
    const y = viewportPx.y + clampUnit(landmark.y) * viewportPx.h;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  });
};

const drawSegmentation = (ctx, mask, viewportPx, color, alpha = 0) => {
  if (!mask || !color || alpha <= 0) return;
  try {
    ctx.save();
    // Draw mask as layer color: use globalCompositeOperation to tint
    ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
    ctx.drawImage(mask, viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  } catch (error) {
    console.warn("[mediamime] Failed to draw segmentation mask", error);
  }
};

const drawViewportBounds = (ctx, viewportPx, strokeColor, fillAlpha = 0, fillColor = null) => {
  ctx.save();
  if (fillAlpha > 0 && fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
  }
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
  ctx.restore();
};

const createCanvas = (container) => {
  const canvas = document.createElement("canvas");
  canvas.id = ACTIVE_LAYER_CANVAS_ID;
  canvas.width = container.clientWidth || 1;
  canvas.height = container.clientHeight || 1;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.pointerEvents = "none";
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  return canvas;
};

export function initDrawing({ editor }) {
  void editor;
  const container = document.getElementById("mediamime-sketch");
  if (!container) {
    console.warn("[mediamime] Drawing container missing.");
    return {
      dispose() {}
    };
  }

  container.style.position = container.style.position || "relative";
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const canvas = createCanvas(container);
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const state = {
    streams: [],
    resultsBySource: new Map(),
    pendingRender: false,
    resizeObserver: null
  };

  const getViewportPx = (viewport, width, height) => {
    const normalized = normalizeViewport(viewport);
    return {
      x: normalized.x * width,
      y: normalized.y * height,
      w: normalized.w * width,
      h: normalized.h * height
    };
  };

  const renderTo = (targetCtx, width, height, { isPreview = false } = {}) => {
    targetCtx.clearRect(0, 0, width, height);
    targetCtx.fillStyle = DEFAULT_BG;
    targetCtx.fillRect(0, 0, width, height);
    if (!state.streams.length) return;
    state.streams.forEach((stream) => {
      if (!stream.enabled) return;
      // Only respect the preview toggle for the preview canvas; main canvas shows all enabled layers
      if (isPreview && stream.preview === false) return;
      if (!stream.sourceId) return;
      const results = state.resultsBySource.get(stream.sourceId);
      const viewportPx = getViewportPx(stream.viewport, width, height);
      const strokeColor = toRgba(stream.color?.hex, 1);
      const fillAlpha = Math.min(1, Math.max(0, stream.color?.alpha ?? 0));
      const fillColor = fillAlpha > 0 ? toRgba(stream.color?.hex, fillAlpha) : null;
      targetCtx.save();
      if (!results) {
        drawViewportBounds(targetCtx, viewportPx, strokeColor, fillAlpha, fillColor);
        targetCtx.restore();
        return;
      }
      switch (stream.process) {
        case "pose":
          drawConnectorList(targetCtx, results.poseLandmarks, getPoseConnections(), viewportPx, strokeColor);
          drawLandmarks(targetCtx, results.poseLandmarks, viewportPx, strokeColor, 3);
          break;
        case "hands":
          drawConnectorList(targetCtx, results.leftHandLandmarks, getHandConnections(), viewportPx, strokeColor);
          drawConnectorList(targetCtx, results.rightHandLandmarks, getHandConnections(), viewportPx, strokeColor);
          drawLandmarks(targetCtx, results.leftHandLandmarks, viewportPx, strokeColor, 3);
          drawLandmarks(targetCtx, results.rightHandLandmarks, viewportPx, strokeColor, 3);
          break;
        case "face":
          drawLandmarks(targetCtx, results.faceLandmarks, viewportPx, strokeColor, 2);
          break;
        case "segmentation":
          drawSegmentation(targetCtx, results.segmentationMask, viewportPx, fillColor, fillAlpha);
          break;
        case "depth":
          drawViewportBounds(targetCtx, viewportPx, strokeColor, fillAlpha, fillColor);
          break;
        case "raw":
        default:
          drawViewportBounds(targetCtx, viewportPx, strokeColor, fillAlpha, fillColor);
          break;
      }
      targetCtx.restore();
    });
  };

  const render = () => {
    state.pendingRender = false;
    renderTo(ctx, canvas.width, canvas.height, { isPreview: false });
    if (state.previewCtx && state.previewCanvas) {
      renderTo(state.previewCtx, state.previewCanvas.width, state.previewCanvas.height, { isPreview: true });
    }
  };

  const requestRender = () => {
    if (state.pendingRender) return;
    state.pendingRender = true;
    requestAnimationFrame(render);
  };

  const resizeCanvas = () => {
    const { width, height } = container.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.floor(width * pixelRatio));
    const nextHeight = Math.max(1, Math.floor(height * pixelRatio));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    requestRender();
  };

  const scheduleResize = () => {
    window.requestAnimationFrame(resizeCanvas);
  };

  // Setup preview canvas inside the Preview modal
  const previewCanvas = document.getElementById("segmentation-preview");
  if (previewCanvas && previewCanvas.getContext) {
    state.previewCanvas = previewCanvas;
    state.previewCtx = previewCanvas.getContext("2d");
  }

  const resizePreviewCanvas = () => {
    if (!state.previewCanvas) return;
    const rect = state.previewCanvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * ratio));
    const h = Math.max(1, Math.floor(rect.height * ratio));
    if (state.previewCanvas.width !== w || state.previewCanvas.height !== h) {
      state.previewCanvas.width = w;
      state.previewCanvas.height = h;
    }
    requestRender();
  };

  if (typeof ResizeObserver === "function") {
    state.resizeObserver = new ResizeObserver(() => scheduleResize());
    state.resizeObserver.observe(container);
    if (state.previewCanvas) {
      const ro = new ResizeObserver(() => resizePreviewCanvas());
      state.previewResizeObserver = ro;
      ro.observe(state.previewCanvas);
      resizePreviewCanvas();
    }
  } else {
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("resize", resizePreviewCanvas);
  }
  resizeCanvas();
  resizePreviewCanvas();

  const handleLayerUpdate = (event) => {
    const streams = Array.isArray(event?.detail?.streams) ? event.detail.streams : [];
    state.streams = streams;
    requestRender();
  };

  const handleHolisticResults = (event) => {
    const sourceId = event?.detail?.source?.id;
    const results = event?.detail?.results || null;
    if (!sourceId) {
      state.resultsBySource.clear();
      requestRender();
      return;
    }
    if (!results) {
      state.resultsBySource.delete(sourceId);
    } else {
      state.resultsBySource.set(sourceId, results);
    }
    requestRender();
  };

  window.addEventListener(LAYERS_EVENT, handleLayerUpdate);
  window.addEventListener(HOLO_EVENT, handleHolisticResults);

  return {
    dispose() {
      window.removeEventListener(LAYERS_EVENT, handleLayerUpdate);
      window.removeEventListener(HOLO_EVENT, handleHolisticResults);
      if (state.resizeObserver) {
        state.resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", resizeCanvas);
      }
      if (state.previewResizeObserver) {
        state.previewResizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", resizePreviewCanvas);
      }
    }
  };
}
