import * as pako from "pako";
import { useRef, useEffect, useState } from "react";
import { Core } from "../../particles/core";
import { Button, Slider } from "../ui/FigureControls";
import { Image } from "../../particles/boundary-image";
import { SDF } from "../../particles/boundary";
import { Link } from "react-router-dom";
import Canvas from "../../common/canvas";
import { allXY } from "../../common/grid-utils";
import { ParticleCollection } from "../../particles/particles";
import { LayoutStandalone } from "../ui/Layout";

const { min, max, floor, abs, sin, cos, E, PI } = Math;

const STEP_SIZE = E ** -5;

const FRAMES_PER_RUN = 750;
const SAMPLES_PER_RUN = 150;
const THETA_SAMPLES = 200;
const INITIAL_THETA = 0 + (PI * 22) / 100;

const boundaries: Record<string, () => SDF | Promise<Image>> = {
  sinai: () => {
    return function sinai(x: number, y: number) {
      const r = 0.5;
      const l = 0.985;
      return max(abs(x) - l, abs(y) - l, r - (x ** 2 + y ** 2) ** 0.5);
    };
  },
};

function getMacroState(particles: ParticleCollection) {
  let { n, v_x, v_y } = particles;
  let total_x = 0;
  let total_y = 0;
  for (let i = 0; i < n; i++) {
    total_x += v_x[i];
    total_y += v_y[i];
  }
  let macroState = (total_x ** 2 + total_y ** 2) ** 0.5;
  return macroState;
}

// TODO: indicator for current macrostate with value shown
class PhaseSpaceViz {
  canvas: Canvas;
  container: HTMLDivElement;
  resizeObserver: ResizeObserver;
  samples: Float64Array;
  initialTheta = INITIAL_THETA;
  progress = 0;
  lineBG: SVGLineElement = null as unknown as SVGLineElement;
  lineFG: SVGLineElement = null as unknown as SVGLineElement;
  circle: any;
  constructor(public outerContainer: HTMLElement, private core: Core) {
    this.initSVG();

    this.container = document.createElement("div");
    this.container.className = "absolute inset-0";
    this.outerContainer.appendChild(this.container);
    this.canvas = new Canvas(this.container);
    this.resizeObserver = new ResizeObserver(() => {
      this.canvas.resize();
      this.draw();
    });
    this.resizeObserver.observe(this.container);
    this.samples = new Float64Array(THETA_SAMPLES * SAMPLES_PER_RUN).fill(0);
    this.draw();
    void this.import();
  }
  initSVG() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.position = "absolute";
    svg.style.zIndex = "1";
    svg.style.opacity = "0.85";
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    this.lineBG = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    this.lineFG = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    this.lineBG.setAttribute("stroke", "black");
    this.lineBG.setAttribute("stroke-width", "3");
    this.lineBG.setAttribute("stroke-linecap", "round");
    this.lineFG.setAttribute("stroke", "white");
    this.lineFG.setAttribute("stroke-width", ".75");
    this.lineFG.setAttribute("stroke-linecap", "round");

    this.circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    this.circle.setAttribute("r", "5");
    this.circle.setAttribute("fill", "black");
    this.circle.setAttribute("stroke", "white");
    this.circle.setAttribute("stroke-width", "0.5");

    this.updateSVG();
    svg.appendChild(this.lineBG);
    svg.appendChild(this.lineFG);
    svg.appendChild(this.circle);

    this.outerContainer.appendChild(svg);
  }
  updateSVG() {
    for (const line of [this.lineBG, this.lineFG]) {
      line.setAttribute("x1", `${50 - 49 * Math.cos(this.initialTheta)}%`);
      line.setAttribute("y1", `${50 - 49 * Math.sin(this.initialTheta)}%`);
      line.setAttribute("x2", `${50 + 49 * Math.cos(this.initialTheta)}%`);
      line.setAttribute("y2", `${50 + 49 * Math.sin(this.initialTheta)}%`);
    }

    const circleX = 50 + 49 * this.progress * Math.cos(this.initialTheta);
    const circleY = 50 + 49 * this.progress * Math.sin(this.initialTheta);
    this.circle.setAttribute("cx", `${circleX}%`);
    this.circle.setAttribute("cy", `${circleY}%`);
  }
  normTheta(theta: number) {
    const PI2 = PI * 2;
    theta = (theta + PI2) % PI2;
    return (theta / PI2) * THETA_SAMPLES;
  }
  addSample(theta: number, time: number, value: number) {
    time = time * SAMPLES_PER_RUN;
    let i = floor(time) * THETA_SAMPLES + floor(this.normTheta(theta));
    this.samples[i] = value;
  }
  getSample(theta: number, time: number) {
    theta = this.normTheta(theta) + 0.5;
    time = time * SAMPLES_PER_RUN * (2 ** 0.5 * 0.5);
    let i = floor(time) * THETA_SAMPLES + floor(theta);
    return this.samples[i];
  }
  RB = 32;
  RW = 77 - this.RB;
  GB = 32;
  GW = 160 - this.GB;
  BB = 32;
  BW = 240 - this.BB;
  draw() {
    this.canvas.draw((img: Uint8ClampedArray) => {
      for (let [xi, yi] of allXY(this.canvas.width, this.canvas.height)) {
        let x = (xi / this.canvas.width) * 2 - 1;
        let y = (yi / this.canvas.height) * 2 - 1;
        let theta = Math.atan2(y, x);
        let r = (x ** 2 + y ** 2) ** 0.5;
        let value = this.getSample(theta, r);
        const i = yi * this.canvas.width + xi;
        img[i * 4 + 0] = this.RB + this.RW * value;
        img[i * 4 + 1] = this.GB + this.GW * value;
        img[i * 4 + 2] = this.BB + this.BW * value;
        img[i * 4 + 3] = 255;
      }
    });
    this.drawOverlay();
  }
  drawOverlay() {
    const macrostate = getMacroState(this.core.particles);
    const value = macrostate / this.core.particles.n;
    const x0 = this.canvas.width - 190;
    const y0 = this.canvas.height - 40;
    const x1 = this.canvas.width - 10;
    const y1 = this.canvas.height - 10;
    this.canvas.ctx.beginPath();
    this.canvas.ctx.rect(x0, y0, x1 - x0, y1 - y0);
    const r = this.RB + this.RW * value;
    const g = this.GB + this.GW * value;
    const b = this.BB + this.BW * value;
    this.canvas.ctx.fillStyle = `rgb(${r} ${g} ${b})`;
    this.canvas.ctx.fill();
    this.canvas.ctx.lineWidth = 0.75;
    this.canvas.ctx.strokeStyle = "white";
    this.canvas.ctx.stroke();

    this.canvas.ctx.fillStyle = "white";
    this.canvas.ctx.strokeStyle = "black";
    this.canvas.ctx.lineWidth = 3;
    this.canvas.ctx.font = "16px Arial";
    const text = `Macrostate = ${macrostate.toFixed(2)}`;
    const textWidth = this.canvas.ctx.measureText(`Macrostate = 100.00`).width;
    const textHeight = parseInt(this.canvas.ctx.font, 10); // Extracts the font size (20) from the font string
    const xCentered = x0 + (x1 - x0) / 2 - textWidth / 2;
    const yCentered = y0 + (y1 - y0) / 2 + textHeight / 2 - 1;
    this.canvas.ctx.globalAlpha = 0.85;
    this.canvas.ctx.strokeText(text, xCentered, yCentered);
    this.canvas.ctx.fillText(text, xCentered, yCentered);
    this.canvas.ctx.globalAlpha = 1.0; // Reset the globalAlpha after drawing the text
    this.updateSVG();
  }
  destroy() {
    this.resizeObserver.disconnect();
    this.outerContainer.innerHTML = "";
  }
  export() {
    let last = 0;
    const deltaArray = new Float64Array(this.samples.length);
    for (let i = 0; i < this.samples.length; i++) {
      deltaArray[i] = this.samples[i] - last;
      last = this.samples[i];
    }
    const data = pako.deflate(new Uint8Array(deltaArray.buffer));
    const blob = new Blob([data.buffer], { type: "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "entropy-figure-phase-space.bin";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  async import(url = "/entropy-figure-phase-space.bin") {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(new Error("Failed to fetch the file"));
      return;
    }
    const rawData = await response.arrayBuffer();
    const deltas = new Float64Array(pako.inflate(rawData).buffer);

    if (deltas.length !== this.samples.length) return;

    let sum = 0;
    const result = new Float64Array(deltas.length);
    for (let i = 0; i < deltas.length; i++) {
      sum += deltas[i];
      result[i] = sum;
    }
    this.samples = result;
    this.draw();
  }
}

class ParticleToyEntropyImpl {
  core: Core;
  phaseSpaceViz: PhaseSpaceViz;
  initialTheta: number;
  resumePlayingAfterThetaUpdateFinished = false;

  constructor(
    private simContainer: HTMLElement,
    private phaseSpaceVizContainer: HTMLElement,
    private updateInitialThetaCallback: (value: number) => void,
    private makeRecording: boolean
  ) {
    this.initialTheta = INITIAL_THETA;
    this.simContainer = simContainer;
    this.phaseSpaceVizContainer = phaseSpaceVizContainer;
    this.core = new Core(this.simContainer);
    this.core.simulationStepSize = STEP_SIZE;
    this.core.frameBudget = 6;
    this.core.updateBoundary(boundaries.sinai() as SDF);
    this.resetParticles(this.initialTheta);
    this.phaseSpaceViz = new PhaseSpaceViz(
      this.phaseSpaceVizContainer,
      this.core
    );
    this.core.onAfterFrame = this.onAfterFrame.bind(this);
  }

  destroy() {
    this.core.destroy();
    this.phaseSpaceViz.destroy();
  }

  onTogglePlayPause() {
    this.core.ticker.playing = !this.core.ticker.playing;
  }

  onReset() {
    this.resetParticles(this.initialTheta);
    this.phaseSpaceViz.progress = 0;
    this.phaseSpaceViz.drawOverlay();
  }

  onReverse() {
    this.reversed = !this.reversed;
    this.core.reverseRecorder.reverse();
  }

  onUpdateInitialTheta(theta: number) {
    this.initialTheta = theta;
    this.phaseSpaceViz.initialTheta = theta;
    this.resetParticles(this.initialTheta);
    this.phaseSpaceViz.progress = 0;
    this.phaseSpaceViz.draw();
    if (this.core.ticker.playing) {
      this.resumePlayingAfterThetaUpdateFinished = true;
      this.core.ticker.playing = false;
    }
  }

  onFinishUpdateInitialTheta() {
    if (this.resumePlayingAfterThetaUpdateFinished) {
      this.core.ticker.playing = true;
      this.resumePlayingAfterThetaUpdateFinished = false;
    }
  }

  onExport() {
    this.phaseSpaceViz.export();
  }

  resetParticles(theta: number) {
    this.frame = 0;
    this.reversed = false;
    this.initialTheta = theta;
    let sz = 10;
    let x0 = -0.9172;
    let y0 = -0.895;
    let n = sz ** 2;
    let r = E ** -3.9;
    this.core.updateParticles((particles) => {
      particles.n = sz ** 2;
      particles.r = r;
      const { x_x, x_y, v_x, v_y } = particles;
      const vx = cos(theta);
      const vy = sin(theta);
      for (let i = 0; i < n; i++) {
        let xi = i % sz;
        let yi = floor(i / sz);
        x_x[i] = xi * r * 2.2 + x0;
        x_y[i] = yi * r * 2.2 + y0;
        v_x[i] = vx;
        v_y[i] = vy;
      }
    });
    this.core.reverseRecorder.record();
  }

  frame = 0;
  reversed = false;
  onAfterFrame() {
    if (this.reversed) this.frame--;
    else this.frame++;

    if (!this.makeRecording) {
      const progress = this.frame / (FRAMES_PER_RUN * (2 ** 0.5 * 0.5));
      this.phaseSpaceViz.progress = progress;
      if (progress > 1) {
        this.onReverse();
      }
      if (progress <= 0 && this.reversed) {
        const theta = this.initialTheta + (this.initialTheta >= 0 ? -PI : PI);
        this.onUpdateInitialTheta(theta);
        this.updateInitialThetaCallback(theta);
        this.onFinishUpdateInitialTheta();
      }
      this.phaseSpaceViz.drawOverlay();
      return;
    }
    const sampleInterval = FRAMES_PER_RUN / SAMPLES_PER_RUN;
    if (this.frame % sampleInterval === 0) {
      const macrostate = getMacroState(this.core.particles);

      const time = this.frame / (sampleInterval * SAMPLES_PER_RUN);
      this.phaseSpaceViz.addSample(
        this.initialTheta + PI / THETA_SAMPLES,
        time + time / (2 * SAMPLES_PER_RUN),
        macrostate / this.core.particles.n
      );
      this.phaseSpaceViz.draw();
      if (time >= 1) {
        const theta = this.initialTheta + (PI * 2) / THETA_SAMPLES;
        this.onUpdateInitialTheta(theta);
        this.updateInitialThetaCallback(theta);
        this.onFinishUpdateInitialTheta();
      }
    }
  }
}

export const ParticleToyEntropy = ({
  makeRecording,
}: {
  makeRecording?: boolean;
}) => {
  const simContainer = useRef(null);
  const phaseSpaceVizContainer = useRef(null);
  const [initialTheta, setInitialTheta] = useState(INITIAL_THETA);
  const [initialPolar, setInitialPolar] = useState(1);
  const [particleToy, setParticleToy] = useState<ParticleToyEntropyImpl | null>(
    null
  );

  useEffect(() => {
    if (!simContainer.current || !phaseSpaceVizContainer.current) return;
    let particleToy = new ParticleToyEntropyImpl(
      simContainer.current,
      phaseSpaceVizContainer.current,
      setInitialTheta,
      makeRecording ?? false
    );
    setParticleToy(particleToy);
    return () => particleToy.destroy();
  }, []);

  useEffect(() => {
    const el = simContainer.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) particleToy!.core.ticker.playing = false;
    });
    observer.observe(el);
    return () => observer.unobserve(el!);
  }, [particleToy]);

  return (
    <div className="w-[928px]">
      <div>
        <div
          ref={phaseSpaceVizContainer}
          className="relative aspect-square w-[50%] inline-block"
        ></div>
        <div className="relative aspect-square w-[50%] inline-block">
          <div ref={simContainer} className="absolute inset-0"></div>
        </div>
      </div>
      <div className="flex mt-4 gap-4">
        {makeRecording && (
          <Button
            onClick={() => {
              if (particleToy) particleToy.onExport();
            }}
          >
            Export Recording
          </Button>
        )}
        <Button
          onClick={() => {
            if (particleToy) particleToy.onTogglePlayPause();
          }}
        >
          Play / Pause
        </Button>
        <Button
          onClick={() => {
            if (particleToy) particleToy.onReset();
          }}
        >
          Reset
        </Button>
        <Button
          onClick={() => {
            if (particleToy) particleToy.onReverse();
          }}
        >
          Reverse
        </Button>
        <Slider
          value={initialTheta}
          onChange={(value) => {
            setInitialTheta(value);
            if (particleToy) particleToy.onUpdateInitialTheta(value);
          }}
          onMouseUp={() => {
            if (particleToy) particleToy.onFinishUpdateInitialTheta();
          }}
          min={-PI}
          max={PI}
          step={PI / (THETA_SAMPLES / 2)}
        >
          {/* TODO: make (1, x) selectable */}
          Initial phase space coordinates: ({initialPolar}{" "}
          <input
            type="checkbox"
            className="relative top-[1px]"
            checked={!!initialPolar}
            onChange={(e) => {
              setInitialPolar(e.target.checked ? 1 : 0);
              // if (particleToy) particleToy.onUpdateInitialPolar(e.target.checked);
            }}
          />
          , {initialTheta.toFixed(2)})
        </Slider>
      </div>
    </div>
  );
};

export const ParticleToyEntropyPage = () => {
  return (
    <LayoutStandalone
      title="Secret test page — particle toy entropy"
      subtitle={
        <>
          Part of{" "}
          <Link to="/" className="text-[#005dff] italic">
            Save the Universe!
          </Link>{" "}
        </>
      }
    >
      <ParticleToyEntropy makeRecording />
    </LayoutStandalone>
  );
};
