import "./style.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { Layout } from "./text/Layout";

ReactDOM.createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <Layout />
  </React.StrictMode>
);
