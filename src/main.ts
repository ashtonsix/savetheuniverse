import { Core } from "./particles/core";
import { Driver } from "./particles/driver";
import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="h-screen">
    <div id="core-container" class="absolute inset-0"></div>
    <div id="driver-container" class="absolute inset-0"></div>
  </div>
`;

const driver = new Driver(
  document.querySelector<HTMLDivElement>("#driver-container")!
);
const core = new Core(
  driver,
  document.querySelector<HTMLDivElement>("#core-container")!
);

// core.frame();

Object.assign(window, { driver, core });
