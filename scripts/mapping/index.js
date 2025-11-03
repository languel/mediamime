const MODAL_OFFSET = 18;
const VIEWPORT_MARGIN = 16;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `map-${Math.random().toString(36).slice(2, 10)}`;
};

const SOURCE_OPTIONS = [
  { value: "mouseInside", label: "Mouse Inside" },
  { value: "mouseDrag", label: "Mouse Drag (axis)" },
  { value: "mouseX", label: "Mouse X (axis)" },
  { value: "mouseY", label: "Mouse Y (axis)" },
  { value: "mouseDown", label: "Mouse Down" },
  { value: "mouseUp", label: "Mouse Up" },
  { value: "mouseClick", label: "Mouse Click" },
  { value: "keyDown", label: "Key Down" },
  { value: "keyUp", label: "Key Up" }
];

const MIDI_TYPE_OPTIONS = [
  { value: "note", label: "MIDI Note" },
  { value: "cc", label: "MIDI CC" }
];

const NOTE_MODE_OPTIONS = [
  { value: "noteOn", label: "Note On" },
  { value: "noteOff", label: "Note Off" },
  { value: "pulse", label: "Note Pulse" }
];

const DEFAULT_MAPPING = {
  sourceType: "mouseClick",
  requireInside: true,
  key: "",
  midiType: "note",
  channel: 1,
  note: 60,
  velocity: 100,
  offVelocity: 0,
  noteMode: "noteOn",
  noteDurationMs: 400,
  cc: 1,
  ccValue: 127,
  ccMode: "constant"
};

const clampMidiChannel = (value) => clamp(Math.round(value), 1, 16);
const clampMidiValue = (value) => clamp(Math.round(value), 0, 127);

const createMapping = (overrides = {}) => ({
  id: createId(),
  ...DEFAULT_MAPPING,
  ...overrides
});

const template = `
  <div class="modal-chrome mapping-context-chrome" data-drag-handle>
    <div class="mapping-context-title">
      <span class="material-icons-outlined" aria-hidden="true">music_note</span>
      <span data-shape-label>MIDI Mapping</span>
    </div>
    <div class="panel-actions">
      <button type="button" class="icon-button panel-close" title="Close mapping dialog" aria-label="Close mapping dialog" data-mapping-close>
        <span class="material-icons-outlined" aria-hidden="true">close</span>
      </button>
    </div>
  </div>
  <div class="floating-modal-body mapping-context-body">
    <div class="mapping-shape-name">
      <label for="mapping-shape-name-input">Name</label>
      <input id="mapping-shape-name-input" type="text" data-shape-name placeholder="Untitled shape" maxlength="48">
    </div>
    <div class="mapping-rule-header">
      <span class="mapping-rule-title">Mappings</span>
      <button type="button" class="icon-button" title="Add mapping" aria-label="Add mapping" data-mapping-add>
        <span class="material-icons-outlined" aria-hidden="true">add</span>
      </button>
    </div>
    <div class="mapping-rule-list" data-mapping-list></div>
  </div>
`;

const createModal = () => {
  const modal = document.createElement("section");
  modal.className = "panel floating-modal mapping-context is-hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "false");
  modal.setAttribute("aria-label", "MIDI mapping");
  modal.setAttribute("tabindex", "-1");
  modal.innerHTML = template;
  return modal;
};

const getLayer = () => {
  let layer = document.getElementById("modal-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "modal-layer";
    layer.className = "floating-modal-layer";
    document.body.appendChild(layer);
  }
  return layer;
};

export function initMapping({ editor }) {
  if (!editor) {
    console.warn("[mediamime] Mapping module requires an editor API.");
    return {
      dispose() {}
    };
  }

  const layer = getLayer();
  const modal = createModal();
  layer.appendChild(modal);

const closeButtons = Array.from(modal.querySelectorAll("[data-mapping-close]"));
const shapeLabelEl = modal.querySelector("[data-shape-label]");
const shapeNameInput = modal.querySelector("[data-shape-name]");
const focusTarget = modal;
const mappingListEl = modal.querySelector("[data-mapping-list]");
const addMappingButton = modal.querySelector("[data-mapping-add]");
const shapeTableEl = document.getElementById("editor-shape-list");
const mappingStore = new Map();
const shapeNames = new Map();
const runtimeState = new Map();
const midiState = {
  access: null,
  outputs: new Set(),
  ready: false
};
const clampMidiChannel = (value) => clamp(Math.round(value), 1, 16);
const clampMidiValue = (value) => clamp(Math.round(value), 0, 127);
const pointerState = {
  normalized: null,
  insideShapes: new Map(),
  overEditor: false,
  isDown: false
};
const svg = document.getElementById("gesture-svg");
const editorRoot = document.getElementById("gesture-editor");
const midiSend = (bytes) => {
  if (!midiState.ready || !midiState.outputs.size) {
    console.warn("[mediamime] MIDI send skipped – no output available.");
    return;
  }
  midiState.outputs.forEach((output) => {
    try {
      output.send(bytes);
    } catch (error) {
      console.warn("[mediamime] Failed to send MIDI message", error);
    }
  });
};
const getDefaultShapeName = (shape) => {
  if (!shape) return "Untitled";
  const type = shape.type ? shape.type.charAt(0).toUpperCase() + shape.type.slice(1) : "Shape";
  const suffix = shape.id ? ` ${String(shape.id).slice(0, 4)}` : "";
  return `${type}${suffix}`;
};

const ensureShapeName = (shapeId, shape) => {
  if (!shapeId) return getDefaultShapeName(shape);
  if (!shapeNames.has(shapeId)) {
    shapeNames.set(shapeId, getDefaultShapeName(shape));
  }
  return shapeNames.get(shapeId);
};
const sendNoteOn = (channel, note, velocity) => {
  const status = 0x90 | ((clampMidiChannel(channel) - 1) & 0x0f);
  midiSend([status, clampMidiValue(note), clampMidiValue(velocity)]);
};
const sendNoteOff = (channel, note, velocity = 0) => {
  const status = 0x80 | ((clampMidiChannel(channel) - 1) & 0x0f);
  midiSend([status, clampMidiValue(note), clampMidiValue(velocity)]);
};
const sendControlChange = (channel, cc, value) => {
  const status = 0xb0 | ((clampMidiChannel(channel) - 1) & 0x0f);
  midiSend([status, clampMidiValue(cc), clampMidiValue(value)]);
};
const flashShape = (() => {
  const timeouts = new Map();
  return (shapeId) => {
    if (!shapeId) return;
    const node = editorRoot?.querySelector(`[data-shape-id="${shapeId}"]`);
    if (!node) return;
    node.classList.add("is-mapping");
    if (timeouts.has(shapeId)) {
      clearTimeout(timeouts.get(shapeId));
    }
    const timeout = window.setTimeout(() => {
      node.classList.remove("is-mapping");
      timeouts.delete(shapeId);
    }, 160);
    timeouts.set(shapeId, timeout);
  };
})();
const flashPanel = (() => {
  let timeoutId = null;
  return () => {
    if (!modal) return;
    modal.classList.add("is-active");
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      modal.classList.remove("is-active");
      timeoutId = null;
    }, 150);
  };
})();

  const renderShapeTable = () => {
    if (!shapeTableEl) return;
    const shapes = Array.from(shapesCache.values());
    if (!shapes.length) {
      shapeTableEl.innerHTML = `<div class="editor-list-empty">No shapes yet.</div>`;
      return;
    }
    const rows = shapes.map((shape) => {
      const name = ensureShapeName(shape.id, shape);
      const mappingCount = getMappings(shape.id).length;
      const meta = mappingCount === 1 ? "1 mapping" : `${mappingCount} mappings`;
      const isActive = state.shapeId === shape.id;
      return `<button type="button" data-shape-id="${shape.id}" data-active="${isActive ? "true" : "false"}" class="${isActive ? "is-active" : ""}">
          <span class="shape-name">${name}</span>
          <span class="shape-meta">${meta}</span>
        </button>`;
    });
    shapeTableEl.innerHTML = rows.join("");
  };

  const bootstrapInitialState = () => {
    if (typeof editor.getState !== "function") return;
    const stateSnapshot = editor.getState();
    if (!stateSnapshot || !Array.isArray(stateSnapshot.shapes)) return;
    stateSnapshot.shapes.forEach((shape) => {
      if (shape?.id) {
        shapesCache.set(shape.id, shape);
        ensureShapeName(shape.id, shape);
      }
    });
    renderShapeTable();
  };
const refreshMidiOutputs = () => {
  midiState.outputs.clear();
  if (!midiState.access) return;
  const preferred = localStorage.getItem("mediamime:midi-output");
  let fallback = null;
  midiState.access.outputs.forEach((output) => midiState.outputs.add(output));
  if (preferred && midiState.access.outputs.has(preferred)) {
    midiState.outputs.clear();
    midiState.outputs.add(midiState.access.outputs.get(preferred));
  } else if (midiState.access.outputs.size && !preferred) {
    fallback = midiState.access.outputs.values().next().value;
    midiState.outputs.clear();
    midiState.outputs.add(fallback);
  }
  if (fallback) {
    try {
      localStorage.setItem("mediamime:midi-output", fallback.id || fallback.name || "");
    } catch (error) {
      // ignore storage errors
    }
  }
  if (!midiState.outputs.size) {
    console.warn("[mediamime] No MIDI outputs available.");
  }
};
  const initializeMidi = () => {
    if (!navigator.requestMIDIAccess) {
      console.info("[mediamime] Web MIDI is not supported in this browser.");
      return;
    }
    navigator
      .requestMIDIAccess()
      .then((access) => {
        midiState.access = access;
        midiState.ready = true;
        refreshMidiOutputs();
        access.addEventListener("statechange", refreshMidiOutputs);
      })
      .catch((error) => {
        console.warn("[mediamime] Failed to initialize MIDI access", error);
      });
  };

  const shapesCache = new Map();
  const state = {
    isOpen: false,
    shapeId: null
  };
  const getMappings = (shapeId) => mappingStore.get(shapeId) || [];
  const ensureRuntimeShape = (shapeId) => {
    if (!runtimeState.has(shapeId)) {
      runtimeState.set(shapeId, { inside: false, mappings: new Map() });
    }
    return runtimeState.get(shapeId);
  };
  const ensureRuntimeMapping = (shapeId, mappingId) => {
    const shapeRuntime = ensureRuntimeShape(shapeId);
    if (!shapeRuntime.mappings.has(mappingId)) {
      shapeRuntime.mappings.set(mappingId, { noteOn: false, lastValue: null, pulseTimeout: null, ccTimeout: null });
    }
    return shapeRuntime.mappings.get(mappingId);
  };
  const purgeRuntimeMappings = (shapeId, mappingIds) => {
    const rt = runtimeState.get(shapeId);
    if (!rt) return;
    const keep = new Set(mappingIds);
    Array.from(rt.mappings.keys()).forEach((id) => {
      if (!keep.has(id)) {
        rt.mappings.delete(id);
      }
    });
  };
  const setMappings = (shapeId, mappings) => {
    if (!shapeId) return;
    const sanitized = mappings.map((mapping) => ({ ...DEFAULT_MAPPING, ...mapping, id: mapping.id || createId() }));
    mappingStore.set(shapeId, sanitized);
    purgeRuntimeMappings(shapeId, sanitized.map((mapping) => mapping.id));
    ensureRuntimeShape(shapeId);
    renderShapeTable();
  };

  const renderNoteFields = (mapping) => {
    const channelId = `${mapping.id}-channel`;
    const noteId = `${mapping.id}-note`;
    const velocityId = `${mapping.id}-velocity`;
    const offVelocityId = `${mapping.id}-off-velocity`;
    const modeId = `${mapping.id}-note-mode`;
    const durationId = `${mapping.id}-note-duration`;
    const noteModeOptions = NOTE_MODE_OPTIONS.map((option) => `<option value="${option.value}" ${mapping.noteMode === option.value ? "selected" : ""}>${option.label}</option>`).join("");
    const showVelocity = mapping.noteMode !== "noteOff";
    const showOffVelocity = mapping.noteMode !== "noteOn";
    const showDuration = mapping.noteMode === "pulse";
    return `
      <div class="mapping-field">
        <label for="${channelId}">CHN</label>
        <input type="number" id="${channelId}" min="1" max="16" value="${mapping.channel}" data-mapping-field="channel">
      </div>
      <div class="mapping-field">
        <label for="${noteId}">NOTE</label>
        <input type="number" id="${noteId}" min="0" max="127" value="${mapping.note}" data-mapping-field="note">
      </div>
      <div class="mapping-field">
        <label for="${modeId}">MODE</label>
        <select id="${modeId}" data-mapping-field="noteMode">
          ${noteModeOptions}
        </select>
      </div>
      ${showVelocity
        ? `<div class="mapping-field"><label for="${velocityId}">VEL</label><input type="number" id="${velocityId}" min="1" max="127" value="${mapping.velocity}" data-mapping-field="velocity"></div>`
        : ""}
      ${showOffVelocity
        ? `<div class="mapping-field"><label for="${offVelocityId}">OFF</label><input type="number" id="${offVelocityId}" min="0" max="127" value="${mapping.offVelocity}" data-mapping-field="offVelocity"></div>`
        : ""}
      ${showDuration
        ? `<div class="mapping-field"><label for="${durationId}">DUR</label><input type="number" id="${durationId}" min="10" max="60000" value="${mapping.noteDurationMs}" data-mapping-field="noteDurationMs"></div>`
        : ""}
    `;
  };

  const renderCcFields = (mapping, isAxisSource) => {
    const channelId = `${mapping.id}-channel`;
    const ccId = `${mapping.id}-cc`;
    const valueId = `${mapping.id}-cc-value`;
    const modeId = `${mapping.id}-cc-mode`;
    const modeOptions = [
      { value: "constant", label: "Constant" },
      { value: "whileInside", label: "While inside" },
      ...(isAxisSource ? [{ value: "axis", label: "Follow axis" }] : [])
    ];
    const modeOptionsHtml = modeOptions
      .map((option) => `<option value="${option.value}" ${mapping.ccMode === option.value ? "selected" : ""}>${option.label}</option>`)
      .join("");
    const showValueField = mapping.ccMode !== "axis";
    return `
      <div class="mapping-field">
        <label for="${channelId}">CHN</label>
        <input type="number" id="${channelId}" min="1" max="16" value="${mapping.channel}" data-mapping-field="channel">
      </div>
      <div class="mapping-field">
        <label for="${ccId}">CC#</label>
        <input type="number" id="${ccId}" min="0" max="127" value="${mapping.cc}" data-mapping-field="cc">
      </div>
      <div class="mapping-field">
        <label for="${modeId}">MODE</label>
        <select id="${modeId}" data-mapping-field="ccMode">
          ${modeOptionsHtml}
        </select>
      </div>
      ${showValueField
        ? `<div class="mapping-field"><label for="${valueId}">VAL</label><input type="number" id="${valueId}" min="0" max="127" value="${mapping.ccValue}" data-mapping-field="ccValue"></div>`
        : ""}
    `;
  };

  const renderMappingCard = (mapping) => {
    const sourceOptions = SOURCE_OPTIONS
      .map((option) => `<option value="${option.value}" ${mapping.sourceType === option.value ? "selected" : ""}>${option.label}</option>`)
      .join("");
    const isKeySource = mapping.sourceType === "keyDown" || mapping.sourceType === "keyUp";
    const isAxisSource = mapping.sourceType === "mouseX" || mapping.sourceType === "mouseY" || mapping.sourceType === "mouseDrag";
    const keyFieldId = `${mapping.id}-key`;
    const insideId = `${mapping.id}-require-inside`;
    const midiOptions = MIDI_TYPE_OPTIONS
      .map((option) => `<option value="${option.value}" ${mapping.midiType === option.value ? "selected" : ""}>${option.label}</option>`)
      .join("");
    const midiFieldHtml = mapping.midiType === "note" ? renderNoteFields(mapping) : renderCcFields(mapping, isAxisSource);
    return `
      <div class="mapping-rule-card" data-mapping-id="${mapping.id}">
        <div class="mapping-rule-fields">
          <div class="mapping-field">
            <label for="${mapping.id}-source">SRC</label>
            <select id="${mapping.id}-source" data-mapping-field="sourceType">
              ${sourceOptions}
            </select>
          </div>
          ${isKeySource
            ? `<div class="mapping-field"><label for="${keyFieldId}">KEY</label><input type="text" id="${keyFieldId}" value="${mapping.key ?? ""}" data-mapping-field="key" maxlength="20" placeholder="e.g. a"></div>`
            : ""}
          <div class="mapping-field checkbox-field">
            <input type="checkbox" id="${insideId}" data-mapping-field="requireInside" ${mapping.requireInside ? "checked" : ""}>
            <label for="${insideId}">INSIDE</label>
          </div>
          <div class="mapping-field">
            <label for="${mapping.id}-midi-type">TYPE</label>
            <select id="${mapping.id}-midi-type" data-mapping-field="midiType">
              ${midiOptions}
            </select>
          </div>
          ${midiFieldHtml}
        </div>
        <div class="mapping-rule-footer">
          <button type="button" data-mapping-remove>Remove</button>
        </div>
      </div>
    `;
  };

  const renderMappingList = () => {
    if (!mappingListEl) return;
    const shapeId = state.shapeId;
    if (!shapeId) {
      mappingListEl.innerHTML = `<p class="mapping-empty">Select a shape to manage mappings.</p>`;
      return;
    }
    const mappings = getMappings(shapeId);
    if (!mappings.length) {
      mappingListEl.innerHTML = `<p class="mapping-empty">No mappings yet. Use the plus button to add one.</p>`;
      return;
    }
    mappingListEl.innerHTML = mappings.map((mapping) => renderMappingCard(mapping)).join("");
  };

  const updateMapping = (shapeId, mappingId, mutate) => {
    if (!shapeId || !mappingId || typeof mutate !== "function") return;
    const existing = getMappings(shapeId);
    const index = existing.findIndex((mapping) => mapping.id === mappingId);
    if (index === -1) return;
    const next = existing.map((item, i) => (i === index ? { ...item } : { ...item }));
    const target = next[index];
    mutate(target);
    setMappings(shapeId, next);
  };

  const removeMapping = (shapeId, mappingId) => {
    if (!shapeId || !mappingId) return;
    const existing = getMappings(shapeId);
    const next = existing.filter((mapping) => mapping.id !== mappingId);
    setMappings(shapeId, next);
  };

  const addMapping = () => {
    if (!state.shapeId) return;
    const base = createMapping();
    const mappings = [...getMappings(state.shapeId), base];
    setMappings(state.shapeId, mappings);
    renderMappingList();
    if (pointerState.normalized) {
      updateInsideStates(pointerState.normalized);
    }
  };
  const handleMappingFieldChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const field = target.dataset.mappingField;
    if (!field || !state.shapeId) return;
    if (event.type === "input" && target.type === "checkbox") return;
    const card = target.closest("[data-mapping-id]");
    if (!card) return;
    const mappingId = card.dataset.mappingId;
    if (!mappingId) return;
    const previousSelection =
      target.selectionStart !== undefined ? { start: target.selectionStart, end: target.selectionEnd } : null;
    let refresh = false;
    updateMapping(state.shapeId, mappingId, (mapping) => {
      switch (field) {
        case "sourceType": {
          const nextSource = target.value;
          mapping.sourceType = nextSource;
          const isAxis = nextSource === "mouseX" || nextSource === "mouseY" || nextSource === "mouseDrag";
          if (isAxis && mapping.midiType === "cc") {
            mapping.ccMode = "axis";
          }
          if (!isAxis && mapping.ccMode === "axis") {
            mapping.ccMode = "constant";
          }
          if (!(nextSource === "keyDown" || nextSource === "keyUp")) {
            mapping.key = mapping.key || "";
          }
          if (nextSource === "mouseInside") {
            mapping.requireInside = true;
          }
          refresh = true;
          break;
        }
        case "key": {
          mapping.key = target.value.trim().toLowerCase();
          break;
        }
        case "requireInside": {
          mapping.requireInside = target.checked;
          if (!mapping.requireInside && mapping.ccMode === "whileInside") {
            mapping.ccMode = "constant";
          }
          break;
        }
        case "midiType": {
          mapping.midiType = target.value;
          if (mapping.midiType === "note" && mapping.velocity < 1) {
            mapping.velocity = 100;
          }
          if (mapping.midiType === "cc") {
            if (mapping.sourceType === "mouseX" || mapping.sourceType === "mouseY" || mapping.sourceType === "mouseDrag") {
              mapping.ccMode = "axis";
            } else if (mapping.ccMode === "axis") {
              mapping.ccMode = "constant";
            }
          }
          if (mapping.midiType === "note" && mapping.noteMode === "pulse" && !Number.isFinite(mapping.noteDurationMs)) {
            mapping.noteDurationMs = 400;
          }
          refresh = true;
          break;
        }
        case "channel": {
          mapping.channel = clamp(toInt(target.value, mapping.channel), 1, 16);
          break;
        }
        case "note": {
          mapping.note = clamp(toInt(target.value, mapping.note), 0, 127);
          break;
        }
        case "noteMode": {
          mapping.noteMode = target.value;
          if (mapping.noteMode === "pulse" && !Number.isFinite(mapping.noteDurationMs)) {
            mapping.noteDurationMs = 400;
          }
          refresh = true;
          break;
        }
        case "noteDurationMs": {
          mapping.noteDurationMs = clamp(toInt(target.value, mapping.noteDurationMs), 10, 60000);
          break;
        }
        case "velocity": {
          mapping.velocity = clamp(toInt(target.value, mapping.velocity), 1, 127);
          break;
        }
        case "offVelocity": {
          mapping.offVelocity = clamp(toInt(target.value, mapping.offVelocity), 0, 127);
          break;
        }
        case "cc": {
          mapping.cc = clamp(toInt(target.value, mapping.cc), 0, 127);
          break;
        }
        case "ccValue": {
          mapping.ccValue = clamp(toInt(target.value, mapping.ccValue), 0, 127);
          break;
        }
        case "ccMode": {
          const nextMode = target.value;
          if (nextMode === "axis" && (mapping.sourceType === "mouseX" || mapping.sourceType === "mouseY")) {
            mapping.ccMode = "axis";
            break;
          }
          if (nextMode === "whileInside") {
            mapping.ccMode = "whileInside";
            mapping.requireInside = true;
          } else {
            mapping.ccMode = "constant";
          }
          refresh = true;
          break;
        }
        default:
          break;
      }
    });
    if (pointerState.normalized) {
      updateInsideStates(pointerState.normalized);
    }
    if (refresh) {
      renderMappingList();
      requestAnimationFrame(() => {
        if (!mappingListEl) return;
        const nextField = mappingListEl.querySelector(`[data-mapping-id="${mappingId}"] [data-mapping-field="${field}"]`);
        if (nextField instanceof HTMLInputElement || nextField instanceof HTMLSelectElement) {
          nextField.focus({ preventScroll: true });
        }
      });
      return;
    }
    if (event.type === "input") {
      requestAnimationFrame(() => {
        if (!mappingListEl) return;
        const nextField = mappingListEl.querySelector(`[data-mapping-id="${mappingId}"] [data-mapping-field="${field}"]`);
        if (nextField instanceof HTMLInputElement || nextField instanceof HTMLSelectElement) {
          nextField.focus({ preventScroll: true });
          if (previousSelection && nextField instanceof HTMLInputElement && typeof nextField.setSelectionRange === "function") {
            nextField.setSelectionRange(previousSelection.start, previousSelection.end);
          }
        }
      });
    }
  };

  const handleMappingClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-mapping-remove]")) {
      if (!state.shapeId) return;
      const card = target.closest("[data-mapping-id]");
      if (!card) return;
      const mappingId = card.dataset.mappingId;
      if (!mappingId) return;
      removeMapping(state.shapeId, mappingId);
      renderMappingList();
      if (pointerState.normalized) {
        updateInsideStates(pointerState.normalized);
      }
    }
  };

  const handleShapeNameInput = (event) => {
    if (!state.shapeId) return;
    const value = (event.target.value || "").trim();
    if (value) {
      shapeNames.set(state.shapeId, value);
    } else {
      const shape = shapesCache.get(state.shapeId);
      shapeNames.set(state.shapeId, getDefaultShapeName(shape));
    }
    const currentShape = shapesCache.get(state.shapeId);
    const name = ensureShapeName(state.shapeId, currentShape);
    if (shapeLabelEl) {
      shapeLabelEl.textContent = name;
    }
    if (!value && shapeNameInput) {
      shapeNameInput.value = name;
    }
  };

  const dragHandle = modal.querySelector("[data-drag-handle]");
  let dragContext = null;

  const finalizeDrag = () => {
    if (!dragContext) return;
    try {
      dragContext.target.releasePointerCapture(dragContext.pointerId);
    } catch (error) {
      // ignore
    }
    dragContext.target.removeEventListener("pointermove", handleDragMove);
    dragContext.target.removeEventListener("pointerup", finalizeDrag);
    dragContext.target.removeEventListener("lostpointercapture", finalizeDrag);
    dragContext = null;
  };

  const handleDragMove = (event) => {
    if (!dragContext || event.pointerId !== dragContext.pointerId) return;
    const left = clamp(event.clientX - dragContext.offsetX, VIEWPORT_MARGIN, window.innerWidth - dragContext.width - VIEWPORT_MARGIN);
    const top = clamp(event.clientY - dragContext.offsetY, VIEWPORT_MARGIN, window.innerHeight - dragContext.height - VIEWPORT_MARGIN);
    modal.style.left = `${left}px`;
    modal.style.top = `${top}px`;
  };

  const handleDragPointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest?.(".panel-actions")) return;
    event.preventDefault();
    const rect = modal.getBoundingClientRect();
    dragContext = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      target: modal
    };
    modal.style.right = "auto";
    modal.style.bottom = "auto";
    try {
      modal.setPointerCapture(event.pointerId);
    } catch (error) {
      // ignore capture failure
    }
    modal.addEventListener("pointermove", handleDragMove);
    modal.addEventListener("pointerup", finalizeDrag, { once: true });
    modal.addEventListener("lostpointercapture", finalizeDrag, { once: true });
  };

  const handleInsideTransition = (shapeId, wasInside, isInside) => {
    if (wasInside === isInside) return;
    const runtime = ensureRuntimeShape(shapeId);
    runtime.inside = isInside;
    if (wasInside && !isInside) {
      const mappings = getMappings(shapeId);
      mappings.forEach((mapping) => {
        const mappingRuntime = ensureRuntimeMapping(shapeId, mapping.id);
        if (mapping.sourceType === "mouseInside") {
          return;
        }
        if (mapping.requireInside && mapping.midiType === "note" && mappingRuntime.noteOn) {
          sendNoteOff(mapping.channel, mapping.note, mapping.offVelocity ?? 0);
          mappingRuntime.noteOn = false;
          if (mappingRuntime.pulseTimeout) {
            clearTimeout(mappingRuntime.pulseTimeout);
            mappingRuntime.pulseTimeout = null;
          }
        }
        if (mapping.midiType === "cc") {
          if (mapping.requireInside && mapping.ccMode === "axis" && mappingRuntime.lastValue !== null) {
            sendControlChange(mapping.channel, mapping.cc, 0);
            mappingRuntime.lastValue = null;
            if (mappingRuntime.ccTimeout) {
              clearTimeout(mappingRuntime.ccTimeout);
              mappingRuntime.ccTimeout = null;
            }
          }
          if (mapping.ccMode === "whileInside") {
            triggerCc(shapeId, mapping, 0);
          }
        }
      });
    } else if (!wasInside && isInside) {
      const mappings = getMappings(shapeId);
      mappings.forEach((mapping) => {
        if (mapping.sourceType === "mouseInside") return;
        if (mapping.midiType === "cc" && mapping.ccMode === "whileInside") {
          triggerCc(shapeId, mapping, mapping.ccValue ?? 127);
        }
      });
    }
  };

  const updateInsideStates = (normalizedPoint) => {
    if (!normalizedPoint) return;
    mappingStore.forEach((mappings, shapeId) => {
      if (!mappings.length) return;
      const previous = pointerState.insideShapes.get(shapeId) || false;
      const inside = !!editor.shapeContainsPoint(shapeId, normalizedPoint, 0.001);
      pointerState.insideShapes.set(shapeId, inside);
      handleInsideTransition(shapeId, previous, inside);
    });
    dispatchMouseInside();
  };

  const handleNoteMapping = (shapeId, mapping, intent) => {
    const runtime = ensureRuntimeMapping(shapeId, mapping.id);
    if (mapping.noteMode !== "pulse" && runtime.pulseTimeout) {
      clearTimeout(runtime.pulseTimeout);
      runtime.pulseTimeout = null;
    }
    switch (mapping.noteMode) {
      case "noteOn": {
        if (intent === "on" || intent === "pulse") {
          if (!runtime.noteOn) {
            const shapeName = ensureShapeName(shapeId, shapesCache.get(shapeId));
            console.info("[mediamime] Note On", {
              shape: shapeName,
              mappingId: mapping.id,
              channel: mapping.channel,
              note: mapping.note,
              velocity: mapping.velocity ?? 100
            });
            sendNoteOn(mapping.channel, mapping.note, mapping.velocity ?? 100);
            runtime.noteOn = true;
            flashShape(shapeId);
            flashPanel();
          }
        }
        break;
      }
      case "noteOff": {
        if (intent === "off" || intent === "pulse") {
          const shapeName = ensureShapeName(shapeId, shapesCache.get(shapeId));
          console.info("[mediamime] Note Off", {
            shape: shapeName,
            mappingId: mapping.id,
            channel: mapping.channel,
            note: mapping.note,
            velocity: mapping.offVelocity ?? 0
          });
          sendNoteOff(mapping.channel, mapping.note, mapping.offVelocity ?? 0);
          runtime.noteOn = false;
          flashShape(shapeId);
          flashPanel();
        }
        break;
      }
      case "pulse": {
        if (intent === "on" || intent === "pulse") {
          const duration = Number.isFinite(mapping.noteDurationMs) ? mapping.noteDurationMs : 400;
          const shapeName = ensureShapeName(shapeId, shapesCache.get(shapeId));
          console.info("[mediamime] Note Pulse", {
            shape: shapeName,
            mappingId: mapping.id,
            channel: mapping.channel,
            note: mapping.note,
            velocity: mapping.velocity ?? 100,
            duration
          });
          sendNoteOn(mapping.channel, mapping.note, mapping.velocity ?? 100);
          runtime.noteOn = true;
          flashShape(shapeId);
          flashPanel();
          runtime.pulseTimeout = window.setTimeout(() => {
            sendNoteOff(mapping.channel, mapping.note, mapping.offVelocity ?? 0);
            runtime.noteOn = false;
            runtime.pulseTimeout = null;
            flashShape(shapeId);
            flashPanel();
          }, clamp(Math.floor(duration), 10, 60000));
        }
        break;
      }
      default:
        break;
    }
  };

  const triggerCc = (shapeId, mapping, value) => {
    const runtime = ensureRuntimeMapping(shapeId, mapping.id);
    if (runtime.ccTimeout) {
      clearTimeout(runtime.ccTimeout);
      runtime.ccTimeout = null;
    }
    const midiValue = clampMidiValue(value);
    if (runtime.lastValue === midiValue) return;
    const shapeName = ensureShapeName(shapeId, shapesCache.get(shapeId));
    console.info("[mediamime] Control Change", {
      shape: shapeName,
      mappingId: mapping.id,
      channel: mapping.channel,
      cc: mapping.cc,
      value: midiValue
    });
    sendControlChange(mapping.channel, mapping.cc, midiValue);
    runtime.lastValue = midiValue;
    flashShape(shapeId);
    flashPanel();
  };

  function dispatchMouseInside() {
    mappingStore.forEach((mappings, shapeId) => {
      if (!mappings.length) return;
      const inside = pointerState.insideShapes.get(shapeId) || false;
      const intent = inside ? "on" : "off";
      mappings.forEach((mapping) => {
        if (mapping.sourceType !== "mouseInside") return;
        if (mapping.midiType === "note") {
          handleNoteMapping(shapeId, mapping, intent);
        } else if (mapping.midiType === "cc") {
          const value = intent === "on" ? mapping.ccValue ?? 127 : 0;
          triggerCc(shapeId, mapping, value);
        }
      });
    });
  }

  const dispatchAxisMappings = (normalizedPoint) => {
    if (!normalizedPoint) return;
    mappingStore.forEach((mappings, shapeId) => {
      if (!mappings.length) return;
      const inside = pointerState.insideShapes.get(shapeId) || false;
      mappings.forEach((mapping) => {
        if (mapping.midiType !== "cc" || mapping.ccMode !== "axis") return;
        if (mapping.requireInside && !inside) return;
        const axisSource = mapping.sourceType;
        if (axisSource === "mouseDrag" && !pointerState.isDown) return;
        if (axisSource === "mouseX" || axisSource === "mouseY" || axisSource === "mouseDrag") {
          const axisValue = axisSource === "mouseY" ? normalizedPoint.y : normalizedPoint.x;
          const midiValue = clampMidiValue(clamp01(axisValue) * 127);
          triggerCc(shapeId, mapping, midiValue);
        }
      });
    });
  };

  const dispatchMouseEvent = (sourceType, intent) => {
    if (pointerState.normalized) {
      updateInsideStates(pointerState.normalized);
    }
    mappingStore.forEach((mappings, shapeId) => {
      if (!mappings.length) return;
      const inside = pointerState.insideShapes.get(shapeId) || false;
      mappings.forEach((mapping) => {
        if (mapping.sourceType !== sourceType) return;
        if (mapping.requireInside && !inside) return;
        if (mapping.midiType === "note") {
          if (intent === "on" || intent === "off" || intent === "pulse") {
            handleNoteMapping(shapeId, mapping, intent);
          }
        } else if (mapping.midiType === "cc") {
          if (mapping.ccMode === "constant") {
            if (intent === "on" || intent === "pulse") {
              triggerCc(shapeId, mapping, mapping.ccValue ?? 127);
              if (intent === "pulse") {
                const runtime = ensureRuntimeMapping(shapeId, mapping.id);
                runtime.ccTimeout = window.setTimeout(() => {
                  sendControlChange(mapping.channel, mapping.cc, 0);
                  runtime.lastValue = 0;
                  runtime.ccTimeout = null;
                }, 120);
              }
            } else if (intent === "off") {
              triggerCc(shapeId, mapping, 0);
            }
          } else if (mapping.ccMode === "whileInside") {
            if (intent === "on" || intent === "pulse") {
              triggerCc(shapeId, mapping, mapping.ccValue ?? 127);
            } else if (intent === "off") {
              triggerCc(shapeId, mapping, 0);
            }
          }
        }
      });
    });
  };

  const dispatchKeyEvent = (sourceType, event) => {
    const lowerKey = event.key?.toLowerCase() || "";
    if (pointerState.normalized) {
      updateInsideStates(pointerState.normalized);
    }
    mappingStore.forEach((mappings, shapeId) => {
      if (!mappings.length) return;
      const inside = pointerState.insideShapes.get(shapeId) || false;
      mappings.forEach((mapping) => {
        if (mapping.sourceType !== sourceType) return;
        if (mapping.requireInside && !inside) return;
        if (mapping.key && mapping.key !== lowerKey) return;
        if (mapping.midiType === "note") {
          const intent = sourceType === "keyDown" ? "on" : "off";
          handleNoteMapping(shapeId, mapping, intent);
        } else if (mapping.midiType === "cc") {
          if (mapping.ccMode === "constant" || mapping.ccMode === "whileInside") {
            if (sourceType === "keyDown") {
              triggerCc(shapeId, mapping, mapping.ccMode === "constant" ? mapping.ccValue ?? 127 : mapping.ccValue ?? 127);
            } else if (sourceType === "keyUp") {
              triggerCc(shapeId, mapping, 0);
            }
          }
        }
      });
    });
  };

  const handlePointerMove = (event) => {
    const normalized = editor.normalizePoint({ clientX: event.clientX, clientY: event.clientY }, { clamp: true });
    if (!normalized) return;
    pointerState.normalized = normalized;
    pointerState.overEditor = true;
    pointerState.isDown = (event.buttons ?? 0) !== 0;
    updateInsideStates(normalized);
    dispatchAxisMappings(normalized);
  };

  const handlePointerDown = (event) => {
    pointerState.isDown = true;
    if (event.currentTarget?.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (error) {
        // ignore capture errors
      }
    }
    const normalized = editor.normalizePoint({ clientX: event.clientX, clientY: event.clientY }, { clamp: true });
    if (normalized) {
      pointerState.normalized = normalized;
      updateInsideStates(normalized);
    }
    dispatchMouseEvent("mouseDown", "on");
  };

  const handlePointerUp = (event) => {
    pointerState.isDown = false;
    if (event.currentTarget?.releasePointerCapture) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch (error) {
        // ignore release errors
      }
    }
    const normalized = editor.normalizePoint({ clientX: event.clientX, clientY: event.clientY }, { clamp: true });
    if (normalized) {
      pointerState.normalized = normalized;
      updateInsideStates(normalized);
    }
    dispatchMouseEvent("mouseUp", "off");
    dispatchMouseEvent("mouseDown", "off");
  };

  const handlePointerClick = (event) => {
    const normalized = editor.normalizePoint({ clientX: event.clientX, clientY: event.clientY }, { clamp: true });
    if (normalized) {
      pointerState.normalized = normalized;
      updateInsideStates(normalized);
    }
    dispatchMouseEvent("mouseClick", "pulse");
  };

  const handlePointerLeave = () => {
    pointerState.overEditor = false;
    pointerState.normalized = null;
    pointerState.isDown = false;
    mappingStore.forEach((_, shapeId) => {
      const previous = pointerState.insideShapes.get(shapeId) || false;
      pointerState.insideShapes.set(shapeId, false);
      handleInsideTransition(shapeId, previous, false);
    });
    dispatchMouseInside();
  };

  const handleKeyDown = (event) => {
    if (event.repeat) return;
    const target = event.target;
    const tag = target?.tagName?.toLowerCase();
    if (["input", "textarea", "select"].includes(tag) || target?.isContentEditable) return;
    dispatchKeyEvent("keyDown", event);
  };

  const handleKeyUp = (event) => {
    const target = event.target;
    const tag = target?.tagName?.toLowerCase();
    if (["input", "textarea", "select"].includes(tag) || target?.isContentEditable) return;
    dispatchKeyEvent("keyUp", event);
  };

  addMappingButton?.addEventListener("click", addMapping);
  shapeNameInput?.addEventListener("input", handleShapeNameInput);
  dragHandle?.addEventListener("pointerdown", handleDragPointerDown);
  const attachPointerListeners = () => {
    svg?.addEventListener("pointermove", handlePointerMove, { capture: true });
    svg?.addEventListener("pointerdown", handlePointerDown, { capture: true });
    svg?.addEventListener("pointerup", handlePointerUp, { capture: true });
    svg?.addEventListener("click", handlePointerClick, { capture: true });
    svg?.addEventListener("pointerleave", handlePointerLeave, { capture: true });
    svg?.addEventListener("pointercancel", handlePointerLeave, { capture: true });
  };

  mappingListEl?.addEventListener("change", handleMappingFieldChange);
  mappingListEl?.addEventListener("input", handleMappingFieldChange);
  mappingListEl?.addEventListener("click", handleMappingClick);
  shapeTableEl?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-shape-id]");
    if (!button) return;
    const shapeId = button.dataset.shapeId;
    if (!shapeId) return;
    const shapeSnapshot = editor.getShapeSnapshot ? editor.getShapeSnapshot(shapeId) : shapesCache.get(shapeId);
    if (!shapeSnapshot) return;
    const rect = button.getBoundingClientRect();
    const pointer = {
      clientX: rect.right + 12,
      clientY: rect.top + rect.height / 2
    };
    handleMappingRequest({ shapeId, shape: shapeSnapshot, pointer });
  });
  attachPointerListeners();
  editorRoot?.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("keyup", handleKeyUp, true);

  initializeMidi();
  bootstrapInitialState();

  const ensureVisibleWithinViewport = () => {
    const rect = modal.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);
    const left = clamp(rect.left, VIEWPORT_MARGIN, maxLeft);
    const top = clamp(rect.top, VIEWPORT_MARGIN, maxTop);
    modal.style.left = `${left}px`;
    modal.style.top = `${top}px`;
  };

  const positionModal = (pointer = {}) => {
    const pointerX = Number.isFinite(pointer.clientX) ? pointer.clientX : window.innerWidth / 2;
    const pointerY = Number.isFinite(pointer.clientY) ? pointer.clientY : window.innerHeight / 2;
    modal.style.left = `${pointerX + MODAL_OFFSET}px`;
    modal.style.top = `${pointerY + MODAL_OFFSET}px`;
  };

  const showModal = () => {
    if (state.isOpen) return;
    modal.classList.remove("is-hidden");
    modal.classList.add("is-open", "is-visible");
    modal.setAttribute("aria-hidden", "false");
    state.isOpen = true;
    requestAnimationFrame(() => {
      ensureVisibleWithinViewport();
      focusTarget?.focus?.({ preventScroll: true });
    });
  };

  const hideModal = () => {
    if (!state.isOpen) return;
    modal.classList.remove("is-open", "is-visible");
    modal.classList.add("is-hidden");
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-active");
    state.isOpen = false;
    state.shapeId = null;
    describeShape(null);
    finalizeDrag();
    renderShapeTable();
  };

  const describeShape = (shape) => {
    if (!shapeLabelEl) return;
    if (!shape || !state.shapeId) {
      shapeLabelEl.textContent = "MIDI Mapping";
      if (shapeNameInput) {
        shapeNameInput.value = "";
        shapeNameInput.placeholder = "Untitled shape";
      }
      return;
    }
    const name = ensureShapeName(state.shapeId, shape);
    shapeLabelEl.textContent = name;
    if (shapeNameInput) {
      shapeNameInput.value = name;
    }
  };

  const syncFromCache = () => {
    if (!state.shapeId) return;
    const shape = shapesCache.get(state.shapeId);
    if (!shape) {
      hideModal();
      return;
    }
    describeShape(shape);
  };

  const handleMappingRequest = (payload) => {
    if (!payload || !payload.shapeId || !payload.shape) return;
    state.shapeId = payload.shapeId;
    shapesCache.set(payload.shapeId, payload.shape);
    ensureShapeName(payload.shapeId, payload.shape);
    describeShape(payload.shape);
    renderMappingList();
    renderShapeTable();
    positionModal(payload.pointer);
    showModal();
  };

  const handleSelectionChange = (payload) => {
    if (!state.isOpen || !state.shapeId) return;
    if (!payload || !Array.isArray(payload.selection)) return;
    if (!payload.selection.includes(state.shapeId)) {
      hideModal();
      return;
    }
    if (Array.isArray(payload.shapes)) {
      payload.shapes.forEach((shape) => {
        if (shape?.id) {
          shapesCache.set(shape.id, shape);
          ensureShapeName(shape.id, shape);
        }
      });
      syncFromCache();
      renderMappingList();
      renderShapeTable();
    }
  };

  const handleShapesChange = (shapes) => {
    if (!Array.isArray(shapes)) return;
    shapesCache.clear();
    const present = new Set();
    shapes.forEach((shape) => {
      if (shape?.id) {
        shapesCache.set(shape.id, shape);
        present.add(shape.id);
      }
    });
    Array.from(mappingStore.keys()).forEach((shapeId) => {
      if (!present.has(shapeId)) {
        mappingStore.delete(shapeId);
        runtimeState.delete(shapeId);
        pointerState.insideShapes.delete(shapeId);
        shapeNames.delete(shapeId);
      }
    });
    if (state.isOpen) {
      syncFromCache();
      renderMappingList();
    }
    if (pointerState.normalized) {
      updateInsideStates(pointerState.normalized);
    }
    renderShapeTable();
  };

  const handleOutsidePointer = (event) => {
    if (!state.isOpen) return;
    if (modal.contains(event.target)) return;
    hideModal();
  };

  const handleEscape = (event) => {
    if (!state.isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      hideModal();
    }
  };

  closeButtons.forEach((button) => {
    button.addEventListener("click", hideModal);
  });

  document.addEventListener("pointerdown", handleOutsidePointer, true);
  window.addEventListener("keydown", handleEscape, true);

  editor.on("mappingrequest", handleMappingRequest);
  editor.on("selectionchange", handleSelectionChange);
  editor.on("shapeschange", handleShapesChange);

  return {
    dispose() {
      document.removeEventListener("pointerdown", handleOutsidePointer, true);
      window.removeEventListener("keydown", handleEscape, true);
      addMappingButton?.removeEventListener("click", addMapping);
      shapeNameInput?.removeEventListener("input", handleShapeNameInput);
      dragHandle?.removeEventListener("pointerdown", handleDragPointerDown);
      mappingListEl?.removeEventListener("change", handleMappingFieldChange);
      mappingListEl?.removeEventListener("input", handleMappingFieldChange);
      mappingListEl?.removeEventListener("click", handleMappingClick);
      svg?.removeEventListener("pointermove", handlePointerMove, true);
      svg?.removeEventListener("pointerdown", handlePointerDown, true);
      svg?.removeEventListener("pointerup", handlePointerUp, true);
      svg?.removeEventListener("click", handlePointerClick, true);
      svg?.removeEventListener("pointerleave", handlePointerLeave, true);
      svg?.removeEventListener("pointercancel", handlePointerLeave, true);
      editorRoot?.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      if (midiState.access) {
        midiState.access.removeEventListener("statechange", refreshMidiOutputs);
      }
      midiState.outputs.clear();
      midiState.ready = false;
      handlePointerLeave();
      editor.off("mappingrequest", handleMappingRequest);
      editor.off("selectionchange", handleSelectionChange);
      editor.off("shapeschange", handleShapesChange);
      modal.remove();
      shapesCache.clear();
    }
  };
}
