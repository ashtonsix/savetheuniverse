import { useRef, useEffect } from "react";
import { Core } from "../../particles/core";
import { Driver } from "../../particles/driver";
import { fileToImage } from "../../particles/boundary-image";

export const ParticleToyPseudoMomentum = () => {
  const driverContainer = useRef(null);
  const coreContainer = useRef(null);
  useEffect(() => {
    let driver: Driver;
    let core: Core;
    let mounted = true;
    if (driverContainer.current && coreContainer.current && mounted) {
      driver = new Driver(driverContainer.current);
      core = new Core(driver, coreContainer.current);
    }
    // (async () => {
    //     const req = await fetch("/square.png");
    //     const file = await req.blob();
    //     const img = await fileToImage(file);
    //   }
    // })();
    // core.boundary.init();
    // core.simulationStepSize *= 10;
    // for (let i = 0; i < 10; i++) {
    //   core.step();
    // }
    // core.simulationStepSize *= 0.1;
    return () => {
      mounted = false;
      if (driver) driver.destroy();
      if (core) core.destroy();
    };
  }, []);
  return (
    <div className="absolute inset-0">
      <div ref={coreContainer} className="absolute inset-0"></div>
      <div ref={driverContainer} className="absolute inset-0"></div>
    </div>
  );
};
