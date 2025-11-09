const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_SHAPE_DIMENSION = 0.01; // Normalised units (0–1)
const MIN_DRAW_DISTANCE = 0.004; // Slightly larger to reduce point count during drawing
const LINE_CLOSE_THRESHOLD = 0.02;
const ERASER_TOLERANCE = 0.02;
const FREEHAND_SIMPLIFY_TOLERANCE = 0.004; // Applied only on mouse release
const SNAP_GRID_SIZE = 50; // Grid snap size in pixels (matches grid rendering)
const SNAP_ELEMENT_THRESHOLD = 15; // Pixel distance threshold for snapping to elements

// Helper to get current color from editor color picker
function getCurrentStyle() {
  const pickerRoot = document.querySelector('[data-rgba-picker="editor"]');
  if (!pickerRoot) {
    return {
      stroke: "rgba(255, 255, 255, 1)",
      fill: "rgba(255, 255, 255, 0.5)",
      strokeWidth: 2
    };
  }
  
  // Get the CSS variable that stores the current rgba color
  const rgba = getComputedStyle(pickerRoot).getPropertyValue('--rgba-color').trim() || "rgba(255, 255, 255, 1)";
  
  // Parse rgba to extract alpha for calculating 50% relative opacity for fill
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) {
    return {
      stroke: rgba,
      fill: rgba.replace(/,\s*[\d.]+\)$/, ', 0.5)'),
      strokeWidth: 2
    };
  }
  
  const [, r, g, b, a = '1'] = match;
  const alpha = parseFloat(a);
  const fillAlpha = alpha * 0.5; // 50% relative opacity
  
  return {
    stroke: rgba,
    fill: `rgba(${r}, ${g}, ${b}, ${fillAlpha})`,
    strokeWidth: 2
  };
}

const DEFAULT_STYLE = {
  stroke: "rgba(255, 255, 255, 1)",
  fill: "rgba(255, 255, 255, 0.5)",
  strokeWidth: 2
};

class SvgShapeStore {
  constructor(layer, viewBox) {
    this.layer = layer;
    this.view = viewBox;
    this.order = [];
    this.nodes = new Map();
    this.bootstrap();
  }

  setView(viewBox) {
    this.view = viewBox;
  }

  bootstrap() {
    if (!this.layer) return;
    const existing = Array.from(this.layer.querySelectorAll("[data-shape-id]"));
    this.order.length = 0;
    this.nodes.clear();
    existing.forEach((node) => {
      const id = node.dataset.shapeId || createId();
      node.dataset.shapeId = id;
      if (!node.dataset.shapeType) {
        const child = node.firstElementChild;
        if (child) {
          const tag = child.tagName.toLowerCase();
          if (tag === "rect") node.dataset.shapeType = "rect";
          else if (tag === "ellipse") node.dataset.shapeType = "ellipse";
          else if (tag === "polygon" || tag === "polyline") node.dataset.shapeType = "line";
          else if (tag === "path") node.dataset.shapeType = "path";
        }
      }
      this.order.push(id);
      this.nodes.set(id, node);
      const shape = parseShapeNode(node, this.view);
      if (shape) {
        applyShapeNode(node, shape, this.view);
      }
    });
  }

  getNode(id) {
    return this.nodes.get(id) || null;
  }

  ensureOrder() {
    this.order.forEach((id) => {
      const node = this.nodes.get(id);
      if (node && node.parentNode !== this.layer) {
        this.layer.appendChild(node);
      } else if (node) {
        this.layer.appendChild(node);
      }
    });
  }

  list() {
    return this.order.map((id) => this.read(id)).filter(Boolean);
  }

  read(id) {
    const node = this.nodes.get(id);
    if (!node) return null;
    return parseShapeNode(node, this.view);
  }

  write(shape) {
    if (!shape || !shape.id) return null;
    let node = this.nodes.get(shape.id);
    if (!node) {
      node = buildShapeNode(shape, this.view);
      this.layer.appendChild(node);
      this.nodes.set(shape.id, node);
      if (!this.order.includes(shape.id)) {
        this.order.push(shape.id);
      }
    }
    applyShapeNode(node, shape, this.view);
    return parseShapeNode(node, this.view);
  }

  remove(id) {
    const node = this.nodes.get(id);
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
    this.nodes.delete(id);
    this.order = this.order.filter((value) => value !== id);
  }

  move(id, targetIndex) {
    const currentIndex = this.order.indexOf(id);
    if (currentIndex === -1) return;
    const clampedIndex = Math.max(0, Math.min(this.order.length - 1, targetIndex));
    if (currentIndex === clampedIndex) return;
    this.order.splice(currentIndex, 1);
    this.order.splice(clampedIndex, 0, id);
    this.ensureOrder();
  }

  clear() {
    Array.from(this.nodes.values()).forEach((node) => {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
    this.nodes.clear();
    this.order.length = 0;
  }
}

export function initEditor({ root, svg, toolbar }) {
  const editor = new Editor(root, svg, toolbar);
  editor.init();
  return editor.getApi();
}

class Editor {
  constructor(root, svg, toolbar) {
    this.root = root;
    this.svg = svg;
    this.toolbar = toolbar;
    this.view = getViewBox(svg);
    this.state = {
      mode: "edit",
      tool: "select",
      toolLocked: false,
      selectedShapeIds: new Set(), // Changed from single selectedShapeId to Set for multi-select
      curveEditShapeId: null, // Track which shape is in curve-edit mode
      curveEditPoints: [], // Array of {index, x, y} for the points being edited
      gridMode: 'off' // 'off', 'line', 'dot'
    };
    // Camera transform for infinite canvas
    this.camera = {
      x: 0, // Pan offset X
      y: 0, // Pan offset Y
      zoom: 1 // Zoom level (1 = 100%)
    };
    this.shapeStore = null;
    this.session = null;
    this.events = new Map();
    this.pendingLine = null;
    this.spacebarPressed = false; // Track spacebar state for pan override
    this.lockButton = document.getElementById("gesture-tool-lock") || this.toolbar.querySelector("#gesture-tool-lock");
    this.modeToggle = document.getElementById("gesture-mode-toggle") || this.toolbar.querySelector("#gesture-mode-toggle");
    this.clearButton = document.getElementById("gesture-clear") || this.toolbar.querySelector("#gesture-clear");
    this.toolbarHidden = false;
    // History (undo/redo)
    this.history = { past: [], future: [], limit: 3 };
    this.isRestoring = false;
    this.lastToolKey = null;
    this.lastToolKeyTime = 0;
  }

  init() {
    this.prepareSvg();
    this.bindToolbar();
    this.bindCanvas();
    this.updateModeUI();
    this.render();
    // Seed history with initial state
    this.commitHistory("init");
  }

  normalizeClientPoint(clientPoint, { clamp = true } = {}) {
    if (!clientPoint || typeof clientPoint.clientX !== "number" || typeof clientPoint.clientY !== "number") {
      return null;
    }
    const point = this.svg.createSVGPoint();
    point.x = clientPoint.clientX;
    point.y = clientPoint.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return null;
    const mapped = point.matrixTransform(ctm.inverse());
    // Apply camera transform (pan and zoom)
    const worldX = (mapped.x - this.camera.x) / this.camera.zoom;
    const worldY = (mapped.y - this.camera.y) / this.camera.zoom;
    const normalized = {
      x: worldX / this.view.width,
      y: worldY / this.view.height
    };
    if (clamp) {
      normalized.x = clampUnit(normalized.x);
      normalized.y = clampUnit(normalized.y);
    }
    return normalized;
  }

  shapeContainsPoint(shapeId, point, tolerance = 0) {
    if (!shapeId || !point) return false;
    const shape = this.shapeStore?.read(shapeId);
    if (!shape) return false;
    return shapeContainsPoint(shape, point, tolerance);
  }

  getApi() {
    return {
      getState: () => ({
        tool: this.state.tool,
        toolLocked: this.state.toolLocked,
        shapes: (this.shapeStore ? this.shapeStore.list() : []).map(cloneShape),
        selection: Array.from(this.state.selectedShapeIds)
      }),
      // Add basic shape management APIs for import/export workflows
  addShape: (shape, options) => this.addShape(shape, options),
      replaceShapes: (shapes) => this.replaceShapes(shapes),
      setTool: (tool) => this.setTool(tool),
      updateShape: (shapeId, mutator) => this.updateShape(shapeId, mutator),
      selectShape: (shapeId) => this.selectShape(shapeId),
      deleteShape: (shapeId, options) => this.deleteShape(shapeId, options),
      moveShapeInOrder: (shapeId, delta) => this.moveShapeInOrder(shapeId, delta),
      on: (event, handler) => this.on(event, handler),
      off: (event, handler) => this.off(event, handler),
      normalizePoint: (clientPoint, options) => this.normalizeClientPoint(clientPoint, options),
      shapeContainsPoint: (shapeId, point, tolerance) => this.shapeContainsPoint(shapeId, point, tolerance),
      getShapeSnapshot: (shapeId) => cloneShape(this.shapeStore?.read(shapeId)),
      getCamera: () => ({ ...this.camera }),
      getViewBox: () => ({ ...this.view }),
      getMode: () => this.state.mode
    };
  }

  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(handler);
  }

  off(event, handler) {
    this.events.get(event)?.delete(handler);
  }

  emit(event, payload) {
    this.events.get(event)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[mediamime] Editor listener for "${event}" failed`, error);
      }
    });
  }

  // ===== History (Undo/Redo) =====
  getSnapshot() {
    return {
      // Only capture score state (shapes), not UI state like selection
      shapes: (this.shapeStore ? this.shapeStore.list() : []).map(cloneShape)
    };
  }

  restoreSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.shapes)) return;
    this.isRestoring = true;
    try {
      // Replace shapes to match snapshot exactly
      if (this.shapeStore) {
        this.shapeStore.clear();
        snapshot.shapes.forEach((shape) => this.shapeStore.write(shape));
      }
      // Prune selection to only shapes that still exist after restore
      const beforeSel = new Set(this.state.selectedShapeIds);
      const afterSel = new Set();
      beforeSel.forEach((id) => {
        if (this.shapeStore.read(id)) afterSel.add(id);
      });
      this.state.selectedShapeIds = afterSel;
      this.render();
      this.notifyShapesChanged();
      this.notifySelectionChanged();
    } finally {
      this.isRestoring = false;
    }
  }

  commitHistory(label = "commit") {
    if (this.isRestoring) return;
    const snap = this.getSnapshot();
    // Skip duplicate of last past entry by deep-comparing shapes content
    const last = this.history.past[this.history.past.length - 1];
    if (last) {
      try {
        const lastStr = JSON.stringify(last.shapes);
        const snapStr = JSON.stringify(snap.shapes);
        if (lastStr === snapStr) return;
      } catch {
        // If stringify fails, fall through and record the commit
      }
    }
    this.history.past.push(snap);
    if (this.history.past.length > this.history.limit) {
      this.history.past.shift();
    }
    // New commit invalidates redo chain
    this.history.future.length = 0;
  }

  undo() {
    if (!this.history.past.length) return;
    const current = this.getSnapshot();
    const target = this.history.past.pop();
    this.history.future.push(current);
    this.restoreSnapshot(target);
  }

  redo() {
    if (!this.history.future.length) return;
    const current = this.getSnapshot();
    const target = this.history.future.pop();
    // Move current to past for another undo step
    this.history.past.push(current);
    if (this.history.past.length > this.history.limit) {
      this.history.past.shift();
    }
    this.restoreSnapshot(target);
  }

  prepareSvg() {
    this.svg.setAttribute("data-editor", "score");
    this.svg.setAttribute("tabindex", "0");
    let shapesLayer = this.svg.querySelector('[data-layer="shapes"]');
    if (!shapesLayer) {
      shapesLayer = createSvgElement("g", { "data-layer": "shapes" });
      this.svg.appendChild(shapesLayer);
    }
    this.shapesLayer = shapesLayer;
    this.shapeStore = new SvgShapeStore(this.shapesLayer, this.view);
      this.updateCameraTransform();
  }

  updateCameraTransform() {
    if (!this.shapesLayer) return;
    const transform = `translate(${this.camera.x}, ${this.camera.y}) scale(${this.camera.zoom})`;
    this.shapesLayer.setAttribute('transform', transform);
  
    // Update grid if visible
    if (this.state.gridMode !== 'off') {
      this.renderGrid();
    }
    
    // Dispatch camera change event for canvas layers
    const event = new CustomEvent('mediamime:camera-changed', {
      detail: { camera: { ...this.camera } },
      bubbles: true
    });
    window.dispatchEvent(event);
  }  bindToolbar() {
    this.toolbar.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", (event) => {
        const tool = button.dataset.tool;
        const lockToggle = event.detail === 0 && (event.metaKey || event.ctrlKey);
        this.setTool(tool, { toggleLock: lockToggle });
      });
    });
    if (this.lockButton) {
      this.lockButton.addEventListener("click", () => this.toggleToolLock());
    }
    if (this.modeToggle) {
      this.modeToggle.addEventListener("click", () => {
        this.toggleMode();
      });
    }
    if (this.clearButton) {
      this.clearButton.addEventListener("click", () => this.clearShapes());
    }
  }

  bindCanvas() {
    this.svg.addEventListener("pointerdown", this.handlePointerDown);
    this.svg.addEventListener("pointermove", this.handlePointerMove);
    this.svg.addEventListener("pointerup", this.handlePointerUp);
    this.svg.addEventListener("pointercancel", this.handlePointerCancel);
    this.svg.addEventListener("keydown", this.handleKeyDown);
    this.svg.addEventListener("wheel", this.handleWheel, { passive: false });
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  handleToolShortcut(tool, key) {
    const now = performance.now ? performance.now() : Date.now();
    const DOUBLE_TAP_MS = 350;
    let toggleLock = false;
    if (this.lastToolKey === key && now - this.lastToolKeyTime <= DOUBLE_TAP_MS) {
      toggleLock = true;
      this.lastToolKey = null;
      this.lastToolKeyTime = 0;
    } else {
      this.lastToolKey = key;
      this.lastToolKeyTime = now;
    }
    this.setTool(tool, { toggleLock });
  }

  setTool(tool, { toggleLock = false } = {}) {
    if (!tool || tool === this.state.tool) {
      if (toggleLock) {
        this.state.toolLocked = !this.state.toolLocked;
      }
      this.updateToolbar();
      return;
    }
    if (toggleLock) {
      this.state.toolLocked = !this.state.toolLocked;
    } else if (!AUTO_REVERT_TOOLS.has(tool)) {
      this.state.toolLocked = false;
    }
    this.state.tool = tool;
    if (tool !== "line") {
      this.pendingLine = null;
    }
    this.updateToolbar();
  }

  updateToolbar() {
    const isPerforming = this.state.mode === "perform";
    this.toolbar.querySelectorAll("[data-tool]").forEach((button) => {
      const tool = button.dataset.tool;
      button.classList.toggle("is-active", tool === this.state.tool);
      button.disabled = isPerforming;
    });
    this.toolbar.classList.toggle("is-tool-locked", Boolean(this.state.toolLocked));
    this.toolbar.classList.toggle("is-performing", isPerforming);
    if (this.lockButton) {
      const locked = Boolean(this.state.toolLocked);
      this.lockButton.classList.toggle("is-locked", locked);
      const icon = this.lockButton.querySelector(".material-icons-outlined");
      if (icon) {
        icon.textContent = locked ? "lock" : "lock_open";
      }
      this.lockButton.setAttribute("aria-pressed", locked ? "true" : "false");
      this.lockButton.disabled = isPerforming;
    }
    if (this.modeToggle) {
      this.modeToggle.disabled = false;
    }
    if (this.clearButton) {
      this.clearButton.disabled = isPerforming;
    }
  }

  updateModeUI() {
    this.root.classList.toggle("is-performing", this.state.mode === "perform");
    if (this.modeToggle) {
      const icon = this.modeToggle.querySelector(".material-icons-outlined");
      if (icon) {
        icon.textContent = this.state.mode === "perform" ? "draw" : "play_circle";
      }
      this.modeToggle.setAttribute("aria-pressed", this.state.mode === "perform" ? "true" : "false");
    }
    this.updateToolbar();
  }

  setMode(mode) {
    if (mode !== "edit" && mode !== "perform") return;
    if (this.state.mode === mode) return;
    if (mode === "perform" && this.session) {
      switch (this.session.type) {
        case "draw":
          this.abortDrawing();
          break;
        case "shape-drag":
          this.cancelShapeDrag();
          break;
        case "erase":
          if (!this.state.toolLocked) {
            this.setTool("select");
          }
          break;
        default:
          break;
      }
      this.session = null;
    }
    this.state.mode = mode;
    if (mode === "perform") {
      this.pendingLine = null;
    }
    this.updateModeUI();
    this.render();
    const modeEvent = new CustomEvent('mediamime:editor-mode-changed', {
      detail: { mode },
      bubbles: false
    });
    window.dispatchEvent(modeEvent);
  }

  toggleMode() {
    this.setMode(this.state.mode === "edit" ? "perform" : "edit");
  }


  eraseAtPoint(point, { tolerance = ERASER_TOLERANCE, skip = null } = {}) {
    const hit = this.findShapeAtPoint(point, { tolerance, skip });
    if (!hit) return null;
    this.removeShape(hit.id);
    this.render();
    this.notifyShapesChanged();
    this.notifySelectionChanged();
    // Do not commit here to avoid spamming during drag; commit on pointerup if any erased
    return hit.id;
  }

  findShapeAtPoint(point, { tolerance = ERASER_TOLERANCE, skip = null } = {}) {
    const store = this.shapeStore;
    if (!store) return null;
    const order = store.order;
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      if (skip && skip.has(id)) continue;
      const shape = store.read(id);
      if (!shape) continue;
      if (shapeContainsPoint(shape, point, tolerance)) {
        return { id, shape };
      }
    }
    return null;
  }

  clearShapes() {
    if (!this.shapeStore || !this.shapeStore.order.length) return;
    this.shapeStore.clear();
    this.state.selectedShapeIds.clear();
    this.pendingLine = null;
    this.render();
    this.notifyShapesChanged();
    this.notifySelectionChanged();
    this.commitHistory("clear");
  }

  // New: programmatically add a shape
  addShape(shape, options = {}) {
    if (!shape || !this.shapeStore) return null;
    const normalized = this.normalizeImportedShape(shape);
    if (!normalized) return null;
    // Avoid id collisions when appending
    if (normalized.id && this.shapeStore.nodes?.has?.(normalized.id)) {
      normalized.id = createId();
    }
    this.shapeStore.write(normalized);
    this.renderShapes();
    this.notifyShapesChanged();
    if (!options?.skipHistory) {
      this.commitHistory("addShape");
    }
    return normalized.id;
  }

  // New: replace all shapes with provided list
  replaceShapes(shapes) {
    if (!this.shapeStore) return;
    const list = Array.isArray(shapes) ? shapes : [];
    this.shapeStore.clear();
    list.forEach((shape) => {
      const normalized = this.normalizeImportedShape(shape);
      if (normalized) this.shapeStore.write(normalized);
    });
    this.state.selectedShapeIds.clear();
    this.pendingLine = null;
    this.render();
    this.notifyShapesChanged();
    this.notifySelectionChanged();
    this.commitHistory("replaceShapes");
  }

  // Normalise incoming shapes from JSON imports
  normalizeImportedShape(shape) {
    if (!shape || typeof shape !== "object") return null;
    const id = typeof shape.id === "string" && shape.id.trim() ? shape.id.trim() : createId();
    const name = typeof shape.name === "string" ? shape.name : "";
    const interaction = shape.interaction && typeof shape.interaction === "object"
      ? JSON.parse(JSON.stringify(shape.interaction))
      : null;
    const style = { ...(shape.style || {}) };
    if (shape.type === "rect" || shape.type === "ellipse") {
      const x = Number(shape.x) || 0;
      const y = Number(shape.y) || 0;
      const width = Number(shape.width) || 0;
      const height = Number(shape.height) || 0;
      const rotation = Number(shape.rotation) || 0;
      return { id, name, interaction, type: shape.type, x, y, width, height, rotation, style };
    }
    if (shape.type === "line" || shape.type === "path") {
      const points = Array.isArray(shape.points) ? shape.points.map((p) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 })) : [];
      const closed = Boolean(shape.closed);
      const rotation = Number(shape.rotation) || 0;
      return { id, name, interaction, type: shape.type, points, closed, rotation, style };
    }
    // Fallback to rect if type is unknown
    return { id, name, interaction, type: "rect", x: 0, y: 0, width: 0, height: 0, rotation: 0, style };
  }

  toggleToolLock() {
    this.state.toolLocked = !this.state.toolLocked;
    this.updateToolbar();
  }

  toggleToolbarVisibility() {
    this.toolbarHidden = !this.toolbarHidden;
    if (this.toolbarHidden) {
      this.toolbar.style.display = "none";
    } else {
      this.toolbar.style.display = "";
    }
  }

  handlePointerDown = (event) => {
    if (event.button !== 0) return;
    if (this.state.mode === "perform") return;
    const rawPoint = this.getNormalizedPoint(event, { clamp: false });
    if (!rawPoint) return;
    // Use un-clamped world coords so canvas is effectively infinite
    const point = { x: rawPoint.x, y: rawPoint.y };
    
    // Spacebar + drag for pan override (any tool)
    if (event.type === 'pointerdown' && this.spacebarPressed) {
      this.svg.setPointerCapture(event.pointerId);
      this.session = {
        type: "pan",
        pointerId: event.pointerId,
        startCamera: { ...this.camera },
        startClient: { x: event.clientX, y: event.clientY }
      };
      event.preventDefault();
      return;
    }
    
    const tool = this.state.tool;
    const target = event.target;
    const shapeId = target?.closest?.("[data-shape-id]")?.dataset?.shapeId || null;
  const resizeHandle = target?.closest?.('.selection-frame [data-handle]');
  const rotateHandle = target?.closest?.('.selection-frame [data-rotate]');
  const curveEditHandle = target?.closest?.('.curve-edit-handle');

    // If in curve-edit mode, handle control point dragging
    if (this.state.curveEditShapeId) {
      if (curveEditHandle) {
        const pointIndex = parseInt(curveEditHandle.getAttribute('data-point-index'), 10);
        
        // Alt/Opt-click on control point to remove it
        if (event.altKey) {
          this.removeCurvePoint(pointIndex);
          event.preventDefault();
          return;
        }
        
        // Normal click to drag (Shift for grid snap, Cmd for element snap work fine)
        this.startCurvePointDrag({
          pointerId: event.pointerId,
          pointIndex,
          origin: point,
          originRaw: rawPoint
        });
        event.preventDefault();
        return;
      }
      
      // Click on the shape to add a point (allow modifiers for snap)
      if (shapeId === this.state.curveEditShapeId) {
        this.addCurvePoint(point);
        event.preventDefault();
        return;
      }
      
      // Click outside control points exits curve-edit mode
      if (!shapeId || shapeId !== this.state.curveEditShapeId) {
        this.exitCurveEdit();
        event.preventDefault();
        return; // Exit early after leaving curve-edit mode
      }
    }

    // Always allow rotation handle to start rotation, regardless of current tool
    if (rotateHandle) {
      const bounds = this.getCurrentSelectionBounds();
      if (bounds) {
        const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        this.startSelectionRotate({
          pointerId: event.pointerId,
          origin: point,
          originRaw: rawPoint,
          center
        });
        // Switch to select tool during rotation gesture for consistency
        if (this.state.tool !== 'select') this.setTool('select');
        event.preventDefault();
        return;
      }
    }

    if (tool === "select") {
      // If clicking a selection handle, start scaling
      if (resizeHandle) {
        const handleId = resizeHandle.getAttribute('data-handle');
        const bounds = this.getCurrentSelectionBounds();
        if (bounds) {
          let anchor = null;
          let initialHandle = null;
          const minX = bounds.x, minY = bounds.y, maxX = bounds.x + bounds.width, maxY = bounds.y + bounds.height;
          switch (handleId) {
            case 'tl':
              anchor = { x: maxX, y: maxY };
              initialHandle = { x: minX, y: minY };
              break;
            case 'tr':
              anchor = { x: minX, y: maxY };
              initialHandle = { x: maxX, y: minY };
              break;
            case 'br':
              anchor = { x: minX, y: minY };
              initialHandle = { x: maxX, y: maxY };
              break;
            case 'bl':
              anchor = { x: maxX, y: minY };
              initialHandle = { x: minX, y: maxY };
              break;
            default:
              break;
          }
          if (anchor && initialHandle) {
            this.startSelectionScale({
              pointerId: event.pointerId,
              origin: point,
              originRaw: rawPoint,
              anchor,
              initialHandle
            });
            event.preventDefault();
            return;
          }
        }
      }
      if (shapeId) {
        const shape = this.shapeStore?.read(shapeId);
        if (!shape) return;
        
        // Cmd/Ctrl+click on line/path to enter curve-edit mode
        if ((event.metaKey || event.ctrlKey) && (shape.type === 'line' || shape.type === 'path')) {
          this.enterCurveEdit(shapeId);
          event.preventDefault();
          return;
        }
        
        if (event.altKey) {
          if (!this.state.selectedShapeIds.has(shapeId)) {
            this.state.selectedShapeIds.clear();
            this.state.selectedShapeIds.add(shapeId);
            this.render();
            this.notifySelectionChanged();
          }
          this.emit("shapealtclick", { shapeId, originalEvent: event });
          event.preventDefault();
          return;
        }
        
        // Shift-click for multi-select
        if (event.shiftKey) {
          this.selectShape(shapeId, { toggle: true });
          event.preventDefault();
          return;
        }
        
        // Normal click - select single shape and start drag
        if (!this.state.selectedShapeIds.has(shapeId)) {
          this.selectShape(shapeId);
        }
        this.startShapeDrag({
          shapeId,
          pointerId: event.pointerId,
          origin: point,
          originRaw: rawPoint
        });
        event.preventDefault();
      } else {
        // Click is not on a shape. If inside current selection bounds, start selection drag.
        const bounds = this.getCurrentSelectionBounds();
        const insideSelection = bounds && point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
        if (insideSelection) {
          this.startSelectionDrag({
            pointerId: event.pointerId,
            origin: point,
            originRaw: rawPoint
          });
          event.preventDefault();
          return;
        }

  // Otherwise start box selection
        if (!event.shiftKey) {
          // Clear selection if no shift key
          if (this.state.selectedShapeIds.size > 0) {
            this.state.selectedShapeIds.clear();
            this.render();
            this.notifySelectionChanged();
          }
        }
        this.svg.setPointerCapture(event.pointerId);
        this.session = {
          type: "box-select",
          pointerId: event.pointerId,
          start: rawPoint,
          end: rawPoint,
          shiftKey: event.shiftKey
        };
        this.renderBoxSelection();
        event.preventDefault();
      }
      return;
    }

    if (tool === "hand") {
      // Pan with hand tool
      this.svg.setPointerCapture(event.pointerId);
      this.session = {
        type: "pan",
        pointerId: event.pointerId,
        startCamera: { ...this.camera },
        startClient: { x: event.clientX, y: event.clientY }
      };
      event.preventDefault();
      return;
    }

    if (tool === "eraser") {
      this.svg.setPointerCapture(event.pointerId);
      const removed = this.eraseAtPoint(point, { tolerance: ERASER_TOLERANCE });
      this.session = {
        type: "erase",
        pointerId: event.pointerId,
        erased: removed ? new Set([removed]) : new Set()
      };
      return;
    }

    if (DRAWING_TOOLS.has(tool)) {
      event.preventDefault();
      this.beginDrawing(tool, point, event.pointerId);
    }
  };

  handlePointerMove = (event) => {
    if (this.session && event.pointerId !== this.session.pointerId) return;
    const rawPoint = this.getNormalizedPoint(event, { clamp: false });
    if (!rawPoint) return;
    let point = { x: rawPoint.x, y: rawPoint.y };
    
    // Apply snapping based on modifier keys
    const snapToGrid = event.shiftKey;
    const snapToElement = event.metaKey || event.ctrlKey;
    if (snapToGrid || snapToElement) {
      const snapped = this.applySnapping(point, { snapToGrid, snapToElement });
      // Show snap indicator if point was actually snapped
      if (snapped.x !== point.x || snapped.y !== point.y) {
        this.showSnapIndicator(snapped);
      }
      point = snapped;
    } else {
      this.hideSnapIndicator();
    }

    if (!this.session) return;
    switch (this.session.type) {
      case "draw":
        event.preventDefault();
        this.updateDrawing(point);
        break;
      case "curve-point-drag": {
        event.preventDefault();
        this.updateCurvePointDrag(this.session, point);
        break;
      }
      case "shape-drag": {
        event.preventDefault();
        const dx = (rawPoint?.x ?? point.x) - this.session.originRaw.x;
        const dy = (rawPoint?.y ?? point.y) - this.session.originRaw.y;
        this.updateShapeDrag(this.session, dx, dy);
        break;
      }
      case "selection-drag": {
        event.preventDefault();
        const dx = (rawPoint?.x ?? point.x) - this.session.originRaw.x;
        const dy = (rawPoint?.y ?? point.y) - this.session.originRaw.y;
        this.updateSelectionDrag(this.session, dx, dy);
        break;
      }
      case "selection-scale": {
        event.preventDefault();
        this.updateSelectionScale(this.session, point);
        break;
      }
      case "selection-rotate": {
        event.preventDefault();
        this.updateSelectionRotate(this.session, point, rawPoint);
        break;
      }
      case "box-select": {
        event.preventDefault();
        this.session.end = rawPoint;
        this.renderBoxSelection();
        break;
      }
        case "pan": {
          event.preventDefault();
          const dx = event.clientX - this.session.startClient.x;
          const dy = event.clientY - this.session.startClient.y;
          this.camera.x = this.session.startCamera.x + dx;
          this.camera.y = this.session.startCamera.y + dy;
          this.updateCameraTransform();
          break;
        }
      case "erase": {
        event.preventDefault();
        const erasedId = this.eraseAtPoint(point, { tolerance: ERASER_TOLERANCE, skip: this.session.erased });
        if (erasedId) {
          this.session.erased.add(erasedId);
        }
        break;
      }
      default:
        break;
    }
  };

  handlePointerUp = (event) => {
    // Hide snap indicator on pointer up
    this.hideSnapIndicator();
    
    if (this.session && event.pointerId === this.session.pointerId) {
      switch (this.session.type) {
        case "draw":
          this.finalizeDrawing(event);
          break;
        case "curve-point-drag":
          this.finishCurvePointDrag();
          break;
        case "shape-drag":
          this.finishShapeDrag();
          break;
        case "selection-drag":
          this.finishSelectionDrag();
          break;
        case "selection-scale":
          this.finishSelectionScale();
          break;
        case "selection-rotate":
          this.finishSelectionRotate();
          break;
        case "box-select":
          this.finishBoxSelection();
          break;
        case "erase":
          // Commit a history entry if anything was erased during this gesture
          if (this.session?.erased && this.session.erased.size > 0) {
            this.commitHistory("erase");
          }
          if (!this.state.toolLocked) {
            this.setTool("select");
          }
          break;
        default:
          break;
      }
      this.session = null;
    }
    if (this.svg.hasPointerCapture(event.pointerId)) {
      this.svg.releasePointerCapture(event.pointerId);
    }
  };

  handlePointerCancel = (event) => {
    if (this.session && event.pointerId === this.session.pointerId) {
      switch (this.session.type) {
        case "draw":
          this.abortDrawing();
          break;
        case "curve-point-drag":
          this.cancelCurvePointDrag();
          break;
        case "shape-drag":
          this.cancelShapeDrag();
          break;
        case "selection-drag":
          this.cancelSelectionDrag();
          break;
        case "selection-scale":
          this.cancelSelectionScale();
          break;
        case "selection-rotate":
          this.cancelSelectionRotate();
          break;
        case "box-select":
          this.cancelBoxSelection();
          break;
        case "erase":
          if (!this.state.toolLocked) {
            this.setTool("select");
          }
          break;
        default:
          break;
      }
      this.session = null;
    }
    if (this.svg.hasPointerCapture(event.pointerId)) {
      this.svg.releasePointerCapture(event.pointerId);
    }
  };

    handleWheel = (event) => {
      // Only zoom when not in perform mode
      if (this.state.mode === "perform") return;
    
      event.preventDefault();
    
      const delta = -event.deltaY;
      const zoomFactor = delta > 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.1, Math.min(10, this.camera.zoom * zoomFactor));
    
      // Zoom toward cursor position
      const point = this.svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const ctm = this.svg.getScreenCTM();
      if (ctm) {
        const mapped = point.matrixTransform(ctm.inverse());
        const worldBeforeX = (mapped.x - this.camera.x) / this.camera.zoom;
        const worldBeforeY = (mapped.y - this.camera.y) / this.camera.zoom;
      
        this.camera.zoom = newZoom;
      
        const worldAfterX = (mapped.x - this.camera.x) / this.camera.zoom;
        const worldAfterY = (mapped.y - this.camera.y) / this.camera.zoom;
      
        this.camera.x += (worldAfterX - worldBeforeX) * this.camera.zoom;
        this.camera.y += (worldAfterY - worldBeforeY) * this.camera.zoom;
      
        this.updateCameraTransform();
      }
    };

  startShapeDrag({ shapeId, pointerId, origin, originRaw }) {
    const shape = this.shapeStore?.read(shapeId);
    if (!shape) return;
    const baseShape = cloneShape(shape);
    this.svg.setPointerCapture(pointerId);
    this.session = {
      type: "shape-drag",
      pointerId,
      shapeId,
      origin: { ...origin },
      originRaw: originRaw ? { ...originRaw } : { ...origin },
      baseShape
    };
  }

  startSelectionDrag({ pointerId, origin, originRaw }) {
    const ids = Array.from(this.state.selectedShapeIds);
    if (!ids.length) return;
    const baseMap = new Map();
    ids.forEach((id) => {
      const shape = this.shapeStore?.read(id);
      if (shape) baseMap.set(id, cloneShape(shape));
    });
    if (!baseMap.size) return;
    this.svg.setPointerCapture(pointerId);
    this.session = {
      type: "selection-drag",
      pointerId,
      origin: { ...origin },
      originRaw: { ...originRaw },
      baseShapes: baseMap
    };
  }

  startSelectionScale({ pointerId, origin, originRaw, anchor, initialHandle }) {
    const ids = Array.from(this.state.selectedShapeIds);
    if (!ids.length) return;
    const baseMap = new Map();
    ids.forEach((id) => {
      const shape = this.shapeStore?.read(id);
      if (shape) baseMap.set(id, cloneShape(shape));
    });
    if (!baseMap.size) return;
    this.svg.setPointerCapture(pointerId);
    this.session = {
      type: "selection-scale",
      pointerId,
      origin: { ...origin },
      originRaw: { ...originRaw },
      baseShapes: baseMap,
      anchor: { ...anchor },
      initialHandle: { ...initialHandle }
    };
  }

  startSelectionRotate({ pointerId, origin, originRaw, center }) {
    const ids = Array.from(this.state.selectedShapeIds);
    if (!ids.length) return;
    const baseShapes = new Map();
    ids.forEach((id) => {
      const shape = this.shapeStore?.read(id);
      if (shape) baseShapes.set(id, cloneShape(shape));
    });
    if (!baseShapes.size) return;
    this.svg.setPointerCapture(pointerId);
    let baseSelectionRotation = 0;
    if (ids.length === 1) {
      const only = baseShapes.get(ids[0]);
      if (only && (only.type === 'rect' || only.type === 'ellipse')) {
        baseSelectionRotation = Number(only.rotation) || 0;
      }
    }
    const normOrigin = originRaw ?? origin;
    const centerPx = {
      x: center.x * this.view.width,
      y: center.y * this.view.height
    };
    const originPx = {
      x: (normOrigin?.x ?? origin.x) * this.view.width,
      y: (normOrigin?.y ?? origin.y) * this.view.height
    };
    const startAngle = Math.atan2(originPx.y - centerPx.y, originPx.x - centerPx.x);
    this.session = {
      type: 'selection-rotate',
      pointerId,
      origin: { ...origin },
      originRaw: originRaw ? { ...originRaw } : { ...origin },
      center: { ...center },
      centerPx,
      baseShapes,
      baseSelectionRotation,
      startAngle,
      deltaAngle: 0
    };
  }

  updateSelectionScale(session, point) {
    if (!session || session.type !== "selection-scale") return;
    const { baseShapes, anchor, initialHandle } = session;
    if (!baseShapes || !anchor || !initialHandle) return;
    const v0x = initialHandle.x - anchor.x;
    const v0y = initialHandle.y - anchor.y;
    // Guard against zero-size initial bounds
    const minScale = 0.05;
    const vx = point.x - anchor.x;
    const vy = point.y - anchor.y;
    let sx = v0x !== 0 ? vx / v0x : 1;
    let sy = v0y !== 0 ? vy / v0y : 1;
    // Prevent collapsing to zero or flipping for now (can allow flipping later)
    sx = Math.sign(sx) * Math.max(minScale, Math.abs(sx));
    sy = Math.sign(sy) * Math.max(minScale, Math.abs(sy));

    baseShapes.forEach((base, id) => {
      const next = cloneShape(base);
      if (next.type === "rect" || next.type === "ellipse") {
        next.x = anchor.x + (base.x - anchor.x) * sx;
        next.y = anchor.y + (base.y - anchor.y) * sy;
        next.width = Math.max(MIN_SHAPE_DIMENSION, base.width * Math.abs(sx));
        next.height = Math.max(MIN_SHAPE_DIMENSION, base.height * Math.abs(sy));
      } else if (next.type === "line" || next.type === "path") {
        next.points = base.points.map((p) => ({
          x: anchor.x + (p.x - anchor.x) * sx,
          y: anchor.y + (p.y - anchor.y) * sy
        }));
      }
      this.shapeStore?.write(next);
    });
    this.renderShapes();
  }

  updateSelectionRotate(session, point, rawPoint) {
    if (!session || session.type !== 'selection-rotate') return;
    const { center, centerPx, startAngle, baseShapes } = session;
    if (!center || !centerPx || !baseShapes) return;
    const normPoint = rawPoint ?? point;
    if (!normPoint) return;
    const pointerPx = {
      x: normPoint.x * this.view.width,
      y: normPoint.y * this.view.height
    };
    const currentAngle = Math.atan2(pointerPx.y - centerPx.y, pointerPx.x - centerPx.x);
    const delta = currentAngle - startAngle;
    session.deltaAngle = delta;
    baseShapes.forEach((base, id) => {
      const next = cloneShape(base);
      if (next.type === 'rect' || next.type === 'ellipse') {
        const width = next.width || 0;
        const height = next.height || 0;
        const baseCxPx = (base.x + width / 2) * this.view.width;
        const baseCyPx = (base.y + height / 2) * this.view.height;
        const rotatedPx = rotateAround({ x: baseCxPx, y: baseCyPx }, centerPx, delta);
        const newCenter = {
          x: rotatedPx.x / this.view.width,
          y: rotatedPx.y / this.view.height
        };
        next.x = newCenter.x - width / 2;
        next.y = newCenter.y - height / 2;
        next.rotation = (Number(base.rotation) || 0) + delta;
      } else if (next.type === 'line' || next.type === 'path') {
        next.points = base.points.map((p) => {
          const rotatedPx = rotateAround({
            x: p.x * this.view.width,
            y: p.y * this.view.height
          }, centerPx, delta);
          return {
            x: rotatedPx.x / this.view.width,
            y: rotatedPx.y / this.view.height
          };
        });
      }
      this.shapeStore?.write(next);
    });
    this.renderShapes();
  }

  finishSelectionScale() {
    if (!this.session || this.session.type !== "selection-scale") return;
    this.notifyShapesChanged();
    // Commit history at the end of a scale gesture
    this.commitHistory("scale-selection");
  }

  finishSelectionRotate() {
    if (!this.session || this.session.type !== 'selection-rotate') return;
    this.notifyShapesChanged();
    this.commitHistory('rotate-selection');
  }

  cancelSelectionScale() {
    if (!this.session || this.session.type !== "selection-scale") return;
    const baseMap = this.session.baseShapes;
    if (baseMap) {
      baseMap.forEach((shape) => this.shapeStore?.write(cloneShape(shape)));
      this.renderShapes();
    }
  }

  cancelSelectionRotate() {
    if (!this.session || this.session.type !== 'selection-rotate') return;
    const baseMap = this.session.baseShapes;
    if (baseMap) {
      baseMap.forEach((shape) => this.shapeStore?.write(cloneShape(shape)));
      this.renderShapes();
    }
  }

  updateSelectionDrag(session, dx, dy) {
    if (!session || session.type !== "selection-drag") return;
    const baseMap = session.baseShapes;
    if (!baseMap) return;
    baseMap.forEach((base, id) => {
      const next = cloneShape(base);
      if (next.type === "rect" || next.type === "ellipse") {
        next.x = base.x + dx;
        next.y = base.y + dy;
      } else if (next.type === "line" || next.type === "path") {
        next.points = base.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
      this.shapeStore?.write(next);
    });
    this.renderShapes();
  }

  finishSelectionDrag() {
    if (!this.session || this.session.type !== "selection-drag") return;
    this.notifyShapesChanged();
    // Commit history at the end of a move gesture
    this.commitHistory("move-selection");
  }

  cancelSelectionDrag() {
    if (!this.session || this.session.type !== "selection-drag") return;
    const baseMap = this.session.baseShapes;
    if (baseMap) {
      baseMap.forEach((shape) => this.shapeStore?.write(cloneShape(shape)));
      this.renderShapes();
    }
  }

  getCurrentSelectionBounds() {
    const ids = Array.from(this.state.selectedShapeIds);
    if (!ids.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ids.forEach((id) => {
      const shape = this.shapeStore?.read(id);
      if (!shape) return;
      const b = this.getShapeBounds(shape);
      if (!b) return;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });
    if (minX === Infinity) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  updateShapeDrag(session, dx, dy) {
    if (!session?.baseShape) return;
    const base = session.baseShape;
    const next = cloneShape(base);
    if (next.type === "rect" || next.type === "ellipse") {
      next.x = base.x + dx;
      next.y = base.y + dy;
    } else if (next.type === "line" || next.type === "path") {
      next.points = base.points.map((point) => ({
        x: point.x + dx,
        y: point.y + dy
      }));
    }
    this.shapeStore?.write(next);
    this.renderShapes();
  }

  finishShapeDrag() {
    if (!this.session || this.session.type !== "shape-drag") return;
    this.notifyShapesChanged();
    // Commit history for single-shape move
    this.commitHistory("move-shape");
  }

  cancelShapeDrag() {
    if (!this.session || this.session.type !== "shape-drag") return;
    if (this.session.baseShape) {
      this.shapeStore?.write(cloneShape(this.session.baseShape));
      this.renderShapes();
    }
  }

  // ===== Curve Edit Mode =====
  enterCurveEdit(shapeId) {
    const shape = this.shapeStore?.read(shapeId);
    if (!shape || (shape.type !== 'line' && shape.type !== 'path')) return;
    
    // Exit any existing curve edit
    if (this.state.curveEditShapeId) {
      this.exitCurveEdit();
    }
    
    // Clear regular selection and enter curve-edit mode
    this.state.selectedShapeIds.clear();
    this.state.curveEditShapeId = shapeId;
    this.state.curveEditPoints = (shape.points || []).map((pt, i) => ({
      index: i,
      x: pt.x,
      y: pt.y
    }));
    
    this.render();
    this.notifySelectionChanged();
  }

  exitCurveEdit() {
    if (!this.state.curveEditShapeId) return;
    
    const shapeId = this.state.curveEditShapeId;
    const shape = this.shapeStore?.read(shapeId);
    
    // Auto-detect closed curve: if first and last points are the same, mark as closed
    if (shape && shape.points && shape.points.length >= 3) {
      const first = shape.points[0];
      const last = shape.points[shape.points.length - 1];
      const distance = Math.hypot(last.x - first.x, last.y - first.y);
      
      if (distance < 0.001) { // Very close threshold (normalized units)
        shape.closed = true;
        this.shapeStore?.write(shape);
      }
    }
    
    this.state.curveEditShapeId = null;
    this.state.curveEditPoints = [];
    
    // Re-select the shape after exiting curve edit
    this.state.selectedShapeIds.clear();
    this.state.selectedShapeIds.add(shapeId);
    
    this.render();
    this.notifySelectionChanged();
    this.notifyShapesChanged();
    this.commitHistory('edit-curve');
  }

  startCurvePointDrag({ pointerId, pointIndex, origin, originRaw }) {
    if (!this.state.curveEditShapeId) return;
    const shape = this.shapeStore?.read(this.state.curveEditShapeId);
    if (!shape) return;
    
    this.svg.setPointerCapture(pointerId);
    this.session = {
      type: 'curve-point-drag',
      pointerId,
      shapeId: this.state.curveEditShapeId,
      pointIndex,
      origin: { ...origin },
      originRaw: originRaw ? { ...originRaw } : { ...origin },
      baseShape: cloneShape(shape)
    };
  }

  updateCurvePointDrag(session, point) {
    if (!session || session.type !== 'curve-point-drag') return;
    const shape = this.shapeStore?.read(session.shapeId);
    if (!shape || !shape.points || session.pointIndex >= shape.points.length) return;
    
    // Update the point
    shape.points[session.pointIndex] = {
      x: point.x,
      y: point.y
    };
    
    // Update the curve edit points state
    if (this.state.curveEditShapeId === session.shapeId) {
      this.state.curveEditPoints[session.pointIndex] = {
        index: session.pointIndex,
        x: shape.points[session.pointIndex].x,
        y: shape.points[session.pointIndex].y
      };
    }
    
    this.shapeStore?.write(shape);
    this.renderShapes();
  }

  finishCurvePointDrag() {
    if (!this.session || this.session.type !== 'curve-point-drag') return;
    // Point updates already applied during drag
    // No commit here; will commit when exiting curve-edit mode
  }

  cancelCurvePointDrag() {
    if (!this.session || this.session.type !== 'curve-point-drag') return;
    if (this.session.baseShape) {
      this.shapeStore?.write(cloneShape(this.session.baseShape));
      // Restore curve edit points
      if (this.state.curveEditShapeId === this.session.shapeId) {
        const shape = this.session.baseShape;
        this.state.curveEditPoints = (shape.points || []).map((pt, i) => ({
          index: i,
          x: pt.x,
          y: pt.y
        }));
      }
      this.renderShapes();
    }
  }

  addCurvePoint(clickPoint) {
    if (!this.state.curveEditShapeId) return;
    const shape = this.shapeStore?.read(this.state.curveEditShapeId);
    if (!shape || !shape.points || shape.points.length < 2) return;
    
    // Find the closest segment to insert the point
    let closestSegment = 0;
    let minDist = Infinity;
    
    for (let i = 0; i < shape.points.length - 1; i++) {
      const a = shape.points[i];
      const b = shape.points[i + 1];
      const dist = getSqSegDist(clickPoint, a, b);
      if (dist < minDist) {
        minDist = dist;
        closestSegment = i;
      }
    }
    
    // If closed, also check the segment from last to first
    if (shape.closed && shape.points.length > 2) {
      const a = shape.points[shape.points.length - 1];
      const b = shape.points[0];
      const dist = getSqSegDist(clickPoint, a, b);
      if (dist < minDist) {
        closestSegment = shape.points.length - 1;
      }
    }
    
    // Insert the new point after closestSegment
    const newPoint = {
      x: clickPoint.x,
      y: clickPoint.y
    };
    
    shape.points.splice(closestSegment + 1, 0, newPoint);
    
    // Update state
    this.state.curveEditPoints = shape.points.map((pt, i) => ({
      index: i,
      x: pt.x,
      y: pt.y
    }));
    
    this.shapeStore?.write(shape);
    this.renderShapes();
  }

  removeCurvePoint(pointIndex) {
    if (!this.state.curveEditShapeId) return;
    const shape = this.shapeStore?.read(this.state.curveEditShapeId);
    if (!shape || !shape.points || shape.points.length <= 2) return; // Need at least 2 points
    
    // Remove the point
    shape.points.splice(pointIndex, 1);
    
    // Update state
    this.state.curveEditPoints = shape.points.map((pt, i) => ({
      index: i,
      x: pt.x,
      y: pt.y
    }));
    
    this.shapeStore?.write(shape);
    this.renderShapes();
  }

  renderBoxSelection() {
    if (!this.session || this.session.type !== "box-select") return;
    // Remove existing box
    const existingBox = this.svg.querySelector('.box-selection');
    if (existingBox) {
      existingBox.remove();
    }
    const { start, end } = this.session;
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);
    const rect = createSvgElement('rect', {
      class: 'box-selection',
      x: minX * this.view.width,
      y: minY * this.view.height,
      width: (maxX - minX) * this.view.width,
      height: (maxY - minY) * this.view.height,
      fill: '#ffffff',
      'fill-opacity': '0.12',
      stroke: '#ffffff',
      'stroke-opacity': '0.8',
      'stroke-width': '1',
      'stroke-dasharray': '6,6',
      'pointer-events': 'none'
    });
    // Append within shapes layer so it follows camera transform
    this.shapesLayer.appendChild(rect);
  }

  finishBoxSelection() {
    if (!this.session || this.session.type !== "box-select") return;
    const { start, end, shiftKey } = this.session;
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);
    // Find all shapes that intersect with the box
    const selectedIds = [];
    if (this.shapeStore) {
      for (const shapeId of this.shapeStore.order) {
        const shape = this.shapeStore.read(shapeId);
        if (!shape) continue;
        const bounds = this.getShapeBounds(shape);
        if (!bounds) continue;
        // Check if shape bounds intersect with selection box
        const shapeMinX = bounds.x;
        const shapeMinY = bounds.y;
        const shapeMaxX = bounds.x + bounds.width;
        const shapeMaxY = bounds.y + bounds.height;
        const intersects = !(shapeMaxX < minX || shapeMinX > maxX || 
                            shapeMaxY < minY || shapeMinY > maxY);
        if (intersects) {
          selectedIds.push(shapeId);
        }
      }
    }
    // Update selection based on shift key
    if (shiftKey) {
      // Add to existing selection
      selectedIds.forEach(id => this.state.selectedShapeIds.add(id));
    } else {
      // Replace selection
      this.state.selectedShapeIds.clear();
      selectedIds.forEach(id => this.state.selectedShapeIds.add(id));
    }
    // Remove box visual
    const existingBox = this.svg.querySelector('.box-selection');
    if (existingBox) {
      existingBox.remove();
    }
    this.render();
    this.notifySelectionChanged();
  }

  cancelBoxSelection() {
    if (!this.session || this.session.type !== "box-select") return;
    // Remove box visual
    const existingBox = this.svg.querySelector('.box-selection');
    if (existingBox) {
      existingBox.remove();
    }
  }

  handleKeyDown = (event) => {
    if (event.defaultPrevented) return;
    const activeTag = document.activeElement?.tagName?.toLowerCase() || "";
    if (["input", "textarea", "select"].includes(activeTag)) return;
    const key = event.key.toLowerCase();
    
    // Track spacebar for pan override
    if (key === " " && !this.spacebarPressed) {
      this.spacebarPressed = true;
      this.svg.style.cursor = 'grab';
      event.preventDefault();
      return;
    }
    
    if (event.metaKey || event.ctrlKey) {
      if (key === "z") {
        // Undo / Redo
        event.preventDefault();
        if (event.shiftKey) this.redo(); else this.undo();
        return;
      }
      if (key === "e") {
        event.preventDefault();
        this.toggleToolbarVisibility();
        return;
      }
      if (key === "enter") {
        event.preventDefault();
        this.toggleMode();
        return;
      }
    }
    if (event.altKey) return;
    if (this.state.mode === "perform") {
      if (key === "v") {
        this.setMode("edit");
        event.preventDefault();
      }
      return;
    }
    switch (key) {
      case "delete": {
        // Forward Delete (fn+Backspace on macOS): delete current selection
        const selected = Array.from(this.state.selectedShapeIds);
        if (selected.length) {
          event.preventDefault();
          this.deleteSelection();
        }
        break;
      }
      case "v":
        this.handleToolShortcut("select", "v");
        event.preventDefault();
        break;
      case "h":
        this.handleToolShortcut("hand", "h");
        event.preventDefault();
        break;
      case "d":
        this.handleToolShortcut("freehand", "d");
        event.preventDefault();
        break;
      case "e":
        this.handleToolShortcut("eraser", "e");
        event.preventDefault();
        break;
      case "l":
        this.handleToolShortcut("line", "l");
        event.preventDefault();
        break;
      case "r":
        this.handleToolShortcut("rect", "r");
        event.preventDefault();
        break;
      case "o":
        this.handleToolShortcut("ellipse", "o");
        event.preventDefault();
        break;
      case "q":
        this.toggleToolLock();
        event.preventDefault();
        break;
        case "=":
        case "+":
          // Zoom in
          this.camera.zoom = Math.min(10, this.camera.zoom * 1.2);
          this.updateCameraTransform();
          event.preventDefault();
          break;
        case "-":
        case "_":
          // Zoom out
          this.camera.zoom = Math.max(0.1, this.camera.zoom / 1.2);
          this.updateCameraTransform();
          event.preventDefault();
          break;
        case "0":
          // Reset zoom
          this.camera.zoom = 1;
          this.camera.x = 0;
          this.camera.y = 0;
          this.updateCameraTransform();
          event.preventDefault();
          break;
        case "g":
          // Toggle grid: off -> line -> dot -> off
          if (this.state.gridMode === 'off') {
            this.state.gridMode = 'line';
          } else if (this.state.gridMode === 'line') {
            this.state.gridMode = 'dot';
          } else {
            this.state.gridMode = 'off';
          }
          this.renderGrid();
          event.preventDefault();
          break;
        case "f":
          // Frame selection (F) or frame all (Shift+F)
          if (event.shiftKey) {
            this.frameAll();
          } else {
            this.frameSelectionOrAll();
          }
          event.preventDefault();
          break;
      case "escape":
        if (this.state.curveEditShapeId) {
          this.exitCurveEdit();
          event.preventDefault();
        } else if (this.session?.type === "draw") {
          this.abortDrawing();
          this.session = null;
          event.preventDefault();
        } else if (this.state.selectedShapeIds.size > 0) {
          this.state.selectedShapeIds.clear();
          this.render();
          this.notifySelectionChanged();
          event.preventDefault();
        }
        break;
      default:
        break;
    }
  };

  handleKeyUp = (event) => {
    const key = event.key.toLowerCase();
    
    // Release spacebar pan override
    if (key === " " && this.spacebarPressed) {
      this.spacebarPressed = false;
      this.svg.style.cursor = '';
      event.preventDefault();
    }
  };

  deleteSelection() {
    if (!this.shapeStore) return;
    const ids = Array.from(this.state.selectedShapeIds);
    if (!ids.length) return;
    // Remove shapes without spamming events, then emit once
    ids.forEach((id) => {
      this.shapeStore.remove(id);
    });
    this.state.selectedShapeIds.clear();
    this.render();
    this.notifyShapesChanged();
    this.notifySelectionChanged();
    // Commit deletion as a single undoable action
    this.commitHistory("delete-selection");
  }

  beginDrawing(tool, point, pointerId) {
    this.svg.setPointerCapture(pointerId);
    if (tool === "line") {
      this.beginLineDrawing(point, pointerId);
      return;
    }
    const shape = createShape(tool, point, getCurrentStyle());
    this.shapeStore?.write(shape);
    this.renderShapes();
    this.session = {
      type: "draw",
      pointerId,
      tool,
      shape,
      origin: { ...point },
      lastPoint: { ...point }
    };
    if (!(this.state.toolLocked && DRAWING_TOOLS.has(tool))) {
      this.state.selectedShapeIds.clear();
      this.state.selectedShapeIds.add(shape.id);
      this.notifySelectionChanged();
    } else {
      this.state.selectedShapeIds.clear();
      this.notifySelectionChanged();
    }
  }

  beginLineDrawing(point, pointerId) {
    const store = this.shapeStore;
    if (!store) return;
    let continuing = Boolean(this.pendingLine?.shapeId);
    let shape = null;
    if (continuing) {
      const existing = store.read(this.pendingLine.shapeId);
      if (existing) {
        shape = cloneShape(existing);
        const last = shape.points[shape.points.length - 1] || { x: point.x, y: point.y };
        const start = {
          x: last.x,
          y: last.y
        };
        shape.points.push({ ...start });
      } else {
        continuing = false;
      }
    }
    if (!continuing || !shape) {
      shape = createShape("line", point, getCurrentStyle());
      shape.points[1] = { x: point.x, y: point.y };
    }
    store.write(shape);
    this.renderShapes();
    this.pendingLine = { shapeId: shape.id };
    this.session = {
      type: "draw",
      pointerId,
      tool: "line",
      shape,
      origin: continuing ? { ...shape.points[shape.points.length - 2] } : { ...point },
      lastPoint: { ...point },
      continuing
    };
    if (!(this.state.toolLocked && DRAWING_TOOLS.has("line"))) {
      this.state.selectedShapeIds.clear();
      this.state.selectedShapeIds.add(shape.id);
      this.notifySelectionChanged();
    } else {
      this.state.selectedShapeIds.clear();
      this.notifySelectionChanged();
    }
  }

  updateDrawing(point) {
    if (!this.session?.shape) return;
    const { shape, tool, origin } = this.session;
    if (tool === "rect" || tool === "ellipse") {
      const width = point.x - origin.x;
      const height = point.y - origin.y;
      const normalizedWidth = Math.abs(width);
      const normalizedHeight = Math.abs(height);
      shape.x = Math.min(origin.x, point.x);
      shape.y = Math.min(origin.y, point.y);
      shape.width = normalizedWidth;
      shape.height = normalizedHeight;
      shape.rotation = 0;
      // Write the single node directly for smooth interactive feedback
      this.shapeStore?.write(shape);
    } else if (tool === "line") {
      const lastIndex = shape.points.length - 1;
      shape.points[lastIndex] = { x: point.x, y: point.y };
      // Update the DOM for the in-progress line
      this.shapeStore?.write(shape);
    } else if (tool === "freehand") {
      const last = this.session.lastPoint;
      if (distanceBetween(last, point) >= MIN_DRAW_DISTANCE) {
        shape.points.push({ x: point.x, y: point.y });
        this.session.lastPoint = { ...point };
        // Only update DOM if we actually added a point
        this.shapeStore?.write(shape);
      }
    } else {
      this.session.lastPoint = { ...point };
      this.shapeStore?.write(shape);
    }
  }

  finalizeDrawing(event) {
    const { shape, tool } = this.session;
    if (!shape) return;
    let keep = true;
    if (shape.type === "rect" || shape.type === "ellipse") {
      keep = shape.width >= MIN_SHAPE_DIMENSION && shape.height >= MIN_SHAPE_DIMENSION;
    } else if (shape.type === "line") {
      // Keep world coordinates as-is for infinite canvas
      shape.points = shape.points.map((point) => ({ x: point.x, y: point.y }));
      if (shape.points.length < 2) {
        keep = false;
      } else {
        const length = polylineLength(shape.points);
        keep = length >= MIN_SHAPE_DIMENSION;
        if (keep && event && (event.ctrlKey || event.metaKey)) {
          const first = shape.points[0];
          const lastIndex = shape.points.length - 1;
          const last = shape.points[lastIndex];
          if (distanceBetween(first, last) <= LINE_CLOSE_THRESHOLD) {
            shape.points[lastIndex] = { ...first };
            shape.closed = true;
          } else {
            shape.closed = false;
          }
        } else {
          shape.closed = false;
        }
      }
    } else if (shape.type === "path") {
      if (shape.points.length < 2) {
        keep = false;
      } else {
        shape.points = simplifyPolyline(shape.points, FREEHAND_SIMPLIFY_TOLERANCE);
        // Remove smoothPolylinePoints - we already use Catmull-Rom splines for rendering
        // which provides smooth curves without adding extra points
        keep = shape.points.length >= 2;
      }
    }
    if (!keep) {
      if (this.pendingLine?.shapeId === shape.id) {
        this.pendingLine = null;
      }
      this.removeShape(shape.id);
      this.render();
      return;
    }
    this.shapeStore?.write(shape);
    if (shape.type === "line") {
      if (event?.shiftKey) {
        this.pendingLine = { shapeId: shape.id };
      } else {
        this.pendingLine = null;
      }
    } else {
      this.pendingLine = null;
    }
    const shouldAutoSelect = !(this.state.toolLocked && DRAWING_TOOLS.has(tool));
    if (shouldAutoSelect) {
      this.state.selectedShapeIds.clear();
      this.state.selectedShapeIds.add(shape.id);
    } else {
      this.state.selectedShapeIds.clear();
    }
    this.render();
    this.notifyShapesChanged();
    this.notifySelectionChanged();
    // Commit the completed drawing as an undoable step
    this.commitHistory("draw");
    if (!(tool === "line" && event?.shiftKey) && !this.state.toolLocked && AUTO_REVERT_TOOLS.has(this.state.tool)) {
      this.setTool("select");
    }
  }

  abortDrawing() {
    const { shape } = this.session || {};
    if (shape) {
      this.removeShape(shape.id);
      this.render();
    }
    if (shape && this.pendingLine?.shapeId === shape.id) {
      this.pendingLine = null;
    }
  }

  removeShape(shapeId) {
    this.shapeStore?.remove(shapeId);
    if (this.state.selectedShapeIds.has(shapeId)) {
      this.state.selectedShapeIds.delete(shapeId);
      this.notifySelectionChanged();
    }
    if (this.pendingLine?.shapeId === shapeId) {
      this.pendingLine = null;
    }
  }

  notifyShapesChanged() {
    const shapes = this.shapeStore ? this.shapeStore.list().map(cloneShape) : [];
    this.emit("shapeschange", shapes);
  }

  notifySelectionChanged() {
    const ids = Array.from(this.state.selectedShapeIds);
    const selectedShapes = ids.map(id => cloneShape(this.shapeStore?.read(id))).filter(Boolean);
    
    // Compute bounding frame for selected shapes
    let frame = null;
    if (selectedShapes.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const shape of selectedShapes) {
        const bounds = this.getShapeBounds(shape);
        if (bounds) {
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.width);
          maxY = Math.max(maxY, bounds.y + bounds.height);
        }
      }
      if (minX !== Infinity) {
        frame = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        };
      }
    }
    
    this.emit("selectionchange", {
      selection: ids,
      shapes: selectedShapes,
      rotation: 0,
      frame: frame
    });
  }

  selectShape(shapeId, options = {}) {
    const { addToSelection = false, toggle = false } = options;
    
    if (!shapeId) {
      // Clear selection
      if (this.state.selectedShapeIds.size > 0) {
        this.state.selectedShapeIds.clear();
        this.render();
        this.notifySelectionChanged();
      }
      return;
    }
    
    const exists = this.shapeStore?.read(shapeId);
    if (!exists) return;
    
    if (toggle) {
      // Toggle shape in selection
      if (this.state.selectedShapeIds.has(shapeId)) {
        this.state.selectedShapeIds.delete(shapeId);
      } else {
        this.state.selectedShapeIds.add(shapeId);
      }
      this.render();
      this.notifySelectionChanged();
    } else if (addToSelection) {
      // Add to existing selection
      if (!this.state.selectedShapeIds.has(shapeId)) {
        this.state.selectedShapeIds.add(shapeId);
        this.render();
        this.notifySelectionChanged();
      }
    } else {
      // Replace selection with single shape
      if (this.state.selectedShapeIds.size === 1 && this.state.selectedShapeIds.has(shapeId)) {
        return; // Already selected, no change
      }
      this.state.selectedShapeIds.clear();
      this.state.selectedShapeIds.add(shapeId);
      this.render();
      this.notifySelectionChanged();
    }
  }

  deleteShape(shapeId, options = {}) {
    if (!shapeId) return;
    if (!this.shapeStore?.read(shapeId)) return;
    this.removeShape(shapeId);
    this.render();
    this.notifyShapesChanged();
    if (!options?.skipHistory) {
      // Make single deletions undoable
      this.commitHistory("delete-shape");
    }
  }
  
  moveShapeInOrder(shapeId, delta) {
    if (!this.shapeStore || !Number.isFinite(delta) || delta === 0) return;
    const currentIndex = this.shapeStore.order.indexOf(shapeId);
    if (currentIndex === -1) return;
    const targetIndex = Math.max(0, Math.min(this.shapeStore.order.length - 1, currentIndex + delta));
    if (targetIndex === currentIndex) return;
    this.shapeStore.move(shapeId, targetIndex);
    this.render();
    this.notifyShapesChanged();
    this.commitHistory("reorder-shape");
  }

  updateShape(shapeId, mutator) {
    if (!shapeId || typeof mutator !== "function") return;
    const store = this.shapeStore;
    if (!store) return;
    const current = store.read(shapeId);
    if (!current) return;
    const draft = cloneShape(current);
    const result = mutator(draft) || draft;
    const next = result || draft;
    store.write(next);
    this.renderShapes();
    this.notifyShapesChanged();
    if (this.state.selectedShapeId === shapeId) {
      this.notifySelectionChanged();
    }
  }

  render() {
    this.renderShapes();
    this.updateToolbar();
  }

  renderShapes() {
    if (!this.shapeStore) return;
    this.shapeStore.setView(this.view);
    const selectedIds = this.state.selectedShapeIds;
    this.shapeStore.order.forEach((shapeId) => {
      const shape = this.shapeStore.read(shapeId);
      if (!shape) return;
      this.shapeStore.write(shape);
      const node = this.shapeStore.getNode(shapeId);
      if (!node) return;
      if (node.parentNode !== this.shapesLayer) {
        this.shapesLayer.appendChild(node);
      } else {
        this.shapesLayer.appendChild(node);
      }
      node.classList.toggle("is-selected", selectedIds.has(shapeId));
    });
    
    // Remove curve-edit overlay if not in curve-edit mode
    if (!this.state.curveEditShapeId) {
      const existing = this.svg.querySelector('.curve-edit-points');
      if (existing) existing.remove();
    }
    
    // Always call renderSelectionFrame to handle cleanup
    // (it will exit early if in curve-edit mode)
    this.renderSelectionFrame();
    
    // Render curve edit control points if in curve-edit mode
    if (this.state.curveEditShapeId) {
      this.renderCurveEditPoints();
    }
  }
  
  renderSelectionFrame() {
    const existingFrame = this.svg.querySelector('.selection-frame');
    if (existingFrame) existingFrame.remove();

    // Don't show selection frame in curve-edit mode
    if (this.state.curveEditShapeId) return;

    const selectedIds = Array.from(this.state.selectedShapeIds);
    if (!selectedIds.length) return;

    const shapes = selectedIds.map((id) => this.shapeStore?.read(id)).filter(Boolean);
    if (!shapes.length) return;

    // Collect all world points in PIXELS
    const allPointsPx = [];
    shapes.forEach((shape) => {
      const pts = getShapePoints(shape);
      if (pts && pts.length) {
        pts.forEach((pt) => allPointsPx.push({ x: pt.x * this.view.width, y: pt.y * this.view.height }));
      }
    });
    if (!allPointsPx.length) return;

    // Determine frame rotation and pivot in PIXELS
    let frameRotation = 0;
    let centerPx = null;
    if (this.session && this.session.type === 'selection-rotate') {
      frameRotation = (this.session.baseSelectionRotation || 0) + (this.session.deltaAngle || 0);
      centerPx = this.session.centerPx || {
        x: this.session.center.x * this.view.width,
        y: this.session.center.y * this.view.height
      };
    } else if (selectedIds.length === 1) {
      const only = shapes[0];
      if (only && (only.type === 'rect' || only.type === 'ellipse')) {
        frameRotation = Number(only.rotation) || 0;
        // centerPx will be computed from allPointsPx AABB below to remain consistent with rendering
      }
    }

    if (!centerPx) {
      let minXw = Infinity, minYw = Infinity, maxXw = -Infinity, maxYw = -Infinity;
      allPointsPx.forEach((p) => {
        minXw = Math.min(minXw, p.x);
        minYw = Math.min(minYw, p.y);
        maxXw = Math.max(maxXw, p.x);
        maxYw = Math.max(maxYw, p.y);
      });
      centerPx = { x: (minXw + maxXw) / 2, y: (minYw + maxYw) / 2 };
    }

    // Unrotate all points around pivot (in px) to compute axis-aligned bounds in local frame
    const boundsPointsPx = frameRotation
      ? allPointsPx.map((pt) => rotateAround(pt, centerPx, -frameRotation))
      : allPointsPx;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    boundsPointsPx.forEach((pt) => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    });
    if (!Number.isFinite(minX)) return;

    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);

    const frameGroup = createSvgElement('g', { class: 'selection-frame' });
    if (frameRotation) {
      const deg = (frameRotation * 180) / Math.PI;
      frameGroup.setAttribute('transform', `rotate(${deg}, ${centerPx.x}, ${centerPx.y})`);
    }

    // Frame rect in px
    const rect = createSvgElement('rect', {
      x: minX,
      y: minY,
      width,
      height,
      fill: '#ffffff',
      'fill-opacity': '0.12',
      stroke: '#ffffff',
      'stroke-opacity': '0.9',
      'stroke-width': '2',
      'stroke-dasharray': '2,3',
      'pointer-events': 'none'
    });
    frameGroup.appendChild(rect);

    // Handles in px
    const handleSize = 8;
    const handleMeta = [
      { id: 'tl', x: minX, y: minY, cursor: 'nwse-resize' },
      { id: 'tr', x: maxX, y: minY, cursor: 'nesw-resize' },
      { id: 'br', x: maxX, y: maxY, cursor: 'nwse-resize' },
      { id: 'bl', x: minX, y: maxY, cursor: 'nesw-resize' }
    ];
    handleMeta.forEach((corner) => {
      const handle = createSvgElement('rect', {
        x: corner.x - handleSize / 2,
        y: corner.y - handleSize / 2,
        width: handleSize,
        height: handleSize,
        fill: 'none',
        stroke: '#ffffff',
        'stroke-opacity': '0.9',
        'stroke-width': '2',
        'stroke-dasharray': '2,3',
        'pointer-events': 'all',
        'data-handle': corner.id,
        style: `cursor:${corner.cursor}`
      });
      frameGroup.appendChild(handle);
    });

    // Rotation handle in px
    const topCenterX = (minX + maxX) / 2;
    const topY = minY;
    const handleOffsetPx = 14;
    const stalk = createSvgElement('line', {
      x1: topCenterX,
      y1: topY,
      x2: topCenterX,
      y2: topY - handleOffsetPx,
      stroke: '#ffffff',
      'stroke-opacity': '0.9',
      'stroke-width': '2',
      'stroke-dasharray': '2,3',
      'pointer-events': 'none'
    });
    frameGroup.appendChild(stalk);
    const rotHandle = createSvgElement('circle', {
      cx: topCenterX,
      cy: topY - handleOffsetPx,
      r: handleSize / 2,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-opacity': '0.9',
      'stroke-width': '2',
      'stroke-dasharray': '2,3',
      'pointer-events': 'all',
      'data-rotate': 'true',
      style: 'cursor: grab'
    });
    frameGroup.appendChild(rotHandle);

    // Append within shapes layer so it inherits camera transform and stays aligned
    this.shapesLayer.appendChild(frameGroup);
  }

  renderCurveEditPoints() {
    // Remove existing control points
    const existing = this.svg.querySelector('.curve-edit-points');
    if (existing) existing.remove();
    
    if (!this.state.curveEditShapeId || !this.state.curveEditPoints.length) return;
    
    const shape = this.shapeStore?.read(this.state.curveEditShapeId);
    if (!shape || !shape.points) return;
    
    // Get the shape's stroke color
    const strokeColor = shape.style?.stroke || DEFAULT_STYLE.stroke;
    
    const group = createSvgElement('g', { class: 'curve-edit-points' });
    
    // Draw lines connecting the points (the "skeleton")
    if (shape.points.length > 1) {
      const linePoints = shape.points.map(pt => 
        `${pt.x * this.view.width},${pt.y * this.view.height}`
      ).join(' ');
      const polyline = createSvgElement('polyline', {
        points: linePoints,
        fill: 'none',
        stroke: strokeColor,
        'stroke-opacity': '0.3',
        'stroke-width': '1',
        'stroke-dasharray': '4,4',
        'pointer-events': 'none'
      });
      group.appendChild(polyline);
    }
    
    // Draw control point handles
    const handleRadius = 5;
    shape.points.forEach((pt, index) => {
      const cx = pt.x * this.view.width;
      const cy = pt.y * this.view.height;
      
      const handle = createSvgElement('circle', {
        cx,
        cy,
        r: handleRadius,
        fill: 'none',
        stroke: strokeColor,
        'stroke-width': '2',
        'pointer-events': 'all',
        'data-point-index': index,
        class: 'curve-edit-handle',
        style: 'cursor: move'
      });
      group.appendChild(handle);
    });
    
    // Append within shapes layer so it follows camera transform
    this.shapesLayer.appendChild(group);
  }
  
  renderGrid() {
    // Remove existing grid
    const existing = this.svg.querySelector('.editor-grid');
    if (existing) existing.remove();
  
    if (this.state.gridMode === 'off') return;
  
    const gridSize = 50; // Grid cell size in pixels at zoom=1
    const effectiveGridSize = gridSize * this.camera.zoom;
  
    // Calculate visible area in world coordinates
    const minX = -this.camera.x / this.camera.zoom;
    const minY = -this.camera.y / this.camera.zoom;
    const maxX = (this.view.width - this.camera.x) / this.camera.zoom;
    const maxY = (this.view.height - this.camera.y) / this.camera.zoom;
  
    const gridGroup = createSvgElement('g', { class: 'editor-grid' });
    const transform = `translate(${this.camera.x}, ${this.camera.y}) scale(${this.camera.zoom})`;
    gridGroup.setAttribute('transform', transform);
  
    const opacity = '0.05'; // Reduced from 0.1
  
    if (this.state.gridMode === 'line') {
      // Draw vertical lines
      const startX = Math.floor(minX / gridSize) * gridSize;
      const endX = Math.ceil(maxX / gridSize) * gridSize;
      for (let x = startX; x <= endX; x += gridSize) {
        const line = createSvgElement('line', {
          x1: x,
          y1: minY,
          x2: x,
          y2: maxY,
          stroke: '#ffffff',
          'stroke-opacity': opacity,
          'stroke-width': 1 / this.camera.zoom,
          'pointer-events': 'none'
        });
        gridGroup.appendChild(line);
      }
    
      // Draw horizontal lines
      const startY = Math.floor(minY / gridSize) * gridSize;
      const endY = Math.ceil(maxY / gridSize) * gridSize;
      for (let y = startY; y <= endY; y += gridSize) {
        const line = createSvgElement('line', {
          x1: minX,
          y1: y,
          x2: maxX,
          y2: y,
          stroke: '#ffffff',
          'stroke-opacity': opacity,
          'stroke-width': 1 / this.camera.zoom,
          'pointer-events': 'none'
        });
        gridGroup.appendChild(line);
      }
    } else if (this.state.gridMode === 'dot') {
      // Draw dots at grid intersections
      const startX = Math.floor(minX / gridSize) * gridSize;
      const endX = Math.ceil(maxX / gridSize) * gridSize;
      const startY = Math.floor(minY / gridSize) * gridSize;
      const endY = Math.ceil(maxY / gridSize) * gridSize;
      const dotRadius = 1.5 / this.camera.zoom;
      
      for (let x = startX; x <= endX; x += gridSize) {
        for (let y = startY; y <= endY; y += gridSize) {
          const dot = createSvgElement('circle', {
            cx: x,
            cy: y,
            r: dotRadius,
            fill: '#ffffff',
            'fill-opacity': opacity,
            'pointer-events': 'none'
          });
          gridGroup.appendChild(dot);
        }
      }
    }
  
    // Insert grid before shapes layer
    this.svg.insertBefore(gridGroup, this.shapesLayer);
  }  // Fit camera to a world-space rect (normalized units)
  fitCameraToRect(rect, padding = 40) {
    if (!rect) return;
    const viewW = this.view.width;
    const viewH = this.view.height;
    const rectPxW = Math.max(rect.width * viewW, 1);
    const rectPxH = Math.max(rect.height * viewH, 1);
    const availW = Math.max(viewW - padding * 2, 1);
    const availH = Math.max(viewH - padding * 2, 1);
    const zoom = Math.min(10, Math.max(0.1, Math.min(availW / rectPxW, availH / rectPxH)));
    const cxPx = (rect.x + rect.width / 2) * viewW;
    const cyPx = (rect.y + rect.height / 2) * viewH;
    this.camera.zoom = zoom;
    this.camera.x = viewW / 2 - cxPx * zoom;
    this.camera.y = viewH / 2 - cyPx * zoom;
    this.updateCameraTransform();
  }

  frameSelectionOrAll() {
    const bounds = this.getCurrentSelectionBounds();
    if (bounds) {
      this.fitCameraToRect(bounds);
    } else {
      this.frameAll();
    }
  }

  frameAll() {
    if (!this.shapeStore || !this.shapeStore.order.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of this.shapeStore.order) {
      const shape = this.shapeStore.read(id);
      if (!shape) continue;
      const b = this.getShapeBounds(shape);
      if (!b) continue;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
    if (!Number.isFinite(minX)) return;
    const rect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    this.fitCameraToRect(rect);
  }

  getShapeBounds(shape) {
    if (!shape) return null;
    // Use oriented points for all shapes (including rotated rect/ellipse)
    const pts = getShapePoints(shape);
    if (!pts || !pts.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  applySnapping(point, { snapToGrid = false, snapToElement = false } = {}) {
    let snapped = { ...point };
    
    // Snap to grid (in pixel space)
    if (snapToGrid) {
      const px = point.x * this.view.width;
      const py = point.y * this.view.height;
      const snappedPx = Math.round(px / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
      const snappedPy = Math.round(py / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
      snapped.x = snappedPx / this.view.width;
      snapped.y = snappedPy / this.view.height;
    }
    
    // Snap to nearest element points (vertices, centers)
    if (snapToElement) {
      const candidatePoints = [];
      
      // Gather all snap points from shapes
      if (this.shapeStore) {
        for (const id of this.shapeStore.order) {
          // Skip the shape being drawn if it exists
          if (this.session?.shape?.id === id) continue;
          
          const shape = this.shapeStore.read(id);
          if (!shape) continue;
          
          // Get shape points (vertices)
          const pts = getShapePoints(shape);
          if (pts) {
            candidatePoints.push(...pts);
          }
          
          // Add center point for rect/ellipse
          if (shape.type === 'rect' || shape.type === 'ellipse') {
            candidatePoints.push({
              x: shape.x + shape.width / 2,
              y: shape.y + shape.height / 2
            });
          }
        }
      }
      
      // Find nearest point within threshold
      const thresholdNorm = SNAP_ELEMENT_THRESHOLD / this.view.width; // Convert to normalized
      let minDist = thresholdNorm;
      let nearestPoint = null;
      
      for (const candidate of candidatePoints) {
        const dist = Math.hypot(candidate.x - snapped.x, candidate.y - snapped.y);
        if (dist < minDist) {
          minDist = dist;
          nearestPoint = candidate;
        }
      }
      
      if (nearestPoint) {
        snapped.x = nearestPoint.x;
        snapped.y = nearestPoint.y;
      }
    }
    
    return snapped;
  }

  showSnapIndicator(point) {
    // Remove existing indicator
    let indicator = this.svg.querySelector('.snap-indicator');
    if (!indicator) {
      indicator = createSvgElement('g', { class: 'snap-indicator' });
      // Append to shapes layer so it follows camera transform
      this.shapesLayer.appendChild(indicator);
    } else {
      while (indicator.firstChild) indicator.removeChild(indicator.firstChild);
    }
    
    // Draw a small crosshair at the snap point (in normalized world coordinates)
    const px = point.x * this.view.width;
    const py = point.y * this.view.height;
    const size = 5;
    
    const hLine = createSvgElement('line', {
      x1: px - size,
      y1: py,
      x2: px + size,
      y2: py,
      stroke: '#ffffff',
      'stroke-width': '1.5',
      'stroke-opacity': '0.5',
      'pointer-events': 'none'
    });
    
    const vLine = createSvgElement('line', {
      x1: px,
      y1: py - size,
      x2: px,
      y2: py + size,
      stroke: '#ffffff',
      'stroke-width': '1.5',
      'stroke-opacity': '0.5',
      'pointer-events': 'none'
    });
    
    indicator.appendChild(hLine);
    indicator.appendChild(vLine);
  }

  hideSnapIndicator() {
    const indicator = this.svg.querySelector('.snap-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  getNormalizedPoint(event, { clamp = true } = {}) {
    // Map client -> SVG -> world (apply inverse camera)
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return null;
    const mapped = point.matrixTransform(ctm.inverse());
    const worldX = (mapped.x - this.camera.x) / this.camera.zoom;
    const worldY = (mapped.y - this.camera.y) / this.camera.zoom;
    const normalized = {
      x: worldX / this.view.width,
      y: worldY / this.view.height
    };
    if (clamp) {
      normalized.x = clampUnit(normalized.x);
      normalized.y = clampUnit(normalized.y);
    }
    return normalized;
  }
}

const DRAWING_TOOLS = new Set(["rect", "ellipse", "line", "freehand"]);
const AUTO_REVERT_TOOLS = new Set(["rect", "ellipse", "line", "freehand"]);

function getViewBox(svg) {
  const base = svg.viewBox.baseVal;
  if (base && base.width && base.height) {
    return { width: base.width, height: base.height };
  }
  const width = Number(svg.getAttribute("width")) || 1280;
  const height = Number(svg.getAttribute("height")) || 720;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  return { width, height };
}

function createSvgElement(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  return el;
}

function createShape(tool, point, style) {
  const id = createId();
  const base = {
    id,
    name: "",
    interaction: null
  };
  if (tool === "rect") {
    return {
      ...base,
      type: "rect",
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      rotation: 0,
      style: { ...style }
    };
  }
  if (tool === "ellipse") {
    return {
      ...base,
      type: "ellipse",
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      rotation: 0,
      style: { ...style }
    };
  }
  if (tool === "line") {
    return {
      ...base,
      type: "line",
      points: [{ x: point.x, y: point.y }, { x: point.x, y: point.y }],
      style: { ...style }
    };
  }
  return {
    ...base,
    type: "path",
    points: [{ x: point.x, y: point.y }],
    style: { ...style }
  };
}

function getShapeCenter(shape) {
  if (shape.type === "rect" || shape.type === "ellipse") {
    return {
      x: shape.x + shape.width / 2,
      y: shape.y + shape.height / 2
    };
  }
  if (shape.type === "line" || shape.type === "path") {
    const points = shape.points;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    points.forEach((point) => {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    });
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
  }
  return { x: 0, y: 0 };
}

function getShapePoints(shape) {
  if (shape.type === "rect") {
    const { x, y } = shape;
    const width = Math.max(MIN_SHAPE_DIMENSION, shape.width || 0);
    const height = Math.max(MIN_SHAPE_DIMENSION, shape.height || 0);
    const cx = x + width / 2;
    const cy = y + height / 2;
    const hw = width / 2;
    const hh = height / 2;
    const rotation = shape.rotation || 0;
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh }
    ];
    return corners.map((corner) => {
      const rotated = rotateVector(corner, rotation);
      return { x: cx + rotated.x, y: cy + rotated.y };
    });
  }
  if (shape.type === "ellipse") {
    const { x, y } = shape;
    const width = Math.max(MIN_SHAPE_DIMENSION, shape.width || 0);
    const height = Math.max(MIN_SHAPE_DIMENSION, shape.height || 0);
    const cx = x + width / 2;
    const cy = y + height / 2;
    const hw = width / 2;
    const hh = height / 2;
    const rotation = shape.rotation || 0;
    const samplePoints = [];
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const px = Math.cos(angle) * hw;
      const py = Math.sin(angle) * hh;
      const rotated = rotateVector({ x: px, y: py }, rotation);
      samplePoints.push({ x: cx + rotated.x, y: cy + rotated.y });
    }
    return samplePoints;
  }
  if (shape.type === "line" || shape.type === "path") {
    return shape.points.map((point) => ({ x: point.x, y: point.y }));
  }
  return [];
}

function rotateVector(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos
  };
}

function rotateAround(point, center, angle) {
  const translated = {
    x: point.x - center.x,
    y: point.y - center.y
  };
  const rotated = rotateVector(translated, angle);
  return {
    x: rotated.x + center.x,
    y: rotated.y + center.y
  };
}

function toSelectionLocal(point, frame) {
  const translated = {
    x: point.x - frame.centerX,
    y: point.y - frame.centerY
  };
  return rotateVector(translated, -frame.rotation);
}

function distanceBetween(a, b) {
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  return Math.hypot(dx, dy);
}

function clampUnit(value) {
  return Math.min(1, Math.max(0, value));
}


function simplifyPolyline(points, tolerance = 0.002) {
  if (points.length <= 2) return points.slice();
  const sqTol = tolerance * tolerance;
  const radial = simplifyRadial(points, sqTol);
  return simplifyDouglasPeucker(radial, sqTol);
}

function simplifyRadial(points, sqTolerance) {
  let prev = points[0];
  const out = [prev];
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    const dx = point.x - prev.x;
    const dy = point.y - prev.y;
    if (dx * dx + dy * dy > sqTolerance) {
      out.push(point);
      prev = point;
    }
  }
  if (prev !== points[points.length - 1]) {
    out.push(points[points.length - 1]);
  }
  return out;
}

function simplifyDouglasPeucker(points, sqTolerance) {
  const len = points.length;
  if (len <= 2) return points.slice();
  const markers = new Uint8Array(len);
  markers[0] = markers[len - 1] = 1;
  const stack = [[0, len - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0;
    let index = 0;
    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSq) {
        index = i;
        maxSq = sqDist;
      }
    }
    if (maxSq > sqTolerance) {
      markers[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out = [];
  for (let i = 0; i < len; i++) {
    if (markers[i]) out.push(points[i]);
  }
  return out;
}

function getSqSegDist(p, a, b) {
  let x = a.x;
  let y = a.y;
  let dx = b.x - x;
  let dy = b.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b.x;
      y = b.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

function smoothPolylinePoints(points, iterations = 1, closed = false) {
  if (!Array.isArray(points) || points.length < 3) {
    return points.slice();
  }
  let result = points.map((point) => ({ x: point.x, y: point.y }));
  for (let iter = 0; iter < iterations; iter++) {
    const next = [];
    const len = result.length;
    if (!closed) {
      next.push(result[0]);
    }
    for (let i = 0; i < len - 1; i++) {
      const p0 = result[i];
      const p1 = result[i + 1];
      const q = {
        x: p0.x + (p1.x - p0.x) * 0.25,
        y: p0.y + (p1.y - p0.y) * 0.25
      };
      const r = {
        x: p0.x + (p1.x - p0.x) * 0.75,
        y: p0.y + (p1.y - p0.y) * 0.75
      };
      next.push(q, r);
    }
    if (closed) {
      const p0 = result[result.length - 1];
      const p1 = result[0];
      const q = {
        x: p0.x + (p1.x - p0.x) * 0.25,
        y: p0.y + (p1.y - p0.y) * 0.25
      };
      const r = {
        x: p0.x + (p1.x - p0.x) * 0.75,
        y: p0.y + (p1.y - p0.y) * 0.75
      };
      next.push(q, r);
    } else {
      next.push(result[result.length - 1]);
    }
    result = next;
  }
  return result;
}

function pointsToSmoothPathD(points, viewWidth, viewHeight, closed = false) {
  if (!Array.isArray(points) || points.length < 2) return "";
  const scaled = points.map((point) => ({
    x: point.x * viewWidth,
    y: point.y * viewHeight
  }));
  if (scaled.length === 2) {
    const [a, b] = scaled;
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}` + (closed ? " Z" : "");
  }
  let d = `M ${scaled[0].x} ${scaled[0].y}`;
  const total = scaled.length;
  const lastIndex = closed ? total : total - 1;
  for (let i = 0; i < lastIndex; i++) {
    const p0 = scaled[(i - 1 + total) % total];
    const p1 = scaled[i % total];
    const p2 = scaled[(i + 1) % total];
    const p3 = scaled[(i + 2) % total];
    const isFirst = i === 0;
    const isLast = i === total - 2;
    const p0Safe = closed ? p0 : (isFirst ? p1 : p0);
    const p3Safe = closed ? p3 : (isLast ? p2 : p3);
    const c1 = {
      x: p1.x + (p2.x - p0Safe.x) / 6,
      y: p1.y + (p2.y - p0Safe.y) / 6
    };
    const c2 = {
      x: p2.x - (p3Safe.x - p1.x) / 6,
      y: p2.y - (p3Safe.y - p1.y) / 6
    };
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
    if (!closed && i === total - 2) {
      break;
    }
  }
  if (closed) {
    d += " Z";
  }
  return d;
}

function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distanceBetween(points[i - 1], points[i]);
  }
  return length;
}

function getShapeBounds(shape) {
  const points = getShapePoints(shape);
  if (!points.length) return null;
  return getBoundsFromPoints(points);
}

function getBoundsFromPoints(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach((point) => {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  });
  return { minX, minY, maxX, maxY };
}

function shapeContainsPoint(shape, point, tolerance = 0.01) {
  if (!shape) return false;
  if (shape.type === "rect" || shape.type === "ellipse") {
    const frame = {
      centerX: shape.x + (shape.width || 0) / 2,
      centerY: shape.y + (shape.height || 0) / 2,
      width: shape.width || 0,
      height: shape.height || 0,
      rotation: shape.rotation || 0
    };
    const local = toSelectionLocal(point, frame);
    if (shape.type === "rect") {
      return Math.abs(local.x) <= (frame.width / 2) && Math.abs(local.y) <= (frame.height / 2);
    }
    const normX = frame.width ? local.x / (frame.width / 2) : Infinity;
    const normY = frame.height ? local.y / (frame.height / 2) : Infinity;
    return normX * normX + normY * normY <= 1;
  }
  const vertices = shape.points || [];
  if (!vertices.length) return false;
  if (shape.closed) {
    if (pointInPolygon(vertices, point)) return true;
  }
  return pointNearPolyline(vertices, point, tolerance);
}

function pointNearPolyline(vertices, point, tolerance) {
  const tolSq = tolerance * tolerance;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    if (getSqSegDist(point, a, b) <= tolSq) return true;
  }
  if (vertices.length > 2 && getSqSegDist(point, vertices[vertices.length - 1], vertices[0]) <= tolSq) {
    return true;
  }
  return false;
}

function pointInPolygon(vertices, point) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function boundsIntersect(a, b) {
  if (!a || !b) return false;
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function cloneShape(shape) {
  if (!shape) return null;
  if (shape.type === "rect" || shape.type === "ellipse") {
    return {
      id: shape.id,
      name: shape.name || "",
      interaction: shape.interaction ? JSON.parse(JSON.stringify(shape.interaction)) : null,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      rotation: shape.rotation,
      style: { ...(shape.style || {}) }
    };
  }
  return {
    id: shape.id,
    name: shape.name || "",
    interaction: shape.interaction ? JSON.parse(JSON.stringify(shape.interaction)) : null,
    type: shape.type,
    points: shape.points.map((point) => ({ x: point.x, y: point.y })),
    closed: Boolean(shape.closed),
    style: { ...(shape.style || {}) }
  };
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `shape-${Math.random().toString(36).slice(2, 10)}`;
}

function buildShapeNode(shape, view) {
  const node = createSvgElement("g", { class: "editor-shape", "data-shape-id": shape.id });
  applyShapeNode(node, shape, view);
  return node;
}

function applyShapeNode(node, shape, view) {
  if (!node || !shape) return;
  node.dataset.shapeId = shape.id;
  node.dataset.shapeType = shape.type;
  node.dataset.shapeName = shape.name || "";
  const interactionData = shape.interaction && typeof shape.interaction === "object" ? shape.interaction : null;
  const showInMain = interactionData ? interactionData.showInMain !== false : true;
  const enabledInMain = interactionData ? interactionData.enabled !== false : true;
  node.dataset.showInMain = String(showInMain);
  node.dataset.shapeEnabled = String(enabledInMain);
  node.classList.toggle("is-disabled", !enabledInMain);
  node.classList.toggle("is-hidden-main", !showInMain);
  node.style.display = showInMain ? "" : "none";
  if (shape.interaction) {
    try {
      node.dataset.shapeInteraction = JSON.stringify(shape.interaction);
    } catch (error) {
      console.warn("[mediamime] Failed to serialise shape interaction", error);
      delete node.dataset.shapeInteraction;
    }
  } else {
    delete node.dataset.shapeInteraction;
  }
  const style = shape.style || DEFAULT_STYLE;
  node.dataset.shapeStroke = style.stroke || DEFAULT_STYLE.stroke;
  node.dataset.shapeFill = style.fill || DEFAULT_STYLE.fill;
  node.dataset.shapeStrokeWidth = String(Number(style.strokeWidth ?? DEFAULT_STYLE.strokeWidth) || DEFAULT_STYLE.strokeWidth);
  node.dataset.shapeRotation = String(Number(shape.rotation || 0));

  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }

  const viewWidth = view.width;
  const viewHeight = view.height;

  const applyStroke = (el) => {
    el.setAttribute("stroke", style.stroke || DEFAULT_STYLE.stroke);
    el.setAttribute("stroke-width", String(style.strokeWidth ?? DEFAULT_STYLE.strokeWidth));
    el.setAttribute("fill", style.fill || DEFAULT_STYLE.fill);
  };

  if (shape.type === "rect") {
    const rect = createSvgElement("rect", {});
    const x = (shape.x || 0) * viewWidth;
    const y = (shape.y || 0) * viewHeight;
    const width = Math.max(MIN_SHAPE_DIMENSION * viewWidth, shape.width * viewWidth);
    const height = Math.max(MIN_SHAPE_DIMENSION * viewHeight, shape.height * viewHeight);
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    if (shape.rotation) {
      const cx = (shape.x + shape.width / 2) * viewWidth;
      const cy = (shape.y + shape.height / 2) * viewHeight;
      rect.setAttribute("transform", `rotate(${(shape.rotation * 180) / Math.PI}, ${cx}, ${cy})`);
    }
    applyStroke(rect);
    node.appendChild(rect);
    node.dataset.shapeX = String(shape.x || 0);
    node.dataset.shapeY = String(shape.y || 0);
    node.dataset.shapeWidth = String(shape.width || 0);
    node.dataset.shapeHeight = String(shape.height || 0);
  } else if (shape.type === "ellipse") {
    const ellipse = createSvgElement("ellipse", {});
    const cx = (shape.x + shape.width / 2) * viewWidth;
    const cy = (shape.y + shape.height / 2) * viewHeight;
    const rx = Math.max(MIN_SHAPE_DIMENSION * viewWidth * 0.5, (shape.width / 2) * viewWidth);
    const ry = Math.max(MIN_SHAPE_DIMENSION * viewHeight * 0.5, (shape.height / 2) * viewHeight);
    ellipse.setAttribute("cx", String(cx));
    ellipse.setAttribute("cy", String(cy));
    ellipse.setAttribute("rx", String(rx));
    ellipse.setAttribute("ry", String(ry));
    if (shape.rotation) {
      ellipse.setAttribute("transform", `rotate(${(shape.rotation * 180) / Math.PI}, ${cx}, ${cy})`);
    }
    applyStroke(ellipse);
    node.appendChild(ellipse);
    node.dataset.shapeX = String(shape.x || 0);
    node.dataset.shapeY = String(shape.y || 0);
    node.dataset.shapeWidth = String(shape.width || 0);
    node.dataset.shapeHeight = String(shape.height || 0);
  } else if (shape.type === "line") {
    const points = Array.isArray(shape.points) ? shape.points : [];
    node.dataset.shapePoints = JSON.stringify(points.map((point) => ({ x: point.x, y: point.y })));
    node.dataset.shapeClosed = shape.closed ? "true" : "false";
    const refined = smoothPolylinePoints(points, 1, Boolean(shape.closed));
    const d = pointsToSmoothPathD(refined, viewWidth, viewHeight, Boolean(shape.closed));
    const pathEl = createSvgElement("path", {
      d,
      fill: shape.closed ? (style.fill || DEFAULT_STYLE.fill) : "none",
      stroke: style.stroke || DEFAULT_STYLE.stroke,
      "stroke-width": String(style.strokeWidth ?? DEFAULT_STYLE.strokeWidth),
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });
    node.appendChild(pathEl);
  } else if (shape.type === "path") {
    const points = Array.isArray(shape.points) ? shape.points : [];
    node.dataset.shapePoints = JSON.stringify(points.map((point) => ({ x: point.x, y: point.y })));
    node.dataset.shapeClosed = shape.closed ? "true" : "false";
    const refined = smoothPolylinePoints(points, 1, Boolean(shape.closed));
    const d = pointsToSmoothPathD(refined, viewWidth, viewHeight, Boolean(shape.closed));
    const pathEl = createSvgElement("path", {
      d,
      fill: shape.closed ? (style.fill || DEFAULT_STYLE.fill) : "none",
      stroke: style.stroke || DEFAULT_STYLE.stroke,
      "stroke-width": String(style.strokeWidth ?? DEFAULT_STYLE.strokeWidth),
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });
    node.appendChild(pathEl);
  }
}

function parseShapeNode(node, view) {
  if (!node) return null;
  const type = node.dataset.shapeType || inferShapeType(node);
  const id = node.dataset.shapeId || createId();
  const stroke = node.dataset.shapeStroke || DEFAULT_STYLE.stroke;
  const fill = node.dataset.shapeFill || DEFAULT_STYLE.fill;
  const strokeWidth = Number.parseFloat(node.dataset.shapeStrokeWidth || `${DEFAULT_STYLE.strokeWidth}`) || DEFAULT_STYLE.strokeWidth;
  const rotation = Number.parseFloat(node.dataset.shapeRotation || "0") || 0;
  const name = node.dataset.shapeName || "";
  let interaction = null;
  if (node.dataset.shapeInteraction) {
    try {
      const parsed = JSON.parse(node.dataset.shapeInteraction);
      if (parsed && typeof parsed === "object") {
        interaction = parsed;
      }
    } catch (error) {
      console.warn("[mediamime] Failed to parse shape interaction", error);
    }
  }
  if (type === "rect" || type === "ellipse") {
    const x = Number.parseFloat(node.dataset.shapeX || "0");
    const y = Number.parseFloat(node.dataset.shapeY || "0");
    const width = Number.parseFloat(node.dataset.shapeWidth || "0");
    const height = Number.parseFloat(node.dataset.shapeHeight || "0");
    return {
      id,
      name,
      interaction,
      type,
      x,
      y,
      width,
      height,
      rotation,
      style: { stroke, fill, strokeWidth }
    };
  }
  if (type === "line" || type === "path") {
    let points = [];
    const rawPoints = node.dataset.shapePoints;
    if (rawPoints) {
      try {
        const parsed = JSON.parse(rawPoints);
        if (Array.isArray(parsed)) {
          points = parsed.map((point) => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 }));
        }
      } catch (error) {
        console.warn("[mediamime] Failed to parse shape points", error);
      }
    }
    const closed = node.dataset.shapeClosed === "true";
    return {
      id,
      name,
      interaction,
      type,
      points,
      closed,
      rotation,
      style: { stroke, fill, strokeWidth }
    };
  }
  return {
    id,
    name,
    interaction,
    type: "rect",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation,
    style: { stroke, fill, strokeWidth }
  };
}

function inferShapeType(node) {
  const child = node.firstElementChild;
  if (!child) return "rect";
  const tag = child.tagName.toLowerCase();
  if (tag === "rect") return "rect";
  if (tag === "ellipse") return "ellipse";
  if (tag === "polygon" || tag === "polyline") return "line";
  if (tag === "path") {
    return node.dataset.shapeType || "path";
  }
  return "rect";
}
