export function encodeAnimatedGif(width: number, height: number, frames: Uint8ClampedArray[], delayMs = 220): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 1_000_000) throw new Error("GIF dimensions are outside the supported range.");
  if (!frames.length || frames.some(frame => frame.length !== width * height * 4)) throw new Error("GIF frames must all have the same dimensions.");
  const output: number[] = [];
  const ascii = (value: string) => { for (let i = 0; i < value.length; i++) output.push(value.charCodeAt(i)); };
  const byte = (value: number) => output.push(value & 255);
  const word = (value: number) => { byte(value); byte(value >> 8); };
  ascii("GIF89a"); word(width); word(height); byte(0xf7); byte(0); byte(0);
  for (let r = 0; r < 8; r++) for (let g = 0; g < 8; g++) for (let b = 0; b < 4; b++) {
    byte(Math.round(r * 255 / 7)); byte(Math.round(g * 255 / 7)); byte(Math.round(b * 255 / 3));
  }
  ascii("!\xff\x0bNETSCAPE2.0"); byte(3); byte(1); word(0); byte(0);

  const lzw = (indices: Uint8Array): number[] => {
    const clear = 256, end = 257;
    let nextCode = 258, codeSize = 9;
    let dictionary = new Map<number, number>();
    const data: number[] = [];
    let bitBuffer = 0, bitCount = 0;
    const writeCode = (code: number) => {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) { data.push(bitBuffer & 255); bitBuffer >>= 8; bitCount -= 8; }
    };
    writeCode(clear);
    if (!indices.length) { writeCode(end); if (bitCount) data.push(bitBuffer & 255); return data; }
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const next = indices[i];
      const key = (prefix << 8) | next;
      const found = dictionary.get(key);
      if (found !== undefined) { prefix = found; continue; }
      writeCode(prefix);
      if (nextCode < 4096) {
        dictionary.set(key, nextCode++);
        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        writeCode(clear);
        dictionary = new Map<number, number>();
        nextCode = 258; codeSize = 9;
      }
      prefix = next;
    }
    writeCode(prefix); writeCode(end);
    if (bitCount) data.push(bitBuffer & 255);
    return data;
  };

  const delay = Math.max(2, Math.min(1000, Math.round(delayMs / 10)));
  for (const rgba of frames) {
    const indices = new Uint8Array(width * height);
    for (let i = 0, px = 0; i < rgba.length; i += 4, px++) indices[px] = ((rgba[i] >> 5) << 5) | ((rgba[i + 1] >> 5) << 2) | (rgba[i + 2] >> 6);
    byte(0x21); byte(0xf9); byte(4); byte(4); word(delay); byte(0); byte(0);
    byte(0x2c); word(0); word(0); word(width); word(height); byte(0);
    byte(8);
    const compressed = lzw(indices);
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const block = compressed.slice(offset, offset + 255);
      byte(block.length); output.push(...block);
    }
    byte(0);
  }
  byte(0x3b);
  return Uint8Array.from(output);
}
