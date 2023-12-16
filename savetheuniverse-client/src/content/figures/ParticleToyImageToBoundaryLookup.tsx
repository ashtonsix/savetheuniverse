import { useEffect, useRef, useState } from "react";
import { Boundary, BoundaryViz } from "../../particles/boundary";
import { Image, fileToImage, uploadFile } from "../../particles/boundary-image";
import { fitInside } from "../../common/grid-utils";

const { abs } = Math;

export const ParticleToyImageToBoundaryLookup = () => {
  const aref = useRef<SVGSVGElement>(null);
  const bref = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<Image | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const req = await fetch("/square.png");
      const file = await req.blob();
      const img = await fileToImage(file);
      if (!mounted) return;
      setImg(img);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!aref.current || !bref.current || !img) return;
    const svg = aref.current;
    const container = bref.current;

    const [scale, biasX, biasY] = fitInside(
      {
        top: 0,
        left: 0,
        width: container.clientWidth,
        height: container.clientHeight,
      },
      { top: -1, left: -1, width: 2, height: 2 },
      true
    );

    console.log(scale, biasX, biasY);

    svg.setAttribute(
      "viewBox",
      `${biasX} ${biasY} ${abs(biasX) * 2} ${abs(biasY) * 2}`
    );

    const boundary = new Boundary();
    const boundaryViz = new BoundaryViz(boundary, container);
    boundary.update(img);
    boundaryViz.draw();

    const pt = svg.createSVGPoint();
    svg.addEventListener(
      "mousemove",
      function (evt) {
        let src = "";
        pt.x = evt.clientX;
        pt.y = evt.clientY;
        let { x, y } = pt.matrixTransform(svg.getScreenCTM()!.inverse());
        boundary.collides(x, y, 2, (d, nx, ny) => {
          if (d !== boundary.distance(x, y, 2) && !boundary.distance(x, y, 2)) {
            debugger;
            boundary.distance(x, y, 2);
          }
          d = abs(d);
          src += `<circle cx="${x}" cy="${y}" r="${d}" stroke="white" stroke-width="0.005" fill="none"></circle>`;
          src += `<line x1="${x}" y1="${y}" x2="${x + nx * d}" y2="${
            y + ny * d
          }" stroke="white" stroke-width="0.005"></line>`;
        });

        svg.innerHTML = src;
      },
      false
    );

    return () => {
      boundaryViz.destroy();
      if (bref.current) bref.current.innerHTML = "";
    };
  }, [img]);

  return (
    <div>
      <div className="relative aspect-video">
        <div ref={bref} className="absolute inset-0" />
        <svg
          ref={aref}
          className="absolute w-full h-full"
          // viewBox="-1 -0.5625 2 1.125"
        />
      </div>
      <div className="flex pt-2 gap-2">
        <button
          className="border h-10 my-auto px-2 py-1 bg-slate-200 border-slate-800 cursor-pointer"
          onClick={async () => {
            const file = await uploadFile();
            const img = await fileToImage(file);
            setImg(img);
          }}
        >
          Upload Image
        </button>
      </div>
    </div>
  );
};
