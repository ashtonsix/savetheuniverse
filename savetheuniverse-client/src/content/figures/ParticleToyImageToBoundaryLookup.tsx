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
  splinesToSegmentLookupTable,
} from "../../particles/boundary-image";
import { allXY } from "../../common/grid-utils";

const main = async () => {
  const req = await fetch("/arrow_boundary_example.png");
  const file = await req.blob();
  const img = await fileToImage(file);
  const mask = imageToMask(img);
  const polygons = maskToPolygons(mask);
  rescalePolygons(polygons);
  for (let p of polygons) {
    smoothPolygon(p, 64);
  }
  const bSplineCoeffients = polygonToBSplineCoeffcients(polygons[0]);
  splinesToSegmentLookupTable([bSplineCoeffients]);
};

export const ParticleToyImageToBoundaryLookup = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<Blob | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const resizeObserver = new ResizeObserver(async () => {});
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

  return (
    <div>
      <div className="aspect-video border border-gray-500">TODO</div>
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
      </div>
    </div>
  );
};
