import { useRef, useEffect, ReactElement, useState } from "react";
import { Core } from "../../cellgrid/core";
import React from "react";
import { Latex } from "../ui/Latex";

const { floor } = Math;

function initCoreSimDesignTransfer(
  container: HTMLElement,
  radius: number,
  dispersionFactor: number,
  angle: number
) {
  let h = radius * 2 - 1;
  let w = radius * 2 - 1;

  const core = new Core(h, w, container);
  core.radius = radius;
  core.dispersion = (x: number) => {
    const d = dispersionFactor;
    return -d * x ** 2 + 0.5 * x + d + 0.5;
  };
  core.val_x[floor(w / 2) + floor(h / 2) * w] = Math.cos(angle);
  core.val_y[floor(w / 2) + floor(h / 2) * w] = Math.sin(angle);

  return core;
}

export const SimDesignTransfer = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const captions: { [id: string]: React.ReactNode } = {};
  React.Children.forEach(children, (caption) => {
    const { props } = caption as ReactElement;
    captions[props.id] = props.children;
  });

  const [radius, setRadius] = useState(9);
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
      const distance = initCoreSimDesignTransfer(
        distanceContainer.current,
        radius,
        dispersionFactor,
        angle
      );
      const dispersion = initCoreSimDesignTransfer(
        dispersionContainer.current,
        radius,
        dispersionFactor,
        angle
      );
      const combined = initCoreSimDesignTransfer(
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
          <div className="py-2">
            <Latex math="\mathbf{\hat{d}} \cdot X(d)" />
          </div>
        </div>
        <div>
          <div ref={dispersionContainer} className="aspect-square"></div>
          <div className="py-2">
            <Latex math="\mathbf{\hat{d}} \cdot D(\alpha)" />
          </div>
        </div>
        <div>
          <div ref={combinedContainer} className="aspect-square"></div>
          <div className="py-2">
            <Latex math="\mathbf{\hat{d}} \cdot X(d) \cdot D(\alpha)" />
          </div>
        </div>
      </div>
      <hr />
      <div className="grid grid-cols-3 gap-2">
        <label className="pt-2">
          <Latex math="r" /> = {radius}
          <input
            className="w-full"
            type="range"
            value={radius}
            onChange={(e) => setRadius(+e.target.value)}
            min={2}
            max={17}
            step={1}
          />
        </label>
        <label className="pt-2">
          <Latex math="\delta" /> = {dispersionFactor.toFixed(2)}
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
          <Latex math="\theta_1" /> = {angle.toFixed(2)}
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

const SimDesignTransferCaption = ({
  children,
}: {
  children: React.ReactNode;
  id: string;
}) => <span>{children}</span>;

SimDesignTransfer.Caption = SimDesignTransferCaption;
