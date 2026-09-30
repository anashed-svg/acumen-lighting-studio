import {useMemo} from 'react';
import {random} from 'remotion';
import {CanvasTexture, Color, SRGBColorSpace} from 'three';
import {makeStoneTextures} from './stone';

// Warm interior seen through glazing: cove-lit ceiling, downlight pools, dark floor, a faint glass sheen.
const interiorTexture = () => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, '#ffffff');
  v.addColorStop(0.1, '#9a9a9a');
  v.addColorStop(0.55, '#3c3c3c');
  v.addColorStop(0.78, '#2a2a2a');
  v.addColorStop(0.8, '#141414');
  v.addColorStop(1, '#101010');
  g.fillStyle = v;
  g.fillRect(0, 0, 256, 256);
  for (const x of [48, 128, 208]) {
    const pool = g.createRadialGradient(x, 30, 0, x, 30, 90);
    pool.addColorStop(0, 'rgba(255,255,255,0.35)');
    pool.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = pool;
    g.fillRect(0, 0, 256, 256);
  }
  const sheen = g.createLinearGradient(0, 256, 256, 0);
  sheen.addColorStop(0.35, 'rgba(0,0,0,0)');
  sheen.addColorStop(0.5, 'rgba(0,0,0,0.35)');
  sheen.addColorStop(0.65, 'rgba(0,0,0,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, 256, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
};

const Glazing: React.FC<{position: [number, number, number]; size: [number, number]; mullions: number; glow: Color}> = ({
  position,
  size: [w, h],
  mullions,
  glow,
}) => {
  const map = useMemo(interiorTexture, []);
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={map} color={glow} toneMapped={false} />
      </mesh>
      {Array.from({length: mullions + 1}, (_, i) => (
        <mesh key={i} position={[-w / 2 + (i * w) / mullions, 0, 0.03]}>
          <boxGeometry args={[0.05, h, 0.05]} />
          <meshStandardMaterial color="#111" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
};

export type VillaLook = {stone: string; render: string; accent: string};

// A two-storey modern villa in metres: glazed ground floor, cantilevered upper box, ledgestone fin wall.
export const Villa: React.FC<VillaLook & {interior: number}> = ({stone, render, accent, interior}) => {
  const stoneMaps = useMemo(() => {
    const {r, g, b} = new Color(stone).getRGB({r: 0, g: 0, b: 0}, SRGBColorSpace);
    return makeStoneTextures([r * 255, g * 255, b * 255]);
  }, [stone]);
  const glow = new Color(accent).multiplyScalar(0.03 + 0.3 * interior);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#0b0b0a" roughness={0.92} />
      </mesh>
      <mesh position={[-1, 0.12, 0.2]}>
        <boxGeometry args={[17, 0.24, 7.6]} />
        <meshStandardMaterial color="#2b2926" roughness={0.7} />
      </mesh>

      <mesh position={[-2.2, 1.74, -1.1]}>
        <boxGeometry args={[9, 2.98, 3.8]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.4} />
      </mesh>
      <Glazing position={[-2.2, 1.74, 0.81]} size={[8.8, 2.96]} mullions={6} glow={glow} />

      <mesh position={[-2.15, 4.68, -0.45]}>
        <boxGeometry args={[9.9, 2.86, 6.1]} />
        <meshStandardMaterial color={render} roughness={0.95} />
      </mesh>
      <Glazing position={[-3.1, 4.72, 2.611]} size={[6.6, 1.05]} mullions={4} glow={glow.clone().multiplyScalar(0.7)} />

      <mesh position={[4.25, 3.3, -0.6]}>
        <boxGeometry args={[3.2, 6.6, 4.4]} />
        <meshStandardMaterial
          map={stoneMaps.map}
          normalMap={stoneMaps.normalMap}
          normalScale={[1.6, 1.6]}
          roughness={0.92}
          map-repeat={[2.2, 4.4]}
          normalMap-repeat={[2.2, 4.4]}
        />
      </mesh>
    </group>
  );
};

// Low-poly specimen tree: a trunk and a clustered canopy for an uplight to catch.
export const Tree: React.FC<{position: [number, number, number]; seed?: string}> = ({position, seed = 'tree'}) => {
  const blobs = useMemo(
    () =>
      Array.from({length: 9}, (_, i) => ({
        p: [
          (random(`${seed}x${i}`) - 0.5) * 2.4,
          2.7 + random(`${seed}y${i}`) * 1.3,
          (random(`${seed}z${i}`) - 0.5) * 1.6,
        ] as const,
        r: 0.55 + random(`${seed}r${i}`) * 0.5,
      })),
    [seed],
  );
  return (
    <group position={position}>
      <mesh position={[0, 1.2, 0]} rotation={[0, 0, 0.08]}>
        <cylinderGeometry args={[0.09, 0.16, 2.6, 8]} />
        <meshStandardMaterial color="#2c2620" roughness={1} />
      </mesh>
      {blobs.map(({p, r}, i) => (
        <mesh key={i} position={[...p]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color="#2c3129" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
};
