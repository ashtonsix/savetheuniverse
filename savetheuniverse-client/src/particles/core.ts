import { Ticker } from "../common/ticker";
import { BoundaryViz, ParticleViz } from "./viz";
import { ParticleDetector, collideParticles } from "./particles";
import { Boundary, collideBoundary } from "./boundary";
import { Driver } from "./driver";

const { ceil, abs, min, max, log2 } = Math;

const boundaries = {
  circle(x: number, y: number) {
    const r = 0.5;
    const cx = -0.3;
    const cy = 0;
    return ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 - r;
  },
  box(x: number, y: number) {
    const rx = -0.3;
    const ry = 0;
    const w = 0.65;
    const h = 0.5;
    x = abs(x - rx) - w;
    y = abs(y - ry) - h;
    const dx = max(x, 0);
    const dy = max(y, 0);
    return (dx ** 2 + dy ** 2) ** 0.5 + min(max(x, y), 0);
  },
};

export class Core {
  simulationStepSize = 1;
  simulationStepsPerFrame = 1;
  ticker = new Ticker(() => {}, 1000 / 60);
  particles = {
    n: 0, // count
    r: 1, // radius
    E: 1, // elasticity
    x_x: new Float64Array(),
    x_y: new Float64Array(),
    v_x: new Float64Array(),
    v_y: new Float64Array(),
  };
  particleDisplacementBuffer = {
    D_x: new Float64Array(),
    D_y: new Float64Array(),
  };
  boundary: Boundary;
  particleCollisionDetector: ParticleDetector;
  boundaryViz: BoundaryViz;
  particleViz: ParticleViz;

  constructor(public driver: Driver, public container: HTMLElement) {
    this.ticker = new Ticker(this.frame.bind(this), 1);
    this.boundaryViz = new BoundaryViz(this, container);
    this.particleViz = new ParticleViz(this, container);
    this.boundary = new Boundary(boundaries.circle);
    this.particleCollisionDetector = new ParticleDetector(this);
    driver.init(this);
  }
  destroy() {
    this.ticker.destroy();
    this.boundaryViz.destroy();
    this.particleViz.destroy();
    this.container.innerHTML = "";
  }
  updateParticleRadius(particleRadius: number) {
    this.particles.r = particleRadius;
    this.particleCollisionDetector.resize();
    this.particleViz.draw();
  }
  // for updating particle positions / velocities and creating / destroying particles
  updateParticles(
    newCount: number | undefined,
    fn: (startCount: number, endCount: number) => void
  ) {
    let initialCount = this.particles.n;
    newCount = newCount || initialCount;
    this.particles.n = newCount;
    const bufferAllocation = 2 ** ceil(log2(newCount ?? 0));
    if (bufferAllocation > this.particles.x_x.length) {
      const { x_x, x_y, v_x, v_y } = this.particles;
      this.particles.x_x = new Float64Array(bufferAllocation);
      this.particles.x_y = new Float64Array(bufferAllocation);
      this.particles.v_x = new Float64Array(bufferAllocation);
      this.particles.v_y = new Float64Array(bufferAllocation);
      this.particles.x_x.set(x_x);
      this.particles.x_y.set(x_y);
      this.particles.v_x.set(v_x);
      this.particles.v_y.set(v_y);
      this.particleDisplacementBuffer.D_x = new Float64Array(bufferAllocation);
      this.particleDisplacementBuffer.D_y = new Float64Array(bufferAllocation);
    }
    fn(initialCount, newCount);
    if (this.particleViz) this.particleViz.draw();
  }
  updateBoundary(sdf: (x: number, y: number) => number) {
    this.boundary.init(sdf);
    this.boundaryViz.draw();
  }
  frame() {
    for (let i = 0; i < this.simulationStepsPerFrame; i++) {
      this.step();
    }
    this.particleViz.draw();
  }
  step() {
    let {
      simulationStepSize,
      particles: { n, x_x, x_y, v_x, v_y },
      particleDisplacementBuffer: { D_x, D_y },
      particleCollisionDetector,
      boundary,
    } = this;

    // performance hack for filling typed arrays faster:
    // https://groups.google.com/u/1/g/v8-dev/c/TThTHiHrgFM/m/2uMq05CoAgAJ
    new Int8Array(D_x.buffer).fill(0);
    new Int8Array(D_y.buffer).fill(0);

    for (let i = 0; i < n; i++) {
      x_x[i] += v_x[i] * simulationStepSize;
      x_y[i] += v_y[i] * simulationStepSize;
    }

    particleCollisionDetector.index();
    particleCollisionDetector.detect(
      collideParticles.bind(
        null,
        this.particles,
        this.particleDisplacementBuffer
      )
    );

    for (let i = 0; i < n; i++) {
      x_x[i] += D_x[i];
      x_y[i] += D_y[i];
    }

    for (let i = 0; i < n; i++) {
      boundary.collides(
        x_x[i],
        x_y[i],
        this.particles.r,
        collideBoundary.bind(null, this.particles, i)
      );
    }
  }
}
