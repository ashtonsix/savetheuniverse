import { useState, useRef, useEffect } from "react";
import { Core } from "../../cellgrid/core";

const { floor } = Math;

export const SimDesignCentripetal = () => {
  const [dispersionFactor, setDispersionFactor] = useState(-0.25);
  const [nonce, setNonce] = useState(0);
  const [core, setCore] = useState<Core | null>(null);
  const coreContainer = useRef(null);
  useEffect(() => {
    if (coreContainer.current) {
      const length = 64;
      const core = new Core(length, length, coreContainer.current);
      setCore(core);
      core.dispersion = (x: number) => {
        const d = dispersionFactor;
        return -d * x ** 2 + 0.5 * x + d + 0.5;
      };

      const cx = length / 2;
      const cy = length / 2;
      for (let i = 0; i < core.height * core.width; i++) {
        const x = i % core.width;
        const y = floor(i / core.width);
        const dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5;
        const boundaryThreshold = length / 2 - 10;
        if (dist > boundaryThreshold) {
          const angle = Math.atan2(y - cy, x - cx) + Math.PI;
          const mag = ((dist - boundaryThreshold) * 12) / length;
          core.itr_x[i] = Math.cos(angle) * mag;
          core.itr_y[i] = Math.sin(angle) * mag;
        } else {
          const angle = Math.atan2(y - cy, x - cx) + Math.random() * Math.PI;
          const mag = Math.random() * 2;
          core.val_x[i] = Math.cos(angle) * mag;
          core.val_y[i] = Math.sin(angle) * mag;
        }
      }
      (window as any).core = core;
      core.neighbourhoodRadius = 4;
      return () => {
        core.destroy();
      };
    }
  }, [nonce]);

  return (
    <div>
      <div ref={coreContainer} className="aspect-video"></div>
      <div className="flex mt-2 gap-4">
        <button
          className="border h-10 my-auto px-2 py-1 bg-slate-200 border-slate-800 cursor-pointer"
          onClick={() => {
            if (core) {
              core.ticker.playing = !core.ticker.playing;
            }
          }}
        >
          Play / Pause
        </button>
        <button
          className="border h-10 my-auto px-2 py-1 bg-slate-200 border-slate-800 cursor-pointer"
          onClick={() => {
            setNonce((nonce) => nonce + 1);
          }}
        >
          Reset
        </button>
        <label>
          Dispersion = {dispersionFactor.toFixed(2)}
          <br />
          <input
            type="range"
            value={dispersionFactor}
            min={-0.25}
            max={0.25}
            step={0.01}
            className="w-72"
            onChange={(e) => {
              const d = +e.target.value;
              setDispersionFactor(d);
              if (core) {
                core.dispersion = (x: number) => {
                  return -d * x ** 2 + 0.5 * x + d + 0.5;
                };
              }
            }}
          />
        </label>
      </div>
    </div>
  );
};
