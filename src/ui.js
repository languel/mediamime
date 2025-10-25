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
  drawSegmentation: true,
  voronoiSamples: 1400,
  voronoiInterval: 4,
  repulsionRadius: 28,
  viscosity: 0.35,
  enableCollisions: false,
  collisionFriction: 0.15,
  collisionRestitution: 0.35,
  weights: {
    density: 160,
    sampleBias: 55,
    attractor: 320,
    voronoi: 860,
    repulsion: 420,
    random: 0.45,
    speedLimit: 7.5
  },
  featureForces: {
    pose: 1,
    hands: 1,
    face: 1,
    segmentation: 1
  },
  featureOpacity: {
    pose: 0.85,
    hands: 0.85,
    face: 0.75,
    segmentation: 0.28
  },
  featureColors: {
    pose: "#368bff",
    hands: "#ff8ad6",
    face: "#6ad5ff",
    segmentation: "#0f8ba8"
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

  const addNumericInput = (folder, object, key, label) => {
    const controller = folder.add(object, key).name(label);
    controller.onFinishChange((value) => {
      const parsed = parseFloat(value);
      if (!Number.isFinite(parsed)) {
        return;
      }
      object[key] = parsed;
      notifyChange();
    });
    return controller;
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

  const featureForces = features.addFolder("Feature Forces");
  addNumericInput(featureForces, params.featureForces, "pose", "Pose Multiplier");
  addNumericInput(featureForces, params.featureForces, "hands", "Hands Multiplier");
  addNumericInput(featureForces, params.featureForces, "face", "Face Multiplier");
  addNumericInput(featureForces, params.featureForces, "segmentation", "Segmentation Multiplier");

  const featureOpacity = features.addFolder("Feature Opacity");
  featureOpacity.add(params.featureOpacity, "pose", 0, 1, 0.01).name("Pose Opacity").onChange(notifyChange);
  featureOpacity.add(params.featureOpacity, "hands", 0, 1, 0.01).name("Hands Opacity").onChange(notifyChange);
  featureOpacity.add(params.featureOpacity, "face", 0, 1, 0.01).name("Face Opacity").onChange(notifyChange);
  featureOpacity.add(params.featureOpacity, "segmentation", 0, 1, 0.01).name("Segmentation Opacity").onChange(notifyChange);

  const featureColors = features.addFolder("Feature Colors");
  featureColors.addColor(params.featureColors, "pose").name("Pose Color").onChange(notifyChange);
  featureColors.addColor(params.featureColors, "hands").name("Hands Color").onChange(notifyChange);
  featureColors.addColor(params.featureColors, "face").name("Face Color").onChange(notifyChange);
  featureColors.addColor(params.featureColors, "segmentation").name("Segmentation Color").onChange(notifyChange);

  const forces = gui.addFolder("Forces");
  addNumericInput(forces, params.weights, "density", "Density");
  addNumericInput(forces, params.weights, "sampleBias", "Bright Pull");
  addNumericInput(forces, params.weights, "attractor", "Landmark Pull");
  addNumericInput(forces, params.weights, "voronoi", "Voronoi");
  addNumericInput(forces, params.weights, "repulsion", "Repulsion");
  addNumericInput(forces, params.weights, "random", "Random Walk");
  addNumericInput(forces, params.weights, "speedLimit", "Speed Limit");

  const dynamics = gui.addFolder("Dynamics");
  addNumericInput(dynamics, params, "viscosity", "Viscosity Base");
  addNumericInput(dynamics, params, "repulsionRadius", "Repulsion Radius");

  const collisions = dynamics.addFolder("Collisions");
  collisions.add(params, "enableCollisions").name("Enable p2p collisions").onChange(notifyChange);
  addNumericInput(collisions, params, "collisionFriction", "Collision Friction");
  addNumericInput(collisions, params, "collisionRestitution", "Collision Restitution");

  const advanced = gui.addFolder("Advanced");
  addNumericInput(advanced, params, "voronoiSamples", "Voronoi Samples");
  advanced.add(params, "voronoiInterval", 1, 10, 1).name("Voronoi Interval").onChange(notifyChange);

  particles.open();
  render.open();

  const reset = () => {
    deepAssign(params, JSON.parse(JSON.stringify(defaultConfig)));
    gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
    notifyChange();
  };

  return { params, gui, reset };
}
