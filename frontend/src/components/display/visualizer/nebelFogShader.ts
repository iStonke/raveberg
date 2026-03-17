import * as THREE from 'three'

export const MAX_NEBEL_CLUSTERS = 8

export const NEBEL_FOG_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const NEBEL_FOG_FRAGMENT_SHADER = `
precision highp float;

#define MAX_NEBEL_CLUSTERS 8

uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uSpeed;
uniform float uBrightness;
uniform float uPulse;
uniform float uDebugContrast;
uniform vec3 uColorBlack;
uniform vec3 uColorLow;
uniform vec3 uColorMid;
uniform vec3 uColorHigh;
uniform vec4 uClusters[MAX_NEBEL_CLUSTERS];
uniform vec4 uClusterMotion[MAX_NEBEL_CLUSTERS];
uniform float uClusterCount;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
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
  float amplitude = 0.52;
  mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);

  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = rotation * p * 2.03 + 17.1;
    amplitude *= 0.56;
  }

  return value;
}

float remap01(float value, float low, float high) {
  return clamp((value - low) / max(0.0001, high - low), 0.0, 1.0);
}

vec3 alphaOver(vec3 base, vec3 layer, float alpha) {
  return mix(base, layer, clamp(alpha, 0.0, 1.0));
}

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 centered = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
  float t = uTime * (0.34 + uSpeed * 0.9);
  float slowT = uTime * 0.022;

  vec2 warpA = vec2(
    fbm(centered * 0.82 + vec2(t * 0.24, -t * 0.08)),
    fbm(centered * 1.08 + vec2(-t * 0.18, t * 0.11))
  ) - 0.5;
  vec2 warpB = vec2(
    fbm(centered * 1.46 + warpA * 0.78 + vec2(t * 0.34, -t * 0.12)),
    fbm(centered * 1.82 + warpA * 0.64 + vec2(-t * 0.28, t * 0.16))
  ) - 0.5;
  vec2 warpC = vec2(
    fbm(centered * 2.18 + warpB * 0.92 + vec2(t * 0.44, t * 0.18)),
    fbm(centered * 2.64 + warpB * 0.72 + vec2(-t * 0.38, t * 0.24))
  ) - 0.5;

  float bgBreath = 1.0 + sin(t * 0.18) * 0.1 + cos(t * 0.08 + 0.9) * 0.05;
  float midBreath = 1.0 + cos(t * 0.28 + 0.6) * 0.15 + sin(t * 0.13 + 1.2) * 0.07;
  float frontBreath = 1.0 + sin(t * 0.4 + 1.8) * 0.2 + cos(t * 0.19 + 0.5) * 0.09;

  vec2 bgUv = rotate2d(sin(t * 0.08) * 0.1) * (centered * bgBreath + warpA * 0.48) + vec2(t * 0.18, -t * 0.04);
  vec2 midUv = rotate2d(cos(t * 0.12 + 0.4) * 0.18) * (centered * midBreath + warpB * 0.72) + vec2(-t * 0.22, t * 0.07);
  vec2 frontUv = rotate2d(sin(t * 0.18 + 0.8) * 0.24) * (centered * frontBreath + warpC * 0.88) + vec2(t * 0.28, -t * 0.05);

  float backMass = fbm(bgUv * 0.92 + warpA * 0.54);
  float midMass = fbm(midUv * 1.34 + warpB * 0.68);
  float frontMass = fbm(frontUv * 1.94 + warpC * 0.82);
  float backDetail = fbm(bgUv * 2.8 + warpB * 0.32);
  float midDetail = fbm(midUv * 4.0 + warpC * 0.42);
  float frontDetail = fbm(frontUv * 6.4 + warpC * 0.52);

  float upperTexture = remap01(backDetail + midDetail * 0.22, 0.28, 0.84) * smoothstep(0.0, 0.7, vUv.y);
  float lowerWeight = smoothstep(0.08, 0.96, 1.0 - vUv.y);
  float bgBase = remap01(backMass + backDetail * 0.16 - 0.16 + upperTexture * 0.14, 0.22, 0.9);
  float midBase = remap01(midMass + backMass * 0.2 + midDetail * 0.22 - 0.18, 0.24, 0.92);
  float frontBase = remap01(frontMass * 0.82 + midMass * 0.26 + frontDetail * 0.18 - 0.22, 0.26, 0.96);
  float frontSoft = remap01(frontMass * 0.66 + fbm(frontUv * 1.18 + warpC * 0.24) * 0.34 - 0.2, 0.18, 0.92);

  float layerA = pow(bgBase, 1.28) * (0.4 + uIntensity * 0.18) * mix(0.9, 1.14, upperTexture);
  float layerB = pow(midBase, 1.02) * (0.62 + uIntensity * 0.34);
  float layerC = pow(mix(frontBase, frontSoft, 0.44), 0.84) * (0.42 + uBrightness * 0.34);

  float clusters = 0.0;
  float foregroundClusters = 0.0;
  float lightIslands = 0.0;

  for (int i = 0; i < MAX_NEBEL_CLUSTERS; i++) {
    if (float(i) >= uClusterCount) {
      break;
    }

    vec4 cluster = uClusters[i];
    vec4 motion = uClusterMotion[i];

    vec2 center = vec2((cluster.x - 0.5) * aspect, cluster.y - 0.5);
    center += vec2(
      sin(t * (0.12 + motion.x * 0.16) + motion.z) * (0.12 + cluster.z * 0.22),
      cos(t * (0.08 + motion.y * 0.11) + motion.z * 1.27) * (0.03 + cluster.w * 0.07)
    );

    float breath = 1.0
      + sin(t * (0.11 + motion.x * 0.1) + motion.z) * 0.22
      + cos(t * (0.07 + motion.y * 0.08) + motion.z * 0.72) * 0.08;

    vec2 delta = centered - center;
    vec2 q = delta / max(vec2(0.001), cluster.zw * breath);

    float distortion = (fbm(q * 2.9 + warpA * 1.34 + motion.z) - 0.5) * 0.34;
    distortion += (fbm(q * 5.8 + warpB * 1.62 + motion.z * 1.7) - 0.5) * 0.16;
    float shape = length(q * vec2(1.0 + distortion * 0.26, 1.0 - distortion * 0.22));
    shape += distortion;

    float field = pow(smoothstep(1.26, 0.18, shape), 0.9) * (0.82 + motion.w * 0.64);
    float lightField = pow(smoothstep(0.92, 0.08, shape + distortion * 0.18), 1.18) * (0.24 + motion.w * 0.22);
    clusters += field;
    foregroundClusters += field * smoothstep(0.22, 0.42, cluster.z);
    lightIslands += lightField;
  }

  float density = layerA * 0.38 + layerB * 0.92 + layerC * 0.76 + clusters * 0.8 + foregroundClusters * 0.26 + lowerWeight * 0.12;

  float colorNoiseA = fbm(centered * 0.64 + vec2(slowT * 0.14, -slowT * 0.04) + warpA * 0.14);
  float colorNoiseB = fbm(centered * 1.12 + vec2(-slowT * 0.05, slowT * 0.11) + warpB * 0.1);
  float purplePhase = clamp(
    0.5
      + sin(slowT + colorNoiseA * 2.8 + colorNoiseB * 1.7) * 0.24
      + (colorNoiseA - 0.5) * 0.18
      + (colorNoiseB - 0.5) * 0.1,
    0.0,
    1.0
  );

  vec3 violetA = mix(uColorLow, uColorMid, clamp(purplePhase * 0.88 + colorNoiseA * 0.12, 0.0, 1.0));
  vec3 violetB = mix(uColorMid, uColorHigh, clamp(colorNoiseB * 0.72 + frontDetail * 0.16, 0.0, 1.0));
  vec3 violetC = mix(violetB, vec3(uColorHigh.r, uColorMid.g, uColorHigh.b), clamp(frontDetail * 0.24 + colorNoiseA * 0.14, 0.0, 1.0));

  float bgAlpha = clamp(layerA * (1.0 + uBrightness * 0.1), 0.0, 0.5);
  float midAlpha = clamp((layerB + clusters * 0.22) * (1.06 + uBrightness * 0.2), 0.0, 0.78);
  float frontAlpha = clamp((layerC + foregroundClusters * 0.16 + lightIslands * 0.12) * (1.14 + uBrightness * 0.24), 0.0, 0.72);

  vec3 bgColor = mix(uColorBlack, violetA, 0.62 + upperTexture * 0.12);
  vec3 midColor = mix(violetA, violetB, 0.52 + colorNoiseB * 0.18);
  vec3 frontColor = mix(violetB, violetC, 0.48 + lightIslands * 0.12);

  bgColor *= 0.82 + upperTexture * 0.14;
  midColor *= 1.02 + clusters * 0.1;
  frontColor *= 1.16 + lightIslands * 0.12;

  vec3 color = uColorBlack;
  color = alphaOver(color, bgColor, bgAlpha);
  color = alphaOver(color, midColor, midAlpha);
  color = alphaOver(color, frontColor, frontAlpha);

  float pulse = uPulse * (0.14 + density * 0.18 + foregroundClusters * 0.16 + lightIslands * 0.14);
  color += uColorHigh * pulse * 0.18;
  color += frontColor * lightIslands * (0.18 + uBrightness * 0.2);

  density = clamp(density * (0.68 + uBrightness * 0.58 + uIntensity * 0.22) + lightIslands * (0.22 + uBrightness * 0.18) + pulse * 0.14, 0.0, 1.0);
  color *= density;

  float structure = clamp(layerA * 0.48 + layerB * 1.08 + layerC * 0.86 + clusters * 0.24 + frontDetail * 0.16, 0.0, 1.0);
  float contrastBoost = 1.0 + uDebugContrast * 0.85;
  color = mix(color * 0.94, color * (1.0 + structure * 0.56 + lightIslands * 0.28) * contrastBoost, 0.8);

  float edgeDarken = smoothstep(0.94, 0.18, length(vUv - 0.5));
  color *= mix(0.88, 1.0, edgeDarken);
  color *= mix(0.98, 1.0, smoothstep(0.0, 0.14, vUv.y));

  gl_FragColor = vec4(color, 1.0);
}
`

export function createNebelFogUniforms() {
  return {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uIntensity: { value: 0.65 },
    uSpeed: { value: 0.55 },
    uBrightness: { value: 0.7 },
    uPulse: { value: 0 },
    uDebugContrast: { value: 0 },
    uColorBlack: { value: new THREE.Color(0x020205) },
    uColorLow: { value: new THREE.Color(0x0d0d1a) },
    uColorMid: { value: new THREE.Color(0x2a223f) },
    uColorHigh: { value: new THREE.Color(0x5d3a82) },
    uClusterCount: { value: 0 },
    uClusters: {
      value: Array.from({ length: MAX_NEBEL_CLUSTERS }, () => new THREE.Vector4(0.5, 0.5, 0.28, 0.24)),
    },
    uClusterMotion: {
      value: Array.from({ length: MAX_NEBEL_CLUSTERS }, () => new THREE.Vector4(0.5, 0.5, 0, 1)),
    },
  }
}
