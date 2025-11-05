const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_SHAPE_DIMENSION = 0.01; // Normalised units (0–1)
const MIN_DRAW_DISTANCE = 0.0025;
const LINE_CLOSE_THRESHOLD = 0.02;
const ERASER_TOLERANCE = 0.02;
const FREEHAND_SIMPLIFY_TOLERANCE = 0.0015;
const DEFAULT_STYLE = {
  stroke: "rgba(82, 213, 255, 0.92)",
  fill: "rgba(82, 213, 255, 0.14)",
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
      selectedShapeId: null
    };
    this.shapeStore = null;
    this.session = null;
    this.events = new Map();
    this.pendingLine = null;
    this.lockButton = document.getElementById("gesture-tool-lock") || this.toolbar.querySelector("#gesture-tool-lock");
    this.modeToggle = document.getElementById("gesture-mode-toggle") || this.toolbar.querySelector("#gesture-mode-toggle");
    this.clearButton = document.getElementById("gesture-clear") || this.toolbar.querySelector("#gesture-clear");
    this.toolbarHidden = false;
  }

  init() {
    this.prepareSvg();
    this.bindToolbar();
    this.bindCanvas();
    this.updateModeUI();
    this.render();
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
    const normalized = {
      x: mapped.x / this.view.width,
      y: mapped.y / this.view.height
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
        selection: this.state.selectedShapeId ? [this.state.selectedShapeId] : []
      }),
      setTool: (tool) => this.setTool(tool),
      updateShape: (shapeId, mutator) => this.updateShape(shapeId, mutator),
      selectShape: (shapeId) => this.selectShape(shapeId),
      deleteShape: (shapeId) => this.deleteShape(shapeId),
      on: (event, handler) => this.on(event, handler),
      off: (event, handler) => this.off(event, handler),
      normalizePoint: (clientPoint, options) => this.normalizeClientPoint(clientPoint, options),
      shapeContainsPoint: (shapeId, point, tolerance) => this.shapeContainsPoint(shapeId, point, tolerance),
      getShapeSnapshot: (shapeId) => cloneShape(this.shapeStore?.read(shapeId))
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
  }

  bindToolbar() {
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
    window.addEventListener("keydown", this.handleKeyDown);
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
    this.state.selectedShapeId = null;
    this.pendingLine = null;
    this.render();
    this.notifyShapesChanged();
    this.notifySelectionChanged();
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
    const point = {
      x: clampUnit(rawPoint.x),
      y: clampUnit(rawPoint.y)
    };
    const tool = this.state.tool;
    const target = event.target;
    const shapeId = target?.closest?.("[data-shape-id]")?.dataset?.shapeId || null;

    if (tool === "select") {
      if (shapeId) {
        const shape = this.shapeStore?.read(shapeId);
        if (!shape) return;
        if (event.altKey) {
          if (this.state.selectedShapeId !== shapeId) {
            this.state.selectedShapeId = shapeId;
            this.render();
            this.notifySelectionChanged();
          }
          this.emit("shapealtclick", { shapeId, originalEvent: event });
          event.preventDefault();
          return;
        }
        if (this.state.selectedShapeId !== shapeId) {
          this.state.selectedShapeId = shapeId;
          this.render();
          this.notifySelectionChanged();
        }
        this.startShapeDrag({
          shapeId,
          pointerId: event.pointerId,
          origin: point,
          originRaw: rawPoint
        });
        event.preventDefault();
      } else if (this.state.selectedShapeId) {
        this.state.selectedShapeId = null;
        this.render();
        this.notifySelectionChanged();
      }
      return;
    }

    if (tool === "hand") {
      // Future: implement pan/zoom
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
    const point = {
      x: clampUnit(rawPoint.x),
      y: clampUnit(rawPoint.y)
    };

    if (!this.session) return;
    switch (this.session.type) {
      case "draw":
        event.preventDefault();
        this.updateDrawing(point);
        break;
      case "shape-drag": {
        event.preventDefault();
        const dx = (rawPoint?.x ?? point.x) - this.session.originRaw.x;
        const dy = (rawPoint?.y ?? point.y) - this.session.originRaw.y;
        this.updateShapeDrag(this.session, dx, dy);
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
    if (this.session && event.pointerId === this.session.pointerId) {
      switch (this.session.type) {
        case "draw":
          this.finalizeDrawing(event);
          break;
        case "shape-drag":
          this.finishShapeDrag();
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

  handlePointerCancel = (event) => {
    if (this.session && event.pointerId === this.session.pointerId) {
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
    if (this.svg.hasPointerCapture(event.pointerId)) {
      this.svg.releasePointerCapture(event.pointerId);
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
  }

  cancelShapeDrag() {
    if (!this.session || this.session.type !== "shape-drag") return;
    if (this.session.baseShape) {
      this.shapeStore?.write(cloneShape(this.session.baseShape));
      this.renderShapes();
    }
  }

  handleKeyDown = (event) => {
    if (event.defaultPrevented) return;
    const activeTag = document.activeElement?.tagName?.toLowerCase() || "";
    if (["input", "textarea", "select"].includes(activeTag)) return;
    const key = event.key.toLowerCase();
    if (event.metaKey || event.ctrlKey) {
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
      case "v":
        this.setTool("select");
        event.preventDefault();
        break;
      case "h":
        this.setTool("hand");
        event.preventDefault();
        break;
      case "d":
        this.setTool("freehand");
        event.preventDefault();
        break;
      case "e":
        this.setTool("eraser");
        event.preventDefault();
        break;
      case "l":
        this.setTool("line");
        event.preventDefault();
        break;
      case "r":
        this.setTool("rect");
        event.preventDefault();
        break;
      case "o":
        this.setTool("ellipse");
        event.preventDefault();
        break;
      case "q":
        this.toggleToolLock();
        event.preventDefault();
        break;
      case "escape":
        if (this.session?.type === "draw") {
          this.abortDrawing();
          this.session = null;
          event.preventDefault();
        } else if (this.state.selectedShapeId) {
          this.state.selectedShapeId = null;
          this.render();
          this.notifySelectionChanged();
          event.preventDefault();
        }
        break;
      default:
        break;
    }
  };

  beginDrawing(tool, point, pointerId) {
    this.svg.setPointerCapture(pointerId);
    if (tool === "line") {
      this.beginLineDrawing(point, pointerId);
      return;
    }
    const shape = createShape(tool, point, DEFAULT_STYLE);
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
      this.state.selectedShapeId = shape.id;
      this.notifySelectionChanged();
    } else {
      this.state.selectedShapeId = null;
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
          x: clampUnit(last.x),
          y: clampUnit(last.y)
        };
        shape.points.push({ ...start });
      } else {
        continuing = false;
      }
    }
    if (!continuing || !shape) {
      shape = createShape("line", point, DEFAULT_STYLE);
      shape.points[1] = { x: clampUnit(point.x), y: clampUnit(point.y) };
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
      this.state.selectedShapeId = shape.id;
      this.notifySelectionChanged();
    } else {
      this.state.selectedShapeId = null;
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
    } else if (tool === "line") {
      const lastIndex = shape.points.length - 1;
      shape.points[lastIndex] = { x: clampUnit(point.x), y: clampUnit(point.y) };
    } else if (tool === "freehand") {
      const last = this.session.lastPoint;
      if (distanceBetween(last, point) >= MIN_DRAW_DISTANCE) {
        shape.points.push({ x: clampUnit(point.x), y: clampUnit(point.y) });
      }
    }
    this.session.lastPoint = { ...point };
    this.shapeStore?.write(shape);
    this.renderShapes();
  }

  finalizeDrawing(event) {
    const { shape, tool } = this.session;
    if (!shape) return;
    let keep = true;
    if (shape.type === "rect" || shape.type === "ellipse") {
      keep = shape.width >= MIN_SHAPE_DIMENSION && shape.height >= MIN_SHAPE_DIMENSION;
    } else if (shape.type === "line") {
      shape.points = shape.points.map((point) => ({
        x: clampUnit(point.x),
        y: clampUnit(point.y)
      }));
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
        shape.points = smoothPolylinePoints(shape.points, 1, Boolean(shape.closed));
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
    this.state.selectedShapeId = shouldAutoSelect ? shape.id : null;
    this.render();
    this.notifyShapesChanged();
    this.notifySelectionChanged();
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
    if (this.state.selectedShapeId === shapeId) {
      this.state.selectedShapeId = null;
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
    const id = this.state.selectedShapeId;
    const selectedShape = id ? cloneShape(this.shapeStore?.read(id)) : null;
    this.emit("selectionchange", {
      selection: id ? [id] : [],
      shapes: selectedShape ? [selectedShape] : [],
      rotation: 0,
      frame: null
    });
  }

  selectShape(shapeId) {
    if (!shapeId) {
      if (this.state.selectedShapeId !== null) {
        this.state.selectedShapeId = null;
        this.render();
        this.notifySelectionChanged();
      }
      return;
    }
    const exists = this.shapeStore?.read(shapeId);
    if (!exists) return;
    if (this.state.selectedShapeId === shapeId) return;
    this.state.selectedShapeId = shapeId;
    this.render();
    this.notifySelectionChanged();
  }

  deleteShape(shapeId) {
    if (!shapeId) return;
    if (!this.shapeStore?.read(shapeId)) return;
    this.removeShape(shapeId);
    this.render();
    this.notifyShapesChanged();
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
    const selectedId = this.state.selectedShapeId;
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
      node.classList.toggle("is-selected", selectedId === shapeId);
    });
  }

  getNormalizedPoint(event, { clamp = true } = {}) {
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return null;
    const mapped = point.matrixTransform(ctm.inverse());
    const normalized = {
      x: mapped.x / this.view.width,
      y: mapped.y / this.view.height
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
    const { x, y, width, height } = shape;
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
    const { x, y, width, height } = shape;
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
