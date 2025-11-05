const ensureUuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Math.random().toString(36).slice(2, 10)}`;
};

const clampRange = (value, min, max) => {
  const number = Number.isFinite(value) ? value : Number.parseFloat(`${value}`) || 0;
  return Math.min(max, Math.max(min, number));
};

const clampUnit = (value) => clampRange(value, 0, 1);

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (match) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[match]));

const POSE_LANDMARKS_LIST = [
  { key: "nose", label: "Nose", index: 0 },
  { key: "left_eye_inner", label: "Left eye inner", index: 1 },
  { key: "left_eye", label: "Left eye", index: 2 },
  { key: "left_eye_outer", label: "Left eye outer", index: 3 },
  { key: "right_eye_inner", label: "Right eye inner", index: 4 },
  { key: "right_eye", label: "Right eye", index: 5 },
  { key: "right_eye_outer", label: "Right eye outer", index: 6 },
  { key: "left_ear", label: "Left ear", index: 7 },
  { key: "right_ear", label: "Right ear", index: 8 },
  { key: "mouth_left", label: "Mouth (left)", index: 9 },
  { key: "mouth_right", label: "Mouth (right)", index: 10 },
  { key: "left_shoulder", label: "Left shoulder", index: 11 },
  { key: "right_shoulder", label: "Right shoulder", index: 12 },
  { key: "left_elbow", label: "Left elbow", index: 13 },
  { key: "right_elbow", label: "Right elbow", index: 14 },
  { key: "left_wrist", label: "Left wrist", index: 15 },
  { key: "right_wrist", label: "Right wrist", index: 16 },
  { key: "left_pinky", label: "Left pinky", index: 17 },
  { key: "right_pinky", label: "Right pinky", index: 18 },
  { key: "left_index", label: "Left index", index: 19 },
  { key: "right_index", label: "Right index", index: 20 },
  { key: "left_thumb", label: "Left thumb", index: 21 },
  { key: "right_thumb", label: "Right thumb", index: 22 },
  { key: "left_hip", label: "Left hip", index: 23 },
  { key: "right_hip", label: "Right hip", index: 24 },
  { key: "left_knee", label: "Left knee", index: 25 },
  { key: "right_knee", label: "Right knee", index: 26 },
  { key: "left_ankle", label: "Left ankle", index: 27 },
  { key: "right_ankle", label: "Right ankle", index: 28 },
  { key: "left_heel", label: "Left heel", index: 29 },
  { key: "right_heel", label: "Right heel", index: 30 },
  { key: "left_foot_index", label: "Left foot index", index: 31 },
  { key: "right_foot_index", label: "Right foot index", index: 32 }
];

const HAND_LANDMARKS_LIST = [
  { key: "wrist", label: "Wrist", index: 0 },
  { key: "thumb_cmc", label: "Thumb CMC", index: 1 },
  { key: "thumb_mcp", label: "Thumb MCP", index: 2 },
  { key: "thumb_ip", label: "Thumb IP", index: 3 },
  { key: "thumb_tip", label: "Thumb tip", index: 4 },
  { key: "index_mcp", label: "Index MCP", index: 5 },
  { key: "index_pip", label: "Index PIP", index: 6 },
  { key: "index_dip", label: "Index DIP", index: 7 },
  { key: "index_tip", label: "Index tip", index: 8 },
  { key: "middle_mcp", label: "Middle MCP", index: 9 },
  { key: "middle_pip", label: "Middle PIP", index: 10 },
  { key: "middle_dip", label: "Middle DIP", index: 11 },
  { key: "middle_tip", label: "Middle tip", index: 12 },
  { key: "ring_mcp", label: "Ring MCP", index: 13 },
  { key: "ring_pip", label: "Ring PIP", index: 14 },
  { key: "ring_dip", label: "Ring DIP", index: 15 },
  { key: "ring_tip", label: "Ring tip", index: 16 },
  { key: "pinky_mcp", label: "Pinky MCP", index: 17 },
  { key: "pinky_pip", label: "Pinky PIP", index: 18 },
  { key: "pinky_dip", label: "Pinky DIP", index: 19 },
  { key: "pinky_tip", label: "Pinky tip", index: 20 }
];

const FACE_REFERENCE_POINTS = [
  { key: "centroid", label: "Face centroid" },
  { key: "nose_tip", label: "Nose tip", index: 1 }
];

const POINTER_REFERENCE_POINTS = [
  { key: "position", label: "Pointer position" },
  { key: "button", label: "Pointer button (inside shape)" }
];

const KEYBOARD_DIGIT_KEYS = Array.from({ length: 10 }, (_, index) => ({
  key: `Digit${index}`,
  label: `${index}`
}));

const KEYBOARD_LETTER_KEYS = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map((char) => ({
  key: `Key${char}`,
  label: char
}));

const KEYBOARD_REFERENCE_KEYS = [
  { key: "Space", label: "Space" },
  { key: "Enter", label: "Enter" },
  { key: "Escape", label: "Escape" },
  { key: "Tab", label: "Tab" },
  { key: "Backspace", label: "Backspace" },
  { key: "ArrowUp", label: "Arrow Up" },
  { key: "ArrowDown", label: "Arrow Down" },
  { key: "ArrowLeft", label: "Arrow Left" },
  { key: "ArrowRight", label: "Arrow Right" },
  { key: "ShiftLeft", label: "Shift (Left)" },
  { key: "ShiftRight", label: "Shift (Right)" },
  { key: "AltLeft", label: "Option / Alt (Left)" },
  { key: "AltRight", label: "Option / Alt (Right)" },
  { key: "ControlLeft", label: "Control (Left)" },
  { key: "ControlRight", label: "Control (Right)" },
  { key: "MetaLeft", label: "Command (Left)" },
  { key: "MetaRight", label: "Command (Right)" },
  { key: "NumpadEnter", label: "Numpad Enter" },
  ...KEYBOARD_DIGIT_KEYS,
  ...KEYBOARD_LETTER_KEYS
];

const STREAM_DEFINITIONS = {
  pose: {
    id: "pose",
    label: "Pose Landmarks",
    options: POSE_LANDMARKS_LIST
  },
  leftHand: {
    id: "leftHand",
    label: "Left Hand",
    options: HAND_LANDMARKS_LIST
  },
  rightHand: {
    id: "rightHand",
    label: "Right Hand",
    options: HAND_LANDMARKS_LIST
  },
  face: {
    id: "face",
    label: "Face (centroid)",
    options: FACE_REFERENCE_POINTS
  },
  pointer: {
    id: "pointer",
    label: "Pointer Input",
    options: POINTER_REFERENCE_POINTS
  },
  keyboard: {
    id: "keyboard",
    label: "Keyboard",
    options: KEYBOARD_REFERENCE_KEYS
  }
};

const EVENT_TYPE_OPTIONS = [
  { id: "none", label: "None" },
  { id: "midiNote", label: "MIDI Note" },
  { id: "midiCc", label: "MIDI CC" }
];

const EVENT_TRIGGER_OPTIONS = [
  { id: "enter", label: "Enter" },
  { id: "exit", label: "Exit" },
  { id: "enterExit", label: "Enter + Exit" },
  { id: "inside", label: "While Inside" }
];

const VALUE_SOURCE_OPTIONS = [
  { id: "constant", label: "Constant" },
  { id: "normX", label: "Norm X" },
  { id: "normY", label: "Norm Y" },
  { id: "distance", label: "Distance" }
];

const RAD_TO_DEG = 180 / Math.PI;
const CONTINUOUS_TRIGGER_INTERVAL_MS = 120;
const MIN_METRIC_SPAN = 1e-4;
const DEFAULT_METRICS = Object.freeze({ normX: 0, normY: 0, distance: 0 });

const normalizeAngle = (angle) => {
  if (!Number.isFinite(angle)) return 0;
  let value = angle;
  while (value <= -Math.PI) value += Math.PI * 2;
  while (value > Math.PI) value -= Math.PI * 2;
  return value;
};

const rotateVector = (vector, angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos
  };
};

const rotatePointAround = (px, py, cx, cy, angle) => {
  const translated = {
    x: px - cx,
    y: py - cy
  };
  const rotated = rotateVector(translated, angle);
  return {
    x: rotated.x + cx,
    y: rotated.y + cy
  };
};

const normalizeVertices = (vertices) => {
  if (!Array.isArray(vertices)) return [];
  const normalized = [];
  for (const vertex of vertices) {
    const x = clampUnit(vertex?.x ?? 0);
    const y = clampUnit(vertex?.y ?? 0);
    if (!normalized.length) {
      normalized.push({ x, y });
      continue;
    }
    const prev = normalized[normalized.length - 1];
    if (Math.abs(prev.x - x) <= 1e-6 && Math.abs(prev.y - y) <= 1e-6) {
      normalized[normalized.length - 1] = { x, y };
    } else {
      normalized.push({ x, y });
    }
  }
  return normalized;
};

const getSqSegDist = (p, p1, p2) => {
  let x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
};

const pointInPolygon = (vertices, point) => {
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
};

const pointNearPolyline = (vertices, point, tolerance) => {
  const tolSq = tolerance * tolerance;
  for (let i = 0; i < vertices.length - 1; i++) {
    if (getSqSegDist(point, vertices[i], vertices[i + 1]) <= tolSq) {
      return true;
    }
  }
  if (vertices.length > 2 && getSqSegDist(point, vertices[vertices.length - 1], vertices[0]) <= tolSq) {
    return true;
  }
  return false;
};

const getShapeAabb = (shape) => {
  if (!shape) return null;
  if (shape.type === "rect" || shape.type === "ellipse") {
    return {
      minX: clampUnit(shape.x ?? 0),
      minY: clampUnit(shape.y ?? 0),
      maxX: clampUnit((shape.x ?? 0) + (shape.width ?? 0)),
      maxY: clampUnit((shape.y ?? 0) + (shape.height ?? 0))
    };
  }
  if (shape.type === "line" || shape.type === "path" || shape.type === "polyline") {
    const vertices = normalizeVertices(shape.points || shape.vertices || []);
    if (!vertices.length) return null;
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    vertices.forEach((vertex) => {
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxX = Math.max(maxX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
    });
    return { minX, minY, maxX, maxY };
  }
  return null;
};

const shapeContainsPoint = (shape, point, tolerance = 0.01) => {
  if (!shape) return false;
  if (shape.type === "rect" || shape.type === "ellipse") {
    const rotation = normalizeAngle(shape.rotation || 0);
    const width = shape.width ?? 0;
    const height = shape.height ?? 0;
    if (width <= 0 || height <= 0) return false;
    const cx = (shape.x ?? 0) + width / 2;
    const cy = (shape.y ?? 0) + height / 2;
    let localX = point.x;
    let localY = point.y;
    if (rotation) {
      const rotated = rotatePointAround(point.x, point.y, cx, cy, -rotation);
      localX = rotated.x;
      localY = rotated.y;
    }
    const dx = localX - cx;
    const dy = localY - cy;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    if (shape.type === "ellipse") {
      const nx = halfWidth > 0 ? dx / halfWidth : 0;
      const ny = halfHeight > 0 ? dy / halfHeight : 0;
      return nx * nx + ny * ny <= 1;
    }
    return Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight;
  }
  const vertices = normalizeVertices(shape.points || shape.vertices);
  if (!vertices.length) return false;
  if (shape.closed && vertices.length >= 3) {
    if (pointInPolygon(vertices, point)) return true;
  }
  return pointNearPolyline(vertices, point, tolerance);
};

const getShapeCenter = (shape) => {
  if (shape.type === "rect" || shape.type === "ellipse") {
    return {
      x: (shape.x ?? 0) + (shape.width ?? 0) / 2,
      y: (shape.y ?? 0) + (shape.height ?? 0) / 2
    };
  }
  const bounds = getShapeAabb(shape);
  if (!bounds) return { x: 0.5, y: 0.5 };
  return {
    x: clampUnit((bounds.minX + bounds.maxX) / 2),
    y: clampUnit((bounds.minY + bounds.maxY) / 2)
  };
};

const computeShapeBounds = (shape) => {
  if (!shape) {
    return { minX: 0, minY: 0, width: 1, height: 1, centerX: 0.5, centerY: 0.5 };
  }
  const bounds = getShapeAabb(shape) || { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  const width = Math.max((bounds.maxX ?? 0) - (bounds.minX ?? 0), MIN_METRIC_SPAN);
  const height = Math.max((bounds.maxY ?? 0) - (bounds.minY ?? 0), MIN_METRIC_SPAN);
  const centerX = clampUnit((bounds.minX ?? 0) + width / 2);
  const centerY = clampUnit((bounds.minY ?? 0) + height / 2);
  return { minX: bounds.minX ?? 0, minY: bounds.minY ?? 0, width, height, centerX, centerY };
};

const computeShapeMetrics = (shape, point) => {
  if (!shape || !point) {
    return { normX: 0, normY: 0, distance: 0 };
  }
  const bounds = computeShapeBounds(shape);
  const px = clampUnit(point.x ?? 0);
  const py = clampUnit(point.y ?? 0);
  const hasWidth = bounds.width > MIN_METRIC_SPAN;
  const hasHeight = bounds.height > MIN_METRIC_SPAN;
  const normX = hasWidth ? clampUnit((px - bounds.minX) / bounds.width) : 0.5;
  const normY = hasHeight ? clampUnit((py - bounds.minY) / bounds.height) : 0.5;
  const radius = Math.max(bounds.width, bounds.height) / 2;
  const distance = radius > MIN_METRIC_SPAN
    ? clampUnit(Math.hypot(px - bounds.centerX, py - bounds.centerY) / radius)
    : 0;
  return { normX, normY, distance };
};

const resolveValueFromMode = (mode, metrics, constantValue, { midi = false } = {}) => {
  const data = { ...DEFAULT_METRICS, ...(metrics || {}) };
  const asUnit = (value) => clampUnit(Number.isFinite(value) ? value : 0);
  const asMidi = (value) => clampRange(Math.round(Number.isFinite(value) ? value : 0), 0, 127);
  switch (mode) {
    case "normX": {
      const scalar = asUnit(data.normX);
      return midi ? asMidi(scalar * 127) : scalar;
    }
    case "normY": {
      const scalar = asUnit(data.normY);
      return midi ? asMidi(scalar * 127) : scalar;
    }
    case "distance": {
      const scalar = asUnit(data.distance);
      return midi ? asMidi(scalar * 127) : scalar;
    }
    case "constant":
    default: {
      if (midi) {
        return asMidi(Number(constantValue));
      }
      return asUnit(Number(constantValue));
    }
  }
};

const getNow = () => (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();


const distanceBetween = (a, b) => {
  if (!a || !b) return 0;
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  return Math.hypot(dx, dy);
};

const createDefaultEvent = (type = "none") => {
  const id = ensureUuid();
  switch (type) {
    case "midiNote":
      return {
        id,
        type,
        trigger: "enter",
        channel: 1,
        note: 60,
        velocityMode: "constant",
        velocityValue: 96
      };
    case "midiCc":
      return {
        id,
        type,
        trigger: "enter",
        channel: 1,
        cc: 1,
        ccValueMode: "constant",
        ccValue: 100
      };
    default:
      return {
        id,
        type: "none",
        trigger: "enter"
      };
  }
};

const normalizeEvent = (event) => {
  if (!event || typeof event !== "object") {
    return createDefaultEvent("none");
  }
  const typeValid = EVENT_TYPE_OPTIONS.some((option) => option.id === event.type);
  const type = typeValid ? event.type : "none";
  const base = createDefaultEvent(type);
  const normalized = {
    ...base,
    ...event,
    id: event.id || base.id,
    type
  };
  const triggerValid = EVENT_TRIGGER_OPTIONS.some((option) => option.id === normalized.trigger);
  normalized.trigger = triggerValid ? normalized.trigger : "enter";
  if (type === "midiNote") {
    normalized.channel = clampRange(Number.parseInt(`${normalized.channel}`, 10) || 1, 1, 16);
    normalized.note = clampRange(Number.parseInt(`${normalized.note}`, 10) || 60, 0, 127);
    const velocityModeValid = VALUE_SOURCE_OPTIONS.some((option) => option.id === normalized.velocityMode);
    normalized.velocityMode = velocityModeValid ? normalized.velocityMode : "constant";
    normalized.velocityValue = clampRange(Number.parseInt(`${normalized.velocityValue}`, 10) || 96, 0, 127);
  } else if (type === "midiCc") {
    normalized.channel = clampRange(Number.parseInt(`${normalized.channel}`, 10) || 1, 1, 16);
    normalized.cc = clampRange(Number.parseInt(`${normalized.cc}`, 10) || 1, 0, 127);
    const ccValueModeValid = VALUE_SOURCE_OPTIONS.some((option) => option.id === normalized.ccValueMode);
    normalized.ccValueMode = ccValueModeValid ? normalized.ccValueMode : "constant";
    normalized.ccValue = clampRange(Number.parseInt(`${normalized.ccValue}`, 10) || 100, 0, 127);
  }
  return normalized;
};

const createDefaultInteraction = () => ({
  stream: "pose",
  landmark: "left_wrist",
  events: [createDefaultEvent("midiNote")]
});

const mergeInteraction = (input) => {
  const defaults = createDefaultInteraction();
  const source = input && typeof input === "object" ? input : {};
  const streamKey = STREAM_DEFINITIONS[source.stream] ? source.stream : defaults.stream;
  const streamDefinition = STREAM_DEFINITIONS[streamKey];
  const options = Array.isArray(streamDefinition?.options) ? streamDefinition.options : [];
  const candidateLandmark = source.landmark;
  const landmarkValid = options.some((option) => option.key === candidateLandmark);
  const fallbackLandmark = options[0]?.key || defaults.landmark;
  const events = Array.isArray(source.events) && source.events.length
    ? source.events.map(normalizeEvent)
    : defaults.events.map((event) => ({ ...normalizeEvent(event) }));
  return {
    stream: streamDefinition?.id || defaults.stream,
    landmark: landmarkValid ? candidateLandmark : fallbackLandmark,
    events
  };
};

const renderOptions = (options, selected) =>
  options
    .map((option) => `<option value="${escapeHtml(option.id)}"${option.id === selected ? " selected" : ""}>${escapeHtml(option.label)}</option>`)
    .join("");

const renderEventCard = (event) => {
  const normalized = normalizeEvent(event);
  const typeOptions = renderOptions(EVENT_TYPE_OPTIONS, normalized.type);
  const triggerOptions = renderOptions(EVENT_TRIGGER_OPTIONS, normalized.trigger);
  const renderModeOptions = (mode) => renderOptions(VALUE_SOURCE_OPTIONS, mode || "constant");
  const velocityValueStyle = normalized.type === "midiNote" && normalized.velocityMode === "constant" ? "" : ' style="display:none;"';
  const ccValueStyle = normalized.type === "midiCc" && normalized.ccValueMode === "constant" ? "" : ' style="display:none;"';

  let bodyMarkup = `<div class="event-body"><div class="event-row"><span class="event-empty">Select an event type.</span></div></div>`;
  if (normalized.type === "midiNote") {
    bodyMarkup = `
      <div class="event-body">
        <div class="event-row">
          <label class="field-compact small" title="MIDI Channel">
            <span>Ch</span>
            <input type="number" min="1" max="16" value="${clampRange(normalized.channel, 1, 16)}" data-field="channel">
          </label>
          <label class="field-compact small" title="Note">
            <span>Note</span>
            <input type="number" min="0" max="127" value="${clampRange(normalized.note, 0, 127)}" data-field="note">
          </label>
        </div>
        <div class="event-row">
          <label class="field-compact" title="Velocity source">
            <span>Vel</span>
            <select data-field="velocityMode">${renderModeOptions(normalized.velocityMode)}</select>
          </label>
          <label class="field-compact" title="Velocity value"${velocityValueStyle}>
            <span>Val</span>
            <input type="number" min="0" max="127" value="${clampRange(normalized.velocityValue, 0, 127)}" data-field="velocityValue">
          </label>
        </div>
      </div>
    `;
  } else if (normalized.type === "midiCc") {
    bodyMarkup = `
      <div class="event-body">
        <div class="event-row">
          <label class="field-compact small" title="MIDI Channel">
            <span>Ch</span>
            <input type="number" min="1" max="16" value="${clampRange(normalized.channel, 1, 16)}" data-field="channel">
          </label>
          <label class="field-compact small" title="Control Change number">
            <span>CC#</span>
            <input type="number" min="0" max="127" value="${clampRange(normalized.cc, 0, 127)}" data-field="cc">
          </label>
        </div>
        <div class="event-row">
          <label class="field-compact" title="Value source">
            <span>Val</span>
            <select data-field="ccValueMode">${renderModeOptions(normalized.ccValueMode)}</select>
          </label>
          <label class="field-compact" title="Value amount"${ccValueStyle}>
            <span>Amt</span>
            <input type="number" min="0" max="127" value="${clampRange(normalized.ccValue, 0, 127)}" data-field="ccValue">
          </label>
        </div>
      </div>
    `;
  }

  return `
    <div class="event-card" data-event-id="${escapeHtml(normalized.id)}" data-event-type="${escapeHtml(normalized.type)}">
      <div class="event-card-header">
        <select data-field="type">${typeOptions}</select>
        <select data-field="trigger">${triggerOptions}</select>
        <button type="button" class="icon-button event-remove" data-action="remove-event" title="Remove event" aria-label="Remove event">
          <span class="material-icons-outlined" aria-hidden="true">delete</span>
        </button>
      </div>
      ${bodyMarkup}
    </div>
  `;
};

const populateStreamSelect = (selectEl) => {
  if (!selectEl) return;
  const options = Object.values(STREAM_DEFINITIONS).map(
    (stream) => `<option value="${escapeHtml(stream.id)}">${escapeHtml(stream.label)}</option>`
  );
  selectEl.innerHTML = options.join("");
};

const populateLandmarkOptions = (streamId, selectedKey, selectEl) => {
  if (!selectEl) return "";
  const definition = STREAM_DEFINITIONS[streamId] || STREAM_DEFINITIONS.pose;
  const options = Array.isArray(definition.options) ? definition.options : [];
  selectEl.innerHTML = options
    .map((option) => `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`)
    .join("");
  const fallback = options[0]?.key || "";
  const normalised = options.some((option) => option.key === selectedKey) ? selectedKey : fallback;
  selectEl.value = normalised || "";
  return normalised;
};

const renderEventList = (listEl, events = []) => {
  if (!listEl) return;
  const normalized = Array.isArray(events) ? events.map(normalizeEvent) : [];
  if (!normalized.length) {
    listEl.innerHTML = `<div class="event-empty">No events configured.</div>`;
    return;
  }
  listEl.innerHTML = normalized.map((event) => renderEventCard(event)).join("");
};

export function initMapping({ editor }) {
  if (!editor) {
    console.warn("[mediamime] Mapping module requires an editor API.");
    return { dispose() {} };
  }

  const modal = document.getElementById("assignment-modal");
  const backdrop = document.getElementById("assignment-backdrop");
  const shapeNameInput = document.getElementById("assignment-shape-name");
  const streamSelect = document.getElementById("assignment-stream");
  const landmarkSelect = document.getElementById("assignment-landmark");
  const assignmentMidiPortSelect = document.getElementById("assignment-midi-port");
  const assignmentMidiPortRefreshButton = document.getElementById("assignment-midi-port-refresh");
  const addEventButton = document.getElementById("assignment-add-event");
  const eventList = document.getElementById("assignment-event-list");
  const closeButton = document.getElementById("assignment-modal-close");
  const openButton = document.getElementById("editor-open-modal");
  const assignmentHandle = modal.querySelector("[data-assignment-handle]");
  const svg = document.getElementById("gesture-svg");
  const editorShapeList = document.getElementById("editor-shape-list");
  const editorDetailEmpty = document.getElementById("editor-detail-empty");
  const editorDetailForm = document.getElementById("editor-detail-form");
  const editorStreamSelect = document.getElementById("editor-stream-select");
  const editorLandmarkSelect = document.getElementById("editor-landmark-select");
  const editorEventList = document.getElementById("editor-event-list");
  const editorAddEventButton = document.getElementById("editor-add-event");
  const editorDeleteShapeButton = document.getElementById("editor-delete-shape");
  const editorMidiPortSelect = document.getElementById("editor-midi-port");
  const editorMidiPortRefreshButton = document.getElementById("editor-midi-port-refresh");

  if (!modal || !backdrop || !eventList) {
    console.warn("[mediamime] Mapping modal markup is missing; skipping mapping module.");
    return { dispose() {} };
  }

  populateStreamSelect(streamSelect);
  populateStreamSelect(editorStreamSelect);

  const CONFIG_STORAGE_KEY = "mediamime:config";
  const DEFAULT_EDITOR_CONFIG = {
    midiPort: "broadcast"
  };
  const editorConfig = { ...DEFAULT_EDITOR_CONFIG };

  const ASSIGNMENT_LAYOUT_KEY = "mediamime:assignment-modal";

  const loadAssignmentLayout = () => {
    if (typeof localStorage === "undefined") return {};
    try {
      const raw = localStorage.getItem(ASSIGNMENT_LAYOUT_KEY);
      if (!raw) return {};
      const stored = JSON.parse(raw);
      return stored && typeof stored === "object" ? stored : {};
    } catch (error) {
      console.warn("[mediamime] Failed to load assignment layout", error);
      return {};
    }
  };

  const saveAssignmentLayout = (layout) => {
    assignmentLayout = layout || {};
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(ASSIGNMENT_LAYOUT_KEY, JSON.stringify(assignmentLayout));
    } catch (error) {
      console.warn("[mediamime] Failed to persist assignment layout", error);
    }
  };

  const loadEditorConfig = () => {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (!stored || typeof stored !== "object") return;
      if (stored.midiPort) editorConfig.midiPort = String(stored.midiPort);
    } catch (error) {
      console.warn("[mediamime] Failed to load config", error);
    }
  };

  const saveEditorConfig = () => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ midiPort: editorConfig.midiPort }));
    } catch (error) {
      console.warn("[mediamime] Failed to persist config", error);
    }
  };

  loadEditorConfig();

  const midiState = {
    supported: typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function",
    ready: false,
    pending: null,
    access: null,
    outputs: []
  };

  let isSyncingConfig = false;
  let isSyncingEditorForm = false;

  const shapesById = new Map();
  const shapeOrder = [];
  const runtimeState = new Map();
  const inputState = {
    pointer: {
      normalized: null,
      isDown: false,
      pointerId: null,
      isOverCanvas: false,
      lastUpdate: 0
    },
    keyboard: {
      keys: new Map()
    },
    holistic: null
  };

  const applyAssignmentLayout = () => {
    if (!modal) return;
    const width = modal.offsetWidth || 360;
    const height = modal.offsetHeight || 420;
    if (Number.isFinite(assignmentLayout.left) && Number.isFinite(assignmentLayout.top)) {
      const maxLeft = Math.max(12, window.innerWidth - width - 12);
      const maxTop = Math.max(12, window.innerHeight - height - 12);
      const left = clampRange(assignmentLayout.left, 12, maxLeft);
      const top = clampRange(assignmentLayout.top, 12, maxTop);
      modal.style.transform = "none";
      modal.style.left = `${left}px`;
      modal.style.top = `${top}px`;
      modal.style.right = "auto";
      modal.style.bottom = "auto";
    } else {
      modal.style.transform = "translate(-50%, -50%)";
      modal.style.left = "";
      modal.style.top = "";
      modal.style.right = "";
      modal.style.bottom = "";
    }
  };

  let assignmentLayout = loadAssignmentLayout();
  let dragContext = null;

  const ensureRuntimeShape = (shapeId) => {
    if (!shapeId) return null;
    if (!runtimeState.has(shapeId)) {
      runtimeState.set(shapeId, {
        inside: false,
        hoverInside: false,
        lastTriggerAt: 0,
        lastContinuousAt: 0,
        noteOn: false,
        eventState: new Map(),
        lastMetrics: { normX: 0, normY: 0, distance: 0 },
        active: false
      });
    }
    return runtimeState.get(shapeId);
  };

  const clearRuntimeState = (shapeId) => {
    if (!shapeId) return;
    runtimeState.delete(shapeId);
  };

  const isShapeActive = (shapeId) => {
    const runtime = runtimeState.get(shapeId);
    return Boolean(runtime?.active);
  };

  const applyShapeHighlight = (shapeId) => {
    const active = isShapeActive(shapeId);
    if (svg) {
      const node = svg.querySelector(`[data-shape-id="${shapeId}"]`);
      if (node) {
        node.classList.toggle("is-mapping-active", active);
      }
    }
    if (editorShapeList) {
      const button = editorShapeList.querySelector(`[data-shape-id="${shapeId}"]`);
      if (button) {
        if (active) {
          button.setAttribute("data-active", "true");
        } else {
          button.removeAttribute("data-active");
        }
      }
    }
  };

  const updateShapeActiveIndicators = () => {
    shapeOrder.forEach((shapeId) => applyShapeHighlight(shapeId));
  };

  const getMidiOutputs = () => Array.isArray(midiState.outputs) ? midiState.outputs : [];

  const midiOptionLabel = (output, index) => {
    const baseName = output?.name && output.name.trim() ? output.name.trim() : `Port ${index + 1}`;
    const manufacturer = output?.manufacturer && output.manufacturer.trim() ? output.manufacturer.trim() : "";
    return manufacturer ? `${baseName} (${manufacturer})` : baseName;
  };

  const populateMidiPortSelect = (selectEl, selectedId = editorConfig.midiPort) => {
    if (!selectEl) return;
    const outputs = getMidiOutputs();
    const options = [
      { id: "broadcast", label: "All Outputs" },
      ...outputs.map((output, index) => ({
        id: output.id || `port-${index}`,
        label: midiOptionLabel(output, index)
      }))
    ];
    const markup = options
      .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
      .join("");
    selectEl.innerHTML = markup;
    const normalized = options.some((option) => option.id === selectedId) ? selectedId : "broadcast";
    selectEl.value = normalized;
    selectEl.dataset.selectedPort = normalized;
  };

  const applyMidiSelections = () => {
    isSyncingConfig = true;
    populateMidiPortSelect(assignmentMidiPortSelect, editorConfig.midiPort);
    populateMidiPortSelect(editorMidiPortSelect, editorConfig.midiPort);
    isSyncingConfig = false;
  };

  const setMidiPort = (value) => {
    const normalized = value && value !== "broadcast" ? value : "broadcast";
    if (editorConfig.midiPort === normalized) {
      applyMidiSelections();
      return;
    }
    editorConfig.midiPort = normalized;
    applyMidiSelections();
    saveEditorConfig();
  };

  const ensureMidiAccess = () => {
    if (!midiState.supported) {
      return Promise.resolve([]);
    }
    if (midiState.ready && midiState.access) {
      midiState.outputs = Array.from(midiState.access.outputs.values());
      applyMidiSelections();
      return Promise.resolve(midiState.outputs);
    }
    if (!midiState.pending) {
      midiState.pending = navigator.requestMIDIAccess({ sysex: false }).then((access) => {
        midiState.access = access;
        midiState.outputs = Array.from(access.outputs.values());
        midiState.ready = true;
        if (typeof access.addEventListener === "function") {
          access.addEventListener("statechange", () => {
            midiState.outputs = Array.from(access.outputs.values());
            applyMidiSelections();
          });
        } else {
          access.onstatechange = () => {
            midiState.outputs = Array.from(access.outputs.values());
            applyMidiSelections();
          };
        }
        applyMidiSelections();
        return midiState.outputs;
      }).catch((error) => {
        console.warn("[mediamime] MIDI access unavailable", error);
        midiState.supported = false;
        return [];
      });
    }
    return midiState.pending;
  };

  const refreshMidiPorts = () => ensureMidiAccess().then(() => applyMidiSelections());

  const sendMidiMessage = (status, data1, data2, portId = editorConfig.midiPort) => {
    if (!midiState.ready) {
      ensureMidiAccess();
    }
    const outputs = getMidiOutputs();
    if (!outputs.length) {
      if (midiState.ready) {
        console.info('[MIDI]', { status, data1, data2, port: portId });
      }
      return;
    }
    const targets = portId && portId !== 'broadcast'
      ? outputs.filter((output) => output.id === portId)
      : outputs;
    if (!targets.length) {
      console.info('[MIDI no matching port]', { port: portId, status, data1, data2 });
      return;
    }
    targets.forEach((output) => {
      try {
        output.send([status, data1, data2]);
      } catch (error) {
        console.warn('[mediamime] MIDI send failed', error);
      }
    });
  };

  const sendMidiNote = (channel, note, velocity, type = 'on', portId = editorConfig.midiPort) => {
    const normalizedChannel = clampRange(Math.floor(channel) || 1, 1, 16);
    const normalizedNote = clampRange(Math.floor(note) || 0, 0, 127);
    const normalizedVelocity = clampRange(Math.floor(velocity) || 0, 0, 127);
    const status = (type === 'off' ? 0x80 : 0x90) | ((normalizedChannel - 1) & 0x0f);
    sendMidiMessage(status, normalizedNote, normalizedVelocity, portId);
  };

  const sendMidiCc = (channel, cc, value, portId = editorConfig.midiPort) => {
    const normalizedChannel = clampRange(Math.floor(channel) || 1, 1, 16);
    const normalizedCc = clampRange(Math.floor(cc) || 0, 0, 127);
    const normalizedValue = clampRange(Math.floor(value) || 0, 0, 127);
    const status = 0xb0 | ((normalizedChannel - 1) & 0x0f);
    sendMidiMessage(status, normalizedCc, normalizedValue, portId);
  };

  const listeners = [];
  const addListener = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };

  const state = {
    activeShapeId: null,
    draftName: "",
    draftInteraction: null,
    isSyncing: false,
    modalOpen: false
  };

  const getShapeSnapshot = (shapeId) => {
    if (!shapeId || typeof editor.getShapeSnapshot !== "function") return null;
    return editor.getShapeSnapshot(shapeId);
  };

  const ensureDraftFromShape = (shape) => {
    if (!shape) {
      state.draftInteraction = null;
      state.draftName = "";
      return;
    }
    const index = shapeOrder.indexOf(shape.id);
    const fallbackName = getShapeDisplayName(shape, index >= 0 ? index : 0);
    const rawName = typeof shape.name === "string" ? shape.name.trim() : "";
    state.draftName = rawName || fallbackName;
    state.draftInteraction = { ...mergeInteraction(shape.interaction), name: state.draftName };
  };

  const updateOpenButtonState = () => {
    if (openButton) {
      const hasShape = state.activeShapeId && shapesById.has(state.activeShapeId);
      openButton.disabled = !hasShape;
    }
  };

  const setDetailVisibility = (hasShape) => {
    if (editorDetailEmpty) {
      editorDetailEmpty.style.display = hasShape ? "none" : "";
    }
    if (editorDetailForm) {
      editorDetailForm.style.display = hasShape ? "" : "none";
    }
  };

  const getShapeDisplayName = (shape, index = 0) => {
    if (!shape) return `Shape ${index + 1}`;
    const raw = typeof shape.name === "string" ? shape.name.trim() : "";
    if (raw) return raw;
    const typeLabel = shape.type ? shape.type.charAt(0).toUpperCase() + shape.type.slice(1) : "Shape";
    return `${typeLabel} ${index + 1}`;
  };

  const buildShapeMeta = (shape) => {
    if (!shape) return "No events";
    const interaction = mergeInteraction(shape.interaction);
    const streamLabel = STREAM_DEFINITIONS[interaction.stream]?.label || "Stream";
    const events = interaction.events.filter((event) => event.type && event.type !== "none");
    const primary = events[0] || null;
    let eventLabel = "No events";
    if (primary) {
      eventLabel = primary.type === "midiCc" ? "MIDI CC" : primary.type === "midiNote" ? "MIDI Note" : "Event";
    }
    const extraSuffix = events.length > 1 ? ` (+${events.length - 1})` : "";
    const triggerLabel = primary?.trigger
      ? primary.trigger.replace(/^\w/, (char) => char.toUpperCase())
      : null;
    const parts = [streamLabel, `${eventLabel}${extraSuffix}`];
    if (triggerLabel) {
      parts.push(triggerLabel);
    }
    return parts.join(" · ");
  };

  const renderShapeList = () => {
    if (!editorShapeList) return;
    if (!shapeOrder.length) {
      editorShapeList.innerHTML = `<div class="editor-detail-empty">No shapes yet. Draw on the canvas to add one.</div>`;
      editorShapeList.removeAttribute("aria-activedescendant");
      return;
    }
    const markup = shapeOrder
      .map((id, index) => {
        const shape = shapesById.get(id);
        if (!shape) return "";
        const label = getShapeDisplayName(shape, index);
        const meta = buildShapeMeta(shape);
        const isActive = id === state.activeShapeId;
        const runtime = runtimeState.get(id);
        const isRunning = Boolean(runtime?.inside || runtime?.hoverInside);
        const activeAttr = isRunning ? ` data-active="true"` : "";
        return `<button type="button" id="editor-shape-${id}" class="editor-shape-item${isActive ? " is-active" : ""}" data-shape-id="${id}"${activeAttr} role="option" aria-selected="${isActive ? "true" : "false"}">
            <span class="shape-label">${escapeHtml(label)}</span>
            <span class="shape-meta">${escapeHtml(meta)}</span>
          </button>`;
      })
      .filter(Boolean)
      .join("");
    editorShapeList.innerHTML = markup;
    if (state.activeShapeId && shapesById.has(state.activeShapeId)) {
      editorShapeList.setAttribute("aria-activedescendant", `editor-shape-${state.activeShapeId}`);
    } else {
      editorShapeList.removeAttribute("aria-activedescendant");
    }
    updateShapeActiveIndicators();
  };

  const syncEditorDetailForm = () => {
    if (!editorDetailForm || !editorDetailEmpty) return;
    const shape = state.activeShapeId ? shapesById.get(state.activeShapeId) : null;
    const hasShape = Boolean(shape);
    setDetailVisibility(hasShape);
    if (!hasShape) {
      if (editorStreamSelect) {
        editorStreamSelect.disabled = true;
      }
      if (editorLandmarkSelect) {
        editorLandmarkSelect.disabled = true;
        editorLandmarkSelect.innerHTML = "";
      }
      if (editorEventList) {
        editorEventList.innerHTML = `<div class="event-empty">Select a shape to configure events.</div>`;
      }
      if (editorAddEventButton) {
        editorAddEventButton.disabled = true;
      }
      if (editorDeleteShapeButton) {
        editorDeleteShapeButton.disabled = true;
      }
      return;
    }
    const interaction = mergeInteraction(shape.interaction);
    isSyncingEditorForm = true;
    if (editorStreamSelect) {
      editorStreamSelect.disabled = false;
      editorStreamSelect.value = interaction.stream;
    }
    const resolvedLandmark = populateLandmarkOptions(interaction.stream, interaction.landmark, editorLandmarkSelect);
    if (editorLandmarkSelect) {
      editorLandmarkSelect.disabled = false;
      editorLandmarkSelect.value = resolvedLandmark;
    }
    if (editorAddEventButton) {
      editorAddEventButton.disabled = false;
    }
    if (editorDeleteShapeButton) {
      editorDeleteShapeButton.disabled = false;
    }
    renderEventList(editorEventList, interaction.events);
    isSyncingEditorForm = false;
  };

  const updateSelectedInteraction = (mutator) => {
    if (!state.activeShapeId || typeof editor.updateShape !== "function") return;
    editor.updateShape(state.activeShapeId, (shape) => {
      const interaction = mergeInteraction(shape.interaction);
      mutator(interaction, shape);
      shape.interaction = interaction;
      return shape;
    });
    evaluateShapeInteractions();
  };

  const commitDraftInteraction = () => {
    if (!state.draftInteraction) return;
    const draft = { ...mergeInteraction(state.draftInteraction), name: state.draftName };
    state.draftInteraction = draft;
    updateSelectedInteraction((interaction, shape) => {
      interaction.stream = draft.stream;
      interaction.landmark = draft.landmark;
      interaction.events = draft.events.map(normalizeEvent);
      if (typeof draft.name === "string") {
        const trimmed = draft.name.trim();
        if (trimmed) {
          interaction.name = trimmed;
          if (shape) shape.name = trimmed;
        } else {
          delete interaction.name;
        }
      }
    });
  };

  const syncModal = () => {
    if (!state.modalOpen || state.isSyncing) return;
    const draft = state.draftInteraction ? mergeInteraction(state.draftInteraction) : createDefaultInteraction();
    state.isSyncing = true;
    if (shapeNameInput) {
      shapeNameInput.value = state.draftName;
    }
    if (streamSelect) {
      streamSelect.value = draft.stream;
    }
    const landmark = populateLandmarkOptions(draft.stream, draft.landmark, landmarkSelect);
    if (landmarkSelect) {
      landmarkSelect.value = landmark;
    }
    renderEventList(eventList, draft.events);
    state.isSyncing = false;
    applyMidiSelections();
  };

  const closeModal = () => {
    if (!state.modalOpen) return;
    state.modalOpen = false;
    state.draftInteraction = null;
    if (backdrop) {
      backdrop.classList.remove("is-visible");
      backdrop.setAttribute("aria-hidden", "true");
    }
    modal.classList.remove("is-visible");
    modal.classList.remove("is-dragging");
    modal.setAttribute("aria-hidden", "true");
    if (dragContext && modal.hasPointerCapture(dragContext.pointerId)) {
      modal.releasePointerCapture(dragContext.pointerId);
    }
    dragContext = null;
  };

  const openModalForShape = (shapeId, { focus = true } = {}) => {
    const targetId = shapeId || state.activeShapeId;
    if (!targetId) return;
    const shape = getShapeSnapshot(targetId);
    if (!shape) return;
    state.activeShapeId = shape.id;
    ensureDraftFromShape(shape);
    state.modalOpen = true;
    if (backdrop) {
      backdrop.classList.add("is-visible");
      backdrop.setAttribute("aria-hidden", "false");
    }
    modal.classList.add("is-visible");
    modal.setAttribute("aria-hidden", "false");
    applyAssignmentLayout();
    syncModal();
    if (focus && shapeNameInput) {
      setTimeout(() => {
        try {
          shapeNameInput.focus({ preventScroll: true });
        } catch (error) {
          shapeNameInput.focus();
        }
        if (typeof shapeNameInput.select === "function") {
          shapeNameInput.select();
        }
      }, 20);
    }
  };

  const applyModal = () => {
    if (!state.modalOpen || !state.activeShapeId || !state.draftInteraction) {
      closeModal();
      return;
    }
    const draft = mergeInteraction(state.draftInteraction);
    const nameValue = shapeNameInput ? shapeNameInput.value : state.draftName;
    const nextName = typeof nameValue === "string" ? nameValue.trim() : "";
    draft.stream = streamSelect?.value || draft.stream;
    draft.landmark = landmarkSelect?.value || draft.landmark;
    if (typeof editor.updateShape === "function") {
      editor.updateShape(state.activeShapeId, (shape) => {
        shape.name = nextName;
        shape.interaction = draft;
        return shape;
      });
    } else {
      console.warn("[mediamime] editor.updateShape is not available; interaction changes were not applied.");
    }
    if (!isSyncingConfig && assignmentMidiPortSelect) {
      setMidiPort(assignmentMidiPortSelect.value);
    }
    state.draftName = nextName;
    state.draftInteraction = draft;
    closeModal();
    evaluateShapeInteractions();
  };

  const handleSelectionChange = (payload) => {
    const selection = Array.isArray(payload?.selection) ? payload.selection : [];
    const nextId = selection[0] || null;
    state.activeShapeId = nextId;
    updateOpenButtonState();
    renderShapeList();
    syncEditorDetailForm();
    if (state.modalOpen) {
      if (!nextId) {
        closeModal();
      } else {
        const shape = getShapeSnapshot(nextId);
        if (shape) {
          ensureDraftFromShape(shape);
          syncModal();
        } else {
          closeModal();
        }
      }
    }
    evaluateShapeInteractions();
  };

  const handleShapeAltClick = ({ shapeId }) => {
    if (!shapeId) return;
    state.activeShapeId = shapeId;
    const shape = getShapeSnapshot(shapeId);
    ensureDraftFromShape(shape);
    updateOpenButtonState();
    renderShapeList();
    syncEditorDetailForm();
    openModalForShape(shapeId);
    evaluateShapeInteractions();
  };

  const handleShapesChange = (shapes) => {
    if (!Array.isArray(shapes)) return;
    const previousIds = new Set(shapeOrder);
    shapesById.clear();
    shapeOrder.length = 0;
    shapes.forEach((shape) => {
      if (!shape || !shape.id) return;
      shapeOrder.push(shape.id);
      shapesById.set(shape.id, shape);
      previousIds.delete(shape.id);
    });
    previousIds.forEach((removedId) => {
      clearRuntimeState(removedId);
      applyShapeHighlight(removedId);
    });
    if (state.activeShapeId && !shapesById.has(state.activeShapeId)) {
      state.activeShapeId = shapeOrder[0] || null;
    }
    renderShapeList();
    updateOpenButtonState();
    syncEditorDetailForm();
    if (state.modalOpen) {
      if (!state.activeShapeId || !shapesById.has(state.activeShapeId)) {
        closeModal();
      } else {
        const shape = shapesById.get(state.activeShapeId);
        ensureDraftFromShape(shape);
        syncModal();
      }
    }
    updateShapeActiveIndicators();
    evaluateShapeInteractions();
  };

  const handleDoubleClick = (event) => {
    if (!svg) return;
    const shapeTarget = event.target?.closest?.("[data-shape-id]");
    if (!shapeTarget) return;
    const shapeId = shapeTarget.getAttribute("data-shape-id");
    if (!shapeId) return;
    state.activeShapeId = shapeId;
    updateOpenButtonState();
    openModalForShape(shapeId);
    evaluateShapeInteractions();
  };

  const handleAssignmentAddEvent = () => {
    if (!state.draftInteraction) {
      state.draftInteraction = { ...createDefaultInteraction(), name: state.draftName };
    }
    state.draftInteraction.events = [...state.draftInteraction.events, createDefaultEvent("midiNote")];
    state.draftInteraction = { ...mergeInteraction(state.draftInteraction), name: state.draftName };
    commitDraftInteraction();
    syncModal();
  };

  const handleAssignmentRemoveEvent = (eventId) => {
    if (!state.draftInteraction) return;
    state.draftInteraction.events = state.draftInteraction.events.filter((event) => event.id !== eventId);
    if (!state.draftInteraction.events.length) {
      state.draftInteraction.events = [createDefaultEvent("midiNote")];
    }
    state.draftInteraction = { ...mergeInteraction(state.draftInteraction), name: state.draftName };
    commitDraftInteraction();
    syncModal();
  };

  const handleAssignmentEventFieldChange = (eventId, field, value) => {
    if (!state.draftInteraction) return;
    const index = state.draftInteraction.events.findIndex((event) => event.id === eventId);
    if (index === -1) return;
    const current = normalizeEvent(state.draftInteraction.events[index]);
    let next = { ...current };
    switch (field) {
      case "type": {
        const nextType = EVENT_TYPE_OPTIONS.some((option) => option.id === value) ? value : "none";
        const replacement = createDefaultEvent(nextType);
        replacement.id = current.id;
        replacement.trigger = current.trigger;
        next = normalizeEvent(replacement);
        break;
      }
      case "trigger":
        next.trigger = value;
        break;
      case "channel":
        next.channel = clampRange(Number.parseInt(`${value}`, 10) || current.channel, 1, 16);
        break;
      case "note":
        next.note = clampRange(Number.parseInt(`${value}`, 10) || current.note, 0, 127);
        break;
      case "velocityMode":
        next.velocityMode = VALUE_SOURCE_OPTIONS.some((option) => option.id === value) ? value : current.velocityMode;
        break;
      case "velocityValue":
        next.velocityValue = clampRange(Number.parseInt(`${value}`, 10) || current.velocityValue, 0, 127);
        break;
      case "cc":
        next.cc = clampRange(Number.parseInt(`${value}`, 10) || current.cc, 0, 127);
        break;
      case "ccValueMode":
        next.ccValueMode = VALUE_SOURCE_OPTIONS.some((option) => option.id === value) ? value : current.ccValueMode;
        break;
      case "ccValue":
        next.ccValue = clampRange(Number.parseInt(`${value}`, 10) || current.ccValue, 0, 127);
        break;
      default:
        break;
    }
    state.draftInteraction.events[index] = normalizeEvent(next);
    state.draftInteraction = { ...mergeInteraction(state.draftInteraction), name: state.draftName };
    commitDraftInteraction();
    syncModal();
  };

  const handleAssignmentEventListClick = (event) => {
    const action = event.target?.closest?.("[data-action]");
    if (!action) return;
    const card = action.closest(".event-card");
    if (!card) return;
    const eventId = card.dataset.eventId;
    if (!eventId) return;
    event.preventDefault();
    if (action.dataset.action === "remove-event") {
      handleAssignmentRemoveEvent(eventId);
    }
  };

  const handleAssignmentEventListInput = (event) => {
    if (state.isSyncing) return;
    const control = event.target;
    if (!control || !control.dataset.field) return;
    const card = control.closest(".event-card");
    if (!card) return;
    const eventId = card.dataset.eventId;
    if (!eventId) return;
    handleAssignmentEventFieldChange(eventId, control.dataset.field, control.value);
  };

  const handleAssignmentShapeNameInput = (event) => {
    if (state.isSyncing) return;
    const value = event.target?.value ?? "";
    state.draftName = value;
    if (state.draftInteraction) {
      state.draftInteraction.name = value.trim();
    }
    updateSelectedInteraction((interaction, shape) => {
      const trimmed = value.trim();
      interaction.name = trimmed;
      if (shape) {
        shape.name = trimmed;
      }
    });
  };

  const normalizeAssignmentName = () => {
    const normalized = (shapeNameInput?.value ?? "").trim();
    if (shapeNameInput) {
      shapeNameInput.value = normalized;
    }
    state.draftName = normalized;
    if (state.draftInteraction) {
      state.draftInteraction.name = normalized;
    }
    updateSelectedInteraction((interaction, shape) => {
      interaction.name = normalized;
      if (shape) {
        shape.name = normalized;
      }
    });
  };

  const handleAssignmentStreamChange = () => {
    if (state.isSyncing) return;
    const streamId = streamSelect?.value || "pose";
    if (!state.draftInteraction) {
      state.draftInteraction = { ...mergeInteraction({ stream: streamId }), name: state.draftName };
    } else {
      const merged = mergeInteraction({ ...state.draftInteraction, stream: streamId });
      state.draftInteraction.stream = merged.stream;
      state.draftInteraction.landmark = merged.landmark;
      state.draftInteraction.events = merged.events;
    }
    state.draftInteraction = { ...mergeInteraction(state.draftInteraction), name: state.draftName };
    commitDraftInteraction();
    syncModal();
  };

  const handleAssignmentLandmarkChange = () => {
    if (state.isSyncing || !state.draftInteraction) return;
    const landmark = landmarkSelect?.value || "";
    state.draftInteraction.landmark = landmark;
    commitDraftInteraction();
  };

  const handleEditorStreamChange = () => {
    if (isSyncingEditorForm || !state.activeShapeId) return;
    const streamId = editorStreamSelect?.value || "pose";
    isSyncingEditorForm = true;
    updateSelectedInteraction((interaction) => {
      interaction.stream = streamId;
      const resolved = populateLandmarkOptions(streamId, interaction.landmark, editorLandmarkSelect);
      interaction.landmark = resolved;
    });
    isSyncingEditorForm = false;
  };

  const handleEditorLandmarkChange = () => {
    if (isSyncingEditorForm || !state.activeShapeId) return;
    const landmark = editorLandmarkSelect?.value || "";
    updateSelectedInteraction((interaction) => {
      interaction.landmark = landmark;
    });
  };

  const handleEditorAddEvent = () => {
    if (!state.activeShapeId) return;
    updateSelectedInteraction((interaction) => {
      interaction.events = [...interaction.events, createDefaultEvent("midiNote")];
    });
  };

  const handleEditorRemoveEvent = (eventId) => {
    if (!state.activeShapeId) return;
    updateSelectedInteraction((interaction) => {
      interaction.events = interaction.events.filter((event) => event.id !== eventId);
      if (!interaction.events.length) {
        interaction.events = [createDefaultEvent("midiNote")];
      }
    });
  };

  const handleEditorEventFieldChange = (eventId, field, value) => {
    if (!state.activeShapeId) return;
    updateSelectedInteraction((interaction) => {
      const index = interaction.events.findIndex((event) => event.id === eventId);
      if (index === -1) return;
      const current = normalizeEvent(interaction.events[index]);
      let next = { ...current };
      switch (field) {
        case "type": {
          const nextType = EVENT_TYPE_OPTIONS.some((option) => option.id === value) ? value : "none";
          const replacement = createDefaultEvent(nextType);
          replacement.id = current.id;
          replacement.trigger = current.trigger;
          next = normalizeEvent(replacement);
          break;
        }
        case "trigger":
          next.trigger = value;
          break;
        case "channel":
          next.channel = clampRange(Number.parseInt(`${value}`, 10) || current.channel, 1, 16);
          break;
        case "note":
          next.note = clampRange(Number.parseInt(`${value}`, 10) || current.note, 0, 127);
          break;
        case "velocityMode":
          next.velocityMode = VALUE_SOURCE_OPTIONS.some((option) => option.id === value) ? value : current.velocityMode;
          break;
        case "velocityValue":
          next.velocityValue = clampRange(Number.parseInt(`${value}`, 10) || current.velocityValue, 0, 127);
          break;
        case "cc":
          next.cc = clampRange(Number.parseInt(`${value}`, 10) || current.cc, 0, 127);
          break;
        case "ccValueMode":
          next.ccValueMode = VALUE_SOURCE_OPTIONS.some((option) => option.id === value) ? value : current.ccValueMode;
          break;
        case "ccValue":
          next.ccValue = clampRange(Number.parseInt(`${value}`, 10) || current.ccValue, 0, 127);
          break;
        default:
          break;
      }
      interaction.events[index] = normalizeEvent(next);
    });
  };

  const handleEditorEventListClick = (event) => {
    const action = event.target?.closest?.("[data-action]");
    if (!action) return;
    const card = action.closest(".event-card");
    if (!card) return;
    const eventId = card.dataset.eventId;
    if (!eventId) return;
    event.preventDefault();
    if (action.dataset.action === "remove-event") {
      handleEditorRemoveEvent(eventId);
    }
  };

  const handleEditorEventListInput = (event) => {
    if (isSyncingEditorForm) return;
    const control = event.target;
    if (!control || !control.dataset.field) return;
    const card = control.closest(".event-card");
    if (!card) return;
    const eventId = card.dataset.eventId;
    if (!eventId) return;
    handleEditorEventFieldChange(eventId, control.dataset.field, control.value);
  };

  const resolveStreamPoint = (streamId, landmarkKey, holisticResults) => {
    // Placeholder for future landmark integration
    void streamId;
    void landmarkKey;
    void holisticResults;
    return null;
  };

  const evaluateShapeInteractions = () => {
    if (!shapeOrder.length) {
      runtimeState.clear();
      updateShapeActiveIndicators();
      return;
    }
    const now = getNow();
    const pointerState = inputState.pointer;
    const pointerPoint = pointerState.normalized;
    const pointerIsDown = pointerState.isDown;
    const holisticResults = inputState.holistic;
    const pointCache = new Map();

    shapeOrder.forEach((shapeId) => {
      const shape = shapesById.get(shapeId);
      if (!shape) {
        clearRuntimeState(shapeId);
        applyShapeHighlight(shapeId);
        return;
      }
      shape.interaction = mergeInteraction(shape.interaction);
      const interaction = shape.interaction;
      const events = interaction.events.filter((event) => event && event.type && event.type !== 'none');
      const runtime = ensureRuntimeShape(shapeId);
      runtime.eventState = runtime.eventState instanceof Map ? runtime.eventState : new Map();
      const previousInside = runtime.inside;
      const previousHover = runtime.hoverInside;
      const previousActive = runtime.active || false;
      let inside = false;
      let hoverInside = false;
      let metrics = runtime.lastMetrics || { ...DEFAULT_METRICS };
      let shapeActive = false;

      const streamId = interaction.stream || 'pose';
      const landmarkKey = interaction.landmark || 'position';

      if (streamId === 'pointer') {
        const insideShape = pointerPoint ? shapeContainsPoint(shape, pointerPoint) : false;
        hoverInside = insideShape;
        if (insideShape && pointerPoint) {
          metrics = computeShapeMetrics(shape, pointerPoint);
        }
        inside = landmarkKey === 'button' ? (insideShape && pointerIsDown) : insideShape;
      } else if (streamId === 'keyboard') {
        const keyState = inputState.keyboard.keys.get(landmarkKey || 'Space');
        inside = Boolean(keyState?.isDown);
        hoverInside = inside;
      } else {
        const cacheKey = `${streamId}:${landmarkKey}`;
        if (!pointCache.has(cacheKey)) {
          const resolved = resolveStreamPoint(streamId, landmarkKey, holisticResults);
          pointCache.set(cacheKey, resolved);
        }
        const targetPoint = pointCache.get(cacheKey);
        const insideShape = targetPoint ? shapeContainsPoint(shape, targetPoint) : false;
        hoverInside = insideShape;
        inside = insideShape;
        if (insideShape && targetPoint) {
          metrics = computeShapeMetrics(shape, targetPoint);
        }
      }

      const justEntered = inside && !previousInside;
      const justExited = !inside && previousInside;

      const nowEventStates = runtime.eventState;

      events.forEach((event) => {
        const normalizedEvent = normalizeEvent(event);
        let eventState = nowEventStates.get(normalizedEvent.id);
        if (!eventState) {
          eventState = { noteOn: false, lastContinuousAt: 0, lastTriggerAt: 0, meta: null };
          nowEventStates.set(normalizedEvent.id, eventState);
        }
        const trigger = normalizedEvent.trigger || 'enter';
        switch (normalizedEvent.type) {
          case 'midiNote': {
            const channel = normalizedEvent.channel ?? 1;
            const note = normalizedEvent.note ?? 60;
            const velocity = resolveValueFromMode(normalizedEvent.velocityMode, metrics, normalizedEvent.velocityValue ?? 96, { midi: true });
            eventState.meta = { type: 'midiNote', channel, note };
            const sendOn = () => sendMidiNote(channel, note, velocity, 'on', editorConfig.midiPort);
            const sendOff = () => sendMidiNote(channel, note, 0, 'off', editorConfig.midiPort);
            if (trigger === 'enterExit') {
              if (justEntered) {
                sendOn();
                eventState.noteOn = true;
                eventState.lastTriggerAt = now;
                shapeActive = true;
              }
              if (justExited && eventState.noteOn) {
                sendOff();
                eventState.noteOn = false;
              }
              break;
            }
            if (trigger === 'enter' && justEntered) {
              sendOn();
              eventState.noteOn = true;
              eventState.lastTriggerAt = now;
              shapeActive = true;
              break;
            }
            if (trigger === 'exit' && justExited) {
              sendOff();
              eventState.noteOn = false;
              break;
            }
            if (trigger === 'inside' && inside) {
              if (now - (eventState.lastContinuousAt || 0) >= CONTINUOUS_TRIGGER_INTERVAL_MS) {
                eventState.lastContinuousAt = now;
                sendOn();
                eventState.noteOn = true;
                eventState.lastTriggerAt = now;
                shapeActive = true;
              }
            }
            if (justExited && eventState.noteOn) {
              sendOff();
              eventState.noteOn = false;
            }
            if (eventState.noteOn) {
              shapeActive = true;
            }
            break;
          }
          case 'midiCc': {
            const channel = normalizedEvent.channel ?? 1;
            const ccNumber = normalizedEvent.cc ?? 1;
            const value = resolveValueFromMode(normalizedEvent.ccValueMode, metrics, normalizedEvent.ccValue ?? 100, { midi: true });
            const sendValue = (val) => sendMidiCc(channel, ccNumber, val, editorConfig.midiPort);
            eventState.meta = { type: 'midiCc', channel, cc: ccNumber };
            if (trigger === 'enterExit') {
              if (justEntered) {
                sendValue(value);
                eventState.lastTriggerAt = now;
                shapeActive = true;
              }
              if (justExited) {
                sendValue(0);
                eventState.lastTriggerAt = now;
                shapeActive = true;
              }
              break;
            }
            if (trigger === 'enter' && justEntered) {
              sendValue(value);
              eventState.lastTriggerAt = now;
              shapeActive = true;
              break;
            }
            if (trigger === 'exit' && justExited) {
              sendValue(0);
              eventState.lastTriggerAt = now;
              shapeActive = true;
              break;
            }
            if (trigger === 'inside' && inside) {
              if (now - (eventState.lastContinuousAt || 0) >= CONTINUOUS_TRIGGER_INTERVAL_MS) {
                eventState.lastContinuousAt = now;
                sendValue(value);
                eventState.lastTriggerAt = now;
                shapeActive = true;
              }
            }
            break;
          }
          default:
            break;
        }
      });

      nowEventStates.forEach((eventState, eventId) => {
        const stillPresent = events.some((event) => event?.id === eventId);
        if (!stillPresent) {
          if (eventState.meta?.type === 'midiNote' && eventState.noteOn) {
            const meta = eventState.meta;
            sendMidiNote(meta.channel ?? 1, meta.note ?? 60, 0, 'off', editorConfig.midiPort);
          }
          if (eventState.meta?.type === 'midiCc') {
            const meta = eventState.meta;
            sendMidiCc(meta.channel ?? 1, meta.cc ?? 1, 0, editorConfig.midiPort);
          }
          nowEventStates.delete(eventId);
          return;
        }
        if (eventState.meta?.type === 'midiNote' && eventState.noteOn) {
          shapeActive = true;
        }
        if (eventState.lastTriggerAt && now - eventState.lastTriggerAt < 180) {
          shapeActive = true;
        }
      });

      if (!inside) {
        nowEventStates.forEach((eventState) => {
          eventState.lastContinuousAt = 0;
          if (eventState.noteOn) {
            // Ensure lingering notes are released
            eventState.noteOn = false;
          }
        });
      }

      runtime.inside = inside;
      runtime.hoverInside = hoverInside;
      runtime.lastMetrics = metrics;
      runtime.active = shapeActive;

      if (previousActive !== runtime.active) {
        applyShapeHighlight(shapeId);
      }
    });

    updateShapeActiveIndicators();
  };

  const getPointerNormalized = (event) => {
    if (!event || typeof editor.normalizePoint !== 'function') return null;
    const point = editor.normalizePoint(event, { clamp: false });
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return null;
    }
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      return null;
    }
    return { x: clampUnit(point.x), y: clampUnit(point.y) };
  };

  const applyPointerState = (updates = {}) => {
    const target = inputState.pointer;
    let changed = false;
    if (Object.prototype.hasOwnProperty.call(updates, 'normalized')) {
      const nextPoint = updates.normalized;
      const prevPoint = target.normalized;
      const bothNull = !prevPoint && !nextPoint;
      let samePoint = false;
      if (prevPoint && nextPoint) {
        samePoint = Math.abs(prevPoint.x - nextPoint.x) < 1e-4 && Math.abs(prevPoint.y - nextPoint.y) < 1e-4;
      }
      if (!bothNull && !samePoint) {
        changed = true;
      }
      target.normalized = nextPoint || null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'isDown')) {
      if (Boolean(updates.isDown) !== target.isDown) {
        changed = true;
      }
      target.isDown = Boolean(updates.isDown);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'pointerId')) {
      if (updates.pointerId !== target.pointerId) {
        changed = true;
      }
      target.pointerId = updates.pointerId;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'isOverCanvas')) {
      if (Boolean(updates.isOverCanvas) !== target.isOverCanvas) {
        changed = true;
      }
      target.isOverCanvas = Boolean(updates.isOverCanvas);
    }
    target.lastUpdate = getNow();
    return changed;
  };

  const handleInputPointerMove = (event) => {
    const normalized = getPointerNormalized(event);
    if (applyPointerState({ normalized, isOverCanvas: Boolean(normalized) })) {
      evaluateShapeInteractions();
    }
  };

  const handleInputPointerDown = (event) => {
    const normalized = getPointerNormalized(event);
    const isPrimaryButton = event.button === 0 || event.button === -1;
    const updates = {
      normalized,
      isOverCanvas: Boolean(normalized)
    };
    if (isPrimaryButton && normalized) {
      updates.pointerId = event.pointerId;
      updates.isDown = true;
    } else if (isPrimaryButton) {
      updates.pointerId = null;
      updates.isDown = false;
    }
    if (applyPointerState(updates)) {
      evaluateShapeInteractions();
    }
  };

  const handleInputPointerUp = (event) => {
    const normalized = getPointerNormalized(event);
    const isPrimaryButton = event.button === 0 || event.button === -1;
    const shouldRelease = isPrimaryButton && (inputState.pointer.pointerId === event.pointerId || inputState.pointer.pointerId === null);
    const updates = {
      normalized,
      isOverCanvas: Boolean(normalized)
    };
    if (shouldRelease) {
      updates.pointerId = null;
      updates.isDown = false;
    }
    if (applyPointerState(updates)) {
      evaluateShapeInteractions();
    }
  };

  const handleInputPointerCancel = (event) => {
    if (inputState.pointer.pointerId !== null && event.pointerId !== inputState.pointer.pointerId) {
      return;
    }
    if (applyPointerState({
      normalized: null,
      isOverCanvas: false,
      isDown: false,
      pointerId: null
    })) {
      evaluateShapeInteractions();
    }
  };

  const shouldCaptureKeyboardInput = (event) => {
    if (!event) return false;
    const code = event.code;
    if (!code || !KEYBOARD_REFERENCE_KEYS.some((entry) => entry.key === code)) {
      return false;
    }
    const target = event.target;
    if (!target) return true;
    const tag = target.tagName?.toLowerCase?.() || '';
    if (["input", "textarea", "select"].includes(tag)) {
      return false;
    }
    if (target.isContentEditable) {
      return false;
    }
    return true;
  };

  const updateKeyboardState = (code, isDown) => {
    const keys = inputState.keyboard.keys;
    const existing = keys.get(code) || { isDown: false, lastDownAt: 0, lastUpAt: 0 };
    const nextState = {
      isDown: Boolean(isDown),
      lastDownAt: existing.lastDownAt,
      lastUpAt: existing.lastUpAt
    };
    const timestamp = getNow();
    if (isDown) {
      nextState.lastDownAt = timestamp;
    } else {
      nextState.lastUpAt = timestamp;
    }
    const changed = existing.isDown !== nextState.isDown;
    keys.set(code, nextState);
    return changed;
  };

  const handleInputKeyDown = (event) => {
    if (!shouldCaptureKeyboardInput(event)) return;
    const changed = updateKeyboardState(event.code, true);
    if (changed || event.repeat) {
      evaluateShapeInteractions();
    }
  };

  const handleInputKeyUp = (event) => {
    if (!shouldCaptureKeyboardInput(event)) return;
    if (updateKeyboardState(event.code, false)) {
      evaluateShapeInteractions();
    }
  };

  const handleAssignmentMidiPortChange = () => {
    if (isSyncingConfig || !assignmentMidiPortSelect) return;
    setMidiPort(assignmentMidiPortSelect.value);
  };

  const handleEditorMidiPortChange = () => {
    if (isSyncingConfig || !editorMidiPortSelect) return;
    setMidiPort(editorMidiPortSelect.value);
  };

  const handleDeleteShape = () => {
    if (!state.activeShapeId || typeof editor.deleteShape !== "function") return;
    editor.deleteShape(state.activeShapeId);
  };

  const handleShapeListClick = (event) => {
    const button = event.target?.closest?.("[data-shape-id]");
    if (!button) return;
    const shapeId = button.dataset.shapeId;
    if (!shapeId) return;
    if (typeof editor.selectShape === "function") {
      editor.selectShape(shapeId);
    }
  };

  const startModalDrag = (event) => {
    if (!modal || event.button === 1 || event.button === 2) return;
    event.preventDefault();
    const rect = modal.getBoundingClientRect();
    dragContext = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    modal.style.transform = "none";
    modal.style.right = "auto";
    modal.style.bottom = "auto";
    modal.style.left = `${rect.left}px`;
    modal.style.top = `${rect.top}px`;
    modal.classList.add("is-dragging");
    modal.setPointerCapture(event.pointerId);
  };

  const updateModalDrag = (event) => {
    if (!dragContext || event.pointerId !== dragContext.pointerId) return;
    const width = modal.offsetWidth;
    const height = modal.offsetHeight;
    const maxLeft = Math.max(12, window.innerWidth - width - 12);
    const maxTop = Math.max(12, window.innerHeight - height - 12);
    const nextLeft = clampRange(event.clientX - dragContext.offsetX, 12, maxLeft);
    const nextTop = clampRange(event.clientY - dragContext.offsetY, 12, maxTop);
    modal.style.left = `${nextLeft}px`;
    modal.style.top = `${nextTop}px`;
  };

  const endModalDrag = (event) => {
    if (!dragContext || event.pointerId !== dragContext.pointerId) return;
    if (modal.hasPointerCapture(event.pointerId)) {
      modal.releasePointerCapture(event.pointerId);
    }
    const left = Number.parseFloat(modal.style.left);
    const top = Number.parseFloat(modal.style.top);
    if (Number.isFinite(left) && Number.isFinite(top)) {
      saveAssignmentLayout({ left, top });
    }
    dragContext = null;
    modal.classList.remove("is-dragging");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && state.modalOpen) {
      event.preventDefault();
      closeModal();
    }
  };

  addListener(openButton, "click", () => openModalForShape(state.activeShapeId));
  addListener(addEventButton, "click", handleAssignmentAddEvent);
  addListener(eventList, "click", handleAssignmentEventListClick);
  addListener(eventList, "change", handleAssignmentEventListInput);
  addListener(eventList, "input", handleAssignmentEventListInput);
  addListener(shapeNameInput, "input", handleAssignmentShapeNameInput);
  addListener(shapeNameInput, "change", normalizeAssignmentName);
  addListener(streamSelect, "change", handleAssignmentStreamChange);
  addListener(landmarkSelect, "change", handleAssignmentLandmarkChange);
  addListener(assignmentMidiPortSelect, "change", handleAssignmentMidiPortChange);
  addListener(assignmentMidiPortRefreshButton, "click", refreshMidiPorts);
  if (assignmentHandle) {
    addListener(assignmentHandle, "pointerdown", startModalDrag);
  }
  addListener(modal, "pointermove", updateModalDrag);
  addListener(modal, "pointerup", endModalDrag);
  addListener(modal, "pointercancel", endModalDrag);

  addListener(closeButton, "click", closeModal);
  addListener(shapeNameInput, "blur", normalizeAssignmentName);
  addListener(backdrop, "click", closeModal);
  addListener(modal, "keydown", handleKeyDown);
  addListener(document, "keydown", handleKeyDown, true);
  addListener(svg, "dblclick", handleDoubleClick);
  addListener(editorShapeList, "click", handleShapeListClick);
  addListener(editorAddEventButton, "click", handleEditorAddEvent);
  addListener(editorEventList, "click", handleEditorEventListClick);
  addListener(editorEventList, "change", handleEditorEventListInput);
  addListener(editorEventList, "input", handleEditorEventListInput);
  addListener(editorStreamSelect, "change", handleEditorStreamChange);
  addListener(editorLandmarkSelect, "change", handleEditorLandmarkChange);
  addListener(editorDeleteShapeButton, "click", handleDeleteShape);
  addListener(editorMidiPortSelect, "change", handleEditorMidiPortChange);
  addListener(window, "pointermove", handleInputPointerMove, { passive: true });
  addListener(window, "pointerdown", handleInputPointerDown, { passive: true });
  addListener(window, "pointerup", handleInputPointerUp, { passive: true });
  addListener(window, "pointercancel", handleInputPointerCancel);
  addListener(window, "keydown", handleInputKeyDown, true);
  addListener(window, "keyup", handleInputKeyUp, true);

  if (typeof editor.on === "function") {
    editor.on("selectionchange", handleSelectionChange);
    editor.on("shapealtclick", handleShapeAltClick);
    editor.on("shapeschange", handleShapesChange);
  }

  if (typeof editor.getState === "function") {
    const initial = editor.getState();
    if (initial && Array.isArray(initial.selection) && initial.selection.length) {
      state.activeShapeId = initial.selection[0];
      ensureDraftFromShape(getShapeSnapshot(state.activeShapeId));
    }
    if (initial && Array.isArray(initial.shapes)) {
      handleShapesChange(initial.shapes);
    }
  }
  updateOpenButtonState();
  renderShapeList();
  syncEditorDetailForm();
  applyMidiSelections();
  ensureMidiAccess();
  evaluateShapeInteractions();

  return {
    dispose() {
      listeners.forEach((remove) => remove());
      if (typeof editor.off === "function") {
        editor.off("selectionchange", handleSelectionChange);
        editor.off("shapealtclick", handleShapeAltClick);
        editor.off("shapeschange", handleShapesChange);
      }
    }
  };
}
