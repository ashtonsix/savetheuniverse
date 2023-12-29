import { useRef, useEffect, useState } from "react";
import { Core } from "../../particles/core";
import { Button, Dropdown, Slider } from "../ui/FigureControls";
import { fileToImage } from "../../particles/boundary-image";
import { SDF } from "../../particles/boundary";
// import { fileToImage } from "../../particles/boundary-image";

const { random, sin, cos, E, PI } = Math;

const experiments = {
  "self-ordering": {
    density: 0.5,
    radius: E ** -3.75,
    stepSize: E ** -5.25,
    boundary: () => {
      return function circle(x: number, y: number) {
        const r = 0.95;
        return (x ** 2 + y ** 2) ** 0.5 - r;
      };
    },
    bounds: { top: -1, left: -1, width: 2, height: 2 },
  },
  "maxwells-demon": {
    density: 0.2,
    radius: E ** -5.5,
    stepSize: E ** -6.75,
    boundary: async () => {
      const req = await fetch("/maxwell.png");
      const file = await req.blob();
      const img = await fileToImage(file);
      return img;
    },
    bounds: { top: -0.6, left: -1, width: 2, height: 1.2 },
  },
};

function resetParticles(
  core: Core,
  experiment: "self-ordering" | "maxwells-demon"
) {
  const { density, radius } = experiments[experiment];
  core.updateParticles((particles) => {
    particles.r = radius;
    core.particleDetector.resize();
    particles.n = (core.boundary.area * density) / (radius ** 2 * PI);
    for (let i = 0; i < particles.n; i++) {
      let [x, y] = core.boundary.sampleInside(radius);
      particles.x_x[i] = x;
      particles.x_y[i] = y;
      let d = random() * PI * 2;
      particles.v_x[i] = cos(d);
      particles.v_y[i] = sin(d);
    }
    for (let i = 0; i < 10; i++) {
      core.iter(0);
    }
  });
}

export const ParticleToyPseudoMomentum = () => {
  const figureContainer = useRef(null);
  const [core, setCore] = useState<Core | null>(null);
  const [experiment, setExperiment] =
    useState<keyof typeof experiments>("self-ordering");
  const [elasticity, setElasticity] = useState(1);

  useEffect(() => {
    let mounted = true;
    if (!figureContainer.current || !mounted) return;

    let core = new Core(figureContainer.current);
    core.simulationStepSize = experiments[experiment].stepSize;
    core.boundaryViz.bounds = experiments[experiment].bounds;
    core.particleViz.bounds = experiments[experiment].bounds;
    core.updateBoundary(experiments[experiment].boundary() as SDF);
    resetParticles(core, experiment);
    setCore(core);
    return () => {
      mounted = false;
      if (core) core.destroy();
    };
  }, []);

  useEffect(() => {
    const el = figureContainer.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) core!.ticker.playing = false;
    });
    observer.observe(el);
    return () => observer.unobserve(el!);
  }, [core]);

  return (
    <div>
      <div className="relative aspect-video">
        <div ref={figureContainer} className="absolute inset-0"></div>
      </div>
      <div className="flex mt-4 gap-4">
        <Button
          onClick={() => {
            if (!core) return;
            core.ticker.playing = !core.ticker.playing;
          }}
        >
          Play / Pause
        </Button>
        <Button
          onClick={() => {
            if (core) resetParticles(core, experiment);
          }}
        >
          Reset
        </Button>
        <Dropdown
          value={experiment}
          options={[
            { value: "self-ordering", label: "Self-Ordering" },
            { value: "maxwells-demon", label: "Maxwell’s Demon" },
          ]}
          onChange={async (value) => {
            const experiment = value as keyof typeof experiments;
            setExperiment(experiment);
            const imgOrSDF = await experiments[experiment].boundary();
            if (!core) return;
            core.boundaryViz.bounds = experiments[experiment].bounds;
            core.particleViz.bounds = experiments[experiment].bounds;
            core.updateBoundary(imgOrSDF);
            resetParticles(core, experiment);
          }}
        >
          Experiment:
        </Dropdown>
        <Slider
          value={elasticity}
          onChange={(value) => {
            setElasticity(value);
            if (core) core.particles.E = value;
          }}
          min={0}
          max={1.2}
          step={0.01}
        >
          Pseudo-Elasticity: {elasticity.toFixed(2)}
        </Slider>
      </div>
    </div>
  );
};
