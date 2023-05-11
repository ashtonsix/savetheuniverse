import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { Core } from "./particles/core";
import { Driver } from "./particles/driver";
import "./style.css";

const ParticleSimulation = () => {
  const driverContainer = useRef(null);
  const coreContainer = useRef(null);
  useEffect(() => {
    if (driverContainer.current && coreContainer.current) {
      const driver = new Driver(driverContainer.current);
      const core = new Core(driver, coreContainer.current);
      Object.assign(window, { driver, core });
    }
  }, []);
  return (
    <div className="h-screen relative">
      <div ref={coreContainer} className="absolute inset-0"></div>
      <div ref={driverContainer} className="absolute inset-0"></div>
    </div>
  );
};

const App = () => {
  return (
    <div>
      <ParticleSimulation />
    </div>
  );
};

ReactDOM.createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
