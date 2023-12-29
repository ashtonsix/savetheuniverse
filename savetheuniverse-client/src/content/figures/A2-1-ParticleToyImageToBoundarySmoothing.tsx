import React, { useState, useEffect } from "react";
import {
  Image,
  Polygon,
  uploadFile,
  fileToImage,
  imageToMask,
  maskToPolygons,
  smoothPolygon,
  evaluateBSpline,
  polygonToBSplineCoeffcients,
} from "../../particles/boundary-image";
import { allXY } from "../../common/grid-utils";

async function maskToDataURL(mask: Image) {
  const { width, height } = mask;
  const data = new Uint8Array(width * height * 4);
  for (let [x, y, i] of allXY(width, height)) {
    if (x >= width || y >= height) {
      data[i * 4 + 0] = 0;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 255;
    } else {
      let j = y * mask.width + x;
      data[i * 4 + 0] = mask.data[j] ? 0 : 255;
      data[i * 4 + 1] = mask.data[j] ? 0 : 255;
      data[i * 4 + 2] = mask.data[j] ? 0 : 255;
      data[i * 4 + 3] = 255;
    }
  }
  let imageData = new ImageData(new Uint8ClampedArray(data), width, height);
  let offscreenCanvas = new OffscreenCanvas(width, height);
  let ctx = offscreenCanvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);
  let blob = await offscreenCanvas.convertToBlob();
  let reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      if (reader.error) reject(reader.error);
      else resolve(reader.result as string);
    };
    reader.readAsDataURL(blob);
  });
}

const PolygonViz = ({
  background,
  polygons,
  dimensions,
  smoothingIterations,
  bSplineEnabled,
  hidePolygon,
}: {
  background: string;
  polygons: Polygon[];
  dimensions: { width: number; height: number };
  smoothingIterations?: number;
  bSplineEnabled?: boolean;
  hidePolygon?: boolean;
}) => {
  polygons = polygons.slice();
  for (let i = 0; i < polygons.length; i++) {
    polygons[i] = { x: polygons[i].x.slice(), y: polygons[i].y.slice() };
    let p = polygons[i];
    if (smoothingIterations) smoothPolygon(p, smoothingIterations);
    if (!bSplineEnabled) continue;
    const bSplineCoeffients = polygonToBSplineCoeffcients(p);
    const step = 1 / 4;
    let j = 0;
    let n = p.x.length;
    for (let t = 0; t < n; t += step, j++) {
      let [x, y] = evaluateBSpline(bSplineCoeffients, t);
      p.x[j] = x;
      p.y[j] = y;
    }
  }

  return (
    <div className="bg-black aspect-square relative">
      <img
        src={background}
        className={`[image-rendering:pixelated] w-full h-full object-contain absolute ${
          !hidePolygon && "opacity-25"
        }`}
      />
      {!hidePolygon && (
        <svg
          className="absolute w-full h-full"
          viewBox={`-1 -1 ${dimensions.width} ${dimensions.height}`}
        >
          {polygons.map((polygon, i) => {
            let path = "";
            for (let i = 0; i <= polygon.x.length; i++) {
              const instruction = i === 0 ? "M" : "L"; // move or line
              const x = polygon.x[i % polygon.x.length];
              const y = polygon.y[i % polygon.y.length];
              path += `${instruction}${x},${y}`;
            }
            path += "Z";

            return (
              <React.Fragment key={i}>
                <path
                  fill="none"
                  stroke="#005dff"
                  strokeWidth="1"
                  d={path}
                ></path>
                <path
                  fill="none"
                  stroke="#4d9fef"
                  strokeWidth=".5"
                  d={path}
                ></path>
              </React.Fragment>
            );
          })}
        </svg>
      )}
    </div>
  );
};

export const ParticleToyImageToBoundarySmoothing = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [panelBackground, setPanelBackground] = useState<string | null>(null);
  const [polygons, setPolygons] = useState<Polygon[]>([]);
  const [smoothingIterations, setSmoothingIterations] = useState<number>(1);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const resizeObserver = new ResizeObserver(async () => {
      const maxSz = ref.current?.clientWidth ?? 0;
      if (!maxSz || !file) return;
      const img = await fileToImage(file, maxSz);
      const mask = imageToMask(img);
      const polygons = maskToPolygons(mask);
      const panelBackground = await maskToDataURL(mask);
      setPanelBackground(panelBackground);
      setDimensions({ width: mask.width, height: mask.height });
      setPolygons(polygons);
    });
    resizeObserver.observe(ref.current);
    return () => resizeObserver.disconnect();
  }, [file]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const req = await fetch("/arrow_boundary_example.png");
      const file = await req.blob();
      if (!mounted) return;
      setFile(file);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const panelProps = { background: panelBackground!, dimensions, polygons };
  const shouldRenderPanels = !!panelBackground;

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div ref={ref}>
          {shouldRenderPanels && (
            <>
              <PolygonViz {...panelProps} hidePolygon />
              No smoothing
            </>
          )}
        </div>
        {shouldRenderPanels && (
          <>
            <div>
              <PolygonViz
                {...panelProps}
                smoothingIterations={smoothingIterations}
              />
              Diffusion
            </div>
            <div>
              <PolygonViz {...panelProps} bSplineEnabled />
              B-Spline
            </div>
            <div>
              <PolygonViz
                {...panelProps}
                smoothingIterations={smoothingIterations}
                bSplineEnabled
              />
              Diffusion + B-Spline
            </div>
          </>
        )}
      </div>
      <div className="flex pt-2 gap-2">
        <button
          className="border h-10 my-auto px-2 py-1 bg-slate-200 border-slate-800 cursor-pointer"
          onClick={async () => {
            const file = await uploadFile();
            setFile(file);
          }}
        >
          Upload Image
        </button>
        <label className="flex-grow">
          Diffusion iterations: {smoothingIterations}
          <input
            className="w-full"
            type="range"
            value={smoothingIterations}
            onChange={(e) => setSmoothingIterations(+e.target.value)}
            min={0}
            max={128}
            step={1}
          />
        </label>
      </div>
    </div>
  );
};
