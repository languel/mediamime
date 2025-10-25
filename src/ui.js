import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.19/dist/lil-gui.esm.min.js";

export const defaultConfig = {
  particleCount: 900,
  particleSize: 4,
  particleAlpha: 0.88,
  trailFade: 0.28,
  renderStyle: "trails",
  showSource: false,
  sourceAlpha: 0.35,
  mirrorWebcam: true,
  mirrorOutput: true,
  usePose: true,
  useFace: true,
  useHands: true,
  useSegmentation: true,
  drawPose: true,
  drawFace: true,
  drawHands: true,
  drawSegmentation: false,
  voronoiSamples: 1400,
  voronoiInterval: 4,
  repulsionRadius: 28,
  weights: {
    density: 160,
    sampleBias: 55,
    attractor: 420,
    voronoi: 860,
    repulsion: 420,
    random: 0.45,
    speedLimit: 7.5
  }
};

function deepAssign(target, source) {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {};
      }
      deepAssign(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export function createControlUI(initialConfig, onChange) {
  const params = deepAssign({}, initialConfig);
  const container = document.getElementById("ui-container");
  const gui = new GUI({
    container,
    title: "Stipple Parameters"
  });

  const notifyChange = () => {
    onChange(params);
  };

  const particles = gui.addFolder("Particles");
  particles.add(params, "particleCount", 200, 2400, 50).name("Count").onFinishChange(notifyChange);
  particles.add(params, "particleSize", 1.5, 8, 0.1).name("Size").onChange(notifyChange);
  particles.add(params, "particleAlpha", 0.2, 1, 0.01).name("Opacity").onChange(notifyChange);

  const render = gui.addFolder("Render");
  render.add(params, "renderStyle", ["points", "trails", "glow"]).name("Style").onChange(notifyChange);
  render.add(params, "trailFade", 0.05, 0.8, 0.01).name("Trail Fade").onChange(notifyChange);
  render.add(params, "showSource").name("Draw Source Video").onChange((value) => {
    params.showSource = value;
    notifyChange();
  });
  render.add(params, "sourceAlpha", 0, 1, 0.05).name("Source Opacity").onChange(notifyChange);

  const features = gui.addFolder("Features");
  features.add(params, "usePose").name("Pose Influence").onChange(notifyChange);
  features.add(params, "drawPose").name("Pose Overlay").onChange(notifyChange);
  features.add(params, "useHands").name("Hands Influence").onChange(notifyChange);
  features.add(params, "drawHands").name("Hands Overlay").onChange(notifyChange);
  features.add(params, "useFace").name("Face Influence").onChange(notifyChange);
  features.add(params, "drawFace").name("Face Overlay").onChange(notifyChange);
  features.add(params, "useSegmentation").name("Segmentation Influence").onChange(notifyChange);
  features.add(params, "drawSegmentation").name("Segmentation Overlay").onChange(notifyChange);

  const forces = gui.addFolder("Forces");
  forces.add(params.weights, "density", 40, 360, 5).name("Density").onChange(notifyChange);
  forces.add(params.weights, "sampleBias", 0, 180, 5).name("Bright Pull").onChange(notifyChange);
  forces.add(params.weights, "attractor", 0, 1200, 10).name("Landmark Pull").onChange(notifyChange);
  forces.add(params.weights, "voronoi", 0, 1500, 10).name("Voronoi").onChange(notifyChange);
  forces.add(params.weights, "repulsion", 0, 800, 10).name("Repulsion").onChange(notifyChange);
  forces.add(params.weights, "random", 0, 3, 0.05).name("Random Walk").onChange(notifyChange);
  forces.add(params.weights, "speedLimit", 2, 20, 0.5).name("Speed Limit").onChange(notifyChange);

  const advanced = gui.addFolder("Advanced");
  advanced.add(params, "voronoiSamples", 200, 4000, 50).name("Voronoi Samples").onChange(notifyChange);
  advanced.add(params, "voronoiInterval", 1, 10, 1).name("Voronoi Interval").onChange(notifyChange);
  advanced.add(params, "repulsionRadius", 10, 60, 1).name("Repulsion Radius").onChange(notifyChange);

  particles.open();
  render.open();

  const reset = () => {
    deepAssign(params, JSON.parse(JSON.stringify(defaultConfig)));
    gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
    notifyChange();
  };

  return { params, gui, reset };
}
