const SAMPLE_VIDEO_URL = "https://assets.mixkit.co/videos/preview/mixkit-young-woman-dancing-while-listening-to-music-1015-large.mp4";
const DEFAULT_VIDEO_WIDTH = 960;
const DEFAULT_VIDEO_HEIGHT = 720;

export class MediaPipeManager {
  constructor(videoElement, {
    onResults,
    onStatus,
    onSourceChange,
    onDimensions
  }) {
    this.video = videoElement;
    this.onResults = onResults;
    this.onStatus = onStatus;
    this.onSourceChange = onSourceChange;
    this.onDimensions = onDimensions;

    this.video.muted = true;
    this.video.loop = true;
    this.video.setAttribute("playsinline", "");

    this.holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
    });
    this.holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: true,
      refineFaceLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    this.holistic.onResults((results) => {
      this.onResults?.(results);
    });

    this.camera = null;
    this.sampleHandle = null;
    this.currentSource = "camera";
  }

  async initialize() {
    try {
      this.onStatus?.("Requesting camera…");
      await this.startCamera();
      this.onStatus?.("Live camera ready");
    } catch (err) {
      console.warn("Camera unavailable, falling back to sample video.", err);
      this.onStatus?.("Camera blocked — using sample video");
      await this.startSampleVideo();
    }
  }

  async startCamera() {
    this.stopSampleVideo();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: DEFAULT_VIDEO_WIDTH },
        height: { ideal: DEFAULT_VIDEO_HEIGHT }
      },
      audio: false
    });

    this.video.srcObject = stream;
    await this.video.play();
    await this.waitForDimensions();
    this.emitDimensions();

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        await this.holistic.send({ image: this.video });
      },
      width: this.video.videoWidth || DEFAULT_VIDEO_WIDTH,
      height: this.video.videoHeight || DEFAULT_VIDEO_HEIGHT
    });
    this.camera.start();
    this.currentSource = "camera";
    this.onSourceChange?.("camera");
  }

  async startSampleVideo() {
    this.stopCamera();
    this.video.srcObject = null;
    this.video.src = SAMPLE_VIDEO_URL;
    await this.video.play();
    await this.waitForDimensions();
    this.emitDimensions();

    const loop = async () => {
      if (this.video.readyState >= 2) {
        try {
          await this.holistic.send({ image: this.video });
        } catch (err) {
          console.warn("Holistic send failed on sample frame", err);
        }
      }
      this.sampleHandle = requestAnimationFrame(loop);
    };
    loop();
    this.currentSource = "sample";
    this.onSourceChange?.("sample");
  }

  async toggleSource() {
    if (this.currentSource === "camera") {
      this.onStatus?.("Loading sample video…");
      await this.startSampleVideo();
      this.onStatus?.("Using sample dance video");
    } else {
      try {
        this.onStatus?.("Requesting camera…");
        await this.startCamera();
        this.onStatus?.("Live camera ready");
      } catch (err) {
        console.error("Unable to access camera, staying on sample.", err);
        this.onStatus?.("Camera blocked — keeping sample video");
        await this.startSampleVideo();
      }
    }
  }

  stopCamera() {
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    const stream = this.video.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.video.srcObject = null;
    }
  }

  stopSampleVideo() {
    if (this.sampleHandle) {
      cancelAnimationFrame(this.sampleHandle);
      this.sampleHandle = null;
    }
    if (!this.video.paused) {
      this.video.pause();
    }
  }

  emitDimensions() {
    const width = this.video.videoWidth || DEFAULT_VIDEO_WIDTH;
    const height = this.video.videoHeight || DEFAULT_VIDEO_HEIGHT;
    this.onDimensions?.(width, height);
  }

  async waitForDimensions() {
    if (this.video.videoWidth && this.video.videoHeight) {
      return;
    }
    await new Promise((resolve) => {
      const handler = () => {
        if (this.video.videoWidth && this.video.videoHeight) {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        this.video.removeEventListener("loadeddata", handler);
        this.video.removeEventListener("loadedmetadata", handler);
        this.video.removeEventListener("resize", handler);
      };
      this.video.addEventListener("loadeddata", handler);
      this.video.addEventListener("loadedmetadata", handler);
      this.video.addEventListener("resize", handler);
    });
  }
}
