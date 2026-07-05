declare module 'gifenc' {
  export type Palette = Array<[number, number, number] | [number, number, number, number]>;

  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): Palette;

  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette): Uint8Array;

  export interface WriteFrameOptions {
    palette?: Palette;
    delay?: number;
    transparent?: boolean;
    dispose?: number;
    repeat?: number;
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  }

  export function GIFEncoder(options?: { auto?: boolean }): Encoder;
}
