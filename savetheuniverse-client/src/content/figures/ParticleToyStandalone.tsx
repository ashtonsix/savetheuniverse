import GUI, { Controller } from "lil-gui";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExpand } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef } from "react";
import { Core } from "../../particles/core";
import { fileToImage } from "../../particles/boundary-image";

const { random, floor, cos, sin, PI, E } = Math;

const boundaries = {
  circle(x: number, y: number) {
    const r = 0.95;
    return (x ** 2 + y ** 2) ** 0.5 - r;
  },
};

const maxDensity = PI / (2 * 3 ** 0.5);

function setup(coreContainer: HTMLElement, uiContainer: HTMLElement) {
  const core = new Core(coreContainer);

  (window as any).core = core;

  type State = typeof state;
  const state = {
    "log(step size)": 0,
    "frames per second": 60,
    "pseudo-elasticity": 1,
    "log(radius)": -3.75,
    count: 0,
    density: 0.4,
    boundary: "circle",
  };
  core.updateBoundary(boundaries[state.boundary as keyof typeof boundaries]);
  state["log(step size)"] = state["log(radius)"] - 1.25;
  state.count = densityToCount(state.density);

  const prev = { ...state };
  const uiFactories: Record<keyof State, (ui: GUI, k: string) => Controller> = {
    "log(step size)": (ui, k) =>
      ui.add(state, k, state["log(radius)"] - 4, state["log(radius)"] - 0.5),
    "frames per second": (ui, k) =>
      ui.add(state, k, [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60]),
    "pseudo-elasticity": (ui, k) => ui.add(state, k, 0, 1.5),
    "log(radius)": (ui, k) => ui.add(state, k, -5.5, -2.5),
    count: (ui, k) => ui.add(state, k, 0, densityToCount(maxDensity), 1),
    density: (ui, k) => ui.add(state, k, 0, maxDensity),
    boundary: (ui, k) => ui.add(state, k).disable(),
  };

  const buttons = {
    step() {
      core.frame();
    },
    "play / pause"() {
      core.ticker.playing = !core.ticker.playing;
    },
    randomise() {
      core.updateParticles((particles) => {
        const { n, v_x, v_y } = particles;
        for (let i = 0; i < n; i++) {
          let d = random() * PI * 2;
          v_x[i] = cos(d);
          v_y[i] = sin(d);
        }
      });
    },
    reverse() {
      core.reverseRecorder.reverse();
    },
    reset() {
      core.updateParticles((particles) => {
        const { n, r, x_x, x_y, v_x, v_y } = particles;
        for (let i = 0; i < n; i++) {
          let [x, y] = core.boundary.sampleInside(r);
          x_x[i] = x;
          x_y[i] = y;
          let d = random() * PI * 2;
          v_x[i] = cos(d);
          v_y[i] = sin(d);
        }
      });
    },
    experiment() {
      let sz = 12;
      state["count"] = sz ** 2;
      state["log(radius)"] = -3.75;
      onChange(prev, state);
      core.updateParticles((particles) => {
        const { n, r, x_x, x_y, v_x, v_y } = particles;
        const theta = 0;
        const vx = cos(theta);
        const vy = sin(theta);
        for (let i = 0; i < n; i++) {
          let xi = i % sz;
          let yi = floor(i / sz);
          x_x[i] = xi * r * 2.2 - 0.4;
          x_y[i] = yi * r * 2.2 - 0.4;
          v_x[i] = vx;
          v_y[i] = vy;
        }
      });
      core.reverseRecorder.record();
    },
    async "update boundary"() {
      const req = await fetch("/maxwell.png");
      const file = await req.blob();
      const img = await fileToImage(file);
      core.updateBoundary(img);
    },
  };

  const ui = new GUI({ container: uiContainer });
  ui.domElement.style.position = "initial";
  ui.domElement.style.width = "100%";

  const controls: Record<keyof State | keyof typeof buttons, Controller> =
    {} as any;

  const timeControl = ui.addFolder("Time Control");
  const particles = ui.addFolder("Particles");
  const features = ui.addFolder("Features");
  for (const [folder, key] of [
    [timeControl, "log(step size)"],
    [timeControl, "frames per second"],
    [timeControl, "step"],
    [timeControl, "play / pause"],
    [particles, "pseudo-elasticity"],
    [particles, "log(radius)"],
    [particles, "count"],
    [particles, "density"],
    [particles, "randomise"],
    [particles, "reverse"],
    [particles, "reset"],
    [particles, "experiment"],
    [features, "boundary"],
    [features, "update boundary"],
  ] as const) {
    if (key in buttons) {
      const control = folder.add(buttons, key);
      controls[key] = control;
      continue;
    }
    const control = uiFactories[key as keyof State](folder, key);
    controls[key] = control;
    control.onChange(() => {
      onChange(prev, state);
      Object.assign(prev, state);
    });
    control.onFinishChange(() => {
      onFinishChange(prev, state);
      Object.assign(prev, state);
    });
  }

  onChange(prev, state);
  buttons.reset();

  function onChange(prev: State, state: State) {
    if (prev["log(radius)"] !== state["log(radius)"]) {
      let diff = state["log(radius)"] - prev["log(radius)"];
      state["log(step size)"] += diff;
      controls["log(step size)"].min(state["log(radius)"] - 2);
      controls["log(step size)"].max(state["log(radius)"] - 0.5);
      controls["log(step size)"].updateDisplay();
      state["count"] = densityToCount(state["density"]);
      controls["count"].max(densityToCount(maxDensity));
      controls["count"].updateDisplay();
    }
    if (prev["count"] !== state["count"]) {
      state["density"] = countToDensity(state["count"]);
      controls["density"].updateDisplay();
    } else if (prev["density"] !== state["density"]) {
      state["count"] = densityToCount(state["density"]);
      controls["count"].max(densityToCount(maxDensity));
      controls["count"].updateDisplay();
    }
    core.ticker.interval = floor(60 / state["frames per second"]);
    core.simulationStepSize = E ** state["log(step size)"];

    core.updateParticles((particles) => {
      particles.n = state["count"];
      particles.E = state["pseudo-elasticity"];
      particles.r = E ** state["log(radius)"];
      const { n, r, x_x, x_y, v_x, v_y } = particles;
      for (let i = prev["count"]; i < n; i++) {
        let [x, y] = core.boundary.sampleInside(r);
        x_x[i] = x;
        x_y[i] = y;
        let d = random() * PI * 2;
        v_x[i] = cos(d);
        v_y[i] = sin(d);
      }
    });
  }
  function onFinishChange(prev: State, state: State) {}

  function countToDensity(count: number) {
    const r = E ** state["log(radius)"];
    const particleArea = r * r * PI;
    const boundaryArea = core.boundary.area;
    return (particleArea * count) / boundaryArea;
  }

  function densityToCount(density: number) {
    const r = E ** state["log(radius)"];
    const particleArea = r * r * PI;
    const boundaryArea = core.boundary.area;
    return floor((boundaryArea * density) / particleArea);
  }

  return function teardown() {
    core.destroy();
    ui.destroy();
    coreContainer.innerHTML = "";
    uiContainer.innerHTML = "";
  };
}

export const ParticleToyStandalone = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!coreRef.current || !controlRef.current) return;
    return setup(coreRef.current, controlRef.current);
  }, []);

  return (
    <figure className="flex flex-col h-full">
      <div ref={containerRef} className="md:flex flex-grow relative">
        <div ref={coreRef} className="relative flex-grow h-full" />
        <div ref={controlRef} className="w-full md:w-80 bg-[#202020]"></div>
      </div>
      <div className="text-right">
        <span
          onClick={() => {
            if (!containerRef.current) return;
            containerRef.current.requestFullscreen();
          }}
          className="inline-block cursor-pointer text-gray-700 hover:text-gray-900 py-1 px-2"
        >
          <FontAwesomeIcon icon={faExpand} size="lg" />
        </span>
      </div>
    </figure>
  );
};
