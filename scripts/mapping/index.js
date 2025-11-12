import { createRgbaPicker } from "../ui/rgba-picker.js";

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

// Combined list for layers with "hands" process that track both left and right hands
const BOTH_HANDS_LANDMARKS_LIST = [
  { key: "left_wrist", label: "L Wrist", index: 0 },
  { key: "left_thumb_cmc", label: "L Thumb CMC", index: 1 },
  { key: "left_thumb_mcp", label: "L Thumb MCP", index: 2 },
  { key: "left_thumb_ip", label: "L Thumb IP", index: 3 },
  { key: "left_thumb_tip", label: "L Thumb tip", index: 4 },
  { key: "left_index_mcp", label: "L Index MCP", index: 5 },
  { key: "left_index_pip", label: "L Index PIP", index: 6 },
  { key: "left_index_dip", label: "L Index DIP", index: 7 },
  { key: "left_index_tip", label: "L Index tip", index: 8 },
  { key: "left_middle_mcp", label: "L Middle MCP", index: 9 },
  { key: "left_middle_pip", label: "L Middle PIP", index: 10 },
  { key: "left_middle_dip", label: "L Middle DIP", index: 11 },
  { key: "left_middle_tip", label: "L Middle tip", index: 12 },
  { key: "left_ring_mcp", label: "L Ring MCP", index: 13 },
  { key: "left_ring_pip", label: "L Ring PIP", index: 14 },
  { key: "left_ring_dip", label: "L Ring DIP", index: 15 },
  { key: "left_ring_tip", label: "L Ring tip", index: 16 },
  { key: "left_pinky_mcp", label: "L Pinky MCP", index: 17 },
  { key: "left_pinky_pip", label: "L Pinky PIP", index: 18 },
  { key: "left_pinky_dip", label: "L Pinky DIP", index: 19 },
  { key: "left_pinky_tip", label: "L Pinky tip", index: 20 },
  { key: "right_wrist", label: "R Wrist", index: 0 },
  { key: "right_thumb_cmc", label: "R Thumb CMC", index: 1 },
  { key: "right_thumb_mcp", label: "R Thumb MCP", index: 2 },
  { key: "right_thumb_ip", label: "R Thumb IP", index: 3 },
  { key: "right_thumb_tip", label: "R Thumb tip", index: 4 },
  { key: "right_index_mcp", label: "R Index MCP", index: 5 },
  { key: "right_index_pip", label: "R Index PIP", index: 6 },
  { key: "right_index_dip", label: "R Index DIP", index: 7 },
  { key: "right_index_tip", label: "R Index tip", index: 8 },
  { key: "right_middle_mcp", label: "R Middle MCP", index: 9 },
  { key: "right_middle_pip", label: "R Middle PIP", index: 10 },
  { key: "right_middle_dip", label: "R Middle DIP", index: 11 },
  { key: "right_middle_tip", label: "R Middle tip", index: 12 },
  { key: "right_ring_mcp", label: "R Ring MCP", index: 13 },
  { key: "right_ring_pip", label: "R Ring PIP", index: 14 },
  { key: "right_ring_dip", label: "R Ring DIP", index: 15 },
  { key: "right_ring_tip", label: "R Ring tip", index: 16 },
  { key: "right_pinky_mcp", label: "R Pinky MCP", index: 17 },
  { key: "right_pinky_pip", label: "R Pinky PIP", index: 18 },
  { key: "right_pinky_dip", label: "R Pinky DIP", index: 19 },
  { key: "right_pinky_tip", label: "R Pinky tip", index: 20 }
];

const createLandmarkIndexMap = (list) =>
  list.reduce((map, entry, defaultIndex) => {
    const index = Number.isFinite(entry.index) ? entry.index : defaultIndex;
    map[entry.key] = index;
    return map;
  }, {});

const POSE_INDEX_BY_KEY = createLandmarkIndexMap(POSE_LANDMARKS_LIST);
const HAND_INDEX_BY_KEY = createLandmarkIndexMap(HAND_LANDMARKS_LIST);
const BOTH_HANDS_INDEX_BY_KEY = createLandmarkIndexMap(BOTH_HANDS_LANDMARKS_LIST);

// Create swap maps for horizontal flip (left <-> right)
const POSE_FLIP_SWAP = {};
const BOTH_HANDS_FLIP_SWAP = {};

// Build pose swap map
POSE_LANDMARKS_LIST.forEach(landmark => {
  const key = landmark.key;
  if (key.startsWith("left_")) {
    const rightKey = "right_" + key.slice(5);
    POSE_FLIP_SWAP[key] = rightKey;
  } else if (key.startsWith("right_")) {
    const leftKey = "left_" + key.slice(6);
    POSE_FLIP_SWAP[key] = leftKey;
  }
});

// Build hands swap map
BOTH_HANDS_LANDMARKS_LIST.forEach(landmark => {
  const key = landmark.key;
  if (key.startsWith("left_")) {
    const rightKey = "right_" + key.slice(5);
    BOTH_HANDS_FLIP_SWAP[key] = rightKey;
  } else if (key.startsWith("right_")) {
    const leftKey = "left_" + key.slice(6);
    BOTH_HANDS_FLIP_SWAP[key] = leftKey;
  }
});

const FACE_REFERENCE_POINTS = [
  { key: "centroid", label: "Face centroid" },
  { key: "nose_tip", label: "Nose tip", index: 1 }
];

const FACE_INDEX_BY_KEY = FACE_REFERENCE_POINTS.filter((entry) => Number.isFinite(entry.index)).reduce((map, entry) => {
  map[entry.key] = entry.index;
  return map;
}, {});

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
  midiPort: "broadcast",
  events: [createDefaultEvent("midiNote")],
  enabled: true,
  showInMain: true,
  showInPreview: true
});

const mergeInteraction = (input) => {
  const defaults = createDefaultInteraction();
  const source = input && typeof input === "object" ? input : {};

  // Check if stream is a layer ID or a legacy stream type
  const sourceStream = source.stream;
  let streamDefinition = null;
  let finalStreamValue = defaults.stream;

  if (sourceStream && sourceStream.startsWith("layer-")) {
    // It's a layer ID - preserve it as-is
    finalStreamValue = sourceStream;
    // Get the layer's process type to determine which landmarks to use
    const layer = layersState.streams.find(s => s.id === sourceStream);
    if (layer) {
      if (layer.process === "pose") {
        streamDefinition = STREAM_DEFINITIONS.pose;
      } else if (layer.process === "hands") {
        // Use combined list that includes both left and right hand landmarks
        streamDefinition = { id: "hands", label: "Hands", options: BOTH_HANDS_LANDMARKS_LIST };
      } else if (layer.process === "face") {
        streamDefinition = STREAM_DEFINITIONS.face;
      }
    }
  } else if (sourceStream && STREAM_DEFINITIONS[sourceStream]) {
    // It's a legacy stream type (pose, leftHand, etc.) or special stream (pointer, keyboard)
    streamDefinition = STREAM_DEFINITIONS[sourceStream];
    finalStreamValue = streamDefinition.id;
  }

  const options = Array.isArray(streamDefinition?.options) ? streamDefinition.options : [];
  const candidateLandmark = source.landmark;
  const landmarkValid = options.some((option) => option.key === candidateLandmark);
  const fallbackLandmark = options[0]?.key || defaults.landmark;
  const events = Array.isArray(source.events) && source.events.length
    ? source.events.map(normalizeEvent)
    : defaults.events.map((event) => ({ ...normalizeEvent(event) }));
  return {
    stream: finalStreamValue,
    landmark: landmarkValid ? candidateLandmark : fallbackLandmark,
    midiPort: typeof source.midiPort === "string" && source.midiPort.trim() ? source.midiPort.trim() : defaults.midiPort,
    events,
    enabled: source.enabled !== false,
    showInMain: source.showInMain !== false,
    showInPreview: source.showInPreview !== false
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

// Layers state tracking (module-level so it's accessible to helper functions)
const layersState = {
  streams: [] // Array of layer stream objects
};

const populateStreamSelect = (selectEl, currentValue = null) => {
  if (!selectEl) return;

  // Get landmark-producing layers (pose, hands, face)
  const landmarkLayers = layersState.streams.filter(
    stream => stream.enabled && ["pose", "hands", "face"].includes(stream.process)
  );

  // Build options: layers first, then special streams (pointer, keyboard)
  const layerOptions = landmarkLayers.map(layer => {
    const processLabel = layer.process === "pose" ? "Pose" : layer.process === "hands" ? "Hands" : "Face";
    const label = `${escapeHtml(layer.name)} (${processLabel})`;
    return `<option value="${escapeHtml(layer.id)}">${label}</option>`;
  });

  const specialOptions = [
    `<option value="pointer">Pointer Input</option>`,
    `<option value="keyboard">Keyboard</option>`
  ];

  let html = "";
  if (layerOptions.length > 0) {
    html += `<optgroup label="Layer Streams">${layerOptions.join("")}</optgroup>`;
  }
  html += `<optgroup label="Input Streams">${specialOptions.join("")}</optgroup>`;

  selectEl.innerHTML = html;

  // Restore previous selection if available and valid
  if (currentValue) {
    const optionExists = Array.from(selectEl.options).some(opt => opt.value === currentValue);
    if (optionExists) {
      selectEl.value = currentValue;
    }
  }

  // If no value selected, select the first available option
  if (!selectEl.value) {
    if (layerOptions.length > 0) {
      selectEl.value = landmarkLayers[0].id;
    } else if (specialOptions.length > 0) {
      selectEl.value = "pointer";
    }
  }
};

const populateLandmarkOptions = (streamId, selectedKey, selectEl) => {
  if (!selectEl) return "";

  let definition = null;

  // Check if streamId is a layer ID
  if (streamId && streamId.startsWith("layer-")) {
    const layer = layersState.streams.find(s => s.id === streamId);
    if (layer) {
      // Map layer process type to landmark definitions
      if (layer.process === "pose") {
        definition = STREAM_DEFINITIONS.pose;
      } else if (layer.process === "hands") {
        // Use combined list that includes both left and right hand landmarks
        definition = { id: "hands", label: "Hands", options: BOTH_HANDS_LANDMARKS_LIST };
      } else if (layer.process === "face") {
        definition = STREAM_DEFINITIONS.face;
      }
    } else {
      console.warn(`[mediamime] Layer not found for landmark selection: ${streamId}`, {
        availableLayers: layersState.streams.map(s => ({ id: s.id, name: s.name, process: s.process }))
      });
    }
  } else {
    // Backward compatibility: use old stream definitions
    definition = STREAM_DEFINITIONS[streamId];
  }

  // Fallback to pose if no definition found
  if (!definition) {
    console.warn(`[mediamime] No landmark definition found for stream: ${streamId}, using pose fallback`);
    definition = STREAM_DEFINITIONS.pose;
  }

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

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DEFAULT_SHAPE_COLOR = "#ffffff";
const DEFAULT_SHAPE_OPACITY = 0.5;
const FILL_ALPHA_RATIO = 0.5;
const SHAPE_FILL_ALPHA = DEFAULT_SHAPE_OPACITY * FILL_ALPHA_RATIO;

const clampOpacity = (value) => {
  const numeric = Number.isFinite(value) ? value : Number.parseFloat(`${value}`) || 0;
  return clampRange(numeric, 0, 1);
};

const normalizeHexColor = (value, fallback = DEFAULT_SHAPE_COLOR) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (HEX_COLOR_PATTERN.test(trimmed)) {
    let hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
    if (hex.length === 3) {
      hex = hex.split("").map((char) => char + char).join("");
    }
    return `#${hex.toLowerCase()}`;
  }
  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const parseComponent = (component) => {
        if (!component) return null;
        if (component.endsWith("%")) {
          const percentValue = Number.parseFloat(component.slice(0, -1));
          if (!Number.isFinite(percentValue)) return null;
          return clampRange(Math.round((percentValue / 100) * 255), 0, 255);
        }
        const numeric = Number.parseFloat(component);
        if (!Number.isFinite(numeric)) return null;
        return clampRange(Math.round(numeric), 0, 255);
      };
      const toHexByte = (component) => component.toString(16).padStart(2, "0");
      const r = parseComponent(parts[0]);
      const g = parseComponent(parts[1]);
      const b = parseComponent(parts[2]);
      if ([r, g, b].every((component) => component !== null && Number.isFinite(component))) {
        return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
      }
    }
  }
  return fallback;
};

const hexToRgb = (hex) => {
  const normalized = normalizeHexColor(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16) || 255,
    g: Number.parseInt(normalized.slice(3, 5), 16) || 255,
    b: Number.parseInt(normalized.slice(5, 7), 16) || 255
  };
};

const hexToRgba = (hex, alpha = SHAPE_FILL_ALPHA) => {
  const normalized = normalizeHexColor(hex);
  const { r, g, b } = hexToRgb(normalized);
  const clampedAlpha = clampOpacity(Number(alpha) || SHAPE_FILL_ALPHA);
  const roundedAlpha = Math.round(clampedAlpha * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${roundedAlpha})`;
};

const getShapeColor = (shape, fallback = DEFAULT_SHAPE_COLOR) => {
  if (!shape || typeof shape !== "object") return fallback;
  const style = shape.style || {};
  if (typeof style.stroke === "string") {
    return normalizeHexColor(style.stroke, fallback);
  }
  if (typeof style.fill === "string") {
    return normalizeHexColor(style.fill, fallback);
  }
  return fallback;
};

const computeFillAlpha = (value) => {
  const ratio = clampOpacity(value);
  return clampOpacity(ratio * FILL_ALPHA_RATIO);
};

const getShapeOpacity = (shape, fallback = DEFAULT_SHAPE_OPACITY) => {
  if (!shape || typeof shape !== "object") return fallback;
  const style = shape.style || {};
  if (Number.isFinite(style.fillStrength)) {
    return clampOpacity(style.fillStrength);
  }
  if (Number.isFinite(style.fillAlpha)) {
    return clampOpacity(style.fillAlpha / FILL_ALPHA_RATIO);
  }
  if (typeof style.fill === "string") {
    const match = style.fill.match(/^rgba?\(([^)]+)\)$/i);
    if (match) {
      const parts = match[1].split(",").map((part) => part.trim());
      if (parts.length === 4) {
        const alpha = Number.parseFloat(parts[3]);
        if (Number.isFinite(alpha)) {
          return clampOpacity(alpha / FILL_ALPHA_RATIO);
        }
      } else if (parts.length === 3) {
        return 1;
      }
    }
  }
  return fallback;
};

const applyShapeColor = (shape, color, opacity = DEFAULT_SHAPE_OPACITY) => {
  if (!shape) return { color: DEFAULT_SHAPE_COLOR, opacity: DEFAULT_SHAPE_OPACITY };
  const normalizedColor = normalizeHexColor(color);
  const normalizedOpacity = clampOpacity(opacity);
  const fillAlpha = computeFillAlpha(normalizedOpacity);
  if (!shape.style || typeof shape.style !== "object") {
    shape.style = {};
  }
  shape.style.stroke = normalizedColor;
  shape.style.fillStrength = normalizedOpacity;
  shape.style.fillAlpha = fillAlpha;
  shape.style.fill = hexToRgba(normalizedColor, fillAlpha);
  return { color: normalizedColor, opacity: normalizedOpacity };
};

export function initMapping({ editor }) {
  if (!editor) {
    console.warn("[mediamime] Mapping module requires an editor API.");
    return { dispose() {} };
  }

  const mapPanel = document.getElementById("modal-map");
  const mapPanelHandle = mapPanel?.querySelector("[data-modal-handle]");
  const mapPanelChrome = mapPanel?.querySelector('.modal-chrome');
  const modal = document.getElementById("assignment-modal");
  const backdrop = document.getElementById("assignment-backdrop");
  const shapeNameInput = document.getElementById("assignment-shape-name");
  const streamSelect = document.getElementById("assignment-stream");
  const landmarkSelect = document.getElementById("assignment-landmark");
  const assignmentMidiPortSelect = document.getElementById("assignment-midi-port");
  const assignmentMidiPortRefreshButton = document.getElementById("assignment-midi-port-refresh");
  const assignmentColorChip = document.querySelector("[data-color-toggle='assignment']");
  const assignmentColorPanel = document.querySelector("[data-color-panel='assignment']");
  const assignmentPickerRoot = assignmentColorPanel?.querySelector("[data-rgba-picker]");
  const addEventButton = document.getElementById("assignment-add-event");
  const eventList = document.getElementById("assignment-event-list");
  const closeButton = document.getElementById("assignment-modal-close");
  const openButton = document.getElementById("editor-open-modal");
  const assignmentHandle = modal.querySelector("[data-assignment-handle]");
  const assignmentBody = modal.querySelector(".assignment-body");
  const svg = document.getElementById("gesture-svg");
  const editorShapeList = document.getElementById("editor-shape-list");
  const editorDetailEmpty = document.getElementById("editor-detail-empty");
  const editorDetailForm = document.getElementById("editor-detail-form");
  const editorShapeNameInput = document.getElementById("editor-shape-name");
  // Detail panel now uses a single enable/disable toggle (originally main view toggle location)
  const editorShapeEnabledToggle = document.getElementById("editor-shape-enabled-toggle");
  const editorShapePreviewToggle = (() => {
    const button = document.getElementById("editor-shape-preview-toggle");
    if (button) {
      button.remove(); // Preview visibility is controlled from the shape list.
    }
    return null;
  })();
  // Import/Export controls in the Map panel header
  const snapshotImportInput = document.getElementById("snapshot-import-input");
  const snapshotImportButton = document.getElementById("snapshot-import-button");
  const snapshotAppendButton = document.getElementById("snapshot-append-button");
  const snapshotExportButton = document.getElementById("snapshot-export-button");
  // Local storage: autosave/restore last score
  const LAST_SCORE_STORAGE_KEY = "mediamime:last-score";
  let saveDebounce = null;
  const scheduleSaveLastScore = (shapes) => {
    if (!Array.isArray(shapes) || typeof localStorage === "undefined") return;
    if (saveDebounce) {
      clearTimeout(saveDebounce);
    }
    saveDebounce = setTimeout(() => {
      try {
        const payload = { kind: "mediamime-score", version: 1, savedAt: new Date().toISOString(), shapes };
        localStorage.setItem(LAST_SCORE_STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        console.warn("[mediamime] Failed to persist last score", error);
      }
    }, 250);
  };

  const tryLoadLastScore = () => {
    if (typeof localStorage === "undefined") return false;
    try {
      const raw = localStorage.getItem(LAST_SCORE_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const shapes = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.shapes) ? parsed.shapes : [];
      if (!shapes.length) return false;
      if (typeof editor?.replaceShapes === 'function') {
        editor.replaceShapes(shapes);
        return true;
      }
      return false;
    } catch (error) {
      console.warn("[mediamime] Failed to load last score", error);
      return false;
    }
  };

  const editorColorChip = document.querySelector("[data-color-toggle='editor']");
  const editorColorPanel = document.querySelector("[data-color-panel='editor']");
  const editorPickerRoot = editorColorPanel?.querySelector("[data-rgba-picker]");
  let editorColorPicker = null;
  let assignmentColorPicker = null;
  const editorShapeMidiSelect = document.getElementById("editor-shape-midi");
  const editorShapeMidiRefreshButton = document.getElementById("editor-shape-midi-refresh");
  const editorDeleteShapeButton = document.getElementById("editor-delete-shape");
  const editorStreamSelect = document.getElementById("editor-stream-select");
  const editorLandmarkSelect = document.getElementById("editor-landmark-select");
  const editorEventList = document.getElementById("editor-event-list");
  const editorAddEventButton = document.getElementById("editor-add-event");

  if (!modal || !backdrop || !eventList) {
    console.warn("[mediamime] Mapping modal markup is missing; skipping mapping module.");
    return { dispose() {} };
  }

  // Populate stream selects with initial fallback (pointer/keyboard at minimum)
  // Will be updated when layers module dispatches its state
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
  let isSyncingColor = false;
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
    const shape = shapesById.get(shapeId);
    const interaction = shape ? mergeInteraction(shape.interaction) : createDefaultInteraction();
    if (svg) {
      const node = svg.querySelector(`[data-shape-id="${shapeId}"]`);
      if (node) {
        node.classList.toggle("is-mapping-active", active);
        node.classList.toggle("is-disabled", interaction.enabled === false);
        node.classList.toggle("is-hidden-main", interaction.showInMain === false);
        if (active && shape) {
          const color = getShapeColor(shape, DEFAULT_SHAPE_COLOR);
          const opacity = Math.min(getShapeOpacity(shape, DEFAULT_SHAPE_OPACITY) + 0.3, 1);
          node.style.setProperty("--shape-glow-color", hexToRgba(color, opacity));
        } else {
          node.style.removeProperty("--shape-glow-color");
        }
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
        button.classList.toggle("is-disabled", interaction.enabled === false);
        button.classList.toggle("is-main-hidden", interaction.showInMain === false);
        button.classList.toggle("is-preview-hidden", interaction.showInPreview === false);
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

  const getDefaultMidiPort = () => editorConfig.midiPort || "broadcast";

  const handleEditorModeChange = (event) => {
    const mode = event?.detail?.mode;
    if (!mode || mode === state.editorMode) return;
    state.editorMode = mode;
    evaluateShapeInteractions();
  };

  const populateMidiPortSelect = (selectEl, selectedId) => {
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
    const fallback = options.some((option) => option.id === getDefaultMidiPort()) ? getDefaultMidiPort() : "broadcast";
    const candidate = typeof selectedId === "string" && selectedId.trim() ? selectedId.trim() : fallback;
    const normalized = options.some((option) => option.id === candidate) ? candidate : "broadcast";
    selectEl.innerHTML = markup;
    selectEl.value = normalized;
    selectEl.dataset.selectedPort = normalized;
  };

  const resolveActiveShapeMidiPort = () => {
    if (!state.activeShapeId) return getDefaultMidiPort();
    const shape = shapesById.get(state.activeShapeId);
    if (!shape) return getDefaultMidiPort();
    const explicit = typeof shape.interaction?.midiPort === "string" ? shape.interaction.midiPort.trim() : "";
    if (explicit) {
      return explicit;
    }
    const merged = mergeInteraction(shape.interaction);
    const fallback = merged.midiPort || "broadcast";
    return fallback === "broadcast" ? getDefaultMidiPort() : fallback;
  };

  const resolveDraftMidiPort = () => {
    if (state.draftInteraction && typeof state.draftInteraction.midiPort === "string") {
      const trimmed = state.draftInteraction.midiPort.trim();
      return trimmed || getDefaultMidiPort();
    }
    return resolveActiveShapeMidiPort();
  };

  const applyMidiSelections = () => {
    isSyncingConfig = true;
    const activePort = resolveActiveShapeMidiPort();
    const draftPort = resolveDraftMidiPort();
    populateMidiPortSelect(assignmentMidiPortSelect, draftPort);
    if (editorShapeMidiSelect) {
      populateMidiPortSelect(editorShapeMidiSelect, activePort);
      editorShapeMidiSelect.disabled = !state.activeShapeId;
    }
    if (editorShapeMidiRefreshButton) {
      editorShapeMidiRefreshButton.disabled = !state.activeShapeId;
    }
    isSyncingConfig = false;
  };

  const setMidiPort = (value) => {
    const candidate = typeof value === "string" ? value.trim() : "";
    const normalized = candidate && candidate !== "broadcast" ? candidate : "broadcast";
    if (state.modalOpen && state.draftInteraction) {
      if (state.draftInteraction.midiPort !== normalized) {
        state.draftInteraction.midiPort = normalized;
        commitDraftInteraction();
      }
    } else if (state.activeShapeId) {
      const shape = shapesById.get(state.activeShapeId);
      if (shape) {
        const current = mergeInteraction(shape.interaction).midiPort || "broadcast";
        if (current !== normalized) {
          updateSelectedInteraction((interaction) => {
            interaction.midiPort = normalized;
          });
        }
      }
    }
    if (editorConfig.midiPort !== normalized) {
      editorConfig.midiPort = normalized;
      saveEditorConfig();
    }
    applyMidiSelections();
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

  const colorPopovers = [];
  function registerColorPopover(toggle, panel) {
    if (!toggle || !panel) return null;

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

    const stopPropagation = (event) => {
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      event.stopPropagation();
    };

    const entry = {
      toggle,
      panel,
      isOpen: false
    };

    const repositionPanel = () => {
      if (!entry.isOpen || !toggle || !panel) return;
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
      if (Number.isFinite(minLeft) && Number.isFinite(maxLeft)) {
        left = Math.min(Math.max(left, minLeft), maxLeft);
      }
      panel.style.top = `${Math.round(top)}px`;
      panel.style.left = `${Math.round(left)}px`;
      panel.style.setProperty("--color-popover-origin", origin);
    };

    entry.open = () => {
      if (entry.isOpen) return;
      colorPopovers.forEach((other) => {
        if (other !== entry) other.close();
      });
      panel.hidden = false;
      panel.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.classList.add("is-open");
      entry.isOpen = true;
      repositionPanel();
      requestAnimationFrame(repositionPanel);
    };

    entry.close = () => {
      if (!entry.isOpen) return;
      entry.isOpen = false;
      panel.classList.remove("is-open");
      panel.hidden = true;
      panel.style.top = "-9999px";
      panel.style.left = "-9999px";
      panel.style.removeProperty("--color-popover-origin");
      toggle.setAttribute("aria-expanded", "false");
      toggle.classList.remove("is-open");
    };

    const handleToggle = (event) => {
      event.preventDefault();
      if (toggle.disabled) return;
      if (entry.isOpen) {
        entry.close();
      } else {
        entry.open();
      }
    };

    addListener(toggle, "click", handleToggle);
    addListener(window, "resize", repositionPanel);
    addListener(window, "scroll", repositionPanel, true);
    addListener(panel, "pointerdown", stopPropagation);
    addListener(panel, "mousedown", stopPropagation);
    addListener(panel, "touchstart", stopPropagation);
    addListener(panel, "click", stopPropagation);

    toggle.setAttribute("aria-expanded", "false");
    toggle.classList.remove("is-open");
    panel.hidden = true;
    colorPopovers.push(entry);
    return entry;
  }

  const closeColorPopovers = () => {
    colorPopovers.forEach((entry) => entry.close());
  };

  const handleGlobalPointerDown = (event) => {
    if (!colorPopovers.some((entry) => entry.isOpen)) return;
    const path = typeof event.composedPath === "function" ? event.composedPath() : null;
    const inside = colorPopovers.some((entry) => {
      if (!entry.isOpen) return false;
      if (entry.panel.contains(event.target) || entry.toggle.contains(event.target)) {
        return true;
      }
      if (path) {
        return path.includes(entry.panel) || path.includes(entry.toggle);
      }
      return false;
    });
    if (!inside) {
      closeColorPopovers();
    }
  };

  const handleGlobalKeyDown = (event) => {
    if (event.key === "Escape" && colorPopovers.some((entry) => entry.isOpen)) {
      closeColorPopovers();
    }
  };

  addListener(document, "pointerdown", handleGlobalPointerDown);
  addListener(document, "keydown", handleGlobalKeyDown);

  function updateEditorColorDisplay(color, opacity = (typeof state !== "undefined" && state?.draftOpacity) ?? DEFAULT_SHAPE_OPACITY) {
    const normalizedColor = normalizeHexColor(color, DEFAULT_SHAPE_COLOR);
    const normalizedOpacity = clampOpacity(opacity);
    const fillAlpha = computeFillAlpha(normalizedOpacity);
    if (editorColorChip) {
      editorColorChip.style.setProperty("--chip-color", normalizedColor);
    }
    if (editorDetailForm) {
      editorDetailForm.style.setProperty("--shape-accent-color", normalizedColor);
    }
    if (editorColorPicker) {
      editorColorPicker.setColor(normalizedColor, normalizedOpacity, { emit: false, source: "program" });
    }
    if (editorPickerRoot) {
      editorPickerRoot.style.setProperty("--rgba-color", hexToRgba(normalizedColor, fillAlpha));
    }
  }

  function updateAssignmentColorDisplay(color, opacity = (typeof state !== "undefined" && state?.draftOpacity) ?? DEFAULT_SHAPE_OPACITY) {
    const normalizedColor = normalizeHexColor(color, DEFAULT_SHAPE_COLOR);
    const normalizedOpacity = clampOpacity(opacity);
    const fillAlpha = computeFillAlpha(normalizedOpacity);
    if (assignmentColorChip) {
      assignmentColorChip.style.setProperty("--chip-color", normalizedColor);
    }
    if (assignmentBody) {
      assignmentBody.style.setProperty("--shape-accent-color", normalizedColor);
    }
    if (assignmentColorPicker) {
      assignmentColorPicker.setColor(normalizedColor, normalizedOpacity, { emit: false, source: "program" });
    }
    if (assignmentPickerRoot) {
      assignmentPickerRoot.style.setProperty("--rgba-color", hexToRgba(normalizedColor, fillAlpha));
    }
  }

  function updateColorDisplays(color, opacity = (typeof state !== "undefined" && state?.draftOpacity) ?? DEFAULT_SHAPE_OPACITY) {
    updateEditorColorDisplay(color, opacity);
    updateAssignmentColorDisplay(color, opacity);
  }

  if (editorColorChip) {
    editorColorChip.disabled = true;
    editorColorChip.style.setProperty("--chip-color", DEFAULT_SHAPE_COLOR);
  }
  if (assignmentColorChip) {
    assignmentColorChip.disabled = true;
    assignmentColorChip.style.setProperty("--chip-color", DEFAULT_SHAPE_COLOR);
  }

  editorColorPicker = createRgbaPicker({
    root: editorPickerRoot,
    initialHex: DEFAULT_SHAPE_COLOR,
    initialAlpha: DEFAULT_SHAPE_OPACITY,
    onChange: (payload) => {
      if (!payload) return;
      handleEditorColorPickerInput(payload);
    }
  });

  assignmentColorPicker = createRgbaPicker({
    root: assignmentPickerRoot,
    initialHex: DEFAULT_SHAPE_COLOR,
    initialAlpha: DEFAULT_SHAPE_OPACITY,
    onChange: (payload) => {
      if (!payload) return;
      handleAssignmentColorPickerInput(payload);
    }
  });

  if (editorColorPicker) {
    editorColorPicker.setColor(DEFAULT_SHAPE_COLOR, DEFAULT_SHAPE_OPACITY, { emit: false, source: "program" });
    editorColorPicker.setDisabled(true);
  }
  if (editorPickerRoot) {
    editorPickerRoot.style.setProperty("--rgba-color", hexToRgba(DEFAULT_SHAPE_COLOR, computeFillAlpha(DEFAULT_SHAPE_OPACITY)));
  }
  if (assignmentColorPicker) {
    assignmentColorPicker.setColor(DEFAULT_SHAPE_COLOR, DEFAULT_SHAPE_OPACITY, { emit: false, source: "program" });
    assignmentColorPicker.setDisabled(true);
  }
  if (assignmentPickerRoot) {
    assignmentPickerRoot.style.setProperty("--rgba-color", hexToRgba(DEFAULT_SHAPE_COLOR, computeFillAlpha(DEFAULT_SHAPE_OPACITY)));
  }

  registerColorPopover(editorColorChip, editorColorPanel);
  registerColorPopover(assignmentColorChip, assignmentColorPanel);

  updateColorDisplays(DEFAULT_SHAPE_COLOR, DEFAULT_SHAPE_OPACITY);

  const state = {
    activeShapeId: null,
    draftName: "",
    draftInteraction: null,
    draftColor: DEFAULT_SHAPE_COLOR,
    draftOpacity: DEFAULT_SHAPE_OPACITY,
    isSyncing: false,
    modalOpen: false,
    editorMode: typeof editor.getMode === "function" ? editor.getMode() : "edit"
  };

  const getShapeSnapshot = (shapeId) => {
    if (!shapeId || typeof editor.getShapeSnapshot !== "function") return null;
    return editor.getShapeSnapshot(shapeId);
  };

  const ensureDraftFromShape = (shape) => {
    if (!shape) {
      state.draftInteraction = null;
      state.draftName = "";
      state.draftColor = DEFAULT_SHAPE_COLOR;
      state.draftOpacity = DEFAULT_SHAPE_OPACITY;
      return;
    }
    const index = shapeOrder.indexOf(shape.id);
    const fallbackName = getShapeDisplayName(shape, index >= 0 ? index : 0);
    const rawName = typeof shape.name === "string" ? shape.name.trim() : "";
    state.draftName = rawName || fallbackName;
    const mergedInteraction = mergeInteraction(shape.interaction);
    const explicitMidiPort = typeof shape.interaction?.midiPort === "string"
      ? shape.interaction.midiPort.trim()
      : "";
    state.draftInteraction = {
      ...mergedInteraction,
      name: state.draftName,
      midiPort: explicitMidiPort || getDefaultMidiPort()
    };
    state.draftColor = getShapeColor(shape, DEFAULT_SHAPE_COLOR);
    state.draftOpacity = getShapeOpacity(shape, DEFAULT_SHAPE_OPACITY);
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
    if (editorColorChip) {
      editorColorChip.disabled = !hasShape;
      if (!hasShape) {
        editorColorChip.style.setProperty("--chip-color", DEFAULT_SHAPE_COLOR);
      }
    }
    if (editorColorPicker) {
      editorColorPicker.setDisabled(!hasShape);
      if (!hasShape) {
        editorColorPicker.setColor(DEFAULT_SHAPE_COLOR, DEFAULT_SHAPE_OPACITY, { emit: false, source: "program" });
      }
    }
    if (!hasShape && editorPickerRoot) {
      editorPickerRoot.style.setProperty("--rgba-color", hexToRgba(DEFAULT_SHAPE_COLOR, computeFillAlpha(DEFAULT_SHAPE_OPACITY)));
    }
    if (!hasShape) {
      state.draftColor = DEFAULT_SHAPE_COLOR;
      state.draftOpacity = DEFAULT_SHAPE_OPACITY;
      closeColorPopovers();
      updateColorDisplays(DEFAULT_SHAPE_COLOR, DEFAULT_SHAPE_OPACITY);
    }
  };

  const focusEditorShapeName = () => {
    if (!editorShapeNameInput || editorShapeNameInput.disabled) return;
    setTimeout(() => {
      try {
        editorShapeNameInput.focus({ preventScroll: true });
      } catch (error) {
        editorShapeNameInput.focus();
      }
      if (typeof editorShapeNameInput.select === "function") {
        editorShapeNameInput.select();
      }
    }, 30);
  };

  const getShapeDisplayName = (shape, index = 0) => {
    if (!shape) return `Shape ${index + 1}`;
    const raw = typeof shape.name === "string" ? shape.name.trim() : "";
    if (raw) return raw;
    const typeLabel = shape.type ? shape.type.charAt(0).toUpperCase() + shape.type.slice(1) : "Shape";
    return `${typeLabel} ${index + 1}`;
  };

  const buildShapeMeta = (shape) => {
    if (!shape) return " ";
    const interaction = mergeInteraction(shape.interaction);
    const streamId = interaction.stream;
    const events = interaction.events.filter((event) => event.type && event.type !== "none");
    const primary = events[0] || null;

    // Stream emoji map
    const streamEmoji = (() => {
      switch (streamId) {
        case "pose":
          return "🧍"; // Pose
        case "leftHand":
          return "🤚"; // Left hand
        case "rightHand":
          return "✋"; // Right hand
        case "face":
          return "🙂"; // Face
        case "pointer":
          return "🖱️"; // Pointer
        case "keyboard":
          return "⌨️"; // Keyboard
        default:
          return "🎞️"; // Fallback
      }
    })();

    // Event type emoji
    let eventGlyph = " ";
    if (primary) {
      eventGlyph = primary.type === "midiCc" ? "🎛️" : primary.type === "midiNote" ? "🎹" : "•";
    }
    const extraSuffix = events.length > 1 ? ` +${events.length - 1}` : "";

    // Trigger glyphs
    const triggerGlyph = (() => {
      const t = primary?.trigger;
      switch (t) {
        case "enter":
          return "[➜";
        case "exit":
          return "➜]";
        case "enterExit":
          return "↔";
        case "inside":
          return "◻"; // leave off to avoid clutter
        default:
          return null;
      }
    })();

    const parts = [streamEmoji, `${eventGlyph}${extraSuffix}`];
    if (triggerGlyph) parts.push(triggerGlyph);
    return parts.join(" ");
  };

  const renderShapeList = () => {
    if (!editorShapeList) return;
    if (!shapeOrder.length) {
      editorShapeList.innerHTML = `<div class="editor-detail-empty">.</div>`;
      editorShapeList.removeAttribute("aria-activedescendant");
      return;
    }
    const total = shapeOrder.length;
    const markup = shapeOrder
      .map((id, index) => {
        const shape = shapesById.get(id);
        if (!shape) return "";
        const label = getShapeDisplayName(shape, index);
        const meta = buildShapeMeta(shape);
        const color = getShapeColor(shape, DEFAULT_SHAPE_COLOR);
        const opacity = getShapeOpacity(shape, DEFAULT_SHAPE_OPACITY);
        const fillAlpha = computeFillAlpha(opacity);
        const backgroundColor = hexToRgba(color, Math.min(fillAlpha + 0.08, 0.45));
        const borderColor = hexToRgba(color, Math.min(fillAlpha + 0.25, 0.9));
        const interaction = mergeInteraction(shape.interaction);
        const isEnabled = interaction.enabled !== false;
        const showMain = interaction.showInMain !== false;
        const showPreview = interaction.showInPreview !== false;
        const mainIcon = showMain ? "grid_on" : "grid_off";
        const previewIcon = showPreview ? "visibility" : "visibility_off";
        const enabledIcon = isEnabled ? "toggle_on" : "toggle_off";
        const isActive = id === state.activeShapeId;
        const canMoveUp = index > 0;
        const canMoveDown = index < total - 1;
        const runtime = runtimeState.get(id);
        const isRunning = Boolean(runtime?.inside || runtime?.hoverInside);
        const activeAttr = isRunning ? ` data-active="true"` : "";
        const disabledClass = isEnabled ? "" : " is-disabled";
        const styleAttr = ` style="--shape-color:${escapeHtml(color)};--shape-color-bg:${escapeHtml(backgroundColor)};--shape-color-border:${escapeHtml(borderColor)}"`;
        return `<button type="button" id="editor-shape-${id}" class="editor-shape-item${isActive ? " is-active" : ""}${disabledClass}" data-shape-id="${id}"${activeAttr}${styleAttr} role="option" aria-selected="${isActive ? "true" : "false"}">
            <span class="shape-label"><span class="shape-color-indicator" style="--shape-color:${escapeHtml(color)}" aria-hidden="true"></span><span class="shape-label-text">${escapeHtml(label)}</span></span>
            <span class="shape-meta">${escapeHtml(meta)}</span>
            <span class="shape-row-actions">
              <button type="button" class="icon-button" data-action="move-shape-up" title="Move shape up" aria-label="Move shape up" ${canMoveUp ? "" : "disabled"}>
                <span class="material-icons-outlined" aria-hidden="true">arrow_upward</span>
              </button>
              <button type="button" class="icon-button" data-action="move-shape-down" title="Move shape down" aria-label="Move shape down" ${canMoveDown ? "" : "disabled"}>
                <span class="material-icons-outlined" aria-hidden="true">arrow_downward</span>
              </button>
              <button type="button" class="icon-button ${showMain ? "is-active" : ""}" data-action="toggle-shape-main" aria-pressed="${String(showMain)}" title="${showMain ? "Hide in main view" : "Show in main view"}" aria-label="${showMain ? "Hide on main canvas" : "Show on main canvas"}">
                <span class="material-icons-outlined" aria-hidden="true">${mainIcon}</span>
              </button>
              <button type="button" class="icon-button ${showPreview ? "is-active" : ""}" data-action="toggle-shape-preview" aria-pressed="${String(showPreview)}" title="${showPreview ? "Hide in preview" : "Show in preview"}" aria-label="${showPreview ? "Hide in preview mode" : "Show in preview mode"}">
                <span class="material-icons-outlined" aria-hidden="true">${previewIcon}</span>
              </button>
              <button type="button" class="icon-button ${isEnabled ? "is-active" : ""}" data-action="toggle-shape-enabled" aria-pressed="${String(isEnabled)}" title="${isEnabled ? "Disable shape" : "Enable shape"}" aria-label="${isEnabled ? "Disable shape" : "Enable shape"}">
                <span class="material-icons-outlined" aria-hidden="true">${enabledIcon}</span>
              </button>
              <button type="button" class="icon-button" data-action="delete-shape" title="Delete shape" aria-label="Delete shape">
                <span class="material-icons-outlined" aria-hidden="true">delete</span>
              </button>
            </span>
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
    if (editorShapeNameInput) {
      if (!hasShape) {
        editorShapeNameInput.value = "";
        editorShapeNameInput.placeholder = "Untitled shape";
        editorShapeNameInput.disabled = true;
      } else {
        const index = shapeOrder.indexOf(shape.id);
        const fallbackName = getShapeDisplayName(shape, index >= 0 ? index : 0);
        const rawName = typeof shape.name === "string" ? shape.name.trim() : "";
        editorShapeNameInput.disabled = false;
        editorShapeNameInput.placeholder = fallbackName;
        editorShapeNameInput.value = rawName || fallbackName;
      }
    }
    if (editorShapeMidiSelect) {
      editorShapeMidiSelect.disabled = !hasShape;
    }
    if (editorShapeEnabledToggle) {
      if (!hasShape) {
        editorShapeEnabledToggle.disabled = true;
        editorShapeEnabledToggle.setAttribute("aria-pressed", "false");
        editorShapeEnabledToggle.classList.remove("is-active");
        const iconEl = editorShapeEnabledToggle.querySelector(".material-icons-outlined");
        if (iconEl) iconEl.textContent = "toggle_off";
        editorShapeEnabledToggle.title = "Enable shape";
        editorShapeEnabledToggle.setAttribute("aria-label", "Enable shape");
      }
    }
    if (editorShapePreviewToggle) {
      if (!hasShape) {
        editorShapePreviewToggle.disabled = true;
        editorShapePreviewToggle.setAttribute("aria-pressed", "false");
        editorShapePreviewToggle.classList.remove("is-active");
        const iconEl = editorShapePreviewToggle.querySelector(".material-icons-outlined");
        if (iconEl) iconEl.textContent = "visibility_off";
        editorShapePreviewToggle.title = "Show in preview";
        editorShapePreviewToggle.setAttribute("aria-label", "Show in preview mode");
      }
    }
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
      state.draftColor = DEFAULT_SHAPE_COLOR;
      state.draftOpacity = DEFAULT_SHAPE_OPACITY;
      if (editorColorPicker) {
        editorColorPicker.setDisabled(true);
        editorColorPicker.setColor(DEFAULT_SHAPE_COLOR, DEFAULT_SHAPE_OPACITY, { emit: false, source: "program" });
      }
      if (assignmentColorPicker) {
        assignmentColorPicker.setColor(DEFAULT_SHAPE_COLOR, DEFAULT_SHAPE_OPACITY, { emit: false, source: "program" });
      }
      updateColorDisplays(DEFAULT_SHAPE_COLOR, DEFAULT_SHAPE_OPACITY);
      applyMidiSelections();
      return;
    }
    const interaction = mergeInteraction(shape.interaction);
    if (editorShapeEnabledToggle) {
      const enabled = interaction.enabled !== false;
      editorShapeEnabledToggle.disabled = false;
      editorShapeEnabledToggle.setAttribute("aria-pressed", String(enabled));
      editorShapeEnabledToggle.classList.toggle("is-active", enabled);
      const iconEl = editorShapeEnabledToggle.querySelector(".material-icons-outlined");
      if (iconEl) iconEl.textContent = enabled ? "toggle_on" : "toggle_off";
      editorShapeEnabledToggle.title = enabled ? "Disable shape" : "Enable shape";
      editorShapeEnabledToggle.setAttribute("aria-label", enabled ? "Disable shape" : "Enable shape");
    }
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
    const color = getShapeColor(shape, DEFAULT_SHAPE_COLOR);
    const opacity = getShapeOpacity(shape, DEFAULT_SHAPE_OPACITY);
    state.draftColor = color;
    state.draftOpacity = opacity;
    if (editorColorPicker) {
      editorColorPicker.setDisabled(false);
      editorColorPicker.setColor(color, opacity, { emit: false, source: "program" });
    }
    if (assignmentColorPicker) {
      assignmentColorPicker.setColor(color, opacity, { emit: false, source: "program" });
    }
    updateColorDisplays(color, opacity);
    renderEventList(editorEventList, interaction.events);
    isSyncingEditorForm = false;
    applyMidiSelections();
  };

  const updateShapeInteractionById = (shapeId, mutator) => {
    if (!shapeId || typeof editor.updateShape !== "function" || typeof mutator !== "function") return;
    editor.updateShape(shapeId, (shape) => {
      if (!shape) return shape;
      const interaction = mergeInteraction(shape.interaction);
      mutator(interaction, shape);
      shape.interaction = interaction;
      return shape;
    });
    evaluateShapeInteractions();
  };

  const updateSelectedInteraction = (mutator) => {
    if (!state.activeShapeId) return;
    updateShapeInteractionById(state.activeShapeId, mutator);
  };

  const commitDraftInteraction = () => {
    if (!state.draftInteraction) return;
    const draft = { ...mergeInteraction(state.draftInteraction), name: state.draftName };
    state.draftInteraction = draft;
    updateSelectedInteraction((interaction, shape) => {
      interaction.stream = draft.stream;
      interaction.landmark = draft.landmark;
      interaction.events = draft.events.map(normalizeEvent);
      const resolvedMidiPort = draft.midiPort && draft.midiPort.trim()
        ? draft.midiPort.trim()
        : getDefaultMidiPort();
      interaction.midiPort = resolvedMidiPort;
      draft.midiPort = resolvedMidiPort;
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
    const color = state.draftColor
      || (state.activeShapeId && shapesById.has(state.activeShapeId)
        ? getShapeColor(shapesById.get(state.activeShapeId), DEFAULT_SHAPE_COLOR)
        : DEFAULT_SHAPE_COLOR);
    const opacity = state.draftOpacity
      || (state.activeShapeId && shapesById.has(state.activeShapeId)
        ? getShapeOpacity(shapesById.get(state.activeShapeId), DEFAULT_SHAPE_OPACITY)
        : DEFAULT_SHAPE_OPACITY);
    const normalizedColor = normalizeHexColor(color, DEFAULT_SHAPE_COLOR);
    const normalizedOpacity = clampOpacity(opacity);
    state.draftColor = normalizedColor;
    state.draftOpacity = normalizedOpacity;
    if (assignmentColorChip) {
      assignmentColorChip.disabled = false;
    }
    if (assignmentColorPicker) {
      assignmentColorPicker.setDisabled(false);
      assignmentColorPicker.setColor(normalizedColor, normalizedOpacity, { emit: false, source: "program" });
    }
    updateColorDisplays(normalizedColor, normalizedOpacity);
  };

  const closeModal = () => {
    if (!state.modalOpen) return;
    state.modalOpen = false;
    state.draftInteraction = null;
    state.draftColor = DEFAULT_SHAPE_COLOR;
    state.draftOpacity = DEFAULT_SHAPE_OPACITY;
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
    if (assignmentColorChip) {
      assignmentColorChip.disabled = true;
      assignmentColorChip.style.setProperty("--chip-color", DEFAULT_SHAPE_COLOR);
    }
    if (assignmentColorPicker) {
      assignmentColorPicker.setDisabled(true);
      assignmentColorPicker.setColor(DEFAULT_SHAPE_COLOR, DEFAULT_SHAPE_OPACITY, { emit: false, source: "program" });
    }
    if (assignmentPickerRoot) {
      assignmentPickerRoot.style.setProperty("--rgba-color", hexToRgba(DEFAULT_SHAPE_COLOR, computeFillAlpha(DEFAULT_SHAPE_OPACITY)));
    }
    updateAssignmentColorDisplay(DEFAULT_SHAPE_COLOR, DEFAULT_SHAPE_OPACITY);
    closeColorPopovers();
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
    const previousId = state.activeShapeId;
    const selection = Array.isArray(payload?.selection) ? payload.selection : [];
    const nextId = selection[0] || null;
    const selectionChanged = nextId !== previousId;
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
    if (selectionChanged) {
      closeColorPopovers();
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
    // Auto-save last score
    scheduleSaveLastScore(shapes);
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

  const handleEditorShapeNameInput = (event) => {
    if (isSyncingEditorForm) return;
    const value = event.target?.value ?? "";
    if (state.modalOpen) {
      state.draftName = value;
      if (state.draftInteraction) {
        state.draftInteraction.name = value.trim();
      }
    }
    updateSelectedInteraction((interaction, shape) => {
      const trimmed = value.trim();
      interaction.name = trimmed;
      if (shape) {
        shape.name = trimmed;
      }
    });
    if (!value.trim() && editorShapeNameInput) {
      const shape = state.activeShapeId ? shapesById.get(state.activeShapeId) : null;
      if (shape) {
        const index = shapeOrder.indexOf(shape.id);
        const fallbackName = getShapeDisplayName(shape, index >= 0 ? index : 0);
        editorShapeNameInput.placeholder = fallbackName;
      }
    }
  };

  const normalizeEditorShapeName = () => {
    if (isSyncingEditorForm || !editorShapeNameInput || editorShapeNameInput.disabled) return;
    const normalized = editorShapeNameInput.value.trim();
    editorShapeNameInput.value = normalized;
    handleEditorShapeNameInput({ target: editorShapeNameInput });
  };

  const commitShapeAppearance = ({ color = state.draftColor, opacity = state.draftOpacity } = {}) => {
    const normalizedColor = normalizeHexColor(color, DEFAULT_SHAPE_COLOR);
    const normalizedOpacity = clampOpacity(opacity ?? state.draftOpacity ?? DEFAULT_SHAPE_OPACITY);
    state.draftColor = normalizedColor;
    state.draftOpacity = normalizedOpacity;
    updateColorDisplays(normalizedColor, normalizedOpacity);
    if (!state.activeShapeId || typeof editor.updateShape !== "function") {
      return;
    }
    const currentShape = shapesById.get(state.activeShapeId);
    const currentColor = getShapeColor(currentShape, DEFAULT_SHAPE_COLOR);
    const currentOpacity = getShapeOpacity(currentShape, DEFAULT_SHAPE_OPACITY);
    if ((currentColor === normalizedColor && Math.abs(currentOpacity - normalizedOpacity) < 1e-3) || isSyncingColor) {
      return;
    }
    isSyncingColor = true;
    editor.updateShape(state.activeShapeId, (shape) => {
      applyShapeColor(shape, normalizedColor, normalizedOpacity);
      return shape;
    });
    isSyncingColor = false;
  };

  function handleEditorColorPickerInput(payload) {
    if (isSyncingEditorForm || !payload) return;
    const normalizedColor = normalizeHexColor(payload.hex || state.draftColor || DEFAULT_SHAPE_COLOR, state.draftColor || DEFAULT_SHAPE_COLOR);
    const normalizedOpacity = clampOpacity(payload.alpha ?? state.draftOpacity ?? DEFAULT_SHAPE_OPACITY);
    commitShapeAppearance({ color: normalizedColor, opacity: normalizedOpacity });
  }

  function handleAssignmentColorPickerInput(payload) {
    if (!state.modalOpen || !payload) return;
    const normalizedColor = normalizeHexColor(payload.hex || state.draftColor || DEFAULT_SHAPE_COLOR, state.draftColor || DEFAULT_SHAPE_COLOR);
    const normalizedOpacity = clampOpacity(payload.alpha ?? state.draftOpacity ?? DEFAULT_SHAPE_OPACITY);
    commitShapeAppearance({ color: normalizedColor, opacity: normalizedOpacity });
  }

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

  // ----- Import / Export -----
  const buildExportPayload = () => {
    const now = new Date().toISOString();
    const shapes = (typeof editor?.getState === 'function') ? (editor.getState().shapes || []) : [];
    return {
      kind: "mediamime-score",
      version: 1,
      createdAt: now,
      shapes
    };
  };

  const downloadJson = (data, filename = "score.json") => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("[mediamime] Failed to export score", error);
    }
  };

  const handleSnapshotExport = () => {
    const payload = buildExportPayload();
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `mediamime-score-${ts}.json`;
    downloadJson(payload, filename);
  };

  const safeParseJson = async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      return parsed;
    } catch (error) {
      console.warn("[mediamime] Failed to parse imported JSON", error);
      return null;
    }
  };

  const normalizeImportedShapes = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.shapes)) return payload.shapes;
    return [];
  };

  let importMode = "replace"; // or "append"
  const handleSnapshotImportFiles = async (event) => {
    const files = Array.from(event.target?.files || []);
    if (!files.length) return;
    const parsed = await safeParseJson(files[0]);
    let shapes = normalizeImportedShapes(parsed);
    if (!Array.isArray(shapes)) return;

    // Apply migration to imported shapes
    shapes = migrateShapeInteractions(shapes);

    if (importMode === "append" && typeof editor?.addShape === 'function') {
      shapes.forEach((s) => editor.addShape(s));
    } else {
      if (typeof editor?.replaceShapes === 'function') {
        editor.replaceShapes(shapes);
      } else if (typeof editor?.getState === 'function' && typeof editor?.deleteShape === 'function' && typeof editor?.addShape === 'function') {
        const current = editor.getState().shapes || [];
        current.forEach((s) => editor.deleteShape(s.id));
        shapes.forEach((s) => editor.addShape(s));
      } else {
        console.warn('[mediamime] Editor API missing replaceShapes; import aborted.');
      }
    }
    // reset input so the same file can be chosen again later
    if (snapshotImportInput) {
      snapshotImportInput.value = "";
    }
    importMode = "replace";
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

  const clampLandmarkPoint = (landmark) => {
    if (!landmark) return null;
    return {
      x: clampUnit(landmark.x ?? 0),
      y: clampUnit(landmark.y ?? 0),
      z: Number.isFinite(landmark.z) ? landmark.z : 0,
      visibility: Number.isFinite(landmark.visibility) ? landmark.visibility : 0
    };
  };

  const resolveFaceCentroid = (landmarks) => {
    if (!Array.isArray(landmarks) || landmarks.length === 0) return null;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    landmarks.forEach((landmark) => {
      sumX += landmark.x ?? 0;
      sumY += landmark.y ?? 0;
      sumZ += landmark.z ?? 0;
    });
    return clampLandmarkPoint({
      x: sumX / landmarks.length,
      y: sumY / landmarks.length,
      z: sumZ / landmarks.length
    });
  };

  // Helper: Get raw landmark from MediaPipe results by process type
  const getRawLandmark = (processType, landmarkKey, holisticResults) => {
    if (!holisticResults) return null;
    let key = landmarkKey || "";

    // Apply horizontal flip swap if flip is active
    const flip = inputState.flip || { horizontal: false, vertical: false };
    if (flip.horizontal) {
      if (processType === "pose" && POSE_FLIP_SWAP[key]) {
        key = POSE_FLIP_SWAP[key];
      } else if (processType === "hands" && BOTH_HANDS_FLIP_SWAP[key]) {
        key = BOTH_HANDS_FLIP_SWAP[key];
      }
    }

    if (processType === "pose") {
      const index = POSE_INDEX_BY_KEY[key] ?? POSE_INDEX_BY_KEY.nose ?? 0;
      return clampLandmarkPoint(Array.isArray(holisticResults.poseLandmarks) ? holisticResults.poseLandmarks[index] : null);
    }
    if (processType === "hands") {
      // Check if the key has a left/right prefix (new format)
      if (key.startsWith("left_")) {
        const baseKey = key.slice(5); // Remove "left_" prefix
        const index = BOTH_HANDS_INDEX_BY_KEY[key] ?? HAND_INDEX_BY_KEY[baseKey] ?? HAND_INDEX_BY_KEY.wrist ?? 0;
        return clampLandmarkPoint(Array.isArray(holisticResults.leftHandLandmarks) ? holisticResults.leftHandLandmarks[index] : null);
      } else if (key.startsWith("right_")) {
        const baseKey = key.slice(6); // Remove "right_" prefix
        const index = BOTH_HANDS_INDEX_BY_KEY[key] ?? HAND_INDEX_BY_KEY[baseKey] ?? HAND_INDEX_BY_KEY.wrist ?? 0;
        return clampLandmarkPoint(Array.isArray(holisticResults.rightHandLandmarks) ? holisticResults.rightHandLandmarks[index] : null);
      } else {
        // Legacy format without left/right prefix - default to left hand
        const index = HAND_INDEX_BY_KEY[key] ?? HAND_INDEX_BY_KEY.wrist ?? 0;
        return clampLandmarkPoint(Array.isArray(holisticResults.leftHandLandmarks) ? holisticResults.leftHandLandmarks[index] : null);
      }
    }
    if (processType === "face") {
      if (key === "centroid") {
        return resolveFaceCentroid(holisticResults.faceLandmarks);
      }
      const index = FACE_INDEX_BY_KEY[key];
      if (Number.isFinite(index)) {
        return clampLandmarkPoint(Array.isArray(holisticResults.faceLandmarks) ? holisticResults.faceLandmarks[index] : null);
      }
      return resolveFaceCentroid(holisticResults.faceLandmarks);
    }
    return null;
  };

  const resolveStreamPoint = (streamId, landmarkKey, holisticResults) => {
    if (!holisticResults) return null;

    // Check if streamId is a layer ID (new format: "layer-...")
    if (streamId && streamId.startsWith("layer-")) {
      const layer = layersState.streams.find(s => s.id === streamId);
      if (!layer) {
        console.warn(`[mediamime] Layer not found in resolveStreamPoint: ${streamId}`, {
          availableLayers: layersState.streams.map(s => ({ id: s.id, name: s.name }))
        });
        return null;
      }

      // Skip layers that don't produce landmarks
      if (!layer.enabled || !["pose", "hands", "face"].includes(layer.process)) {
        console.warn(`[mediamime] Layer not enabled or wrong process type: ${layer.name}`, {
          enabled: layer.enabled,
          process: layer.process
        });
        return null;
      }

      // Get raw landmark from MediaPipe results
      const rawPoint = getRawLandmark(layer.process, landmarkKey, holisticResults);
      if (!rawPoint) {
        console.warn(`[mediamime] No landmark found for ${landmarkKey} in ${layer.process} results`);
        return null;
      }

      // Apply layer viewport transform
      const transformedPoint = applyLayerViewportTransform(rawPoint, layer.viewport);
      return transformedPoint;
    }

    // Backward compatibility: old format using stream types directly
    // This handles "pose", "leftHand", "rightHand", "face"
    const key = landmarkKey || "";
    if (streamId === "pose") {
      const index = POSE_INDEX_BY_KEY[key] ?? POSE_INDEX_BY_KEY.nose ?? 0;
      return clampLandmarkPoint(Array.isArray(holisticResults.poseLandmarks) ? holisticResults.poseLandmarks[index] : null);
    }
    if (streamId === "leftHand") {
      const index = HAND_INDEX_BY_KEY[key] ?? HAND_INDEX_BY_KEY.wrist ?? 0;
      return clampLandmarkPoint(Array.isArray(holisticResults.leftHandLandmarks) ? holisticResults.leftHandLandmarks[index] : null);
    }
    if (streamId === "rightHand") {
      const index = HAND_INDEX_BY_KEY[key] ?? HAND_INDEX_BY_KEY.wrist ?? 0;
      return clampLandmarkPoint(Array.isArray(holisticResults.rightHandLandmarks) ? holisticResults.rightHandLandmarks[index] : null);
    }
    if (streamId === "face") {
      if (key === "centroid") {
        return resolveFaceCentroid(holisticResults.faceLandmarks);
      }
      const index = FACE_INDEX_BY_KEY[key];
      if (Number.isFinite(index)) {
        return clampLandmarkPoint(Array.isArray(holisticResults.faceLandmarks) ? holisticResults.faceLandmarks[index] : null);
      }
      // Default to centroid if no explicit index
      return resolveFaceCentroid(holisticResults.faceLandmarks);
    }
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

    const isPreviewMode = state.editorMode === "perform";

    shapeOrder.forEach((shapeId) => {
      const shape = shapesById.get(shapeId);
      if (!shape) {
        clearRuntimeState(shapeId);
        applyShapeHighlight(shapeId);
        return;
      }
      shape.interaction = mergeInteraction(shape.interaction);
      const interaction = shape.interaction;
      const isEnabled = interaction.enabled !== false;
      const showPreview = interaction.showInPreview !== false;
      if (!isEnabled || (isPreviewMode && !showPreview)) {
        clearRuntimeState(shapeId);
        applyShapeHighlight(shapeId);
        return;
      }
      const resolvedMidiPort = interaction.midiPort && interaction.midiPort.trim()
        ? interaction.midiPort.trim()
        : getDefaultMidiPort();
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
            const portForEvent = resolvedMidiPort;
            const sendOn = () => {
              const port = portForEvent;
              eventState.meta = { type: 'midiNote', channel, note, port };
              sendMidiNote(channel, note, velocity, 'on', port);
            };
            const sendOff = () => {
              const port = eventState.meta?.port || portForEvent;
              eventState.meta = { type: 'midiNote', channel, note, port };
              sendMidiNote(channel, note, 0, 'off', port);
            };
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
            const portForEvent = resolvedMidiPort;
            const sendValue = (val) => {
              const port = portForEvent;
              eventState.meta = { type: 'midiCc', channel, cc: ccNumber, port };
              sendMidiCc(channel, ccNumber, val, port);
            };
            const sendZero = () => {
              const port = eventState.meta?.port || portForEvent;
              eventState.meta = { type: 'midiCc', channel, cc: ccNumber, port };
              sendMidiCc(channel, ccNumber, 0, port);
            };
            if (trigger === 'enterExit') {
              if (justEntered) {
                sendValue(value);
                eventState.lastTriggerAt = now;
                shapeActive = true;
              }
              if (justExited) {
                sendZero();
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
              sendZero();
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
            const port = meta?.port || resolvedMidiPort || getDefaultMidiPort();
            sendMidiNote(meta.channel ?? 1, meta.note ?? 60, 0, 'off', port);
            eventState.noteOn = false;
          }
          if (eventState.meta?.type === 'midiCc') {
            const meta = eventState.meta;
            const port = meta?.port || resolvedMidiPort || getDefaultMidiPort();
            sendMidiCc(meta.channel ?? 1, meta.cc ?? 1, 0, port);
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

  const handleHolisticResults = (event) => {
    const nextResults = event?.detail?.results || null;
    const nextFlip = event?.detail?.flip || { horizontal: false, vertical: false };
    if (inputState.holistic === nextResults) return;
    inputState.holistic = nextResults;
    inputState.flip = nextFlip;
    evaluateShapeInteractions();
  };

  // Migration: Convert old stream references to layer IDs
  const migrateShapeInteractions = (shapes) => {
    if (!Array.isArray(shapes) || shapes.length === 0) return shapes;

    let migrationCount = 0;
    const migratedShapes = shapes.map(shape => {
      if (!shape || !shape.interaction || !shape.interaction.stream) {
        return shape;
      }

      const streamValue = shape.interaction.stream;

      // Skip if already using layer ID format
      if (streamValue.startsWith("layer-")) {
        return shape;
      }

      // Skip special streams (pointer, keyboard)
      if (streamValue === "pointer" || streamValue === "keyboard") {
        return shape;
      }

      // Map old stream types to process types
      const processTypeMap = {
        "pose": "pose",
        "leftHand": "hands",
        "rightHand": "hands",
        "face": "face"
      };

      const processType = processTypeMap[streamValue];
      if (!processType) {
        console.warn(`[mediamime] Unknown stream type during migration: ${streamValue}`);
        return shape;
      }

      // Find first matching layer with that process type
      const matchingLayer = layersState.streams.find(
        s => s.enabled && s.process === processType
      );

      if (!matchingLayer) {
        console.warn(`[mediamime] No matching layer found for stream type: ${streamValue}`);
        return shape;
      }

      // Update the interaction to use layer ID
      migrationCount++;
      return {
        ...shape,
        interaction: {
          ...shape.interaction,
          stream: matchingLayer.id
        }
      };
    });

    if (migrationCount > 0) {
      console.log(`[mediamime] Migrated ${migrationCount} shape(s) to use layer IDs`);
    }

    return migratedShapes;
  };

  const handleLayersChanged = (event) => {
    const streams = event?.detail?.streams || [];
    const hadNoLayers = layersState.streams.length === 0;
    layersState.streams = streams;

    // On first layers load, trigger migration if needed
    if (hadNoLayers && streams.length > 0 && typeof editor.getState === "function") {
      const editorState = editor.getState();
      if (editorState && Array.isArray(editorState.shapes) && editorState.shapes.length > 0) {
        const migratedShapes = migrateShapeInteractions(editorState.shapes);
        const needsMigration = migratedShapes.some((shape, i) => {
          const original = editorState.shapes[i];
          return shape.interaction?.stream !== original.interaction?.stream;
        });

        if (needsMigration && typeof editor.replaceShapes === "function") {
          editor.replaceShapes(migratedShapes);
          console.log("[mediamime] Applied shape interaction migration");
        }
      }
    }

    // Refresh stream dropdowns with current selections preserved
    if (streamSelect) {
      const currentValue = streamSelect.value;
      populateStreamSelect(streamSelect, currentValue);
      // Repopulate landmarks if stream is still selected
      if (streamSelect.value) {
        populateLandmarkOptions(streamSelect.value, landmarkSelect?.value, landmarkSelect);
      }
    }
    if (editorStreamSelect) {
      const currentValue = editorStreamSelect.value;
      populateStreamSelect(editorStreamSelect, currentValue);
      // Repopulate landmarks if stream is still selected
      if (editorStreamSelect.value) {
        populateLandmarkOptions(editorStreamSelect.value, editorLandmarkSelect?.value, editorLandmarkSelect);
      }
    }

    // Re-sync the editor detail form to ensure correct values
    syncEditorDetailForm();
  };

  // Apply viewport transform to a landmark point
  const applyLayerViewportTransform = (point, viewport) => {
    if (!point || !viewport) return point;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return point;

    // Viewport defines where the stream is placed in world coordinates
    // point.x and point.y are normalized (0-1) within the source video
    // We need to map them to the viewport's position and size
    const x = viewport.x + point.x * viewport.w;
    const y = viewport.y + point.y * viewport.h;

    return {
      x: clampUnit(x),
      y: clampUnit(y),
      z: point.z // Preserve z-depth if available
    };
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

  const handleEditorShapeMidiChange = () => {
    if (isSyncingConfig || !editorShapeMidiSelect) return;
    setMidiPort(editorShapeMidiSelect.value);
  };

  const handleDeleteShape = () => {
    if (!state.activeShapeId || typeof editor.deleteShape !== "function") return;
    editor.deleteShape(state.activeShapeId);
  };

  const handleShapeListClick = (event) => {
    const moveUpTarget = event.target?.closest?.("[data-action='move-shape-up']");
    if (moveUpTarget && !moveUpTarget.disabled) {
      event.stopPropagation();
      const shapeId = moveUpTarget.closest("[data-shape-id]")?.dataset.shapeId;
      if (shapeId && typeof editor.moveShapeInOrder === "function") {
        editor.moveShapeInOrder(shapeId, -1);
      }
      return;
    }
    const moveDownTarget = event.target?.closest?.("[data-action='move-shape-down']");
    if (moveDownTarget && !moveDownTarget.disabled) {
      event.stopPropagation();
      const shapeId = moveDownTarget.closest("[data-shape-id]")?.dataset.shapeId;
      if (shapeId && typeof editor.moveShapeInOrder === "function") {
        editor.moveShapeInOrder(shapeId, 1);
      }
      return;
    }
    const toggleMainTarget = event.target?.closest?.("[data-action='toggle-shape-main']");
    if (toggleMainTarget) {
      event.stopPropagation();
      const shapeId = toggleMainTarget.closest("[data-shape-id]")?.dataset.shapeId;
      if (shapeId) {
        updateShapeInteractionById(shapeId, (interaction) => {
          interaction.showInMain = interaction.showInMain === false ? true : false;
        });
      }
      return;
    }
    const togglePreviewTarget = event.target?.closest?.("[data-action='toggle-shape-preview']");
    if (togglePreviewTarget) {
      event.stopPropagation();
      const shapeId = togglePreviewTarget.closest("[data-shape-id]")?.dataset.shapeId;
      if (shapeId) {
        updateShapeInteractionById(shapeId, (interaction) => {
          interaction.showInPreview = interaction.showInPreview === false ? true : false;
        });
      }
      return;
    }
    const toggleEnabledTarget = event.target?.closest?.("[data-action='toggle-shape-enabled']");
    if (toggleEnabledTarget) {
      event.stopPropagation();
      const shapeId = toggleEnabledTarget.closest("[data-shape-id]")?.dataset.shapeId;
      if (shapeId) {
        updateShapeInteractionById(shapeId, (interaction) => {
          interaction.enabled = interaction.enabled === false ? true : false;
        });
      }
      return;
    }
    const deleteTarget = event.target?.closest?.("[data-action='delete-shape']");
    if (deleteTarget) {
      const button = deleteTarget.closest("[data-shape-id]");
      const shapeId = button?.dataset.shapeId;
      if (shapeId && typeof editor.deleteShape === "function") {
        editor.deleteShape(shapeId);
      }
      return;
    }
    const button = event.target?.closest?.("[data-shape-id]");
    if (!button) return;
    const shapeId = button.dataset.shapeId;
    if (!shapeId) return;
    const wasActive = state.activeShapeId === shapeId;
    const shouldFocusName = Boolean(event.target?.closest?.(".shape-label"));
    if (typeof editor.selectShape === "function") {
      editor.selectShape(shapeId);
    }
    if (shouldFocusName) {
      if (wasActive) {
        focusEditorShapeName();
      } else {
        setTimeout(focusEditorShapeName, 60);
      }
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
  addListener(editorShapeMidiSelect, "change", handleEditorShapeMidiChange);
  addListener(editorShapeMidiRefreshButton, "click", refreshMidiPorts);
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

  // Clear shape selection when double-clicking the Map panel chrome (header).
  // Ignores double-clicks on buttons/action areas to prevent accidental clears.
  addListener(mapPanelChrome || mapPanelHandle, 'dblclick', (event) => {
    const isAction = event.target?.closest?.('.panel-actions, button');
    if (isAction) return;
    if (typeof editor.selectShape === 'function') {
      editor.selectShape(null); // Clears editor selection
    }
    state.activeShapeId = null;
    syncEditorDetailForm();
  });

  addListener(editorShapeNameInput, "input", handleEditorShapeNameInput);
  addListener(editorShapeNameInput, "change", normalizeEditorShapeName);
  addListener(editorShapeNameInput, "blur", normalizeEditorShapeName);
  addListener(editorShapeEnabledToggle, "click", () => {
    if (isSyncingEditorForm) return;
    updateSelectedInteraction((interaction) => {
      interaction.enabled = interaction.enabled === false ? true : false;
    });
  });
  addListener(editorShapePreviewToggle, "click", () => {
    if (isSyncingEditorForm) return;
    updateSelectedInteraction((interaction) => {
      interaction.showInPreview = interaction.showInPreview === false ? true : false;
    });
  });
  addListener(editorDeleteShapeButton, "click", handleDeleteShape);
  addListener(editorAddEventButton, "click", handleEditorAddEvent);
  addListener(editorEventList, "click", handleEditorEventListClick);
  addListener(editorEventList, "change", handleEditorEventListInput);
  addListener(editorEventList, "input", handleEditorEventListInput);
  addListener(editorStreamSelect, "change", handleEditorStreamChange);
  addListener(editorLandmarkSelect, "change", handleEditorLandmarkChange);
  // Import/Export listeners
  addListener(snapshotExportButton, "click", handleSnapshotExport);
  addListener(snapshotImportButton, "click", () => {
    importMode = "replace";
    if (snapshotImportInput) snapshotImportInput.click();
  });
  addListener(snapshotAppendButton, "click", () => {
    importMode = "append";
    if (snapshotImportInput) snapshotImportInput.click();
  });
  addListener(snapshotImportInput, "change", handleSnapshotImportFiles);
  addListener(window, "pointermove", handleInputPointerMove, { passive: true });
  addListener(window, "pointerdown", handleInputPointerDown, { passive: true });
  addListener(window, "pointerup", handleInputPointerUp, { passive: true });
  addListener(window, "pointercancel", handleInputPointerCancel);
  addListener(window, "keydown", handleInputKeyDown, true);
  addListener(window, "keyup", handleInputKeyUp, true);
  addListener(window, "mediamime:holistic-results", handleHolisticResults);
  addListener(window, "mediamime:layers-changed", handleLayersChanged);
  addListener(window, "mediamime:editor-mode-changed", handleEditorModeChange);

  if (typeof editor.on === "function") {
    editor.on("selectionchange", handleSelectionChange);
    editor.on("shapealtclick", handleShapeAltClick);
    editor.on("shapeschange", handleShapesChange);
  }

  // Try restoring the last saved score first
  const restored = tryLoadLastScore();
  if (typeof editor.getState === "function" && !restored) {
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
    createDefaultShape(streamId) {
      if (!streamId || typeof editor.addShape !== 'function') return null;
      
      // Create a default rectangle shape with interaction
      const defaultShape = {
        type: 'rect',
        x: 0.3,
        y: 0.3,
        width: 0.4,
        height: 0.4,
        rotation: 0,
        name: 'Default Shape',
        style: {
          stroke: 'rgba(255, 255, 255, 1)',
          fill: 'rgba(255, 255, 255, 0.5)',
          strokeWidth: 2
        },
        interaction: {
          enabled: true,
          showInPreview: true,
          stream: streamId,
          landmark: 'nose',
          events: [
            {
              trigger: 'enter',
              action: 'note',
              channel: 1,
              note: 60, // C60
              velocity: 100,
              duration: null
            },
            {
              trigger: 'exit',
              action: 'note',
              channel: 1,
              note: 60, // C60
              velocity: 100,
              duration: null
            }
          ]
        }
      };
      
      const shapeId = editor.addShape(defaultShape);
      console.log('[mediamime] Created default shape:', shapeId);
      return shapeId;
    },
    dispose() {
      if (editorColorPicker && typeof editorColorPicker.destroy === "function") {
        editorColorPicker.destroy();
      }
      if (assignmentColorPicker && typeof assignmentColorPicker.destroy === "function") {
        assignmentColorPicker.destroy();
      }
      listeners.forEach((remove) => remove());
      if (typeof editor.off === "function") {
        editor.off("selectionchange", handleSelectionChange);
        editor.off("shapealtclick", handleShapeAltClick);
        editor.off("shapeschange", handleShapesChange);
      }
    }
  };
}
