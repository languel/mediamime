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

const DATA_DEPENDENT_PROCESSES = new Set(["pose", "hands", "face", "segmentation", "segmentationStream"]);

const MIN_VIEWPORT_SIZE = 0.05;

const clampUnit = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const toFiniteNumber = (value, fallback = 0) => {
  if (Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(`${value}`);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeViewport = (viewport = {}) => ({
  x: toFiniteNumber(viewport.x, 0),
  y: toFiniteNumber(viewport.y, 0),
  w: Math.max(MIN_VIEWPORT_SIZE, toFiniteNumber(viewport.w, 1)),
  h: Math.max(MIN_VIEWPORT_SIZE, toFiniteNumber(viewport.h, 1))
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

const drawConnectorList = (ctx, landmarks, connections, viewportPx, strokeColor, zoom = 1) => {
  if (!landmarks || !connections) return;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2 / zoom;
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

const drawLandmarks = (ctx, landmarks, viewportPx, color, size = 4, zoom = 1) => {
  if (!Array.isArray(landmarks)) return;
  ctx.fillStyle = color;
  const adjustedSize = size / zoom;
  landmarks.forEach((landmark) => {
    if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) return;
    const x = viewportPx.x + clampUnit(landmark.x) * viewportPx.w;
    const y = viewportPx.y + clampUnit(landmark.y) * viewportPx.h;
    ctx.beginPath();
    ctx.arc(x, y, adjustedSize, 0, Math.PI * 2);
    ctx.fill();
  });
};

const drawSegmentation = (ctx, mask, viewportPx, color, alpha = 0, { overlay = false } = {}) => {
  if (!mask || !color || alpha <= 0) return;
  try {
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
    ctx.clip();
    ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
    if (overlay) {
      ctx.fillStyle = color;
      ctx.fillRect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask, viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
    } else {
      ctx.drawImage(mask, viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = color;
      ctx.fillRect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  } catch (error) {
    console.warn("[mediamime] Failed to draw segmentation mask", error);
  }
};

const drawSegmentedFrame = (ctx, frame, mask, viewportPx, tintColor, tintAlpha = 0) => {
  if (!mask) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
  ctx.clip();
  if (frame) {
    ctx.globalAlpha = 1;
    ctx.drawImage(frame, viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
  }
  if (tintColor && tintAlpha > 0) {
    ctx.globalAlpha = Math.min(1, Math.max(0, tintAlpha));
    ctx.fillStyle = tintColor;
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillRect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
  ctx.restore();
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

const drawRawViewportFrame = (ctx, frame, viewportPx, tintColor, opacity = 1) => {
  if (!frame) return;
  const alpha = Math.min(1, Math.max(0, opacity));
  if (alpha <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.drawImage(frame, viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
  ctx.globalCompositeOperation = "color";
  ctx.fillStyle = tintColor;
  ctx.fillRect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
  ctx.restore();
};

const SUPPORTS_DOM_MATRIX = typeof DOMMatrix === "function" && typeof DOMPoint === "function";

const toDomMatrix = (matrix) => {
  if (!SUPPORTS_DOM_MATRIX || !matrix) return null;
  if (matrix instanceof DOMMatrix) return matrix;
  const { a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 } = matrix;
  try {
    return new DOMMatrix([a, b, c, d, e, f]);
  } catch (error) {
    console.warn("[mediamime] Failed to create DOMMatrix from", matrix, error);
    return null;
  }
};

const createCssToCanvasMatrix = (rect, dpr) => {
  if (!SUPPORTS_DOM_MATRIX) return null;
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return new DOMMatrix([
    ratio,
    0,
    0,
    ratio,
    -rect.left * ratio,
    -rect.top * ratio
  ]);
};

const createCanvas = (container) => {
  const canvas = document.createElement("canvas");
  canvas.id = ACTIVE_LAYER_CANVAS_ID;
  canvas.width = container.clientWidth || 1;
  canvas.height = container.clientHeight || 1;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  return canvas;
};

export function initDrawing({ editor }) {
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
    resizeObserver: null,
    activeLayerId: null, // Track selected layer for viewport editing
    viewportDragState: null, // Track viewport drag interaction
    editor, // Store editor reference for camera transform
    spacebarPanning: false, // Track when editor is panning with spacebar
    editorMode: editor?.getMode ? editor.getMode() : 'edit',
    svg: document.getElementById('gesture-svg') || null,
    shapesLayer: null,
    displayMetrics: null
  };

  const isSelectToolActive = () => {
    if (!state.editor?.getState) return true;
    try {
      const editorState = state.editor.getState();
      return !editorState?.tool || editorState.tool === 'select';
    } catch (error) {
      console.warn('[mediamime] Failed to read editor state for tool detection.', error);
      return true;
    }
  };

  const emitLayerSelection = (layerId) => {
    const event = new CustomEvent('mediamime:layer-selected', {
      detail: {
        layerId: layerId || null,
        source: 'drawing'
      },
      bubbles: true
    });
    window.dispatchEvent(event);
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

  const getViewportWorldRect = (viewport, viewBox) => {
    const normalized = normalizeViewport(viewport);
    return {
      x: normalized.x * viewBox.width,
      y: normalized.y * viewBox.height,
      w: normalized.w * viewBox.width,
      h: normalized.h * viewBox.height
    };
  };

  const ensureDisplayMetrics = () => {
    const dpr = window.devicePixelRatio || 1;
    const canvasRect = canvas.getBoundingClientRect();
    const shouldRefresh =
      !state.displayMetrics ||
      state.displayMetrics.dpr !== dpr ||
      state.displayMetrics.cssWidth !== canvasRect.width ||
      state.displayMetrics.cssHeight !== canvasRect.height ||
      state.displayMetrics.cssLeft !== canvasRect.left ||
      state.displayMetrics.cssTop !== canvasRect.top;

    if (shouldRefresh) {
      const svgElement = state.svg || document.getElementById('gesture-svg');
      if (!state.svg && svgElement) {
        state.svg = svgElement;
      }
      if (!state.shapesLayer && (state.svg || svgElement)) {
        const layer = (state.svg || svgElement)?.querySelector('[data-layer="shapes"]');
        if (layer) state.shapesLayer = layer;
      }
      const viewBox = state.editor?.getViewBox ? state.editor.getViewBox() : { width: canvasRect.width || 1, height: canvasRect.height || 1 };
      const camera = state.editor?.getCamera ? state.editor.getCamera() : { x: 0, y: 0, zoom: 1 };
      const svgRect = (state.svg || svgElement) ? (state.svg || svgElement).getBoundingClientRect() : canvasRect;

      const baseMetrics = {
        dpr,
        cssWidth: canvasRect.width,
        cssHeight: canvasRect.height,
        cssLeft: canvasRect.left,
        cssTop: canvasRect.top,
        viewBox,
        camera
      };

      if (SUPPORTS_DOM_MATRIX && state.shapesLayer && typeof state.shapesLayer.getScreenCTM === "function") {
        const rawMatrix = state.shapesLayer.getScreenCTM();
        const worldToCssMatrix = toDomMatrix(rawMatrix);
        if (worldToCssMatrix) {
          const cssToWorldMatrix = worldToCssMatrix.inverse();
          const cssToCanvasMatrix = createCssToCanvasMatrix(canvasRect, dpr);
          const worldToCanvasMatrix = cssToCanvasMatrix ? cssToCanvasMatrix.multiply(worldToCssMatrix) : null;
          if (worldToCanvasMatrix) {
            state.displayMetrics = {
              ...baseMetrics,
              worldToCssMatrix,
              cssToWorldMatrix,
              worldToCanvasMatrix,
              usesDomMatrix: true
            };
            return state.displayMetrics;
          }
        }
      }

      const worldScaleX = viewBox.width ? svgRect.width / viewBox.width : 1;
      const worldScaleY = viewBox.height ? svgRect.height / viewBox.height : 1;
      state.displayMetrics = {
        ...baseMetrics,
        worldScaleX,
        worldScaleY,
        offsetX: svgRect.left - canvasRect.left,
        offsetY: svgRect.top - canvasRect.top,
        usesDomMatrix: false
      };
    } else {
      if (state.editor?.getViewBox) {
        state.displayMetrics.viewBox = state.editor.getViewBox();
      }
      if (state.editor?.getCamera) {
        state.displayMetrics.camera = state.editor.getCamera();
      }
    }

    return state.displayMetrics;
  };

  const toWorldCoords = (cssX, cssY, camera, metrics) => {
    if (metrics?.usesDomMatrix && metrics.cssToWorldMatrix && SUPPORTS_DOM_MATRIX) {
      const point = new DOMPoint(cssX, cssY).matrixTransform(metrics.cssToWorldMatrix);
      return { x: point.x, y: point.y };
    }
    const activeCamera = camera || metrics?.camera || (state.editor?.getCamera ? state.editor.getCamera() : null);
    const scaleX = (activeCamera?.zoom || 1) * (metrics?.worldScaleX || 1);
    const scaleY = (activeCamera?.zoom || 1) * (metrics?.worldScaleY || 1);
    const offsetX = metrics?.offsetX || 0;
    const offsetY = metrics?.offsetY || 0;
    const worldX = ((cssX - offsetX) / (scaleX || 1)) - (activeCamera?.x || 0);
    const worldY = ((cssY - offsetY) / (scaleY || 1)) - (activeCamera?.y || 0);
    return { x: worldX, y: worldY };
  };

  const renderTo = (targetCtx, width, height, metrics, { isPreview = false } = {}) => {
    const globalDpr = window.devicePixelRatio || 1;
    const cssWidth = width / globalDpr;
    const cssHeight = height / globalDpr;

    // Reset transform to identity and clear full buffer
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.clearRect(0, 0, width, height);

    // Keep canvas transparent when no streams
    if (!state.streams.length) return;

    // Apply camera transform for main canvas (not preview)
    const camera = state.editor ? (state.editor.getCamera ? state.editor.getCamera() : null) : null;
    const viewBox = state.editor ? (metrics?.viewBox || (state.editor.getViewBox ? state.editor.getViewBox() : null)) : null;

    if (!isPreview && metrics?.usesDomMatrix && metrics.worldToCanvasMatrix) {
      const m = metrics.worldToCanvasMatrix;
      targetCtx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    } else if (!isPreview && camera && viewBox && metrics) {
      const baseScaleX = camera.zoom * (metrics.worldScaleX || 1);
      const baseScaleY = camera.zoom * (metrics.worldScaleY || 1);
      const translateX = (metrics.offsetX || 0) + camera.x * baseScaleX;
      const translateY = (metrics.offsetY || 0) + camera.y * baseScaleY;
      const appliedDpr = metrics.dpr || globalDpr;
      targetCtx.setTransform(
        baseScaleX * appliedDpr,
        0,
        0,
        baseScaleY * appliedDpr,
        translateX * appliedDpr,
        translateY * appliedDpr
      );
    } else {
      const appliedDpr = metrics?.dpr || globalDpr;
      targetCtx.setTransform(appliedDpr, 0, 0, appliedDpr, 0, 0);
    }

    state.streams.forEach((stream) => {
      if (!stream.enabled) return;
      // Only respect the preview toggle for the preview canvas; main canvas shows all enabled layers
      if (isPreview && stream.preview === false) return;
      if (!isPreview && stream.showInMain === false) return;
      if (!stream.sourceId) return;
      const resultsEntry = state.resultsBySource.get(stream.sourceId) ?? null;
      let results = null;
      let frame = null;
      if (resultsEntry) {
        if (typeof resultsEntry === "object" && Object.prototype.hasOwnProperty.call(resultsEntry, "data")) {
          results = resultsEntry.data || null;
          frame = resultsEntry.frame || null;
        } else {
          results = resultsEntry;
        }
      }
      
      // Calculate viewport in appropriate coordinate space
      const viewportPx = (!isPreview && viewBox)
        ? getViewportWorldRect(stream.viewport, viewBox)
        : getViewportPx(stream.viewport, cssWidth, cssHeight);
      
      const strokeColor = toRgba(stream.color?.hex, 1);
      const fillAlpha = Math.min(1, Math.max(0, stream.color?.alpha ?? 0));
      const fillColor = fillAlpha > 0 ? toRgba(stream.color?.hex, fillAlpha) : null;
      const zoom = camera && !isPreview ? camera.zoom : 1;
      
      targetCtx.save();
      
      if (stream.process === "raw") {
        if (frame) {
          drawRawViewportFrame(targetCtx, frame, viewportPx, strokeColor, fillAlpha);
        } else {
          drawViewportBounds(targetCtx, viewportPx, strokeColor, fillAlpha, fillColor);
        }
        targetCtx.restore();
        return;
      }

    if (!results) {
      // Skip drawing for data-driven processes until we have results
      if (DATA_DEPENDENT_PROCESSES.has(stream.process)) {
        targetCtx.restore();
        return;
      }
      drawViewportBounds(targetCtx, viewportPx, strokeColor, fillAlpha, fillColor);
      targetCtx.restore();
      return;
    }
      switch (stream.process) {
        case "pose":
          drawConnectorList(targetCtx, results.poseLandmarks, getPoseConnections(), viewportPx, strokeColor, zoom);
          drawLandmarks(targetCtx, results.poseLandmarks, viewportPx, strokeColor, 3, zoom);
          break;
        case "hands":
          drawConnectorList(targetCtx, results.leftHandLandmarks, getHandConnections(), viewportPx, strokeColor, zoom);
          drawConnectorList(targetCtx, results.rightHandLandmarks, getHandConnections(), viewportPx, strokeColor, zoom);
          drawLandmarks(targetCtx, results.leftHandLandmarks, viewportPx, strokeColor, 3, zoom);
          drawLandmarks(targetCtx, results.rightHandLandmarks, viewportPx, strokeColor, 3, zoom);
          break;
        case "face":
          drawLandmarks(targetCtx, results.faceLandmarks, viewportPx, strokeColor, 2, zoom);
          break;
        case "segmentationStream": {
          const mask = results.segmentationMask || null;
          if (!mask) {
            targetCtx.restore();
            return;
          }
          const alphaValue = fillAlpha > 0 ? fillAlpha : 0.6;
          if (frame) {
            drawSegmentedFrame(targetCtx, frame, mask, viewportPx, strokeColor, alphaValue);
          } else {
            drawSegmentation(targetCtx, mask, viewportPx, strokeColor, alphaValue, { overlay: true });
          }
          break;
        }
        case "segmentation": {
          const mask = results.segmentationMask || null;
          if (!mask) {
            targetCtx.restore();
            return;
          }
          drawSegmentation(targetCtx, mask, viewportPx, fillColor || strokeColor, fillAlpha, { overlay: false });
          break;
        }
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

    // Restore identity matrix for downstream operations
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const render = () => {
    state.pendingRender = false;
    const metrics = ensureDisplayMetrics();
    renderTo(ctx, canvas.width, canvas.height, metrics, { isPreview: false });
    renderViewportOverlay(ctx, metrics);
    if (state.previewCtx && state.previewCanvas) {
      renderTo(state.previewCtx, state.previewCanvas.width, state.previewCanvas.height, null, { isPreview: true });
    }
  };

  const renderViewportOverlay = (targetCtx, metrics) => {
    if (!state.editor) return;
    const mode = state.editorMode ?? (state.editor.getMode ? state.editor.getMode() : 'edit');
    if (mode === 'perform') return;

    const appliedMetrics = metrics || ensureDisplayMetrics();
    if (!appliedMetrics) return;
    const camera = appliedMetrics.camera || (state.editor.getCamera ? state.editor.getCamera() : { x: 0, y: 0, zoom: 1 });
    const viewBox = appliedMetrics.viewBox || (state.editor.getViewBox ? state.editor.getViewBox() : { width: 1000, height: 1000 });
    const dpr = appliedMetrics.dpr || window.devicePixelRatio || 1;
    const worldScaleX = appliedMetrics.worldScaleX || 1;
    const worldScaleY = appliedMetrics.worldScaleY || 1;
    const translateX = (appliedMetrics.offsetX || 0) + camera.x * camera.zoom * worldScaleX;
    const translateY = (appliedMetrics.offsetY || 0) + camera.y * camera.zoom * worldScaleY;

    targetCtx.save();
    if (appliedMetrics.usesDomMatrix && appliedMetrics.worldToCanvasMatrix) {
      const m = appliedMetrics.worldToCanvasMatrix;
      targetCtx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    } else {
      targetCtx.setTransform(
        camera.zoom * worldScaleX * dpr,
        0,
        0,
        camera.zoom * worldScaleY * dpr,
        translateX * dpr,
        translateY * dpr
      );
    }

    const dashPattern = [8 / camera.zoom, 4 / camera.zoom];

    state.streams.forEach((stream) => {
      if (!stream?.enabled) return;
      if (stream.showInMain === false) return;
      const normalized = normalizeViewport(stream.viewport);
      const scoreX = normalized.x * viewBox.width;
      const scoreY = normalized.y * viewBox.height;
      const scoreW = normalized.w * viewBox.width;
      const scoreH = normalized.h * viewBox.height;

      const layerColor = toRgba(stream.color?.hex, 1) || '#00e0ff';
      const isActive = state.activeLayerId === stream.id;

      targetCtx.save();
      targetCtx.globalAlpha = isActive ? 1 : 0.6;
      targetCtx.strokeStyle = layerColor;
      targetCtx.lineWidth = 2 / camera.zoom;
      targetCtx.setLineDash(dashPattern);
      targetCtx.strokeRect(scoreX, scoreY, scoreW, scoreH);

      if (isActive) {
        const handleSize = 12 / camera.zoom;
        const handles = [
          { x: scoreX, y: scoreY },
          { x: scoreX + scoreW, y: scoreY },
          { x: scoreX, y: scoreY + scoreH },
          { x: scoreX + scoreW, y: scoreY + scoreH }
        ];
        handles.forEach((handle) => {
          targetCtx.fillStyle = layerColor;
          targetCtx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
          targetCtx.strokeStyle = '#05070d';
          targetCtx.lineWidth = 1.5 / camera.zoom;
          targetCtx.setLineDash([]);
          targetCtx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
        });
      }

      targetCtx.restore();
    });

    targetCtx.restore();
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const requestRender = () => {
    if (state.pendingRender) return;
    state.pendingRender = true;
    requestAnimationFrame(render);
  };

  // Toggle gesture editor interactivity based on active layer selection
  const updateViewportInteractionState = () => {
    const overlay = document.getElementById('gesture-editor');
    const hasActiveLayer = Boolean(state.activeLayerId);
    if (overlay) {
      overlay.classList.toggle('is-viewport-edit', hasActiveLayer);
    }
    if (canvas) {
      canvas.classList.toggle('is-viewport-edit', hasActiveLayer);
      canvas.style.pointerEvents = hasActiveLayer ? 'auto' : 'none';
    }
  };

  // Viewport handle interaction
  const getHoveredViewportHandle = (clientX, clientY, metricsOverride = null, cameraOverride = null, options = {}) => {
    if (!state.editor || !state.streams.length) return null;
    const { anyLayer = false } = options;
    const camera = cameraOverride || (state.editor.getCamera ? state.editor.getCamera() : { x: 0, y: 0, zoom: 1 });
    const metrics = metricsOverride || ensureDisplayMetrics();
    if (!metrics) return null;
    const viewBox = metrics.viewBox || (state.editor.getViewBox ? state.editor.getViewBox() : { width: 1000, height: 1000 });
    const baseTargets = anyLayer
      ? state.streams
      : state.streams.filter((stream) => stream.id === state.activeLayerId);
    if (!baseTargets.length) return null;
    const targets = anyLayer ? [...baseTargets].reverse() : baseTargets;
    const rect = canvas.getBoundingClientRect();
    const cssX = metrics?.usesDomMatrix ? clientX : clientX - rect.left;
    const cssY = metrics?.usesDomMatrix ? clientY : clientY - rect.top;
    const worldPoint = toWorldCoords(cssX, cssY, camera, metrics);
    const scoreX = worldPoint.x;
    const scoreY = worldPoint.y;
    const zoom = camera?.zoom || 1;
    const handleSize = 12 / zoom;
    const hitMargin = 4 / zoom;

    for (const stream of targets) {
      const normalized = normalizeViewport(stream.viewport);
      const vpX = normalized.x * viewBox.width;
      const vpY = normalized.y * viewBox.height;
      const vpW = normalized.w * viewBox.width;
      const vpH = normalized.h * viewBox.height;

      const handles = [
        { type: 'nw', x: vpX, y: vpY },
        { type: 'ne', x: vpX + vpW, y: vpY },
        { type: 'sw', x: vpX, y: vpY + vpH },
        { type: 'se', x: vpX + vpW, y: vpY + vpH }
      ];

      for (const handle of handles) {
        const dx = Math.abs(scoreX - handle.x);
        const dy = Math.abs(scoreY - handle.y);
        if (dx <= handleSize / 2 + hitMargin && dy <= handleSize / 2 + hitMargin) {
          return { type: 'handle', handleType: handle.type, stream };
        }
      }

      if (scoreX >= vpX && scoreX <= vpX + vpW && scoreY >= vpY && scoreY <= vpY + vpH) {
        return { type: 'move', stream };
      }
    }

    return null;
  };

  const handleCanvasPointerMove = (e) => {
    if (e.target !== canvas || state.spacebarPanning) return;
    if (!state.activeLayerId) {
      canvas.style.cursor = '';
      return;
    }
    const camera = state.editor?.getCamera ? state.editor.getCamera() : { x: 0, y: 0, zoom: 1 };
    const metrics = ensureDisplayMetrics();
    if (!metrics) return;
    const viewBox = metrics.viewBox || (state.editor?.getViewBox ? state.editor.getViewBox() : { width: 1000, height: 1000 });

    if (state.viewportDragState) {
      e.preventDefault();
      e.stopPropagation();

      const layerId = state.viewportDragState.layerId || state.activeLayerId;
      const activeLayer = state.streams.find((s) => s.id === layerId);
      if (!activeLayer) return;

      const rect = canvas.getBoundingClientRect();
      const cssX = metrics?.usesDomMatrix ? e.clientX : e.clientX - rect.left;
      const cssY = metrics?.usesDomMatrix ? e.clientY : e.clientY - rect.top;
      const worldPoint = toWorldCoords(cssX, cssY, camera, metrics);
      const scoreX = worldPoint.x;
      const scoreY = worldPoint.y;

      const dx = scoreX - state.viewportDragState.startScoreX;
      const dy = scoreY - state.viewportDragState.startScoreY;
      const deltaX = dx / viewBox.width;
      const deltaY = dy / viewBox.height;

      let newViewport = { ...state.viewportDragState.initialViewport };
      const minSize = MIN_VIEWPORT_SIZE;

      if (state.viewportDragState.handleType === 'move') {
        newViewport.x = newViewport.x + deltaX;
        newViewport.y = newViewport.y + deltaY;
      } else if (state.viewportDragState.handleType === 'nw') {
        const newX = Math.min(newViewport.x + newViewport.w - minSize, newViewport.x + deltaX);
        const newY = Math.min(newViewport.y + newViewport.h - minSize, newViewport.y + deltaY);
        newViewport.w = newViewport.x + newViewport.w - newX;
        newViewport.h = newViewport.y + newViewport.h - newY;
        newViewport.x = newX;
        newViewport.y = newY;
      } else if (state.viewportDragState.handleType === 'ne') {
        const newY = Math.min(newViewport.y + newViewport.h - minSize, newViewport.y + deltaY);
        newViewport.w = Math.max(minSize, newViewport.w + deltaX);
        newViewport.h = newViewport.y + newViewport.h - newY;
        newViewport.y = newY;
      } else if (state.viewportDragState.handleType === 'sw') {
        const newX = Math.min(newViewport.x + newViewport.w - minSize, newViewport.x + deltaX);
        newViewport.w = newViewport.x + newViewport.w - newX;
        newViewport.h = Math.max(minSize, newViewport.h + deltaY);
        newViewport.x = newX;
      } else if (state.viewportDragState.handleType === 'se') {
        newViewport.w = Math.max(minSize, newViewport.w + deltaX);
        newViewport.h = Math.max(minSize, newViewport.h + deltaY);
      }

      activeLayer.viewport = newViewport;
      activeLayer.viewportMode = 'custom';
      dispatchLayerViewportUpdate(activeLayer);
      requestRender();
      return;
    }

    if (!isSelectToolActive()) {
      canvas.style.cursor = '';
      return;
    }

    const hovered = getHoveredViewportHandle(
      e.clientX,
      e.clientY,
      metrics,
      camera,
      { anyLayer: true }
    );

    if (hovered) {
      const cursors = {
        nw: 'nwse-resize',
        ne: 'nesw-resize',
        sw: 'nesw-resize',
        se: 'nwse-resize',
        move: 'move'
      };
      canvas.style.cursor = cursors[hovered.handleType || hovered.type] || 'move';
    } else {
      canvas.style.cursor = '';
    }
  };

  const handleCanvasPointerDown = (e) => {
    if (state.spacebarPanning) return;
    if (e.button !== 0) return;
    if (!isSelectToolActive()) return;

    const camera = state.editor?.getCamera ? state.editor.getCamera() : { x: 0, y: 0, zoom: 1 };
    const metrics = ensureDisplayMetrics();
    if (!metrics) return;

    const hovered = getHoveredViewportHandle(e.clientX, e.clientY, metrics, camera, { anyLayer: true });
    if (!hovered) {
      if (state.activeLayerId) {
        emitLayerSelection(null);
      }
      canvas.style.cursor = '';
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (hovered.stream && hovered.stream.id !== state.activeLayerId) {
      emitLayerSelection(hovered.stream.id);
    }

    const rect = canvas.getBoundingClientRect();
    const cssX = metrics?.usesDomMatrix ? e.clientX : e.clientX - rect.left;
    const cssY = metrics?.usesDomMatrix ? e.clientY : e.clientY - rect.top;
    const worldPoint = toWorldCoords(cssX, cssY, camera, metrics);

    const initialViewport = hovered.stream?.viewport
      ? normalizeViewport(hovered.stream.viewport)
      : { x: 0, y: 0, w: 1, h: 1 };
    state.viewportDragState = {
      pointerId: e.pointerId,
      handleType: hovered.handleType || hovered.type,
      layerId: hovered.stream?.id || state.activeLayerId,
      startScoreX: worldPoint.x,
      startScoreY: worldPoint.y,
      initialViewport
    };

    canvas.setPointerCapture(e.pointerId);
  };

  const clearViewportDragState = () => {
    if (!state.viewportDragState) return;
    const pointerId = state.viewportDragState.pointerId;
    if (typeof pointerId === "number" && typeof canvas.releasePointerCapture === "function") {
      try {
        if (!canvas.hasPointerCapture || canvas.hasPointerCapture(pointerId)) {
          canvas.releasePointerCapture(pointerId);
        }
      } catch (error) {
        // Ignore invalid pointer release attempts
      }
    }
    state.viewportDragState = null;
  };

  const handleCanvasPointerUp = () => {
    clearViewportDragState();
  };

  // Attach canvas interaction handlers
  canvas.addEventListener('pointermove', handleCanvasPointerMove);
  canvas.addEventListener('pointerdown', handleCanvasPointerDown);
  canvas.addEventListener('pointerup', handleCanvasPointerUp);
  canvas.addEventListener('pointercancel', handleCanvasPointerUp);

  // Dispatch layer viewport update event
  const dispatchLayerViewportUpdate = (layer) => {
    const event = new CustomEvent('mediamime:layer-viewport-changed', {
      detail: {
        layerId: layer.id,
        viewport: { ...layer.viewport },
        viewportMode: layer.viewportMode
      },
      bubbles: true
    });
    window.dispatchEvent(event);
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
    state.displayMetrics = null;
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
    const results = event?.detail?.results ?? null;
    const frame = event?.detail?.frame ?? null;
    if (!sourceId) {
      state.resultsBySource.clear();
      requestRender();
      return;
    }
    if (!results && !frame) {
      state.resultsBySource.delete(sourceId);
    } else {
      state.resultsBySource.set(sourceId, { data: results, frame });
    }
    requestRender();
  };

  // Handle layer selection from layers panel
  const handleLayerSelection = (e) => {
    state.activeLayerId = e?.detail?.layerId || null;
    if (!state.activeLayerId) {
      clearViewportDragState();
      canvas.style.cursor = '';
    }
    updateViewportInteractionState();
    requestRender();
  };

  // Handle camera changes from editor (zoom/pan)
  const handleCameraChange = () => {
    state.displayMetrics = null;
    requestRender();
  };

  const handleEditorModeChange = (event) => {
    const mode = event?.detail?.mode;
    if (!mode || mode === state.editorMode) return;
    state.editorMode = mode;
    if (mode === 'perform' && state.activeLayerId) {
      emitLayerSelection(null);
    }
    requestRender();
  };

  window.addEventListener(LAYERS_EVENT, handleLayerUpdate);
  window.addEventListener(HOLO_EVENT, handleHolisticResults);
  window.addEventListener('mediamime:layer-selected', handleLayerSelection);
  window.addEventListener('mediamime:camera-changed', handleCameraChange);
  window.addEventListener('mediamime:editor-mode-changed', handleEditorModeChange);

  // Track spacebar for editor pan pass-through
  const handleKeyDown = (e) => {
    if (e.code === 'Space' && !e.repeat) {
      state.spacebarPanning = true;
    }
  };
  const handleKeyUp = (e) => {
    if (e.code === 'Space') {
      state.spacebarPanning = false;
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // Initialize overlay interactivity state
  updateViewportInteractionState();

  return {
    dispose() {
      window.removeEventListener(LAYERS_EVENT, handleLayerUpdate);
      window.removeEventListener(HOLO_EVENT, handleHolisticResults);
      window.removeEventListener('mediamime:layer-selected', handleLayerSelection);
      window.removeEventListener('mediamime:camera-changed', handleCameraChange);
  window.removeEventListener('mediamime:editor-mode-changed', handleEditorModeChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearViewportDragState();
      updateViewportInteractionState();
      
      // Clean up canvas listeners
      canvas.removeEventListener('pointermove', handleCanvasPointerMove);
      canvas.removeEventListener('pointerdown', handleCanvasPointerDown);
      canvas.removeEventListener('pointerup', handleCanvasPointerUp);
      canvas.removeEventListener('pointercancel', handleCanvasPointerUp);
      
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
