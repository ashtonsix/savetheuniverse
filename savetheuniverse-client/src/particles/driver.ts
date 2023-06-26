import GUI, { Controller } from "lil-gui";
import { Core } from "./core";

const { random, floor, max, cos, sin, PI, E } = Math;

function updateDisplay(gui: GUI, ...controllers: string[]) {
  let set = new Set(controllers);
  for (let c of gui.controllersRecursive()) {
    if (set.has(c._name)) c.updateDisplay();
  }
}

const maxDensity = Math.PI / (2 * 3 ** 0.5);

export class Driver {
  core: Core;
  gui: { [key: string]: GUI } = {};
  guic: { [key: string]: Controller } = {};
  timeControl = {
    "iters per frame": 10,
    "log(step size)": 0,
    "frames per second": 60,
    step: () => {
      this.core.frame();
    },
    "play / pause": () => {
      this.core.ticker.playing = !this.core.ticker.playing;
    },
  };
  particles = {
    "pseudo-elasticity": 1,
    "log(radius)": -4.25,
    count: 0,
    density: 0.4,
    reset: () => {
      const { n, r, x_x, x_y, v_x, v_y } = this.core.particles;
      for (let i = 0; i < n; i++) {
        let [x, y] = this.core.boundary.sampleInside(r);
        x_x[i] = x;
        x_y[i] = y;
        let d = random() * PI * 2;
        v_x[i] = cos(d);
        v_y[i] = sin(d);
      }
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
    smoothing: 0,
    shapeCount: 0,
    "add shape": () => {
      const all = this.boundary.shapes;
      const last = all[all.length - 1];
      const shape = last
        ? this.addBoundaryShape(
            true,
            max(0.1, last.r - 0.1),
            last.cx + 0.3,
            last.cy + 0.1
          )
        : this.addBoundaryShape(true, -0.3, 0, 0.5);
      this.updateBoundary();
      shape.gui.onFinishChange(this.updateBoundary.bind(this));
    },
    shapes: [] as {
      solid: boolean;
      cx: number;
      cy: number;
      r: number;
      gui: GUI;
      "remove shape": () => void;
    }[],
  };
  constructor(public container: HTMLElement) {
    this.gui.root = new GUI({ container });
    this.core = null as unknown as Core;

    this.gui.timeControl = this.gui.root.addFolder("Time Control");
    const timeControl = this.gui.timeControl;
    timeControl.onChange(this.updateTimeControl.bind(this));
    timeControl.add(this.timeControl, "iters per frame", 1, 50, 1);
    this.timeControl["log(step size)"] = this.particles["log(radius)"] - 1.75;
    this.guic.stepSize = timeControl.add(
      this.timeControl,
      "log(step size)",
      this.particles["log(radius)"] - 4,
      this.particles["log(radius)"] - 0.5
    );
    timeControl.add(
      this.timeControl,
      "frames per second",
      [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60]
    );
    timeControl.add(this.timeControl, "step");
    timeControl.add(this.timeControl, "play / pause");

    this.gui.particles = this.gui.root.addFolder("Particles");
    const particles = this.gui.particles;
    particles.onChange(this.updateParticles.bind(this));
    particles.add(this.particles, "pseudo-elasticity", 0, 1.5);
    let prevLogRadius = this.particles["log(radius)"];
    particles.add(this.particles, "log(radius)", -6.5, -3).onChange(() => {
      this.timeControl["log(step size)"] +=
        this.particles["log(radius)"] - prevLogRadius;
      this.guic.stepSize.min(this.particles["log(radius)"] - 4);
      this.guic.stepSize.max(this.particles["log(radius)"] - 0.5);
      prevLogRadius = this.particles["log(radius)"];
      updateDisplay(this.gui.timeControl, "log(step size)");
      this.updateTimeControl();
      this.particles.count = this.densityToCount();
      this.guic.particleCount.max(this.densityToCount(maxDensity));
      updateDisplay(this.gui.particles, "count");
      this.updateParticles();
    });
    this.guic.particleCount = particles.add(this.particles, "count", 0, 10_000);
    this.guic.particleCount.onChange(() => {
      this.particles.density = this.countToDensity();
      updateDisplay(this.gui.particles, "density");
      this.updateParticles();
    });
    particles.add(this.particles, "density", 0, maxDensity).onChange(() => {
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
    boundary.close();
    boundary.onFinishChange(this.updateBoundary.bind(this));
    boundary.add(this.boundary, "smoothing", 0, 0.1);
    boundary.add(this.boundary, "add shape");
    this.boundary["add shape"]();
  }
  destroy() {
    this.gui.root.destroy();
  }
  addBoundaryShape(solid: boolean, cx: number, cy: number, r: number) {
    const shapes = this.boundary.shapes;
    const shape = {
      gui: this.gui.boundary.addFolder(`shape ${++this.boundary.shapeCount}`),
      solid,
      r,
      cx,
      cy,
      "remove shape": () => {
        shape.gui.destroy();
        shapes.splice(shapes.indexOf(shape), 1);
        this.updateBoundary();
      },
    };
    shape.gui.add(shape, "solid");
    shape.gui.add(shape, "cx", -1, 1);
    shape.gui.add(shape, "cy", -1, 1);
    shape.gui.add(shape, "r", 0, 1);
    shape.gui.add(shape, "remove shape");
    shapes.push(shape);
    return shape;
  }
  countToDensity(value?: number) {
    const p = this.particles;
    value = value || p.count;
    const r = E ** p["log(radius)"];
    const particleArea = r * r * PI;
    const boundaryArea = this.core.boundary.area;
    return (particleArea * value) / boundaryArea;
  }
  densityToCount(value?: number) {
    const p = this.particles;
    value = value || p.density;
    const r = E ** p["log(radius)"];
    const particleArea = r * r * PI;
    const boundaryArea = this.core.boundary.area;
    return floor((boundaryArea * value) / particleArea);
  }
  init(core: Core) {
    this.core = core;
    this.updateTimeControl();
    this.updateBoundary();
    const p = this.particles;
    const r = E ** p["log(radius)"];
    const particleArea = r * r * PI;
    const boundaryArea = this.core.boundary.area;
    p.count = floor((boundaryArea * p.density) / particleArea);
    for (let c of this.gui.particles.controllers) c.updateDisplay();
    this.updateParticles();
  }
  updateTimeControl() {
    const tc = this.timeControl;
    const iterStepSize = E ** tc["log(step size)"] / tc["iters per frame"];
    this.core.ticker.interval = floor(60 / tc["frames per second"]);
    this.core.simulationStepSize = iterStepSize;
    this.core.simulationStepsPerFrame = tc["iters per frame"];
  }
  updateParticles() {
    const p = this.particles;
    this.core.particles.E = p["pseudo-elasticity"];
    this.core.updateParticleRadius(E ** p["log(radius)"]);
    this.core.updateParticles(p.count, (i: number, n: number) => {
      const { r, x_x, x_y, v_x, v_y } = this.core.particles;
      for (; i < n; i++) {
        let [x, y] = this.core.boundary.sampleInside(r);
        x_x[i] = x;
        x_y[i] = y;
        let d = random() * PI * 2;
        v_x[i] = cos(d);
        v_y[i] = sin(d);
      }
    });
  }
  updateBoundary() {
    if (!this.core) return;
    // const solid: number[][] = [];
    // const hole: number[][] = [];
    // for (const s of b.shapes) {
    //   if (s.solid) solid.push([s.cx, s.cy, s.r]);
    //   else hole.push([s.cx, s.cy, s.r]);
    // }
    // const sdf = distanceFunctionFactory(solid, hole, b.smoothing);
    // this.core.updateBoundary(sdf);
    this.boundaryArea = this.core.boundary.area;
    if (this.particles.count) this.particles.density = this.countToDensity();
    this.guic.particleCount.max(this.densityToCount(maxDensity));
    updateDisplay(this.gui.particles, "count", "density");
  }
}
