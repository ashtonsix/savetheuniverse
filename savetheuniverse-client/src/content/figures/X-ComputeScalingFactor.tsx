import { Link } from "react-router-dom";
import { LayoutStandalone } from "../ui/Layout";
import { useState } from "react";

export const ComputeScalingFactor = () => {
  const [dispersion, setDispersion] = useState(0.25);
  const [radius, setRadius] = useState(5);
  const [zcurtainEnabled, setZCurtainEnabled] = useState(true);
  const curtain = radius - 1;
  const zcurtain = zcurtainEnabled ? curtain : 0;

  let cx = 1;
  let cy = 0;
  let cz = 0;

  let ax = 0;
  let ay = 0;
  let az = 0;
  let am = 0;

  for (let x = -curtain; x <= curtain; x++) {
    for (let y = -curtain; y <= curtain; y++) {
      for (let z = -zcurtain; z <= zcurtain; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        let d = (x ** 2 + y ** 2 + z ** 2) ** 0.5;
        let nd = d / radius;
        let m = (cx ** 2 + cy ** 2 + cz ** 2) ** 0.5;
        let Xd = Math.max(0, nd - nd * nd);
        let alpha = (x * cx + y * cy + z * cz) / (d * m);
        let Da = -dispersion * alpha * alpha + 0.5 * alpha + dispersion + 0.5;

        let M = m * Xd * Da;
        ax += x * M;
        ay += y * M;
        az += z * M;
        am += M;
      }
    }
  }

  return (
    <div>
      <div>
        <label className="w-[100px] inline-block" htmlFor="dispersion">
          Dispersion:
        </label>
        <input
          type="range"
          id="dispersion"
          min="-0.25"
          max="0.25"
          step="0.01"
          value={dispersion}
          onChange={(e) => setDispersion(parseFloat(e.target.value))}
        />
        <span>{dispersion}</span>
      </div>
      <div>
        <label className="w-[100px] inline-block" htmlFor="radius">
          Radius:
        </label>
        <input
          type="range"
          id="radius"
          min="2"
          max="17"
          step="1"
          value={radius}
          onChange={(e) => setRadius(parseInt(e.target.value))}
        />
        <span>{radius}</span>
      </div>
      <div>
        <label className="w-[100px] inline-block" htmlFor="zcurtain">
          3D:
        </label>
        <input
          type="checkbox"
          id="zcurtain"
          checked={zcurtain !== 0}
          onChange={(e) => setZCurtainEnabled(e.target.checked)}
        />
      </div>
      <div>S = {1 / am}</div>
    </div>
  );
};

export const ComputeScalingFactorPage = () => {
  return (
    <LayoutStandalone
      title="Secret test page — compute scaling factor"
      subtitle={
        <>
          Part of{" "}
          <Link to="/" className="text-[#005dff] italic">
            Save the Universe!
          </Link>{" "}
        </>
      }
    >
      <ComputeScalingFactor />
    </LayoutStandalone>
  );
};
