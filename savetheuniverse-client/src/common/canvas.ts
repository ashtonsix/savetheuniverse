const { max, floor } = Math;

class Canvas {
  height: number;
  width: number;
  img: ImageData;
  ctx: CanvasRenderingContext2D;
  constructor(container: HTMLElement, cellSz: number) {
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    this.height = max(floor(container.clientHeight / cellSz), 1);
    this.width = max(floor(container.clientWidth / cellSz), 1);
    const { height, width } = this;
    canvas.height = height;
    canvas.width = width;
    canvas.style.height = `${height * cellSz}px`;
    canvas.style.width = `${width * cellSz}px`;
    canvas.style.imageRendering = "pixelated";
    this.img = new ImageData(
      new Uint8ClampedArray(height * width * 4),
      width,
      height
    );
    this.ctx = canvas.getContext("2d")!;
  }
  draw(fn: (arr: Uint8ClampedArray) => void): void {
    fn(this.img.data);
    this.ctx.putImageData(this.img, 0, 0);
  }
}

export default Canvas;
