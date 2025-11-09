import { createRgbaPicker } from "../ui/rgba-picker.js";

const PROCESS_OPTIONS = [
  { id: "pose", label: "Pose (MP)" },
  { id: "hands", label: "Hands (MP)" },
  { id: "face", label: "Face (MP)" },
  { id: "segmentation", label: "Segmentation" },
  { id: "depth", label: "Depth Map" },
  { id: "raw", label: "Raw Source" }
];

const DEFAULT_STREAM_COLOR = "#52d5ff";
const DEFAULT_STREAM_ALPHA = 0;
const DEFAULT_VIEWPORT = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });
const MIN_VIEWPORT_SIZE = 0.05;
const LAYERS_STATE_EVENT = "mediamime:layers-changed";
const LAYERS_STORAGE_KEY = "mediamime:layers";

const clampRange = (value, min, max) => {
  const number = Number.isFinite(value) ? value : Number.parseFloat(`${value}`) || 0;
  return Math.min(max, Math.max(min, number));
};

const clampUnit = (value) => clampRange(value, 0, 1);

const toFiniteNumber = (value, fallback = 0) => {
  if (Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(`${value}`);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatUnit = (value) => (Number.isFinite(value) ? value : 0).toFixed(2);

const normalizeHex = (value) => {
  if (typeof value !== "string") return DEFAULT_STREAM_COLOR;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_STREAM_COLOR;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (hex.length === 3 && /^[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex
      .split("")
      .map((char) => char + char)
      .join("")
      .toLowerCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }
  return DEFAULT_STREAM_COLOR;
};

const hexToRgb = (hex) => {
  const normalized = normalizeHex(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
};

const hexToRgba = (hex, alpha = 1) => {
  const { r, g, b } = hexToRgb(hex);
  const safeAlpha = clampUnit(alpha);
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (match) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[match]));

const createId = () => `layer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const cloneViewport = (viewport = DEFAULT_VIEWPORT) => ({
  x: viewport.x ?? DEFAULT_VIEWPORT.x,
  y: viewport.y ?? DEFAULT_VIEWPORT.y,
  w: viewport.w ?? DEFAULT_VIEWPORT.w,
  h: viewport.h ?? DEFAULT_VIEWPORT.h
});

const clampViewport = (viewport = DEFAULT_VIEWPORT) => {
  const safe = viewport || DEFAULT_VIEWPORT;
  const clampSize = (value, fallback) => {
    const number = toFiniteNumber(value, fallback);
    return clampRange(number, MIN_VIEWPORT_SIZE, Number.POSITIVE_INFINITY);
  };
  return {
    x: toFiniteNumber(safe.x, DEFAULT_VIEWPORT.x),
    y: toFiniteNumber(safe.y, DEFAULT_VIEWPORT.y),
    w: clampSize(safe.w, DEFAULT_VIEWPORT.w),
    h: clampSize(safe.h, DEFAULT_VIEWPORT.h)
  };
};

const createStream = (overrides = {}, inputs = []) => {
  const firstSource = overrides.sourceId || inputs[0]?.id || null;
  return {
    id: createId(),
    name: overrides.name || `Stream ${Math.floor(Math.random() * 90) + 10}`,
    enabled: overrides.enabled ?? true,
    preview: overrides.preview ?? true,
    sourceId: firstSource,
    process: overrides.process || PROCESS_OPTIONS[0].id,
    color: {
      hex: normalizeHex(overrides.color?.hex ?? DEFAULT_STREAM_COLOR),
      alpha: clampUnit(overrides.color?.alpha ?? DEFAULT_STREAM_ALPHA)
    },
    viewport: clampViewport(overrides.viewport ?? DEFAULT_VIEWPORT),
    viewportMode: overrides.viewportMode || "fit"
  };
};

const getProcessLabel = (value) => PROCESS_OPTIONS.find((option) => option.id === value)?.label || "Unassigned";

const dispatchLayersEvent = (streams) => {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(
    new CustomEvent(LAYERS_STATE_EVENT, {
      detail: {
        streams: streams.map((stream) => ({
          ...stream,
          viewport: clampViewport(stream.viewport),
          color: { ...stream.color }
        }))
      }
    })
  );
};

const persistStreams = (streams) => {
  if (typeof localStorage === "undefined") return;
  try {
    const payload = streams.map((stream) => {
      const safeViewport = clampViewport(stream.viewport || DEFAULT_VIEWPORT);
      return {
        id: stream.id,
        name: stream.name,
        enabled: Boolean(stream.enabled),
        preview: Boolean(stream.preview),
        sourceId: stream.sourceId || null,
        process: stream.process,
        color: {
          hex: normalizeHex(stream.color?.hex ?? DEFAULT_STREAM_COLOR),
          alpha: clampUnit(stream.color?.alpha ?? DEFAULT_STREAM_ALPHA)
        },
        viewport: safeViewport,
        viewportMode: stream.viewportMode === "custom" ? "custom" : "fit"
      };
    });
    localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[mediamime] Failed to persist streams", error);
  }
};

const loadStoredStreams = () => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LAYERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry, index) => ({
      id: entry.id || createId(),
      name: entry.name || `Stream ${index + 1}`,
      enabled: entry.enabled !== false,
      preview: entry.preview !== false,
      sourceId: entry.sourceId || null,
      process: PROCESS_OPTIONS.some((option) => option.id === entry.process) ? entry.process : PROCESS_OPTIONS[0].id,
      color: {
        hex: normalizeHex(entry.color?.hex ?? DEFAULT_STREAM_COLOR),
        alpha: clampUnit(entry.color?.alpha ?? DEFAULT_STREAM_ALPHA)
      },
      viewport: clampViewport(entry.viewport || DEFAULT_VIEWPORT),
      viewportMode: entry.viewportMode === "custom" ? "custom" : "fit"
    }));
  } catch (error) {
    console.warn("[mediamime] Failed to load stored streams", error);
    return [];
  }
};

export function initLayers({ editor }) {
  void editor;
  const listEl = document.getElementById("layer-stream-list");
  const emptyEl = document.getElementById("layer-empty");
  const detailForm = document.getElementById("layer-detail");
  const nameInput = document.getElementById("layer-stream-name");
  const enabledToggleBtn = document.getElementById("layer-stream-enabled-toggle");
  const previewToggleBtn = document.getElementById("layer-stream-preview-toggle");
  const sourceSelect = document.getElementById("layer-stream-source");
  const processSelect = document.getElementById("layer-stream-process");
  const fitToggle = document.getElementById("layer-viewport-fit");
  const fitToggleBtn = document.getElementById("layer-viewport-fit-toggle");
  const viewportInputs = {
    x: document.getElementById("layer-viewport-x"),
    y: document.getElementById("layer-viewport-y"),
    w: document.getElementById("layer-viewport-w"),
    h: document.getElementById("layer-viewport-h")
  };
  const fitButton = document.getElementById("layer-fit-viewport");
  const addButton = document.getElementById("layer-add-stream");
  const duplicateButton = document.getElementById("layer-duplicate-stream");
  const colorChip = document.getElementById("layer-color-chip");
  const colorPanel = document.getElementById("layer-color-panel");
  const colorPickerRoot = colorPanel?.querySelector('[data-rgba-picker]');
  // Listener registries (restored after refactor)
  const listeners = [];
  const popoverDisposers = [];
  const addListener = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };
  // inputListHandler is assigned later and used in dispose; declare upfront
  let inputListHandler = null;
  const registerColorPopover = (toggle, panel) => {
    if (!toggle || !panel) return;
    // Portal panel to body for positioning (avoid clipping)
    if (!panel.dataset.popoverPortal) {
      panel.dataset.popoverPortal = "true";
      panel.hidden = true;
      panel.classList.remove("is-open");
      panel.style.top = "-9999px";
      panel.style.left = "-9999px";
      try {
        document.body.appendChild(panel);
      } catch (error) {
        console.warn("[mediamime] Failed to portal color picker panel.", error);
      }
    }
    let isOpen = false;
    const repositionPanel = () => {
      if (!isOpen || !toggle || !panel) return;
      const margin = 12;
      const rect = toggle.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;
      panel.style.top = "-9999px";
      panel.style.left = "-9999px";
      const maxHeight = Math.max(180, window.innerHeight - margin * 2);
      panel.style.maxHeight = `${maxHeight}px`;
      const panelWidth = panel.offsetWidth;
      const panelHeight = Math.min(panel.offsetHeight, maxHeight);
      let top = rect.bottom + margin;
      let origin = "top right";
      if (top + panelHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - panelHeight - margin);
        origin = "bottom right";
      }
      let left = rect.left + rect.width - panelWidth;
      const minLeft = margin;
      const maxLeft = window.innerWidth - panelWidth - margin;
      left = Math.min(Math.max(left, minLeft), maxLeft);
      panel.style.top = `${Math.round(top)}px`;
      panel.style.left = `${Math.round(left)}px`;
      panel.style.setProperty("--color-popover-origin", origin);
    };
    const close = () => {
      if (!isOpen) return;
      isOpen = false;
      panel.classList.remove("is-open");
      panel.hidden = true;
      panel.style.top = "-9999px";
      panel.style.left = "-9999px";
      panel.style.removeProperty("--color-popover-origin");
      toggle.setAttribute("aria-expanded", "false");
      toggle.classList.remove("is-open");
      document.removeEventListener("pointerdown", handleGlobalPointerDown, true);
      window.removeEventListener("resize", repositionPanel);
      window.removeEventListener("scroll", repositionPanel, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
    const open = () => {
      if (isOpen || toggle.disabled) return;
      isOpen = true;
      panel.hidden = false;
      panel.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.classList.add("is-open");
      repositionPanel();
      requestAnimationFrame(repositionPanel);
      document.addEventListener("pointerdown", handleGlobalPointerDown, true);
      window.addEventListener("resize", repositionPanel);
      window.addEventListener("scroll", repositionPanel, true);
      document.addEventListener("keydown", handleKeyDown);
    };
    const handleToggle = (event) => {
      event.preventDefault();
      if (isOpen) {
        close();
      } else {
        open();
      }
    };
    const handleGlobalPointerDown = (event) => {
      if (!isOpen) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : null;
      const inside = panel.contains(event.target) || toggle.contains(event.target) || (path && (path.includes(panel) || path.includes(toggle)));
      if (!inside) close();
    };
    const stopPropagation = (event) => {
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      event.stopPropagation();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && isOpen) close();
    };
    toggle.addEventListener("click", handleToggle);
    panel.addEventListener("pointerdown", stopPropagation);
    panel.addEventListener("mousedown", stopPropagation);
    panel.addEventListener("touchstart", stopPropagation);
    panel.addEventListener("click", stopPropagation);
    popoverDisposers.push(() => {
      toggle.removeEventListener("click", handleToggle);
      panel.removeEventListener("pointerdown", stopPropagation);
      panel.removeEventListener("mousedown", stopPropagation);
      panel.removeEventListener("touchstart", stopPropagation);
      panel.removeEventListener("click", stopPropagation);
      document.removeEventListener("pointerdown", handleGlobalPointerDown, true);
      window.removeEventListener("resize", repositionPanel);
      window.removeEventListener("scroll", repositionPanel, true);
      document.removeEventListener("keydown", handleKeyDown);
    });
  };

  const state = {
    streams: [],
    activeId: null,
    inputs: [],
    isSyncing: false,
    colorPicker: null,
    viewportEditing: { x: null, y: null, w: null, h: null }
  };

  const getActiveStream = () => state.streams.find((stream) => stream.id === state.activeId) || null;

  const getSourceLabel = (stream) => {
    if (!stream?.sourceId) return "-"; // No source selected
    const source = state.inputs.find((input) => input.id === stream.sourceId);
    if (!source) return "-"; // Missing or removed source
    return `${source.name || source.id}`; // Only source label
  };

  const updateActionButtons = () => {
    const hasActive = Boolean(getActiveStream());
    if (duplicateButton) duplicateButton.disabled = !hasActive;
    if (fitButton) fitButton.disabled = !hasActive;
    if (fitToggleBtn) fitToggleBtn.disabled = !hasActive;
  };

  const updateEmptyState = () => {
    if (!emptyEl) return;
    emptyEl.style.display = state.streams.length ? "none" : "block";
  };

  const populateProcessOptions = () => {
    if (!processSelect) return;
    processSelect.innerHTML = PROCESS_OPTIONS.map((option) => `<option value="${option.id}">${option.label}</option>`).join("");
  };

  const populateSourceOptions = (activeStream) => {
    if (!sourceSelect) return;
    if (!state.inputs.length) {
      sourceSelect.innerHTML = '<option value="">No sources available</option>';
      sourceSelect.disabled = true;
      return;
    }
    const options = ['<option value="">Select source</option>'].concat(
      state.inputs.map((input) => `<option value="${input.id}">${escapeHtml(input.name || input.id)}</option>`)
    );
    sourceSelect.innerHTML = options.join("");
    sourceSelect.disabled = !activeStream;
    if (activeStream?.sourceId && state.inputs.some((input) => input.id === activeStream.sourceId)) {
      sourceSelect.value = activeStream.sourceId;
    } else {
      sourceSelect.value = "";
    }
  };

  const updateColorDisplay = (stream) => {
    if (!stream) return;
    const chipColor = hexToRgba(stream.color.hex, stream.color.alpha);
    if (colorChip) {
      colorChip.style.setProperty("--chip-color", chipColor);
      colorChip.disabled = false;
    }
    if (colorPickerRoot) {
      colorPickerRoot.style.setProperty("--rgba-color", chipColor);
    }
  };

  const syncColorPicker = (stream) => {
    if (!state.colorPicker) return;
    if (!stream) {
      state.colorPicker.setDisabled(true);
      return;
    }
    state.colorPicker.setDisabled(false);
    state.colorPicker.setColor(stream.color.hex, stream.color.alpha, { emit: false, source: "program" });
  };

  const setViewportInputsDisabled = (disabled) => {
    Object.values(viewportInputs).forEach((input) => {
      if (input) input.disabled = disabled;
    });
  };

  const syncDetailForm = () => {
    if (!detailForm) return;
    const stream = getActiveStream();
    detailForm.classList.toggle("is-visible", Boolean(stream));
    detailForm.hidden = !stream;
    if (!stream) {
      if (colorChip) colorChip.disabled = true;
      if (sourceSelect) sourceSelect.disabled = true;
      updateActionButtons();
      return;
    }
    state.isSyncing = true;
    if (nameInput) nameInput.value = stream.name || "";
    if (enabledToggleBtn) {
      const on = Boolean(stream.enabled);
      enabledToggleBtn.setAttribute("aria-pressed", String(on));
      enabledToggleBtn.classList.toggle("is-active", on);
      const iconEl = enabledToggleBtn.querySelector(".material-icons-outlined");
      if (iconEl) iconEl.textContent = on ? "toggle_on" : "toggle_off";
      enabledToggleBtn.title = on ? "Disable stream" : "Enable stream";
      enabledToggleBtn.setAttribute("aria-label", on ? "Disable stream" : "Enable stream");
    }
    if (previewToggleBtn) {
      const show = stream.preview !== false;
      previewToggleBtn.setAttribute("aria-pressed", String(show));
      previewToggleBtn.classList.toggle("is-active", show);
      const iconEl = previewToggleBtn.querySelector(".material-icons-outlined");
      if (iconEl) iconEl.textContent = show ? "visibility" : "visibility_off";
      previewToggleBtn.title = show ? "Hide in Preview" : "Show in Preview";
      previewToggleBtn.setAttribute("aria-label", show ? "Hide in preview panel" : "Show in preview panel");
    }
    populateSourceOptions(stream);
    if (processSelect) {
      processSelect.disabled = false;
      processSelect.value = stream.process;
    }
    updateColorDisplay(stream);
    syncColorPicker(stream);
    if (fitToggle) {
      const isFit = stream.viewportMode !== "custom";
      fitToggle.checked = isFit;
      fitToggle.disabled = false;
      setViewportInputsDisabled(isFit);
      if (fitToggleBtn) {
        fitToggleBtn.setAttribute("aria-pressed", String(isFit));
        fitToggleBtn.classList.toggle("is-active", isFit);
      }
    }
    if (viewportInputs.x) viewportInputs.x.value = formatUnit(stream.viewport.x);
    if (viewportInputs.y) viewportInputs.y.value = formatUnit(stream.viewport.y);
    if (viewportInputs.w) viewportInputs.w.value = formatUnit(stream.viewport.w);
    if (viewportInputs.h) viewportInputs.h.value = formatUnit(stream.viewport.h);
    state.isSyncing = false;
    updateActionButtons();
  };

  const renderList = () => {
    if (!listEl) return;
    if (!state.streams.length) {
      listEl.innerHTML = "";
      return;
    }
    const total = state.streams.length;
    const markup = state.streams
      .map((stream, index) => {
        const isActive = stream.id === state.activeId;
        const statusClass = stream.enabled ? "is-on" : "";
        const sourceLabel = getSourceLabel(stream);
        const processLabel = getProcessLabel(stream.process);
        const metaLabel =
          sourceLabel && processLabel ? `${sourceLabel} • ${processLabel}` : sourceLabel || processLabel || "Unassigned";
        const enabledIcon = stream.enabled ? "toggle_on" : "toggle_off";
        const previewOn = stream.preview !== false;
        const previewIcon = previewOn ? "visibility" : "visibility_off";
        const canMoveUp = index > 0;
        const canMoveDown = index < total - 1;
        return `
          <button type="button" role="option" aria-selected="${isActive ? "true" : "false"}" class="layers-stream-item ${isActive ? "is-active" : ""} ${
            stream.enabled ? "" : "is-disabled"
          }" data-stream-id="${stream.id}">
            <span class="layers-stream-label">
              <span class="layers-stream-color" style="--layer-color:${stream.color.hex}; --layer-alpha:${stream.color.alpha};" aria-hidden="true"></span>
              <span class="layers-stream-label-text">${escapeHtml(stream.name)}</span>
            </span>
            <span class="layers-stream-meta">${escapeHtml(metaLabel)}</span>
            <span class="layers-stream-actions">
              <button type="button" class="icon-button" data-action="move-up" data-stream-id="${stream.id}" title="Move layer up" aria-label="Move layer up" ${
                canMoveUp ? "" : "disabled"
              }>
                <span class="material-icons-outlined" aria-hidden="true">arrow_upward</span>
              </button>
              <button type="button" class="icon-button" data-action="move-down" data-stream-id="${stream.id}" title="Move layer down" aria-label="Move layer down" ${
                canMoveDown ? "" : "disabled"
              }>
                <span class="material-icons-outlined" aria-hidden="true">arrow_downward</span>
              </button>
              <button type="button" class="icon-button ${previewOn ? "is-active" : ""}" data-action="toggle-preview" data-stream-id="${stream.id}" title="${previewOn ? "Hide in Preview" : "Show in Preview"}" aria-label="${previewOn ? "Hide in preview panel" : "Show in preview panel"}" aria-pressed="${String(previewOn)}">
                <span class="material-icons-outlined" aria-hidden="true">${previewIcon}</span>
              </button>
              <button type="button" class="icon-button ${stream.enabled ? "is-active" : ""}" data-action="toggle-enabled" data-stream-id="${stream.id}" title="${stream.enabled ? "Disable stream" : "Enable stream"}" aria-label="${stream.enabled ? "Disable stream" : "Enable stream"}" aria-pressed="${String(stream.enabled)}">
                <span class="material-icons-outlined" aria-hidden="true">${enabledIcon}</span>
              </button>
              <button type="button" class="icon-button" data-action="delete-stream" data-stream-id="${stream.id}" title="Delete stream" aria-label="Delete stream">
                <span class="material-icons-outlined" aria-hidden="true">delete</span>
              </button>
            </span>
          </button>
        `;
      })
      .join("");
    listEl.innerHTML = markup;
  };

  const updateUI = () => {
    renderList();
    updateEmptyState();
    syncDetailForm();
    persistStreams(state.streams);
    dispatchLayersEvent(state.streams);
  };

  const moveStreamBy = (streamId, delta) => {
    if (!streamId || !Number.isInteger(delta) || delta === 0) return;
    const index = state.streams.findIndex((stream) => stream.id === streamId);
    if (index === -1) return;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= state.streams.length) return;
    const [entry] = state.streams.splice(index, 1);
    state.streams.splice(targetIndex, 0, entry);
    updateUI();
  };

  function dispatchLayerSelectionEvent(layerId, source = "layers") {
    const event = new CustomEvent("mediamime:layer-selected", {
      detail: { layerId, source },
      bubbles: true
    });
    window.dispatchEvent(event);
  }

  function setActiveStream(layerId, { source = "layers", emit = true } = {}) {
    let nextId = null;
    if (typeof layerId === "string") {
      const exists = state.streams.some((stream) => stream.id === layerId);
      if (!exists) return;
      nextId = layerId;
    } else if (layerId === null) {
      nextId = null;
    } else {
      nextId = null;
    }
    if (state.activeId === nextId) return;
    state.activeId = nextId;
    updateUI();
    if (emit) {
      dispatchLayerSelectionEvent(nextId, source);
    }
  }

  const addStream = () => {
    const stream = createStream({}, state.inputs);
    state.streams.push(stream);
    setActiveStream(stream.id);
  };

  const duplicateStream = () => {
    const active = getActiveStream();
    if (!active) return;
    const clone = createStream(
      {
        name: `${active.name} Copy`,
        enabled: active.enabled,
        sourceId: active.sourceId,
        process: active.process,
        color: { ...active.color },
        viewport: { ...active.viewport },
        viewportMode: active.viewportMode
      },
      state.inputs
    );
    state.streams.push(clone);
    setActiveStream(clone.id);
  };

  const deleteStream = () => {
    if (!state.activeId) return;
    const index = state.streams.findIndex((stream) => stream.id === state.activeId);
    if (index === -1) return;
    state.streams.splice(index, 1);
    const fallback = state.streams[index]?.id || state.streams[index - 1]?.id || null;
    setActiveStream(fallback);
  };

  const toggleEnabled = (value) => {
    const stream = getActiveStream();
    if (!stream) return;
    stream.enabled = Boolean(value);
    updateUI();
  };

  // Commit viewport change after transient editing (blur / Enter)
  const commitViewportChange = (key) => {
    const stream = getActiveStream();
    if (!stream || state.isSyncing) return;
    const input = viewportInputs[key];
    if (!input) return;
    const raw = input.value.trim();
    const fallbackValue = Number.isFinite(stream.viewport[key]) ? stream.viewport[key] : DEFAULT_VIEWPORT[key];
    const parsed = toFiniteNumber(raw, fallbackValue);
    const nextViewport = { ...stream.viewport, [key]: parsed };
    stream.viewportMode = "custom";
    if (fitToggle) fitToggle.checked = false;
    stream.viewport = clampViewport(nextViewport);
    input.dataset.editing = "false";
    state.viewportEditing[key] = null;
    updateUI();
  };

  const resetViewport = () => {
    const stream = getActiveStream();
    if (!stream) return;
    stream.viewport = { ...DEFAULT_VIEWPORT };
    updateUI();
  };

  const handleFitToggle = (checked) => {
    const stream = getActiveStream();
    if (!stream || state.isSyncing) return;
    stream.viewportMode = checked ? "fit" : "custom";
    if (checked) {
      stream.viewport = { ...DEFAULT_VIEWPORT };
    }
    updateUI();
  };

  const handleColorChange = (payload) => {
    if (!payload || state.isSyncing) return;
    const stream = getActiveStream();
    if (!stream) return;
    stream.color.hex = normalizeHex(payload.hex);
    stream.color.alpha = clampUnit(payload.alpha);
    updateUI();
  };

  const handleInputListChanged = (event) => {
    const inputs = Array.isArray(event?.detail?.inputs) ? event.detail.inputs : [];
    state.inputs = inputs.map((input) => ({
      id: input.id,
      name: input.name || input.id,
      type: input.type || "camera"
    }));
    let streamsChanged = false;
    state.streams.forEach((stream) => {
      if (stream.sourceId && !state.inputs.some((input) => input.id === stream.sourceId)) {
        stream.sourceId = null;
        streamsChanged = true;
      }
    });
    if (streamsChanged) {
      updateUI();
    } else {
      populateSourceOptions(getActiveStream());
    }
  };

  // Event bindings
  addListener(listEl, "click", (event) => {
    const moveUpBtn = event.target.closest('[data-action="move-up"]');
    if (moveUpBtn && !moveUpBtn.disabled) {
      event.stopPropagation();
      const id = moveUpBtn.dataset.streamId || moveUpBtn.closest("[data-stream-id]")?.dataset.streamId;
      if (id) moveStreamBy(id, -1);
      return;
    }
    const moveDownBtn = event.target.closest('[data-action="move-down"]');
    if (moveDownBtn && !moveDownBtn.disabled) {
      event.stopPropagation();
      const id = moveDownBtn.dataset.streamId || moveDownBtn.closest("[data-stream-id]")?.dataset.streamId;
      if (id) moveStreamBy(id, 1);
      return;
    }
    // Handle preview toggle
    const previewBtn = event.target.closest('[data-action="toggle-preview"]');
    if (previewBtn) {
      event.stopPropagation();
      const id = previewBtn.dataset.streamId;
      const stream = state.streams.find((s) => s.id === id);
      if (stream) {
        stream.preview = !(stream.preview !== false);
        updateUI();
      }
      return;
    }
    // Handle enabled toggle
    const enabledBtn = event.target.closest('[data-action="toggle-enabled"]');
    if (enabledBtn) {
      event.stopPropagation();
      const id = enabledBtn.dataset.streamId;
      const stream = state.streams.find((s) => s.id === id);
      if (stream) {
        stream.enabled = !stream.enabled;
        updateUI();
      }
      return;
    }
    // Handle delete button
    const deleteBtn = event.target.closest('[data-action="delete-stream"]');
    if (deleteBtn) {
      event.stopPropagation();
      const id = deleteBtn.dataset.streamId;
      if (id) {
        const index = state.streams.findIndex((stream) => stream.id === id);
        if (index !== -1) {
          state.streams.splice(index, 1);
          if (state.activeId === id) {
            const fallback = state.streams[index]?.id || state.streams[index - 1]?.id || null;
            setActiveStream(fallback);
          } else {
            updateUI();
          }
        }
      }
      return;
    }

    // Handle stream selection
    const button = event.target.closest("[data-stream-id]");
    if (!button) return;
    const id = button.dataset.streamId;
    if (!id || id === state.activeId) return;
    setActiveStream(id);
  });

  addListener(addButton, "click", () => addStream());
  addListener(duplicateButton, "click", () => duplicateStream());

  addListener(nameInput, "input", (event) => {
    if (state.isSyncing) return;
    const stream = getActiveStream();
    if (!stream) return;
    stream.name = event.target.value;
    renderList();
    persistStreams(state.streams);
    dispatchLayersEvent(state.streams);
  });

  addListener(enabledToggleBtn, "click", () => {
    if (state.isSyncing) return;
    const stream = getActiveStream();
    if (!stream) return;
    stream.enabled = !stream.enabled;
    updateUI();
  });

  addListener(previewToggleBtn, "click", () => {
    if (state.isSyncing) return;
    const stream = getActiveStream();
    if (!stream) return;
    stream.preview = !(stream.preview !== false);
    updateUI();
  });

  addListener(sourceSelect, "change", (event) => {
    if (state.isSyncing) return;
    const stream = getActiveStream();
    if (!stream) return;
    stream.sourceId = event.target.value || null;
    updateUI();
  });

  addListener(processSelect, "change", (event) => {
    if (state.isSyncing) return;
    const stream = getActiveStream();
    if (!stream) return;
    stream.process = event.target.value || PROCESS_OPTIONS[0].id;
    updateUI();
  });

  // Transient viewport numeric input editing
  for (const [key, input] of Object.entries(viewportInputs)) {
    if (!input) continue;
    addListener(input, "focus", () => {
      input.dataset.editing = "true";
      state.viewportEditing[key] = input.value;
    });
    addListener(input, "input", () => {
      if (state.isSyncing) return;
      if (input.dataset.editing !== "true") input.dataset.editing = "true";
      state.viewportEditing[key] = input.value;
    });
    addListener(input, "blur", () => {
      if (input.dataset.editing === "true") commitViewportChange(key);
    });
    addListener(input, "keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitViewportChange(key);
        input.blur();
      }
    });
  }

  addListener(fitButton, "click", () => resetViewport());
  addListener(fitToggle, "change", (event) => handleFitToggle(event.target.checked));
  addListener(fitToggleBtn, "click", () => {
    if (!fitToggle) return;
    const next = !fitToggle.checked;
    fitToggle.checked = next;
    handleFitToggle(next);
  });

  if (colorChip && colorPanel) {
    registerColorPopover(colorChip, colorPanel);
  }

  state.colorPicker = createRgbaPicker({
    root: colorPickerRoot,
    initialHex: DEFAULT_STREAM_COLOR,
    initialAlpha: DEFAULT_STREAM_ALPHA,
    onChange: handleColorChange
  });
  if (state.colorPicker) {
    state.colorPicker.setColor(DEFAULT_STREAM_COLOR, DEFAULT_STREAM_ALPHA, { emit: false, source: "program" });
    state.colorPicker.setDisabled(true);
  }

  populateProcessOptions();
  const storedStreams = loadStoredStreams();
  if (storedStreams.length) {
    state.streams = storedStreams;
    setActiveStream(storedStreams[0].id);
  } else {
    state.streams = [];
    updateUI();
  }

  inputListHandler = (event) => handleInputListChanged(event);
  window.addEventListener("mediamime:input-list-changed", inputListHandler);

  // Handle viewport changes from drawing module
  const handleViewportUpdate = (e) => {
    const { layerId, viewport, viewportMode } = e.detail;
    const stream = state.streams.find(s => s.id === layerId);
    if (stream) {
      stream.viewport = clampViewport(viewport);
      stream.viewportMode = viewportMode;
      persistStreams(state.streams);
      updateUI();
    }
  };
  window.addEventListener('mediamime:layer-viewport-changed', handleViewportUpdate);

  const handleLayerSelectedEvent = (event) => {
    const source = event?.detail?.source;
    if (source === "layers") return;
    const layerId = typeof event?.detail?.layerId === "string" ? event.detail.layerId : null;
    if (layerId && !state.streams.some((stream) => stream.id === layerId)) return;
    setActiveStream(layerId, { emit: false, source: source || "external" });
  };
  window.addEventListener('mediamime:layer-selected', handleLayerSelectedEvent);

  const handleEscapeKey = (event) => {
    if (event.key !== "Escape") return;
    if (event.defaultPrevented) return;
    const target = event.target;
    if (target) {
      const tagName = target.tagName ? target.tagName.toLowerCase() : "";
      if (tagName === "input" || tagName === "textarea" || target.isContentEditable) {
        return;
      }
    }
    if (!state.activeId) return;
    setActiveStream(null);
  };
  window.addEventListener("keydown", handleEscapeKey);

  return {
    getStreams: () =>
      state.streams.map((stream) => ({
        ...stream,
        viewport: { ...stream.viewport },
        color: { ...stream.color }
      })),
    dispose() {
      listeners.forEach((off) => off());
      popoverDisposers.forEach((dispose) => dispose());
      if (inputListHandler) {
        window.removeEventListener("mediamime:input-list-changed", inputListHandler);
      }
      window.removeEventListener('mediamime:layer-viewport-changed', handleViewportUpdate);
      window.removeEventListener('mediamime:layer-selected', handleLayerSelectedEvent);
      window.removeEventListener("keydown", handleEscapeKey);
      if (state.colorPicker && typeof state.colorPicker.destroy === "function") {
        state.colorPicker.destroy();
      }
      state.streams = [];
      persistStreams(state.streams);
      dispatchLayersEvent(state.streams);
    }
  };
}
