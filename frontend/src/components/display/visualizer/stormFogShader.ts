import * as THREE from 'three'

export const MAX_STORM_FOG_ISLANDS = 6

export const STORM_FOG_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const STORM_FOG_FRAGMENT_SHADER = `
precision highp float;

#define MAX_STORM_FOG_ISLANDS 6

uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uSpeed;
uniform float uBrightness;
uniform float uFlash;
uniform vec3 uLocalFlash;
uniform vec3 uColorLow;
uniform vec3 uColorMid;
uniform vec3 uColorHigh;
uniform vec4 uIslands[MAX_STORM_FOG_ISLANDS];
uniform float uIslandCount;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x) +
    (c - a) * u.y * (1.0 - u.x) +
    (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);

  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = rotation * p * 2.02 + 17.13;
    amplitude *= 0.54;
  }

  return value;
}

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = vUv;
  vec2 aspectUv = uv;
  aspectUv.x *= uResolution.x / max(uResolution.y, 1.0);

  float t = uTime * (0.04 + uSpeed * 0.085);
  float slowTime = uTime * 0.082;
  vec2 baseWarp = vec2(
    fbm(aspectUv * 1.05 + vec2(t * 0.44, -t * 0.24)),
    fbm(aspectUv * 1.18 + vec2(-t * 0.34, t * 0.36))
  ) - 0.5;

  float bgBreath = 1.0 + sin(t * 0.42) * 0.12 + cos(t * 0.26) * 0.08;
  float midBreath = 1.0 + sin(t * 0.66 + 1.2) * 0.16 + cos(t * 0.31 + 0.6) * 0.05;
  float frontBreath = 1.0 + cos(t * 0.88 + 2.1) * 0.13 + sin(t * 0.37 + 1.8) * 0.06;

  vec2 bgDrift = vec2(sin(t * 0.22) * 0.095, cos(t * 0.13) * 0.024);
  vec2 midDrift = vec2(cos(t * 0.31 + 0.8) * 0.145, sin(t * 0.21 + 1.1) * 0.03);
  vec2 frontDrift = vec2(sin(t * 0.39 + 1.7) * 0.19, cos(t * 0.27 + 0.4) * 0.042);

  vec2 bgUv = rotate2d(0.16 * sin(t * 0.19)) * ((aspectUv - 0.5) * bgBreath) + 0.5 + bgDrift;
  vec2 midUv = rotate2d(-0.24 * cos(t * 0.26)) * ((aspectUv - 0.5) * midBreath) + 0.5 + midDrift;
  vec2 frontUv = rotate2d(0.32 * sin(t * 0.3 + 1.4)) * ((aspectUv - 0.5) * frontBreath) + 0.5 + frontDrift;

  vec2 bgWarp = vec2(
    fbm(bgUv * 0.9 + baseWarp * 0.74 + vec2(t * 0.16, -t * 0.1)),
    fbm(bgUv * 1.12 + baseWarp * 0.62 + vec2(-t * 0.12, t * 0.08))
  ) - 0.5;
  vec2 midWarp = vec2(
    fbm(midUv * 1.7 + baseWarp * 1.14 + vec2(-t * 0.24, t * 0.18)),
    fbm(midUv * 2.05 + baseWarp * 1.02 + vec2(t * 0.2, -t * 0.22))
  ) - 0.5;
  vec2 frontWarp = vec2(
    fbm(frontUv * 2.8 + baseWarp * 1.42 + vec2(t * 0.32, t * 0.24)),
    fbm(frontUv * 3.1 + baseWarp * 1.28 + vec2(-t * 0.24, t * 0.28))
  ) - 0.5;

  float baseMass = fbm(bgUv * 0.92 + bgWarp * 0.76 + vec2(t * 0.1, -t * 0.06));
  float midClouds = fbm(midUv * 1.86 + midWarp * 0.96 + vec2(-t * 0.18, t * 0.12));
  float highlightClouds = fbm(frontUv * 3.15 + frontWarp * 1.16 + vec2(t * 0.24, t * 0.14));
  float densityShift = fbm(aspectUv * 0.72 + vec2(t * 0.072, -t * 0.046));
  float densityFlow = fbm(aspectUv * 1.08 + vec2(-t * 0.11, t * 0.085) + baseWarp * 0.34);

  float layerA = smoothstep(0.18, 0.86, baseMass + densityShift * 0.18 + densityFlow * 0.1 - 0.04) * (0.25 + uIntensity * 0.18);
  float layerB = smoothstep(0.32, 0.9, midClouds + baseMass * 0.24 + densityShift * 0.12 + densityFlow * 0.08 - 0.12) * (0.17 + uIntensity * 0.22);
  float layerC = smoothstep(0.52, 0.94, highlightClouds * 0.74 + midClouds * 0.38 + densityShift * 0.08 + densityFlow * 0.06) * (0.08 + uBrightness * 0.11);

  float islands = 0.0;
  for (int i = 0; i < MAX_STORM_FOG_ISLANDS; i++) {
    if (float(i) >= uIslandCount) {
      break;
    }

    vec4 island = uIslands[i];
    vec2 center = island.xy + vec2(
      sin(t * (0.36 + island.w * 0.14) + float(i) * 1.7) * 0.11,
      cos(t * (0.31 + island.z * 0.11) + float(i) * 1.3) * 0.042
    );

    vec2 delta = uv - center;
    delta.x *= uResolution.x / max(uResolution.y, 1.0);

    float islandBreath = 1.0
      + sin(t * (0.42 + island.z * 0.4) + float(i) * 1.2) * 0.2
      + cos(t * (0.28 + island.w * 0.35) + float(i) * 0.8) * 0.12;
    vec2 islandScale = vec2(
      max(0.11, island.z * islandBreath),
      max(0.11, island.w * (1.0 + sin(t * 0.21 + float(i) * 1.6) * 0.07))
    );

    float distortion = fbm(delta * (4.0 + island.z * 2.4) + baseWarp * 2.8 + vec2(t * 0.24, -t * 0.18) + float(i) * 2.13) - 0.5;
    float contour = fbm(delta * 6.8 + vec2(-t * 0.16, t * 0.2) + float(i) * 1.17) - 0.5;
    float shape = length(vec2(
      delta.x / islandScale.x,
      delta.y / islandScale.y
    ));
    shape += distortion * 0.24 + contour * 0.16;

    islands += smoothstep(1.24, 0.24, shape) * (0.16 + island.z * 0.06);
  }

  vec2 localDelta = uv - uLocalFlash.xy;
  localDelta.x *= uResolution.x / max(uResolution.y, 1.0);
  float localField = smoothstep(
    0.52,
    0.0,
    length(localDelta) + (fbm(localDelta * 6.0 + vec2(t * 0.22, -t * 0.18)) - 0.5) * 0.12
  ) * uLocalFlash.z;

  float cloudDensity = layerA + layerB * 0.94 + layerC * 0.62 + islands;
  float flashLift = uFlash * 0.24 + localField * 0.38;
  float colorPhase = fbm(aspectUv * 0.62 + vec2(slowTime * 0.12, -slowTime * 0.08) + baseWarp * 0.22);
  float colorPhaseFine = fbm(aspectUv * 1.34 + vec2(-slowTime * 0.09, slowTime * 0.11) + midWarp * 0.18);
  float colorDrift = clamp(
    0.5
      + sin(slowTime + colorPhase * 2.8 + colorPhaseFine * 1.6) * 0.26
      + (colorPhase - 0.5) * 0.18
      + (colorPhaseFine - 0.5) * 0.12,
    0.0,
    1.0
  );
  float densityTint = clamp(cloudDensity * 0.52 + islands * 0.38 + layerB * 0.22, 0.0, 1.0);

  vec3 stormBlack = vec3(0.018, 0.018, 0.034);
  vec3 stormPurple = vec3(0.205, 0.06, 0.36);
  vec3 coldFlashTint = vec3(0.36, 0.46, 0.62);

  vec3 lowBase = mix(stormBlack, uColorLow, 0.22);
  vec3 purpleLift = mix(stormBlack, stormPurple, colorDrift * densityTint * 1.36);
  vec3 flashTint = mix(vec3(0.0), coldFlashTint, clamp(uFlash * 0.42 + localField * 0.3, 0.0, 0.34));

  vec3 color = mix(lowBase, uColorMid, clamp(layerA + baseMass * 0.24, 0.0, 1.0));
  color = mix(color, uColorHigh, clamp(layerB * 0.72 + islands * 0.66 + localField * 0.44, 0.0, 1.0));
  color = mix(color, purpleLift + color * 0.52, clamp(densityTint * 1.22, 0.0, 1.0));
  color += flashTint;
  color += uColorHigh * flashLift * 0.24;

  float density = clamp(cloudDensity * (0.52 + uBrightness * 0.18) + flashLift * 0.18, 0.0, 1.0);
  color *= density;

  gl_FragColor = vec4(color, 1.0);
}
`

export function createStormFogUniforms() {
  return {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uIntensity: { value: 0.65 },
    uSpeed: { value: 0.55 },
    uBrightness: { value: 0.7 },
    uFlash: { value: 0 },
    uLocalFlash: { value: new THREE.Vector3(0.5, 0.5, 0) },
    uColorLow: { value: new THREE.Color(0x071018) },
    uColorMid: { value: new THREE.Color(0x142433) },
    uColorHigh: { value: new THREE.Color(0x5e7fa4) },
    uIslandCount: { value: 0 },
    uIslands: {
      value: Array.from({ length: MAX_STORM_FOG_ISLANDS }, () => new THREE.Vector4(0.5, 0.5, 0.2, 0.2)),
    },
  }
}
