/**
 * Input Layer System
 * Manages multiple camera and video inputs – now only crop & flip metadata.
 */

const createId = () => `input-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_CROP = { x: 0, y: 0, w: 1, h: 1 };
const DEFAULT_FLIP = { horizontal: false, vertical: false };
const INPUT_STORAGE_KEY = 'mediamime:inputs';
const INPUT_BOOKMARKS_KEY = 'mediamime:url-bookmarks';
const DEFAULT_URL_SOURCE = {
  url: 'https://cdn.jsdelivr.net/gh/mediapipe/assets/video/dance.mp4',
  name: 'Sample Clip',
  type: 'video'
};
const STATUS_TYPES = Object.freeze({ info: 'info', error: 'error', success: 'success' });
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'ogv', 'ogg'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

export function initInput({ editor }) {
  console.log('[mediamime] Initializing Input layer system');

  // UI Elements
  const inputList = document.getElementById('input-source-list');
  const inputEmpty = document.getElementById('input-empty');
  const inputDetail = document.getElementById('input-detail');
  const addCameraButton = document.getElementById('input-add-camera');
  const addVideoButton = document.getElementById('input-add-video');
  const addUrlButton = document.getElementById('input-add-url');
  
  // Detail form elements
  const inputSourceName = document.getElementById('input-source-name');
  const inputSourceType = document.getElementById('input-source-type');
  const inputPreviewVideo = document.getElementById('input-preview-video');
  const inputPreviewCanvas = document.getElementById('input-preview-canvas');
  const previewCtx = inputPreviewCanvas ? inputPreviewCanvas.getContext('2d') : null;
  const previewWrapper = document.querySelector('#input-detail .input-preview-wrapper');
  const transportRow = document.getElementById('input-transport-row');
  const transportToggle = document.getElementById('input-transport-toggle');
  const transportToggleLabel = transportToggle ? transportToggle.querySelector('[data-transport-label]') : null;
  const transportSpeed = document.getElementById('input-transport-speed');
  const transportSpeedValue = document.getElementById('input-transport-speed-value');
  if (transportRow) {
    transportRow.style.display = 'none';
  }
  const urlInput = document.getElementById('input-url-field');
  const urlAddButton = document.getElementById('input-url-add');
  const urlBookmarksList = document.getElementById('input-url-bookmarks');
  const urlMessage = document.getElementById('input-url-message');
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
    isSyncing: false,
    bookmarks: []
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
      flip: { ...input.flip },
      origin: input.origin,
      sourceUrl: input.sourceUrl || null,
      sourceKind: input.sourceKind || null,
      constraints: input.constraints || null,
      persistable: Boolean(input.persistable),
      playbackRate: typeof input.playbackRate === 'number' ? input.playbackRate : 1,
      isPaused: Boolean(input.isPaused)
    };
  };

  const setUrlMessage = (message = '', tone = 'info') => {
    if (!urlMessage) return;
    urlMessage.textContent = message;
    urlMessage.classList.remove('is-error', 'is-success');
    if (!message) return;
    if (tone === 'error') {
      urlMessage.classList.add('is-error');
    } else if (tone === 'success') {
      urlMessage.classList.add('is-success');
    }
  };

  const showInlineStatus = (message, tone = STATUS_TYPES.info) => {
    setUrlMessage(message, tone);
  };

  const saveBookmarks = () => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(INPUT_BOOKMARKS_KEY, JSON.stringify(state.bookmarks));
    } catch (error) {
      console.warn('[mediamime] Failed to persist bookmarks', error);
    }
  };

  const renderBookmarks = () => {
    if (!urlBookmarksList) return;
    if (!state.bookmarks.length) {
      urlBookmarksList.innerHTML = '<div class="input-hint">No bookmarks yet. Paste a media URL above.</div>';
      return;
    }
    const markup = state.bookmarks
      .map((bookmark) => {
        const safeName = escapeHtml(bookmark.name || bookmark.url);
        const safeUrl = escapeHtml(bookmark.url);
        return `
          <div class="input-url-bookmark" role="listitem" data-url="${safeUrl}">
            <button type="button" class="bookmark-load" data-bookmark-url="${safeUrl}">
              <span class="material-icons-outlined" aria-hidden="true">play_circle</span>
              <span>${safeName}</span>
            </button>
            <button type="button" class="input-url-bookmark-remove" title="Remove bookmark" aria-label="Remove bookmark" data-remove-url="${safeUrl}">
              <span class="material-icons-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        `;
      })
      .join('');
    urlBookmarksList.innerHTML = markup;
  };

  const loadBookmarks = () => {
    if (typeof localStorage === 'undefined') {
      state.bookmarks = [{ url: DEFAULT_URL_SOURCE.url, name: DEFAULT_URL_SOURCE.name }];
      renderBookmarks();
      return;
    }
    try {
      const raw = localStorage.getItem(INPUT_BOOKMARKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          state.bookmarks = parsed;
        } else {
          state.bookmarks = [{ url: DEFAULT_URL_SOURCE.url, name: DEFAULT_URL_SOURCE.name }];
        }
      } else {
        state.bookmarks = [{ url: DEFAULT_URL_SOURCE.url, name: DEFAULT_URL_SOURCE.name }];
      }
    } catch (error) {
      console.warn('[mediamime] Failed to load bookmarks', error);
      state.bookmarks = [{ url: DEFAULT_URL_SOURCE.url, name: DEFAULT_URL_SOURCE.name }];
    }
    renderBookmarks();
    saveBookmarks();
  };

  const addBookmark = (url, name) => {
    const existing = state.bookmarks.find((bookmark) => bookmark.url === url);
    if (existing) {
      existing.name = name || existing.name;
    } else {
      state.bookmarks.unshift({
        url,
        name: name || url
      });
    }
    state.bookmarks = state.bookmarks.slice(0, 25);
    saveBookmarks();
    renderBookmarks();
  };

  const removeBookmark = (url) => {
    const before = state.bookmarks.length;
    state.bookmarks = state.bookmarks.filter((bookmark) => bookmark.url !== url);
    if (state.bookmarks.length !== before) {
      saveBookmarks();
      renderBookmarks();
    }
  };

  const persistInputs = () => {
    if (typeof localStorage === 'undefined') return;
    try {
      const payload = state.inputs
        .filter((input) => input.persistable)
        .map((input) => ({
          id: input.id,
          name: input.name,
          type: input.type,
          origin: input.origin || input.type,
          crop: { ...input.crop },
          flip: { ...input.flip },
          sourceUrl: input.sourceUrl || null,
          sourceKind: input.sourceKind || null,
          constraints: input.constraints || null
        }));
      localStorage.setItem(INPUT_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[mediamime] Failed to persist inputs', error);
    }
  };

  const detectUrlKind = (url = '') => {
    const normalized = url.split('?')[0].toLowerCase();
    const ext = normalized.split('.').pop() || '';
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    return 'video';
  };

  const supportsTransport = (input) => {
    if (!input) return false;
    if (input.type !== 'video') return false;
    if (input.sourceKind === 'image') return false;
    return Boolean(input.videoElement);
  };

  const ensureTransportState = (input) => {
    if (!input) return;
    if (typeof input.playbackRate !== 'number') input.playbackRate = 1;
    if (typeof input.isPaused !== 'boolean') input.isPaused = false;
  };

  const stopReversePlayback = (input) => {
    if (input?.reversePlayback?.rafId) {
      cancelAnimationFrame(input.reversePlayback.rafId);
    }
    if (input) {
      input.reversePlayback = null;
    }
  };

  const startReversePlayback = (input) => {
    if (!supportsTransport(input) || !input.videoElement) return;
    stopReversePlayback(input);
    const video = input.videoElement;
    const speed = Math.max(0.1, Math.abs(input.playbackRate || 1));
    const meta = { speed, rafId: null, lastTs: null };
    const step = (timestamp) => {
      if (!input.reversePlayback || input.playbackRate >= 0 || input.isPaused) {
        stopReversePlayback(input);
        return;
      }
      if (meta.lastTs == null) meta.lastTs = timestamp;
      const delta = (timestamp - meta.lastTs) / 1000;
      meta.lastTs = timestamp;
      video.pause();
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      let nextTime = video.currentTime - delta * meta.speed;
      if (nextTime <= 0) {
        nextTime = duration && duration > 0 ? duration : 0;
      }
      video.currentTime = Math.max(0, nextTime);
      meta.rafId = requestAnimationFrame(step);
    };
    input.reversePlayback = meta;
    meta.rafId = requestAnimationFrame(step);
  };

  const applyPlaybackState = (input) => {
    if (!supportsTransport(input) || !input.videoElement) return;
    ensureTransportState(input);
    const video = input.videoElement;
    const rate = input.playbackRate || 0;
    if (input.isPaused || rate === 0) {
      stopReversePlayback(input);
      video.pause();
      return;
    }
    if (rate < 0) {
      startReversePlayback(input);
    } else {
      stopReversePlayback(input);
      const resolvedRate = Math.max(0.1, rate);
      video.playbackRate = resolvedRate;
      video.play().catch(() => {});
    }
  };

  const formatSpeedLabel = (rate) => {
    const value = Number.isFinite(rate) ? rate : 0;
    if (value === 0) return '0×';
    const sign = value < 0 ? '-' : '';
    const magnitude = Math.abs(value);
    const formatted = magnitude >= 1 ? magnitude.toFixed(1) : magnitude.toFixed(2);
    return `${sign}${formatted.replace(/\.?0+$/, '')}×`;
  };

  const updateTransportUI = (input) => {
    if (!transportRow) return;
    const supported = supportsTransport(input);
    transportRow.style.display = supported ? '' : 'none';
    if (!supported) return;
    ensureTransportState(input);
    if (transportToggle) {
      transportToggle.disabled = false;
      if (transportToggleLabel) {
        transportToggleLabel.textContent = input.isPaused ? 'Play' : 'Pause';
      }
      const icon = transportToggle.querySelector('.material-icons-outlined');
      if (icon) {
        icon.textContent = input.isPaused ? 'play_arrow' : input.playbackRate < 0 ? 'replay' : 'pause';
      }
    }
    if (transportSpeed) {
      transportSpeed.disabled = false;
      transportSpeed.value = `${input.playbackRate ?? 1}`;
    }
    if (transportSpeedValue) {
      transportSpeedValue.textContent = formatSpeedLabel(input.playbackRate ?? 1);
    }
  };

  const setInputPlaybackRate = (input, rate) => {
    if (!supportsTransport(input)) return;
    input.playbackRate = rate;
    if (rate === 0) {
      input.isPaused = true;
    }
    applyPlaybackState(input);
    persistInputs();
    updateTransportUI(input);
  };

  const toggleInputPlayback = (input) => {
    if (!supportsTransport(input)) return;
    if (input.playbackRate === 0) {
      input.playbackRate = 1;
    }
    input.isPaused = !input.isPaused;
    applyPlaybackState(input);
    persistInputs();
    updateTransportUI(input);
  };

  const createVideoStreamFromUrl = async (url, { autoplay } = { autoplay: false }) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.autoplay = Boolean(autoplay);
    video.loop = true;
    video.muted = true;
    if (autoplay) {
      await video.play();
    } else {
      await video.load();
    }
    const stream = video.captureStream?.();
    if (!stream) {
      throw new Error('captureStream() not supported for this media.');
    }
    return { stream, video };
  };

  const createImageStreamFromUrl = async (url) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = img.naturalWidth || 1280;
    const height = img.naturalHeight || 720;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    let rafId = null;
    const pump = () => {
      ctx.drawImage(img, 0, 0, width, height);
      rafId = requestAnimationFrame(pump);
    };
    rafId = requestAnimationFrame(pump);
    const stream = canvas.captureStream(30);
    return {
      stream,
      stop() {
        if (rafId) cancelAnimationFrame(rafId);
      }
    };
  };

  const loadPersistedInputs = async () => {
    if (typeof localStorage === 'undefined') return;
    let saved = [];
    try {
      const raw = localStorage.getItem(INPUT_STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (error) {
      console.warn('[mediamime] Failed to parse persisted inputs', error);
    }
    for (const entry of saved) {
      try {
        if (entry.type === 'camera') {
          const created = await addCameraInput({
            id: entry.id,
            name: entry.name,
            constraints: entry.constraints || { video: { width: 1280, height: 720 }, audio: false },
            persist: false,
            setActive: false
          });
          if (created) {
            created.playbackRate = entry.playbackRate ?? 1;
            created.isPaused = entry.isPaused ?? false;
            applyPlaybackState(created);
          }
        } else if (entry.sourceUrl) {
          const created = await addUrlInputFromData({
            id: entry.id,
            name: entry.name,
            sourceUrl: entry.sourceUrl,
            sourceKind: entry.sourceKind,
            persist: false,
            setActive: false
          });
          if (created) {
            created.playbackRate = entry.playbackRate ?? 1;
            created.isPaused = entry.isPaused ?? false;
            applyPlaybackState(created);
          }
        }
      } catch (error) {
        console.warn('[mediamime] Failed to restore input', entry?.name || entry?.id, error);
      }
    }
    if (!state.inputs.length) {
      try {
        await addUrlInputFromData({
          name: DEFAULT_URL_SOURCE.name,
          sourceUrl: DEFAULT_URL_SOURCE.url,
          sourceKind: 'video',
          persist: true,
          setActive: true
        });
      } catch (error) {
        console.warn('[mediamime] Failed to add default source', error);
      }
    }
    if (state.inputs.length && !state.activeInputId) {
      state.activeInputId = state.inputs[0].id;
    }
    updateUI();
    persistInputs();
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
      const statusChip = input.status?.message
        ? `<span class="input-meta-chip ${input.status?.tone || ''}">${escapeHtml(input.status.message)}</span>`
        : '';
      return `
        <button
          data-input-id="${input.id}"
          class="${isActive ? 'is-active' : ''}"
          title="${safeName}">
          <span class="input-label">
            <span class="material-icons-outlined">${icon}</span>
            <span class="input-label-text">${safeName}</span>
          </span>
          <span class="input-meta" aria-hidden="true">${statusChip}</span>
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
      updateTransportUI(null);
    }

    dispatchInputEvent(INPUT_LIST_EVENT, {
      inputs: state.inputs.map((input) => serializeInput(input))
    });
    dispatchInputEvent(ACTIVE_INPUT_EVENT, {
      input: serializeInput(activeInput)
    });
  };

  const updateSourceStatus = (input, message, tone = STATUS_TYPES.info) => {
    if (!input) return;
    input.status = { message, tone };
    if (state.activeInputId === input.id) {
      showInlineStatus(message, tone);
    }
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

    updateTransportUI(input);
    state.isSyncing = false;
  };

  // Add camera input
  const addCameraInput = async (options = {}) => {
    const {
      id = createId(),
      name = generateInputName('camera'),
      constraints = { video: { width: 1280, height: 720 }, audio: false },
      persist = true,
      setActive = true
    } = options;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      const input = {
        id,
        name,
        type: 'camera',
        stream,
        constraints,
        persistable: true,
        origin: 'camera',
        persistable: true,
        crop: { ...DEFAULT_CROP },
        flip: { ...DEFAULT_FLIP }
      };

      ensureTransportState(input);
      applyPlaybackState(input);
      state.inputs.push(input);
      if (setActive) {
        state.activeInputId = input.id;
      }
      updateUI();
      if (persist) persistInputs();
      console.log('[mediamime] Added camera input:', input.name);
      return input;
    } catch (error) {
      console.error('[mediamime] Failed to add camera:', error);
      setUrlMessage('Could not access camera. Please check permissions.', 'error');
      return null;
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
        origin: 'file',
        persistable: false,
        stream,
        videoElement: video, // Keep reference to video element
        crop: { ...DEFAULT_CROP },
        flip: { ...DEFAULT_FLIP }
      };

      ensureTransportState(input);
      applyPlaybackState(input);
      state.inputs.push(input);
      state.activeInputId = input.id;
      updateUI();
      console.log('[mediamime] Added video input:', input.name);
    };
    fileInput.click();
  };

  const addUrlInputFromData = async (options = {}) => {
    const {
      id = createId(),
      name = options.name || generateInputName('video'),
      sourceUrl,
      sourceKind,
      persist = true,
      setActive = true
    } = options;
    const url = (sourceUrl || '').trim();
    if (!url) {
      setUrlMessage('Please provide a valid URL.', 'error');
      return null;
    }
    const kind = sourceKind || detectUrlKind(url);
    try {
      let stream;
      let videoElement = null;
      let stopRender = null;
      if (kind === 'image') {
        const result = await createImageStreamFromUrl(url);
        stream = result.stream;
        stopRender = result.stop;
      } else {
        const result = await createVideoStreamFromUrl(url, { autoplay: false });
        stream = result.stream;
        videoElement = result.video;
      }
      const input = {
        id,
        name,
        type: 'video',
        origin: 'url',
        persistable: true,
        sourceUrl: url,
        sourceKind: kind,
        stream,
        videoElement,
        stopRender,
        crop: { ...DEFAULT_CROP },
        flip: { ...DEFAULT_FLIP }
      };
      ensureTransportState(input);
      applyPlaybackState(input);
      state.inputs.push(input);
      if (setActive) {
        state.activeInputId = input.id;
      }
      updateUI();
      if (persist) persistInputs();
      console.log('[mediamime] Added URL input:', input.name);
      return input;
      setUrlMessage(`Loaded media from ${url}`, 'success');
      return input;
    } catch (error) {
      console.error('[mediamime] Failed to load media URL', error);
      setUrlMessage('Could not load the provided media URL.', 'error');
      return null;
    }
  };

  // Delete input
  const deleteInput = () => {
    if (!state.activeInputId) return;

    const index = state.inputs.findIndex(i => i.id === state.activeInputId);
    if (index === -1) return;

    const input = state.inputs[index];

    stopReversePlayback(input);
    // Stop stream
    if (input.stream) {
      input.stream.getTracks().forEach(track => track.stop());
    }

    // Cleanup video element
    if (input.videoElement) {
      input.videoElement.pause();
      input.videoElement.src = '';
    }
    if (input.stopRender) {
      try {
        input.stopRender();
      } catch {
        /* noop */
      }
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
    persistInputs();
    console.log('[mediamime] Deleted input');
  };

  // Update input transform
  const updateInputMeta = (inputId, patch) => {
    const input = state.inputs.find(i => i.id === inputId);
    if (!input) return;
    if (patch.crop) Object.assign(input.crop, patch.crop);
    if (patch.flip) Object.assign(input.flip, patch.flip);
    updateUI();
    persistInputs();
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
        persistInputs();
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

  if (transportToggle) {
    transportToggle.addEventListener('click', () => {
      if (!state.activeInputId) return;
      const input = state.inputs.find((item) => item.id === state.activeInputId);
      if (!input) return;
      toggleInputPlayback(input);
    });
  }

  if (transportSpeed) {
    transportSpeed.addEventListener('input', (e) => {
      if (!state.activeInputId) return;
      const input = state.inputs.find((item) => item.id === state.activeInputId);
      if (!input || !supportsTransport(input)) return;
      const rate = parseFloat(e.target.value);
      if (!Number.isFinite(rate)) return;
      setInputPlaybackRate(input, rate);
      if (transportSpeedValue) transportSpeedValue.textContent = formatSpeedLabel(rate);
    });
  }

  const handleUrlSubmit = async () => {
    if (!urlInput) return;
    const raw = urlInput.value.trim();
    if (!raw) {
      setUrlMessage('Enter a media URL.', 'error');
      return;
    }
    let parsed;
    try {
      parsed = new URL(raw, window.location.origin);
    } catch {
      setUrlMessage('Invalid URL format.', 'error');
      return;
    }
    const normalized = parsed.href;
    const name = parsed.hostname || normalized;
    setUrlMessage('Loading media…', 'info');
    addBookmark(normalized, name);
    const result = await addUrlInputFromData({ sourceUrl: normalized, name, sourceKind: detectUrlKind(normalized) });
    if (result) {
      urlInput.value = '';
    }
  };

  if (urlAddButton) {
    urlAddButton.addEventListener('click', () => {
      void handleUrlSubmit();
    });
  }
  if (urlInput) {
    urlInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void handleUrlSubmit();
      }
    });
  }
  if (urlBookmarksList) {
    urlBookmarksList.addEventListener('click', (event) => {
      const removeBtn = event.target.closest('[data-remove-url]');
      if (removeBtn) {
        const targetUrl = removeBtn.dataset.removeUrl;
        removeBookmark(targetUrl);
        setUrlMessage('Removed bookmark.', 'info');
        return;
      }
      const loadBtn = event.target.closest('[data-bookmark-url]');
      if (loadBtn) {
        const targetUrl = loadBtn.dataset.bookmarkUrl;
        const bookmark = state.bookmarks.find((entry) => entry.url === targetUrl);
        if (bookmark) {
          setUrlMessage('Loading media…', 'info');
          void addUrlInputFromData({ sourceUrl: bookmark.url, name: bookmark.name, sourceKind: detectUrlKind(bookmark.url) });
        }
      }
    });
  }

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
  loadBookmarks();
  loadPersistedInputs().catch((error) => {
    console.warn('[mediamime] Failed to restore inputs', error);
  });

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
        if (input.stopRender) {
          try {
            input.stopRender();
          } catch {
            /* noop */
          }
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
