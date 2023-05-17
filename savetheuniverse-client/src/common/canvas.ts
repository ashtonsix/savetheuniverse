const { max, floor } = Math;

class Canvas {
  height = 1;
  width = 1;
  img = new ImageData(new Uint8ClampedArray(4), 1, 1);
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  constructor(public container: HTMLElement, public cellSz: number) {
    this.canvas = document.createElement("canvas");
    container.appendChild(this.canvas);
    this.canvas.style.imageRendering = "pixelated";
    this.ctx = this.canvas.getContext("2d")!;
    this.resize();
  }
  resize() {
    const { canvas, container, cellSz } = this;
    const height = max(floor(container.clientHeight / cellSz), 1);
    const width = max(floor(container.clientWidth / cellSz), 1);
    Object.assign(this, { height, width });
    this.img = new ImageData(
      new Uint8ClampedArray(height * width * 4),
      width,
      height
    );
    canvas.height = height;
    canvas.width = width;
    canvas.style.height = `${height * cellSz}px`;
    canvas.style.width = `${width * cellSz}px`;
  }
  draw(fn: (arr: Uint8ClampedArray) => void): void {
    fn(this.img.data);
    this.ctx.putImageData(this.img, 0, 0);
  }
}

export default Canvas;
