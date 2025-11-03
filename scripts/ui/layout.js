const MODAL_LAYOUT_KEY = "mediamime:modal-layout";
const DEFAULT_MODAL_POSITIONS = {
  input: { top: 16, align: "right" },
  layers: { top: 176, align: "right" },
  preview: { top: 336, align: "right" },
  map: { top: 496, align: "right" }
};
const MODAL_MARGIN = 0;
const RESIZE_MARGIN = 12;

const modalShortcutMap = new Map([
  ["i", "input"],
  ["p", "preview"],
  ["l", "layers"],
  ["m", "map"]
]);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const detectResizeDirection = (x, y, rect, margin) => {
  if (!rect) return "";
  const left = rect.left;
  const right = rect.right;
  const top = rect.top;
  const bottom = rect.bottom;
  const nearLeft = Math.abs(x - left) <= margin;
  const nearRight = Math.abs(x - right) <= margin;
  const nearTop = Math.abs(y - top) <= margin;
  const nearBottom = Math.abs(y - bottom) <= margin;
  if ((nearLeft && nearTop) || (nearRight && nearBottom)) {
    return nearLeft ? "nw" : "se";
  }
  if ((nearRight && nearTop) || (nearLeft && nearBottom)) {
    return nearRight ? "ne" : "sw";
  }
  if (nearLeft) return "w";
  if (nearRight) return "e";
  if (nearTop) return "n";
  if (nearBottom) return "s";
  return "";
};

const cursorForDirection = (direction) => {
  switch (direction) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    default:
      return "";
  }
};

const loadModalLayout = () => {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(MODAL_LAYOUT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("[mediamime] Failed to load modal layout", error);
    return {};
  }
};

const persistModalLayout = (layout) => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(MODAL_LAYOUT_KEY, JSON.stringify(layout));
  } catch (error) {
    console.warn("[mediamime] Failed to persist modal layout", error);
  }
};

export function initLayout() {
  const modals = Array.from(document.querySelectorAll(".floating-modal[data-modal]"));
  if (!modals.length) {
    return {
      dispose: () => {}
    };
  }

  const modalLayout = loadModalLayout();
  const modalState = new Map();
  let modalZIndexSeed = 500;
  let lastActiveModalId = null;

  const updateModalLayout = (id, changes = {}) => {
    if (!id) return;
    const current = modalLayout[id] || {};
    modalLayout[id] = { ...current, ...changes };
    persistModalLayout(modalLayout);
  };

  const bringModalToFront = (modal) => {
    if (!modal) return;
    modalZIndexSeed += 1;
    modal.style.zIndex = String(modalZIndexSeed);
    lastActiveModalId = modal.dataset.modal || null;
  };

  const getModalById = (id) => modals.find((modal) => modal.dataset.modal === id);

  const isModalVisible = (id) => Boolean(modalState.get(id));

  const ensureModalInViewport = (modal) => {
    if (!modal) return;
    let rect = modal.getBoundingClientRect();
    if (modal.dataset.resizable === "true") {
      const maxWidth = Math.max(240, window.innerWidth - 32);
      const maxHeight = Math.max(200, window.innerHeight - 32);
      if (rect.width > maxWidth) {
        modal.style.width = `${maxWidth}px`;
        rect = modal.getBoundingClientRect();
      }
      if (rect.height > maxHeight) {
        modal.style.height = `${maxHeight}px`;
        rect = modal.getBoundingClientRect();
      }
    }
    const maxLeft = Math.max(MODAL_MARGIN, window.innerWidth - rect.width - MODAL_MARGIN);
    const maxTop = Math.max(MODAL_MARGIN, window.innerHeight - rect.height - MODAL_MARGIN);
    modal.style.left = `${clamp(rect.left, MODAL_MARGIN, maxLeft)}px`;
    modal.style.top = `${clamp(rect.top, MODAL_MARGIN, maxTop)}px`;
    modal.style.right = "auto";
    modal.style.bottom = "auto";
  };

  const initializeModalPosition = (modal) => {
    const id = modal.dataset.modal;
    if (!id) return;
    modal.style.right = "auto";
    modal.style.bottom = "auto";
    const saved = modalLayout[id] || {};
    if (modal.dataset.resizable === "true") {
      if (Number.isFinite(saved.width)) {
        modal.style.width = `${saved.width}px`;
      }
      if (Number.isFinite(saved.height)) {
        modal.style.height = `${saved.height}px`;
      }
    }
    if (Number.isFinite(saved.left)) {
      modal.style.left = `${saved.left}px`;
    }
    if (Number.isFinite(saved.top)) {
      modal.style.top = `${saved.top}px`;
    }
    const rect = modal.getBoundingClientRect();
    const defaults = DEFAULT_MODAL_POSITIONS[id];
    if (!Number.isFinite(saved.top) && defaults?.top !== undefined) {
      modal.style.top = `${defaults.top}px`;
    }
    if (!Number.isFinite(saved.left)) {
      if (defaults?.align === "right") {
        const alignedLeft = Math.max(MODAL_MARGIN, window.innerWidth - rect.width - MODAL_MARGIN);
        modal.style.left = `${alignedLeft}px`;
      } else {
        modal.style.left = `${defaults?.left ?? MODAL_MARGIN}px`;
      }
    }
    ensureModalInViewport(modal);
  };

  const attachModalDrag = (modal) => {
    const handle = modal.querySelector("[data-modal-handle]");
    if (!handle) return;
    let dragContext = null;
    const finalize = () => {
      if (!dragContext) return;
      modal.releasePointerCapture(dragContext.pointerId);
      updateModalLayout(modal.dataset.modal, {
        left: dragContext.lastLeft,
        top: dragContext.lastTop
      });
      dragContext = null;
    };
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      bringModalToFront(modal);
      const rect = modal.getBoundingClientRect();
      dragContext = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        lastLeft: rect.left,
        lastTop: rect.top
      };
      modal.style.right = "auto";
      modal.style.bottom = "auto";
      modal.setPointerCapture(event.pointerId);
      modal.addEventListener("pointermove", handleMove);
      modal.addEventListener("pointerup", () => finalize(), { once: true });
      modal.addEventListener("lostpointercapture", finalize, { once: true });
    });
    const handleMove = (event) => {
      if (!dragContext || event.pointerId !== dragContext.pointerId) return;
      const left = clamp(event.clientX - dragContext.offsetX, MODAL_MARGIN, window.innerWidth - modal.offsetWidth - MODAL_MARGIN);
      const top = clamp(event.clientY - dragContext.offsetY, MODAL_MARGIN, window.innerHeight - modal.offsetHeight - MODAL_MARGIN);
      modal.style.left = `${left}px`;
      modal.style.top = `${top}px`;
      dragContext.lastLeft = left;
      dragContext.lastTop = top;
    };
  };

  const attachModalResize = (modal) => {
    if (modal.dataset.resizable !== "true") return;
    let resizeContext = null;
    let direction = "";

    const finalize = () => {
      if (!resizeContext) return;
      modal.releasePointerCapture(resizeContext.pointerId);
      updateModalLayout(modal.dataset.modal, {
        left: resizeContext.lastLeft,
        top: resizeContext.lastTop,
        width: resizeContext.lastWidth,
        height: resizeContext.lastHeight
      });
      resizeContext = null;
      direction = "";
      modal.style.cursor = "";
    };

    const handleMove = (event) => {
      if (!resizeContext || event.pointerId !== resizeContext.pointerId) return;
      const deltaX = event.clientX - resizeContext.startX;
      const deltaY = event.clientY - resizeContext.startY;
      let nextWidth = resizeContext.startWidth;
      let nextHeight = resizeContext.startHeight;
      let nextLeft = resizeContext.startLeft;
      let nextTop = resizeContext.startTop;
      const minWidth = 220;
      const minHeight = 160;
      const maxWidth = Math.max(minWidth, window.innerWidth - 32);
      const maxHeight = Math.max(minHeight, window.innerHeight - 32);

      if (direction.includes("e")) {
        nextWidth = clamp(resizeContext.startWidth + deltaX, minWidth, maxWidth);
      }
      if (direction.includes("s")) {
        nextHeight = clamp(resizeContext.startHeight + deltaY, minHeight, maxHeight);
      }
      if (direction.includes("w")) {
        const proposed = clamp(resizeContext.startWidth - deltaX, minWidth, maxWidth);
        const deltaWidth = resizeContext.startWidth - proposed;
        nextWidth = proposed;
        nextLeft = clamp(resizeContext.startLeft + deltaWidth, MODAL_MARGIN, window.innerWidth - nextWidth - MODAL_MARGIN);
      }
      if (direction.includes("n")) {
        const proposed = clamp(resizeContext.startHeight - deltaY, minHeight, maxHeight);
        const deltaHeight = resizeContext.startHeight - proposed;
        nextHeight = proposed;
        nextTop = clamp(resizeContext.startTop + deltaHeight, MODAL_MARGIN, window.innerHeight - nextHeight - MODAL_MARGIN);
      }

      modal.style.width = `${nextWidth}px`;
      modal.style.height = `${nextHeight}px`;
      modal.style.left = `${nextLeft}px`;
      modal.style.top = `${nextTop}px`;

      resizeContext.lastWidth = nextWidth;
      resizeContext.lastHeight = nextHeight;
      resizeContext.lastLeft = nextLeft;
      resizeContext.lastTop = nextTop;
    };

    modal.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest("[data-modal-handle]")) return;
      if (event.target.closest(".panel-actions")) return;
      const rect = modal.getBoundingClientRect();
      const detected = detectResizeDirection(event.clientX, event.clientY, rect, RESIZE_MARGIN);
      if (!detected) return;
      direction = detected;
      event.preventDefault();
      bringModalToFront(modal);
      modal.style.right = "auto";
      modal.style.bottom = "auto";
      resizeContext = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: rect.left,
        startTop: rect.top,
        lastWidth: rect.width,
        lastHeight: rect.height,
        lastLeft: rect.left,
        lastTop: rect.top
      };
      modal.style.cursor = cursorForDirection(direction) || "";
      modal.setPointerCapture(event.pointerId);
      modal.addEventListener("pointermove", handleMove);
      modal.addEventListener("pointerup", () => finalize(), { once: true });
      modal.addEventListener("lostpointercapture", finalize, { once: true });
    });

    modal.addEventListener("mousemove", (event) => {
      if (resizeContext) return;
      const rect = modal.getBoundingClientRect();
      const detected = detectResizeDirection(event.clientX, event.clientY, rect, RESIZE_MARGIN);
      modal.style.cursor = cursorForDirection(detected) || "";
    });

    modal.addEventListener("mouseleave", () => {
      if (!resizeContext) {
        modal.style.cursor = "";
      }
    });
  };

  const applyModalVisibility = (modal, open) => {
    modal.classList.toggle("is-open", open);
    modal.classList.toggle("is-visible", open);
    modal.classList.toggle("is-hidden", !open);
    modal.setAttribute("aria-hidden", open ? "false" : "true");
  };

  const setModalVisibility = (id, open, { skipFocus = false } = {}) => {
    const modal = getModalById(id);
    if (!modal) return;
    modalState.set(id, open);
    applyModalVisibility(modal, open);
    updateModalLayout(id, { open });
    if (open) {
      bringModalToFront(modal);
      if (!skipFocus) {
        const focusTarget = modal.querySelector("[data-modal-handle]") || modal;
        focusTarget?.focus?.({ preventScroll: true });
      }
    }
  };

  const toggleModal = (id, options) => {
    setModalVisibility(id, !isModalVisible(id), options);
  };

  modals.forEach((modal) => {
    initializeModalPosition(modal);
    const id = modal.dataset.modal;
    const saved = modalLayout[id] || {};
    const open = saved.open ?? !modal.classList.contains("is-hidden");
    modalState.set(id, open);
    applyModalVisibility(modal, open);
    if (open) {
      bringModalToFront(modal);
    }
    modal.addEventListener("pointerdown", () => bringModalToFront(modal));
    attachModalDrag(modal);
    attachModalResize(modal);
  });

  document.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.modalClose;
      if (target) {
        setModalVisibility(target, false, { skipFocus: true });
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
      const key = event.key?.toLowerCase();
      const targetModal = modalShortcutMap.get(key);
      if (targetModal) {
        event.preventDefault();
        toggleModal(targetModal);
      }
    }
    if (event.key === "Escape" && lastActiveModalId && isModalVisible(lastActiveModalId)) {
      event.preventDefault();
      setModalVisibility(lastActiveModalId, false, { skipFocus: true });
    }
  });

  const resizeListener = () => {
    modals.forEach((modal) => {
      ensureModalInViewport(modal);
      const updates = {};
      const leftValue = Number.parseFloat(modal.style.left);
      const topValue = Number.parseFloat(modal.style.top);
      if (Number.isFinite(leftValue)) updates.left = leftValue;
      if (Number.isFinite(topValue)) updates.top = topValue;
      if (modal.dataset.resizable === "true") {
        const widthValue = Number.parseFloat(modal.style.width);
        const heightValue = Number.parseFloat(modal.style.height);
        if (Number.isFinite(widthValue)) updates.width = widthValue;
        if (Number.isFinite(heightValue)) updates.height = heightValue;
      }
      if (Object.keys(updates).length) {
        updateModalLayout(modal.dataset.modal, updates);
      }
    });
  };

  window.addEventListener("resize", resizeListener);

  return {
    setModalVisibility,
    toggleModal,
    dispose() {
      window.removeEventListener("resize", resizeListener);
    }
  };
}
