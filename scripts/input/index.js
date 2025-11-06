/**
 * Input Layer System
 * Manages multiple camera and video inputs with transforms (position, scale, rotation, opacity)
 */

const createId = () => `input-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_TRANSFORM = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  rotation: 0,
  opacity: 1,
  mirror: false
};

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
  const inputSourceX = document.getElementById('input-source-x');
  const inputSourceY = document.getElementById('input-source-y');
  const inputSourceWidth = document.getElementById('input-source-width');
  const inputSourceHeight = document.getElementById('input-source-height');
  const inputSourceRotation = document.getElementById('input-source-rotation');
  const inputSourceOpacity = document.getElementById('input-source-opacity');
  const inputSourceOpacityValue = document.getElementById('input-source-opacity-value');
  const inputSourceMirror = document.getElementById('input-source-mirror');
  const deleteSourceButton = document.getElementById('input-delete-source');

  // State
  const state = {
    inputs: [], // Array of {id, name, type: 'camera'|'video', stream, transform: {x,y,width,height,rotation,opacity,mirror}}
    activeInputId: null,
    isSyncing: false
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
      return;
    }

    inputEmpty.style.display = 'none';

    // Render input list
    inputList.innerHTML = state.inputs.map(input => {
      const isActive = input.id === state.activeInputId;
      const icon = input.type === 'camera' ? 'videocam' : 'movie';
      return `
        <button
          data-input-id="${input.id}"
          class="${isActive ? 'is-active' : ''}"
          title="${input.name}">
          <span class="input-label">
            <span class="material-icons-outlined">${icon}</span>
            <span class="input-label-text">${input.name}</span>
          </span>
          <span class="input-meta">${Math.round(input.transform.opacity * 100)}%</span>
        </button>
      `;
    }).join('');

    // Update detail panel
    if (state.activeInputId) {
      const input = state.inputs.find(i => i.id === state.activeInputId);
      if (input) {
        inputDetail.style.display = 'flex';
        syncDetailForm(input);
      }
    } else {
      inputDetail.style.display = 'none';
    }
  };

  // Helper: Sync detail form with active input
  const syncDetailForm = (input) => {
    if (state.isSyncing) return;
    state.isSyncing = true;

    inputSourceName.value = input.name || '';
    inputSourceType.textContent = input.type === 'camera' ? 'Camera' : 'Video';
    inputSourceX.value = input.transform.x.toFixed(2);
    inputSourceY.value = input.transform.y.toFixed(2);
    inputSourceWidth.value = input.transform.width.toFixed(2);
    inputSourceHeight.value = input.transform.height.toFixed(2);
    inputSourceRotation.value = Math.round(input.transform.rotation);
    inputSourceOpacity.value = input.transform.opacity;
    inputSourceOpacityValue.textContent = `${Math.round(input.transform.opacity * 100)}%`;
    inputSourceMirror.checked = input.transform.mirror;

    // Update preview if stream exists
    if (input.stream && inputPreviewVideo) {
      if (inputPreviewVideo.srcObject !== input.stream) {
        inputPreviewVideo.srcObject = input.stream;
      }
    }

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
        transform: { ...DEFAULT_TRANSFORM }
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
        transform: { ...DEFAULT_TRANSFORM }
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
  const updateInputTransform = (inputId, transform) => {
    const input = state.inputs.find(i => i.id === inputId);
    if (!input) return;

    Object.assign(input.transform, transform);
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

  const createTransformHandler = (key, parse = parseFloat) => (e) => {
    if (!state.activeInputId || state.isSyncing) return;
    const value = parse(e.target.value);
    if (!isFinite(value)) return;
    updateInputTransform(state.activeInputId, { [key]: value });
  };

  if (inputSourceX) inputSourceX.addEventListener('input', createTransformHandler('x'));
  if (inputSourceY) inputSourceY.addEventListener('input', createTransformHandler('y'));
  if (inputSourceWidth) inputSourceWidth.addEventListener('input', createTransformHandler('width'));
  if (inputSourceHeight) inputSourceHeight.addEventListener('input', createTransformHandler('height'));
  if (inputSourceRotation) inputSourceRotation.addEventListener('input', createTransformHandler('rotation'));

  if (inputSourceOpacity) {
    inputSourceOpacity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      if (!isFinite(value)) return;
      if (inputSourceOpacityValue) {
        inputSourceOpacityValue.textContent = `${Math.round(value * 100)}%`;
      }
      if (!state.activeInputId || state.isSyncing) return;
      updateInputTransform(state.activeInputId, { opacity: value });
    });
  }

  if (inputSourceMirror) {
    inputSourceMirror.addEventListener('change', (e) => {
      if (!state.activeInputId || state.isSyncing) return;
      updateInputTransform(state.activeInputId, { mirror: e.target.checked });
    });
  }

  // Initialize
  updateUI();

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
      console.log('[mediamime] Input system disposed');
    }
  };
}
