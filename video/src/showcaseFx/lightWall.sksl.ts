// SkSL for a night-lit stone wall: grazers at the base rake across the cladding, a wall-wash
// sweeps from left to right, and a spotlight throws volumetric beams through the haze.
// Coordinates are in "wall units": y runs 0 (floor) -> 1 (top of frame), x runs 0 -> aspect.
export const lightWallSksl = /* glsl */ `
uniform float2 resolution;
uniform float time;       // seconds: drifts the haze and the grain
uniform float wash;       // centre of the wall-wash band, 0..1 across the frame
uniform float grazers;    // 0..1: the grazer row switches on left to right
uniform float beams;      // 0..1: spotlight + god-ray intensity
uniform float3 lightColor;
uniform float3 wallColor;

const int GRAZERS = 5;            // in-ground fixtures along the base

float hash(float2 p) {
  p = fract(p * float2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x),
             mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.07 + float2(13.1, 7.7);
    a *= 0.5;
  }
  return v;
}

// Running-bond stone cladding: x = panel id hash, y = distance to the nearest joint.
float2 panel(float2 p) {
  float2 size = float2(0.74, 0.25);  // panel width x height in wall units
  float row = floor(p.y / size.y);
  float2 q = float2(p.x / size.x + 0.5 * mod(row, 2.0), p.y / size.y);
  float2 edge = (0.5 - abs(fract(q) - 0.5)) * size;
  return float2(hash(floor(q)), min(edge.x, edge.y));
}

float height(float2 p) {
  float joint = smoothstep(0.0, 0.007, panel(p).y);
  float veins = fbm(p * float2(9.0, 46.0));   // travertine: horizontal bedding
  float pores = fbm(p * 70.0);
  return joint * (0.45 + 0.35 * veins + 0.2 * pores);
}

half4 main(float2 fragCoord) {
  float aspect = resolution.x / resolution.y;
  float2 p = float2(fragCoord.x, resolution.y - fragCoord.y) / resolution.y;

  float px = 1.5 / resolution.y;
  float h = height(p);
  float bump = 0.035;  // relief depth: higher = rougher stone under grazing light
  float3 n = normalize(float3((h - height(p + float2(px, 0.0))) / px * bump,
                              (h - height(p + float2(0.0, px))) / px * bump, 1.0));
  float3 P = float3(p, 0.0);

  float2 stone = panel(p);
  float3 albedo = pow(wallColor, float3(2.2)) * (0.75 + 0.4 * fbm(p * float2(3.0, 16.0))) * (0.85 + 0.3 * stone.x);
  albedo *= mix(0.25, 1.0, smoothstep(0.0, 0.01, stone.y));
  float3 warm = pow(lightColor, float3(2.2));

  // Grazers: in-ground fixtures hugging the wall, so light arrives almost parallel to it
  // and every chisel mark and joint throws a shadow.
  float graze = 0.0;
  float glare = 0.0;
  for (int i = 0; i < GRAZERS; i++) {
    float fi = float(i);
    float x = (fi + 0.5) / float(GRAZERS) * aspect;
    float start = fi / float(GRAZERS) * 0.7;
    float on = smoothstep(start, start + 0.3, grazers);
    float3 L = float3(x, -0.02, 0.08) - P;
    float dist = length(L);
    L /= dist;
    float dx = p.x - x;
    float spread = 0.02 + 0.11 * p.y;
    float cone = exp(-dx * dx / (spread * spread));
    graze += on * cone * max(dot(n, L), 0.0) * exp(-3.2 * p.y) / (0.1 + p.y);
    glare += on * exp(-(dx * dx * 4.0 + p.y * p.y) / 0.0006);
  }

  // Wall-wash: a soft band from fixtures further off the wall, gliding across.
  float bx = (p.x - (wash * 1.5 - 0.25) * aspect) / (0.2 * aspect);
  float3 Lw = normalize(float3(0.0, 1.25 - p.y, 0.7));
  float washed = exp(-bx * bx) * max(dot(n, Lw), 0.0) * p.y * p.y;

  // Spotlight: a hot source top-right, its beam aimed 0.62 rad left of straight down.
  float2 d = p - float2(aspect * 0.82, 1.06);
  float r = length(d);
  float ang = atan(d.x, -d.y);
  float ba = (ang + 0.62) / 0.28;
  float shafts = fbm(float2(ang * 16.0, time * 0.35));
  float haze = 0.55 + 0.45 * fbm(p * 3.0 + float2(time * 0.05, 0.0));
  float rays = beams * exp(-ba * ba) * shafts * shafts * haze * exp(-r * 1.3) * 0.5;
  rays += beams * exp(-r * r * 80.0) * 0.35;

  float3 col = albedo * (0.004 + warm * graze * 1.8 + mix(warm, float3(1.0), 0.5) * washed * 0.12);
  col += warm * (rays + glare * 0.6);

  col *= 2.2;  // exposure, then an ACES-style curve whose toe keeps the shadows black
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(col, float3(1.0 / 2.2));
  float2 v = fragCoord / resolution - 0.5;
  col *= 1.0 - dot(v, v) * 1.1;
  col += (hash(fragCoord + fract(time) * 97.0) - 0.5) * 0.025;
  return half4(half3(clamp(col, 0.0, 1.0)), 1.0);
}
`;
