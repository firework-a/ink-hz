// BMFont engine — faithful port of the original gamemcu-hz engine.
// Extracted from the site's bundled JS:
//   - class Ol  -> layoutText()      (glyph layout: width/height/baseline/glyphs)
//   - class tt  -> BMFONT.build()    (glyph quad geometry in font units)
//   - class g   -> MSDF material     (median/signedDistance MSDF shader)
//   - class zl  -> bmfontTextURL()   (offscreen renderer -> data URL)
import * as THREE from "three";
import fntJson from "./font/xingcao-font.json";

export type BmChar = {
  id: number;
  char: string;
  width: number;
  height: number;
  xoffset: number;
  yoffset: number;
  xadvance: number;
  x: number;
  y: number;
  page: number;
};

export type BmFontData = {
  pages: string[];
  chars: BmChar[];
  info: { face: string; size: number };
  common: { lineHeight: number; base: number; scaleW: number; scaleH: number };
};

export type BmSetting = {
  flipY?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  width?: number;
  align?: "left" | "center" | "right";
  anchor?: [number, number];
  tabSize?: number;
  mode?: string;
};

export type BmGlyph = { position: [number, number]; data: BmChar; line: number; index: number };

export type BmLayout = {
  width: number;
  height: number;
  baseline: number;
  lineHeight: number;
  glyphs: BmGlyph[];
};

export type BmGeometry = { position: Float32Array; uv: Float32Array; indice: Uint16Array };

export type BmFont = BmFontData & {
  map: Map<string, BmChar>;
  build(layout: BmLayout, setting?: BmSetting): BmGeometry;
};

export const FONT_ATLAS = "/assets/font/xingcao.png";

const raw = fntJson as unknown as BmFontData;

const charMap = new Map<string, BmChar>();
for (const c of raw.chars) charMap.set(c.char, c);

const SPACE = " ";

function glyphFor(font: BmFont, ch: string): BmChar | undefined {
  const g = font.map.get(ch);
  if (g) return g;
  if (ch === SPACE) return font.map.get(SPACE);
  return undefined;
}

/** class Ol.update — glyph layout in font units (three-bmfont-text compatible). */
export function layoutText(font: BmFont, text: string, setting: BmSetting = {}): BmLayout {
  const st = Object.assign(
    { tabSize: 4, width: 0, letterSpacing: 0, mode: "nowrap", align: "left" as "left" | "center" | "right" },
    setting,
  );
  const lineHeight = st.lineHeight ?? font.common.lineHeight;
  const base = font.common.base;
  const descender = lineHeight - base;
  const letterSpacing = st.letterSpacing || 0;
  const maxWidth = st.width || 0;

  const lines = text.length ? text.split("\n") : [""];

  const lineWidths = lines.map((line) => {
    let advance = 0;
    let last: BmChar | null = null;
    for (const ch of line) {
      const g = glyphFor(font, ch);
      if (!g) continue;
      advance += g.xadvance + letterSpacing;
      last = g;
    }
    if (last) advance = advance - last.xadvance - letterSpacing + last.width + last.xoffset;
    return advance;
  });

  const width = lineWidths.reduce((m, w) => Math.max(m, w, maxWidth), 0);
  const height = lineHeight * lines.length - descender;
  const anchor = st.anchor ?? [0.5, 0.5];
  const origin: [number, number] = [-width * anchor[0], 2 * lineHeight * anchor[1] - base];

  const glyphs: BmGlyph[] = [];
  let cursorY = -height;
  lines.forEach((line, lineIndex) => {
    let cursorX = 0;
    const alignOffset =
      st.align === "center" ? (width - lineWidths[lineIndex]) / 2 : st.align === "right" ? width - lineWidths[lineIndex] : 0;
    for (let i = 0; i < line.length; i++) {
      const g = glyphFor(font, line[i]);
      if (!g) continue;
      glyphs.push({ position: [cursorX + alignOffset + origin[0], cursorY + origin[1]], data: g, line: lineIndex, index: i });
      cursorX += g.xadvance + letterSpacing;
    }
    cursorY += lineHeight;
  });

  return { width, height, baseline: base, lineHeight, glyphs };
}

/** class tt.build — one quad per visible glyph, coordinates in font units. */
function buildFontGeometry(font: BmFont, layout: BmLayout, setting: BmSetting = {}): BmGeometry {
  const flipY = setting.flipY !== false;
  const scaleW = font.common.scaleW;
  const scaleH = font.common.scaleH;
  const glyphs = layout.glyphs.filter((g) => g.data.width * g.data.height > 0);
  const position = new Float32Array(glyphs.length * 12);
  const uv = new Float32Array(glyphs.length * 8);
  const indice = new Uint16Array(glyphs.length * 6);

  for (let gi = 0, pi = 0, ui = 0, ii = 0, i = 0; gi < glyphs.length; gi++, i += 4) {
    const g = glyphs[gi];
    const d = g.data;
    const x = g.position[0] + d.xoffset;
    const y = g.position[1] + d.yoffset;
    const w = d.width;
    const h = d.height;

    // positions emitted as vec3 (z = 0) so three's bounding computations stay valid
    position[pi++] = x;
    position[pi++] = y;
    position[pi++] = 0;
    position[pi++] = x + w;
    position[pi++] = y;
    position[pi++] = 0;
    position[pi++] = x + w;
    position[pi++] = y + h;
    position[pi++] = 0;
    position[pi++] = x;
    position[pi++] = y + h;
    position[pi++] = 0;

    const u0 = d.x / scaleW;
    const u1 = (d.x + w) / scaleW;
    let v0 = d.y / scaleH;
    let v1 = (d.y + h) / scaleH;
    if (flipY) {
      v0 = 1 - v0;
      v1 = 1 - v1;
    }

    uv[ui++] = u0;
    uv[ui++] = v0;
    uv[ui++] = u1;
    uv[ui++] = v0;
    uv[ui++] = u1;
    uv[ui++] = v1;
    uv[ui++] = u0;
    uv[ui++] = v1;

    indice[ii++] = i;
    indice[ii++] = i + 1;
    indice[ii++] = i + 2;
    indice[ii++] = i;
    indice[ii++] = i + 2;
    indice[ii++] = i + 3;
  }

  return { position, uv, indice };
}

export const BMFONT: BmFont = Object.assign({}, raw, {
  map: charMap,
  build: (layout: BmLayout, setting: BmSetting = {}) => buildFontGeometry(BMFONT, layout, setting),
});

/** Build a THREE.BufferGeometry for `text` (multi-line via \n) in font units. */
export function buildBmFontGeometry(
  font: BmFont,
  text: string,
  setting: BmSetting = {},
): { geometry: THREE.BufferGeometry; layout: BmLayout } {
  const layout = layoutText(font, text, setting);
  const { position, uv, indice } = font.build(layout, setting);
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(new THREE.BufferAttribute(indice, 1));
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return { geometry, layout };
}

/** fw() from the original: vertical text = one character per line. */
export function vertical(text: string): string {
  return text.split("").join("\n");
}

// ---------------- MSDF material (original class g) ----------------

const FONT_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FONT_FRAGMENT = /* glsl */ `
uniform sampler2D texFont;
varying vec2 vUv;
uniform vec4  diffuse;
uniform vec4  stroke;
uniform vec4  shadow;
uniform vec2  shadowOffset;
uniform float weight;

float median(in float r, in float g, in float b) {
    return max(min(r, g), min(max(r, g), b));
}

float signedDistance(in vec2 uv) {
    vec4 texel = texture2D(texFont, uv);
    return median(texel.r, texel.g, texel.b) - 0.5;
}

void main() {
    vec4 color = vec4(diffuse);
    float d = signedDistance(vUv) + weight;
    float w = fwidth(d);
    if (stroke.a > 0.0) {
        vec4 strokeColor = vec4(stroke.rgb, smoothstep(-w, w, d));
        color.a *= smoothstep(-w, w, d - stroke.a);
        color = mix(strokeColor, color, color.a);
    }
    else {
        color.a *= smoothstep(-w, w, d);
    }
    if (shadow.a > 0.0) {
        float dd = signedDistance(vUv + shadowOffset);
        vec4 shadowColor = vec4(shadow.rgb, smoothstep(-w - shadow.a, w + shadow.a, dd));
        color = mix(shadowColor, color, color.a);
    }
    gl_FragColor = color;
}`;

export function makeFontMaterial(texture: THREE.Texture, weight = 0.3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FONT_VERTEX,
    fragmentShader: FONT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: {
      texFont: { value: texture },
      diffuse: { value: new THREE.Vector4(1, 1, 1, 1) },
      stroke: { value: new THREE.Vector4(0, 0, 0, 0) },
      shadow: { value: new THREE.Vector4(0, 0, 0, 0) },
      shadowOffset: { value: new THREE.Vector2(-0.001, 0.001) },
      weight: { value: weight },
    },
  });
}
