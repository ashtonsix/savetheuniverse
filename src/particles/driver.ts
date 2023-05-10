import GUI, { Controller } from "lil-gui";
import {
  ShapeType,
  distanceFunctionFactory,
  estimateArea,
  sampleInside,
} from "../common/field";
import { Core } from "./core";

const DEFAULT_SHAPE = { type: ShapeType.SOLID, params: [0, 0, 0.5] };
const { random, cos, sin, PI } = Math;

function updateDisplay(gui: GUI, ...controllers: string[]) {
  let set = new Set(controllers);
  for (let c of gui.controllersRecursive()) {
    if (set.has(c._name)) c.updateDisplay();
  }
}

export class Driver {
  core: Core;
  boundaryArea = 0;
  gui: { [key: string]: GUI } = {};
  guic: { [key: string]: Controller } = {};
  timeControl = {
    "iters per frame": 10,
    "frames per second": 60,
    "frame step size": 0.001,
    step: () => {
      this.core.frame();
    },
    "play / pause": () => {
      this.core.ticker.playing = !this.core.ticker.playing;
    },
  };
  particles = {
    "pseudo-elasticity": 1,
    radius: 0.01,
    count: 0,
    density: 0.35,
    reset: () => {
      const b = this.core.boundary;
      const { n, r, x_x, x_y, v_x, v_y } = this.core.particles;
      sampleInside(b, n, r, (x: number, y: number, i: number) => {
        x_x[i] = x;
        x_y[i] = y;
        let d = random() * PI * 2;
        v_x[i] = cos(d);
        v_y[i] = sin(d);
      });
    },
    randomise: () => {
      this.core.updateParticles(undefined, () => {
        const { n, v_x, v_y } = this.core.particles;
        for (let i = 0; i < n; i++) {
          let d = random() * PI * 2;
          v_x[i] = cos(d);
          v_y[i] = sin(d);
        }
      });
    },
    reverse: () => {
      this.core.updateParticles(undefined, () => {
        const { n, v_x, v_y } = this.core.particles;
        for (let i = 0; i < n; i++) {
          v_x[i] *= -1;
          v_y[i] *= -1;
        }
      });
    },
  };
  boundary = {
    smoothing: 0.01,
    addShape: () => {
      // this.boundary.shapes.push({ ...DEFAULT_SHAPE });
    },
    shapes: [
      { ...DEFAULT_SHAPE },
      { type: ShapeType.SOLID, params: [0.5, 0, 0.2] },
    ],
  };
  constructor(public container: HTMLElement) {
    this.gui.root = new GUI({ container });
    this.core = null as unknown as Core;

    this.gui.timeControl = this.gui.root.addFolder("Time Control");
    const timeControl = this.gui.timeControl;
    timeControl.onChange(this.updateTimeControl.bind(this));
    timeControl.add(this.timeControl, "iters per frame", 1, 50, 1);
    timeControl.add(this.timeControl, "frame step size", 0.0002, 0.002);
    timeControl.add(
      this.timeControl,
      "frames per second",
      [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60]
    );
    timeControl.add(this.timeControl, "play / pause");

    this.gui.particles = this.gui.root.addFolder("Particles");
    const particles = this.gui.particles;
    particles.onChange(this.updateParticles.bind(this));
    particles.add(this.particles, "pseudo-elasticity", 0, 1.5, 0.01);
    particles.add(this.particles, "radius", 0.001, 0.1).onChange(() => {
      this.particles.count = this.densityToCount();
      this.guic.particleCount.max(this.densityToCount(1));
      updateDisplay(this.gui.particles, "count");
      this.updateParticles();
    });
    this.guic.particleCount = particles.add(this.particles, "count", 0, 10_000);
    this.guic.particleCount.onChange(() => {
      this.particles.density = this.countToDensity();
      updateDisplay(this.gui.particles, "density");
      this.updateParticles();
    });
    particles.add(this.particles, "density", 0, 1).onChange(() => {
      const count = this.densityToCount();
      this.particles.count = count;
      updateDisplay(this.gui.particles, "count");
      this.updateParticles();
    });
    particles.add(this.particles, "reset");
    particles.add(this.particles, "randomise");
    particles.add(this.particles, "reverse");

    this.gui.boundary = this.gui.root.addFolder("Boundary");
    const boundary = this.gui.boundary;
    boundary.onFinishChange(this.updateBoundary.bind(this));
    boundary.add(this.boundary, "smoothing", 0, 0.1);
    boundary.add(this.boundary, "addShape");
  }
  countToDensity(value?: number) {
    const p = this.particles;
    value = value || p.count;
    const particleArea = p.radius * p.radius * Math.PI;
    return (particleArea * value) / this.boundaryArea;
  }
  densityToCount(value?: number) {
    const p = this.particles;
    value = value || p.density;
    const particleArea = p.radius * p.radius * Math.PI;
    return Math.floor((this.boundaryArea * value) / particleArea);
  }
  init(core: Core) {
    this.core = core;
    this.updateTimeControl();
    this.updateBoundary();
    const p = this.particles;
    const particleArea = p.radius * p.radius * Math.PI;
    p.count = Math.floor((this.boundaryArea * p.density) / particleArea);
    for (let c of this.gui.particles.controllers) c.updateDisplay();
    this.updateParticles();
  }
  updateTimeControl() {
    const tc = this.timeControl;
    const iterStepSize = tc["frame step size"] / tc["iters per frame"];
    this.core.ticker.interval = Math.floor(60 / tc["frames per second"]);
    this.core.simulationStepSize = iterStepSize;
    this.core.simulationStepsPerFrame = tc["iters per frame"];
  }
  updateParticles() {
    const p = this.particles;
    this.core.particles.E = p["pseudo-elasticity"];
    this.core.updateParticleRadius(p.radius);
    this.core.updateParticles(p.count, (i: number, n: number) => {
      const { r, x_x, x_y, v_x, v_y } = this.core.particles;
      sampleInside(
        this.core.boundary,
        n - i,
        r,
        (x: number, y: number, j: number) => {
          x_x[i + j] = x;
          x_y[i + j] = y;
          let d = Math.random() * Math.PI * 2;
          v_x[i + j] = Math.cos(d);
          v_y[i + j] = Math.sin(d);
        }
      );
    });
  }
  updateBoundary() {
    const b = this.boundary;
    const sdf = distanceFunctionFactory(b.shapes, b.smoothing);
    this.core.updateBoundary(sdf);
    this.boundaryArea = estimateArea(sdf);
    if (this.particles.count) this.particles.density = this.countToDensity();
    this.guic.particleCount.max(this.densityToCount(1));
    updateDisplay(this.gui.particles, "count", "density");
  }
}
