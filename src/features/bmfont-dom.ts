// DOM text renderer — faithful port of the original class zl.textURL().
// Renders a text label through an offscreen WebGL scene with the MSDF font
// material, then exports a data URL used by <img> elements (poems, hints, intro).
import * as THREE from "three";
import { BMFONT, FONT_ATLAS, layoutText, makeFontMaterial, type BmSetting } from "./bmfont";

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let material: THREE.ShaderMaterial | null = null;
let textureReady: Promise<THREE.Texture> | null = null;

function ensureRenderer(): Promise<THREE.Texture> {
  if (textureReady) return textureReady;
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  // original: renderer.setPixelRatio(viewer.dpr); main renderer caps at 1.5
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  textureReady = new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      FONT_ATLAS,
      (t) => {
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        // original image loader applies renderer.outputEncoding (sRGB) to the font atlas
        t.colorSpace = THREE.SRGBColorSpace;
        material = makeFontMaterial(t, 0.3);
        resolve(t);
      },
      undefined,
      reject,
    );
  });
  return textureReady;
}

const cache = new Map<string, string>();

/** Render text (multi-line via \n) with the xingcao MSDF atlas → data URL. */
export async function bmfontTextURL(text: string, scale = 1, setting: BmSetting = {}): Promise<string | null> {
  const key = `${text}@${scale}`;
  const cached = cache.get(key);
  if (cached) return cached;

  await ensureRenderer();
  if (!renderer || !scene || !camera || !material) return null;

  const layout = layoutText(BMFONT, text, setting);
  if (layout.width <= 0 || layout.height <= 0) return null;

  const w = layout.width * scale;
  const h = layout.height * scale;
  const baseline = layout.baseline * scale;

  camera.left = -w / 2;
  camera.right = w / 2;
  if (layout.height > layout.baseline) {
    camera.top = h - baseline / 2;
    camera.bottom = -baseline / 2;
  } else {
    camera.top = h / 2;
    camera.bottom = -h / 2;
  }
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);

  const { position, uv, indice } = BMFONT.build(layout, setting);
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(new THREE.BufferAttribute(indice, 1));
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(scale, -scale, scale);
  scene.add(mesh);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL();
  scene.remove(mesh);
  geometry.dispose();

  cache.set(key, url);
  return url;
}
