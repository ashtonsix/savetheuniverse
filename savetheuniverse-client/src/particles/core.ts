import { Ticker } from "../common/ticker";
import { ParticleDetector, BoundaryDetector } from "./detect";
import { BoundaryViz, ParticleViz } from "./viz";
import { Driver } from "./driver";
import { collideParticles, collideBoundary } from "./collide";

const { ceil, log2 } = Math;

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
  boundary = (() => 0) as (x: number, y: number) => number;
  boundaryCollisionDetector: BoundaryDetector;
  particleCollisionDetector: ParticleDetector;
  boundaryViz: BoundaryViz;
  particleViz: ParticleViz;

  constructor(public driver: Driver, public container: HTMLElement) {
    this.ticker = new Ticker(this.frame.bind(this), 1);
    this.boundaryViz = new BoundaryViz(this, container);
    this.particleViz = new ParticleViz(this, container);
    this.boundaryCollisionDetector = new BoundaryDetector(this);
    this.particleCollisionDetector = new ParticleDetector(this);
    driver.init(this);
  }
  destroy() {
    this.ticker.destroy();
    this.particleViz.destroy();
    this.container.innerHTML = "";
  }
  updateParticleRadius(particleRadius: number) {
    this.particles.r = particleRadius;
    this.particleCollisionDetector.resize();
    this.boundaryCollisionDetector.resize();
    this.boundaryCollisionDetector.index();
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
  updateBoundary(boundary: (x: number, y: number) => number) {
    this.boundary = boundary;
    this.boundaryCollisionDetector.index();
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
      boundaryCollisionDetector,
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

    boundaryCollisionDetector.detect(
      collideBoundary.bind(null, this.particles)
    );
  }
}
