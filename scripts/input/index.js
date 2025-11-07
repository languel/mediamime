/**
 * Input Layer System
 * Manages multiple camera and video inputs – now only crop & flip metadata.
 */

const createId = () => `input-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_CROP = { x: 0, y: 0, w: 1, h: 1 };
const DEFAULT_FLIP = { horizontal: false, vertical: false };

export function initInput({ editor }) {
  console.log('[mediamime] Initializing Input layer system');

  // UI Elements
  const inputList = document.getElementById('input-source-list');
  const inputEmpty = document.getElementById('input-empty');
  const inputDetail = document.getElementById('input-detail');
  const addCameraButton = document.getElementById('input-add-camera');
  const addVideoButton = document.getElementById('input-add-video');
  
  // Detail form elements
  const inputSourceName = document.getElementById('input-source-name');
  const inputSourceType = document.getElementById('input-source-type');
  const inputPreviewVideo = document.getElementById('input-preview-video');
  const inputPreviewCanvas = document.getElementById('input-preview-canvas');
  const previewCtx = inputPreviewCanvas ? inputPreviewCanvas.getContext('2d') : null;
  const previewWrapper = document.querySelector('#input-detail .input-preview-wrapper');
  const cropX = document.getElementById('input-crop-x');
  const cropY = document.getElementById('input-crop-y');
  const cropW = document.getElementById('input-crop-w');
  const cropH = document.getElementById('input-crop-h');
  const flipH = document.getElementById('input-flip-horizontal');
  const flipV = document.getElementById('input-flip-vertical');
  const deleteSourceButton = document.getElementById('input-delete-source');

  // State
  const state = {
    inputs: [], // Array of {id, name, type, stream, crop:{x,y,w,h}, flip:{horizontal,vertical}}
    activeInputId: null,
    isSyncing: false
  };

  const ACTIVE_INPUT_EVENT = 'mediamime:active-input-changed';
  const INPUT_LIST_EVENT = 'mediamime:input-list-changed';
  let previewFrameHandle = null;
  let previewLoopRunning = false;
  let pendingPreviewResize = false;
  let previewResizeObserver = null;

  const dispatchInputEvent = (type, detail) => {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent(type, { detail }));
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (match) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[match]));

  const serializeInput = (input) => {
    if (!input) return null;
    return {
      id: input.id,
      name: input.name,
      type: input.type,
      stream: input.stream,
      crop: { ...input.crop },
      flip: { ...input.flip }
    };
  };

  // Helper: Generate input name
  const generateInputName = (type) => {
    const count = state.inputs.filter(i => i.type === type).length + 1;
    return type === 'camera' ? `Camera ${count}` : `Video ${count}`;
  };

  // Helper: Update UI
  const updateUI = () => {
    if (state.inputs.length === 0) {
      inputEmpty.style.display = 'block';
      inputDetail.style.display = 'none';
      inputList.innerHTML = '';
      dispatchInputEvent(INPUT_LIST_EVENT, { inputs: [] });
      dispatchInputEvent(ACTIVE_INPUT_EVENT, { input: null });
      return;
    }

    inputEmpty.style.display = 'none';

    // Render input list
    inputList.innerHTML = state.inputs.map(input => {
      const isActive = input.id === state.activeInputId;
      const icon = input.type === 'camera' ? 'videocam' : 'movie';
      const safeName = escapeHtml(input.name);
      return `
        <button
          data-input-id="${input.id}"
          class="${isActive ? 'is-active' : ''}"
          title="${safeName}">
          <span class="input-label">
            <span class="material-icons-outlined">${icon}</span>
            <span class="input-label-text">${safeName}</span>
          </span>
          <span class="input-meta" aria-hidden="true"></span>
          <span class="input-actions">
            <span class="input-source-delete-btn" role="button" tabindex="0" data-action="delete-input" data-input-id="${input.id}" title="Delete source" aria-label="Delete source">
              <span class="material-icons-outlined" aria-hidden="true">delete</span>
            </span>
          </span>
        </button>
      `;
    }).join('');

    // Update detail panel
    let activeInput = null;
    if (state.activeInputId) {
      activeInput = state.inputs.find(i => i.id === state.activeInputId) || null;
      if (activeInput) {
        inputDetail.style.display = 'flex';
        syncDetailForm(activeInput);
        queuePreviewResize();
      }
    } else {
      inputDetail.style.display = 'none';
    }

    dispatchInputEvent(INPUT_LIST_EVENT, {
      inputs: state.inputs.map((input) => serializeInput(input))
    });
    dispatchInputEvent(ACTIVE_INPUT_EVENT, {
      input: serializeInput(activeInput)
    });
  };

  // Helper: Sync detail form with active input
  const syncDetailForm = (input) => {
    if (state.isSyncing) return;
    state.isSyncing = true;

    inputSourceName.value = input.name || '';
    inputSourceType.textContent = input.type === 'camera' ? 'Camera' : 'Video';
  if (cropX) cropX.value = input.crop.x.toFixed(2);
  if (cropY) cropY.value = input.crop.y.toFixed(2);
  if (cropW) cropW.value = input.crop.w.toFixed(2);
  if (cropH) cropH.value = input.crop.h.toFixed(2);
  if (flipH) flipH.checked = !!input.flip.horizontal;
  if (flipV) flipV.checked = !!input.flip.vertical;

    // Update preview if stream exists
    if (input.stream && inputPreviewVideo) {
      if (inputPreviewVideo.srcObject !== input.stream) {
        inputPreviewVideo.srcObject = input.stream;
      }
      // Ensure playback for drawImage
      inputPreviewVideo.play().catch(() => {});
    }

    // Reflect flips by applying CSS transform to both video and canvas overlay
    const scaleX = input.flip?.horizontal ? -1 : 1;
    const scaleY = input.flip?.vertical ? -1 : 1;
    const transform = `scale(${scaleX}, ${scaleY})`;
    if (inputPreviewVideo) inputPreviewVideo.style.transform = transform;
    if (inputPreviewCanvas) inputPreviewCanvas.style.transform = transform;

    state.isSyncing = false;
  };

  // Add camera input
  const addCameraInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false
      });

      const input = {
        id: createId(),
        name: generateInputName('camera'),
        type: 'camera',
        stream,
        crop: { ...DEFAULT_CROP },
        flip: { ...DEFAULT_FLIP }
      };

      state.inputs.push(input);
      state.activeInputId = input.id;
      updateUI();
      console.log('[mediamime] Added camera input:', input.name);
    } catch (error) {
      console.error('[mediamime] Failed to add camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  };

  // Add video input
  const addVideoInput = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*';
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.autoplay = true;
      video.loop = true;
      video.muted = true;

      await video.play();

      // Capture stream from video element
      const stream = video.captureStream();

      const input = {
        id: createId(),
        name: file.name.replace(/\.[^/.]+$/, '') || generateInputName('video'),
        type: 'video',
        stream,
        videoElement: video, // Keep reference to video element
        crop: { ...DEFAULT_CROP },
        flip: { ...DEFAULT_FLIP }
      };

      state.inputs.push(input);
      state.activeInputId = input.id;
      updateUI();
      console.log('[mediamime] Added video input:', input.name);
    };
    fileInput.click();
  };

  // Delete input
  const deleteInput = () => {
    if (!state.activeInputId) return;

    const index = state.inputs.findIndex(i => i.id === state.activeInputId);
    if (index === -1) return;

    const input = state.inputs[index];

    // Stop stream
    if (input.stream) {
      input.stream.getTracks().forEach(track => track.stop());
    }

    // Cleanup video element
    if (input.videoElement) {
      input.videoElement.pause();
      input.videoElement.src = '';
    }

    state.inputs.splice(index, 1);

    // Select next or previous input
    if (state.inputs.length > 0) {
      const nextIndex = Math.min(index, state.inputs.length - 1);
      state.activeInputId = state.inputs[nextIndex].id;
    } else {
      state.activeInputId = null;
    }

    updateUI();
    console.log('[mediamime] Deleted input');
  };

  // Update input transform
  const updateInputMeta = (inputId, patch) => {
    const input = state.inputs.find(i => i.id === inputId);
    if (!input) return;
    if (patch.crop) Object.assign(input.crop, patch.crop);
    if (patch.flip) Object.assign(input.flip, patch.flip);
    updateUI();
    // TODO: Emit event for rendering layer
  };

  // Event Listeners
  if (addCameraButton) {
    addCameraButton.addEventListener('click', addCameraInput);
  }

  if (addVideoButton) {
    addVideoButton.addEventListener('click', addVideoInput);
  }

  if (inputList) {
    inputList.addEventListener('click', (e) => {
      const del = e.target.closest('[data-action="delete-input"]');
      if (del) {
        e.stopPropagation();
        const id = del.dataset.inputId;
        if (!id) return;
        // Set active to the one being deleted to reuse deleteInput
        state.activeInputId = id;
        deleteInput();
        return;
      }
      const button = e.target.closest('[data-input-id]');
      if (!button) return;
      state.activeInputId = button.dataset.inputId;
      updateUI();
    });
  }

  if (deleteSourceButton) {
    deleteSourceButton.addEventListener('click', deleteInput);
  }

  // Transform input handlers
  if (inputSourceName) {
    inputSourceName.addEventListener('input', (e) => {
      if (!state.activeInputId || state.isSyncing) return;
      const input = state.inputs.find(i => i.id === state.activeInputId);
      if (input) {
        input.name = e.target.value;
        updateUI();
      }
    });
  }

  const createCropHandler = (key) => (e) => {
    if (!state.activeInputId || state.isSyncing) return;
    const value = parseFloat(e.target.value);
    if (!isFinite(value)) return;
    updateInputMeta(state.activeInputId, { crop: { [key]: Math.min(1, Math.max(0, value)) } });
  };
  if (cropX) cropX.addEventListener('input', createCropHandler('x'));
  if (cropY) cropY.addEventListener('input', createCropHandler('y'));
  if (cropW) cropW.addEventListener('input', createCropHandler('w'));
  if (cropH) cropH.addEventListener('input', createCropHandler('h'));
  if (flipH) flipH.addEventListener('change', (e) => {
    if (!state.activeInputId || state.isSyncing) return;
    updateInputMeta(state.activeInputId, { flip: { horizontal: e.target.checked } });
  });
  if (flipV) flipV.addEventListener('change', (e) => {
    if (!state.activeInputId || state.isSyncing) return;
    updateInputMeta(state.activeInputId, { flip: { vertical: e.target.checked } });
  });

  // Preview render loop
  const queuePreviewResize = () => {
    if (pendingPreviewResize) return;
    pendingPreviewResize = true;
    requestAnimationFrame(() => {
      pendingPreviewResize = false;
      resizePreview();
    });
  };

  const resizePreview = () => {
    if (!inputPreviewCanvas) return;
    let rect = inputPreviewCanvas.getBoundingClientRect();
    if ((!rect.width || !rect.height) && previewWrapper) {
      rect = previewWrapper.getBoundingClientRect();
    }
    const width = rect.width || 0;
    const height = rect.height || 0;
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.floor(width * dpr));
    const nextHeight = Math.max(1, Math.floor(height * dpr));
    if (inputPreviewCanvas.width !== nextWidth || inputPreviewCanvas.height !== nextHeight) {
      inputPreviewCanvas.width = nextWidth;
      inputPreviewCanvas.height = nextHeight;
    }
  };
  const renderPreview = () => {
    if (!previewCtx || !inputPreviewCanvas) return;
    const active = state.inputs.find(i => i.id === state.activeInputId);
    const video = inputPreviewVideo;
    const w = inputPreviewCanvas.width;
    const h = inputPreviewCanvas.height;
    if (!w || !h) {
      queuePreviewResize();
      return;
    }
    previewCtx.clearRect(0, 0, w, h);
    if (!active || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      // Draw placeholder if no video
      previewCtx.save();
      previewCtx.fillStyle = '#05070d';
      previewCtx.fillRect(0, 0, w, h);
      previewCtx.restore();
      return;
    }
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(w / vw, h / vh);
    const drawW = vw * scale;
    const drawH = vh * scale;
    const offsetX = (w - drawW) / 2;
    const offsetY = (h - drawH) / 2;
    previewCtx.save();
    previewCtx.imageSmoothingEnabled = true;
    previewCtx.drawImage(video, offsetX, offsetY, drawW, drawH);
    previewCtx.restore();
    // Draw crop rectangle overlay (no fill)
    const cropX = Math.max(0, Math.min(1, active.crop.x));
    const cropY = Math.max(0, Math.min(1, active.crop.y));
    const cropW = Math.max(0.01, Math.min(1 - cropX, active.crop.w));
    const cropH = Math.max(0.01, Math.min(1 - cropY, active.crop.h));
    const rectX = offsetX + cropX * drawW;
    const rectY = offsetY + cropY * drawH;
    const rectW = cropW * drawW;
    const rectH = cropH * drawH;
    previewCtx.save();
    previewCtx.strokeStyle = '#00e0ff';
    previewCtx.lineWidth = Math.max(1, 2 * (window.devicePixelRatio || 1));
    previewCtx.setLineDash([10, 6]);
    previewCtx.strokeRect(rectX, rectY, rectW, rectH);
    previewCtx.restore();
  };

  const previewLoop = () => {
    if (!previewLoopRunning) return;
    renderPreview();
    previewFrameHandle = requestAnimationFrame(previewLoop);
  };

  const startPreviewLoop = () => {
    if (previewLoopRunning) return;
    previewLoopRunning = true;
    previewFrameHandle = requestAnimationFrame(previewLoop);
  };

  const stopPreviewLoop = () => {
    previewLoopRunning = false;
    if (previewFrameHandle !== null) {
      cancelAnimationFrame(previewFrameHandle);
      previewFrameHandle = null;
    }
  };

  const handleVideoMetadata = () => queuePreviewResize();
  const handleWindowResize = () => queuePreviewResize();
  if (inputPreviewVideo) {
    inputPreviewVideo.addEventListener('loadedmetadata', handleVideoMetadata);
  }
  window.addEventListener('resize', handleWindowResize);
  if (typeof ResizeObserver === 'function' && previewWrapper) {
    previewResizeObserver = new ResizeObserver(() => queuePreviewResize());
    previewResizeObserver.observe(previewWrapper);
  }
  resizePreview();

  // Initialize
  updateUI();
  startPreviewLoop();

  // Public API
  return {
  getInputs: () => state.inputs.map(i => ({ ...i })),
    getActiveInput: () => {
      if (!state.activeInputId) return null;
      const input = state.inputs.find(i => i.id === state.activeInputId);
      return input ? { ...input } : null;
    },
    dispose: () => {
      // Cleanup all streams
      state.inputs.forEach(input => {
        if (input.stream) {
          input.stream.getTracks().forEach(track => track.stop());
        }
        if (input.videoElement) {
          input.videoElement.pause();
          input.videoElement.src = '';
        }
      });
      state.inputs = [];
      dispatchInputEvent(INPUT_LIST_EVENT, { inputs: [] });
      dispatchInputEvent(ACTIVE_INPUT_EVENT, { input: null });
      stopPreviewLoop();
      window.removeEventListener('resize', handleWindowResize);
      if (inputPreviewVideo) {
        inputPreviewVideo.removeEventListener('loadedmetadata', handleVideoMetadata);
      }
      if (previewResizeObserver) {
        previewResizeObserver.disconnect();
        previewResizeObserver = null;
      }
      console.log('[mediamime] Input system disposed');
    }
  };
}
