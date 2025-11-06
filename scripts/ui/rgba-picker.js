const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const clampUnit = (value) => clamp(Number.isFinite(value) ? value : Number.parseFloat(`${value}`) || 0, 0, 1);

const clampChannel = (value) => clamp(Math.round(Number.parseFloat(`${value}`) || 0), 0, 255);

const normalizeHex = (value, fallback = "#ffffff") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (hex.length === 3) {
    if (!/^[0-9a-f]{3}$/i.test(hex)) return fallback;
    return `#${hex
      .split("")
      .map((char) => char + char)
      .join("")
      .toLowerCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }
  return fallback;
};

const rgbToHex = (r, g, b) =>
  `#${[r, g, b]
    .map((component) => clampChannel(component).toString(16).padStart(2, "0"))
    .join("")}`;

const hexToRgb = (hex) => {
  const normalized = normalizeHex(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
};

const rgbToHsv = (r, g, b) => {
  const rn = clampChannel(r) / 255;
  const gn = clampChannel(g) / 255;
  const bn = clampChannel(b) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6);
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2);
    } else {
      h = 60 * ((rn - gn) / delta + 4);
    }
  }
  if (h < 0) {
    h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
};

const hsvToRgb = (h, s, v) => {
  const hue = ((h % 360) + 360) % 360;
  const sat = clampUnit(s);
  const val = clampUnit(v);
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  let rn = 0;
  let gn = 0;
  let bn = 0;
  if (hue >= 0 && hue < 60) {
    rn = c;
    gn = x;
  } else if (hue >= 60 && hue < 120) {
    rn = x;
    gn = c;
  } else if (hue >= 120 && hue < 180) {
    gn = c;
    bn = x;
  } else if (hue >= 180 && hue < 240) {
    gn = x;
    bn = c;
  } else if (hue >= 240 && hue < 300) {
    rn = x;
    bn = c;
  } else {
    rn = c;
    bn = x;
  }
  return {
    r: clampChannel((rn + m) * 255),
    g: clampChannel((gn + m) * 255),
    b: clampChannel((bn + m) * 255)
  };
};

const formatAlphaDisplay = (alpha) => {
  if (alpha <= 0) return "0";
  if (alpha >= 1) return "1";
  const rounded = Math.round(alpha * 100) / 100;
  return `${rounded}`.replace(/(?:(\.\d*?)(0+))?$/, (_, decimals) => (decimals ? decimals.replace(/0+$/, "") : ""));
};

const noop = () => {};

export function createRgbaPicker({ root, initialHex = "#ffffff", initialAlpha = 1, onChange = noop } = {}) {
  if (!root) {
    return {
      setColor() {},
      getColor: () => ({ hex: normalizeHex(initialHex), alpha: clampUnit(initialAlpha) }),
      setDisabled() {},
      destroy() {}
    };
  }

  const spectrum = root.querySelector("[data-rgba-spectrum]");
  const spectrumCursor = root.querySelector("[data-rgba-spectrum-cursor]");
  const hueSlider = root.querySelector("[data-rgba-hue]");
  const hueThumb = hueSlider?.querySelector(".rgba-picker-slider-thumb");
  const alphaSlider = root.querySelector("[data-rgba-alpha]");
  const alphaThumb = alphaSlider?.querySelector(".rgba-picker-slider-thumb");
  const outputEl = root.querySelector("[data-rgba-output]");
  const channelInputs = Array.from(root.querySelectorAll("[data-rgba-channel]"));
  const hexInput = root.querySelector("[data-rgba-hex]");

  const state = {
    h: 0,
    s: 0,
    v: 1,
    a: clampUnit(initialAlpha),
    r: 255,
    g: 255,
    b: 255,
    hex: normalizeHex(initialHex)
  };

  let isDisabled = false;
  let isUpdating = false;

  const emitChange = (source = "input") => {
    if (isUpdating || isDisabled || typeof onChange !== "function") return;
    const alpha = clampUnit(state.a);
    const rgba = `rgba(${state.r}, ${state.g}, ${state.b}, ${formatAlphaDisplay(alpha)})`;
    onChange({
      hex: state.hex,
      alpha,
      rgba,
      r: state.r,
      g: state.g,
      b: state.b,
      source
    });
  };

  const updateCssVariables = () => {
    const alpha = clampUnit(state.a);
    const rgba = `rgba(${state.r}, ${state.g}, ${state.b}, ${formatAlphaDisplay(alpha)})`;
    const rgbUnit = `rgb(${state.r}, ${state.g}, ${state.b})`;
    root.style.setProperty("--rgba-color", rgba);
    root.style.setProperty("--rgba-thumb-color", rgbUnit);
    root.style.setProperty("--rgba-hue", `${state.h.toFixed(2)}`);
    root.style.setProperty("--rgba-r", `${state.r}`);
    root.style.setProperty("--rgba-g", `${state.g}`);
    root.style.setProperty("--rgba-b", `${state.b}`);
  };

  const updatePreview = () => {
    if (!outputEl) return;
    const alpha = clampUnit(state.a);
    outputEl.textContent = `rgba(${state.r}, ${state.g}, ${state.b}, ${formatAlphaDisplay(alpha)})`;
  };

  const updateInputs = () => {
    channelInputs.forEach((input) => {
      const channel = input.dataset.rgbaChannel;
      if (!channel) return;
      if (channel === "r") {
        input.value = `${state.r}`;
      } else if (channel === "g") {
        input.value = `${state.g}`;
      } else if (channel === "b") {
        input.value = `${state.b}`;
      } else if (channel === "a") {
        input.value = `${Math.round(clampUnit(state.a) * 100)}`;
      }
    });
    if (hexInput) {
      hexInput.value = state.hex;
    }
  };

  const updateGeometry = () => {
    if (spectrumCursor) {
      spectrumCursor.style.left = `${clampUnit(state.s) * 100}%`;
      spectrumCursor.style.top = `${(1 - clampUnit(state.v)) * 100}%`;
    }
    if (hueSlider) {
      const ratio = 1 - (state.h % 360) / 360;
      hueSlider.style.setProperty("--thumb-y", `${clampUnit(ratio) * 100}%`);
      hueSlider.setAttribute("aria-valuenow", `${Math.round(state.h)}`);
    }
    if (alphaSlider) {
      const ratio = 1 - clampUnit(state.a);
      alphaSlider.style.setProperty("--thumb-y", `${clampUnit(ratio) * 100}%`);
      alphaSlider.setAttribute("aria-valuenow", `${Math.round(clampUnit(state.a) * 100)}`);
    }
  };

  const applyState = ({ emit = false, source = "input" } = {}) => {
    isUpdating = true;
    const { r, g, b } = hsvToRgb(state.h, state.s, state.v);
    state.r = r;
    state.g = g;
    state.b = b;
    state.hex = rgbToHex(r, g, b);
    updateCssVariables();
    updatePreview();
    updateInputs();
    updateGeometry();
    isUpdating = false;
    if (emit) {
      emitChange(source);
    }
  };

  const updateFromRgb = (r, g, b, options = {}) => {
    const rr = clampChannel(r);
    const gg = clampChannel(g);
    const bb = clampChannel(b);
    const { h, s, v } = rgbToHsv(rr, gg, bb);
    state.h = h;
    state.s = s;
    state.v = v;
    state.r = rr;
    state.g = gg;
    state.b = bb;
    state.hex = rgbToHex(rr, gg, bb);
    applyState(options);
  };

  const updateFromHsv = (h, s, v, options = {}) => {
    state.h = ((Number.isFinite(h) ? h : state.h) % 360 + 360) % 360;
    state.s = clampUnit(Number.isFinite(s) ? s : state.s);
    state.v = clampUnit(Number.isFinite(v) ? v : state.v);
    applyState(options);
  };

  const setAlpha = (alpha, options = {}) => {
    const normalized = clampUnit(alpha);
    if (normalized === state.a) return;
    state.a = normalized;
    applyState({ ...options });
  };

  const handleChannelInput = (event) => {
    if (isDisabled) return;
    const input = event.target;
    if (!input || !input.dataset || !input.dataset.rgbaChannel) return;
    const { rgbaChannel } = input.dataset;
    if (rgbaChannel === "a") {
      const fraction = clampUnit(Number.parseFloat(input.value) / 100);
      if (!Number.isFinite(fraction)) return;
      state.a = fraction;
      applyState({ emit: true, source: "input" });
      return;
    }
    const value = clampChannel(input.value);
    if (!Number.isFinite(value)) return;
    if (rgbaChannel === "r") {
      updateFromRgb(value, state.g, state.b, { emit: true, source: "input" });
    } else if (rgbaChannel === "g") {
      updateFromRgb(state.r, value, state.b, { emit: true, source: "input" });
    } else if (rgbaChannel === "b") {
      updateFromRgb(state.r, state.g, value, { emit: true, source: "input" });
    }
  };

  const handleChannelBlur = (event) => {
    if (isDisabled) return;
    const input = event.target;
    if (!input || !input.dataset || !input.dataset.rgbaChannel) return;
    if (input.dataset.rgbaChannel === "a") {
      input.value = `${Math.round(clampUnit(state.a) * 100)}`;
    } else if (input.dataset.rgbaChannel === "r") {
      input.value = `${state.r}`;
    } else if (input.dataset.rgbaChannel === "g") {
      input.value = `${state.g}`;
    } else if (input.dataset.rgbaChannel === "b") {
      input.value = `${state.b}`;
    }
  };

  const parseHexInput = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().replace(/^#/, "");
    if (trimmed.length === 3 || trimmed.length === 6) {
      const normalized = normalizeHex(trimmed);
      return hexToRgb(normalized);
    }
    return null;
  };

  const handleHexInput = (event) => {
    if (isDisabled) return;
    const value = event.target?.value;
    const rgb = parseHexInput(value);
    if (!rgb) return;
    updateFromRgb(rgb.r, rgb.g, rgb.b, { emit: true, source: "input" });
  };

  const handleHexBlur = () => {
    if (hexInput) {
      hexInput.value = state.hex;
    }
  };

  let activePointer = null;

  const getRelativePosition = (target, event) => {
    const rect = target.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    return { x, y };
  };

  const handleSpectrumPointer = (event) => {
    if (isDisabled) return;
    if (!spectrum) return;
    if (event.type === "pointerdown") {
      spectrum.setPointerCapture(event.pointerId);
      activePointer = { id: event.pointerId, target: spectrum, type: "spectrum" };
    }
    if (!activePointer || activePointer.type !== "spectrum") return;
    const { x, y } = getRelativePosition(spectrum, event);
    state.s = x;
    state.v = 1 - y;
    const isCommit = event.type === "pointerup" || event.type === "pointercancel";
    updateFromHsv(state.h, state.s, state.v, { emit: true, source: isCommit ? "change" : "input" });
    if (event.type === "pointerup" || event.type === "pointercancel") {
      spectrum.releasePointerCapture(event.pointerId);
      activePointer = null;
    }
  };

  const handleHuePointer = (event) => {
    if (isDisabled) return;
    if (!hueSlider) return;
    if (event.type === "pointerdown") {
      hueSlider.setPointerCapture(event.pointerId);
      activePointer = { id: event.pointerId, target: hueSlider, type: "hue" };
    }
    if (!activePointer || activePointer.type !== "hue") return;
    const { y } = getRelativePosition(hueSlider, event);
    // Map from bottom (0°) to top (360°) to match gradient
    state.h = (1 - y) * 360;
    const isCommit = event.type === "pointerup" || event.type === "pointercancel";
    updateFromHsv(state.h, state.s, state.v, { emit: true, source: isCommit ? "change" : "input" });
    if (event.type === "pointerup" || event.type === "pointercancel") {
      hueSlider.releasePointerCapture(event.pointerId);
      activePointer = null;
    }
  };

  const handleAlphaPointer = (event) => {
    if (isDisabled) return;
    if (!alphaSlider) return;
    if (event.type === "pointerdown") {
      alphaSlider.setPointerCapture(event.pointerId);
      activePointer = { id: event.pointerId, target: alphaSlider, type: "alpha" };
    }
    if (!activePointer || activePointer.type !== "alpha") return;
    const { y } = getRelativePosition(alphaSlider, event);
    state.a = 1 - y;
    const isCommit = event.type === "pointerup" || event.type === "pointercancel";
    applyState({ emit: true, source: isCommit ? "change" : "input" });
    if (event.type === "pointerup" || event.type === "pointercancel") {
      alphaSlider.releasePointerCapture(event.pointerId);
      activePointer = null;
    }
  };

  const removeListeners = [];

  const add = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    removeListeners.push(() => target.removeEventListener(type, handler, options));
  };

  channelInputs.forEach((input) => {
    add(input, "input", handleChannelInput);
    add(input, "change", handleChannelInput);
    add(input, "blur", handleChannelBlur);
  });
  if (hexInput) {
    add(hexInput, "input", handleHexInput);
    add(hexInput, "change", handleHexInput);
    add(hexInput, "blur", handleHexBlur);
  }
  if (spectrum) {
    add(spectrum, "pointerdown", handleSpectrumPointer);
    add(spectrum, "pointermove", handleSpectrumPointer);
    add(spectrum, "pointerup", handleSpectrumPointer);
    add(spectrum, "pointercancel", handleSpectrumPointer);
  }
  if (hueSlider) {
    add(hueSlider, "pointerdown", handleHuePointer);
    add(hueSlider, "pointermove", handleHuePointer);
    add(hueSlider, "pointerup", handleHuePointer);
    add(hueSlider, "pointercancel", handleHuePointer);
    hueSlider.setAttribute("role", "slider");
    hueSlider.setAttribute("aria-valuemin", "0");
    hueSlider.setAttribute("aria-valuemax", "360");
  }
  if (hueThumb) {
    hueThumb.setAttribute("aria-hidden", "true");
  }
  if (alphaSlider) {
    add(alphaSlider, "pointerdown", handleAlphaPointer);
    add(alphaSlider, "pointermove", handleAlphaPointer);
    add(alphaSlider, "pointerup", handleAlphaPointer);
    add(alphaSlider, "pointercancel", handleAlphaPointer);
    alphaSlider.setAttribute("role", "slider");
    alphaSlider.setAttribute("aria-valuemin", "0");
    alphaSlider.setAttribute("aria-valuemax", "100");
  }
  if (alphaThumb) {
    alphaThumb.setAttribute("aria-hidden", "true");
  }

  const setColor = (hex, alpha = state.a, options = {}) => {
    const normalizedHex = normalizeHex(hex, state.hex);
    const { r, g, b } = hexToRgb(normalizedHex);
    state.a = clampUnit(alpha);
    updateFromRgb(r, g, b, options);
  };

  const setDisabled = (disabled) => {
    isDisabled = Boolean(disabled);
    root.classList.toggle("is-disabled", isDisabled);
    if (isDisabled) {
      root.setAttribute("aria-disabled", "true");
    } else {
      root.removeAttribute("aria-disabled");
    }
    channelInputs.forEach((input) => {
      input.disabled = isDisabled;
    });
    if (hexInput) {
      hexInput.disabled = isDisabled;
    }
  };

  setColor(state.hex, state.a, { emit: false, source: "program" });

  return {
    setColor(hex, alpha, options = {}) {
      setColor(hex, alpha, options);
    },
    getColor() {
      return {
        hex: state.hex,
        alpha: clampUnit(state.a),
        r: state.r,
        g: state.g,
        b: state.b,
        rgba: `rgba(${state.r}, ${state.g}, ${state.b}, ${formatAlphaDisplay(clampUnit(state.a))})`
      };
    },
    setDisabled,
    destroy() {
      removeListeners.forEach((remove) => remove());
      removeListeners.length = 0;
    }
  };
}
