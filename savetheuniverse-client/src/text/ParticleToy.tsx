import { useRef, useEffect } from "react";
import { Core } from "../particles/core";
import { Driver } from "../particles/driver";

export const ParticleToy = () => {
  const driverContainer = useRef(null);
  const coreContainer = useRef(null);
  useEffect(() => {
    if (driverContainer.current && coreContainer.current) {
      const driver = new Driver(driverContainer.current);
      const core = new Core(driver, coreContainer.current);
      Object.assign(window, { driver, core });
      return () => {
        driver.destroy();
        core.destroy();
      };
    }
  }, []);
  return (
    <div className="absolute inset-0">
      <div ref={coreContainer} className="absolute inset-0"></div>
      <div ref={driverContainer} className="absolute inset-0"></div>
    </div>
  );
};
