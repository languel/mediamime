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
    viewportEditMode: false // Controlled by Layers panel toggle
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
    // Don't fill background - keep it transparent for layer compositing
    if (!state.streams.length) return;
    
    // Apply camera transform for main canvas (not preview)
    const camera = !isPreview && state.editor ? (state.editor.getCamera ? state.editor.getCamera() : null) : null;
    const viewBox = !isPreview && state.editor ? (state.editor.getViewBox ? state.editor.getViewBox() : null) : null;
    const dpr = window.devicePixelRatio || 1;
    
    if (camera && !isPreview) {
      targetCtx.save();
      targetCtx.translate(camera.x * dpr, camera.y * dpr);
      targetCtx.scale(camera.zoom, camera.zoom);
    }
    
    state.streams.forEach((stream) => {
      if (!stream.enabled) return;
      // Only respect the preview toggle for the preview canvas; main canvas shows all enabled layers
      if (isPreview && stream.preview === false) return;
      if (!stream.sourceId) return;
      const results = state.resultsBySource.get(stream.sourceId);
      
      // Calculate viewport in appropriate coordinate space
      let viewportPx;
      if (!isPreview && viewBox) {
        // Main canvas: use score coordinates
        const normalized = normalizeViewport(stream.viewport);
        viewportPx = {
          x: normalized.x * viewBox.width * dpr,
          y: normalized.y * viewBox.height * dpr,
          w: normalized.w * viewBox.width * dpr,
          h: normalized.h * viewBox.height * dpr
        };
      } else {
        // Preview canvas: use canvas pixel coordinates
        viewportPx = getViewportPx(stream.viewport, width, height);
      }
      
      const strokeColor = toRgba(stream.color?.hex, 1);
      const fillAlpha = Math.min(1, Math.max(0, stream.color?.alpha ?? 0));
      const fillColor = fillAlpha > 0 ? toRgba(stream.color?.hex, fillAlpha) : null;
      const zoom = camera && !isPreview ? camera.zoom : 1;
      
      targetCtx.save();
      
      if (!results) {
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
    
    if (camera && !isPreview) {
      targetCtx.restore();
    }
  };

  const render = () => {
    state.pendingRender = false;
    renderTo(ctx, canvas.width, canvas.height, { isPreview: false });
    renderViewportHandles(ctx, canvas.width, canvas.height);
    if (state.previewCtx && state.previewCanvas) {
      renderTo(state.previewCtx, state.previewCanvas.width, state.previewCanvas.height, { isPreview: true });
    }
  };

  const renderViewportHandles = (targetCtx, width, height) => {
    if (!state.activeLayerId || !state.editor) return;
    const activeLayer = state.streams.find(s => s.id === state.activeLayerId);
    if (!activeLayer || !activeLayer.enabled) return;
    
    // Get camera transform from editor
    const camera = state.editor.getCamera ? state.editor.getCamera() : { x: 0, y: 0, zoom: 1 };
    const viewBox = state.editor.getViewBox ? state.editor.getViewBox() : { width: 1000, height: 1000 };
    const dpr = window.devicePixelRatio || 1;
    
    // Get viewport in score coordinates (0-1 normalized to viewBox)
    const normalized = normalizeViewport(activeLayer.viewport);
    const scoreX = normalized.x * viewBox.width;
    const scoreY = normalized.y * viewBox.height;
    const scoreW = normalized.w * viewBox.width;
    const scoreH = normalized.h * viewBox.height;
    
    // Use layer color for handles
    const layerColor = toRgba(activeLayer.color?.hex, 1) || '#00e0ff';
    
    targetCtx.save();
    
    // Apply camera transform (matching SVG shapesLayer transform)
    targetCtx.translate(camera.x * dpr, camera.y * dpr);
    targetCtx.scale(camera.zoom, camera.zoom);
    
    // Draw viewport rectangle outline
    targetCtx.strokeStyle = layerColor;
    targetCtx.lineWidth = 2 * dpr / camera.zoom;
    targetCtx.setLineDash([8 * dpr / camera.zoom, 4 * dpr / camera.zoom]);
    targetCtx.strokeRect(scoreX * dpr, scoreY * dpr, scoreW * dpr, scoreH * dpr);
    
    // Draw corner handles
    const handleSize = 12 * dpr / camera.zoom;
    const handles = [
      { x: scoreX * dpr, y: scoreY * dpr },
      { x: (scoreX + scoreW) * dpr, y: scoreY * dpr },
      { x: scoreX * dpr, y: (scoreY + scoreH) * dpr },
      { x: (scoreX + scoreW) * dpr, y: (scoreY + scoreH) * dpr }
    ];
    
    handles.forEach(handle => {
      targetCtx.fillStyle = layerColor;
      targetCtx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
      targetCtx.strokeStyle = '#05070d';
      targetCtx.lineWidth = 1.5 * dpr / camera.zoom;
      targetCtx.setLineDash([]);
      targetCtx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    });
    
    targetCtx.restore();
  };

  const requestRender = () => {
    if (state.pendingRender) return;
    state.pendingRender = true;
    requestAnimationFrame(render);
  };

  // Toggle gesture editor interactivity based on explicit edit mode
  const applyViewportEditMode = () => {
    const overlay = document.getElementById('gesture-editor');
    if (!overlay) return;
    if (state.viewportEditMode && state.activeLayerId) {
      overlay.classList.add('is-viewport-edit');
      // Ensure canvas can receive events
      canvas.style.pointerEvents = 'auto';
    } else {
      overlay.classList.remove('is-viewport-edit');
      canvas.style.pointerEvents = '';
    }
  };

  // Viewport handle interaction
  const getHoveredViewportHandle = (clientX, clientY) => {
    if (!state.activeLayerId || !state.editor) return null;
    const activeLayer = state.streams.find(s => s.id === state.activeLayerId);
    if (!activeLayer) return null;
    
    const camera = state.editor.getCamera ? state.editor.getCamera() : { x: 0, y: 0, zoom: 1 };
    const viewBox = state.editor.getViewBox ? state.editor.getViewBox() : { width: 1000, height: 1000 };
    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;
    
    // Convert to score space
    const scoreX = (canvasX * dpr - camera.x * dpr) / camera.zoom / dpr;
    const scoreY = (canvasY * dpr - camera.y * dpr) / camera.zoom / dpr;
    
    // Get viewport in score coordinates
    const normalized = normalizeViewport(activeLayer.viewport);
    const vpX = normalized.x * viewBox.width;
    const vpY = normalized.y * viewBox.height;
    const vpW = normalized.w * viewBox.width;
    const vpH = normalized.h * viewBox.height;
    
    const handleSize = 12 / camera.zoom;
    const hitMargin = 4 / camera.zoom;
    
    // Check corner handles
    const handles = [
      { type: 'nw', x: vpX, y: vpY },
      { type: 'ne', x: vpX + vpW, y: vpY },
      { type: 'sw', x: vpX, y: vpY + vpH },
      { type: 'se', x: vpX + vpW, y: vpY + vpH },
    ];
    
    for (const handle of handles) {
      const dx = Math.abs(scoreX - handle.x);
      const dy = Math.abs(scoreY - handle.y);
      if (dx <= handleSize / 2 + hitMargin && dy <= handleSize / 2 + hitMargin) {
        return { type: 'handle', handleType: handle.type };
      }
    }
    
    // Check if inside viewport rect (for move)
    if (scoreX >= vpX && scoreX <= vpX + vpW &&
        scoreY >= vpY && scoreY <= vpY + vpH) {
      return { type: 'move' };
    }
    
    return null;
  };

  const handleCanvasPointerMove = (e) => {
    if (state.viewportDragState) {
      e.preventDefault();
      e.stopPropagation();
      
      const activeLayer = state.streams.find(s => s.id === state.activeLayerId);
      if (!activeLayer || !state.editor) return;
      
      const camera = state.editor.getCamera ? state.editor.getCamera() : { x: 0, y: 0, zoom: 1 };
      const viewBox = state.editor.getViewBox ? state.editor.getViewBox() : { width: 1000, height: 1000 };
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const dpr = window.devicePixelRatio || 1;
      
      const scoreX = (canvasX * dpr - camera.x * dpr) / camera.zoom / dpr;
      const scoreY = (canvasY * dpr - camera.y * dpr) / camera.zoom / dpr;
      
      const dx = scoreX - state.viewportDragState.startScoreX;
      const dy = scoreY - state.viewportDragState.startScoreY;
      const deltaX = dx / viewBox.width;
      const deltaY = dy / viewBox.height;
      
      let newViewport = { ...activeLayer.viewport };
      const minSize = 0.05;
      const init = state.viewportDragState.initialViewport;
      
      if (state.viewportDragState.handleType === 'move') {
        newViewport.x = Math.max(0, Math.min(1 - newViewport.w, init.x + deltaX));
        newViewport.y = Math.max(0, Math.min(1 - newViewport.h, init.y + deltaY));
      } else if (state.viewportDragState.handleType === 'nw') {
        const newX = Math.max(0, Math.min(init.x + init.w - minSize, init.x + deltaX));
        const newY = Math.max(0, Math.min(init.y + init.h - minSize, init.y + deltaY));
        newViewport.w = init.x + init.w - newX;
        newViewport.h = init.y + init.h - newY;
        newViewport.x = newX;
        newViewport.y = newY;
      } else if (state.viewportDragState.handleType === 'ne') {
        const newY = Math.max(0, Math.min(init.y + init.h - minSize, init.y + deltaY));
        newViewport.w = Math.max(minSize, Math.min(1 - init.x, init.w + deltaX));
        newViewport.h = init.y + init.h - newY;
        newViewport.y = newY;
      } else if (state.viewportDragState.handleType === 'sw') {
        const newX = Math.max(0, Math.min(init.x + init.w - minSize, init.x + deltaX));
        newViewport.w = init.x + init.w - newX;
        newViewport.h = Math.max(minSize, Math.min(1 - init.y, init.h + deltaY));
        newViewport.x = newX;
      } else if (state.viewportDragState.handleType === 'se') {
        newViewport.w = Math.max(minSize, Math.min(1 - init.x, init.w + deltaX));
        newViewport.h = Math.max(minSize, Math.min(1 - init.y, init.h + deltaY));
      }
      
      activeLayer.viewport = newViewport;
      activeLayer.viewportMode = 'custom';
      dispatchLayerViewportUpdate(activeLayer);
      requestRender();
      return;
    }
    
    const hovered = getHoveredViewportHandle(e.clientX, e.clientY);
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
    const hovered = getHoveredViewportHandle(e.clientX, e.clientY);
    if (hovered) {
      e.preventDefault();
      e.stopPropagation();
      
      const activeLayer = state.streams.find(s => s.id === state.activeLayerId);
      if (!activeLayer || !state.editor) return;
      
      const camera = state.editor.getCamera ? state.editor.getCamera() : { x: 0, y: 0, zoom: 1 };
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const dpr = window.devicePixelRatio || 1;
      
      const scoreX = (canvasX * dpr - camera.x * dpr) / camera.zoom / dpr;
      const scoreY = (canvasY * dpr - camera.y * dpr) / camera.zoom / dpr;
      
      state.viewportDragState = {
        handleType: hovered.handleType || hovered.type,
        startScoreX: scoreX,
        startScoreY: scoreY,
        initialViewport: { ...activeLayer.viewport }
      };
      canvas.setPointerCapture(e.pointerId);
    } else {
      if (state.activeLayerId) {
        state.activeLayerId = null;
        updateOverlayInteractivity();
        requestRender();
      }
    }
  };

  const handleCanvasPointerUp = (e) => {
    if (state.viewportDragState) {
      canvas.releasePointerCapture(e.pointerId);
      state.viewportDragState = null;
    }
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

  // Handle layer selection from layers panel
  const handleLayerSelection = (e) => {
    state.activeLayerId = e.detail.layerId;
    applyViewportEditMode();
    requestRender();
  };

  // Handle camera changes from editor (zoom/pan)
  const handleCameraChange = () => {
    requestRender();
  };

  window.addEventListener(LAYERS_EVENT, handleLayerUpdate);
  window.addEventListener(HOLO_EVENT, handleHolisticResults);
  window.addEventListener('mediamime:layer-selected', handleLayerSelection);
  window.addEventListener('mediamime:camera-changed', handleCameraChange);

  // Viewport edit mode from Layers panel
  const handleViewportEditMode = (e) => {
    state.viewportEditMode = Boolean(e?.detail?.enabled);
    // Optionally track layerId from the event
    if (e?.detail?.layerId) state.activeLayerId = e.detail.layerId;
    applyViewportEditMode();
    requestRender();
  };
  window.addEventListener('mediamime:viewport-edit-mode', handleViewportEditMode);

  // Initialize overlay interactivity state
  applyViewportEditMode();

  return {
    dispose() {
      window.removeEventListener(LAYERS_EVENT, handleLayerUpdate);
      window.removeEventListener(HOLO_EVENT, handleHolisticResults);
      window.removeEventListener('mediamime:layer-selected', handleLayerSelection);
      window.removeEventListener('mediamime:camera-changed', handleCameraChange);
  window.removeEventListener('mediamime:viewport-edit-mode', handleViewportEditMode);
  applyViewportEditMode();
      
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
