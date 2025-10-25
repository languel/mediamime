import { MediaPipeManager } from "./mediapipeManager.js";
import { StippleSimulation } from "./stippleSimulation.js";
import { createControlUI, defaultConfig } from "./ui.js";

const videoElement = document.getElementById("input-video");
const statusLabel = document.getElementById("status-label");
const overlayText = document.getElementById("overlay-text");
const statusOverlay = document.getElementById("status-overlay");
const sourceToggle = document.getElementById("source-toggle");
const resetButton = document.getElementById("reset-controls");
const videoCheckbox = document.getElementById("toggle-video-visibility");
const mirrorCheckbox = document.getElementById("toggle-mirror");
const sketchContainer = document.getElementById("sketch-container");

let simulation = null;

const ui = createControlUI(defaultConfig, (updated) => {
  simulation?.applyConfig(updated);
  videoCheckbox.checked = updated.showSource;
});

const config = ui.params;
config.mirrorOutput = config.mirrorWebcam;

videoCheckbox.checked = config.showSource;
mirrorCheckbox.checked = config.mirrorWebcam;

simulation = new StippleSimulation(config, videoElement);
simulation.applyConfig(config);

const sourceManager = new MediaPipeManager(videoElement, {
  onResults: (results) => {
    simulation.handleResults(results);
    if (statusOverlay && !statusOverlay.classList.contains("hidden")) {
      statusOverlay.classList.add("hidden");
    }
  },
  onStatus: (text) => {
    statusLabel.textContent = text;
    if (overlayText) {
      overlayText.textContent = text;
    }
  },
  onSourceChange: (source) => {
    sourceToggle.textContent = source === "camera" ? "Use Sample Dance Video" : "Use Live Camera";
    config.mirrorOutput = source === "camera" ? config.mirrorWebcam : false;
    mirrorCheckbox.disabled = source !== "camera";
    simulation.applyConfig(config);
  },
  onDimensions: (width, height) => {
    simulation.setDimensions(width, height);
    if (p5Instance) {
      p5Instance.resizeCanvas(width, height);
    }
  }
});

sourceToggle.addEventListener("click", async () => {
  sourceToggle.disabled = true;
  statusOverlay.classList.remove("hidden");
  overlayText.textContent = "Switching source…";
  await sourceManager.toggleSource();
  sourceToggle.disabled = false;
});

resetButton.addEventListener("click", () => {
  ui.reset();
  config.mirrorOutput = sourceManager.currentSource === "camera" ? config.mirrorWebcam : false;
  videoCheckbox.checked = config.showSource;
  mirrorCheckbox.checked = config.mirrorWebcam;
  simulation.applyConfig(config);
});

videoCheckbox.addEventListener("change", (event) => {
  config.showSource = event.target.checked;
  simulation.applyConfig(config);
  ui.gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
});

mirrorCheckbox.addEventListener("change", (event) => {
  config.mirrorWebcam = event.target.checked;
  config.mirrorOutput = sourceManager.currentSource === "camera" ? config.mirrorWebcam : false;
  simulation.applyConfig(config);
});

let p5Instance = null;
let lastTime = performance.now();

const overlayConfig = {
  pose: true,
  hands: true,
  face: true
};

p5Instance = new p5((p) => {
  p.setup = () => {
    const { width, height } = simulation.getDimensions();
    const canvas = p.createCanvas(width, height);
    canvas.parent(sketchContainer);
    p.noStroke();
    p.frameRate(60);
    p.background(4, 7, 13);
  };

  p.draw = () => {
    const { width, height } = simulation.getDimensions();
    if (p.width !== width || p.height !== height) {
      p.resizeCanvas(width, height);
    }

    overlayConfig.pose = config.drawPose;
    overlayConfig.hands = config.drawHands;
    overlayConfig.face = config.drawFace;

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    simulation.update(dt);
    simulation.render(p, {
      drawVideo: config.showSource,
      mirror: config.mirrorOutput,
      overlay: overlayConfig
    });
  };
});

async function startSources() {
  try {
    await sourceManager.initialize();
  } catch (err) {
    console.error("Failed to initialise MediaPipe sources", err);
    statusLabel.textContent = "Unable to start sources";
    overlayText.textContent = "MediaPipe init failed";
  }
}

startSources();
