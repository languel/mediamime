const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_SHAPE_DIMENSION = 0.01; // Normalised units (0–1)
const MIN_DRAW_DISTANCE = 0.0025;
const LINE_CLOSE_THRESHOLD = 0.02;
const ERASER_TOLERANCE = 0.02;
const FREEHAND_SIMPLIFY_TOLERANCE = 0.0015;
const ROTATION_HANDLE_OFFSET = 0.06;
const VERTEX_HANDLE_RADIUS = 6;
const DEFAULT_STYLE = {
  stroke: "rgba(82, 213, 255, 0.92)",
  fill: "rgba(82, 213, 255, 0.14)",
  strokeWidth: 2
};

const HANDLE_DEFINITIONS = [
  { id: "nw", x: -0.5, y: -0.5, cursor: "nwse-resize" },
  { id: "n", x: 0, y: -0.5, cursor: "ns-resize" },
  { id: "ne", x: 0.5, y: -0.5, cursor: "nesw-resize" },
  { id: "e", x: 0.5, y: 0, cursor: "ew-resize" },
  { id: "se", x: 0.5, y: 0.5, cursor: "nwse-resize" },
  { id: "s", x: 0, y: 0.5, cursor: "ns-resize" },
  { id: "sw", x: -0.5, y: 0.5, cursor: "nesw-resize" },
  { id: "w", x: -0.5, y: 0, cursor: "ew-resize" }
];

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
      selection: new Set(),
      selectionRotation: 0,
      selectionFrame: null
    };
    this.shapeStore = null;
    this.overlay = null;
    this.session = null;
    this.events = new Map();
    this.pendingLine = null;
    this.lockButton = document.getElementById("gesture-tool-lock") || this.toolbar.querySelector("#gesture-tool-lock");
    this.modeToggle = document.getElementById("gesture-mode-toggle") || this.toolbar.querySelector("#gesture-mode-toggle");
    this.clearButton = document.getElementById("gesture-clear") || this.toolbar.querySelector("#gesture-clear");
    this.toolbarHidden = false;
    this.vertexEdit = null;
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
        selection: Array.from(this.state.selection)
      }),
      setTool: (tool) => this.setTool(tool),
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
    let overlayLayer = this.svg.querySelector('[data-layer="overlay"]');
    if (!shapesLayer) {
      shapesLayer = createSvgElement("g", { "data-layer": "shapes" });
      this.svg.appendChild(shapesLayer);
    }
    if (!overlayLayer) {
      overlayLayer = createSvgElement("g", { "data-layer": "overlay", class: "editor-overlay" });
      this.svg.appendChild(overlayLayer);
    }
    this.shapesLayer = shapesLayer;
    this.overlayLayer = overlayLayer;
    this.overlay = buildSelectionOverlay();
    overlayLayer.appendChild(this.overlay.root);
    if (this.overlay.container) {
      this.overlay.container.style.display = "none";
    }
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
    if (tool !== "select") {
      this.disableVertexEditing();
    }
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
      if (this.session.type === "draw") {
        this.abortDrawing();
      } else if (this.session.type === "transform") {
        this.cancelTransform();
      } else if (this.session.type === "marquee") {
        this.clearMarquee();
      } else if (this.session.type === "vertex") {
        this.cancelVertexDrag();
      } else if (this.session.type === "erase") {
        if (!this.state.toolLocked) {
          this.setTool("select");
        }
      }
      this.session = null;
    }
    this.state.mode = mode;
    if (mode === "perform") {
      this.pendingLine = null;
      this.disableVertexEditing();
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
    this.disableVertexEditing();
    this.shapeStore.clear();
    this.state.selection.clear();
    this.state.selectionFrame = null;
    this.state.selectionRotation = 0;
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
    const target = event.target;
    const rawPoint = this.getNormalizedPoint(event, { clamp: false });
    const point = {
      x: clampUnit(rawPoint.x),
      y: clampUnit(rawPoint.y)
    };

    const vertexIndexAttr = target?.dataset?.vertexIndex;
    if (vertexIndexAttr !== undefined) {
      const vertexShapeId = target?.dataset?.vertexShape || this.vertexEdit?.shapeId;
      const vertexIndex = Number(vertexIndexAttr);
      if (
        this.vertexEdit &&
        vertexShapeId &&
        this.vertexEdit.shapeId === vertexShapeId &&
        Number.isInteger(vertexIndex)
      ) {
        event.preventDefault();
        this.svg.setPointerCapture(event.pointerId);
        this.startVertexDrag({
          shapeId: vertexShapeId,
          pointerId: event.pointerId,
          vertexIndex
        });
        return;
      }
    }

    // Rotation handle or transform handle interactions
    if (target?.dataset?.handle) {
      event.preventDefault();
      this.svg.setPointerCapture(event.pointerId);
      this.startTransformSession({
        mode: target.dataset.handle === "rotate" ? "rotate" : "scale",
        handle: target.dataset.handle,
        pointerId: event.pointerId,
        origin: point,
        originRaw: rawPoint
      });
      return;
    }

    const shapeId = target?.closest?.("[data-shape-id]")?.dataset?.shapeId;
    const tool = this.state.tool;

    if (tool === "select") {
      const shape = shapeId ? this.shapeStore?.read(shapeId) : null;
      const isMetaKey = Boolean(event.metaKey);
      const isCtrlKey = Boolean(event.ctrlKey);
      const optionMapping = Boolean(
        shapeId && event.altKey && !event.shiftKey && !isMetaKey && !isCtrlKey
      );
      const subtract = !optionMapping && (event.altKey || event.key === "AltGraph");
      const supportsVertexEdit = Boolean(shape && (shape.type === "line" || shape.type === "path"));
      const wantsVertexEdit = Boolean(shapeId && supportsVertexEdit && isMetaKey && !event.shiftKey && !subtract);
      const extend = event.shiftKey || (!wantsVertexEdit && (isMetaKey || isCtrlKey));
      if (shapeId) {
        if (wantsVertexEdit) {
          if (this.state.selection.size !== 1 || !this.state.selection.has(shapeId)) {
            this.updateSelection(shapeId);
          }
          this.enableVertexEditing(shapeId);
          event.preventDefault();
          return;
        }
        if (optionMapping) {
          this.disableVertexEditing();
          if (this.state.selection.size !== 1 || !this.state.selection.has(shapeId)) {
            this.updateSelection(shapeId);
          }
          const shapeSnapshot = cloneShape(this.shapeStore?.read(shapeId));
          if (shapeSnapshot) {
            this.emit("mappingrequest", {
              shapeId,
              shape: shapeSnapshot,
              pointer: {
                clientX: event.clientX,
                clientY: event.clientY,
                x: point.x,
                y: point.y
              }
            });
          }
          event.preventDefault();
          return;
        }
        this.disableVertexEditing();
        this.updateSelection(shapeId, { extend, subtract });
        if (!this.state.selection.size) {
          return;
        }
        this.svg.setPointerCapture(event.pointerId);
        event.preventDefault();
        this.startTransformSession({
          mode: "move",
          handle: "move",
          pointerId: event.pointerId,
          origin: point,
          originRaw: rawPoint
        });
        return;
      }
      const initialSelection = new Set(this.state.selection);
      const hadSelection = this.state.selection.size > 0;
      if (hadSelection) {
        this.computeSelectionFrame();
      }
      const pointerInsideSelection = hadSelection && this.isPointInsideSelection(point);
      if (pointerInsideSelection && !extend && !subtract) {
        this.disableVertexEditing();
        event.preventDefault();
        this.svg.setPointerCapture(event.pointerId);
        this.startTransformSession({
          mode: "move",
          handle: "move",
          pointerId: event.pointerId,
          origin: point,
          originRaw: rawPoint
        });
        return;
      }
      if (!extend && !subtract && hadSelection) {
        this.disableVertexEditing();
        this.state.selection.clear();
        this.state.selectionFrame = null;
        this.state.selectionRotation = 0;
        this.render();
        this.notifySelectionChanged();
      }
      if (this.state.selection.size) {
        this.computeSelectionFrame();
      }
      this.disableVertexEditing();
      this.svg.setPointerCapture(event.pointerId);
      this.startMarqueeSession({
        pointerId: event.pointerId,
        origin: point,
        originRaw: rawPoint,
        extend,
        subtract,
        initialSelection
      });
      event.preventDefault();
      return;
    }

    if (tool === "hand") {
      // Future: implement pan/zoom
      return;
    }

    if (tool === "eraser") {
      this.disableVertexEditing();
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
      this.disableVertexEditing();
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
    if (this.session.type === "draw") {
      event.preventDefault();
      this.updateDrawing(point);
    } else if (this.session.type === "transform") {
      event.preventDefault();
      this.updateTransform(point, rawPoint, event);
    } else if (this.session.type === "vertex") {
      event.preventDefault();
      this.updateVertexDrag(point);
    } else if (this.session.type === "marquee") {
      event.preventDefault();
      this.updateMarquee(point, rawPoint);
    } else if (this.session.type === "erase") {
      event.preventDefault();
      const erasedId = this.eraseAtPoint(point, { tolerance: ERASER_TOLERANCE, skip: this.session.erased });
      if (erasedId) {
        this.session.erased.add(erasedId);
      }
    }
  };

  handlePointerUp = (event) => {
    if (this.session && event.pointerId === this.session.pointerId) {
      if (this.session.type === "draw") {
        this.finalizeDrawing(event);
      } else if (this.session.type === "transform") {
        this.finishTransform();
      } else if (this.session.type === "marquee") {
        this.finishMarqueeSelection();
      } else if (this.session.type === "vertex") {
        this.finishVertexDrag();
      } else if (this.session.type === "erase") {
        if (!this.state.toolLocked) {
          this.setTool("select");
        }
      }
      this.session = null;
    }
    if (this.svg.hasPointerCapture(event.pointerId)) {
      this.svg.releasePointerCapture(event.pointerId);
    }
  };

  handlePointerCancel = (event) => {
    if (this.session && event.pointerId === this.session.pointerId) {
      if (this.session.type === "draw") {
        this.abortDrawing();
      } else if (this.session.type === "transform") {
        this.cancelTransform();
      } else if (this.session.type === "marquee") {
        this.clearMarquee();
      } else if (this.session.type === "vertex") {
        this.cancelVertexDrag();
      } else if (this.session.type === "erase") {
        if (!this.state.toolLocked) {
          this.setTool("select");
        }
      }
      this.session = null;
    }
    if (this.svg.hasPointerCapture(event.pointerId)) {
      this.svg.releasePointerCapture(event.pointerId);
    }
  };

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
        } else if (this.state.selection.size) {
          this.disableVertexEditing();
          this.state.selection.clear();
          this.state.selectionFrame = null;
          this.state.selectionRotation = 0;
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
      this.state.selection = new Set([shape.id]);
      this.state.selectionRotation = 0;
    } else {
      this.state.selection = new Set();
      this.state.selectionFrame = null;
      this.state.selectionRotation = 0;
    }
    this.renderSelection();
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
      this.state.selection = new Set([shape.id]);
      this.state.selectionRotation = 0;
    } else {
      this.state.selection = new Set();
      this.state.selectionFrame = null;
      this.state.selectionRotation = 0;
    }
    this.renderSelection();
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
    this.renderSelection();
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
    if (shouldAutoSelect) {
      this.state.selection = new Set([shape.id]);
      this.state.selectionRotation = shape.rotation || 0;
    } else {
      this.state.selection = new Set();
      this.state.selectionFrame = null;
      this.state.selectionRotation = 0;
    }
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
    this.state.selection.delete(shapeId);
    if (this.pendingLine?.shapeId === shapeId) {
      this.pendingLine = null;
    }
    if (this.vertexEdit?.shapeId === shapeId) {
      this.disableVertexEditing();
    }
  }

  startTransformSession({ mode, handle, pointerId, origin, originRaw }) {
    if (!this.state.selection.size) return;
    const frame = this.computeSelectionFrame();
    if (!frame) return;
    const store = this.shapeStore;
    const selected = store
      ? Array.from(this.state.selection)
          .map((id) => store.read(id))
          .filter(Boolean)
      : [];
    if (!selected.length) return;
    this.session = {
      type: "transform",
      mode,
      handle,
      pointerId,
      origin,
      originRaw: originRaw || origin,
      initialFrame: frame,
      frame,
      initialSelectionRotation: this.state.selectionRotation,
      shapes: selected.map((shape) => snapshotShape(shape, frame))
    };
  }

  updateTransform(point, rawPoint, pointerEvent) {
    if (!this.session || this.session.type !== "transform") return;
    if (!this.state.selection.size) return;
    const session = this.session;
    if (session.mode === "move") {
      const dx = (rawPoint?.x ?? point.x) - session.originRaw.x;
      const dy = (rawPoint?.y ?? point.y) - session.originRaw.y;
      this.applyMove(session, dx, dy);
    } else if (session.mode === "rotate") {
      const snap = Boolean(pointerEvent?.shiftKey);
      this.applyRotation(session, rawPoint || point, { snap });
    } else {
      const preserveAspect = Boolean(pointerEvent?.shiftKey);
      this.applyScale(session, rawPoint || point, { preserveAspect });
    }
    this.renderShapes();
    this.renderSelection();
  }

  finishTransform() {
    if (!this.session || this.session.type !== "transform") return;
    this.notifyShapesChanged();
    this.notifySelectionChanged();
  }

  cancelTransform() {
    if (!this.session || this.session.type !== "transform") return;
    // Restore snapshots
    this.session.shapes.forEach((snapshot) => restoreShapeSnapshot(this.shapeStore, snapshot));
    this.state.selectionRotation = this.session.initialSelectionRotation;
    this.state.selectionFrame = this.session.initialFrame;
    this.render();
  }

  applyMove(session, dx, dy) {
    const frame = {
      ...session.initialFrame,
      centerX: session.initialFrame.centerX + dx,
      centerY: session.initialFrame.centerY + dy
    };
    session.frame = frame;
    this.state.selectionFrame = frame;
    this.state.selectionRotation = session.initialSelectionRotation;
    session.shapes.forEach((snapshot) => {
      const shape = this.shapeStore?.read(snapshot.id);
      if (!shape) return;
      applySnapshotTransform(shape, snapshot, {
        rotation: session.initialSelectionRotation,
        scaleX: 1,
        scaleY: 1,
        frame
      });
      this.shapeStore?.write(shape);
    });
  }

  applyRotation(session, point, { snap = false } = {}) {
    const frame = session.initialFrame;
    const center = { x: frame.centerX, y: frame.centerY };
    const origin = session.originRaw || session.origin;
    const startAngle = Math.atan2(origin.y - center.y, origin.x - center.x);
    const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
    let delta = currentAngle - startAngle;
    if (snap && !Number.isNaN(delta)) {
      const snap = Math.PI / 12;
      delta = Math.round(delta / snap) * snap;
    }
    const rotation = normalizeAngle(session.initialSelectionRotation + delta);
    const rotationDelta = normalizeAngle(rotation - session.initialSelectionRotation);
    this.state.selectionRotation = rotation;
    const newFrame = { ...frame, rotation };
    session.frame = newFrame;
    this.state.selectionFrame = newFrame;
    session.shapes.forEach((snapshot) => {
      const shape = this.shapeStore?.read(snapshot.id);
      if (!shape) return;
      applySnapshotTransform(shape, snapshot, {
        rotation,
        scaleX: 1,
        scaleY: 1,
        frame: newFrame
      });
      if (shape.type === "rect" || shape.type === "ellipse") {
        shape.rotation = normalizeAngle(snapshot.rotation + rotationDelta);
      }
      this.shapeStore?.write(shape);
    });
  }

  applyScale(session, point, { preserveAspect = false } = {}) {
    const baseFrame = session.initialFrame;
    const baseRotation = baseFrame.rotation;
    const localPointer = toSelectionLocal(point, baseFrame);

    const handle = session.handle;
    const affectsX = /[ew]/.test(handle);
    const affectsY = /[ns]/.test(handle);
    const signX = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
    const signY = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;

    const baseHalfWidth = baseFrame.width / 2;
    const baseHalfHeight = baseFrame.height / 2;

    const anchorLocal = {
      x: affectsX ? -signX * baseHalfWidth : 0,
      y: affectsY ? -signY * baseHalfHeight : 0
    };
    const handleLocalStart = {
      x: affectsX ? signX * baseHalfWidth : 0,
      y: affectsY ? signY * baseHalfHeight : 0
    };

    const deltaHandleX = handleLocalStart.x - anchorLocal.x;
    const deltaHandleY = handleLocalStart.y - anchorLocal.y;

    let scaleX = affectsX && deltaHandleX !== 0
      ? (Number.isFinite(localPointer.x) ? localPointer.x - anchorLocal.x : 0) / deltaHandleX
      : 1;
    let scaleY = affectsY && deltaHandleY !== 0
      ? (Number.isFinite(localPointer.y) ? localPointer.y - anchorLocal.y : 0) / deltaHandleY
      : 1;

    const minScaleX = MIN_SHAPE_DIMENSION / Math.max(MIN_SHAPE_DIMENSION, baseFrame.width);
    const minScaleY = MIN_SHAPE_DIMENSION / Math.max(MIN_SHAPE_DIMENSION, baseFrame.height);

    if (affectsX) {
      if (!Number.isFinite(scaleX)) scaleX = 0;
      const sign = Math.sign(scaleX) || Math.sign(deltaHandleX) || 1;
      const magnitude = Math.max(Math.abs(scaleX), minScaleX);
      scaleX = sign * magnitude;
    } else {
      scaleX = preserveAspect ? scaleX : 1;
    }

    if (affectsY) {
      if (!Number.isFinite(scaleY)) scaleY = 0;
      const sign = Math.sign(scaleY) || Math.sign(deltaHandleY) || 1;
      const magnitude = Math.max(Math.abs(scaleY), minScaleY);
      scaleY = sign * magnitude;
    } else {
      scaleY = preserveAspect ? scaleY : 1;
    }

    if (preserveAspect) {
      const currentMagX = affectsX ? Math.abs(scaleX) : 0;
      const currentMagY = affectsY ? Math.abs(scaleY) : 0;
      const target = Math.max(currentMagX, currentMagY, minScaleX, minScaleY);
      if (affectsX && affectsY) {
        scaleX = (Math.sign(scaleX) || 1) * target;
        scaleY = (Math.sign(scaleY) || 1) * target;
      } else if (affectsX) {
        const sign = Math.sign(scaleX) || 1;
        const uniformSign = Math.sign(scaleY) || sign;
        scaleX = sign * target;
        scaleY = uniformSign * target;
      } else if (affectsY) {
        const sign = Math.sign(scaleY) || 1;
        const uniformSign = Math.sign(scaleX) || sign;
        scaleY = sign * target;
        scaleX = uniformSign * target;
      }
    }

    const newCenterLocal = {
      x: anchorLocal.x * (1 - scaleX),
      y: anchorLocal.y * (1 - scaleY)
    };

    const newCenter = fromSelectionLocal(newCenterLocal, baseFrame);
    const width = Math.max(MIN_SHAPE_DIMENSION, Math.abs(baseFrame.width * scaleX));
    const height = Math.max(MIN_SHAPE_DIMENSION, Math.abs(baseFrame.height * scaleY));

    const newFrame = {
      centerX: newCenter.x,
      centerY: newCenter.y,
      width,
      height,
      rotation: baseRotation
    };

    session.frame = newFrame;
    this.state.selectionFrame = newFrame;
    this.state.selectionRotation = baseRotation;

    const shapeScaleX = (affectsX || preserveAspect) ? scaleX : 1;
    const shapeScaleY = (affectsY || preserveAspect) ? scaleY : 1;

    session.shapes.forEach((snapshot) => {
      const shape = this.shapeStore?.read(snapshot.id);
      if (!shape) return;
      applySnapshotTransform(shape, snapshot, {
        rotation: baseRotation,
        scaleX: shapeScaleX,
        scaleY: shapeScaleY,
        frame: newFrame
      });
      this.shapeStore?.write(shape);
    });

    const nextSelectionRotation = this.deriveSelectionRotation();
    const frameWithRotation = { ...newFrame, rotation: nextSelectionRotation };
    this.state.selectionRotation = nextSelectionRotation;
    this.state.selectionFrame = frameWithRotation;
    session.frame = frameWithRotation;
  }

  startMarqueeSession({ pointerId, origin, originRaw, extend, subtract, initialSelection }) {
    this.session = {
      type: "marquee",
      pointerId,
      origin: { ...origin },
      originRaw: originRaw ? { ...originRaw } : { ...origin },
      current: { ...origin },
      currentRaw: originRaw ? { ...originRaw } : { ...origin },
      extend: Boolean(extend),
      subtract: Boolean(subtract),
      initialSelection: initialSelection ? new Set(initialSelection) : new Set(this.state.selection)
    };
    this.renderMarquee(this.session);
    this.renderSelection();
    this.renderSelection();
  }

  updateMarquee(point, rawPoint) {
    if (!this.session || this.session.type !== "marquee") return;
    this.session.current = { ...point };
    this.session.currentRaw = rawPoint ? { ...rawPoint } : { ...point };
    this.renderMarquee(this.session);
  }

  finishMarqueeSelection() {
    if (!this.session || this.session.type !== "marquee") {
      this.clearMarquee();
      return;
    }
    const session = this.session;
    const rect = {
      minX: Math.min(session.origin.x, session.current.x),
      minY: Math.min(session.origin.y, session.current.y),
      maxX: Math.max(session.origin.x, session.current.x),
      maxY: Math.max(session.origin.y, session.current.y)
    };
    const epsilon = 1e-4;
    if ((rect.maxX - rect.minX) < epsilon && (rect.maxY - rect.minY) < epsilon) {
      this.clearMarquee();
      return;
    }
    const hits = this.getShapesInRect(rect);
    let nextSelection;
    if (session.subtract) {
      nextSelection = new Set(session.initialSelection || []);
      hits.forEach((id) => nextSelection.delete(id));
    } else if (session.extend) {
      nextSelection = new Set(session.initialSelection || []);
      hits.forEach((id) => nextSelection.add(id));
    } else {
      nextSelection = new Set(hits);
    }
    this.state.selection = nextSelection;
    this.state.selectionRotation = this.deriveSelectionRotation();
    // Ensure marquee state no longer suppresses the selection overlay before rendering updates.
    this.session = null;
    this.computeSelectionFrame();
    this.render();
    this.notifySelectionChanged();
    this.clearMarquee();
  }

  clearMarquee() {
    this.renderMarquee(null);
    this.renderSelection();
  }

  renderMarquee(session) {
    const marquee = this.overlay?.marquee;
    if (!marquee) return;
    if (!session) {
      marquee.classList.add("is-hidden");
      return;
    }
    const viewWidth = this.view.width;
    const viewHeight = this.view.height;
    const minX = Math.min(session.origin.x, session.current.x);
    const minY = Math.min(session.origin.y, session.current.y);
    const maxX = Math.max(session.origin.x, session.current.x);
    const maxY = Math.max(session.origin.y, session.current.y);
    const width = Math.max(0, maxX - minX) * viewWidth;
    const height = Math.max(0, maxY - minY) * viewHeight;
    if (width <= 0 || height <= 0) {
      marquee.classList.add("is-hidden");
      return;
    }
    marquee.classList.remove("is-hidden");
    marquee.setAttribute("x", minX * viewWidth);
    marquee.setAttribute("y", minY * viewHeight);
    marquee.setAttribute("width", width);
    marquee.setAttribute("height", height);
  }

  getShapesInRect(rect) {
    const hits = [];
    if (!this.shapeStore) return hits;
    this.shapeStore.order.forEach((shapeId) => {
      const shape = this.shapeStore.read(shapeId);
      if (!shape) return;
      const bounds = getShapeBounds(shape);
      if (bounds && boundsIntersect(bounds, rect)) {
        hits.push(shapeId);
      }
    });
    return hits;
  }

  updateSelection(shapeId, { extend = false, subtract = false } = {}) {
    this.disableVertexEditing();
    if (!extend && !subtract) {
      this.state.selection = new Set([shapeId]);
    } else if (subtract) {
      this.state.selection.delete(shapeId);
    } else if (extend) {
      this.state.selection.add(shapeId);
    }
    const rotation = this.deriveSelectionRotation();
    this.state.selectionRotation = rotation;
    this.computeSelectionFrame();
    this.render();
    this.notifySelectionChanged();
  }

  isPointInsideSelection(point) {
    const frame = this.state.selectionFrame;
    if (!frame) return false;
    const local = toSelectionLocal(point, frame);
    const halfWidth = frame.width / 2;
    const halfHeight = frame.height / 2;
    return Math.abs(local.x) <= halfWidth && Math.abs(local.y) <= halfHeight;
  }


  notifyShapesChanged() {
    const shapes = this.shapeStore ? this.shapeStore.list().map(cloneShape) : [];
    this.emit("shapeschange", shapes);
  }

  notifySelectionChanged() {
    const frame = this.state.selectionFrame;
    const selectionIds = Array.from(this.state.selection);
    const selectedShapes = selectionIds
      .map((id) => cloneShape(this.shapeStore?.read(id)))
      .filter(Boolean);
    this.emit("selectionchange", {
      selection: selectionIds,
      shapes: selectedShapes,
      rotation: this.state.selectionRotation,
      frame: frame
        ? {
            centerX: frame.centerX,
            centerY: frame.centerY,
            width: frame.width,
            height: frame.height,
            rotation: frame.rotation
          }
        : null
    });
  }

  deriveSelectionRotation() {
    const ids = Array.from(this.state.selection);
    if (!ids.length) return 0;
    if (ids.length === 1) {
      const shape = this.shapeStore?.read(ids[0]);
      return normalizeAngle(shape?.rotation || 0);
    }
    return normalizeAngle(this.state.selectionRotation || 0);
  }

  computeSelectionFrame() {
    const ids = Array.from(this.state.selection);
    if (!ids.length) {
      this.state.selectionFrame = null;
      return null;
    }
    const store = this.shapeStore;
    const shapes = store ? ids.map((id) => store.read(id)).filter(Boolean) : [];
    if (!shapes.length) {
      this.state.selectionFrame = null;
      return null;
    }
    const rotation = normalizeAngle(this.state.selectionRotation || 0);
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    shapes.forEach((shape) => {
      const points = getShapePoints(shape);
      points.forEach((point) => {
        const rx = point.x * cos - point.y * sin;
        const ry = point.x * sin + point.y * cos;
        if (rx < minX) minX = rx;
        if (rx > maxX) maxX = rx;
        if (ry < minY) minY = ry;
        if (ry > maxY) maxY = ry;
      });
    });
    const centerRot = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
    const width = Math.max(MIN_SHAPE_DIMENSION, maxX - minX);
    const height = Math.max(MIN_SHAPE_DIMENSION, maxY - minY);
    const center = rotateVector(centerRot, rotation);
    const frame = {
      centerX: center.x,
      centerY: center.y,
      width,
      height,
      rotation
    };
    this.state.selectionFrame = frame;
    return frame;
  }

  render() {
    this.renderShapes();
    this.renderSelection();
    this.updateToolbar();
  }

  renderShapes() {
    if (!this.shapeStore) return;
    this.shapeStore.setView(this.view);
    const selection = this.state.selection;
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
      node.classList.toggle("is-selected", selection.has(shapeId));
    });
  }


  renderSelection() {
    const frame = this.computeSelectionFrame();
    const overlay = this.overlay;
    const marqueeActive = this.session && this.session.type === "marquee";
    if (!overlay) return;
    const showSelection = Boolean(frame && this.state.selection.size && !marqueeActive);
    if (!showSelection) {
      if (overlay.container) {
        overlay.container.style.display = "none";
      }
      if (!marqueeActive) {
        this.renderMarquee(null);
      }
      this.renderVertexHandles(null, false);
      return;
    }
    if (overlay.container) {
      overlay.container.style.display = "";
    }
    if (!marqueeActive) {
      this.renderMarquee(null);
    }
    const viewWidth = this.view.width;
    const viewHeight = this.view.height;
    const width = frame.width * viewWidth;
    const height = frame.height * viewHeight;
    const cx = frame.centerX * viewWidth;
    const cy = frame.centerY * viewHeight;

    overlay.container.setAttribute("transform", `translate(${cx}, ${cy}) rotate(${(frame.rotation * 180) / Math.PI})`);
    overlay.outline.setAttribute("x", -width / 2);
    overlay.outline.setAttribute("y", -height / 2);
    overlay.outline.setAttribute("width", width);
    overlay.outline.setAttribute("height", height);

    const HANDLE_SIZE = 10;
    const HALF_HANDLE = HANDLE_SIZE / 2;
    HANDLE_DEFINITIONS.forEach((handle) => {
      const element = overlay.handles.get(handle.id);
      if (!element) return;
      element.setAttribute("x", handle.x * width - HALF_HANDLE);
      element.setAttribute("y", handle.y * height - HALF_HANDLE);
      element.setAttribute("width", HANDLE_SIZE);
      element.setAttribute("height", HANDLE_SIZE);
    });

    const rotationHandle = overlay.handles.get("rotate");
    if (rotationHandle) {
      rotationHandle.setAttribute("cx", 0);
      rotationHandle.setAttribute("cy", (-height / 2) - ROTATION_HANDLE_OFFSET * viewHeight);
      rotationHandle.setAttribute("r", 8);
    }
    this.renderVertexHandles(frame, true);
  }

  renderVertexHandles(frame, showSelection) {
    const group = this.overlay?.vertices;
    if (!group) return;
    while (group.firstChild) {
      group.removeChild(group.firstChild);
    }
    if (!showSelection) return;
    if (!frame) return;
    if (!this.vertexEdit) return;
    if (this.state.selection.size !== 1 || !this.state.selection.has(this.vertexEdit.shapeId)) {
      this.disableVertexEditing();
      return;
    }
    const shape = this.shapeStore?.read(this.vertexEdit.shapeId);
    if (!shape || !Array.isArray(shape.points)) return;
    if (shape.type !== "line" && shape.type !== "path") return;
    const points = shape.points;
    if (!points.length) return;
    const viewWidth = this.view.width;
    const viewHeight = this.view.height;
    points.forEach((point, index) => {
      const local = toSelectionLocal(point, frame);
      const px = local.x * viewWidth;
      const py = local.y * viewHeight;
      if (!Number.isFinite(px) || !Number.isFinite(py)) return;
      const circle = createSvgElement("circle", {
        class: "editor-selection__vertex",
        "data-vertex-index": String(index),
        "data-vertex-shape": shape.id,
        cx: px,
        cy: py,
        r: VERTEX_HANDLE_RADIUS
      });
      circle.setAttribute("fill", "rgba(82, 213, 255, 0.8)");
      circle.setAttribute("stroke", "rgba(12, 143, 184, 0.9)");
      circle.setAttribute("stroke-width", "1.5");
      circle.setAttribute("pointer-events", "all");
      circle.style.cursor = "pointer";
      if (this.vertexEdit?.activeIndex === index) {
        circle.classList.add("is-active");
      }
      group.appendChild(circle);
    });
  }

  enableVertexEditing(shapeId) {
    const shape = this.shapeStore?.read(shapeId);
    if (!shape || (shape.type !== "line" && shape.type !== "path")) {
      this.disableVertexEditing();
      return;
    }
    this.vertexEdit = { shapeId, activeIndex: null };
    this.renderSelection();
  }

  disableVertexEditing() {
    if (!this.vertexEdit) return;
    this.vertexEdit = null;
    const group = this.overlay?.vertices;
    if (group) {
      while (group.firstChild) {
        group.removeChild(group.firstChild);
      }
    }
  }

  startVertexDrag({ shapeId, pointerId, vertexIndex }) {
    const shape = this.shapeStore?.read(shapeId);
    if (!shape || !Array.isArray(shape.points)) return;
    if (!this.vertexEdit || this.vertexEdit.shapeId !== shapeId) {
      this.enableVertexEditing(shapeId);
    }
    this.vertexEdit = { shapeId, activeIndex: vertexIndex };
    this.session = {
      type: "vertex",
      pointerId,
      shapeId,
      vertexIndex,
      originalPoints: shape.points.map((point) => ({ x: point.x, y: point.y }))
    };
    this.renderSelection();
  }

  updateVertexDrag(point) {
    if (!this.session || this.session.type !== "vertex") return;
    const shape = this.shapeStore?.read(this.session.shapeId);
    if (!shape || !Array.isArray(shape.points)) return;
    const index = this.session.vertexIndex;
    if (index < 0 || index >= shape.points.length) return;
    const newPoint = {
      x: clampUnit(point.x),
      y: clampUnit(point.y)
    };
    shape.points[index] = newPoint;
    if (shape.closed && shape.points.length >= 2) {
      if (index === 0) {
        shape.points[shape.points.length - 1] = { ...newPoint };
      } else if (index === shape.points.length - 1) {
        shape.points[0] = { ...newPoint };
      }
    }
    this.shapeStore?.write(shape);
    this.renderSelection();
  }

  finishVertexDrag() {
    if (!this.session || this.session.type !== "vertex") return;
    if (this.vertexEdit && this.vertexEdit.shapeId === this.session.shapeId) {
      this.vertexEdit.activeIndex = null;
    }
    this.render();
    this.notifyShapesChanged();
    this.notifySelectionChanged();
  }

  cancelVertexDrag() {
    if (!this.session || this.session.type !== "vertex") return;
    const shape = this.shapeStore?.read(this.session.shapeId);
    if (shape && Array.isArray(shape.points)) {
      shape.points.length = 0;
      this.session.originalPoints.forEach((point) => {
        shape.points.push({ x: point.x, y: point.y });
      });
      this.shapeStore?.write(shape);
    }
    if (this.vertexEdit && this.vertexEdit.shapeId === this.session.shapeId) {
      this.vertexEdit.activeIndex = null;
    }
    this.render();
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
  if (tool === "rect") {
    return {
      id,
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
      id,
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
      id,
      type: "line",
      points: [{ x: point.x, y: point.y }, { x: point.x, y: point.y }],
      style: { ...style }
    };
  }
  return {
    id,
    type: "path",
    points: [{ x: point.x, y: point.y }],
    style: { ...style }
  };
}

function snapshotShape(shape, frame) {
  const center = getShapeCenter(shape);
  return {
    id: shape.id,
    type: shape.type,
    rotation: shape.rotation || 0,
    style: { ...(shape.style || {}) },
    localCenter: toSelectionLocal(center, frame),
    original: cloneShape(shape),
    localVertices: getShapePoints(shape).map((point) => toSelectionLocal(point, frame))
  };
}

function restoreShapeSnapshot(store, snapshot) {
  if (!store || !snapshot) return;
  const restored = cloneShape(snapshot.original);
  if (!restored) return;
  store.write(restored);
}

function applySnapshotTransform(shape, snapshot, transform) {
  const { rotation: frameRotation, scaleX, scaleY, frame } = transform;
  const newLocalCenter = {
    x: snapshot.localCenter.x * scaleX,
    y: snapshot.localCenter.y * scaleY
  };
  const newCenter = fromSelectionLocal(newLocalCenter, frame);
  if (shape.type === "rect" || shape.type === "ellipse") {
    const base = snapshot.original;
    const baseWidth = Math.max(MIN_SHAPE_DIMENSION, base.width);
    const baseHeight = Math.max(MIN_SHAPE_DIMENSION, base.height);
    const absScaleX = Math.abs(scaleX);
    const absScaleY = Math.abs(scaleY);
    const width = Math.max(baseWidth * absScaleX, MIN_SHAPE_DIMENSION);
    const height = Math.max(baseHeight * absScaleY, MIN_SHAPE_DIMENSION);
    shape.x = newCenter.x - width / 2;
    shape.y = newCenter.y - height / 2;
    shape.width = width;
    shape.height = height;
    const EPSILON = 1e-6;
    const isScaling = Math.abs(scaleX - 1) > EPSILON || Math.abs(scaleY - 1) > EPSILON;
    if (isScaling) {
      const relRotation = snapshot.rotation - frameRotation;
      const newRelRotation = Math.atan2(scaleY * Math.sin(relRotation), scaleX * Math.cos(relRotation));
      shape.rotation = normalizeAngle(newRelRotation + frameRotation);
    } else {
      shape.rotation = snapshot.rotation;
    }
  } else if (shape.type === "line") {
    const newPoints = snapshot.localVertices.map((vertex) => fromSelectionLocal({ x: vertex.x * scaleX, y: vertex.y * scaleY }, frame));
    shape.points = newPoints.map((point) => ({ x: point.x, y: point.y }));
    shape.closed = Boolean(snapshot.original.closed);
  } else if (shape.type === "path") {
    const newPoints = snapshot.localVertices.map((vertex) => fromSelectionLocal({ x: vertex.x * scaleX, y: vertex.y * scaleY }, frame));
    shape.points = newPoints.map((point) => ({ x: point.x, y: point.y }));
    shape.closed = Boolean(snapshot.original.closed);
  }
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

function fromSelectionLocal(point, frame) {
  const rotated = rotateVector(point, frame.rotation);
  return {
    x: frame.centerX + rotated.x,
    y: frame.centerY + rotated.y
  };
}

function distanceBetween(a, b) {
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  return Math.hypot(dx, dy);
}

function clampUnit(value) {
  return Math.min(1, Math.max(0, value));
}


function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
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
  if (type === "rect" || type === "ellipse") {
    const x = Number.parseFloat(node.dataset.shapeX || "0");
    const y = Number.parseFloat(node.dataset.shapeY || "0");
    const width = Number.parseFloat(node.dataset.shapeWidth || "0");
    const height = Number.parseFloat(node.dataset.shapeHeight || "0");
    return {
      id,
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
      type,
      points,
      closed,
      rotation,
      style: { stroke, fill, strokeWidth }
    };
  }
  return {
    id,
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

function buildSelectionOverlay() {
  const root = createSvgElement("g", { class: "editor-selection" });
  const marquee = createSvgElement("rect", {
    class: "editor-selection__marquee",
    x: 0,
    y: 0,
    width: 0,
    height: 0
  });
  marquee.classList.add("is-hidden");
  const container = createSvgElement("g", { class: "editor-selection__container" });
  const outline = createSvgElement("rect", {
    class: "editor-selection__outline",
    x: 0,
    y: 0,
    width: 0,
    height: 0
  });
  container.appendChild(outline);
  const handles = new Map();
  HANDLE_DEFINITIONS.forEach((handle) => {
    const square = createSvgElement("rect", {
      class: "editor-selection__handle",
      "data-handle": handle.id
    });
    square.style.cursor = handle.cursor;
    handles.set(handle.id, square);
    container.appendChild(square);
  });
  const vertexGroup = createSvgElement("g", { class: "editor-selection__vertices" });
  container.appendChild(vertexGroup);
  const rotateHandle = createSvgElement("circle", {
    class: "editor-selection__handle editor-selection__handle--rotate",
    "data-handle": "rotate"
  });
  rotateHandle.style.cursor = "grab";
  handles.set("rotate", rotateHandle);
  container.appendChild(rotateHandle);
  root.appendChild(marquee);
  root.appendChild(container);
  return { root, marquee, container, outline, handles, vertices: vertexGroup };
}
