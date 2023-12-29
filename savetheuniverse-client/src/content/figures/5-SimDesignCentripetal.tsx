import { useState, useRef, useEffect } from "react";
import { Core } from "../../cellgrid/core";
import { Button, Dropdown, Slider } from "../ui/FigureControls";

const { floor, random, sign, sin, cos, atan2, PI } = Math;

const stageSize = 72;
const innerSize = 48;

const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;

function reset(core: Core) {
  const margin = (stageSize - innerSize) / 2;
  const cx = stageSize / 2;
  const cy = stageSize / 2;
  const dir = sign(random() - 0.5);
  for (let i = 0; i < core.height * core.width; i++) {
    const x = i % core.width;
    const y = floor(i / core.width);
    const dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5;
    const boundaryThreshold = stageSize / 2 - (margin + 0.1);
    if (dist > boundaryThreshold) continue;
    const angle = atan2(y - cy, x - cx) + dir * random() * PI;
    const mag = random() * 2;
    core.val_x[i] = cos(angle) * mag;
    core.val_y[i] = sin(angle) * mag;
  }
}

function updateInterationField(core: Core, recenterInterpolation = 0) {
  let cxwv = 0;
  let cywv = 0;
  let cw = 0;

  for (let x = 0; x < core.height; x++) {
    for (let y = 0; y < core.height; y++) {
      const i = x + y * core.width;
      const w = (core.val_x[i] ** 2 + core.val_y[i] ** 2) ** 0.5;
      cxwv += w * x;
      cywv += w * y;
      cw += w;
    }
  }

  const margin = (stageSize - innerSize) / 2;
  const cx = mix(stageSize / 2, cxwv / cw, recenterInterpolation);
  const cy = mix(stageSize / 2, cywv / cw, recenterInterpolation);
  for (let i = 0; i < core.height * core.width; i++) {
    const x = i % core.width;
    const y = floor(i / core.width);
    const dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5;
    const boundaryThreshold = stageSize / 2 - (margin + 0.1);
    if (dist < boundaryThreshold) continue;
    const angle = atan2(y - cy, x - cx) + PI;
    const mag = dist - boundaryThreshold;
    const vary = 1 + random() * 0.001;
    core.itr_x[i] = cos(angle) * mag * vary;
    core.itr_y[i] = sin(angle) * mag * vary;
  }
}

export const SimDesignCentripetal = () => {
  const recenterInterpolationRef = useRef(1);
  const [dispersionFactor, setDispersionFactor] = useState(-0.1);
  const [core, setCore] = useState<Core | null>(null);
  const coreContainer = useRef(null);
  const [motionAmplification, setMotionAmplification] = useState("false");
  useEffect(() => {
    if (coreContainer.current) {
      const core = new Core(stageSize, stageSize, coreContainer.current);
      const margin = (stageSize - innerSize) / 2;
      core.viz!.bounds = { top: margin, bottom: margin - 1, left: 0, right: 0 };
      core.radius = 5;
      core.dispersion = (x: number) => {
        const d = dispersionFactor;
        return -d * x ** 2 + 0.5 * x + d + 0.5;
      };
      core.onBeforeStep = () => {
        updateInterationField(core, recenterInterpolationRef.current);
        recenterInterpolationRef.current *= 0.98;
      };
      setCore(core);
      reset(core);
      updateInterationField(core);
      return () => {
        core.destroy();
      };
    }
  }, []);

  useEffect(() => {
    const el = coreContainer.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) core!.ticker.playing = false;
    });
    observer.observe(el);
    return () => observer.unobserve(el!);
  }, [core]);

  return (
    <div>
      <div
        ref={coreContainer}
        style={{ aspectRatio: `${stageSize}/${innerSize + 1}` }}
      ></div>
      <div className="flex mt-2 gap-4">
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
            reset(core!);
            recenterInterpolationRef.current = 1;
          }}
        >
          Reset
        </Button>
        <Dropdown
          value={motionAmplification}
          options={[
            { value: "false", label: "Disabled" },
            { value: "true", label: "Enabled" },
          ]}
          onChange={async (value) => {
            setMotionAmplification(value);
            if (!core?.viz) return;
            core.viz.motionAmplification = value === "true";
            core.viz.draw();
          }}
        >
          Motion amplification:
        </Dropdown>
        <Slider
          onChange={(d) => {
            setDispersionFactor(d);
            if (core) {
              core.dispersion = (x: number) => {
                return -d * x ** 2 + 0.5 * x + d + 0.5;
              };
              recenterInterpolationRef.current = 1;
            }
          }}
          value={dispersionFactor}
          min={-0.25}
          max={0.25}
          step={0.01}
        >
          Dispersion = {dispersionFactor.toFixed(2)}
        </Slider>
      </div>
    </div>
  );
};
