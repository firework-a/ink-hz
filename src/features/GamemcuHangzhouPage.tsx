"use client";

import { useEffect, useRef, useState } from "react";
import WebglScene from "./WebglScene";
import { bmfontTextURL } from "./bmfont-dom";
import { vertical } from "./bmfont";

const ASSET = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/assets`;
const RES_VERSION = "1.0.1";
const CODE_VERSION = "1.0.0";
const CONTACT_URL = "https://github.com/firework-a/ink-hz";

// Original loading bird (wild goose) — rides at the right edge of the progress fill.
function BirdSvg() {
  return (
    <svg className="bird" width="50px" height="50px" viewBox="0 0 44.47 20.61" xmlns="http://www.w3.org/2000/svg">
      <g id="body">
        <path
          d="M420,311h8.89a1.69,1.69,0,0,1,.11-1,2,2,0,0,1,2-1l17.65-2a5.48,5.48,0,0,1,2.35,1,5.57,5.57,0,0,1,2,3,3.39,3.39,0,0,0-3-1,3,3,0,0,0-1.54,1,15.75,15.75,0,0,1-3.46,2,19.42,19.42,0,0,1-10,1,27.87,27.87,0,0,1-5-1,41.31,41.31,0,0,0-5,0c-1.79.11-3.92.35-4,0s1-.54,1-1S420.91,311.21,420,311Z"
          transform="translate(-412.8 -293.62)"
        />
      </g>
      <g id="front_wings" data-name="front wings">
        <path
          d="M431.26,312.49a12.73,12.73,0,0,0-.24-2,14.36,14.36,0,0,0-1.49-3.85c-1.7-2.9-6-3.6-9.79-5.84a20.21,20.21,0,0,1-6.94-7.2,52.11,52.11,0,0,0,8.68,5c5.57,2.51,8.57,2.64,12.77,5.47A26.38,26.38,0,0,1,440,309.4Z"
          transform="translate(-412.8 -293.62)"
        />
        <path d="M453,311" transform="translate(-412.8 -293.62)" />
      </g>
      <g id="back_wings" data-name="back wings">
        <path
          d="M439.76,311.09a5.23,5.23,0,0,1-.35-2.35,5.32,5.32,0,0,1,1.48-3.19c1.85-1.34,3.87-2.71,6-4.05a102.12,102.12,0,0,1,10.35-5.61l-12.1,8.76a3.75,3.75,0,0,0-2.64,3.61,2.84,2.84,0,0,0,.85,1.63Z"
          transform="translate(-412.8 -293.62)"
        />
      </g>
    </svg>
  );
}

function LoadingProgress({ barRef }: { barRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      className="progress-container"
      style={{ backgroundImage: `url("${ASSET}/textures/T_Paper.webp")` }}
    >
      <div className="progress-bar">
        {/* original first interval tick runs immediately with s=0 -> inline width:0% */}
        <div className="progress" ref={barRef} style={{ width: "0%" }}>
          <BirdSvg />
        </div>
      </div>
      <div className="version">res 1.0.1 code 1.0.0</div>
    </div>
  );
}

// Original oE: three <img> with inline `animation: show 3s ease-in-out` and delays
// 2.2/5.2/8s, mounted at PRELOADED. The original's bmfont.textURL() is synchronous
// (font atlas loaded during preload), so the delays count from the exact PRELOADED
// instant. We render all three <img> up front (placeholder src until the glyphs are
// ready) so React never delays their mount and the CSS delays stay faithful.
const INTRO_LINES: { text: string; delay: string; width?: string }[] = [
  { text: "江南忆，最忆是杭州", delay: "2.2s" },
  { text: "清明河畔，远山如黛", delay: "5.2s" },
  { text: "何日更重游", delay: "8s", width: "60vw" },
];
const BLANK_PX = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

function BeginAnim({ visible }: { visible: boolean }) {
  const [urls, setUrls] = useState<(string | null)[]>([null, null, null]);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const out: (string | null)[] = [];
      for (const l of INTRO_LINES) {
        out.push(await bmfontTextURL(l.text, 5));
        if (cancelled) return;
      }
      setUrls(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);
  if (!visible) return null;
  return (
    <div className="BeginAnim-container" style={{ opacity: 1 }}>
      <div className="content">
        {INTRO_LINES.map((l, i) => (
          <img
            key={l.text}
            src={urls[i] ?? BLANK_PX}
            alt=""
            style={{ animation: "gmhz-show 3s ease-in-out", animationDelay: l.delay, width: l.width }}
          />
        ))}
      </div>
    </div>
  );
}

// The guide clips are MPEG-TS with MPEG-2 video (stream_type 0x02), which no browser
// can decode via MSE. The original plays them with JSMpeg (its `Z3` namespace is JSMpeg:
// Player/VideoElement/BitBuffer/Source/AudioOutput/WASMModule/...), so we load the same library.
type JSMpegPlayer = { destroy: () => void };
type JSMpegNS = { Player: new (url: string, options: Record<string, unknown>) => JSMpegPlayer };
let jsmpegPromise: Promise<JSMpegNS | null> | null = null;
function loadJSMpeg(): Promise<JSMpegNS | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as unknown as { JSMpeg?: JSMpegNS };
  if (w.JSMpeg) return Promise.resolve(w.JSMpeg);
  if (!jsmpegPromise) {
    jsmpegPromise = new Promise<JSMpegNS | null>((resolve) => {
      const s = document.createElement("script");
      s.src = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/vendor/jsmpeg.min.js`;
      s.async = true;
      s.onload = () => resolve((window as unknown as { JSMpeg?: JSMpegNS }).JSMpeg ?? null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }
  return jsmpegPromise;
}

function GuideVideo({ id, src }: { id: string; src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let player: JSMpegPlayer | null = null;
    let cancelled = false;
    (async () => {
      const JSMpeg = await loadJSMpeg();
      if (cancelled || !JSMpeg) return;
      player = new JSMpeg.Player(src, { canvas, autoplay: true, loop: true, audio: false });
    })();
    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        /* noop */
      }
    };
  }, [src]);
  return (
    <div className="videoWrapper" id={id} style={{ background: "#1a1a1a" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}

// Original dE: the .Gudie-container is always mounted and toggles opacity/pointerEvents
// (the CSS `transition: all 1s` fades it in); the two guide videos mount at PRELOADED
// and are already looping by the time the overlay becomes visible 13s later.
function GuideOverlay({ visible, ready, onClose }: { visible: boolean; ready: boolean; onClose: () => void }) {
  const [hints, setHints] = useState<(string | null)[]>([null, null]);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const out: (string | null)[] = [];
      for (const t of ["双指放大", "点击标签"]) {
        out.push(await bmfontTextURL(t, 2));
        if (cancelled) return;
      }
      setHints(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);
  return (
    <div
      className="Gudie-container"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        visibility: visible ? "visible" : "hidden",
      }}
    >
      <div className="back" />
      <div className="content" style={{ backgroundImage: `url("${ASSET}/textures/Contact-Background.webp")` }}>
        <div style={{ marginTop: "5vh" }} />
        {ready ? <GuideVideo id="video-guide01" src={`${ASSET}/videos/Guide01.ts`} /> : null}
        {hints[0] ? <img src={hints[0]} alt="双指放大" className="Gudie-hint-img" /> : null}
        {ready ? <GuideVideo id="video-guide02" src={`${ASSET}/videos/Guide02.ts`} /> : null}
        {hints[1] ? <img src={hints[1]} alt="点击标签" className="Gudie-hint-img" /> : null}
        <button
          className="continue"
          style={{ backgroundImage: `url("${ASSET}/textures/Continue.webp")` }}
          aria-label="继续"
          onClick={onClose}
        />
      </div>
    </div>
  );
}

export default function GamemcuHangzhouPage() {
  // Faithful port of the original loading component (class nE):
  //   zi.loading  = max(zi.loading, loaded/total) on each resource onProgress, = 1 onLoad
  //   bar value s = damp(s, zi.loading, 1, .016) each tick; s>=.99 -> 1
  //   on PRELOADED (h=true) wait until s>=1, then fade the bar out (600ms) and hide it.
  // This is why the intro has already been running for a few seconds by the time the
  // loading bar disappears in the original: the bar's damped value trails the real progress.
  const loadingTargetRef = useRef(0);
  const loadedFlagRef = useRef(false);
  const barElRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef({
    setProgress: (p: number) => {
      // original: zi.loading = Math.max(zi.loading, loaded/total)
      loadingTargetRef.current = Math.max(loadingTargetRef.current, p);
    },
    setLoaded: () => {
      // original: loader.onLoad sets zi.loading = 1 and PRELOADED is emitted right after.
      // PRELOADED reveals the begin-anim overlay (the three intro poem lines) immediately,
      // at the same moment the intro camera tween starts.
      loadingTargetRef.current = 1;
      loadedFlagRef.current = true;
      setBeginVisible(true);
      setLoaded(true);
    },
  });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [beginVisible, setBeginVisible] = useState(false);
  const [finishAnim, setFinishAnim] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);

  // Warm the MSDF text cache during the loading phase (the original builds its font
  // during preload and its textURL() is synchronous), so the intro poem <img>s already
  // have their src the instant BeginAnim mounts at PRELOADED — keeping the 2.2/5.2/8s
  // delays aligned with the intro camera tween.
  useEffect(() => {
    for (const l of INTRO_LINES) void bmfontTextURL(l.text, 5);
    for (const t of ["双指放大", "点击标签"]) void bmfontTextURL(t, 2);
  }, []);

  useEffect(() => {
    // original: zi.on(PRELOADED, async () => { await dw(13); showGuide() })
    // the guide appears 13s after preload, i.e. just after the 10s intro
    if (!loaded) return;
    const t = setTimeout(() => setGuideVisible(true), 13000);
    return () => clearTimeout(t);
  }, [loaded]);

  useEffect(() => {
    // original emits FINISH_ANIM when the 10s intro camera tween completes
    const onFinish = () => setFinishAnim(true);
    window.addEventListener("gmhz-finish-anim", onFinish);
    return () => window.removeEventListener("gmhz-finish-anim", onFinish);
  }, []);

  // Faithful port of the original nE interval: every tick the bar value damp-converges
  // toward zi.loading (lambda=1, dt=.016), clamping at .99->1; once PRELOADED has fired
  // and the value reaches 1, fade the container out (600ms) and display:none it.
  // The original calls setInterval(cb) with NO delay (browser clamps to ~1-4ms); the damp
  // still advances a fixed dt=.016 per tick, so the bar fills in ~1/4 the real time. Using
  // 16ms here made the bar ~4x slower, kept the loading screen up ~5s and revealed the
  // intro late (small sun). Match the original: no delay argument.
  useEffect(() => {
    const bar = barElRef.current;
    if (!bar) return;
    let s = 0;
    let faded = false;
    const id = setInterval(() => {
      const target = loadingTargetRef.current;
      s = s + (target - s) * (1 - Math.exp(-1 * 0.016)); // damp
      if (s >= 0.99) s = 1;
      bar.style.width = `${s * 100}%`;
      if (loadedFlagRef.current && s >= 1 && !faded) {
        faded = true;
        const container = bar.closest(".progress-container") as HTMLElement | null;
        if (container) {
          container.style.transition = "opacity 600ms cubic-bezier(0,0,.58,1)";
          container.style.opacity = "0";
          setTimeout(() => {
            container.style.display = "none";
            setLoading(false);
          }, 600);
        }
      }
    });
    return () => clearInterval(id);
  }, [loaded]);

  return (
    <div className="gamemcu-hz-page">
      <WebglScene loadingRef={loadingRef} />

      {loading ? <LoadingProgress barRef={barElRef} /> : null}

      <TextVideoPoem />

      <div className="bottomButton-container">
        <button
          className="button"
          style={{ opacity: finishAnim ? "1" : "0", backgroundImage: `url("${ASSET}/textures/Center.webp")` }}
          aria-label="回到中心"
          onClick={() => window.dispatchEvent(new CustomEvent("gmhz-move-center"))}
        />
      </div>

      <BeginAnim visible={beginVisible} />

      <GuideOverlay visible={guideVisible} ready={loaded} onClose={() => setGuideVisible(false)} />

      <div className="Logo-container">
        <button
          onClick={() => window.open(CONTACT_URL)}
          style={{ backgroundImage: `url("${ASSET}/textures/Contact-us.webp")` }}
          aria-label="宣传片"
        />
      </div>
    </div>
  );
}

type Poem = { name: string; rows: { row: string; text: string }[] };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (x: number, min: number, max: number) => {
  const t = clamp01((x - min) / (max - min));
  return t * t * (3 - 2 * t);
};

function TextVideoPoem() {
  const [poem, setPoem] = useState<Poem | null>(null);
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [opacity, setOpacity] = useState(0);

  // original: poem is selected by 3D-tag CLICK; fades with camera height
  useEffect(() => {
    const onTag = (e: Event) => {
      const name = (e as CustomEvent<string>).detail;
      import("@/features/data/poems.json")
        .then((mod) => {
          const data = mod.default as Poem[];
          setPoem(data.find((p) => p.name === name) ?? null);
        })
        .catch(() => undefined);
    };
    const onCameraY = (e: Event) => {
      const y = (e as CustomEvent<number>).detail;
      setOpacity(clamp01(1 - smoothstep(y, 60, 80)));
    };
    window.addEventListener("gmhz-tag-click", onTag);
    window.addEventListener("gmhz-camera-y", onCameraY);
    return () => {
      window.removeEventListener("gmhz-tag-click", onTag);
      window.removeEventListener("gmhz-camera-y", onCameraY);
    };
  }, []);

  useEffect(() => {
    if (!poem) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const out: (string | null)[] = [];
      for (const r of poem.rows) out.push(await bmfontTextURL(vertical(r.text)));
      if (!cancelled) setUrls(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [poem]);

  if (!poem) return null;
  return (
    <div className="TextVideoContainer" style={{ opacity }}>
      <span className="Typed-text">
        {poem.rows.map((r, i) =>
          urls[i] ? <img key={r.row} className={r.row} src={urls[i] ?? ""} alt="" /> : null,
        )}
      </span>
    </div>
  );
}
