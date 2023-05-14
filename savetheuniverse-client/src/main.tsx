import "./style.css";
import React from "react";
import ReactDOM from "react-dom/client";
import * as Text from "./text/text.mdx";

const App = () => {
  return (
    <main>
      <header className="layout pt-12 mb-8">
        <h1 className="relative text-5xl font-bold mb-2">
          <div className="absolute inline-block -left-16 h-12 w-12 bg-[#4d9fef]"></div>
          {Text.title}
        </h1>
        <p className="text-lg">{Text.subtitle}</p>
      </header>
      <div className="layout border-y py-4 mb-8">
        <div className="grid grid-cols-4">
          {Text.byline.map(({ label, value }) => (
            <div key={label}>
              <div className="uppercase text-gray-500 text-xs">{label}</div>
              <div className="text-sm mt-1">{value}</div>
            </div>
          ))}
        </div>
      </div>
      <article className="prose layout">
        <Text.default />
      </article>
    </main>
  );
};

ReactDOM.createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
