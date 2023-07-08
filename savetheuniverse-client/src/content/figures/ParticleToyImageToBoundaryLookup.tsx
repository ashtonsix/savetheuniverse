import React, { useState, useEffect } from "react";
import {
  Image,
  Polygon,
  uploadFile,
  fileToImage,
  imageToMask,
  maskToPolygons,
  smoothPolygon,
  rescalePolygons,
  evaluateBSpline,
  polygonToBSplineCoeffcients,
  splinesToSampleLookupTable,
  Spline,
  closestPointOnBoundary,
} from "../../particles/boundary-image";
import { allXY } from "../../common/grid-utils";

export const ParticleToyImageToBoundaryLookupOld = () => {
  const ref = React.useRef<SVGSVGElement>(null);
  const ref2 = React.useRef<SVGSVGElement>(null);

  // useEffect(() => {
  //   if (!ref.current) return;
  //   const resizeObserver = new ResizeObserver(async () => {});
  //   resizeObserver.observe(ref.current);
  //   return () => resizeObserver.disconnect();
  // }, [samples]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const req = await fetch("/square.png");
      const file = await req.blob();
      const img = await fileToImage(file);
      if (!mounted) return;
      const start = performance.now();
      const mask = imageToMask(img);
      const polygons = maskToPolygons(mask);
      rescalePolygons(polygons);
      const splines: Spline[] = [];
      for (let p of polygons) {
        smoothPolygon(p, 128);
        splines.push(polygonToBSplineCoeffcients(p));
      }
      const resolution = 64;
      const sampleLookupTable = splinesToSampleLookupTable(splines, resolution);
      const { samples, lookupTable } = sampleLookupTable;
      console.log(samples);
      console.log(lookupTable);
      console.log(performance.now() - start);
      // setSamples(samples);
      let src = "";
      for (let i = 0; i < samples.length; i += 32) {
        let x = samples[i + 2];
        let y = samples[i + 3];
        src += `<circle cx="${x}" cy="${y}" r="0.002" fill="white"></circle>`;
        // x = (Math.floor(x * 0.5 * resolution) * 2) / resolution;
        // y = (Math.floor(y * 0.5 * resolution) * 2) / resolution;
        // let sz = 2 / resolution;
        // src += `<rect x="${x}" y="${y}" width="${sz}" height="${sz}" fill="none" stroke="white" stroke-width="0.001"></rect>`;
      }

      const svg = ref.current;
      const svg2 = ref2.current;

      let length = 0;

      if (svg && svg2) {
        let src2 = src;
        for (let [x, y, i] of allXY(resolution, resolution)) {
          let xa = (x * 2 + 1) / resolution - 1;
          let ya = (y * 2 + 1) / resolution - 1;
          const s = lookupTable[i];
          if (s === -1) continue;
          let xb = samples[s + 2];
          let yb = samples[s + 3];
          length += Math.sqrt(Math.pow(xa - xb, 2) + Math.pow(ya - yb, 2));
          // src2 += `<line x1="${xa}" y1="${ya}" x2="${xb}" y2="${yb}" stroke="white" stroke-width="0.0005"></line>`;
        }
        svg.innerHTML = src2;
        // console.log((length / resolution ** 2) * 100);

        var pt = svg2.createSVGPoint();
        svg2.addEventListener(
          "mousemove",
          function (evt) {
            let src = "";
            pt.x = evt.clientX;
            pt.y = evt.clientY;
            let { x, y } = pt.matrixTransform(svg2.getScreenCTM()!.inverse());
            const closest = closestPointOnBoundary(
              splines,
              sampleLookupTable,
              x,
              y,
              0
            );
            let dist = ((x - closest[2]) ** 2 + (y - closest[3]) ** 2) ** 0.5;
            src += `<circle cx="${x}" cy="${y}" r="${dist}" stroke="white" stroke-width="0.005" fill="none"></circle>`;

            // x = Math.floor((x * 0.5 + 0.5) * resolution);
            // y = Math.floor((y * 0.5 + 0.5) * resolution);
            // const s = lookupTable[y * resolution + x];
            // for (let i = 0; i < 32; i += 4) {
            //   let x = samples[s + i + 2];
            //   let y = samples[s + i + 3];
            //   src += `<circle cx="${x}" cy="${y}" r="0.02" fill="white"></circle>`;
            // }
            svg2.innerHTML = src;
          },
          false
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <div className="relative aspect-video border border-gray-500 bg-slate-700">
        <svg
          ref={ref}
          className="absolute w-full h-full"
          viewBox={`-1 -1 2 2`}
        />
        <svg
          ref={ref2}
          className="absolute w-full h-full"
          viewBox={`-1 -1 2 2`}
        />
      </div>
      <div className="flex pt-2 gap-2">
        <button
          className="border h-10 my-auto px-2 py-1 bg-slate-200 border-slate-800 cursor-pointer"
          onClick={async () => {
            // const file = await uploadFile();
            // setFile(file);
          }}
        >
          Upload Image
        </button>
      </div>
    </div>
  );
};

export const ParticleToyImageToBoundaryLookup = () => {
  return null;
};
