import {random} from 'remotion';
import {DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture} from 'three';

// Procedural stacked-ledgestone (color + normal map). Seeded, so every render tab builds the same wall.
const SIZE = 256;

const texture = (data: Uint8Array, srgb: boolean): Texture => {
  const t = new DataTexture(data, SIZE, SIZE);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
};

export const makeStoneTextures = (tint: [number, number, number], seed = 'acumen-stone') => {
  const height = new Float32Array(SIZE * SIZE);
  const shade = new Float32Array(SIZE * SIZE);
  let y = 0;
  let row = 0;
  while (y < SIZE) {
    const rowH = Math.min(SIZE - y, Math.round(10 + random(`${seed}-h${row}`) * 18));
    let x = Math.floor(random(`${seed}-o${row}`) * SIZE);
    const end = x + SIZE;
    let stone = 0;
    while (x < end) {
      const w = Math.round(28 + random(`${seed}-w${row}-${stone}`) * 70);
      const lift = 0.35 + random(`${seed}-l${row}-${stone}`) * 0.65;
      const tone = 0.78 + random(`${seed}-t${row}-${stone}`) * 0.3;
      for (let yy = y; yy < y + rowH; yy++) {
        for (let xx = x; xx < Math.min(x + w, end); xx++) {
          const i = yy * SIZE + (xx % SIZE);
          const inset = Math.min(xx - x, x + w - 1 - xx, yy - y, y + rowH - 1 - yy);
          const bevel = Math.min(1, inset / 2.5);
          const grain = random(`${seed}-g${i}`) * 0.12;
          height[i] = inset <= 0 ? 0 : lift * bevel + grain * bevel;
          shade[i] = inset <= 0 ? 0.45 : tone - grain * 0.6;
        }
      }
      x += w;
      stone++;
    }
    y += rowH;
    row++;
  }

  const color = new Uint8Array(SIZE * SIZE * 4);
  const normal = new Uint8Array(SIZE * SIZE * 4);
  const at = (x: number, yy: number) => height[((yy + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let yy = 0; yy < SIZE; yy++) {
    for (let x = 0; x < SIZE; x++) {
      const i = yy * SIZE + x;
      const dx = (at(x + 1, yy) - at(x - 1, yy)) * 2.2;
      const dy = (at(x, yy + 1) - at(x, yy - 1)) * 2.2;
      const len = Math.hypot(dx, dy, 1);
      normal.set([((-dx / len) * 0.5 + 0.5) * 255, ((-dy / len) * 0.5 + 0.5) * 255, ((1 / len) * 0.5 + 0.5) * 255, 255], i * 4);
      color.set([tint[0] * shade[i], tint[1] * shade[i], tint[2] * shade[i], 255], i * 4);
    }
  }
  return {map: texture(color, true), normalMap: texture(normal, false)};
};
