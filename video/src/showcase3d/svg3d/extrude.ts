import {getSubpaths, parsePath, reduceInstructions, serializeInstructions, type ReducedInstruction} from '@remotion/paths';
import {extrudeElement, threeDIntoSvgPath, type MatrixTransform4D, type ThreeDReducedInstruction} from '@remotion/svg-3d-engine';

type P4 = [number, number, number, number];
export type Solid = {cap: ThreeDReducedInstruction[]; sides: ThreeDReducedInstruction[][]};
export type ProjectedFace = {d: string; z: number; shade: number; cap: boolean};

// Every <path> of an SVG, flattened into the viewBox space and centred on the origin.
export const loadSvgPaths = async (url: string) => {
  const doc = new DOMParser().parseFromString(await fetch(url).then((r) => r.text()), 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  const [vx, vy, vw, vh] = (svg.getAttribute('viewBox') ?? '0 0 100 100').split(/[\s,]+/).map(Number);
  return [...svg.querySelectorAll('path')].map((path) => {
    let m = new DOMMatrix().translate(-(vx + vw / 2), -(vy + vh / 2));
    const chain: DOMMatrix[] = [];
    for (let el: Element | null = path; el && el !== svg; el = el.parentElement) {
      const t = (el as SVGGraphicsElement).transform?.baseVal.consolidate();
      if (t) chain.unshift(DOMMatrix.fromMatrix(t.matrix));
    }
    chain.forEach((c) => (m = m.multiply(c)));
    const xy = (x: number, y: number) => {
      const p = m.transformPoint({x, y});
      return [p.x, p.y] as const;
    };
    const flat = reduceInstructions(parsePath(path.getAttribute('d') ?? '')).map((i): ReducedInstruction => {
      if (i.type === 'Z') return i;
      if (i.type === 'C') {
        const [cp1x, cp1y] = xy(i.cp1x, i.cp1y);
        const [cp2x, cp2y] = xy(i.cp2x, i.cp2y);
        const [x, y] = xy(i.x, i.y);
        return {type: 'C', cp1x, cp1y, cp2x, cp2y, x, y};
      }
      const [x, y] = xy(i.x, i.y);
      return {type: i.type, x, y};
    });
    return serializeInstructions(flat);
  });
};

const to3D = (d: string, z: number): ThreeDReducedInstruction[] => {
  let start: P4 = [0, 0, z, 1];
  return reduceInstructions(parsePath(d)).map((i) => {
    if (i.type === 'M') return {type: 'M', point: (start = [i.x, i.y, z, 1])};
    if (i.type === 'L') return {type: 'L', point: [i.x, i.y, z, 1]};
    if (i.type === 'C') return {type: 'C', cp1: [i.cp1x, i.cp1y, z, 1], cp2: [i.cp2x, i.cp2y, z, 1], point: [i.x, i.y, z, 1]};
    return {type: 'Z', point: start};
  });
};

// Front cap (keeps holes, since it is one path) + side walls per subpath, via @remotion/svg-3d-engine.
export const extrude = (paths: string[], depth: number): Solid[] =>
  paths.map((d) => ({
    cap: to3D(d, -depth / 2),
    sides: getSubpaths(d).flatMap((sub) =>
      extrudeElement({points: parsePath(sub), depth, pressInDepth: 0, sideColor: '', crispEdges: false}).map((f) => f.points),
    ),
  }));

const mul = (m: MatrixTransform4D, p: P4): P4 =>
  [0, 1, 2, 3].map((r) => m[r * 4] * p[0] + m[r * 4 + 1] * p[1] + m[r * 4 + 2] * p[2] + m[r * 4 + 3] * p[3]) as P4;

const mapPoints = (i: ThreeDReducedInstruction, f: (p: P4) => P4): ThreeDReducedInstruction =>
  i.type === 'C'
    ? {...i, cp1: f(i.cp1), cp2: f(i.cp2), point: f(i.point)}
    : i.type === 'Q'
      ? {...i, cp: f(i.cp), point: f(i.point)}
      : {...i, point: f(i.point)};

const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: number[]) => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
};

// Rotate, perspective-project (camera at z = -focal looking down +z), cull back faces, shade, depth-sort.
export const project = (solids: Solid[], matrix: MatrixTransform4D, focal: number, light: number[]): ProjectedFace[] => {
  const L = norm(light);
  const toScreen = (p: P4): P4 => {
    const s = focal / (focal + p[2]);
    return [p[0] * s, p[1] * s, p[2], 1];
  };
  const faces: ProjectedFace[] = [];
  const add = (points: ThreeDReducedInstruction[], cap: boolean) => {
    const world = points.map((i) => mapPoints(i, (p) => mul(matrix, p)));
    const screen = world.map((i) => mapPoints(i, toScreen));
    const v = world.map((i) => i.point);
    const sv = screen.map((i) => i.point);
    let area = 0;
    for (let k = 0; k < sv.length; k++) {
      const [a, b] = [sv[k], sv[(k + 1) % sv.length]];
      area += a[0] * b[1] - b[0] * a[1];
    }
    if (!cap && area <= 0) return;
    let n = cap
      ? norm(mul(matrix, [0, 0, -1, 0]).slice(0, 3))
      : norm(
          cross(
            [0, 1, 2].map((k) => v[1][k] - v[0][k]),
            [0, 1, 2].map((k) => v[2][k] - v[0][k]),
          ),
        );
    if (n[2] > 0) n = n.map((x) => -x);
    faces.push({
      d: threeDIntoSvgPath(screen),
      z: v.reduce((s, p) => s + p[2], 0) / v.length,
      shade: Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]),
      cap,
    });
  };
  for (const solid of solids) {
    solid.sides.forEach((s) => add(s, false));
    add(solid.cap, true);
  }
  // Far walls first, caps always on top (they face the camera for the rotations used here).
  return faces.sort((a, b) => (a.cap === b.cap ? b.z - a.z : a.cap ? 1 : -1));
};
