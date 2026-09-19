"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MeshoptDecoder } from "meshoptimizer";
import { useEffect, useRef, useState } from "react";
import tagsData from "./data/tags.json";
import { buildBmFontGeometry, BMFONT, FONT_ATLAS, vertical } from "./bmfont";
import housesData from "./data/houses.json";
import aotiData from "./data/aoti.json";
import roadsData from "./data/roads.json";
import treesAData from "./data/treesA.json";
import treesBData from "./data/treesB.json";
import treesCData from "./data/treesC.json";

const ASSET = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/assets`;
const MODELS = `${ASSET}/models`;

type Vec3 = { position: [number, number, number] } | { name?: string; position: number[] };
type Tag = { name: string; position: [number, number, number] };

// ---------- GLSL assembly (mirrors the original template literals) ----------
function glsl(name: string): string {
  // imported at build time via ?raw
  return (RAW_SHADERS as Record<string, string>)[name] ?? "";
}
import Ha from "./shaders/gamemcu-Ha";
import Rl from "./shaders/gamemcu-Rl";
import Pl from "./shaders/gamemcu-Pl";
import rw from "./shaders/gamemcu-rw";
import aw from "./shaders/gamemcu-aw";
import f8 from "./shaders/gamemcu-f8";
import A8raw from "./shaders/gamemcu-A8";
import cwraw from "./shaders/gamemcu-cw";
import lwraw from "./shaders/gamemcu-lw";
import m8raw from "./shaders/gamemcu-m8";
import Wwraw from "./shaders/gamemcu-Ww";
import Vwraw from "./shaders/gamemcu-Vw";
import Ywraw from "./shaders/gamemcu-Yw";
import wuRaw from "./shaders/gamemcu-wu";
import i0Raw from "./shaders/gamemcu-i0";
import waterFragBase from "./shaders/gamemcu-water.frag";

const waterFragRaw = waterFragBase
  .replace("${Ha}", Ha)
  .replace("${Rl}", Rl)
  .replace("${f8}", f8)
  .replace("${Pl}", Pl);

// water vertex shader (original inlined three.js Water vertex + vPositionW/viewerUV extras)
const waterVertexShader = `
    uniform mat4 textureMatrix;
    uniform float time;

    varying vec4 mirrorCoord;
    varying vec4 worldPosition;
    varying vec3 vPositionW;
    varying vec4 viewerUV;

    #include <common>
    #include <fog_pars_vertex>
    #include <shadowmap_pars_vertex>
    #include <logdepthbuf_pars_vertex>

    void main() {
        vPositionW = vec3( modelMatrix*vec4( position, 1.0 ) );
        mirrorCoord = modelMatrix * vec4( position, 1.0 );
        worldPosition = mirrorCoord.xyzw;
        mirrorCoord = textureMatrix * mirrorCoord;
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * mvPosition;
        // original water vertex: uv-based (the landscape/screen-space path is commented out in the bundle)
        viewerUV.xy = uv * 10.;

    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
    #include <shadowmap_vertex>
    }`;

// shader modules store escaped placeholders (${...}); unescape before substitution
const U = (t: string) => t.split("\\${").join("${");

const RAW_SHADERS = {
  Ha, Rl, Pl, rw, aw, f8,
  A8: U(A8raw), cw: U(cwraw), lw: U(lwraw), m8: m8raw,
  Ww: U(Wwraw), Vw: U(Vwraw), Yw: Ywraw,
  wu: U(wuRaw), i0: U(i0Raw),
  waterFrag: U(waterFragRaw),
};
void glsl;
const RES_VERSION = "1.0.1";
function autoURL(n: string): string {
  return n.replace("res/", `/hz/${RES_VERSION}/`);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (x: number, min: number, max: number) => {
  const t = clamp((x - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// original constants
const O0 = 70; // roof downDistance
const GW = 180; // roads downDistance
const BU = 300; // downEdge
const FOG_COLOR = 14798788;

// height range for land-height sampling (from camera controller)
const HEIGHT_RANGE = [-1622.3, -1086.4, 1810.6, 1480.4];
const EDGE_PARAMS = new THREE.Vector4(-1622.3, -1086.4, 1810.6, 1480.4);

type Loading = { setProgress: (p: number) => void; setLoaded: () => void };

export default function WebglScene({ loadingRef }: { loadingRef: React.RefObject<Loading> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [gpuError, setGpuError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // create WebGL context with fallbacks: default -> software-friendly attributes -> retry
    let renderer: THREE.WebGLRenderer | undefined;
    const attempts: THREE.WebGLRendererParameters[] = [
      { canvas, antialias: false, failIfMajorPerformanceCaveat: false },
      { canvas, antialias: false, failIfMajorPerformanceCaveat: false, powerPreference: "low-power", alpha: false },
    ];
    let lastError: unknown = null;
    let ok = false;
    for (const params of attempts) {
      try {
        renderer = new THREE.WebGLRenderer(params);
        ok = true;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!ok || !renderer) {
      const msg = lastError instanceof Error ? lastError.message : String(lastError);
      setGpuError(msg);
      return;
    }
    const gl = renderer;
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    gl.setSize(window.innerWidth, window.innerHeight);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.debug.onShaderError = (
      _gl: WebGLRenderingContext,
      program: WebGLProgram,
      glVertexShader: WebGLShader,
      glFragmentShader: WebGLShader,
    ) => {
      const dbg = gl.getContext() as WebGLRenderingContext;
      const dump = (label: string, shader: WebGLShader) => {
        const src = dbg.getShaderSource(shader) ?? "(no source)";
        const log = dbg.getShaderInfoLog(shader) ?? "(no log)";
        console.error(`[水墨杭州] ${label} 编译失败:\n${log}\n--- SOURCE ---\n${src}`);
      };
      dump("VERTEX", glVertexShader);
      dump("FRAGMENT", glFragmentShader);
      void program;
    };

    // GPU process crash recovery: log context loss, do not kill the page
    canvas.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        console.warn("[水墨杭州] WebGL context lost（GPU 进程可能崩溃，重启浏览器可恢复）");
      },
      false,
    );

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);

    // fog (matches original: color 0xE1C0E4? no — FOG_COLOR=14798788 = 0xE1C0E4? compute: 14798788 = 0xE1C0E4)
    const fog = new THREE.Fog(new THREE.Color(FOG_COLOR), 200, 800);

    // ---------------- shared assets ----------------
    // original: PlayBeginAnim() and emit(PRELOADED) run together when loading completes,
    // which reveals the begin-anim overlay, the guide and the intro camera at the same moment.
    let startScene: () => void = () => { };
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = (_u, loaded, total) => loadingRef.current?.setProgress(loaded / Math.max(1, total));
    loadingManager.onLoad = () => {
      if (disposed) return;
      loadingRef.current?.setLoaded();
      startScene();
    };

    const texLoader = new THREE.TextureLoader(loadingManager);
    // original image loader defaults every image texture to encoding = renderer.outputEncoding.
    // The engine's renderer used the legacy default (LinearEncoding), so textures without an
    // explicit encoding stay linear; only T_Paper is explicitly sRGB (encoding:3001) and the
    // water textures explicitly linear (encoding:3000).
    const tex = (name: string, opts?: (t: THREE.Texture) => void): THREE.Texture => {
      const t = texLoader.load(`${ASSET}/textures/${name}`);
      opts?.(t);
      return t;
    };
    const repeat18 = (t: THREE.Texture) => { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(18, 18); t.colorSpace = THREE.SRGBColorSpace; };
    const wrap = (t: THREE.Texture) => { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; };

    const tPaperRepeat = tex("T_Paper.webp", repeat18);
    const tPaper = tex("T_Paper.webp");
    // 1×1 placeholder for sampler uniforms that must never be null (avoids "no image data" warnings)
    const BLANK_TEX = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    BLANK_TEX.needsUpdate = true;
    // original explicitly loads water textures with encoding:3000 (linear)
    const linear = (t: THREE.Texture) => { t.colorSpace = THREE.NoColorSpace; };
    const tWaterBase = tex("T_Water_BaseColor.webp", (t) => { wrap(t); linear(t); });
    const tWaterN = tex("T_Water_N.webp", (t) => { wrap(t); linear(t); });
    const tWaterEdge = tex("T_WaterEdge.webp", linear);
    tWaterEdge.flipY = false;
    const tRoadEdgeMask = tex("T_RoadEdgeMask.webp", wrap);
    const tRoof = tex("T_Roof.webp", wrap);
    const tWall = tex("T_Wall01.webp", wrap);
    const tTreeA = tex("T_TreeA.webp");
    const tTreeB = tex("T_TreeB.webp");
    const tTreeC = tex("T_TreeC.webp");

    scene.background = tPaperRepeat;
    scene.fog = fog;

    // ---------------- materials (ported) ----------------
    const targetPos = { value: new THREE.Vector3() };
    const baseUniforms = () => ({
      noiseFogColor: { value: new THREE.Color(FOG_COLOR) },
      noiseFogTexture: { value: tPaperRepeat },
      fogNear: { value: 200 },
      fogFar: { value: 800 },
      fogIntensity: { value: 1 },
    });

    // landscape (new_land)
    const edgeTexCoord = new THREE.Vector4(
      -EDGE_PARAMS.x / (EDGE_PARAMS.z - EDGE_PARAMS.x),
      -EDGE_PARAMS.y / (EDGE_PARAMS.w - EDGE_PARAMS.y),
      1 / (EDGE_PARAMS.z - EDGE_PARAMS.x),
      1 / (EDGE_PARAMS.w - EDGE_PARAMS.y),
    );
    const matLand = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, baseUniforms(), {
        targetPos,
        waterEdge: { value: tWaterEdge },
        edgeParams: { value: EDGE_PARAMS },
        edgeTexCoord: { value: edgeTexCoord },
      }]),
      vertexShader: U(i0Raw).replace("${Ha}", Ha).replace("${Rl}", Rl),
      fragmentShader: U(lwraw).includes("void main") ? U(lwraw).replace("${Ha}", Ha).replace("${rw}", rw).replace("${Rl}", Rl).replace("${aw}", aw).replace("${Pl}", Pl) : "",
      fog: true,
    });
    // lw is the land fragment shader; its vertex is the i0-style shader with the rise logic removed:
    const landVertex = U(i0Raw).replace("${Ha}", Ha).replace("${Rl}", Rl)
      .replace(/\/\/下降[\s\S]*?gl_Position = projectionMatrix \* modelViewMatrix \* vec4\(cPosition, 1\.0\);\n\}/,
        "gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);\nviewerUV = projectionMatrix*modelViewMatrix * vec4(vPosition, 1.0);\nviewerUV = vec4((viewerUV.xyz / viewerUV.w).xy* 0.5 + 0.5,0.,1.);\n}");
    matLand.vertexShader = landVertex;
    matLand.fragmentShader = U(lwraw).replace("${Ha}", Ha).replace("${rw}", rw).replace("${Rl}", Rl).replace("${aw}", aw).replace("${Pl}", Pl);

    const makeRiseMaterial = (tColor: THREE.Texture | null, downDistance: number, extra?: Partial<THREE.ShaderMaterialParameters>) => {
      const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, baseUniforms(), {
        targetPos,
        tColor: { value: tColor ?? BLANK_TEX },
        downDistance: { value: downDistance },
        downEdge: { value: BU },
        tMask: { value: tRoadEdgeMask },
      }]);
      return new THREE.ShaderMaterial({
        uniforms,
        vertexShader: U(i0Raw).replace("${Ha}", Ha).replace("${Rl}", Rl),
        fragmentShader: (tColor ? U(A8raw) : m8raw).replace("${Ha}", Ha).replace("${Rl}", Rl).replace("${f8}", f8).replace("${Pl}", Pl),
        fog: true,
        // original g8/v8/_8 are all opaque (only x8/y8/b8 trees and KA roads are transparent)
        transparent: extra?.transparent ?? false,
        depthWrite: extra?.depthWrite ?? true,
        ...extra,
      });
    };

    // house materials: children[0]=walls(v8, tColor null m8), [1]=wall tex(v8/A8 tWall), [2]=roof(g8 A8 tRoof)
    // from bundle: g8 (roof)=A8 tColor tRoof side=DoubleSide? (Vb), v8 (wall01)=A8 tColor tWall, _8 (m8, no color)
    const matRoof = makeRiseMaterial(tRoof, O0, { side: THREE.DoubleSide });
    const matWall = makeRiseMaterial(tWall, O0);
    const matDark = makeRiseMaterial(null, O0);

    // roads material (cw fragment, tMask)
    const matRoad = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, baseUniforms(), {
        noiseFogColor: { value: new THREE.Color(FOG_COLOR) },
        noiseFogTexture: { value: tPaperRepeat },
        tMask: { value: tRoadEdgeMask },
        targetPos,
        downDistance: { value: GW },
        downEdge: { value: BU },
      }]),
      vertexShader: U(i0Raw).replace("${Ha}", Ha).replace("${Rl}", Rl),
      fragmentShader: U(cwraw).replace("${Ha}", Ha).replace("${Rl}", Rl).replace("${Pl}", Pl),
      fog: true,
      transparent: true,
    });

    // trees (wu vertex = face camera, n0 fragment = A8-like with tColor + noiseFog + Pl)
    const makeTreeMaterial = (tColor: THREE.Texture) => new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, baseUniforms(), {
        targetPos,
        tColor: { value: tColor },
        noiseFogTexture: { value: tPaperRepeat },
      }]),
      vertexShader: U(wuRaw),
      fragmentShader: (U(A8raw).replace("${f8}", f8)).replace("${Ha}", Ha).replace("${Rl}", Rl).replace("${Pl}", Pl),
      fog: true,
      transparent: true,
      depthWrite: false,
    });
    const matTreeA = makeTreeMaterial(tTreeA);
    const matTreeB = makeTreeMaterial(tTreeB);
    const matTreeC = makeTreeMaterial(tTreeC);

    // sun glow (Yw fragment + t0 vertex, no-rise, with the original's flipped vUv.y)
    const t0Vertex = U(i0Raw)
      .replace("${Ha}", Ha)
      .replace("${Rl}", Rl)
      .replace(
        /\/\/下降[\s\S]*?gl_Position = projectionMatrix \* modelViewMatrix \* vec4\(cPosition, 1\.0\);\n\}/,
        "gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);\nviewerUV = projectionMatrix*modelViewMatrix * vec4(vPosition, 1.0);\nviewerUV = vec4((viewerUV.xyz / viewerUV.w).xy* 0.5 + 0.5,0.,1.);\n}",
      );
    const matSun = new THREE.ShaderMaterial({
      uniforms: { targetPos: { value: new THREE.Vector3() } },
      vertexShader: t0Vertex,
      fragmentShader: Ywraw,
      transparent: true,
      fog: false,
    });

    // tag text (BMFont: tText = xingcao ink calligraphy MSDF atlas) + bg (T_Tag red cloth banner)
    // Keep the MSDF atlas UNMIPMAPPED: mipmapping averages the distance field with the strokes,
    // which lifts the glyph-cell background above the threshold and renders grey blocks.
    const fntTexture = texLoader.load(FONT_ATLAS);
    fntTexture.colorSpace = THREE.SRGBColorSpace;
    fntTexture.minFilter = THREE.LinearFilter;
    fntTexture.magFilter = THREE.LinearFilter;
    fntTexture.generateMipmaps = false;
    const tTag = tex("T_Tag.webp");
    const matTagBg = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, baseUniforms(), {
        targetPos,
        tBackground: { value: tTag },
        select: { value: 0 },
        noiseFogTexture: { value: tPaperRepeat },
      }]),
      vertexShader: wuRaw,
      fragmentShader: U(Vwraw).replace("${Ha}", Ha).replace("${Rl}", Rl).replace("${Pl}", Pl),
      transparent: true,
      fog: true,
    });
    // original _fontMaterial: MSDF text material (class g via shader module Ww)
    const matTagText = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, baseUniforms(), {
        tText: { value: fntTexture },
        targetPos,
        select: { value: 0 },
        noiseFogTexture: { value: tPaperRepeat },
      }]),
      vertexShader: wuRaw,
      fragmentShader: U(Wwraw).replace("${Ha}", Ha).replace("${Rl}", Rl).replace("${Pl}", Pl),
      transparent: true,
      fog: true,
    });

    // ---------------- loaders ----------------
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
    const gltfLoader = new GLTFLoader(loadingManager);
    gltfLoader.setDRACOLoader(draco);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    const loadModel = (url: string): Promise<THREE.Group> =>
      new Promise((resolve, reject) => {
        gltfLoader.load(
          url,
          (gltf) => {
            // the original engine's loader hands back a node that carries its clips
            // (node.animations); raw GLTFLoader only exposes them on the result object,
            // so the bird mixers were never created and the geese never flapped.
            gltf.scene.animations = gltf.animations;
            resolve(gltf.scene as THREE.Group);
          },
          undefined,
          reject,
        );
      });

    // ---------------- water (ported from modified three.js Water) ----------------
    // simplified: uses the original water shaders with a reflection render target
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    const waterUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, THREE.UniformsLib.lights, {
      normalSampler: { value: BLANK_TEX as THREE.Texture },
      mirrorSampler: { value: BLANK_TEX as THREE.Texture },
      alpha: { value: 1 },
      time: { value: 0 },
      size: { value: 1 },
      distortionScale: { value: 10.7 },
      textureMatrix: { value: new THREE.Matrix4() },
      sunColor: { value: new THREE.Color(0xffffff) },
      sunDirection: { value: new THREE.Vector3(0.70707, 0.70707, 0) },
      eye: { value: new THREE.Vector3() },
      waterColor: { value: new THREE.Color(6581875) },
      waterColorMask: { value: tWaterBase },
      targetPos,
      noiseFogColor: { value: new THREE.Color(FOG_COLOR) },
      noiseFogTexture: { value: tPaperRepeat },
    }]);
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      vertexShader: waterVertexShader,
      fragmentShader: waterFragRaw,
      lights: true,
      fog: true,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = 8.2;
    // reflection target
    const mirror = new THREE.WebGLRenderTarget(512, 512);
    waterUniforms.mirrorSampler.value = mirror.texture;
    waterUniforms.normalSampler.value = tWaterN;
    const textureMatrix = waterUniforms.textureMatrix.value as THREE.Matrix4;
    const mirrorCamera = new THREE.PerspectiveCamera();
    const CLIP_BIAS = 0;

    // reflection scratch (ported verbatim from the original three.js Water.onBeforeRender)
    const mirrorWorldPosition = new THREE.Vector3();
    const cameraWorldPosition = new THREE.Vector3();
    const rotationMatrix = new THREE.Matrix4();
    const waterNormal = new THREE.Vector3();
    const reflectedView = new THREE.Vector3();
    const reflectedTarget = new THREE.Vector3();
    const lookAtPosition = new THREE.Vector3();
    const clipPlane = new THREE.Plane();
    const clipQ = new THREE.Vector4();
    const clipVector = new THREE.Vector4();

    waterMesh.onBeforeRender = (_r, renderScene, cam) => {
      const viewCamera = cam as THREE.PerspectiveCamera;
      mirrorWorldPosition.setFromMatrixPosition(waterMesh.matrixWorld);
      cameraWorldPosition.setFromMatrixPosition(viewCamera.matrixWorld);
      rotationMatrix.extractRotation(waterMesh.matrixWorld);
      waterNormal.set(0, 0, 1);
      waterNormal.applyMatrix4(rotationMatrix);
      reflectedView.subVectors(mirrorWorldPosition, cameraWorldPosition);
      // skip the mirror pass when the camera is itself below the water plane
      if (reflectedView.dot(waterNormal) > 0) return;
      reflectedView.reflect(waterNormal).negate();
      reflectedView.add(mirrorWorldPosition);
      rotationMatrix.extractRotation(viewCamera.matrixWorld);
      lookAtPosition.set(0, 0, -1);
      lookAtPosition.applyMatrix4(rotationMatrix);
      lookAtPosition.add(cameraWorldPosition);
      reflectedTarget.subVectors(mirrorWorldPosition, lookAtPosition);
      reflectedTarget.reflect(waterNormal).negate();
      reflectedTarget.add(mirrorWorldPosition);
      mirrorCamera.position.copy(reflectedView);
      mirrorCamera.up.set(0, 1, 0);
      mirrorCamera.up.applyMatrix4(rotationMatrix);
      mirrorCamera.up.reflect(waterNormal);
      mirrorCamera.lookAt(reflectedTarget);
      mirrorCamera.far = viewCamera.far;
      mirrorCamera.near = 0.1;
      mirrorCamera.updateMatrixWorld();
      mirrorCamera.projectionMatrix.copy(viewCamera.projectionMatrix);
      textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      textureMatrix.multiply(mirrorCamera.projectionMatrix);
      textureMatrix.multiply(mirrorCamera.matrixWorldInverse);

      // Oblique near-plane clipping (the part the previous port was missing): everything
      // below the water surface is clipped out of the mirror pass. Without this, the
      // reflection samples the submerged terrain flanks — which the land shader paints
      // dark grey below y≈10 — producing a grey fringe along every shoreline.
      clipPlane.setFromNormalAndCoplanarPoint(waterNormal, mirrorWorldPosition);
      clipPlane.applyMatrix4(mirrorCamera.matrixWorldInverse);
      clipVector.set(clipPlane.normal.x, clipPlane.normal.y, clipPlane.normal.z, clipPlane.constant);
      const projectionMatrix = mirrorCamera.projectionMatrix;
      clipQ.x = (Math.sign(clipVector.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
      clipQ.y = (Math.sign(clipVector.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
      clipQ.z = -1;
      clipQ.w = (1 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];
      clipVector.multiplyScalar(2 / clipVector.dot(clipQ));
      projectionMatrix.elements[2] = clipVector.x;
      projectionMatrix.elements[6] = clipVector.y;
      projectionMatrix.elements[10] = clipVector.z + 1 - CLIP_BIAS;
      projectionMatrix.elements[14] = clipVector.w;

      waterUniforms.eye.value.setFromMatrixPosition(viewCamera.matrixWorld);
      waterMesh.visible = false;
      const prevBg = renderScene.background;
      renderScene.background = new THREE.Color("#f1f7ff");
      gl.setRenderTarget(mirror);
      gl.clear();
      gl.render(renderScene, mirrorCamera);
      renderScene.background = prevBg;
      waterMesh.visible = true;
      gl.setRenderTarget(null);
    };
    scene.add(waterMesh);

    // height reader (from T_Height.jpg pixels)
    const heightReader = { pixels: null as ImageData | null };
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `${ASSET}/textures/T_Height.webp`;
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (ctx) { ctx.drawImage(img, 0, 0); heightReader.pixels = ctx.getImageData(0, 0, c.width, c.height); }
    };
    function getLandHeight(): number {
      if (!heightReader.pixels) return 0;
      const px = heightReader.pixels;
      const u = (camera.position.x - HEIGHT_RANGE[0]) / (HEIGHT_RANGE[2] - HEIGHT_RANGE[0]);
      const v = (camera.position.z - HEIGHT_RANGE[1]) / (HEIGHT_RANGE[3] - HEIGHT_RANGE[1]);
      const x = Math.floor(clamp(u, 0, 0.999) * 512);
      const y = Math.floor(clamp(v, 0, 0.999) * 512);
      const r = px.data[(y * 512 + x) * 4];
      return Math.abs(1 - r / 255) * 240;
    }

    // ---------------- camera controller (faithful port of class cr) ----------------
    const rotateAboutX = (q: THREE.Quaternion, deg: number) => {
      const a = (deg / 180) * Math.PI;
      q.multiply(new THREE.Quaternion(Math.sin(a / 2), 0, 0, Math.cos(a / 2)));
    };
    const ctrl = {
      maxDegree: 70, minDegree: 15, maxArmLen: 220, minArmLen: 70,
      minRange: new THREE.Vector2(-1200, -600), maxRange: new THREE.Vector2(1400, 1000),
      targetArmLen: 220, currentArmLen: 120, currentDegree: 30,
      rayHeight: 0, currentHeight: 0, lerpStrength: 1.5,
      enabled: true,
      moveCurrent: new THREE.Vector3(), moveTarget: new THREE.Vector3(10, 0, 80),
      heightOffset: new THREE.Vector3(0, 10, 0),
      centerOffset: new THREE.Vector3(0, 0, -30),
      lerpPosStrength: 0, lerpQuatStrength: 0,
      rotateY: new THREE.Quaternion(),
      preArmOffset: new THREE.Vector3(),
      target: new THREE.Vector3(25, 20, 170),
      tween: null as null | { fromArm: number; toArm: number; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t: number; dur: number },
      clampMoveTarget() {
        this.moveTarget.set(
          clamp(this.moveTarget.x, this.minRange.x, this.maxRange.x),
          0,
          clamp(this.moveTarget.z, this.minRange.y, this.maxRange.y),
        );
      },
      moveToTarget(pos: THREE.Vector3, armLen: number) {
        this.tween = { fromArm: this.targetArmLen, toArm: armLen, fromTarget: this.moveTarget.clone(), toTarget: pos.clone(), t: 0, dur: 1.5 };
      },
      moveToTargetByName(name: string) {
        const t = (tagsData as Tag[]).find((x) => x.name === name);
        if (t) this.moveToTarget(new THREE.Vector3(t.position[0], t.position[1], t.position[2]), this.minArmLen);
      },
      update(dt: number) {
        if (!this.enabled) return;
        // moveToTarget tween (original: 1.5s Quadratic.InOut)
        if (this.tween) {
          this.tween.t += dt;
          const k = clamp(this.tween.t / this.tween.dur, 0, 1);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          this.targetArmLen = lerp(this.tween.fromArm, this.tween.toArm, e);
          this.moveTarget.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e);
          if (k >= 1) this.tween = null;
        }
        this.currentArmLen = lerp(this.currentArmLen, this.targetArmLen, dt * 5);
        this.currentDegree = this.minDegree + ((this.currentArmLen - this.minArmLen) / (this.maxArmLen - this.minArmLen)) * (this.maxDegree - this.minDegree);
        const arm = new THREE.Vector3(0, Math.sin((this.currentDegree / 360) * Math.PI) * this.currentArmLen, Math.cos((this.currentDegree / 360) * Math.PI) * this.currentArmLen);
        arm.applyQuaternion(this.rotateY);
        const q = this.rotateY.clone();
        this.clampMoveTarget();
        this.moveCurrent.lerp(this.moveTarget, dt * 5 * this.lerpStrength);
        this.target.copy(this.moveCurrent).add(this.heightOffset);
        this.currentHeight = lerp(this.currentHeight, this.rayHeight, dt);
        const p = arm.clone().add(new THREE.Vector3(0, this.currentHeight, 0));
        p.add(this.target);
        camera.position.lerp(p, dt * this.lerpPosStrength * this.lerpStrength);
        this.preArmOffset.lerp(arm, dt * this.lerpQuatStrength);
        this.target.copy(camera.position).sub(this.preArmOffset);
        this.target.add(this.centerOffset);
        rotateAboutX(q, -this.currentDegree / 2);
        camera.quaternion.slerp(q, Math.max(0.0001, dt * this.lerpQuatStrength));
        this.rayHeight = getLandHeight();
      },
    };
    const target = ctrl.target;
    targetPos.value = target;
    // Unlike the original (which passes the live cr.target object directly), UniformsUtils.merge
    // clones the uniform value, so rebind every material's targetPos to the shared live target.
    for (const mat of [matLand, matRoof, matWall, matDark, matRoad, matTreeA, matTreeB, matTreeC, matTagBg, matTagText, waterMaterial]) {
      const u = mat.uniforms as Record<string, { value: unknown }> | undefined;
      if (u?.targetPos) u.targetPos.value = target;
    }

    // input handlers (original _onMouseDown/_onMouseUp/_onMouseMove/_onMouseWheel)
    let mouseDown = false;
    const preLoc = new THREE.Vector2();
    const onDown = (e: PointerEvent) => {
      mouseDown = true;
      preLoc.set(e.pageX, e.pageY);
      gl.domElement.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onUp = () => { mouseDown = false; ctrl.rayHeight = getLandHeight(); };
    const onMove = (e: PointerEvent) => {
      if (!mouseDown) return;
      const cur = new THREE.Vector2(e.pageX, e.pageY);
      const delta = preLoc.clone().sub(cur).multiplyScalar((ctrl.currentArmLen * 2) / gl.domElement.height);
      const v = new THREE.Vector3(delta.x, 0, delta.y).applyQuaternion(ctrl.rotateY);
      ctrl.moveTarget.add(v);
      ctrl.clampMoveTarget();
      preLoc.copy(cur);
    };
    const onWheel = (e: WheelEvent) => {
      ctrl.targetArmLen = e.deltaY > 0
        ? Math.min(ctrl.maxArmLen, ctrl.targetArmLen + e.deltaY * 0.001 * ctrl.currentArmLen)
        : Math.max(ctrl.minArmLen, ctrl.targetArmLen + e.deltaY * 0.001 * ctrl.currentArmLen);
    };
    const onDragStart = (e: Event) => e.preventDefault();
    gl.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("wheel", onWheel);
    gl.domElement.addEventListener("dragstart", onDragStart);

    // tags raycast (original sign plugin: hover scale + click select)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(2, 2);
    const tagMeshes: THREE.Mesh[] = [];
    const tagGroups = new Map<THREE.Object3D, THREE.Object3D>();
    const groupScales = new Map<THREE.Object3D, number>();
    let hovered: THREE.Object3D | null = null;
    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.pageX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.pageY / window.innerHeight) * 2 + 1;
    };
    const onMouseClick = (e: MouseEvent) => {
      pointer.x = (e.pageX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.pageY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(tagMeshes, false);
      if (hits.length > 0) {
        const name = hits[0].object.name;
        ctrl.moveToTargetByName(name);
        window.dispatchEvent(new CustomEvent("gmhz-tag-click", { detail: name }));
      }
    };
    gl.domElement.addEventListener("pointermove", onPointerMove);
    gl.domElement.addEventListener("click", onMouseClick);

    const updateTagHover = () => {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(tagMeshes, false);
      const obj = hits.length > 0 ? (hits[0].object as THREE.Object3D) : null;
      hovered = obj;
      tagGroups.forEach((g, mesh) => {
        const want = mesh === hovered ? 1.1 : 1;
        const next = lerp(groupScales.get(g) ?? 1, want, 0.12);
        groupScales.set(g, next);
        g.scale.setScalar(next);
      });
    };

    // center button (original MOVE_CENTER → moveToTarget((10,0,80), 220))
    const onMoveCenter = () => ctrl.moveToTarget(new THREE.Vector3(10, 0, 80), ctrl.maxArmLen);
    window.addEventListener("gmhz-move-center", onMoveCenter);

    // ---------------- scene content ----------------
    let disposed = false;
    const disposers: (() => void)[] = [];

    // landscape
    loadModel(`${MODELS}/SM_HangZhouLandScape.glb`).then((g) => {
      if (disposed) return;
      g.scale.set(0.1, 0.1, 0.1);
      const mesh = g.children[0] as THREE.Mesh;
      if (mesh) mesh.material = matLand;
      scene.add(g);
    });

    // instanced loader plugin (ported class $2): load when camera near, scale-y rise
    type MeshInfo = { position: THREE.Vector3; name: string; object: THREE.Group | null; visible: boolean; state: number };
    const makeInstancedPlugin = (list: (Tag | Vec3)[], maxDist: number, urlFor: (name: string) => string, init: (g: THREE.Group) => void) => {
      const infos: MeshInfo[] = list.map((p) => ({
        position: new THREE.Vector3(p.position[0], p.position[1], p.position[2]),
        name: (p as Tag).name ?? "", object: null, visible: false, state: 0,
      }));
      let preCenter = new THREE.Vector3(9999, 9999, 9999);
      const tweens: { obj: THREE.Object3D; from: number; to: number; t: number; dur: number; done?: () => void }[] = [];
      return {
        update(dt: number, center: THREE.Vector3) {
          if (center.distanceTo(preCenter) < 10) { stepTweens(dt); return; }
          preCenter = center.clone();
          for (const info of infos) {
            if (preCenter.distanceTo(info.position) < maxDist) {
              if (!info.visible) {
                info.visible = true;
                if (info.object) info.object.visible = true;
                if (info.state === 0) {
                  info.state = 1;
                  loadModel(urlFor(info.name)).then((g) => {
                    if (disposed) return;
                    init(g);
                    info.state = 2;
                    info.object = g;
                    g.scale.set(0.1, 0, 0.1);
                    scene.add(g);
                    tweens.push({ obj: g, from: 0, to: 0.1, t: 0, dur: 4 });
                  });
                } else if (info.object) {
                  tweens.push({ obj: info.object, from: info.object.scale.y, to: 0.1, t: 0, dur: 1 });
                }
              }
            } else if (info.visible) {
              info.visible = false;
              if (info.object) {
                tweens.push({ obj: info.object, from: info.object.scale.y, to: 0, t: 0, dur: 1, done: () => { info.object!.visible = false; } });
              }
            }
          }
          stepTweens(dt);
        },
      };
      function stepTweens(dt: number) {
        for (let i = tweens.length - 1; i >= 0; i--) {
          const tw = tweens[i];
          tw.t += dt;
          const k = clamp(tw.t / tw.dur, 0, 1);
          const e = 1 - Math.pow(1 - k, 3); // cubic out
          tw.obj.scale.y = lerp(tw.from, tw.to, e);
          if (k >= 1) { tw.done?.(); tweens.splice(i, 1); }
        }
      }
    };

    const housesPlugin = makeInstancedPlugin(housesData, 300, (n) => `${MODELS}/hangzhou04Big_Houseexported_glb/${n}`, (g) => {
      const kids = g.children[0]?.children ?? [];
      if (kids[2]) (kids[2] as THREE.Mesh).material = matRoof;
      if (kids[0]) (kids[0] as THREE.Mesh).material = matWall;
      if (kids[1]) (kids[1] as THREE.Mesh).material = matDark;
    });
    const aotiPlugin = makeInstancedPlugin(aotiData, 300, (n) => `${MODELS}/hanzhou02_AoTi_glb/${n}`, (g) => {
      g.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          const m = c as THREE.Mesh;
          const map = (m.material as THREE.MeshStandardMaterial)?.map ?? null;
          const mat = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, baseUniforms(), {
              targetPos,
              tColor: { value: map ?? BLANK_TEX },
              downDistance: { value: 1250 },
              noiseFogTexture: { value: tPaperRepeat },
            }]),
            vertexShader: U(i0Raw).replace("${Ha}", Ha).replace("${Rl}", Rl),
            fragmentShader: (U(A8raw).replace("${f8}", f8)).replace("${Ha}", Ha).replace("${Rl}", Rl).replace("${Pl}", Pl),
            fog: true,
          });
          const au = mat.uniforms as Record<string, { value: unknown }>;
          if (au.targetPos) au.targetPos.value = target;
          m.material = mat;
        }
      });
    });
    const roadsPlugin = makeInstancedPlugin(roadsData, 800, (n) => `${MODELS}/hangzhou04Big_Roadexported_glb/${n}`, (g) => {
      const kids = g.children[0]?.children ?? [];
      if (kids[0]) (kids[0] as THREE.Mesh).material = matRoad;
      if (kids[1]) (kids[1] as THREE.Mesh).material = matRoad;
    });

    // trees instanced planes (Qw plugin)
    const makeTreeInstances = (list: Vec3[], mat: THREE.Material) => {
      const geo = new THREE.PlaneGeometry(3, 3);
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      const mat4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3(1, 1, 1);
      list.forEach((p, i) => {
        pos.set(p.position[0], p.position[1] + 1.1, p.position[2]);
        mat4.compose(pos, quat, scale);
        m.setMatrixAt(i, mat4);
      });
      m.instanceMatrix.needsUpdate = true;
      scene.add(m);
    };

    // original Qw plugin: three instanced tree planes (Fw/kw/Nw data with x8/y8/b8 materials)
    makeTreeInstances(treesAData, matTreeA);
    makeTreeInstances(treesBData, matTreeB);
    makeTreeInstances(treesCData, matTreeC);

    // birds — faithful port of the original flock plugin (class Zw):
    //   count=10, initRange [-1000,36,-1000,1000,48,1000],
    //   respawnRange [-1700,36,-1100,-1600,48,1500], scale [9,10],
    //   flyMaxLength=1900, flySpeed=10. The loaded formation is the template; each
    //   SkeletonUtils clone gets its own 5 mixers (one per clip) so it flaps.
    const FLOCK_COUNT = 10;
    const FLOCK_INIT = [-1000, 36, -1000, 1000, 48, 1000];
    const FLOCK_RESPAWN = [-1700, 36, -1100, -1600, 48, 1500];
    const FLOCK_SCALE: [number, number] = [9, 10];
    const FLOCK_MAX_X = 1900;
    const FLOCK_SPEED = 10;
    const initBirdTransform = (o: THREE.Object3D, range: number[], scale: [number, number]) => {
      o.rotation.y = -Math.PI / 2;
      o.position.set(rand(range[0], range[3]), rand(range[1], range[4]), rand(range[2], range[5]));
      const s = rand(scale[0], scale[1]);
      o.scale.set(s, s, s);
    };
    const birds: THREE.Object3D[] = [];
    const birdMixers: THREE.AnimationMixer[] = [];
    loadModel(`${MODELS}/AN_Bird.glb`).then((g) => {
      if (disposed) return;
      initBirdTransform(g, FLOCK_INIT, FLOCK_SCALE);
      // original only touches children[0].children[0], but the GLB's 5 meshes share one
      // material, so clearing fog on every mesh is equivalent.
      g.traverse((c) => {
        const m = c as THREE.Mesh;
        if ((m as THREE.Mesh).isMesh) {
          const mm = m.material as THREE.Material & { fog?: boolean; needsUpdate?: boolean };
          mm.fog = false;
          mm.needsUpdate = true;
        }
      });
      scene.add(g);
      birds.push(g);
      for (let i = 1; i < FLOCK_COUNT; i++) {
        const h = skeletonClone(g);
        initBirdTransform(h, FLOCK_INIT, FLOCK_SCALE);
        scene.add(h);
        birds.push(h);
      }
      for (const b of birds) {
        for (const clip of g.animations) {
          const mixer = new THREE.AnimationMixer(b);
          mixer.clipAction(clip).play();
          birdMixers.push(mixer);
        }
      }
    });

    // lead goose (original class $w): a single bird circling above & in front of the camera
    // target — this is the one that appears large and close during the intro.
    let leaderBird: THREE.Object3D | null = null;
    let leaderMixers: THREE.AnimationMixer[] = [];
    let leaderMat: (THREE.Material & { opacity?: number }) | null = null;
    const leader = {
      currentCenter: new THREE.Vector3(),
      flyLengthUnit: 190,
      flyLength: 190,
      currentFlyLen: 0,
      flySpeed: 10,
      pendingCenter: null as THREE.Vector3 | null,
      fadeT: -1,
    };
    loadModel(`${MODELS}/AN_Bird.glb`).then((g) => {
      if (disposed) return;
      g.rotation.y = -Math.PI / 2;
      g.scale.set(10, 10, 10);
      leaderMat = null;
      g.traverse((c) => {
        const m = c as THREE.Mesh;
        if ((m as THREE.Mesh).isMesh) {
          const mm = m.material as THREE.Material & { fog?: boolean; needsUpdate?: boolean; transparent?: boolean; opacity?: number };
          mm.fog = false;
          mm.transparent = true;
          mm.needsUpdate = true;
          leaderMat = mm;
        }
      });
      leaderBird = g;
      leaderMixers = [];
      for (const clip of g.animations) {
        const mixer = new THREE.AnimationMixer(g);
        mixer.clipAction(clip).play();
        leaderMixers.push(mixer);
      }
      scene.add(g);
    });
    // original: on tag CLICK the goose re-centers over the tag (flyLength scales with aspect)
    const onLeaderTagClick = (e: Event) => {
      const name = (e as CustomEvent<string>).detail;
      const t = (tagsData as Tag[]).find((x) => x.name === name);
      if (t) {
        leader.flyLength = leader.flyLengthUnit * (window.innerWidth / window.innerHeight);
        leader.pendingCenter = new THREE.Vector3(t.position[0], 0, t.position[2]);
      }
    };
    window.addEventListener("gmhz-tag-click", onLeaderTagClick);

    // sun glow (original: SphereGeometry(20, 32, 16) — a soft ink-wash sun, not a flat quad)
    const sunGeo = new THREE.SphereGeometry(20, 32, 16);
    const sun = new THREE.Mesh(sunGeo, matSun);
    scene.add(sun);

    // tags (original sign plugin _createSign):
    //   p  (group, world position)
    //     x  (group scale (h*5.6, h*5, h*5.6), z -0.1)
    //       bg  (SM_Face geometry, scale (1, name.length+0.8, 1), T_Tag material)
    //     text (BMFont geometry, MSDF material, scale (h*.2, -h*.2, h*.2), y h*5+2.5)
    loadModel(`${MODELS}/SM_Face.glb`).then((face) => {
      if (disposed) return;
      const faceGeo = (face.children[0] as THREE.Mesh)?.geometry;
      if (!faceGeo) return;
      const h = 0.7;
      for (const tag of tagsData as Tag[]) {
        const p = new THREE.Group();
        p.position.set(tag.position[0], tag.position[1] - 10, tag.position[2]);
        const x = new THREE.Group();
        x.scale.set(h * 5.6, h * 5, h * 5.6);
        x.position.set(0, 0, -0.1);
        p.add(x);

        const bg = new THREE.Mesh(faceGeo, matTagBg);
        bg.name = tag.name;
        bg.scale.set(1, 1 * tag.name.length + 0.8, 1);
        x.add(bg);

        const { geometry: textGeo } = buildBmFontGeometry(BMFONT, vertical(tag.name));
        const textMesh = new THREE.Mesh(textGeo, matTagText);
        textMesh.scale.set(h * 0.2, -h * 0.2, h * 0.2);
        // both meshes are billboarded in the shader, so three's distance-based transparent
        // sorting can flip between the flag and the text as the camera moves; force the
        // flag to render first and the text on top of it.
        bg.renderOrder = 1;
        textMesh.renderOrder = 2;
        textMesh.position.set(0, h * 5 + 2.5, 0);
        p.add(textMesh);

        scene.add(p);
        tagMeshes.push(bg);
        tagGroups.set(bg, p);
        groupScales.set(p, 1);
      }
    });

    // ---------------- begin animation (PlayBeginAnim) ----------------
    type Intro = { t: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromQuat: THREE.Quaternion; toQuat: THREE.Quaternion; fromFov: number; toFov: number };
    let intro: Intro | null = null;
    let strengthTween: { t: number } | null = null;
    const beginIntro = () => {
      // original PlayBeginAnim runs in the same tick the scene is created, before
      // cr.update has ever run, so cr.target is still its initial static value (25,20,170).
      // The intro therefore flies to (25,20,170) - (0,0,-30) = (25,20,200) (the 雷峰夕照 area),
      // then the 5s settle raises the camera. Restore that pristine state here.
      ctrl.enabled = false;
      ctrl.target.set(25, 20, 170);
      ctrl.moveCurrent.set(0, 0, 0);
      ctrl.preArmOffset.set(0, 0, 0);
      ctrl.targetArmLen = 220;
      ctrl.currentArmLen = 120;
      ctrl.currentDegree = 30;
      ctrl.currentHeight = 0;
      ctrl.rayHeight = 0;
      camera.position.set(-45, 70, -90);
      camera.fov = 20;
      camera.updateProjectionMatrix();
      intro = {
        t: 0,
        fromPos: camera.position.clone(),
        toPos: ctrl.target.clone().sub(ctrl.centerOffset),
        fromQuat: camera.quaternion.clone(),
        toQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0, 0)),
        fromFov: 20,
        toFov: 45,
      };
    };
    let started = false;
    startScene = () => {
      if (started) return;
      started = true;
      beginIntro();
    };

    // ---------------- main loop ----------------
    let lastTime = performance.now();
    let raf = 0;
    const animate = () => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      // physics uses a capped step; time-based tweens use wall-clock so they stay faithful
      // even when the tab is throttled to a low frame rate
      const dt = Math.min(rawDt, 0.1);
      const clockDt = Math.min(rawDt, 0.5);
      lastTime = now;

      // camera update (faithful port of cr.update + PlayBeginAnim intro)
      if (intro) {
        intro.t += clockDt;
        const k = clamp(intro.t / 10, 0, 1);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // Cubic.InOut
        camera.position.lerpVectors(intro.fromPos, intro.toPos, e);
        camera.quaternion.slerpQuaternions(intro.fromQuat, intro.toQuat, e);
        camera.fov = lerp(intro.fromFov, intro.toFov, e);
        camera.updateProjectionMatrix();
        if (k >= 1) {
          intro = null;
          ctrl.enabled = true;
          window.dispatchEvent(new CustomEvent("gmhz-finish-anim"));
          strengthTween = { t: 0 };
        }
      } else {
        ctrl.update(dt);
        if (strengthTween) {
          strengthTween.t += clockDt;
          const k = clamp(strengthTween.t / 5, 0, 1);
          const e = k < 0.5 ? 8 * k * k * k * k : 1 - Math.pow(-2 * k + 2, 4) / 2; // Quartic.InOut
          ctrl.lerpPosStrength = lerp(0, 6, e);
          ctrl.lerpQuatStrength = lerp(0, 5, e);
          if (k >= 1) strengthTween = null;
        }
      }
      updateTagHover();
      window.dispatchEvent(new CustomEvent("gmhz-camera-y", { detail: camera.position.y }));

      // plugins
      housesPlugin.update(dt, target);
      aotiPlugin.update(dt, target);
      roadsPlugin.update(dt, target);

      // birds (flock: drift +x, respawn at the far edge — original Zw.update)
      for (const mixer of birdMixers) mixer.update(dt);
      for (const b of birds) {
        b.position.x += dt * FLOCK_SPEED;
        if (!(b.position.x < FLOCK_MAX_X)) initBirdTransform(b, FLOCK_RESPAWN, FLOCK_SCALE);
      }

      // lead goose (original class $w): flies left→right above/in front of the camera target,
      // fading in/out along the flight path; re-centers over a tag on click.
      for (const mixer of leaderMixers) mixer.update(dt);
      if (leaderBird) {
        if (leader.fadeT >= 0) {
          // 1s fade-out while re-centering (original: Tween opacity→0 then reset)
          leader.fadeT += dt;
          if (leaderMat) leaderMat.opacity = Math.max(0, 1 - leader.fadeT);
          if (leader.fadeT >= 1) {
            if (leader.pendingCenter) leader.currentCenter.copy(leader.pendingCenter);
            leader.currentFlyLen = 0;
            leader.pendingCenter = null;
            leader.fadeT = -1;
          }
        } else {
          if (leader.pendingCenter) leader.fadeT = 0;
          leaderBird.position
            .copy(leader.currentCenter)
            .add(new THREE.Vector3(-leader.flyLength / 2, 35, -100))
            .add(new THREE.Vector3(leader.currentFlyLen, 0, 0));
          if (leaderMat) {
            leaderMat.opacity = Math.pow(
              1 - (Math.abs(leader.currentFlyLen - leader.flyLength / 2) / leader.flyLength) * 2,
              0.5,
            );
          }
          leader.currentFlyLen += dt * leader.flySpeed;
        }
      }

      // sun follows target
      sun.position.copy(target).add(new THREE.Vector3(-70, 50, -500));
      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).__dbg = {
          sun: sun.position.toArray(),
          cam: camera.position.toArray(),
          fov: camera.fov,
        };
      }

      // water time
      waterUniforms.time.value += dt * 0.6;

      gl.render(scene, camera);
    };

    // resize
    const onResize = () => {
      gl.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // safety net: if a lazy asset never resolves, still reveal the scene
    const startTimer = setTimeout(() => {
      loadingRef.current?.setLoaded();
      startScene();
    }, 15000);

    setReady(true);
    animate();

    return () => {
      disposed = true;
      clearTimeout(startTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      gl.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("wheel", onWheel);
      gl.domElement.removeEventListener("dragstart", onDragStart);
      gl.domElement.removeEventListener("pointermove", onPointerMove);
      gl.domElement.removeEventListener("click", onMouseClick);
      window.removeEventListener("gmhz-move-center", onMoveCenter);
      window.removeEventListener("gmhz-tag-click", onLeaderTagClick);
      gl.dispose();
      mirror.dispose();
    };
  }, []);

  return (
    <aside className="webgl-wrapper">
      {gpuError ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "#e8e4dc",
            color: "#333",
            fontFamily: "sans-serif",
            textAlign: "center",
            padding: "0 10vw",
            zIndex: 5,
          }}
        >
          <p style={{ fontSize: "2.4vmin", margin: "1vh 0" }}>
            无法创建 WebGL 上下文（当前浏览器 GPU 已禁用）
          </p>
          <p style={{ fontSize: "1.6vmin", color: "#666", lineHeight: 1.8 }}>
            请在 Chrome 设置中开启「硬件加速」，或访问 chrome://gpu 检查 WebGL 状态后刷新页面。
          </p>
        </div>
      ) : (
        <canvas ref={canvasRef} className="webgl-canvas" style={{ display: ready ? "block" : "block" }}>
          No Canvas!
        </canvas>
      )}
    </aside>
  );
}
