import {PerspectiveCamera} from '@react-three/drei';
import {ThreeCanvas} from '@remotion/three';
import {zColor} from '@remotion/zod-types';
import {AbsoluteFill, interpolate, interpolateColors, useCurrentFrame, useVideoConfig} from 'remotion';
import {useMemo} from 'react';
import {CanvasTexture, Matrix4, Quaternion, SRGBColorSpace, Vector3} from 'three';
import {z} from 'zod';
import {acumen, brandSchema, easeInOut, Lockup, ramp, useSeconds} from './brand';
import {BeamLight, Glow, LedStrip} from './three/lights';
import {Tree, Villa} from './three/villa';

export const threeLightSceneSchema = brandSchema.extend({
  stone: zColor(),
  render: zColor(),
  lightPower: z.number().min(0).max(3),
});
type Props = z.infer<typeof threeLightSceneSchema>;

export const threeLightSceneDefaults: Props = {
  ...acumen,
  stone: '#b3a590',
  render: '#d9d4cc',
  lightPower: 1,
};

type Vec3 = [number, number, number];

// Night sky as a screen-space gradient behind everything (the canvas stays opaque).
const skyTexture = (top: string, bottom: string) => {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, bottom);
  v.addColorStop(0.55, top);
  v.addColorStop(1, bottom);
  g.fillStyle = v;
  g.fillRect(0, 0, 4, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
};
const lerp3 = (a: Vec3, b: Vec3, t: number) => a.map((v, i) => v + (b[i] - v) * t) as Vec3;

// Dolly driven purely by the frame number, so any frame renders identically in any order.
const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const t = easeInOut(frame / (durationInFrames - 1));
  const eye = new Vector3(...lerp3([-11, 1.4, 25], [-5.8, 2, 18.5], t));
  const look = new Vector3(...lerp3([-1, 2.6, 0], [-0.2, 2.7, 0], t));
  const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(eye, look, new Vector3(0, 1, 0)));
  return <PerspectiveCamera makeDefault fov={34} near={0.1} far={150} position={eye} quaternion={quaternion} />;
};

export const ThreeLightScene: React.FC<Props> = (props) => {
  const {width, height} = useVideoConfig();
  const {accent, lightPower: k} = props;
  const frame = useCurrentFrame();
  const t = useSeconds();
  const strip = ramp(t, 1.0, 1.9);
  const flicker = 1 + 0.015 * Math.sin(frame * 1.7);
  const warm = interpolateColors(0.35, [0, 1], ['#ffffff', accent]);
  const sky = useMemo(() => skyTexture('#121724', props.background), [props.background]);

  return (
    <AbsoluteFill style={{backgroundColor: props.background}}>
      <ThreeCanvas width={width} height={height} gl={{antialias: true}}>
        <primitive attach="background" object={sky} />
        <CameraRig />
        <fog attach="fog" args={['#050608', 24, 70]} />
        <hemisphereLight args={['#3a4868', '#050505', 0.55]} />
        <Villa stone={props.stone} render={props.render} accent={accent} interior={ramp(t, 0.2, 2.2)} />

        {/* uplights grazing the stone fin */}
        {[3.05, 4.25, 5.45].map((x, i) => (
          <BeamLight
            key={x}
            from={[x, 0.08, 1.78]}
            to={[x, 6.9, 2.1]}
            color={warm}
            on={ramp(t, 0.35 + i * 0.22, 1.25 + i * 0.22) * flicker}
            power={70 * k}
            angle={0.28}
            beam={0.45}
          />
        ))}
        {/* soffit downlights */}
        {[-5.6, -2.2, 1.2].map((x) => (
          <BeamLight
            key={x}
            from={[x, 3.22, 2.0]}
            to={[x, 0.24, 1.6]}
            color={warm}
            on={strip}
            power={22 * k}
            angle={0.42}
            beam={0.06}
          />
        ))}
        {/* linear LED under the cantilever + grazer washing the upper facade */}
        <LedStrip center={[-2.15, 3.235, 2.5]} length={9.8} color={accent} on={strip} power={10 * k} />
        <rectAreaLight
          width={9.9}
          height={0.2}
          color={warm}
          intensity={3.5 * k * ramp(t, 1.5, 2.5)}
          position={[-2.15, 6.15, 2.8]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        {/* specimen tree with an uplight into the canopy */}
        <Tree position={[-8.7, 0, 4.8]} />
        <BeamLight
          from={[-8.1, 0.05, 5.6]}
          to={[-8.7, 3.4, 4.8]}
          color={warm}
          on={ramp(t, 0.6, 1.5)}
          power={30 * k}
          angle={0.5}
          beam={0.25}
        />
        {/* path markers */}
        {[-7.6, -5.6, -3.6, -1.6, 0.4].map((x, i) => (
          <Glow
            key={x}
            position={[x, 0.18, 4.3]}
            color={accent}
            size={0.45}
            intensity={0.9 * ramp(t, 0.9 + i * 0.08, 1.6 + i * 0.08)}
          />
        ))}
      </ThreeCanvas>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(0,0,0,0) 58%, rgba(0,0,0,0.8) 100%)'}} />
      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.06}}>
        <Lockup brand={props} t={ramp(t, 2.3, 3.6, (x) => x)} logoSize={88} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{backgroundColor: '#000', opacity: interpolate(frame, [0, 10], [1, 0], {extrapolateRight: 'clamp'})}}
      />
    </AbsoluteFill>
  );
};
