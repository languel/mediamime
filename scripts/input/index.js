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
  url: './scripts/input/default_input.mp4',
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
  const inputSourceTypeIcon = document.getElementById('input-source-type-icon');
  const inputPreviewVideo = document.getElementById('input-preview-video');
  const inputPreviewCanvas = document.getElementById('input-preview-canvas');
  const previewCtx = inputPreviewCanvas ? inputPreviewCanvas.getContext('2d') : null;
  const previewWrapper = document.querySelector('#input-detail .input-preview-wrapper');
  const transportRow = document.getElementById('input-transport-row');
  const transportToggle = document.getElementById('input-transport-toggle');
  const transportScrub = document.getElementById('input-transport-scrub');
  const transportTime = document.getElementById('input-transport-time');
  const transportSpeed = document.getElementById('input-transport-speed');
  const transportSpeedValue = document.getElementById('input-transport-speed-value');
  if (transportRow) {
    transportRow.style.display = 'none';
  }
  const urlInput = document.getElementById('input-url-field');
  const urlAddButton = document.getElementById('input-url-add');
  const urlBookmarksList = document.getElementById('input-url-bookmarks');
  const urlMessage = document.getElementById('input-url-message');
  const loadSampleButton = document.getElementById('input-load-sample');
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

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const updateTransportUI = (input) => {
    if (!transportRow) return;
    const supported = supportsTransport(input);
    transportRow.style.display = supported ? '' : 'none';
    if (!supported) return;
    ensureTransportState(input);
    if (transportToggle) {
      transportToggle.disabled = false;
      const icon = transportToggle.querySelector('.material-icons-outlined');
      if (icon) {
        icon.textContent = input.isPaused || input.playbackRate === 0 ? 'play_arrow' : input.playbackRate < 0 ? 'replay' : 'pause';
      }
    }
    if (transportSpeed) {
      transportSpeed.disabled = false;
      // Avoid overwriting while user is actively editing unless the field is in a transient state
      const activeEditing = document.activeElement === transportSpeed;
      const currentDisplay = transportSpeed.value;
      const targetValue = `${input.playbackRate ?? 1}`;
      if (!activeEditing || currentDisplay === '' || currentDisplay === '-' || currentDisplay === '.' || currentDisplay === '-.') {
        transportSpeed.value = targetValue;
      }
    }
    if (transportSpeedValue) {
      transportSpeedValue.textContent = formatSpeedLabel(input.playbackRate ?? 1);
    }
    if (transportScrub && transportTime && input.videoElement) {
      const v = input.videoElement;
      const duration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null;
      const current = Number.isFinite(v.currentTime) ? v.currentTime : 0;
      if (duration) {
        transportScrub.disabled = false;
        transportScrub.value = (current / duration).toFixed(4);
        transportTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
      } else {
        transportScrub.disabled = true;
        transportScrub.value = '0';
        transportTime.textContent = '0:00';
      }
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
  const emitInputState = (activeInputOverride = undefined) => {
    const serialized = state.inputs.map((input) => serializeInput(input));
    dispatchInputEvent(INPUT_LIST_EVENT, { inputs: serialized });
    let activeInput = activeInputOverride;
    if (typeof activeInput === "undefined") {
      activeInput = state.inputs.find((input) => input.id === state.activeInputId) || null;
    }
    dispatchInputEvent(ACTIVE_INPUT_EVENT, { input: serializeInput(activeInput) });
  };

  const updateUI = () => {
    if (state.inputs.length === 0) {
      inputEmpty.style.display = 'block';
      inputDetail.style.display = 'none';
      inputList.innerHTML = '';
      emitInputState(null);
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
            <button type="button" class="icon-button" data-action="delete-input" data-input-id="${input.id}" title="Delete source" aria-label="Delete source">
              <span class="material-icons-outlined" aria-hidden="true">delete</span>
            </button>
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

    emitInputState(activeInput);
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
    // Update icon based on type
    if (inputSourceTypeIcon) {
      inputSourceTypeIcon.textContent = input.type === 'camera' ? 'videocam' : 'video_library';
      inputSourceTypeIcon.title = input.type === 'camera' ? 'Camera' : 'Video';
    }
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
    if (inputPreviewVideo) inputPreviewVideo.style.transform = '';
    if (inputPreviewCanvas) inputPreviewCanvas.style.transform = '';

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

  const createCropHandler = (key) => {
    const commit = (raw) => {
      const value = parseFloat(raw);
      if (!isFinite(value)) return;
      updateInputMeta(state.activeInputId, { crop: { [key]: Math.min(1, Math.max(0, value)) } });
    };
    return (e) => {
      if (!state.activeInputId || state.isSyncing) return;
      const raw = e.target.value.trim();
      if (raw === '' || raw === '.') return; // transient state
      commit(raw);
    };
  };
  const attachCropField = (el, key) => {
    if (!el) return;
    el.addEventListener('input', createCropHandler(key));
    el.addEventListener('blur', (e) => {
      if (!state.activeInputId || state.isSyncing) return;
      const raw = e.target.value.trim();
      if (raw === '' || raw === '.') return;
      const value = parseFloat(raw);
      if (!isFinite(value)) return;
      updateInputMeta(state.activeInputId, { crop: { [key]: Math.min(1, Math.max(0, value)) } });
    });
  };
  attachCropField(cropX, 'x');
  attachCropField(cropY, 'y');
  attachCropField(cropW, 'w');
  attachCropField(cropH, 'h');
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
    // Commit logic separated to allow transient editing states (empty, minus, period)
    const commitSpeedValue = () => {
      if (!state.activeInputId) return;
      const input = state.inputs.find((item) => item.id === state.activeInputId);
      if (!input || !supportsTransport(input)) return;
      const raw = transportSpeed.value.trim();
      if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return; // ignore incomplete
      const rate = parseFloat(raw);
      if (!Number.isFinite(rate)) return;
      setInputPlaybackRate(input, rate);
      if (transportSpeedValue) transportSpeedValue.textContent = formatSpeedLabel(rate);
    };
    transportSpeed.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitSpeedValue();
        transportSpeed.blur();
      }
    });
    transportSpeed.addEventListener('blur', commitSpeedValue);
    transportSpeed.addEventListener('input', () => {
      // Live update if valid number; otherwise allow incomplete typing
      const raw = transportSpeed.value.trim();
      if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return;
      const rate = parseFloat(raw);
      if (!Number.isFinite(rate)) return;
      if (!state.activeInputId) return;
      const input = state.inputs.find((item) => item.id === state.activeInputId);
      if (!input || !supportsTransport(input)) return;
      setInputPlaybackRate(input, rate);
      if (transportSpeedValue) transportSpeedValue.textContent = formatSpeedLabel(rate);
    });
  }

  if (transportScrub) {
    transportScrub.addEventListener('input', (e) => {
      if (!state.activeInputId) return;
      const input = state.inputs.find((item) => item.id === state.activeInputId);
      if (!input || !supportsTransport(input) || !input.videoElement) return;
      const v = input.videoElement;
      const ratio = parseFloat(e.target.value);
      if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) return;
      const duration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null;
      if (!duration) return;
      v.currentTime = ratio * duration;
      updateTransportUI(input);
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

  if (loadSampleButton) {
    loadSampleButton.addEventListener('click', () => {
      setUrlMessage('Loading sample clip…', 'info');
      addBookmark(DEFAULT_URL_SOURCE.url, DEFAULT_URL_SOURCE.name);
      void addUrlInputFromData({
        sourceUrl: DEFAULT_URL_SOURCE.url,
        name: DEFAULT_URL_SOURCE.name,
        sourceKind: 'video'
      });
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
  const toDisplayCrop = (crop, flipH, flipV) => {
    const safeX = Math.max(0, Math.min(1, crop.x));
    const safeY = Math.max(0, Math.min(1, crop.y));
    const safeW = Math.max(0.01, Math.min(1 - safeX, crop.w));
    const safeH = Math.max(0.01, Math.min(1 - safeY, crop.h));
    const maxX = 1 - safeW;
    const maxY = 1 - safeH;
    const displayX = flipH ? Math.max(0, Math.min(maxX, 1 - safeX - safeW)) : safeX;
    const displayY = flipV ? Math.max(0, Math.min(maxY, 1 - safeY - safeH)) : safeY;
    return {
      x: displayX,
      y: displayY,
      w: safeW,
      h: safeH
    };
  };

  const fromDisplayCrop = (displayCrop, flipH, flipV) => {
    const safeX = Math.max(0, Math.min(1, displayCrop.x));
    const safeY = Math.max(0, Math.min(1, displayCrop.y));
    const safeW = Math.max(0.01, Math.min(1 - safeX, displayCrop.w));
    const safeH = Math.max(0.01, Math.min(1 - safeY, displayCrop.h));
    const maxX = 1 - safeW;
    const maxY = 1 - safeH;
    const canonicalX = flipH ? Math.max(0, Math.min(maxX, 1 - safeX - safeW)) : safeX;
    const canonicalY = flipV ? Math.max(0, Math.min(maxY, 1 - safeY - safeH)) : safeY;
    return {
      x: canonicalX,
      y: canonicalY,
      w: safeW,
      h: safeH
    };
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
    const flipH = Boolean(active.flip?.horizontal);
    const flipV = Boolean(active.flip?.vertical);
    previewCtx.save();
    const centerX = offsetX + drawW / 2;
    const centerY = offsetY + drawH / 2;
    previewCtx.translate(centerX, centerY);
    previewCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    previewCtx.drawImage(video, -drawW / 2, -drawH / 2, drawW, drawH);
    previewCtx.restore();
    // Draw crop rectangle overlay with handles
    const displayCrop = toDisplayCrop(active.crop, flipH, flipV);
    const rectX = offsetX + displayCrop.x * drawW;
    const rectY = offsetY + displayCrop.y * drawH;
    const rectW = displayCrop.w * drawW;
    const rectH = displayCrop.h * drawH;
    
    // Store preview geometry for drag handlers (in CSS pixels)
    const dpr = window.devicePixelRatio || 1;
    state.previewGeometry = {
      offsetX: offsetX / dpr,
      offsetY: offsetY / dpr,
      drawW: drawW / dpr,
      drawH: drawH / dpr,
      rectX: rectX / dpr,
      rectY: rectY / dpr,
      rectW: rectW / dpr,
      rectH: rectH / dpr
    };
    
    previewCtx.save();
    previewCtx.strokeStyle = '#00e0ff';
    previewCtx.lineWidth = Math.max(1, 2 * dpr);
    previewCtx.setLineDash([10, 6]);
    previewCtx.strokeRect(rectX, rectY, rectW, rectH);
    previewCtx.restore();
    
    // Draw corner handles
    const handleSize = 12 * dpr;
    const handles = [
      { x: rectX, y: rectY, cursor: 'nwse-resize', type: 'nw' },
      { x: rectX + rectW, y: rectY, cursor: 'nesw-resize', type: 'ne' },
      { x: rectX, y: rectY + rectH, cursor: 'nesw-resize', type: 'sw' },
      { x: rectX + rectW, y: rectY + rectH, cursor: 'nwse-resize', type: 'se' },
    ];
    
    previewCtx.save();
    handles.forEach(handle => {
      previewCtx.fillStyle = '#00e0ff';
      previewCtx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
      previewCtx.strokeStyle = '#05070d';
      previewCtx.lineWidth = 1.5 * dpr;
      previewCtx.setLineDash([]);
      previewCtx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    });
    previewCtx.restore();
  };

  const previewLoop = () => {
    if (!previewLoopRunning) return;
    renderPreview();
    // Update scrubber UI as video plays
    if (state.activeInputId) {
      const input = state.inputs.find(i => i.id === state.activeInputId);
      if (input) updateTransportUI(input);
    }
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

  // Crop drag state
  let cropDragState = null;

  const getCursorForHandle = (handleType) => {
    const cursors = {
      nw: 'nwse-resize',
      ne: 'nesw-resize',
      sw: 'nesw-resize',
      se: 'nwse-resize',
      move: 'move'
    };
    return cursors[handleType] || 'default';
  };

  const getHoveredCropElement = (canvasX, canvasY) => {
    if (!state.activeInputId || !state.previewGeometry) return null;
    const geo = state.previewGeometry;
    const handleSize = 12; // CSS pixels
    const hitMargin = 4;
    
    // Check corner handles
    const handles = [
      { type: 'nw', x: geo.rectX, y: geo.rectY },
      { type: 'ne', x: geo.rectX + geo.rectW, y: geo.rectY },
      { type: 'sw', x: geo.rectX, y: geo.rectY + geo.rectH },
      { type: 'se', x: geo.rectX + geo.rectW, y: geo.rectY + geo.rectH },
    ];
    
    for (const handle of handles) {
      const dx = Math.abs(canvasX - handle.x);
      const dy = Math.abs(canvasY - handle.y);
      if (dx <= handleSize / 2 + hitMargin && dy <= handleSize / 2 + hitMargin) {
        return { type: 'handle', handleType: handle.type };
      }
    }
    
    // Check if inside crop rect (for move)
    if (canvasX >= geo.rectX && canvasX <= geo.rectX + geo.rectW &&
        canvasY >= geo.rectY && canvasY <= geo.rectY + geo.rectH) {
      return { type: 'move' };
    }
    
    return null;
  };

  const handlePreviewPointerMove = (e) => {
    if (!inputPreviewCanvas) return;
    const rect = inputPreviewCanvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    if (cropDragState) {
      e.preventDefault();
      const input = state.inputs.find(i => i.id === state.activeInputId);
      if (!input || !state.previewGeometry) return;
      
      const geo = state.previewGeometry;
      const dx = canvasX - cropDragState.startX;
      const dy = canvasY - cropDragState.startY;
      const deltaX = dx / geo.drawW;
      const deltaY = dy / geo.drawH;
      let newDisplay = { ...cropDragState.initialDisplayCrop };
      
      if (cropDragState.handleType === 'move') {
        // Move entire crop rect
        newDisplay.x = Math.max(0, Math.min(1 - newDisplay.w, cropDragState.initialDisplayCrop.x + deltaX));
        newDisplay.y = Math.max(0, Math.min(1 - newDisplay.h, cropDragState.initialDisplayCrop.y + deltaY));
      } else {
        // Resize from corner
        if (cropDragState.handleType === 'nw') {
          const newX = Math.max(0, Math.min(cropDragState.initialDisplayCrop.x + cropDragState.initialDisplayCrop.w - 0.01, cropDragState.initialDisplayCrop.x + deltaX));
          const newY = Math.max(0, Math.min(cropDragState.initialDisplayCrop.y + cropDragState.initialDisplayCrop.h - 0.01, cropDragState.initialDisplayCrop.y + deltaY));
          newDisplay.w = cropDragState.initialDisplayCrop.x + cropDragState.initialDisplayCrop.w - newX;
          newDisplay.h = cropDragState.initialDisplayCrop.y + cropDragState.initialDisplayCrop.h - newY;
          newDisplay.x = newX;
          newDisplay.y = newY;
        } else if (cropDragState.handleType === 'ne') {
          const newY = Math.max(0, Math.min(cropDragState.initialDisplayCrop.y + cropDragState.initialDisplayCrop.h - 0.01, cropDragState.initialDisplayCrop.y + deltaY));
          newDisplay.w = Math.max(0.01, Math.min(1 - cropDragState.initialDisplayCrop.x, cropDragState.initialDisplayCrop.w + deltaX));
          newDisplay.h = cropDragState.initialDisplayCrop.y + cropDragState.initialDisplayCrop.h - newY;
          newDisplay.y = newY;
        } else if (cropDragState.handleType === 'sw') {
          const newX = Math.max(0, Math.min(cropDragState.initialDisplayCrop.x + cropDragState.initialDisplayCrop.w - 0.01, cropDragState.initialDisplayCrop.x + deltaX));
          newDisplay.w = cropDragState.initialDisplayCrop.x + cropDragState.initialDisplayCrop.w - newX;
          newDisplay.h = Math.max(0.01, Math.min(1 - cropDragState.initialDisplayCrop.y, cropDragState.initialDisplayCrop.h + deltaY));
          newDisplay.x = newX;
        } else if (cropDragState.handleType === 'se') {
          newDisplay.w = Math.max(0.01, Math.min(1 - cropDragState.initialDisplayCrop.x, cropDragState.initialDisplayCrop.w + deltaX));
          newDisplay.h = Math.max(0.01, Math.min(1 - cropDragState.initialDisplayCrop.y, cropDragState.initialDisplayCrop.h + deltaY));
        }
      }
      
      const newCrop = fromDisplayCrop(newDisplay, cropDragState.flipH, cropDragState.flipV);
      // Update crop (will trigger UI sync via updateInputMeta)
      Object.assign(input.crop, newCrop);
      emitInputState(input);
      if (!state.isSyncing) {
        syncDetailForm(input);
      }
      persistInputs();
      return;
    }
    
    // Update cursor based on hover
    const hovered = getHoveredCropElement(canvasX, canvasY);
    if (hovered) {
      inputPreviewCanvas.style.cursor = getCursorForHandle(hovered.handleType || hovered.type);
    } else {
      inputPreviewCanvas.style.cursor = 'crosshair';
    }
  };

  const handlePreviewPointerDown = (e) => {
    if (!inputPreviewCanvas || !state.activeInputId) return;
    const rect = inputPreviewCanvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    const hovered = getHoveredCropElement(canvasX, canvasY);
    if (hovered) {
      e.preventDefault();
      const input = state.inputs.find(i => i.id === state.activeInputId);
      if (!input) return;
      
      const flipH = Boolean(input.flip?.horizontal);
      const flipV = Boolean(input.flip?.vertical);
      cropDragState = {
        handleType: hovered.handleType || hovered.type,
        startX: canvasX,
        startY: canvasY,
        initialCrop: { ...input.crop },
        initialDisplayCrop: toDisplayCrop(input.crop, flipH, flipV),
        flipH,
        flipV
      };
      inputPreviewCanvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePreviewPointerUp = (e) => {
    if (cropDragState && inputPreviewCanvas) {
      inputPreviewCanvas.releasePointerCapture(e.pointerId);
      cropDragState = null;
    }
  };

  const handlePreviewPointerCancel = (e) => {
    if (cropDragState && inputPreviewCanvas) {
      inputPreviewCanvas.releasePointerCapture(e.pointerId);
      cropDragState = null;
    }
  };

  // Attach crop interaction handlers
  if (inputPreviewCanvas) {
    inputPreviewCanvas.addEventListener('pointermove', handlePreviewPointerMove);
    inputPreviewCanvas.addEventListener('pointerdown', handlePreviewPointerDown);
    inputPreviewCanvas.addEventListener('pointerup', handlePreviewPointerUp);
    inputPreviewCanvas.addEventListener('pointercancel', handlePreviewPointerCancel);
  }

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
      emitInputState(null);
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
