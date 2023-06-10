import { useRef, useEffect, ReactElement, useState } from "react";
import { Core } from "../cellgrid/core";
import React from "react";

const { floor } = Math;

function initCoreTransferViz(
  container: HTMLElement,
  radius: number,
  dispersionFactor: number,
  angle: number
) {
  let h = radius * 2 + 1;
  let w = radius * 2 + 1;

  const core = new Core(h, w, container);
  core.neighbourhoodRadius = radius;
  core.dispersion = (x: number) => {
    const d = dispersionFactor;
    return -d * x ** 2 + 0.5 * x + d + 0.5;
  };
  core.val_x[floor(w / 2) + floor(h / 2) * w] = Math.cos(angle);
  core.val_y[floor(w / 2) + floor(h / 2) * w] = Math.sin(angle);
  for (let i = 0; i < h * w; i++) {
    let xd = (i % w) - w / 2;
    let yd = floor(i / w) - h / 2;
    core.itr_x[i] = -xd / 35;
    core.itr_y[i] = -yd / 35;
  }

  return core;
}

export const TransferViz = ({ children }: { children: React.ReactNode }) => {
  const captions: { [id: string]: React.ReactNode } = {};
  React.Children.forEach(children, (caption) => {
    const { props } = caption as ReactElement;
    captions[props.id] = props.children;
  });

  const [radius, setRadius] = useState(8);
  const [angle, setAngle] = useState(0);
  const [dispersionFactor, setDispersionFactor] = useState(0);
  const distanceContainer = useRef(null);
  const dispersionContainer = useRef(null);
  const combinedContainer = useRef(null);
  useEffect(() => {
    if (
      distanceContainer.current &&
      dispersionContainer.current &&
      combinedContainer.current
    ) {
      const distance = initCoreTransferViz(
        distanceContainer.current,
        radius,
        dispersionFactor,
        angle
      );
      const dispersion = initCoreTransferViz(
        dispersionContainer.current,
        radius,
        dispersionFactor,
        angle
      );
      const combined = initCoreTransferViz(
        combinedContainer.current,
        radius,
        dispersionFactor,
        angle
      );
      distance.dispersion = () => 1;
      dispersion.distance = () => 1;
      distance.scalingFactor = 4;
      dispersion.scalingFactor = 1;
      combined.scalingFactor = 4;
      distance.step();
      dispersion.step();
      combined.step();
      return () => {
        distance.destroy();
        dispersion.destroy();
        combined.destroy();
      };
    }
  }, [radius, dispersionFactor, angle]);
  return (
    <div className="[&_p]:inline text-center">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div ref={distanceContainer} className="aspect-square"></div>
          <div className="py-2">{captions.distance}</div>
        </div>
        <div>
          <div ref={dispersionContainer} className="aspect-square"></div>
          <div className="py-2">{captions.dispersion}</div>
        </div>
        <div>
          <div ref={combinedContainer} className="aspect-square"></div>
          <div className="py-2">{captions.combined}</div>
        </div>
      </div>
      <hr />
      <div className="grid grid-cols-3 gap-2">
        <label className="pt-2">
          {captions.radius} = {radius}
          <input
            className="w-full"
            type="range"
            value={radius}
            onChange={(e) => setRadius(+e.target.value)}
            min={1}
            max={16}
            step={1}
          />
        </label>
        <label className="pt-2">
          {captions.dispersionFactor} = {dispersionFactor.toFixed(2)}
          <input
            className="w-full"
            type="range"
            value={dispersionFactor}
            onChange={(e) => setDispersionFactor(+e.target.value)}
            min={-0.25}
            max={0.25}
            step={0.01}
          />
        </label>
        <label className="pt-2">
          {captions.angle} = {angle.toFixed(2)}
          <input
            className="w-full"
            type="range"
            value={angle}
            onChange={(e) => setAngle(+e.target.value)}
            min={-Math.PI / 2}
            max={Math.PI / 2}
            step={0.01}
          />
        </label>
      </div>
    </div>
  );
};

const TransferVizCaption = ({
  children,
}: {
  children: React.ReactNode;
  id: string;
}) => <span>{children}</span>;

TransferViz.Caption = TransferVizCaption;

const mix = (a: number, b: number, p: number) => {
  Math.min(Math.max(a, a * (1 - p) + b * p), b);
};

export const SimDesign = () => {
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
