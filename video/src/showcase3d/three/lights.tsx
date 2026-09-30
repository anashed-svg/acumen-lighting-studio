import {useMemo} from 'react';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Object3D,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

type Vec3 = [number, number, number];

// Fake volumetric beam: open cylinder, additive, soft at the silhouette and fading along its length.
const beamMaterial = (color: string) =>
  new ShaderMaterial({
    uniforms: {uColor: {value: new Color(color)}, uIntensity: {value: 0}},
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vAlong = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float edge = pow(abs(dot(normalize(vNormal), normalize(vView))), 2.0);
        float fall = pow(1.0 - vAlong, 1.7);
        gl_FragColor = vec4(uColor * uIntensity * edge * fall, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });

// Soft radial sprite used as a cheap stand-in for bloom around fixtures.
let glowTexture: CanvasTexture | null = null;
const getGlowTexture = () => {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new CanvasTexture(c);
  return glowTexture;
};

export const Glow: React.FC<{position: Vec3; color: string; size: number; intensity: number; scaleY?: number}> = ({
  position,
  color,
  size,
  intensity,
  scaleY = 1,
}) => (
  <sprite position={position} scale={[size, size * scaleY, 1]}>
    <spriteMaterial
      map={getGlowTexture()}
      color={color}
      opacity={intensity}
      blending={AdditiveBlending}
      depthWrite={false}
      transparent
    />
  </sprite>
);

// Spot/uplight: real SpotLight for the surface it hits, plus a visible beam cone and a glowing lens.
export const BeamLight: React.FC<{
  from: Vec3;
  to: Vec3;
  color: string;
  on: number;
  power?: number;
  angle?: number;
  beam?: number;
}> = ({from, to, color, on, power = 60, angle = 0.32, beam = 0.22}) => {
  const target = useMemo(() => new Object3D(), []);
  target.position.set(...to);
  target.updateMatrixWorld();

  const {geometry, quaternion, material} = useMemo(() => {
    const dir = new Vector3(...to).sub(new Vector3(...from));
    const length = dir.length() * 1.05;
    const geo = new CylinderGeometry(Math.tan(angle * 0.7) * length, 0.03, length, 40, 1, true);
    geo.translate(0, length / 2, 0); // narrow end sits on the fixture
    return {
      geometry: geo,
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()),
      material: beamMaterial(color),
    };
  }, [[...from, ...to, angle, color].join()]);
  material.uniforms.uIntensity.value = beam * on;

  return (
    <group>
      <primitive object={target} />
      <spotLight
        position={from}
        target={target}
        color={color}
        intensity={power * on}
        angle={angle}
        penumbra={0.55}
        decay={2}
        distance={0}
      />
      <mesh position={from} quaternion={quaternion} geometry={geometry} material={material} />
      <mesh position={from} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.05, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} opacity={0.15 + 0.85 * on} transparent />
      </mesh>
      <Glow position={[from[0], from[1] + 0.05, from[2] + 0.05]} color={color} size={0.7} intensity={0.9 * on} />
    </group>
  );
};

// Linear LED under a slab edge: emissive strip + downward RectAreaLight + a horizontal halo.
export const LedStrip: React.FC<{center: Vec3; length: number; color: string; on: number; power?: number}> = ({
  center,
  length,
  color,
  on,
  power = 9,
}) => (
  <group position={center}>
    <mesh>
      <boxGeometry args={[length, 0.025, 0.05]} />
      <meshBasicMaterial color={new Color(color).multiplyScalar(0.25 + 2.2 * on)} toneMapped={false} />
    </mesh>
    <rectAreaLight
      width={length}
      height={0.25}
      color={color}
      intensity={power * on}
      position={[0, -0.03, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    />
    <Glow position={[0, -0.02, 0.1]} color={color} size={length * 1.08} scaleY={0.05} intensity={0.8 * on} />
  </group>
);
