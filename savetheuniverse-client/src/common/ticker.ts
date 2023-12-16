// Repeatedly executes a callback function at a specified interval (in frames).
export class Ticker {
  public playing = false;
  private counter = 0;
  callbackId = 0;

  constructor(private callback: () => void, public interval: number) {
    this.tick = this.tick.bind(this);
    this.tick();
  }

  destroy() {
    cancelAnimationFrame(this.callbackId);
  }

  private tick() {
    if (this.playing) {
      this.counter++;
      if (this.counter % this.interval === 0) this.callback();
    }
    this.callbackId = requestAnimationFrame(this.tick);
  }
}
