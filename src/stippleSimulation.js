const DEFAULT_VIDEO_WIDTH = 960;
const DEFAULT_VIDEO_HEIGHT = 720;
const FIELD_DENSITY = 120 / 960;
const BASE_FILL = 0.02;

const SAFE_POSE_CONNECTIONS = typeof POSE_CONNECTIONS !== "undefined"
  ? POSE_CONNECTIONS
  : [
      [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 12], [23, 24], [11, 23], [12, 24],
      [23, 25], [25, 27], [24, 26], [26, 28],
      [27, 29], [28, 30]
    ];

const SAFE_HAND_CONNECTIONS = typeof HAND_CONNECTIONS !== "undefined"
  ? HAND_CONNECTIONS
  : [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17]
    ];

class Particle {
  constructor(simulation, initial = false) {
    this.sim = simulation;
    this.reset(initial);
  }

  reset(initial = false) {
    const sample = this.sim.sampleDensityPoint();
    if (sample) {
      this.x = sample.x;
      this.y = sample.y;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const radius = initial ? Math.random() * this.sim.width * 0.5 : this.sim.width * 0.5;
      this.x = this.sim.width * 0.5 + Math.cos(angle) * radius * Math.random() * 0.5;
      this.y = this.sim.height * 0.5 + Math.sin(angle) * radius * Math.random() * 0.5;
    }
    this.vx = 0;
    this.vy = 0;
  }

  step(dt, neighborForce, voronoiTarget) {
    const params = this.sim.paramsRef;
    if (!params) return;

    const sample = this.sim.sampleField(this.x, this.y);
    const grad = this.sim.sampleGradient(this.x, this.y);

    this.vx += grad.x * params.weights.density * dt;
    this.vy += grad.y * params.weights.density * dt;

    const sampleBias = sample - 0.5;
    this.vx += sampleBias * params.weights.sampleBias * dt;
    this.vy += sampleBias * params.weights.sampleBias * dt;

    if (params.weights.attractor > 0 && this.sim.attractorPoints.length) {
      const stride = Math.max(1, Math.floor(this.sim.attractorPoints.length / 120));
      let ax = 0;
      let ay = 0;
      let weightSum = 0;
      const maxDist = Math.min(this.sim.width, this.sim.height) * 0.5;
      const maxDistSq = maxDist * maxDist;
      for (let i = 0; i < this.sim.attractorPoints.length; i += stride) {
        const attractor = this.sim.attractorPoints[i];
        const dx = attractor.x - this.x;
        const dy = attractor.y - this.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 1 || distSq > maxDistSq) {
          continue;
        }
        const influence = attractor.w / distSq;
        ax += dx * influence;
        ay += dy * influence;
        weightSum += influence;
      }
      if (weightSum > 0) {
        const inv = 1 / weightSum;
        this.vx += ax * inv * params.weights.attractor * dt;
        this.vy += ay * inv * params.weights.attractor * dt;
      }
    }

    if (neighborForce && params.weights.repulsion > 0) {
      this.vx += neighborForce.x * params.weights.repulsion * dt;
      this.vy += neighborForce.y * params.weights.repulsion * dt;
    }

    if (voronoiTarget && params.weights.voronoi > 0) {
      this.vx += (voronoiTarget.x - this.x) * params.weights.voronoi * dt;
      this.vy += (voronoiTarget.y - this.y) * params.weights.voronoi * dt;
    }

    if (params.weights.random > 0) {
      this.vx += (Math.random() - 0.5) * params.weights.random * dt;
      this.vy += (Math.random() - 0.5) * params.weights.random * dt;
    }

    const damping = Math.pow(0.68, dt * 60);
    this.vx *= damping;
    this.vy *= damping;

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > params.weights.speedLimit) {
      const scale = params.weights.speedLimit / speed;
      this.vx *= scale;
      this.vy *= scale;
    }

    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0) {
      this.x = 0;
      this.vx *= -0.25;
    } else if (this.x > this.sim.width) {
      this.x = this.sim.width;
      this.vx *= -0.25;
    }

    if (this.y < 0) {
      this.y = 0;
      this.vy *= -0.25;
    } else if (this.y > this.sim.height) {
      this.y = this.sim.height;
      this.vy *= -0.25;
    }
  }
}

export class StippleSimulation {
  constructor(initialConfig, videoElement) {
    this.video = videoElement;
    this.paramsRef = initialConfig;
    this.width = DEFAULT_VIDEO_WIDTH;
    this.height = DEFAULT_VIDEO_HEIGHT;
    this.fieldCols = Math.max(60, Math.round(this.width * FIELD_DENSITY));
    this.fieldRows = Math.max(60, Math.round(this.height * FIELD_DENSITY));
    this.fieldBuffer = new Float32Array(this.fieldCols * this.fieldRows);
    this.densityCDF = new Float32Array(this.fieldBuffer.length);
    this.totalDensity = 0;

    this.maskCanvas = document.createElement("canvas");
    this.maskCtx = this.maskCanvas.getContext("2d");
    this.fieldCanvas = document.createElement("canvas");
    this.fieldCtx = this.fieldCanvas.getContext("2d");

    this.attractorPoints = [];
    this.fieldLandmarkInfluence = [];

    this.particles = [];
    this.voronoiTargets = [];
    this.centroidAccumX = new Float32Array(0);
    this.centroidAccumY = new Float32Array(0);
    this.centroidAccumWeight = new Float32Array(0);
    this.frameCounter = 0;
    this.lastDimensions = { width: this.width, height: this.height };
    this.latestResults = null;
    this.hasFrame = false;

    this.setDimensions(this.width, this.height);
    this.applyConfig(initialConfig);
  }

  applyConfig(config) {
    this.paramsRef = config;
    this.syncParticleCount(config.particleCount || 0);
  }

  syncParticleCount(count) {
    const desired = Math.max(0, Math.floor(count));
    const current = this.particles.length;
    if (desired === current) {
      return;
    }

    if (desired > current) {
      for (let i = current; i < desired; i++) {
        this.particles.push(new Particle(this, true));
        this.voronoiTargets.push({ x: 0, y: 0, valid: false });
      }
    } else {
      this.particles.length = desired;
      this.voronoiTargets.length = desired;
    }

    this.centroidAccumX = new Float32Array(desired);
    this.centroidAccumY = new Float32Array(desired);
    this.centroidAccumWeight = new Float32Array(desired);
  }

  setDimensions(width, height) {
    if (!width || !height) return;
    if (Math.abs(width - this.width) < 1 && Math.abs(height - this.height) < 1) {
      return;
    }
    this.width = width;
    this.height = height;
    this.fieldCols = Math.max(60, Math.round(this.width * FIELD_DENSITY));
    this.fieldRows = Math.max(60, Math.round(this.height * FIELD_DENSITY));

    this.maskCanvas.width = this.width;
    this.maskCanvas.height = this.height;
    this.fieldCanvas.width = this.fieldCols;
    this.fieldCanvas.height = this.fieldRows;
    this.fieldBuffer = new Float32Array(this.fieldCols * this.fieldRows);
    this.densityCDF = new Float32Array(this.fieldBuffer.length);
    this.totalDensity = 0;
    this.frameCounter = 0;

    this.particles.forEach((particle) => particle.reset(true));
    this.voronoiTargets.forEach((target) => {
      target.valid = false;
      target.x = 0;
      target.y = 0;
    });
    this.lastDimensions = { width: this.width, height: this.height };
  }

  getDimensions() {
    return { width: this.width, height: this.height };
  }

  handleResults(results) {
    this.latestResults = results;
    if (!results) return;
    this.updateFieldBuffer(results);
    this.updateAttractorPoints(results);
    this.hasFrame = true;
  }

  update(dt) {
    if (!this.paramsRef || !this.particles.length) {
      return;
    }

    if (this.video && this.video.videoWidth && this.video.videoHeight) {
      this.setDimensions(this.video.videoWidth, this.video.videoHeight);
    }

    if (this.totalDensity > 0 && this.paramsRef.weights.voronoi > 0) {
      if (this.frameCounter % Math.max(1, this.paramsRef.voronoiInterval || 1) === 0) {
        this.updateVoronoiTargets();
      }
    }
    this.frameCounter++;

    const repulsionRadius = this.paramsRef.repulsionRadius || 0;
    const repulsionData = repulsionRadius > 0 ? this.buildSpatialHash(repulsionRadius) : null;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const neighborForce = repulsionData ? this.computeRepulsionForce(i, repulsionData) : null;
      const voronoi = this.voronoiTargets[i] && this.voronoiTargets[i].valid ? this.voronoiTargets[i] : null;
      particle.step(dt, neighborForce, voronoi);
    }
  }

  render(p, { drawVideo, mirror, overlay }) {
    if (!this.paramsRef) return;
    const params = this.paramsRef;

    p.push();
    if (mirror) {
      p.translate(this.width, 0);
      p.scale(-1, 1);
    }

    if (params.renderStyle === "trails") {
      p.blendMode(p.BLEND);
      p.noStroke();
      p.fill(0, 0, 0, params.trailFade * 255);
      p.rect(0, 0, this.width, this.height);
    } else {
      p.background(4, 7, 13, params.renderStyle === "glow" ? 220 : 255);
    }

    if (drawVideo && this.video && this.video.readyState >= 2 && params.showSource) {
      const ctx = p.drawingContext;
      ctx.save();
      ctx.globalAlpha = params.sourceAlpha;
      ctx.drawImage(this.video, 0, 0, this.width, this.height);
      ctx.restore();
    }

    if (params.drawSegmentation && this.maskCanvas.width && this.maskCanvas.height) {
      const ctx = p.drawingContext;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(this.maskCanvas, 0, 0, this.width, this.height);
      ctx.restore();
    }

    p.noStroke();
    if (params.renderStyle === "glow") {
      p.blendMode(p.SCREEN);
    } else {
      p.blendMode(p.ADD);
    }

    const size = params.particleSize;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      p.fill(215, 235, 255, params.particleAlpha * 255);
      p.circle(particle.x, particle.y, size);
    }

    p.blendMode(p.BLEND);

    if (overlay && this.latestResults) {
      this.drawLandmarks(p, overlay);
    }

    p.pop();
  }

  drawLandmarks(p, overlay) {
    const { poseLandmarks, leftHandLandmarks, rightHandLandmarks, faceLandmarks } = this.latestResults;
    const params = this.paramsRef;
    if (params.drawPose && overlay.pose && poseLandmarks) {
      this.drawConnections(p, poseLandmarks, SAFE_POSE_CONNECTIONS, "#368bff", 2.2);
    }
    if (params.drawHands && overlay.hands) {
      if (leftHandLandmarks) {
        this.drawConnections(p, leftHandLandmarks, SAFE_HAND_CONNECTIONS, "#ff8ad6", 1.6);
      }
      if (rightHandLandmarks) {
        this.drawConnections(p, rightHandLandmarks, SAFE_HAND_CONNECTIONS, "#ff8ad6", 1.6);
      }
    }
    if (params.drawFace && overlay.face && faceLandmarks) {
      const step = faceLandmarks.length >= 468 ? 4 : 1;
      p.noFill();
      p.stroke("#6ad5ff");
      p.strokeWeight(1);
      p.beginShape(p.POINTS);
      for (let i = 0; i < faceLandmarks.length; i += step) {
        const lm = faceLandmarks[i];
        p.vertex(lm.x * this.width, lm.y * this.height);
      }
      p.endShape();
    }
  }

  drawConnections(p, landmarks, connections, color, weight) {
    p.stroke(color);
    p.strokeWeight(weight);
    for (let i = 0; i < connections.length; i++) {
      const [startIndex, endIndex] = connections[i];
      const start = landmarks[startIndex];
      const end = landmarks[endIndex];
      if (!start || !end) continue;
      p.line(start.x * this.width, start.y * this.height, end.x * this.width, end.y * this.height);
    }
  }

  buildSpatialHash(cellSize) {
    const grid = new Map();
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const cx = Math.floor(particle.x / cellSize);
      const cy = Math.floor(particle.y / cellSize);
      const key = `${cx}|${cy}`;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(i);
    }
    return { grid, cellSize };
  }

  computeRepulsionForce(index, hashData) {
    const { grid, cellSize } = hashData;
    const particle = this.particles[index];
    const cx = Math.floor(particle.x / cellSize);
    const cy = Math.floor(particle.y / cellSize);
    const radiusSq = cellSize * cellSize;
    let rx = 0;
    let ry = 0;
    let contributions = 0;

    for (let ny = cy - 1; ny <= cy + 1; ny++) {
      for (let nx = cx - 1; nx <= cx + 1; nx++) {
        const bucket = grid.get(`${nx}|${ny}`);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const otherIndex = bucket[i];
          if (otherIndex === index) continue;
          const other = this.particles[otherIndex];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= 0 || distSq > radiusSq) continue;
          const dist = Math.sqrt(distSq);
          const strength = (cellSize - dist) / cellSize;
          rx += (dx / dist) * strength;
          ry += (dy / dist) * strength;
          contributions++;
        }
      }
    }

    if (!contributions) {
      return null;
    }

    const scale = 1 / Math.max(1, contributions);
    return { x: rx * scale, y: ry * scale };
  }

  updateVoronoiTargets() {
    const sampleCount = Math.max(50, Math.floor(this.paramsRef.voronoiSamples || 1000));
    if (!this.densityCDF || this.totalDensity <= 0 || !this.particles.length) {
      return;
    }

    this.centroidAccumX.fill(0);
    this.centroidAccumY.fill(0);
    this.centroidAccumWeight.fill(0);
    this.voronoiTargets.forEach((target) => {
      target.valid = false;
    });

    for (let i = 0; i < sampleCount; i++) {
      const sample = this.sampleDensityPoint();
      if (!sample) continue;
      const nearestIndex = this.findNearestParticle(sample.x, sample.y);
      if (nearestIndex === -1) continue;
      const weight = Math.max(sample.weight, 0.0001);
      this.centroidAccumX[nearestIndex] += sample.x * weight;
      this.centroidAccumY[nearestIndex] += sample.y * weight;
      this.centroidAccumWeight[nearestIndex] += weight;
    }

    for (let i = 0; i < this.voronoiTargets.length; i++) {
      const weight = this.centroidAccumWeight[i];
      if (weight === 0) continue;
      const target = this.voronoiTargets[i];
      target.x = this.centroidAccumX[i] / weight;
      target.y = this.centroidAccumY[i] / weight;
      target.valid = true;
    }
  }

  sampleDensityPoint() {
    if (!this.densityCDF || this.totalDensity <= 0) {
      return null;
    }
    const r = Math.random();
    let low = 0;
    let high = this.densityCDF.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.densityCDF[mid] < r) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    const index = low;
    const weight = this.fieldBuffer[index];
    if (weight <= 0) {
      return null;
    }
    const col = index % this.fieldCols;
    const row = (index - col) / this.fieldCols;
    const x = ((col + Math.random()) / this.fieldCols) * this.width;
    const y = ((row + Math.random()) / this.fieldRows) * this.height;
    return { x, y, weight };
  }

  findNearestParticle(x, y) {
    let bestIndex = -1;
    let bestDistSq = Infinity;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const dx = particle.x - x;
      const dy = particle.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIndex = i;
        if (distSq === 0) {
          return bestIndex;
        }
      }
    }
    return bestIndex;
  }

  updateAttractorPoints(results) {
    this.attractorPoints.length = 0;
    if (!results) return;
    const params = this.paramsRef;

    const push = (landmarks, weight, stride = 1) => {
      if (!landmarks) return;
      for (let i = 0; i < landmarks.length; i += stride) {
        const lm = landmarks[i];
        this.attractorPoints.push({
          x: lm.x * this.width,
          y: lm.y * this.height,
          w: weight
        });
      }
    };

    if (params.usePose) {
      push(results.poseLandmarks, 1.2, 1);
    }
    if (params.useHands) {
      push(results.leftHandLandmarks, 1.6, 1);
      push(results.rightHandLandmarks, 1.6, 1);
    }
    if (params.useFace) {
      push(results.faceLandmarks, 0.3, 4);
    }
  }

  updateFieldBuffer(results) {
    const params = this.paramsRef;
    const { segmentationMask } = results;

    this.fieldCtx.globalCompositeOperation = "copy";
    if (segmentationMask && params.useSegmentation) {
      this.maskCtx.save();
      this.maskCtx.globalCompositeOperation = "copy";
      this.maskCtx.drawImage(segmentationMask, 0, 0, this.width, this.height);
      this.maskCtx.restore();
      this.fieldCtx.drawImage(this.maskCanvas, 0, 0, this.fieldCols, this.fieldRows);
    } else {
      this.maskCtx.clearRect(0, 0, this.width, this.height);
      this.fieldCtx.clearRect(0, 0, this.fieldCols, this.fieldRows);
    }

    const imageData = this.fieldCtx.getImageData(0, 0, this.fieldCols, this.fieldRows);
    const { data } = imageData;
    const len = this.fieldCols * this.fieldRows;
    const maskValues = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      maskValues[i] = data[i * 4] / 255;
    }

    this.fieldBuffer.fill(BASE_FILL);
    if (params.useSegmentation) {
      for (let i = 0; i < len; i++) {
        this.fieldBuffer[i] = Math.max(this.fieldBuffer[i], maskValues[i] * 0.9);
      }
    }

    this.fieldLandmarkInfluence.length = 0;
    const pushInfluence = (landmarks, weight, stride = 1) => {
      if (!landmarks) return;
      for (let i = 0; i < landmarks.length; i += stride) {
        const lm = landmarks[i];
        this.fieldLandmarkInfluence.push({
          x: lm.x * this.fieldCols,
          y: lm.y * this.fieldRows,
          w: weight
        });
      }
    };

    if (params.usePose) {
      pushInfluence(results.poseLandmarks, 0.9, 1);
    }
    if (params.useFace) {
      pushInfluence(results.faceLandmarks, 0.25, 3);
    }
    if (params.useHands) {
      pushInfluence(results.leftHandLandmarks, 1.5, 1);
      pushInfluence(results.rightHandLandmarks, 1.5, 1);
    }

    if (this.fieldLandmarkInfluence.length) {
      const radius = Math.max(4, Math.round(6 * (this.fieldCols / 120)));
      const falloff = 1 / (radius * radius);
      for (const { x, y, w } of this.fieldLandmarkInfluence) {
        const minX = Math.max(0, Math.floor(x - radius));
        const maxX = Math.min(this.fieldCols - 1, Math.ceil(x + radius));
        const minY = Math.max(0, Math.floor(y - radius));
        const maxY = Math.min(this.fieldRows - 1, Math.ceil(y + radius));
        for (let iy = minY; iy <= maxY; iy++) {
          for (let ix = minX; ix <= maxX; ix++) {
            const dx = ix - x;
            const dy = iy - y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 <= radius * radius) {
              const influence = w * Math.exp(-dist2 * falloff);
              const index = iy * this.fieldCols + ix;
              this.fieldBuffer[index] = Math.min(1, this.fieldBuffer[index] + influence);
            }
          }
        }
      }
    }

    let min = 1;
    let max = 0;
    for (let i = 0; i < len; i++) {
      const value = this.fieldBuffer[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const range = Math.max(0.0001, max - min);
    for (let i = 0; i < len; i++) {
      this.fieldBuffer[i] = (this.fieldBuffer[i] - min) / range;
    }

    if (!this.densityCDF || this.densityCDF.length !== len) {
      this.densityCDF = new Float32Array(len);
    }
    this.totalDensity = 0;
    for (let i = 0; i < len; i++) {
      this.totalDensity += this.fieldBuffer[i];
    }
    if (this.totalDensity <= 0) {
      this.densityCDF.fill(0);
    } else {
      let cumulative = 0;
      for (let i = 0; i < len; i++) {
        cumulative += this.fieldBuffer[i] / this.totalDensity;
        this.densityCDF[i] = cumulative;
      }
      this.densityCDF[len - 1] = 1;
    }
  }

  sampleField(x, y) {
    if (!this.fieldBuffer.length) return 0;
    const fx = (x / this.width) * (this.fieldCols - 1);
    const fy = (y / this.height) * (this.fieldRows - 1);

    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;

    const idx = (cx, cy) =>
      this.fieldBuffer[
        Math.min(this.fieldRows - 1, Math.max(0, cy)) * this.fieldCols +
          Math.min(this.fieldCols - 1, Math.max(0, cx))
      ];

    const a = idx(ix, iy);
    const b = idx(ix + 1, iy);
    const c = idx(ix, iy + 1);
    const d = idx(ix + 1, iy + 1);

    return (
      a * (1 - tx) * (1 - ty) +
      b * tx * (1 - ty) +
      c * (1 - tx) * ty +
      d * tx * ty
    );
  }

  sampleGradient(x, y) {
    const epsilon = Math.max(2, 4 * (this.width / DEFAULT_VIDEO_WIDTH));
    const vL = this.sampleField(x - epsilon, y);
    const vR = this.sampleField(x + epsilon, y);
    const vT = this.sampleField(x, y - epsilon);
    const vB = this.sampleField(x, y + epsilon);
    return { x: (vR - vL) * 0.5, y: (vB - vT) * 0.5 };
  }
}
