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
  // Phase 3C: Visibility culling for connectors
  // Skip lines where both endpoints are outside the viewport
  if (!landmarks || !connections) return;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2 / zoom;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Pre-compute viewport bounds with margin for line thickness
  const lineMargin = 4 / zoom;
  const vpLeft = viewportPx.x - lineMargin;
  const vpRight = viewportPx.x + viewportPx.w + lineMargin;
  const vpTop = viewportPx.y - lineMargin;
  const vpBottom = viewportPx.y + viewportPx.h + lineMargin;

  ctx.beginPath();
  let culledLines = 0;
  let renderedLines = 0;

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

    // Phase 3C: Quick culling test - skip if both endpoints and their bounding box are outside
    // If both points are on the same side of the viewport bounds, line definitely doesn't intersect
    const bothLeft = startX < vpLeft && endX < vpLeft;
    const bothRight = startX > vpRight && endX > vpRight;
    const bothTop = startY < vpTop && endY < vpTop;
    const bothBottom = startY > vpBottom && endY > vpBottom;

    if (bothLeft || bothRight || bothTop || bothBottom) {
      culledLines++;
      return;
    }

    renderedLines++;
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
  });

  ctx.stroke();

  // Store culling stats for monitoring
  if (typeof ctx.cullingStats === 'undefined') {
    ctx.cullingStats = { culled: 0, rendered: 0 };
  }
  ctx.cullingStats.culled += culledLines;
  ctx.cullingStats.rendered += renderedLines;
};

const drawLandmarks = (ctx, landmarks, viewportPx, color, size = 4, zoom = 1) => {
  // Phase 3C: Visibility culling for landmarks
  // Skip landmarks that are clearly outside the viewport to reduce rendering overhead
  if (!Array.isArray(landmarks)) return;
  ctx.fillStyle = color;
  const adjustedSize = size / zoom;

  // Pre-compute viewport bounds with culling margin for early rejection
  const vpLeft = viewportPx.x - adjustedSize;
  const vpRight = viewportPx.x + viewportPx.w + adjustedSize;
  const vpTop = viewportPx.y - adjustedSize;
  const vpBottom = viewportPx.y + viewportPx.h + adjustedSize;

  let culledCount = 0;
  let renderedCount = 0;

  landmarks.forEach((landmark) => {
    if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) return;
    const x = viewportPx.x + clampUnit(landmark.x) * viewportPx.w;
    const y = viewportPx.y + clampUnit(landmark.y) * viewportPx.h;

    // Phase 3C: Quick visibility test - skip if clearly outside viewport
    // Uses AABB (Axis-Aligned Bounding Box) collision detection
    if (x < vpLeft || x > vpRight || y < vpTop || y > vpBottom) {
      culledCount++;
      return;
    }

    renderedCount++;
    ctx.beginPath();
    ctx.arc(x, y, adjustedSize, 0, Math.PI * 2);
    ctx.fill();
  });

  // Store culling stats for monitoring (optional)
  if (typeof ctx.cullingStats === 'undefined') {
    ctx.cullingStats = { culled: 0, rendered: 0 };
  }
  ctx.cullingStats.culled += culledCount;
  ctx.cullingStats.rendered += renderedCount;
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

const drawViewportBounds = (ctx, viewportPx, strokeColor, fillAlpha = 0, fillColor = null, streamId = null, cacheState = null) => {
  // Phase 3A Optimization: Cache viewport bounds to OffscreenCanvas
  // Only redraw when viewport or colors change
  const shouldUseCacheOptimization = cacheState?.enabled && streamId;

  if (shouldUseCacheOptimization) {
    const cache = cacheState;
    const viewportKey = `${Math.round(viewportPx.x)},${Math.round(viewportPx.y)},${Math.round(viewportPx.w)},${Math.round(viewportPx.h)}`;
    const colorKey = `${strokeColor}|${fillColor}|${fillAlpha}`;

    // Check if cache is still valid
    const cacheValid = cache.cachedStreamId === streamId &&
                       cache.cachedColor === colorKey &&
                       cache.cachedViewport === viewportKey &&
                       cache.offscreenCanvas &&
                       cache.offscreenCtx;

    if (!cacheValid) {
      // Need to regenerate cache - allocate or resize OffscreenCanvas
      const w = Math.ceil(viewportPx.w) + 2;
      const h = Math.ceil(viewportPx.h) + 2;

      if (!cache.offscreenCanvas ||
          cache.offscreenCanvas.width !== w ||
          cache.offscreenCanvas.height !== h) {
        cache.offscreenCanvas = new OffscreenCanvas(w, h);
        cache.offscreenCtx = cache.offscreenCanvas.getContext('2d');
      }

      const oCtx = cache.offscreenCtx;
      oCtx.setTransform(1, 0, 0, 1, 0, 0);
      oCtx.clearRect(0, 0, w, h);

      // Draw bounds at origin in offscreen canvas
      if (fillAlpha > 0 && fillColor) {
        oCtx.fillStyle = fillColor;
        oCtx.fillRect(1, 1, viewportPx.w, viewportPx.h);
      }
      oCtx.strokeStyle = strokeColor;
      oCtx.lineWidth = 1;
      oCtx.setLineDash([1, 12]);
      oCtx.strokeRect(1, 1, viewportPx.w, viewportPx.h);

      // Update cache state
      cache.cachedStreamId = streamId;
      cache.cachedColor = colorKey;
      cache.cachedViewport = viewportKey;
    }

    // Composite cached bounds to main canvas
    ctx.drawImage(cache.offscreenCanvas, viewportPx.x - 1, viewportPx.y - 1);
  } else {
    // Fallback: Direct rendering without cache (no OffscreenCanvas available)
    ctx.save();
    if (fillAlpha > 0 && fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 12]);
    ctx.strokeRect(viewportPx.x, viewportPx.y, viewportPx.w, viewportPx.h);
    ctx.restore();
  }
};

const drawRawViewportFrame = (ctx, frame, viewportPx, tintColor, alpha) => {
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

const calculateFPS = (fpsTracker) => {
  const now = performance.now ? performance.now() : Date.now();
  
  if (fpsTracker.lastFrameTime > 0) {
    const delta = now - fpsTracker.lastFrameTime;
    fpsTracker.frameTimes.push(delta);
    
    // Keep only the last N samples
    if (fpsTracker.frameTimes.length > fpsTracker.maxSamples) {
      fpsTracker.frameTimes.shift();
    }
  }
  
  fpsTracker.lastFrameTime = now;
  
  // Calculate average FPS from frame times
  if (fpsTracker.frameTimes.length === 0) return 0;
  
  const avgDelta = fpsTracker.frameTimes.reduce((a, b) => a + b, 0) / fpsTracker.frameTimes.length;
  return avgDelta > 0 ? 1000 / avgDelta : 0;
};

const drawMetrics = (ctx, viewportPx, strokeColor, frame, results, stream, zoom = 1, fpsTracker = null) => {
  ctx.save();
  
  // Calculate FPS
  const fps = fpsTracker ? calculateFPS(fpsTracker) : 0;
  
  // Gather metrics
  const metrics = [];
  
  // FPS at the top - prominently displayed
  metrics.push(`FPS: ${fps.toFixed(1)}`);
  metrics.push(''); // Blank line for separation
  
  // Stream info
  metrics.push(`Stream: ${stream.name || 'Unnamed'}`);
  metrics.push(`Source: ${stream.source || 'none'}`);
  
  // Input resolution
  if (frame) {
    const width = frame.width || frame.videoWidth || 0;
    const height = frame.height || frame.videoHeight || 0;
    metrics.push(`Input Res: ${width}×${height}`);
  } else {
    metrics.push(`Input Res: N/A`);
  }
  
  // Viewport coordinates (normalized 0-1)
  const viewport = stream.viewport || { x: 0, y: 0, w: 1, h: 1 };
  metrics.push(`Viewport (norm):`);
  metrics.push(`  x: ${viewport.x.toFixed(3)}  y: ${viewport.y.toFixed(3)}`);
  metrics.push(`  w: ${viewport.w.toFixed(3)}  h: ${viewport.h.toFixed(3)}`);
  
  // Display viewport pixel dimensions
  metrics.push(`Display (px): ${Math.round(viewportPx.w)}×${Math.round(viewportPx.h)}`);
  metrics.push(`Position (px): ${Math.round(viewportPx.x)}, ${Math.round(viewportPx.y)}`);
  
  // MediaPipe processing info
  if (results) {
    // Timestamp
    if (results.updatedAt !== undefined) {
      const now = performance.now ? performance.now() : Date.now();
      const age = now - results.updatedAt;
      metrics.push(`Frame Age: ${age.toFixed(0)}ms`);
    }
    
    // Landmarks detected
    if (results.poseLandmarks) {
      metrics.push(`Pose: ${results.poseLandmarks.length} landmarks`);
    }
    if (results.leftHandLandmarks || results.rightHandLandmarks) {
      const left = results.leftHandLandmarks ? results.leftHandLandmarks.length : 0;
      const right = results.rightHandLandmarks ? results.rightHandLandmarks.length : 0;
      metrics.push(`Hands: L${left} R${right}`);
    }
    if (results.faceLandmarks) {
      metrics.push(`Face: ${results.faceLandmarks.length} landmarks`);
    }
    if (results.segmentationMask) {
      metrics.push(`Segmentation: Active`);
    }
  } else {
    metrics.push(`MediaPipe: No results`);
  }
  
  // Stream state
  metrics.push(`Enabled: ${stream.enabled !== false ? 'Yes' : 'No'}`);
  metrics.push(`Color: ${stream.color?.hex || '#52d5ff'} α${((stream.color?.alpha || 0) * 100).toFixed(0)}%`);
  
  // Draw text
  const padding = 10 / zoom;
  const lineHeight = 14 / zoom;
  const fontSize = 11 / zoom;
  const fpsFontSize = 18 / zoom;
  const fpsLineHeight = 22 / zoom;
  
  // First, draw FPS prominently with larger font
  ctx.font = `bold ${fpsFontSize}px "SF Mono", "Monaco", "Menlo", "Courier New", monospace`;
  ctx.textBaseline = "top";
  const fpsText = `FPS: ${fps.toFixed(1)}`;
  const fpsWidth = ctx.measureText(fpsText).width;
  
  // Calculate overall background size
  ctx.font = `${fontSize}px "SF Mono", "Monaco", "Menlo", "Courier New", monospace`;
  const regularMetrics = metrics.slice(2); // Skip FPS and blank line
  const maxWidth = Math.max(fpsWidth, ...regularMetrics.map(m => ctx.measureText(m).width));
  const bgWidth = maxWidth + padding * 2;
  const bgHeight = fpsLineHeight + padding + regularMetrics.length * lineHeight + padding * 2;
  
  // Draw background using layer color with alpha
  const layerAlpha = stream.color?.alpha ?? 0.5;
  const layerColor = stream.color?.hex || '#52d5ff';
  // Convert hex to rgb and apply alpha
  const hexMatch = layerColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    const r = parseInt(hexMatch[1], 16);
    const g = parseInt(hexMatch[2], 16);
    const b = parseInt(hexMatch[3], 16);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${layerAlpha})`;
  } else {
    ctx.fillStyle = `rgba(82, 213, 255, ${layerAlpha})`;
  }
  ctx.fillRect(viewportPx.x + 6 / zoom, viewportPx.y + 6 / zoom, bgWidth, bgHeight);
  
  // Draw FPS prominently with white text
  ctx.font = `bold ${fpsFontSize}px "SF Mono", "Monaco", "Menlo", "Courier New", monospace`;
  ctx.fillStyle = fps > 24 ? '#52ff52' : fps > 15 ? '#ffaa00' : '#ff5252';
  ctx.fillText(
    fpsText,
    viewportPx.x + padding + 6 / zoom,
    viewportPx.y + padding + 6 / zoom
  );
  
  // Draw separator line
  const separatorY = viewportPx.y + padding + 6 / zoom + fpsLineHeight;
  ctx.strokeStyle = `${strokeColor}40`;
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  ctx.moveTo(viewportPx.x + padding + 6 / zoom, separatorY);
  ctx.lineTo(viewportPx.x + bgWidth - padding + 6 / zoom, separatorY);
  ctx.stroke();
  
  // Draw regular metrics with white text
  ctx.font = `${fontSize}px "SF Mono", "Monaco", "Menlo", "Courier New", monospace`;
  ctx.fillStyle = '#ffffff';
  regularMetrics.forEach((metric, index) => {
    ctx.fillText(
      metric,
      viewportPx.x + padding + 6 / zoom,
      viewportPx.y + padding + 6 / zoom + fpsLineHeight + padding / 2 + index * lineHeight
    );
  });
  
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
    displayMetrics: null,
    fpsTracker: {
      lastFrameTime: 0,
      frameTimes: [],
      maxSamples: 30
    },
    // Frame skipping optimization
    frameSkipping: {
      lastFrameTime: 0,
      targetFPS: 60,
      frameCount: 0,
      skippedFrames: 0
    },
    // Output resolution scaling
    outputResolution: {
      preset: 'raw',
      width: null,
      height: null,
      appliedScale: 1.0
    },
    // Dirty rectangle tracking for optimized clearing
    dirtyRectangles: [],
    lastStreamsHash: null,
    // OffscreenCanvas caching for viewport bounds
    viewportBoundsCache: {
      enabled: typeof OffscreenCanvas !== 'undefined',
      offscreenCanvas: null,
      offscreenCtx: null,
      cachedStreamId: null,
      cachedColor: null,
      cachedFillColor: null,
      cachedFillAlpha: null,
      cachedViewport: null
    },
    // OffscreenCanvas caching for viewport overlay (Phase 3B)
    viewportOverlayCache: {
      enabled: typeof OffscreenCanvas !== 'undefined',
      offscreenCanvas: null,
      offscreenCtx: null,
      lastCameraZoom: null,
      lastActiveLayerId: null,
      lastStreamStates: new Map(), // Map<streamId, {color, viewport, isActive}>
      lastViewBox: null
    }
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
    } else if (state.displayMetrics) {
      // Cache hit: metrics are still valid
      // Only update camera/viewBox if they've actually changed (avoid recalculation)
      const currentViewBox = state.editor?.getViewBox?.();
      const currentCamera = state.editor?.getCamera?.();

      // Only update if values actually changed
      if (currentViewBox &&
          (currentViewBox.width !== state.displayMetrics.viewBox.width ||
           currentViewBox.height !== state.displayMetrics.viewBox.height)) {
        state.displayMetrics.viewBox = currentViewBox;
      }

      if (currentCamera &&
          (currentCamera.x !== state.displayMetrics.camera.x ||
           currentCamera.y !== state.displayMetrics.camera.y ||
           currentCamera.zoom !== state.displayMetrics.camera.zoom)) {
        state.displayMetrics.camera = currentCamera;
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

    // Reset transform to identity
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Only clear if streams exist, otherwise clear full buffer for empty canvas
    if (state.streams.length === 0) {
      targetCtx.clearRect(0, 0, width, height);
      return;
    }

    // Optimization: For most frames, only clear the regions occupied by streams
    // instead of clearing the entire canvas. This is much faster at high resolutions.
    // Calculate union of stream viewport rectangles for dirty rect clearing
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasEnabledStream = false;

    state.streams.forEach((stream) => {
      if (!stream.enabled) return;
      if (isPreview && stream.preview === false) return;
      if (!isPreview && stream.showInMain === false) return;
      hasEnabledStream = true;

      // Estimate stream viewport in pixels
      const vp = stream.viewport || { x: 0, y: 0, w: 1, h: 1 };
      const vpX = vp.x * width;
      const vpY = vp.y * height;
      const vpW = vp.w * width;
      const vpH = vp.h * height;

      minX = Math.min(minX, vpX);
      minY = Math.min(minY, vpY);
      maxX = Math.max(maxX, vpX + vpW);
      maxY = Math.max(maxY, vpY + vpH);
    });

    // Clear only the dirty regions (with padding for safety)
    if (hasEnabledStream && minX < maxX && minY < maxY) {
      const padding = 4; // Small padding for zoom/transform artifacts
      targetCtx.clearRect(
        Math.max(0, minX - padding),
        Math.max(0, minY - padding),
        Math.min(width, maxX - minX + padding * 2),
        Math.min(height, maxY - minY + padding * 2)
      );
    } else {
      // Fallback: clear full canvas if calculation fails
      targetCtx.clearRect(0, 0, width, height);
    }

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
          drawViewportBounds(targetCtx, viewportPx, strokeColor, fillAlpha, fillColor, stream.id, state.viewportBoundsCache);
        }
        targetCtx.restore();
        return;
      }

      if (stream.process === "metrics") {
        // Metrics can be drawn even without MediaPipe results
        drawMetrics(targetCtx, viewportPx, strokeColor, frame, results, stream, zoom, state.fpsTracker);
        targetCtx.restore();
        return;
      }

    if (!results) {
      // Skip drawing for data-driven processes until we have results
      if (DATA_DEPENDENT_PROCESSES.has(stream.process)) {
        targetCtx.restore();
        return;
      }
      drawViewportBounds(targetCtx, viewportPx, strokeColor, fillAlpha, fillColor, stream.id, state.viewportBoundsCache);
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
          drawViewportBounds(targetCtx, viewportPx, strokeColor, fillAlpha, fillColor, stream.id, state.viewportBoundsCache);
          break;
        case "metrics":
          drawMetrics(targetCtx, viewportPx, strokeColor, frame, results, stream, zoom, state.fpsTracker);
          break;
        case "raw":
        default:
          drawViewportBounds(targetCtx, viewportPx, strokeColor, fillAlpha, fillColor, stream.id, state.viewportBoundsCache);
          break;
      }
      targetCtx.restore();
    });

    // Restore identity matrix for downstream operations
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const render = () => {
    state.pendingRender = false;

    // Frame skipping optimization: skip rendering if we're ahead of target FPS
    const now = performance.now();
    if (state.frameSkipping.lastFrameTime > 0) {
      const elapsed = now - state.frameSkipping.lastFrameTime;
      const frameBudget = 1000 / state.frameSkipping.targetFPS;

      // If we're running too fast and frame budget hasn't elapsed, skip this frame
      if (elapsed < frameBudget * 0.9) {
        state.frameSkipping.skippedFrames++;
        requestAnimationFrame(render);
        return;
      }
    }

    state.frameSkipping.lastFrameTime = now;
    state.frameSkipping.frameCount++;

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

    // Phase 3B Optimization: Cache viewport overlay to OffscreenCanvas
    // Only redraw when stream colors, viewports, active state, or zoom changes
    const cache = state.viewportOverlayCache;
    const shouldUseCacheOptimization = cache.enabled;

    // Check if cache is still valid
    let cacheValid = shouldUseCacheOptimization &&
                     cache.offscreenCanvas &&
                     cache.offscreenCtx &&
                     cache.lastCameraZoom === camera.zoom &&
                     cache.lastActiveLayerId === state.activeLayerId &&
                     cache.lastViewBox?.width === viewBox.width &&
                     cache.lastViewBox?.height === viewBox.height;

    if (cacheValid && cache.lastStreamStates.size === state.streams.length) {
      // Verify each stream's state hasn't changed
      for (const stream of state.streams) {
        if (!stream?.enabled || stream.showInMain === false) continue;
        const cached = cache.lastStreamStates.get(stream.id);
        const currentColor = toRgba(stream.color?.hex, 1) || '#00e0ff';
        const currentVpKey = `${stream.viewport.x},${stream.viewport.y},${stream.viewport.w},${stream.viewport.h}`;
        const currentIsActive = state.activeLayerId === stream.id;

        if (!cached ||
            cached.color !== currentColor ||
            cached.vpKey !== currentVpKey ||
            cached.isActive !== currentIsActive) {
          cacheValid = false;
          break;
        }
      }
    } else {
      cacheValid = false;
    }

    // If cache is valid, use it instead of redrawing
    if (cacheValid) {
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
      targetCtx.drawImage(cache.offscreenCanvas, 0, 0);
      targetCtx.restore();
      targetCtx.setTransform(1, 0, 0, 1, 0, 0);
      return;
    }

    // Cache miss: regenerate viewport overlay
    const maxSize = Math.max(viewBox.width, viewBox.height) * 1.2;
    const overlaySize = Math.ceil(maxSize);

    if (!cache.offscreenCanvas ||
        cache.offscreenCanvas.width !== overlaySize ||
        cache.offscreenCanvas.height !== overlaySize) {
      cache.offscreenCanvas = new OffscreenCanvas(overlaySize, overlaySize);
      cache.offscreenCtx = cache.offscreenCanvas.getContext('2d');
    }

    const oCtx = cache.offscreenCtx;
    oCtx.setTransform(1, 0, 0, 1, 0, 0);
    oCtx.clearRect(0, 0, overlaySize, overlaySize);

    const dashPattern = [2 / camera.zoom, 8 / camera.zoom];

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

      oCtx.save();
      oCtx.globalAlpha = isActive ? 1 : 0.6;
      oCtx.strokeStyle = layerColor;
      oCtx.lineWidth = 2 / camera.zoom;
      oCtx.setLineDash(dashPattern);
      oCtx.strokeRect(scoreX, scoreY, scoreW, scoreH);

      if (isActive) {
        const handleSize = 12 / camera.zoom;
        const handles = [
          { x: scoreX, y: scoreY },
          { x: scoreX + scoreW, y: scoreY },
          { x: scoreX, y: scoreY + scoreH },
          { x: scoreX + scoreW, y: scoreY + scoreH }
        ];
        handles.forEach((handle) => {
          oCtx.fillStyle = layerColor;
          oCtx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
          oCtx.strokeStyle = '#05070d';
          oCtx.lineWidth = 1.5 / camera.zoom;
          oCtx.setLineDash([]);
          oCtx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
        });
      }

      oCtx.restore();

      // Track stream state for cache invalidation
      cache.lastStreamStates.set(stream.id, {
        color: layerColor,
        vpKey: `${stream.viewport.x},${stream.viewport.y},${stream.viewport.w},${stream.viewport.h}`,
        isActive
      });
    });

    // Update cache state
    cache.lastCameraZoom = camera.zoom;
    cache.lastActiveLayerId = state.activeLayerId;
    cache.lastViewBox = { ...viewBox };

    // Composite cached overlay to main canvas
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
    targetCtx.drawImage(cache.offscreenCanvas, 0, 0);
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
    let nextWidth = Math.max(1, Math.floor(width * pixelRatio));
    let nextHeight = Math.max(1, Math.floor(height * pixelRatio));

    // Apply output resolution scaling if configured
    const outputRes = state.outputResolution;
    if (outputRes.preset !== 'raw') {
      // Apply preset or custom resolution scaling
      if (outputRes.width && outputRes.height) {
        // Custom resolution: scale based on aspect ratio
        const containerAspect = width / height;
        const targetAspect = outputRes.width / outputRes.height;

        if (containerAspect > targetAspect) {
          // Container is wider, constrain by height
          nextHeight = Math.max(1, Math.floor(outputRes.height * pixelRatio));
          nextWidth = Math.max(1, Math.floor(nextHeight * containerAspect));
        } else {
          // Container is taller or square, constrain by width
          nextWidth = Math.max(1, Math.floor(outputRes.width * pixelRatio));
          nextHeight = Math.max(1, Math.floor(nextWidth / containerAspect));
        }
      }
      state.outputResolution.appliedScale = nextWidth / (width * pixelRatio);
    } else {
      state.outputResolution.appliedScale = 1.0;
    }

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

  // Handle active input changes to apply output resolution settings
  const handleActiveInputChange = (event) => {
    const input = event?.detail?.input;
    if (!input) return;

    const outputRes = input.outputResolution || { preset: 'raw', width: null, height: null };
    state.outputResolution = {
      preset: outputRes.preset || 'raw',
      width: outputRes.width || null,
      height: outputRes.height || null,
      appliedScale: state.outputResolution.appliedScale || 1.0
    };

    // Trigger canvas resize to apply new resolution
    scheduleResize();
  };

  window.addEventListener(LAYERS_EVENT, handleLayerUpdate);
  window.addEventListener(HOLO_EVENT, handleHolisticResults);
  window.addEventListener('mediamime:layer-selected', handleLayerSelection);
  window.addEventListener('mediamime:camera-changed', handleCameraChange);
  window.addEventListener('mediamime:editor-mode-changed', handleEditorModeChange);
  window.addEventListener('mediamime:active-input-changed', handleActiveInputChange);

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
      window.removeEventListener('mediamime:active-input-changed', handleActiveInputChange);
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
