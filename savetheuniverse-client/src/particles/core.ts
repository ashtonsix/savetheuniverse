import { Ticker } from "../common/ticker";
import {
  collideParticles,
  ParticleCollection,
  ParticleDetector as ParticleDetector,
  ParticleViz,
} from "./particles";
import { Image } from "./boundary-image";
import { collideBoundary, Boundary, BoundaryViz, SDF } from "./boundary";

const { min, max, abs, ceil } = Math;

export class Core {
  simulationStepSize = 0;
  ticker = new Ticker(() => {}, 1000 / 60);
  particles = new ParticleCollection();
  boundary: Boundary;
  particleDetector: ParticleDetector;
  boundaryViz: BoundaryViz;
  particleViz: ParticleViz;
  bisectionIterator: BisectionIterator;
  reverseRecorder: ReverseRecorder;
  frameBudget = 12;
  onAfterFrame = () => {};
  onAfterUpdateParticles = () => {};

  constructor(public container: HTMLElement) {
    this.ticker = new Ticker(this.frame.bind(this), 1);
    this.boundary = new Boundary();
    this.boundaryViz = new BoundaryViz(this.boundary, container);
    this.particleViz = new ParticleViz(this.particles, container);
    this.particleDetector = new ParticleDetector(this.particles);
    this.bisectionIterator = new BisectionIterator(this);
    this.reverseRecorder = new ReverseRecorder(this.particles);
  }
  destroy() {
    this.ticker.destroy();
    this.boundaryViz.destroy();
    this.particleViz.destroy();
    this.container.innerHTML = "";
  }
  updateBoundary(imgOrSdf: Image | SDF) {
    this.boundary.update(imgOrSdf);
    this.boundaryViz.draw();
  }
  updateParticles(fn: (particles: ParticleCollection) => void) {
    const prev = this.particles.n;
    fn(this.particles);
    this.reverseRecorder.reset();
    this.onAfterUpdateParticles();
    this.prevFrameAvgIterTime *= this.particles.n / prev;
    this.particleDetector.resize();
    this.particleViz.draw();
  }
  prevFrameAvgIterTime = 12;
  frame() {
    let { prevFrameAvgIterTime, simulationStepSize } = this;
    let start = performance.now();
    let budget = min(this.ticker.interval * this.frameBudget, 72); // in milliseconds

    let n = min(max(ceil(budget / prevFrameAvgIterTime || 0), 1), 4096);
    this.bisectionIterator.n = n;
    this.bisectionIterator.C_est = this.particles.C;
    this.particles.C = 0;

    let iters = 0;
    let progress = 0;

    // in almost every case, all iterations will be completed with EITHER the
    // bisection or regular method. we only use both when the bisection method
    // uses many more iterations than was expected
    for (let stepSize of this.bisectionIterator) {
      progress += stepSize;
      this.iter(stepSize);
    }
    iters += this.bisectionIterator.iters;

    let remaining = max(simulationStepSize - progress, 0);
    let regularIterCount = ceil((n * remaining) / simulationStepSize);
    let regularIterSize = simulationStepSize / n;
    iters += regularIterCount;

    for (let i = 0; i < regularIterCount; i++) {
      this.iter(regularIterSize);
    }

    let elapsed = performance.now() - start;
    this.prevFrameAvgIterTime = elapsed / iters;
    this.reverseRecorder.step();
    this.onAfterFrame();
    this.particleViz.draw();
  }

  iter(iterSize: number) {
    let {
      particles: { n, x_x, x_y, v_x, v_y, D_x, D_y },
      particleDetector,
      boundary,
    } = this;

    // performance hack for filling typed arrays faster:
    // https://groups.google.com/u/1/g/v8-dev/c/TThTHiHrgFM/m/2uMq05CoAgAJ
    new Int8Array(D_x.buffer).fill(0);
    new Int8Array(D_y.buffer).fill(0);

    // move particles
    for (let i = 0; i < n; i++) {
      x_x[i] += v_x[i] * iterSize;
      x_y[i] += v_y[i] * iterSize;
    }

    particleDetector.index();
    particleDetector.detect(collideParticles.bind(null, this.particles));

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

// yields step sizes that resolve the exact point of contact for each collision
class BisectionIterator {
  n = 0;
  C_est = 0;
  iters = 0;
  backup = new ParticleCollection();
  constructor(public core: Core) {}
  *[Symbol.iterator]() {
    let C_est = this.C_est;
    let iterDepth = min(ceil((this.n / C_est || 0) - 2), 30); //
    if (iterDepth < 2) return;

    const { particles, simulationStepSize } = this.core;
    this.iters = 0;
    let remaining = simulationStepSize;

    while (this.iters < this.n * 4) {
      this.backup.copy(particles);
      let lo = 0;
      // initial guess based on regular spacing of collisions
      let hi = min(simulationStepSize / C_est, remaining * (1 - 1e-4));
      let d = iterDepth;

      // maybe extend search space to make sure collision is included
      while (hi < remaining) {
        if (this.doesIterCauseCollision(hi)) break;
        d++;
        this.iters++;
        hi += hi - lo;
      }
      if (hi >= remaining && !this.doesIterCauseCollision(remaining)) {
        yield remaining;
        return;
      }
      this.iters += d;

      // look for exact point where contact occurs
      for (let i = 0; i <= d; i++) {
        let mid = lo + (hi - lo) / 2;
        if (this.doesIterCauseCollision(mid)) {
          hi = mid;
        } else {
          lo = mid;
        }
      }

      remaining -= hi;
      yield hi;
    }
  }
  doesIterCauseCollision(iterSize: number) {
    const log = console.log;
    console.log = () => {};
    this.core.iter(iterSize);
    const collision = this.core.particles.C > this.backup.C;
    this.core.particles.copy(this.backup);
    console.log = log;
    return collision;
  }
}

enum ReverseRecorderMode {
  inactive,
  recording,
  playing,
}

class ReverseRecorder {
  #buffer = new ParticleCollection();
  #mode = ReverseRecorderMode.inactive;
  recording: number[] = [];
  recordingPos = 0;
  constructor(public particles: ParticleCollection) {}
  record() {
    if (this.particles.E !== 1) return;
    this.reset();
    this.#mode = ReverseRecorderMode.recording;
  }
  reverse() {
    const { n, v_x, v_y } = this.particles;
    for (let i = 0; i < n; i++) {
      v_x[i] *= -1;
      v_y[i] *= -1;
    }
    this.#buffer.copy(this.particles);
    if (this.#mode === ReverseRecorderMode.recording) {
      this.#mode = ReverseRecorderMode.playing;
    } else if (this.#mode === ReverseRecorderMode.playing) {
      this.#mode = ReverseRecorderMode.recording;
    }
  }
  reset() {
    this.recording = [];
    this.recordingPos = 0;
    this.#buffer.copy(this.particles);
    this.#mode = ReverseRecorderMode.inactive;
  }
  step() {
    switch (this.#mode) {
      case ReverseRecorderMode.inactive: {
        return;
      }
      case ReverseRecorderMode.recording: {
        let p = this.particles;
        let b = this.#buffer;
        for (let i = 0; i < p.n; i++) {
          if (p.v_x[i] !== b.v_x[i] || p.v_y[i] !== b.v_y[i]) {
            this.recording.push(
              this.recordingPos,
              i,
              b.x_x[i],
              b.x_y[i],
              b.v_x[i],
              b.v_y[i]
            );
          }
        }
        this.recordingPos++;
        this.#buffer.copy(this.particles);
        return;
      }
      case ReverseRecorderMode.playing: {
        if (this.recordingPos <= 0 || !this.recording.length) {
          this.record();
          return;
        }
        this.recordingPos--;

        while (
          this.recording[this.recording.length - 6] === this.recordingPos
        ) {
          let [, i, x_x, x_y, v_x, v_y] = this.recording.splice(
            this.recording.length - 6,
            6
          );
          this.particles.x_x[i] = x_x;
          this.particles.x_y[i] = x_y;
          this.particles.v_x[i] = -v_x;
          this.particles.v_y[i] = -v_y;
        }
        return;
      }
    }
  }
}
