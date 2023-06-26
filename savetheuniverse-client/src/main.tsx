import "./style.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LayoutProse } from "./content/ui/LayoutProse";
import * as SaveTheUniverse from "./content/text/savetheuniverse.mdx";
import * as Appendices from "./content/text/appendices.mdx";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <LayoutProse {...SaveTheUniverse}>
        <SaveTheUniverse.default />
      </LayoutProse>
    ),
    errorElement: (
      <LayoutProse {...SaveTheUniverse}>
        <SaveTheUniverse.default />
      </LayoutProse>
    ),
  },
  {
    path: "/appendices",
    element: (
      <LayoutProse {...Appendices}>
        <Appendices.default />
      </LayoutProse>
    ),
  },
  // { path: "/particletoy", element: <ParticleToyStandalone /> },
]);

ReactDOM.createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
