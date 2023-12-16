import "./style.css";
import "katex/dist/katex.min.css";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LayoutProse } from "./content/ui/LayoutProse";
import * as SaveTheUniverse from "./content/text/savetheuniverse.mdx";
import AppendixA1 from "./content/text/appendix-a-particle-toy-standalone";
import * as AppendixA2 from "./content/text/appendix-a-particle-toy-notes.mdx";
import { ParticleToyEntropyPage } from "./content/figures/ParticleToyEntropy";
import { SimVideoOutput } from "./content/figures/SimVideoOutput";

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
    path: "/particle-toy-standalone",
    element: <AppendixA1 />,
  },
  {
    path: "/particle-toy-entropy",
    element: <ParticleToyEntropyPage />,
  },
  {
    path: "/particle-toy-notes",
    element: (
      <LayoutProse {...AppendixA2}>
        <AppendixA2.default />
      </LayoutProse>
    ),
  },
  { path: "/sim-video", element: <SimVideoOutput /> },
]);

ReactDOM.createRoot(document.querySelector("#root")!).render(
  <RouterProvider router={router} />
);
