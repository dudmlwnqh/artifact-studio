import { useState, useRef, useCallback, useEffect } from "react";
import storage from "./storage.js";
import { loadFromGitHub, saveToGitHub } from "./utils/githubDataSync.js";
import { repairAppData, detectCorruption } from "./utils/dataRepair.js";
import GitHubSyncSetup from "./components/GitHubSyncSetup.jsx";
import SnapshotPanel from "./components/SnapshotPanel.jsx";
import AutoSnapPrompt from "./components/AutoSnapPrompt.jsx";
import CatalogPanel from "./components/CatalogPanel.jsx";
import { EMPTY_CATALOG, deserializeCatalog, serializeCatalog } from "./utils/catalogQuery.js";
import { COLLECT_AGENT_PROMPT, NORMALIZE_ENGINE_PROMPT, buildCollectUserPrompt } from "./utils/agentPrompts.js";
const I=({d,s=18})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{typeof d==="string"?<path d={d}/>:d}</svg>;
const Plus=()=><I d="M12 5v14M5 12h14"/>;
const Search=()=><I d={<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>}/>;
const Sun=()=><I d={<><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>}/>;
const Moon=()=><I d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>;


/* ── toHex — sanitize color values ── */
function toHex(c){if(!c)return"#000000";try{if(/^#[0-9a-fA-F]{6}$/.test(c))return c;if(/^#[0-9a-fA-F]{3}$/.test(c))return c.replace(/#([0-9a-f])([0-9a-f])([0-9a-f])/i,"#$1$1$2$2$3$3");if(/^#[0-9a-fA-F]{8}$/.test(c))return c.slice(0,7);const m=c.match(/(\d+)/g);if(m&&m.length>=3)return"#"+m.slice(0,3).map(n=>parseInt(n).toString(16).padStart(2,"0")).join("")}catch(e){}return"#000000"}

/* ── Design Panel (원본 그대로) ── */
const PAIR = { top: "bottom", bottom: "top", left: "right", right: "left" };
const MAX_V = 60, OT = 8;
const FONTS = ["system-ui","Pretendard","Apple SD Gothic Neo","Noto Sans KR","Inter","Roboto","SF Pro","Helvetica Neue","Georgia","Times New Roman","Nanum Gothic","Nanum Myeongjo","monospace","cursive"];

/* ── Design tokens — single source of truth ── */
const T = {
  bg: "#ffffff",
  page: "#f2f2f7",
  input: "#f2f2f7",
  sep: "rgba(60,60,67,0.1)",
  label: "#3a3a3c",
  value: "#3a3a3c",
  unit: "#3a3a3c",
  accent: "#007aff",
  orange: "#ff9500",
  font: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif',
  inputH: 34,
  r: 8,
  labelSize: 12,
  valueSize: 13,
  gap: 8,
  sectionGap: 16,
};

/* ── Unified label ── */
const labelStyle = { fontSize: T.labelSize, color: T.label, marginBottom: 5, fontFamily: T.font, fontWeight: 400 };

/* ── Unified input box ── */
const inputBoxStyle = {
  background: T.input, borderRadius: T.r, height: T.inputH, display: "flex", alignItems: "center", padding: "0 10px",
};

/* ── ColorInput ── */
function ColorInput({ label, value, onChange }) {
  const ref = useRef(null);
  const [hasEd] = useState(() => typeof window !== "undefined" && "EyeDropper" in window);
  const ed = async () => { if (!hasEd) return; try { const r = await new window.EyeDropper().open(); onChange(r.sRGBHex); } catch {} };
  return (<div>
    <p style={labelStyle}>{label}</p>
    <div style={{ ...inputBoxStyle, gap: 8 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: value, border: "1px solid rgba(0,0,0,0.06)", cursor: "pointer" }} onClick={() => ref.current?.click()} />
        <input ref={ref} type="color" value={toHex(value)}
          onChange={(e) => onChange(e.target.value)} style={{ position: "absolute", top: 0, left: 0, width: 22, height: 22, opacity: 0, cursor: "pointer" }} />
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ background: "none", border: "none", color: T.value, fontSize: T.valueSize, fontFamily: T.font, width: "100%", outline: "none" }} />
      {hasEd && <button onClick={ed} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.unit} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 22l1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="M14 4l.5-.5a2.12 2.12 0 013 3l-.5.5"/><path d="M14.5 5.5l4 4"/></svg>
      </button>}
    </div>
  </div>);
}

/* ── ComboInput ── */
function ComboInput({ label, value, options, unit, onChange }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(String(value));
  const wrapRef = useRef(null);
  useEffect(() => { setText(String(value)); }, [value]);
  useEffect(() => { if (!open) return; const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, [open]);
  const commit = (v) => { const n = parseFloat(v); if (!isNaN(n)) onChange(n); setOpen(false); };
  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <p style={labelStyle}>{label}</p>
      <div style={{ ...inputBoxStyle }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => commit(text), 150)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(text); e.target.blur(); } }}
          style={{ background: "none", border: "none", color: T.value, fontSize: T.valueSize, fontFamily: T.font, width: "100%", outline: "none" }} />
        {unit && <span style={{ fontSize: 12, color: T.unit, flexShrink: 0 }}>{unit}</span>}
        <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 0 4px", display: "flex", flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 3.75l2.5 2.5 2.5-2.5" stroke={T.unit} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 50, background: T.bg, borderRadius: T.r, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)" }}>
          {options.map(o => (
            <div key={o} onPointerDown={(e) => { e.preventDefault(); setText(String(o)); onChange(typeof o === "string" ? o : parseFloat(o)); setOpen(false); }}
              style={{ padding: "8px 12px", fontSize: T.valueSize, fontFamily: T.font, cursor: "pointer", color: String(value) === String(o) ? T.accent : T.value, background: String(value) === String(o) ? "rgba(0,122,255,0.08)" : "transparent" }}
              onMouseEnter={(e) => { if (String(value) !== String(o)) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = String(value) === String(o) ? "rgba(0,122,255,0.08)" : "transparent"; }}
            >{o}{unit ? ` ${unit}` : ""}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── SegmentControl ── */
function SegmentControl({ label, options, value, onChange }) {
  return (<div>
    <p style={labelStyle}>{label}</p>
    <div style={{ display: "flex", background: T.input, borderRadius: T.r, padding: 2, gap: 1, height: T.inputH }}>
      {options.map(opt => {
        const k = typeof opt === "string" ? opt : opt.key;
        const l = typeof opt === "string" ? opt : opt.label;
        const active = value === k;
        return (<button key={k} onClick={() => onChange(k)} style={{
          flex: 1, border: "none", cursor: "pointer", fontSize: T.valueSize, fontWeight: active ? 500 : 400,
          borderRadius: 6, background: active ? T.bg : "transparent",
          color: T.value, fontFamily: T.font,
          boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          transition: "all 0.15s",
        }}>{l}</button>);
      })}
    </div>
  </div>);
}

/* ── SelectInput ── */
function SelectInput({ label, value, options, onChange, fontPreview }) {
  return (<div>
    <p style={labelStyle}>{label}</p>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ ...inputBoxStyle, width: "100%", border: "none", color: T.value, fontSize: T.valueSize, outline: "none", fontFamily: fontPreview || T.font, appearance: "none", cursor: "pointer", paddingRight: 12 }}>
      {options.map(o => <option key={o} value={o} style={{ fontFamily: fontPreview ? o + ",sans-serif" : T.font }}>{o}</option>)}
    </select>
  </div>);
}

/* ── SliderRow (inline label + slider + value) ── */
function SliderRow({ label, value, min, max, step, unit, onChange }) {
  const d = step && step < 1 ? value.toFixed(1) : Math.round(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: T.inputH }}>
      <span style={{ fontSize: T.labelSize, color: T.label, fontFamily: T.font, flexShrink: 0, minWidth: 52 }}>{label}</span>
      <input type="range" min={min} max={max} step={step || 1} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: T.accent, height: 4, cursor: "pointer" }} />
      <div style={{ background: T.input, borderRadius: 6, padding: "0 8px", height: 28, display: "flex", alignItems: "center", minWidth: 40, justifyContent: "center" }}>
        <span style={{ fontSize: T.valueSize, fontFamily: T.font, color: T.value }}>{d}</span>
        {unit && <span style={{ fontSize: 11, color: T.unit, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

/* ── SliderInput (stacked label) ── */
function SliderInput({ label, value, min, max, step, unit, onChange }) {
  const d = step && step < 1 ? value.toFixed(1) : Math.round(value);
  return (<div>
    <p style={labelStyle}>{label}</p>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input type="range" min={min} max={max} step={step || 1} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: T.accent, height: 4, cursor: "pointer" }} />
      <div style={{ background: T.input, borderRadius: 6, padding: "0 8px", height: 28, display: "flex", alignItems: "center", minWidth: 40, justifyContent: "center" }}>
        <span style={{ fontSize: T.valueSize, fontFamily: T.font, color: T.value }}>{d}</span>
        {unit && <span style={{ fontSize: 11, color: T.unit, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  </div>);
}

/* ── CSS Box Model ── */
function CSSBoxModel({ margin, setMargin, padding, setPadding }) {
  const cvRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [editing, setEditing] = useState(null);
  const [allM, setAllM] = useState(false);
  const [allP, setAllP] = useState(false);
  const dragRef = useRef(null);
  const startRef = useRef({});
  const dims = useRef({ w: 0, h: 0 });

  const mapV = useCallback((v, total) => 18 + (v / MAX_V) * total * 0.18, []);
  const getBoxes = useCallback((w, h) => {
    const mt = mapV(margin.top, h), mb = mapV(margin.bottom, h), ml = mapV(margin.left, w), mr = mapV(margin.right, w);
    const pt = mapV(padding.top, h), pb = mapV(padding.bottom, h), pl = mapV(padding.left, w), pr = mapV(padding.right, w);
    const outer = { x: OT, y: OT, w: w - OT * 2, h: h - OT * 2 };
    const border = { x: OT + ml, y: OT + mt, w: Math.max(8, outer.w - ml - mr), h: Math.max(8, outer.h - mt - mb) };
    const content = { x: border.x + pl, y: border.y + pt, w: Math.max(4, border.w - pl - pr), h: Math.max(4, border.h - pt - pb) };
    return { outer, border, content };
  }, [margin, padding, mapV]);

  function getDir(px, py, ob, ib) {
    const inT = py < ib.y, inB = py > ib.y + ib.h, inL = px < ib.x, inR = px > ib.x + ib.w;
    if (inT && !inL && !inR) return "top"; if (inB && !inL && !inR) return "bottom";
    if (inL && !inT && !inB) return "left"; if (inR && !inT && !inB) return "right";
    if (inT && inL) return (ib.y - py > ib.x - px) ? "top" : "left";
    if (inT && inR) return (ib.y - py > px - ib.x - ib.w) ? "top" : "right";
    if (inB && inL) return (py - ib.y - ib.h > ib.x - px) ? "bottom" : "left";
    if (inB && inR) return (py - ib.y - ib.h > px - ib.x - ib.w) ? "bottom" : "right";
    return null;
  }

  const hitTest = useCallback((px, py) => {
    const { w, h } = dims.current;
    const { outer, border, content } = getBoxes(w, h);
    if (px >= content.x && px <= content.x + content.w && py >= content.y && py <= content.y + content.h) return { layer: "content", dir: "center" };
    if (px >= border.x && px <= border.x + border.w && py >= border.y && py <= border.y + border.h) { const d = getDir(px, py, border, content); return d ? { layer: "padding", dir: d } : null; }
    if (px >= outer.x && px <= outer.x + outer.w && py >= outer.y && py <= outer.y + outer.h) { const d = getDir(px, py, outer, border); return d ? { layer: "margin", dir: d } : null; }
    return null;
  }, [getBoxes]);

  const rr = (ctx, x, y, w, h, r) => { w = Math.max(2, w); h = Math.max(2, h); r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath(); };

  const draw = useCallback(() => {
    const cv = cvRef.current; if (!cv) return;
    const rc = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    const w = rc.width, h = rc.height; dims.current = { w, h };
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const drag = dragRef.current;
    const { outer, border: bdr, content: con } = getBoxes(w, h);
    const mc = { c: "rgba(255,149,0,", s: "#FF9500" };
    const pc = { c: "rgba(0,122,255,", s: "#007AFF" };
    const hlDirs = (layer, dir) => (layer === "margin" ? allM : allP) ? ["top","bottom","left","right"] : [dir, PAIR[dir]];

    const hlZone = (layer, ob, ib, col) => {
      const all = layer === "margin" ? allM : allP;
      ["top","bottom","left","right"].forEach(d => {
        const isA = all || (drag && drag.layer === layer && hlDirs(layer, drag.dir).includes(d));
        const isH = !drag && hover && hover.layer === layer && hlDirs(layer, hover.dir).includes(d);
        if (!isA && !isH) return;
        ctx.fillStyle = col + (isA ? "0.15)" : "0.07)");
        if (d === "top") ctx.fillRect(ob.x, ob.y, ob.w, Math.max(0, ib.y - ob.y));
        else if (d === "bottom") ctx.fillRect(ob.x, ib.y + ib.h, ob.w, Math.max(0, ob.y + ob.h - ib.y - ib.h));
        else if (d === "left") ctx.fillRect(ob.x, ib.y, Math.max(0, ib.x - ob.x), ib.h);
        else ctx.fillRect(ib.x + ib.w, ib.y, Math.max(0, ob.x + ob.w - ib.x - ib.w), ib.h);
      });
    };

    const drawVals = (layer, vals, ob, ib, col) => {
      const all = layer === "margin" ? allM : allP;
      const lp = {
        top: { x: (ob.x * 2 + ob.w) / 2, y: ob.y + Math.max(6, (ib.y - ob.y) / 2) },
        bottom: { x: (ob.x * 2 + ob.w) / 2, y: ib.y + ib.h + Math.max(6, (ob.y + ob.h - ib.y - ib.h) / 2) },
        left: { x: ob.x + Math.max(6, (ib.x - ob.x) / 2), y: (ob.y * 2 + ob.h) / 2 },
        right: { x: ib.x + ib.w + Math.max(6, (ob.x + ob.w - ib.x - ib.w) / 2), y: (ob.y * 2 + ob.h) / 2 },
      };
      ["top","bottom","left","right"].forEach(d => {
        if (editing && editing.layer === layer && editing.dir === d) return;
        const z = lp[d], v = vals[d];
        const isA = all || (drag && drag.layer === layer && hlDirs(layer, drag.dir).includes(d));
        const isH = !drag && hover && hover.layer === layer && hlDirs(layer, hover.dir).includes(d);
        const gap = (d === "top" || d === "bottom") ? Math.abs(ib.y - ob.y) : Math.abs(ib.x - ob.x);
        ctx.font = `500 10px ${T.font}`;
        ctx.fillStyle = isA ? col + "1)" : isH ? col + "0.85)" : col + "0.7)";
        ctx.globalAlpha = gap < 10 ? 0.35 : 1;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(v, z.x, z.y); ctx.globalAlpha = 1;
      });
    };

    // margin
    rr(ctx, outer.x, outer.y, outer.w, outer.h, 10);
    ctx.fillStyle = mc.c + "0.04)"; ctx.fill();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = mc.c + (allM ? "0.5)" : "0.25)"); ctx.lineWidth = 1;
    rr(ctx, outer.x, outer.y, outer.w, outer.h, 10); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    hlZone("margin", outer, bdr, mc.c);
    ctx.font = `500 8px ${T.font}`; ctx.fillStyle = mc.c + "0.8)"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("margin", outer.x + 6, outer.y + 4);

    // border
    rr(ctx, bdr.x, bdr.y, bdr.w, bdr.h, 8);
    ctx.strokeStyle = "rgba(60,60,67,0.4)"; ctx.lineWidth = 1.5;
    rr(ctx, bdr.x, bdr.y, bdr.w, bdr.h, 8); ctx.stroke(); ctx.lineWidth = 1;

    // padding
    rr(ctx, bdr.x, bdr.y, bdr.w, bdr.h, 8);
    ctx.fillStyle = pc.c + "0.04)"; ctx.fill();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = pc.c + (allP ? "0.5)" : "0.25)"); ctx.lineWidth = 1;
    rr(ctx, bdr.x + 1, bdr.y + 1, bdr.w - 2, bdr.h - 2, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    hlZone("padding", bdr, con, pc.c);
    ctx.font = `500 8px ${T.font}`; ctx.fillStyle = pc.c + "0.8)"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("padding", bdr.x + 6, bdr.y + 4);

    // content
    rr(ctx, con.x, con.y, con.w, con.h, 6);
    ctx.fillStyle = "rgba(60,60,67,0.03)"; ctx.fill();
    ctx.strokeStyle = "rgba(60,60,67,0.12)"; ctx.lineWidth = 0.5;
    rr(ctx, con.x, con.y, con.w, con.h, 6); ctx.stroke();
    if (con.w > 36 && con.h > 14) { ctx.font = `400 9px ${T.font}`; ctx.fillStyle = T.unit; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("content", con.x + con.w / 2, con.y + con.h / 2); }

    drawVals("margin", margin, outer, bdr, mc.c);
    drawVals("padding", padding, bdr, con, pc.c);

    if (drag && drag.dir !== "center") {
      const isM = drag.layer === "margin"; const box = isM ? bdr : con; const col = isM ? mc.s : pc.s;
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 0.5; ctx.setLineDash([2, 2]); ctx.globalAlpha = 0.3;
      if (drag.dir === "top" || drag.dir === "bottom") [box.y, box.y + box.h].forEach(yy => { ctx.beginPath(); ctx.moveTo(outer.x, yy); ctx.lineTo(outer.x + outer.w, yy); ctx.stroke(); });
      else [box.x, box.x + box.w].forEach(xx => { ctx.beginPath(); ctx.moveTo(xx, outer.y); ctx.lineTo(xx, outer.y + outer.h); ctx.stroke(); });
      ctx.restore();
    }

    const cur = hover || drag;
    if (!cur) cv.style.cursor = "default"; else if (cur.dir === "center") cv.style.cursor = "pointer";
    else if (cur.dir === "top" || cur.dir === "bottom") cv.style.cursor = "ns-resize"; else cv.style.cursor = "ew-resize";
  }, [margin, padding, allM, allP, hover, editing, getBoxes]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => { const fn = () => draw(); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); }, [draw]);

  const getPos = (e) => { const r = cvRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const lastTapRef = useRef({ time: 0, hit: null });

  const onDown = (e) => {
    const p = getPos(e); const h = hitTest(p.x, p.y); if (!h) return;
    const now = Date.now(); const lt = lastTapRef.current;
    if (h.layer !== "content" && lt.hit && lt.hit.layer === h.layer && lt.hit.dir === h.dir && now - lt.time < 400) { lastTapRef.current = { time: 0, hit: null }; setEditing(h); return; }
    lastTapRef.current = { time: now, hit: h };
    if (h.layer === "content") { e.preventDefault(); setAllP(s => !s); return; }
    e.preventDefault(); cvRef.current.setPointerCapture(e.pointerId);
    const vals = h.layer === "margin" ? margin : padding;
    dragRef.current = h; startRef.current = { x: e.clientX, y: e.clientY, v: vals[h.dir], pv: vals[PAIR[h.dir]] }; draw();
  };
  const onMove = (e) => {
    if (!dragRef.current) { setHover(hitTest(getPos(e).x, getPos(e).y)); return; }
    e.preventDefault(); const d = dragRef.current; const { x: sx, y: sy, v: sv, pv: spv } = startRef.current;
    let delta; if (d.dir === "top") delta = e.clientY - sy; else if (d.dir === "bottom") delta = sy - e.clientY; else if (d.dir === "left") delta = e.clientX - sx; else delta = sx - e.clientX;
    const nv = Math.max(0, Math.min(MAX_V, Math.round(sv + delta * 0.7)));
    const isM = d.layer === "margin"; const allS = isM ? allM : allP; const setter = isM ? setMargin : setPadding;
    setter(prev => { const np = { ...prev, [d.dir]: nv }; if (allS) np.top = np.bottom = np.left = np.right = nv; else np[PAIR[d.dir]] = Math.max(0, Math.min(MAX_V, Math.round(spv + delta * 0.7))); return np; });
  };
  const onUp = (e) => { if (dragRef.current) { cvRef.current.releasePointerCapture(e.pointerId); dragRef.current = null; draw(); } };

  const commitEdit = (layer, dir, val) => {
    let v = parseInt(val, 10); const setter = layer === "margin" ? setMargin : setPadding; const allS = layer === "margin" ? allM : allP;
    setter(prev => { if (isNaN(v)) v = prev[dir]; v = Math.max(0, Math.min(MAX_V, v)); const np = { ...prev }; if (allS) np.top = np.bottom = np.left = np.right = v; else { np[dir] = v; np[PAIR[dir]] = v; } return np; });
    setEditing(null);
  };


  return (<div>
    <div style={{ position: "relative" }}>
      <canvas ref={cvRef} style={{ width: "100%", aspectRatio: "1.45", display: "block", touchAction: "none", borderRadius: T.r, background: T.bg }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerLeave={() => { if (!dragRef.current) setHover(null); }} />
      {editing && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <input autoFocus type="number" defaultValue={(editing.layer === "margin" ? margin : padding)[editing.dir]} min={0} max={MAX_V}
            style={{ pointerEvents: "auto", width: 50, height: 28, textAlign: "center", fontSize: T.valueSize, fontFamily: T.font, border: `2px solid ${editing.layer === "margin" ? T.orange : T.accent}`, borderRadius: 6, background: T.bg, color: T.value, outline: "none", padding: 0 }}
            onBlur={(e) => commitEdit(editing.layer, editing.dir, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } if (e.key === "Escape") setEditing(null); }} />
        </div>
      )}
    </div>
    <p style={{ textAlign: "center", fontSize: 10, color: T.unit, margin: "6px 0 0", fontFamily: T.font }}>
      <span style={{ color: T.orange }}>margin</span>
      <span style={{ margin: "0 6px" }}>·</span>
      <span style={{ color: T.label }}>border</span>
      <span style={{ margin: "0 6px" }}>·</span>
      <span style={{ color: T.accent }}>padding</span>
      <span style={{ margin: "0 6px" }}>·</span>
      <span>content</span>
    </p>
  </div>);
}

/* ── Divider ── */
function Divider() { return <div style={{ height: 0.5, background: T.sep, margin: `${T.sectionGap}px 0` }} />; }

/* ── Main ── */

/* ── DesignRemoteBody — wraps panel for floating remote ── */
function DesignRemoteBody({selElement, onStyleChange}) {
  const s = selElement.style || {};
  const [fontFamily, setFontFamily] = useState((s["font-family"]||"system-ui").split(",")[0].replace(/['"]/g,"").trim());
  const [fontSize, setFontSize] = useState(parseInt(s["font-size"])||14);
  const [fontWeight, setFontWeight] = useState(s["font-weight"]||"400");
  const [lineHeight, setLineHeight] = useState(parseFloat(s["line-height"])||1.4);
  const [letterSpacing, setLetterSpacing] = useState(parseFloat(s["letter-spacing"])||0);
  const [textAlign, setTextAlign] = useState(s["text-align"]||"left");
  const [textColor, setTextColor] = useState(toHex(s.color||"#000000"));
  const [bgColor, setBgColor] = useState(toHex(s.background||s["background-color"]||"#ffffff"));
  const [margin, setMargin] = useState({top:parseInt(s["margin-top"])||0,bottom:parseInt(s["margin-bottom"])||0,left:parseInt(s["margin-left"])||0,right:parseInt(s["margin-right"])||0});
  const [padding, setPadding] = useState({top:parseInt(s["padding-top"])||parseInt(s.padding)||0,bottom:parseInt(s["padding-bottom"])||parseInt(s.padding)||0,left:parseInt(s["padding-left"])||parseInt(s.padding)||0,right:parseInt(s["padding-right"])||parseInt(s.padding)||0});
  const [gap, setGap] = useState(parseInt(s.gap)||0);
  const [radius, setRadius] = useState(parseInt(s["border-radius"])||0);
  const [borderWidth, setBorderWidth] = useState(parseInt(s["border-width"])||0);
  const [borderColor, setBorderColor] = useState(toHex(s["border-color"]||"#000000"));
  const [borderStyle, setBorderStyle] = useState(s["border-style"]||"none");
  const [opacity, setOpacity] = useState(parseFloat(s.opacity)||1);
  const [shadow, setShadow] = useState("none");
  const [cursor, setCursor] = useState(s.cursor||"default");
  const shadowMap = { none: "none", "약한": "0 1px 3px rgba(0,0,0,0.12)", "중간": "0 4px 14px rgba(0,0,0,0.15)", "강한": "0 10px 30px rgba(0,0,0,0.2)" };

  // Auto-push style to parent whenever any value changes (skip initial)
  const isInitial = useRef(true);
  useEffect(()=>{
    if(isInitial.current){isInitial.current=false;return}
    if(!onStyleChange)return;
    const parts = [];
    parts.push(`font-family:${fontFamily},sans-serif`);
    parts.push(`font-size:${fontSize}px`);
    parts.push(`font-weight:${fontWeight}`);
    parts.push(`line-height:${lineHeight}`);
    parts.push(`letter-spacing:${letterSpacing}px`);
    parts.push(`text-align:${textAlign}`);
    parts.push(`color:${textColor}`);
    parts.push(`background:${bgColor}`);
    parts.push(`margin:${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`);
    parts.push(`padding:${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`);
    if(gap)parts.push(`gap:${gap}px`);
    if(radius)parts.push(`border-radius:${radius}px`);
    if(borderStyle!=="none")parts.push(`border:${borderWidth}px ${borderStyle} ${borderColor}`);
    if(opacity<1)parts.push(`opacity:${opacity}`);
    const sh=shadowMap[shadow];if(sh&&sh!=="none")parts.push(`box-shadow:${sh}`);
    if(cursor!=="default")parts.push(`cursor:${cursor}`);
    // Keep original non-overridden styles
    const dominated=new Set(["font-family","font-size","font-weight","line-height","letter-spacing","text-align","color","background","background-color","margin","margin-top","margin-bottom","margin-left","margin-right","padding","padding-top","padding-bottom","padding-left","padding-right","gap","border-radius","border","border-style","border-width","border-color","opacity","box-shadow","cursor"]);
    Object.entries(s).forEach(([k,v])=>{if(!dominated.has(k))parts.push(`${k}:${v}`)});
    onStyleChange(parts.join(";"));
  },[fontFamily,fontSize,fontWeight,lineHeight,letterSpacing,textAlign,textColor,bgColor,margin,padding,gap,radius,borderWidth,borderColor,borderStyle,opacity,shadow,cursor]);

  return (
    <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
      {/* Preview */}
      <div style={{ padding: "16px", borderBottom: `0.5px solid ${T.sep}` }}>
        <div style={{ background: T.input, borderRadius: 10, padding: 20, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 56 }}>
          <button style={{
            fontFamily: fontFamily + ",sans-serif", fontSize, fontWeight, color: textColor,
            background: bgColor, textAlign, lineHeight, letterSpacing: letterSpacing + "px",
            padding: `${Math.min(padding.top, 16)}px ${Math.min(padding.right, 20)}px ${Math.min(padding.bottom, 16)}px ${Math.min(padding.left, 20)}px`,
            borderRadius: radius, opacity,
            border: borderStyle !== "none" ? `${borderWidth}px ${borderStyle} ${borderColor}` : "none",
            boxShadow: shadowMap[shadow], cursor, transition: "all 0.25s ease",
          }}>{selElement.label||"요소"}</button>
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 0 }}>
        <SelectInput label="폰트 패밀리" value={fontFamily} options={FONTS} onChange={setFontFamily} fontPreview={fontFamily} />
        <div style={{ height: T.gap }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.gap }}>
          <ComboInput label="크기" value={fontSize} unit="px" options={[10,11,12,13,14,16,18,20,24,28,32,36,40,48,56,64,72]} onChange={setFontSize} />
          <ComboInput label="굵기" value={fontWeight} options={["100","200","300","400","500","600","700","800","900"]} onChange={setFontWeight} />
        </div>
        <div style={{ height: T.gap }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.gap }}>
          <ComboInput label="행간" value={lineHeight} options={[0.8,0.9,1,1.1,1.2,1.3,1.4,1.5,1.6,1.8,2]} onChange={setLineHeight} />
          <ComboInput label="자간" value={letterSpacing} unit="px" options={[-1,-0.5,0,0.3,0.5,0.6,0.8,1,1.2,1.5,2,3]} onChange={setLetterSpacing} />
        </div>
        <div style={{ height: T.gap }} />
        <SegmentControl label="정렬" options={[{ key: "left", label: "좌" }, { key: "center", label: "중" }, { key: "right", label: "우" }]} value={textAlign} onChange={setTextAlign} />
        <Divider />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.gap }}>
          <ColorInput label="글자색" value={textColor} onChange={setTextColor} />
          <ColorInput label="배경색" value={bgColor} onChange={setBgColor} />
        </div>
        <Divider />
        <CSSBoxModel margin={margin} setMargin={setMargin} padding={padding} setPadding={setPadding} />
        <Divider />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.gap }}>
          <ComboInput label="간격 (gap)" value={gap} unit="px" options={[0,2,4,6,8,10,12,16,20,24,32]} onChange={setGap} />
          <ComboInput label="둥글기" value={radius} unit="px" options={[0,2,4,6,8,10,12,16,20,24,32,9999]} onChange={setRadius} />
        </div>
        <Divider />
        <SegmentControl label="선 스타일" options={["none","solid","dashed","dotted"]} value={borderStyle} onChange={setBorderStyle} />
        {borderStyle !== "none" && (<>
          <div style={{ height: T.gap }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: T.gap }}>
            <SliderInput label="선 두께" value={borderWidth} min={0} max={10} unit="px" onChange={setBorderWidth} />
            <ColorInput label="선 색상" value={borderColor} onChange={setBorderColor} />
          </div>
        </>)}
        <Divider />
        <SliderRow label="opacity" value={opacity} min={0} max={1} step={0.05} onChange={setOpacity} />
        <div style={{ height: T.gap }} />
        <SegmentControl label="box-shadow" options={[{ key: "none", label: "없음" },{ key: "약한", label: "약한" },{ key: "중간", label: "중간" },{ key: "강한", label: "강한" }]} value={shadow} onChange={setShadow} />
        <div style={{ height: T.gap }} />
        <SelectInput label="cursor" value={cursor} options={["default","pointer","crosshair","move","text","wait","help","not-allowed","grab"]} onChange={setCursor} />
      </div>
    </div>
  );
}


const DEFAULT_PROJECTS=[
  {id:1,name:"메인 대시보드",emoji:"🏠",color:"#34C759",time:"3분 전",status:"서비스",pages:5,states:3},
  {id:2,name:"로그인",emoji:"🔑",color:"#5856D6",time:"1시간 전",status:"서비스",pages:2,states:1},
  {id:3,name:"운동 기록",emoji:"💪",color:"#FF9500",time:"어제",status:"서비스",pages:4,states:2},
  {id:4,name:"온보딩",emoji:"🚀",color:"#007AFF",time:"2일 전",status:"시안",pages:3,states:0},
  {id:5,name:"설정",emoji:"⚙️",color:"#8E8E93",time:"3일 전",status:"시안",pages:2,states:1},
];
const PAGES=[{id:"p1",name:"P1 홈",emoji:"🏠"},{id:"p2",name:"P2 로그인",emoji:"🔑"},{id:"p3",name:"P3 운동기록",emoji:"💪"}];
const STATES=[{id:"s1",name:"S1 로그인 모달",emoji:"🔐",page:"p2"},{id:"s2",name:"S2 필터 드로어",emoji:"🔽",page:"p3"}];
const STUDIO_ITEMS={
  "원자":[{n:"Primary 버튼",emoji:"🔵"},{n:"Secondary 버튼",emoji:"⚪"},{n:"Ghost 버튼",emoji:"👻"},{n:"텍스트 인풋",emoji:"📝"},{n:"패스워드 인풋",emoji:"🔑"},{n:"토글 스위치",emoji:"🔘"},{n:"체크박스",emoji:"☑️"},{n:"뱃지",emoji:"🏷️"},{n:"칩",emoji:"💊"},{n:"아이콘 버튼",emoji:"⭕"}],
  "블록":[{n:"로그인 폼",emoji:"🔐"},{n:"상품 카드",emoji:"🃏"},{n:"검색바",emoji:"🔍"},{n:"상단 헤더",emoji:"📱"},{n:"하단 탭바",emoji:"📋"},{n:"확인 모달",emoji:"💬"},{n:"필터 드로어",emoji:"🔽"},{n:"토스트 알림",emoji:"🔔"},{n:"바텀시트",emoji:"📄"}],
  "섹션":[{n:"히어로 섹션",emoji:"🦸"},{n:"카드 그리드 (4열)",emoji:"📊"},{n:"가격표 섹션",emoji:"💰"},{n:"CTA 블록",emoji:"📣"},{n:"글쓰기 양식",emoji:"✏️"},{n:"후기 목록",emoji:"⭐"},{n:"FAQ 아코디언",emoji:"❓"}],
  "페이지":[{n:"로그인 페이지",emoji:"🔑"},{n:"대시보드",emoji:"📊"},{n:"설정 페이지",emoji:"⚙️"},{n:"온보딩 플로우",emoji:"🚀"},{n:"404 에러",emoji:"🚫"},{n:"검색 결과",emoji:"🔍"},{n:"프로필",emoji:"👤"}],
};
const APIS=[
  {name:"운동 기록",method:"GET",ep:"/api/exercises",s:"연결됨",sc:"g"},
  {name:"사용자 인증",method:"POST",ep:"/api/auth/login",s:"연결됨",sc:"g"},
  {name:"운동 저장",method:"POST",ep:"/api/exercises",s:"테스트중",sc:"o"},
  {name:"알림",method:"POST",ep:"/api/notifications",s:"미연결",sc:"r"},
];
const AGENTS=[
  {name:"구조 분석",st:"🟢",desc:"구조 분석 및 개선 제안",last:"15분 전",result:"P2에 빈 상태 누락"},
  {name:"수집",st:"🟡",desc:"외부 자료 수집",last:"2시간 전",result:"참고 UI 3건"},
  {name:"문서화",st:"🟢",desc:"변경→문서 반영",last:"5분 전",result:"명세서 반영"},
  {name:"디버깅",st:"🔴",desc:"에러 감지",last:"1분 전",result:"타임아웃 3건"},
];
const RULES_ALL=[
  {cat:"디자인 원칙",items:[{t:"명확성, 일관성, 피드백 제공",ex:"HIG 상위 원칙",tags:["디자인 원칙"]},{t:"콘텐츠 우선, UI는 보조",ex:"Deference",tags:["디자인 원칙"]}]},
  {cat:"시각 규칙",items:[{t:"Primary는 CTA에만",ex:"보조는 Secondary",tags:["시각 규칙","컬러"]},{t:"본문 13px / 캡션 11px",ex:"SF Pro 기준",tags:["시각 규칙","타이포"]},{t:"간격 8px 단위",ex:"4,8,12,16,24,32",tags:["시각 규칙","스페이싱"]},{t:"카드 라운드 10px",ex:"모서리 통일",tags:["시각 규칙","라운드"]}]},
  {cat:"인터랙션 규칙",items:[{t:"열림 200ms / 닫힘 150ms",ex:"모달, 드로어",tags:["인터랙션 규칙","트랜지션"]},{t:"로딩 시 스켈레톤",ex:"shimmer",tags:["인터랙션 규칙","로딩"]},{t:"에러 시 인라인+토스트",ex:"빨간 텍스트",tags:["인터랙션 규칙","에러"]}]},
  {cat:"레이아웃 규칙",items:[{t:"반응형 브레이크포인트",ex:"360/768/1024/1440",tags:["레이아웃 규칙"]},{t:"모달 최대 560px",ex:"바텀시트 100%",tags:["레이아웃 규칙","모달"]}]},
  {cat:"네이밍 규칙",items:[{t:"컴포넌트: PascalCase",ex:"LoginForm",tags:["네이밍 규칙"]},{t:"파일: kebab-case",ex:"login-form.jsx",tags:["네이밍 규칙"]},{t:"버튼 라벨: 동사형",ex:"저장하기 (O)",tags:["네이밍 규칙"]}]},
  {cat:"접근성 규칙",items:[{t:"최소 터치 44px",ex:"버튼, 링크",tags:["접근성 규칙"]},{t:"색상 대비 4.5:1",ex:"WCAG AA",tags:["접근성 규칙"]}]},
  {cat:"API 연동 규칙",items:[{t:"GET 시 스켈레톤",ex:"로딩 필수",tags:["API 연동 규칙"]},{t:"타임아웃 5초",ex:"재시도 1회",tags:["API 연동 규칙"]},{t:"폼 제출 중 비활성+스피너",ex:"중복 방지",tags:["API 연동 규칙"]}]},
  {cat:"프롬프트 md",items:[{t:"AI 컨텍스트 문서",ex:"프로젝트 구조 설명",tags:["프롬프트 md"]},{t:"작업 지시서",ex:"MIGRATION_PROMPT.md",tags:["프롬프트 md"]}]},
];
const RULE_CATS=["전체","디자인 원칙","시각 규칙","인터랙션 규칙","레이아웃 규칙","네이밍 규칙","접근성 규칙","API 연동 규칙","프롬프트 md"];
const COLLECT_DATA={
  "파운데이션":[{n:"Dribbble 컬러 참고",t:"URL",emoji:"🎨"},{n:"Material 3 토큰",t:"URL",emoji:"🎨"}],
  "비주얼 에셋":[{n:"무료 아이콘팩 v3",t:"ZIP",emoji:"📦"},{n:"운동 앱 UI 캡처",t:"스크린샷",emoji:"📸"},{n:"애니메이션 팩",t:"JSON",emoji:"✨"}],
  "원자":[{n:"Glassmorphism 버튼",t:"CodePen",emoji:"🔵"},{n:"커스텀 슬라이더",t:"코드",emoji:"🎚️"}],
  "블록":[{n:"Strava 피드 캡처",t:"PNG",emoji:"📱"},{n:"운동 기록 카드 UI",t:"스크린샷",emoji:"💪"}],
  "섹션":[{n:"Nike 히어로 참고",t:"URL",emoji:"🦸"}],
  "페이지":[],
};

// Actual page HTML - these simulate user-built pages rendered in preview
const PAGE_HTML={
  p1:`<div style="font-family:Pretendard,-apple-system,sans-serif;background:#fff;min-height:667px;color:#1d1d1f">
    <div style="display:flex;align-items:center;justify-content:space-around;padding:14px 20px;border-bottom:1px solid #eee;font-size:13px;font-weight:500;color:#6e6e73">
      <span style="color:#007AFF;font-weight:600">🏠 홈</span><span>📊 대시보드</span><span>💪 운동</span><span>👤 프로필</span>
    </div>
    <div style="padding:24px 20px;background:linear-gradient(135deg,#007AFF12,#5856D608)">
      <div style="font-size:22px;font-weight:700;margin-bottom:6px">오늘의 운동 💪</div>
      <div style="font-size:13px;color:#6e6e73;margin-bottom:16px">3월 28일 토요일</div>
      <div style="display:flex;gap:12px">
        <div style="flex:1;background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06)"><div style="font-size:24px;font-weight:700;color:#007AFF">1,240</div><div style="font-size:11px;color:#aeaeb2">칼로리 소모</div></div>
        <div style="flex:1;background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06)"><div style="font-size:24px;font-weight:700;color:#34C759">45</div><div style="font-size:11px;color:#aeaeb2">분 운동</div></div>
      </div>
    </div>
    <div style="padding:20px">
      <div style="font-size:15px;font-weight:600;margin-bottom:12px">오늘 운동 기록</div>
      <div style="background:#f5f5f7;border-radius:12px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:10px;background:#007AFF15;display:flex;align-items:center;justify-content:center;font-size:18px">🏋️</div>
        <div style="flex:1"><div style="font-size:14px;font-weight:600">벤치프레스</div><div style="font-size:11px;color:#aeaeb2">3세트 × 10회 × 60kg</div></div>
        <div style="font-size:11px;color:#34C759;font-weight:600">완료</div>
      </div>
      <div style="background:#f5f5f7;border-radius:12px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:10px;background:#FF950015;display:flex;align-items:center;justify-content:center;font-size:18px">🦵</div>
        <div style="flex:1"><div style="font-size:14px;font-weight:600">스쿼트</div><div style="font-size:11px;color:#aeaeb2">4세트 × 8회 × 80kg</div></div>
        <div style="font-size:11px;color:#FF9500;font-weight:600">진행중</div>
      </div>
      <div style="background:#f5f5f7;border-radius:12px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:10px;background:#5856D615;display:flex;align-items:center;justify-content:center;font-size:18px">💪</div>
        <div style="flex:1"><div style="font-size:14px;font-weight:600">데드리프트</div><div style="font-size:11px;color:#aeaeb2">3세트 × 5회 × 100kg</div></div>
        <div style="font-size:11px;color:#aeaeb2">대기</div>
      </div>
      <button style="width:100%;padding:14px;border-radius:12px;border:none;background:#007AFF;color:#fff;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px;font-family:inherit">운동 시작하기</button>
    </div>
    <div style="padding:12px 20px;text-align:center;font-size:11px;color:#aeaeb2;border-top:1px solid #eee">© 2026 FitTrack</div>
  </div>`,
  p2:`<div style="font-family:Pretendard,-apple-system,sans-serif;background:#fff;min-height:667px;color:#1d1d1f;display:flex;flex-direction:column">
    <div style="padding:14px 20px;border-bottom:1px solid #eee;font-size:13px;color:#6e6e73">◀ 뒤로</div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 24px">
      <div style="text-align:center;margin-bottom:32px"><div style="font-size:32px;margin-bottom:8px">💪</div><div style="font-size:22px;font-weight:700">FitTrack</div><div style="font-size:13px;color:#aeaeb2;margin-top:4px">운동을 기록하고 성장하세요</div></div>
      <input style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid #e8e8ed;font-size:14px;margin-bottom:10px;outline:none;box-sizing:border-box;font-family:inherit" placeholder="📧 이메일" value="user@fittrack.com"/>
      <input style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid #e8e8ed;font-size:14px;margin-bottom:16px;outline:none;box-sizing:border-box;font-family:inherit" type="password" placeholder="🔑 비밀번호" value="••••••••"/>
      <button style="width:100%;padding:14px;border-radius:12px;border:none;background:#007AFF;color:#fff;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">로그인</button>
      <div style="text-align:center;margin-top:16px;font-size:13px"><span style="color:#007AFF;cursor:pointer">회원가입</span><span style="color:#aeaeb2"> · </span><span style="color:#007AFF;cursor:pointer">비밀번호 찾기</span></div>
    </div>
  </div>`,
  p3:`<div style="font-family:Pretendard,-apple-system,sans-serif;background:#fff;min-height:667px;color:#1d1d1f">
    <div style="padding:14px 20px;border-bottom:1px solid #eee;font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px">💪 운동 기록<span style="margin-left:auto;font-size:12px;color:#007AFF;font-weight:500">편집</span></div>
    <div style="padding:12px 20px"><input style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #e8e8ed;font-size:13px;outline:none;background:#f5f5f7;box-sizing:border-box;font-family:inherit" placeholder="🔍 운동 검색..."/></div>
    <div style="padding:0 20px">
      <div style="background:#fff;border:1px solid #e8e8ed;border-radius:12px;padding:16px;margin-bottom:8px"><div style="display:flex;align-items:center;gap:10px"><div style="font-size:18px">🏋️</div><div style="flex:1"><div style="font-size:14px;font-weight:600">벤치프레스</div><div style="font-size:12px;color:#aeaeb2">3세트 × 10회 × 60kg</div></div><div style="font-size:12px;padding:4px 10px;border-radius:6px;background:#34C75915;color:#34C759;font-weight:600">완료</div></div></div>
      <div style="background:#fff;border:1px solid #e8e8ed;border-radius:12px;padding:16px;margin-bottom:8px"><div style="display:flex;align-items:center;gap:10px"><div style="font-size:18px">🦵</div><div style="flex:1"><div style="font-size:14px;font-weight:600">스쿼트</div><div style="font-size:12px;color:#aeaeb2">4세트 × 8회 × 80kg</div></div><div style="font-size:12px;padding:4px 10px;border-radius:6px;background:#FF950015;color:#FF9500;font-weight:600">진행중</div></div></div>
      <div style="background:#fff;border:1px solid #e8e8ed;border-radius:12px;padding:16px;margin-bottom:8px"><div style="display:flex;align-items:center;gap:10px"><div style="font-size:18px">💪</div><div style="flex:1"><div style="font-size:14px;font-weight:600">데드리프트</div><div style="font-size:12px;color:#aeaeb2">3세트 × 5회 × 100kg</div></div><div style="font-size:12px;padding:4px 10px;border-radius:6px;background:#f5f5f7;color:#aeaeb2;font-weight:600">대기</div></div></div>
      <button style="width:100%;padding:14px;border-radius:12px;border:none;background:#007AFF;color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;font-family:inherit">+ 운동 추가</button>
    </div>
  </div>`,
};
// Auto-parse HTML into aria regions by semantic tags
const SEMANTIC_TAGS=["nav","header","main","section","article","aside","footer","form","search"];
const TAG_ROLES={nav:"navigation",header:"banner",main:"main",section:"region",article:"article",aside:"complementary",footer:"contentinfo",form:"form",search:"search"};

function parseAriaRegions(html){
  if(!html)return[];
  const parser=new DOMParser();
  const doc=parser.parseFromString(html,"text/html");
  const root=doc.body.firstElementChild||doc.body;
  const regions=[];
  const visited=new Set();

  // 1차: 시맨틱 태그 + role 속성 기반 탐색
  function walk(el){
    if(!el||!el.tagName)return;
    const tag=el.tagName.toLowerCase();
    const role=el.getAttribute("role");
    const ariaLabel=el.getAttribute("aria-label")||el.getAttribute("aria-labelledby")||"";
    const isSemantic=SEMANTIC_TAGS.includes(tag);
    const hasRole=role&&role.length>0;

    if(isSemantic||hasRole){
      visited.add(el);
      regions.push({
        role:hasRole?role:(TAG_ROLES[tag]||tag),
        label:ariaLabel||guessLabel(el,tag),
        tag:tag,
        html:el.outerHTML
      });
      return; // 하위는 이 블록에 포함됨
    }
    for(const child of el.children)walk(child);
  }

  walk(root);

  // 2차: 시맨틱 태그 없으면 최상위 children을 각각 영역으로 분리
  if(regions.length===0){
    const children=root.children;
    for(let i=0;i<children.length;i++){
      const child=children[i];
      const tag=child.tagName.toLowerCase();
      // 역할 추론
      let role="region";
      const text=(child.textContent||"").trim().slice(0,30);
      if(tag==="button"||child.querySelector("button"))role="button";
      else if(tag==="input"||child.querySelector("input"))role="form";
      else if(child.querySelector("a"))role="navigation";
      else if(i===0)role="banner";
      else if(i===children.length-1&&text.length<50)role="contentinfo";

      regions.push({
        role:role,
        label:guessLabel(child,tag),
        tag:tag,
        html:child.outerHTML
      });
    }
  }

  return regions;
}

function guessLabel(el,tag){
  const headings=el.querySelectorAll("h1,h2,h3,h4,h5,h6");
  if(headings.length>0)return headings[0].textContent.trim().slice(0,30);
  const buttons=el.querySelectorAll("button");
  if(tag==="button"||(buttons.length===1&&el.children.length<=2))return(buttons[0]||el).textContent.trim().slice(0,30);
  const inputs=el.querySelectorAll("input,textarea,select");
  if(inputs.length>0)return`폼 영역 (${inputs.length}개 입력)`;
  const links=el.querySelectorAll("a");
  if(links.length>1)return`링크 ${links.length}개`;
  const text=(el.textContent||"").trim();
  if(text.length<=30)return text||tag;
  return text.slice(0,25)+"…";
}

// Parse micro-elements from HTML — comprehensive detection
function parseMicroElements(html){
  if(!html)return[];
  const parser=new DOMParser();
  const doc=parser.parseFromString(html,"text/html");
  const els=[];
  const visited=new Set();
  function add(el,type,icon){
    if(visited.has(el))return;
    visited.add(el);
    const label=(el.getAttribute("aria-label")||el.getAttribute("placeholder")||el.getAttribute("alt")||el.textContent||"").trim().slice(0,25)||type;
    els.push({type,icon,label,html:el.outerHTML,tag:el.tagName.toLowerCase()});
  }
  function gs(el){return(el.getAttribute("style")||"").toLowerCase()}

  // 1. Buttons
  doc.body.querySelectorAll("button,[role='button']").forEach(el=>add(el,"버튼","🔘"));
  // 2. Inputs
  doc.body.querySelectorAll("input,textarea,select").forEach(el=>add(el,"입력","📝"));
  // 3. Links
  doc.body.querySelectorAll("a[href]").forEach(el=>add(el,"링크","🔗"));
  // 4. Images
  doc.body.querySelectorAll("img").forEach(el=>add(el,"이미지","🖼️"));
  // 5. SVGs
  doc.body.querySelectorAll("svg").forEach(el=>add(el,"SVG 아이콘","✨"));
  // 6. Headings
  doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(el=>add(el,"제목","📌"));
  // 7. Lists
  doc.body.querySelectorAll("ul,ol").forEach(el=>add(el,"리스트","📋"));
  doc.body.querySelectorAll("li").forEach(el=>{if(!visited.has(el))add(el,"리스트 아이템","▪️")});
  // 8. Tables
  doc.body.querySelectorAll("table").forEach(el=>add(el,"테이블","📊"));
  // 9. Figure/blockquote/details
  doc.body.querySelectorAll("figure").forEach(el=>add(el,"미디어 블록","🎞️"));
  doc.body.querySelectorAll("blockquote").forEach(el=>add(el,"인용 블록","💬"));
  doc.body.querySelectorAll("details").forEach(el=>add(el,"아코디언","📂"));
  doc.body.querySelectorAll("fieldset").forEach(el=>add(el,"폼 그룹","📝"));

  // 10. Style-based div detection
  doc.body.querySelectorAll("div,span,section,article,aside").forEach(el=>{
    if(visited.has(el))return;
    const s=gs(el);const t=(el.textContent||"").trim();const cc=el.children.length;
    // Avatar — border-radius:50% or very round + fixed width=height
    if(s.includes("border-radius:50%")||(s.includes("border-radius:10px")&&s.match(/width:\s*\d+px/)&&s.match(/height:\s*\d+px/))){
      const wm=s.match(/width:\s*(\d+)px/);const hm=s.match(/height:\s*(\d+)px/);
      if(wm&&hm&&wm[1]===hm[1]){add(el,"아바타","👤");return}
    }
    // Modal/Overlay — position:fixed/absolute + z-index + background rgba
    if((s.includes("position:fixed")||s.includes("position:absolute"))&&s.includes("z-index")&&s.includes("rgba")){add(el,"모달/오버레이","💬");return}
    // Banner — background gradient or background-image + large
    if((s.includes("linear-gradient")||s.includes("background-image"))&&cc>0&&t.length>10){add(el,"배너","🎨");return}
    // Card — border-radius + (box-shadow or border) + children + text
    if(s.includes("border-radius")&&(s.includes("box-shadow")||s.match(/border:\s*1px/))&&cc>0&&t.length>5){
      let parentCard=false;let p=el.parentElement;
      while(p){if(visited.has(p)){parentCard=true;break}p=p.parentElement}
      if(!parentCard){add(el,"카드","🃏");return}
    }
    // Nav bar — display:flex + space-around/space-between + children are text
    if(s.includes("display:flex")&&(s.includes("space-around")||s.includes("space-between"))&&cc>=3){
      const allText=[...el.children].every(c=>c.children.length===0||(c.textContent||"").trim().length<15);
      if(allText){add(el,"내비게이션","🧭");return}
    }
    // Layout container — display:flex or grid + padding + multiple children
    if((s.includes("display:flex")||s.includes("display:grid"))&&s.includes("gap")&&cc>=2){
      let parentCard=false;let p=el.parentElement;
      while(p){if(visited.has(p)){parentCard=true;break}p=p.parentElement}
      if(!parentCard){add(el,"레이아웃 박스","📦");return}
    }
    // Badge — short text + border-radius + background/color
    if(t.length>0&&t.length<=10&&s.includes("border-radius")&&(s.includes("background:")||s.includes("background:#"))&&cc===0){
      add(el,"뱃지","🏷️");return;
    }
    // Emoji icon — emoji only, 1-3 chars
    if(t.length<=3&&/\p{Emoji}/u.test(t)&&cc===0){add(el,"이모지","😀");return}
    // Text block — font-weight bold + font-size defined
    if((s.includes("font-weight:700")||s.includes("font-weight:600"))&&s.includes("font-size:")&&cc===0&&t.length>0&&t.length<=40){
      add(el,"텍스트","📝");return;
    }
    // Separator — border-top/bottom only, no children, thin
    if((s.includes("border-bottom")||s.includes("border-top"))&&cc===0&&t.length===0){
      add(el,"구분선","➖");return;
    }
  });

  // 11. Repeated sibling pattern → list items
  doc.body.querySelectorAll("div").forEach(parent=>{
    if(visited.has(parent))return;
    const kids=[...parent.children].filter(c=>c.tagName==="DIV");
    if(kids.length>=3){
      const firstTag=kids[0].innerHTML.length;
      const similar=kids.filter(k=>Math.abs(k.innerHTML.length-firstTag)<firstTag*0.5);
      if(similar.length>=3){
        similar.forEach(k=>{if(!visited.has(k))add(k,"리스트 아이템","▪️")});
      }
    }
  });

  return els;
}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@300;400;500;600;700&display=swap');
.light{--bg:#fff;--bg1:#f5f5f7;--bg2:#fff;--bg3:#f5f5f7;--bg4:#e8e8ed;--glass:rgba(245,245,247,.82);--sep:rgba(0,0,0,.08);--sep2:rgba(0,0,0,.12);--t1:#1d1d1f;--t2:#6e6e73;--t3:#aeaeb2;--blue:#007AFF;--green:#34C759;--orange:#FF9500;--red:#FF3B30;--purple:#5856D6;--cyan:#5AC8FA;--sbact:rgba(0,122,255,.1);--cardbg:rgba(255,255,255,.9);--cardh:rgba(0,0,0,.03);--pvbg:#f0f0f5;--elbg:#fff;--elbdr:rgba(0,0,0,.06);--btnbg:#007AFF;--inputbg:rgba(0,0,0,.04);--lockbg:rgba(245,245,247,.55)}
.dark{--bg:#000;--bg1:#0a0a0a;--bg2:#1c1c1e;--bg3:#2c2c2e;--bg4:#3a3a3c;--glass:rgba(28,28,30,.75);--sep:rgba(84,84,88,.36);--sep2:rgba(84,84,88,.65);--t1:#f5f5f7;--t2:#a1a1a6;--t3:#6e6e73;--blue:#0A84FF;--green:#30D158;--orange:#FF9F0A;--red:#FF453A;--purple:#5E5CE6;--cyan:#64D2FF;--sbact:rgba(10,132,255,.18);--cardbg:rgba(44,44,46,.65);--cardh:rgba(255,255,255,.04);--pvbg:#111113;--elbg:#1c1c1e;--elbdr:rgba(84,84,88,.36);--btnbg:#0A84FF;--inputbg:rgba(255,255,255,.06);--lockbg:rgba(0,0,0,.55)}
*{margin:0;padding:0;box-sizing:border-box}
.app{font-family:'Pretendard',-apple-system,sans-serif;background:var(--bg);color:var(--t1);height:100vh;display:flex;overflow:hidden;font-size:14px;-webkit-font-smoothing:antialiased;transition:background .3s,color .3s}

/* Sidebar */
.sb{width:252px;background:var(--glass);backdrop-filter:blur(40px) saturate(180%);border-right:1px solid var(--sep);display:flex;flex-direction:column;flex-shrink:0}
.sb-h{padding:14px 14px 10px;display:flex;align-items:center;justify-content:space-between}
.sb-logo{font-size:14px;font-weight:700;letter-spacing:-.02em;cursor:pointer}
.sb-tb{width:30px;height:30px;border-radius:8px;border:none;background:none;color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.sb-tb:hover{background:var(--cardh);color:var(--t1)}
.sb-sr{margin:0 10px 8px;position:relative}
.sb-sr input{width:100%;padding:7px 12px 7px 30px;border-radius:8px;border:none;background:var(--bg4);color:var(--t1);font-size:13px;font-family:inherit;outline:none}
.sb-sr input:focus{box-shadow:0 0 0 2px var(--blue)}
.sb-sr input::placeholder{color:var(--t3)}
.sb-sr svg{position:absolute;left:9px;top:8px;color:var(--t3)}
.sb-s{padding:4px 8px;flex:1;overflow-y:auto}
.sb-s::-webkit-scrollbar{width:4px}
.sb-s::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px}
.sb-lb{font-size:10px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;padding:10px 10px 4px}
.sb-i{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;color:var(--t2);transition:.15s;margin-bottom:1px;min-height:34px}
.sb-i:hover{background:var(--cardh);color:var(--t1)}
.sb-i.on{background:var(--sbact);color:var(--blue);font-weight:600}
.sb-i .ic{font-size:15px;width:20px;text-align:center;flex-shrink:0}
.sb-i .bd{margin-left:auto;font-size:10px;font-weight:600;background:var(--blue);color:#fff;padding:1px 6px;border-radius:8px}
.sb-i.sub{padding-left:32px;font-size:12px;min-height:30px}
.sb-dv{height:1px;background:var(--sep);margin:6px 10px}
.sb-ft{padding:8px;border-top:1px solid var(--sep)}

/* Main */
.mn{flex:1;display:flex;flex-direction:column;overflow:hidden}
.toolbar{height:48px;background:var(--glass);backdrop-filter:blur(40px) saturate(180%);border-bottom:1px solid var(--sep);display:flex;align-items:center;padding:0 16px;gap:8px;flex-shrink:0}
.tb-t{font-size:16px;font-weight:600;letter-spacing:-.02em}
.tb-sp{flex:1}
.btn{padding:5px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;border:none;background:none;color:var(--t2);display:flex;align-items:center;gap:5px;transition:.15s;font-family:inherit;min-height:30px}
.btn:hover{background:var(--cardh);color:var(--t1)}
.btn.pr{background:var(--blue);color:#fff}
.btn.pr:hover{filter:brightness(1.1)}
.ct{flex:1;overflow-y:auto;padding:20px 24px 32px}
.ct::-webkit-scrollbar{width:5px}
.ct::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:3px}

/* Chips */
.fl{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
.ch{padding:5px 14px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid var(--sep2);background:none;color:var(--t2);cursor:pointer;transition:.15s;font-family:inherit}
.ch:hover{background:var(--cardh);color:var(--t1)}
.ch.on{background:var(--blue);border-color:var(--blue);color:#fff}
.st{font-size:12px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px}
.ss{display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap}
.ssi{padding:5px 13px;border-radius:20px;font-size:11px;font-weight:500;color:var(--t3);cursor:pointer;border:1px solid transparent;background:none;transition:.15s;font-family:inherit}
.ssi:hover{color:var(--t2);background:var(--cardh)}
.ssi.on{color:var(--blue);border-color:var(--blue);background:rgba(0,122,255,.08)}

/* Grid & cards */
.gr{display:grid;gap:14px;margin-bottom:24px}
.g4{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.g5{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.g6{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.cd{background:var(--cardbg);backdrop-filter:blur(20px);border:1px solid var(--sep);border-radius:14px;overflow:hidden;cursor:pointer;transition:.25s}
.cd:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.12);border-color:var(--sep2)}
.cd-pv{height:100px;display:flex;align-items:center;justify-content:center;font-size:28px;position:relative}
.cd-bg{position:absolute;top:8px;right:8px;padding:2px 8px;border-radius:5px;font-size:9px;font-weight:600;backdrop-filter:blur(8px)}
.cd-i{padding:10px 12px 8px}
.cd-n{font-size:13px;font-weight:600;margin-bottom:1px}
.cd-s{font-size:10px;color:var(--t3)}
.cd-a{display:flex;gap:4px;padding:4px 12px 10px}
.cb{padding:4px 11px;border-radius:6px;font-size:11px;font-weight:500;border:1px solid var(--sep2);background:none;color:var(--t2);cursor:pointer;transition:.15s;font-family:inherit}
.cb:hover{border-color:var(--blue);color:var(--blue)}
.pt2{height:150px;display:flex;align-items:center;justify-content:center;font-size:36px;position:relative}
.ps2{position:absolute;top:10px;right:10px;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;backdrop-filter:blur(8px)}
.pn2{font-size:14px;font-weight:600;padding:0 14px 2px}
.pm2{font-size:11px;color:var(--t3);padding:0 14px 12px}
.ac{border:1px dashed var(--sep2);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:.2s;min-height:140px;color:var(--t3);font-size:12px}
.ac:hover{border-color:var(--blue);color:var(--blue);background:rgba(0,122,255,.04)}
.li{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;transition:.15s;margin-bottom:2px;min-height:40px}
.li:hover{background:var(--cardh)}
.ld{width:7px;height:7px;border-radius:4px;flex-shrink:0}
.rc{background:var(--cardbg);backdrop-filter:blur(20px);border:1px solid var(--sep);border-radius:12px;padding:14px 16px;margin-bottom:8px}
.ri{font-size:13px;color:var(--t2);padding:5px 0;border-bottom:1px solid var(--sep);display:flex;align-items:center;gap:7px;min-height:30px}
.ri:last-child{border:none}
.ag{background:var(--cardbg);backdrop-filter:blur(20px);border:1px solid var(--sep);border-radius:14px;padding:16px;transition:.15s}
.ag:hover{border-color:var(--sep2)}
.ar{background:var(--cardbg);backdrop-filter:blur(20px);border:1px solid var(--sep);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;transition:.15s;cursor:pointer;margin-bottom:6px}
.ar:hover{border-color:var(--sep2)}
.am2{padding:3px 9px;border-radius:6px;font-size:10px;font-weight:700;font-family:monospace}
.ae2{font-family:monospace;font-size:11px;color:var(--t2)}
.ad2{width:6px;height:6px;border-radius:3px;margin-left:auto}
.sc2{background:var(--cardbg);backdrop-filter:blur(20px);border:1px solid var(--sep);border-radius:12px;padding:14px;text-align:center}
.sv2{font-size:22px;font-weight:700}
.sl3{font-size:11px;color:var(--t3);margin-top:3px}
.tr2{display:flex;align-items:center;gap:8px;margin-bottom:6px;min-height:32px}
.ts2{width:24px;height:24px;border-radius:6px;border:1px solid var(--sep)}
.tn2{font-size:11px;color:var(--t2);font-family:monospace;min-width:110px}
.tv2{font-size:11px;color:var(--t3);font-family:monospace}
.cc{background:var(--cardbg);backdrop-filter:blur(20px);border:1px solid var(--sep);border-radius:14px;overflow:hidden;cursor:pointer;transition:.25s;position:relative}
.cc:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.1)}
.cc-pv{height:90px;display:flex;align-items:center;justify-content:center;font-size:28px;background:linear-gradient(135deg,rgba(255,159,10,.08),rgba(255,159,10,.02))}
.cc-i{padding:10px 12px 6px}
.cc-n{font-size:12px;font-weight:600;margin-bottom:2px}
.cc-t{font-size:10px;color:var(--t3)}
.cc-a{padding:4px 12px 10px}
.cc-badge{position:absolute;top:6px;right:6px;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:600;background:var(--orange);color:#fff}

/* ═══ EDITOR ═══ */
.ed{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
.ed-bar{height:48px;background:var(--glass);backdrop-filter:blur(40px) saturate(180%);border-bottom:1px solid var(--sep);display:flex;align-items:center;padding:0 10px;gap:4.5px;flex-shrink:0;overflow-x:auto;overflow-y:hidden;white-space:nowrap}
.ed-bar::-webkit-scrollbar{height:0}
.ed-body{flex:1;display:flex;overflow:hidden;min-height:0}
.ed-btn{width:32px;height:32px;border-radius:8px;border:none;background:none;color:var(--t1);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s;flex-shrink:0}
.ed-btn:hover{background:var(--cardh);color:var(--t1)}
.ed-sep{width:1px;height:20px;background:var(--sep);margin:0 3px;flex-shrink:0}
.ed-name{font-size:15px;font-weight:600;margin:0 6px;flex-shrink:0;white-space:nowrap}

/* Preview panel */
.pv{display:flex;flex-direction:column;overflow:hidden;position:relative;background:var(--pvbg);flex-shrink:0;min-width:435px}
.pv-frame{flex:1;cursor:pointer;position:relative;overflow:auto;display:flex;align-items:center;justify-content:center}
.pv-frame::-webkit-scrollbar{width:4px}
.pv-frame::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px}
.pv-full{width:100%;background:var(--bg2);position:relative}
.pv-render{width:100%;overflow:hidden;position:relative}
.pv-render>div{width:100%!important;min-height:auto!important}

/* State overlay on preview — fills entire preview, layer centered */
.pv-state-bg{position:absolute;inset:0;z-index:3;background:var(--lockbg);pointer-events:none}
.pv-state-layer{position:absolute;z-index:4;left:10%;right:10%;top:15%;background:var(--bg2);border:2px solid var(--purple);border-radius:14px;box-shadow:0 12px 48px rgba(88,86,214,.25);cursor:move;overflow:hidden}
.pv-state-head{padding:10px 14px;background:var(--cardbg);border-bottom:1px solid var(--sep);font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:space-between}
.pv-state-body{padding:16px}
.pv-state-input{width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--sep);background:var(--inputbg);color:var(--t1);font-size:13px;font-family:inherit;outline:none;margin-bottom:10px}
.pv-state-input:focus{border-color:var(--blue)}
.pv-state-btn{width:100%;padding:10px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:6px}
.pv-state-btn.primary{background:var(--blue);color:#fff}
.pv-state-btn.ghost{background:var(--bg4);color:var(--t2)}

/* Page strip — overlays on bottom of preview */
.pv-strip{position:absolute;bottom:0;left:0;right:0;z-index:8;border-top:1px solid var(--sep);background:var(--bg1);overflow-x:auto;display:flex;gap:6px;padding:10px 14px;align-items:center}
.pv-strip::-webkit-scrollbar{height:0}
.pv-thumb{flex-shrink:0;width:120px;height:120px;cursor:pointer;border-radius:10px;border:2px solid transparent;transition:.15s;overflow:hidden;position:relative}
.pv-thumb:hover{border-color:var(--sep2)}
.pv-thumb.on{border-color:var(--blue)}
.pv-thumb-render{width:120px;height:120px;border-radius:8px;background:var(--bg2);overflow:hidden;position:relative}
.pv-thumb-inner{width:375px;height:667px;transform:scale(0.32);transform-origin:top left;pointer-events:none;position:absolute;top:0;left:0}

/* Dropdown for page select */
.ed-dd{padding:4px 8px;border-radius:6px;font-size:12px;font-weight:500;border:1px solid var(--sep);background:var(--bg3);color:var(--t1);font-family:inherit;outline:none;cursor:pointer;min-width:120px;flex-shrink:0}
.ed-dd:focus{border-color:var(--blue)}

/* iPhone 13 Pro — hyper-realistic */
.iphone{width:393px;height:852px;border-radius:52px;background:linear-gradient(165deg,#3a3a3c 0%,#2c2c2e 15%,#1c1c1e 50%,#2c2c2e 85%,#3a3a3c 100%);position:relative;overflow:visible;flex-shrink:0;padding:3px;box-shadow:0 20px 60px rgba(0,0,0,.2),0 0 0 0.5px rgba(100,100,105,.3)}
.iphone::before{content:'';position:absolute;top:115px;right:-2.5px;width:3px;height:30px;background:linear-gradient(180deg,#3a3a3c,#2c2c2e,#3a3a3c);border-radius:0 2px 2px 0;box-shadow:0 48px 0 0 #2c2c2e}
.iphone::after{content:'';position:absolute;top:95px;left:-2.5px;width:3px;height:34px;background:linear-gradient(180deg,#3a3a3c,#2c2c2e,#3a3a3c);border-radius:2px 0 0 2px;box-shadow:0 46px 0 0 #2c2c2e,0 86px 0 0 #2c2c2e}
.iphone-inner{width:100%;height:100%;border-radius:49px;background:#000;overflow:hidden;position:relative;padding:3px;box-shadow:inset 0 0 8px rgba(0,0,0,1)}
.iphone-inner::before{content:'';position:absolute;inset:0;border-radius:49px;border:0.5px solid rgba(255,255,255,.04);pointer-events:none;z-index:20}
.iphone-bezel{width:100%;height:100%;border-radius:46px;overflow:hidden;position:relative}
.iphone-notch{position:absolute;top:0;left:50%;transform:translateX(-50%);width:160px;height:33px;background:#000;border-radius:0 0 22px 22px;z-index:10;display:flex;align-items:center;justify-content:center;gap:12px}
.iphone-notch-speaker{width:56px;height:5px;border-radius:3px;background:#1a1a1e;margin-top:7px;box-shadow:inset 0 0 2px rgba(0,0,0,.8)}
.iphone-notch-cam{width:8px;height:8px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#1e2d4a,#0a0f18);border:1.5px solid #15161a;margin-top:7px;box-shadow:inset 0 0 2px rgba(40,80,160,.15)}
.iphone-screen{position:absolute;inset:0;border-radius:46px;overflow:hidden;display:flex;flex-direction:column;background:#fff}
.iphone-status{height:54px;padding:17px 30px 0;display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:600;color:#000;background:#fff;flex-shrink:0;z-index:5;position:relative;letter-spacing:-.3px;font-family:'Pretendard',-apple-system,sans-serif}
.iphone-status-r{display:flex;align-items:center;gap:4px}
.iphone-bars{display:flex;gap:1.5px;align-items:flex-end}
.iphone-bars span{width:3.5px;border-radius:0.5px;background:#0a0a0a}
.iphone-batt{width:27px;height:13px;border-radius:4px;border:1.5px solid rgba(0,0,0,.85);position:relative;display:flex;align-items:center;padding:2px;margin-left:2px}
.iphone-batt::after{content:'';position:absolute;right:-4px;top:3.5px;width:2px;height:4px;background:rgba(0,0,0,.6);border-radius:0 1px 1px 0}
.iphone-batt-fill{height:100%;border-radius:1.5px;background:#34C759}
.iphone-content{flex:1;overflow-y:auto;overflow-x:hidden;position:relative}
.iphone-content::-webkit-scrollbar{width:0}
.iphone-home{height:34px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#fff}
.iphone-home-bar{width:140px;height:5px;border-radius:3px;background:rgba(0,0,0,.18)}
.pv-phone-wrap{display:flex;align-items:center;justify-content:center;flex:1;padding:40px 20px;overflow:visible}
/* Floating app dark mode toggle */
.pv-dark-btn{position:absolute;top:8px;right:8px;z-index:10;width:32px;height:32px;border-radius:16px;border:1px solid var(--sep);background:var(--cardbg);backdrop-filter:blur(10px);color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
.pv-dark-btn:hover{background:var(--cardh);color:var(--t1);transform:scale(1.1)}

/* Floating design remote */
.dp-remote{position:absolute;top:56px;right:8px;z-index:12;width:280px;background:rgba(255,255,255,.97);backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,.08);border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.08),0 1px 3px rgba(0,0,0,.04);overflow:hidden}
.dp-remote-head{display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:0.5px solid rgba(60,60,67,.1)}
.dp-remote-body{max-height:65vh;overflow-y:auto;-ms-overflow-style:none;scrollbar-width:none}
.dp-remote-body::-webkit-scrollbar{display:none}

/* Micro element strip */
.micro-strip{position:absolute;bottom:0;left:0;right:0;z-index:8;border-top:1px solid var(--sep);background:var(--bg1);overflow-x:auto;display:flex;gap:6px;padding:10px 14px;align-items:center}
.micro-strip::-webkit-scrollbar{height:0}
.micro-chip{flex-shrink:0;padding:6px 12px;border-radius:8px;border:1px solid var(--sep);background:var(--cardbg);cursor:pointer;display:flex;align-items:center;gap:5px;font-size:11px;font-weight:500;color:var(--t2);transition:.15s;white-space:nowrap}
.micro-chip:hover{border-color:var(--blue);color:var(--blue);background:rgba(0,122,255,.04)}
.micro-chip-icon{font-size:13px}
.micro-chip-type{font-size:9px;color:var(--t3);font-family:monospace}

/* Micro popup */
.micro-popup{position:absolute;z-index:15;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg2);border:1px solid var(--sep2);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden;min-width:300px;max-width:90%}
.micro-popup-head{padding:10px 14px;border-bottom:1px solid var(--sep);display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600}
.micro-popup-body{padding:16px;background:#fff;overflow:auto;max-height:300px}
.micro-popup-foot{padding:8px 14px;border-top:1px solid var(--sep);display:flex;gap:4px;justify-content:flex-end}
.micro-popup-overlay{position:absolute;inset:0;z-index:14;background:rgba(0,0,0,.3)}
.pv-mode{display:flex;background:var(--bg4);border-radius:6px;padding:2px;gap:1px;flex-shrink:0}
.pv-mode button{padding:3px 10px;border-radius:4px;font-size:11px;font-weight:500;cursor:pointer;color:var(--t3);border:none;background:none;font-family:inherit;transition:.15s;flex-shrink:0}
.pv-mode button:hover{color:var(--t2)}
.pv-mode button.on{background:var(--bg2);color:var(--t1);box-shadow:0 1px 2px rgba(0,0,0,.1)}
.ed-back{display:flex;align-items:center;gap:4px;padding:4px 12px 4px 8px;border-radius:8px;border:none;background:none;color:var(--blue);cursor:pointer;font-size:13px;font-weight:500;transition:.15s;font-family:inherit;flex-shrink:0;white-space:nowrap}
.ed-back:hover{background:rgba(0,122,255,.08)}

/* Resize handle */
.resize-handle{width:6px;cursor:col-resize;background:transparent;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:background .15s}
.resize-handle:hover{background:var(--sep)}
.resize-handle::after{content:'';width:2px;height:32px;border-radius:1px;background:var(--bg4)}

/* Work panel */
.wp2{display:flex;flex-direction:column;overflow:hidden;border-left:1px solid var(--sep);background:var(--bg1);min-width:320px;flex:1;height:100%}
.wp2-tabs{display:flex;padding:8px 8px 0;gap:2px;border-bottom:1px solid var(--sep);flex-shrink:0;overflow-x:auto}
.wp2-tabs::-webkit-scrollbar{height:0}
.wp2-tab{padding:6px 12px;font-size:11px;font-weight:500;color:var(--t3);cursor:pointer;border:none;background:none;border-radius:8px 8px 0 0;transition:.15s;font-family:inherit;flex-shrink:0;white-space:nowrap}
.wp2-tab:hover{color:var(--t2);background:var(--cardh)}
.wp2-tab.on{color:var(--blue);border-bottom:2px solid var(--blue)}
.wp2-ct{flex:1;overflow-y:auto;padding:12px;min-height:0;background:var(--bg)}
.wp2-ct::-webkit-scrollbar{width:3px}
.wp2-ct::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px}
.wp2-empty{padding:20px 12px;text-align:center;color:var(--t3);font-size:12px}
.wp2-sec{font-size:10px;font-weight:600;color:var(--t3);margin:10px 0 6px;text-transform:uppercase}
.wp2-field{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.wp2-label{font-size:11px;color:var(--t3);min-width:36px;font-weight:500}
.wp2-input{flex:1;padding:4px 8px;border-radius:6px;border:1px solid var(--sep);background:var(--bg3);color:var(--t1);font-size:11px;font-family:monospace;outline:none}
.wp2-input:focus{border-color:var(--blue)}
.cpop-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999}
.cpop{width:520px;max-height:88vh;background:var(--elbg,#fff);border-radius:16px;border:0.5px solid var(--sep);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.15)}
.cpop-hd{padding:14px 20px;border-bottom:0.5px solid var(--sep);display:flex;align-items:center;justify-content:space-between}
.cpop-body{flex:1;padding:20px;overflow-y:auto;-ms-overflow-style:none;scrollbar-width:none}
.cpop-body::-webkit-scrollbar{display:none}
.cpop-ft{padding:12px 20px;border-top:0.5px solid var(--sep);display:flex;align-items:center;justify-content:space-between}
.cpop-sec{font-size:13px;font-weight:600;color:var(--t1);margin-bottom:6px}
.cpop-sub{font-size:11px;color:var(--t3);margin-bottom:8px}
.cpop-tags{display:flex;flex-wrap:wrap;gap:6px}
.cpop-tag{font-size:11px;padding:5px 12px;border-radius:99px;border:0.5px solid var(--sep);color:var(--t2);cursor:pointer;transition:all .15s}
.cpop-tag.on{border-color:var(--blue);background:rgba(0,122,255,.08);color:var(--blue)}
.cpop-card{border:0.5px solid var(--sep);border-radius:14px;padding:12px;cursor:pointer;transition:all .15s;position:relative}
.cpop-card.on{border-color:var(--blue);background:rgba(0,122,255,.06)}
.cpop-card .cpop-chk{position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:5px;border:1.5px solid var(--sep2);display:flex;align-items:center;justify-content:center;transition:all .15s}
.cpop-card.on .cpop-chk{background:var(--blue);border-color:var(--blue)}
.cpop-chip{font-size:11px;padding:2px 8px;border-radius:99px;border:0.5px solid var(--sep);color:var(--t3);cursor:pointer;transition:all .15s}
.cpop-chip.on{border-color:transparent;background:rgba(0,122,255,.1);color:var(--blue)}
.cpop-seg{display:flex;border:0.5px solid var(--sep);border-radius:14px;overflow:hidden}
.cpop-seg-item{flex:1;padding:12px 8px;text-align:center;cursor:pointer;border-right:0.5px solid var(--sep);transition:all .15s}
.cpop-seg-item:last-child{border-right:none}
.cpop-seg-item.on{background:rgba(0,122,255,.06)}
.cpop-seg-item .cpop-chk2{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--sep2);display:inline-flex;align-items:center;justify-content:center;margin-top:6px;transition:all .15s}
.cpop-seg-item.on .cpop-chk2{background:var(--blue);border-color:var(--blue)}
.cpop-sched{display:flex;gap:8px}
.cpop-sched-item{flex:1;border:0.5px solid var(--sep);border-radius:10px;padding:10px 12px;cursor:pointer;text-align:center;transition:all .15s}
.cpop-sched-item.on{border-color:var(--blue);background:rgba(0,122,255,.06)}
.rp{display:flex;flex-direction:column;overflow:hidden;background:var(--elbg);border-left:1px solid var(--sep);flex-shrink:0}
.rp-tabs{display:flex;border-bottom:1px solid var(--sep);flex-shrink:0}
.rp-tab{flex:1;padding:8px 0;text-align:center;font-size:12px;font-weight:500;color:var(--t3);cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;transition:all .15s}
.rp-tab.on{color:var(--blue);border-bottom-color:var(--blue)}
.rp-ct{flex:1;overflow-y:auto;-ms-overflow-style:none;scrollbar-width:none}
.rp-ct::-webkit-scrollbar{display:none}
.pv-tooltip{position:absolute;z-index:20;background:#FFFDE7;color:#333;border:1px solid #E0D84C;padding:5px 8px;font-size:10px;line-height:1.5;pointer-events:none;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.1)}
.pv-tooltip::after{content:"";position:absolute;bottom:-5px;left:12px;width:8px;height:8px;background:#FFFDE7;border-right:1px solid #E0D84C;border-bottom:1px solid #E0D84C;transform:rotate(45deg)}
.target-mode .pv-render,.target-mode .iphone-content{cursor:crosshair!important;user-select:none!important}
.pv-sheet{z-index:18;background:var(--elbg,#fff);border-top:1px solid var(--sep);box-shadow:0 -4px 20px rgba(0,0,0,.08);max-height:45vh;overflow-y:auto;-ms-overflow-style:none;scrollbar-width:none;flex-shrink:0}
.pv-sheet::-webkit-scrollbar{display:none}
.pv-badge{position:absolute;top:8px;left:8px;z-index:20;min-width:20px;height:20px;border-radius:10px;background:#FF3B30;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 6px;cursor:pointer;box-shadow:0 2px 6px rgba(255,59,48,.3)}
`;

// ─── ReferencesPanel ─────────────────────────
function CopyButton({label,text,color='var(--blue)'}){
  const[copied,setCopied]=useState(false);
  const copy=()=>{navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1800);}).catch(()=>{});};
  return(<button onClick={copy} style={{padding:'3px 10px',borderRadius:6,fontSize:10,cursor:'pointer',border:`1px solid ${color}`,background:copied?color:'transparent',color:copied?'#fff':color,transition:'all .15s',fontWeight:600,whiteSpace:'nowrap'}}>{copied?'✓ 복사됨':label}</button>);
}

const REF_CATS = ['전체','무드보드','벤치마킹','경쟁사 UI','아티클/영상','기타'];
function ReferencesPanel(){
  const[refs,setRefs]=useState(()=>{try{return JSON.parse(localStorage.getItem('references')||'[]');}catch{return[];}});
  const[cat,setCat]=useState('전체');
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({title:'',url:'',cat:'무드보드',memo:'',thumb:''});
  const save=(next)=>{setRefs(next);localStorage.setItem('references',JSON.stringify(next));};
  const add=()=>{if(!form.title.trim())return;save([{...form,id:Date.now()},...refs]);setForm({title:'',url:'',cat:'무드보드',memo:'',thumb:''});setShowAdd(false);};
  const del=(id)=>save(refs.filter(r=>r.id!==id));
  const filtered=cat==='전체'?refs:refs.filter(r=>r.cat===cat);
  return(<div style={{display:'flex',flexDirection:'column',height:'100%'}}>
    {/* 필터 + 추가 */}
    <div style={{display:'flex',gap:6,padding:'12px 16px 0',alignItems:'center',flexWrap:'wrap'}}>
      {REF_CATS.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:'3px 10px',borderRadius:6,fontSize:11,cursor:'pointer',border:cat===c?'none':'1px solid var(--sep)',background:cat===c?'var(--blue)':'var(--bg2)',color:cat===c?'#fff':'var(--t2)'}}>{c}{c==='전체'&&refs.length>0?` (${refs.length})`:''}</button>)}
      <button onClick={()=>setShowAdd(p=>!p)} style={{marginLeft:'auto',padding:'4px 12px',borderRadius:7,fontSize:11,background:'var(--blue)',color:'#fff',border:'none',cursor:'pointer'}}>+ 추가</button>
    </div>
    {/* 추가 폼 */}
    {showAdd&&(<div style={{margin:'12px 16px 0',padding:'12px 14px',background:'var(--bg2)',borderRadius:10,border:'1px solid var(--sep)',display:'flex',flexDirection:'column',gap:8}}>
      <div style={{display:'flex',gap:8}}>
        <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="제목 *" style={{flex:2,padding:'6px 10px',borderRadius:7,fontSize:12,border:'1px solid var(--sep)',background:'var(--bg1)',color:'var(--t1)'}}/>
        <select value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))} style={{flex:1,padding:'6px 8px',borderRadius:7,fontSize:12,border:'1px solid var(--sep)',background:'var(--bg1)',color:'var(--t1)'}}>
          {REF_CATS.slice(1).map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <input value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))} placeholder="URL (선택)" style={{padding:'6px 10px',borderRadius:7,fontSize:12,border:'1px solid var(--sep)',background:'var(--bg1)',color:'var(--t1)'}}/>
      <input value={form.memo} onChange={e=>setForm(p=>({...p,memo:e.target.value}))} placeholder="메모 (선택)" style={{padding:'6px 10px',borderRadius:7,fontSize:12,border:'1px solid var(--sep)',background:'var(--bg1)',color:'var(--t1)'}}/>
      <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
        <button onClick={()=>setShowAdd(false)} style={{padding:'5px 12px',borderRadius:7,fontSize:11,background:'var(--bg3)',border:'none',color:'var(--t2)',cursor:'pointer'}}>취소</button>
        <button onClick={add} style={{padding:'5px 14px',borderRadius:7,fontSize:11,background:'var(--blue)',border:'none',color:'#fff',fontWeight:600,cursor:'pointer'}}>저장</button>
      </div>
    </div>)}
    {/* 목록 */}
    <div style={{flex:1,overflow:'auto',padding:'12px 16px'}}>
      {filtered.length===0?(<div style={{padding:'60px 20px',textAlign:'center',color:'var(--t3)'}}><div style={{fontSize:28,marginBottom:8}}>📌</div><div style={{fontSize:13,fontWeight:500,marginBottom:6}}>레퍼런스가 없습니다</div><div style={{fontSize:11}}>무드보드, 벤치마킹, 경쟁사 캡처 등을 보관하세요</div></div>):(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(r=><div key={r.id} style={{display:'flex',gap:10,padding:'10px 12px',background:'var(--bg2)',borderRadius:10,border:'1px solid var(--sep)',alignItems:'flex-start'}}>
            <div style={{width:36,height:36,borderRadius:8,background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
              {r.cat==='무드보드'?'🎨':r.cat==='벤치마킹'?'🔍':r.cat==='경쟁사 UI'?'🏢':r.cat==='아티클/영상'?'📰':'📌'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--t1)',marginBottom:2}}>{r.title}</div>
              {r.url&&<a href={r.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:'var(--blue)',display:'block',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.url}</a>}
              {r.memo&&<div style={{fontSize:11,color:'var(--t3)'}}>{r.memo}</div>}
              <span style={{fontSize:9,marginTop:4,display:'inline-block',padding:'1px 6px',borderRadius:4,background:'var(--bg3)',color:'var(--t3)'}}>{r.cat}</span>
            </div>
            <button onClick={()=>del(r.id)} style={{background:'none',border:'none',fontSize:13,color:'var(--t3)',cursor:'pointer',flexShrink:0}}>✕</button>
          </div>)}
        </div>
      )}
    </div>
  </div>);
}

export default function App(){
  const[dark,setDark]=useState(false);
  const[nav,setNav]=useState("studio");
  const[oP,setOP]=useState(null); // opened project
  const[stTab,setStTab]=useState("전체");
  // Editor
  const[curPage,setCurPage]=useState("p1");
  const[curState,setCurState]=useState(null); // null or state id
  const[showStrip,setShowStrip]=useState(false);
  const[pvW,setPvW]=useState(480); // preview width
  const[pvMode,setPvMode]=useState("phone"); // full | phone
  const[pvCode,setPvCode]=useState(false); // false=render, true=code
  const[pvDark,setPvDark]=useState(false); // preview app dark/light
  const[pvAria,setPvAria]=useState(false); // aria view
  const[microPopup,setMicroPopup]=useState(null); // {type,icon,label,html,tag}
  // Page HTML state (editable)
  const[pageHtmlMap,setPageHtmlMap]=useState({...PAGE_HTML});
  const curPageHtml = pageHtmlMap[curPage]||"";

  // Aria regions from current page
  const[ariaRegions,setAriaRegions]=useState(()=>parseAriaRegions(PAGE_HTML.p1));
  const[dragIdx,setDragIdx]=useState(null);
  const[dropTarget,setDropTarget]=useState(null);
  const[selAria,setSelAria]=useState(null);
  const[selElement,setSelElement]=useState(null);
  const[pvHover,setPvHover]=useState(null); // {tag,label,folder,rect,codeName}
  const[pvHighlight,setPvHighlight]=useState(null); // {rect}
  const[targetMode,setTargetMode]=useState(false);
  const[elInfo,setElInfo]=useState(null);
  const[elInfoExpand,setElInfoExpand]=useState(false);
  const[elUserRules,setElUserRules]=useState({}); // {codeName: "md규칙 문자열"}
  const[editingRule,setEditingRule]=useState(false);
  const[editRuleText,setEditRuleText]=useState("");
  const[elSheet,setElSheet]=useState(null);
  const[elSheetEdit,setElSheetEdit]=useState(false);
  const[sheetTip,setSheetTip]=useState(null); // {field,x,y}
  const[elSheetData,setElSheetData]=useState({});
  const[agentChanges,setAgentChanges]=useState([
    {codeName:"button[운동시작하기]",field:"시각",old:"bg:#007AFF",new_:"bg:#FF6B35",time:"2분 전"},
    {codeName:"div.stats",field:"API",old:"/api/stats",new_:"/api/v2/stats",time:"5분 전"},
  ]);
  const[dragSel,setDragSel]=useState(null);
  const dragSelRef=useRef(null);
  const dragDoneRef=useRef(false);
  const lastClickRef=useRef({time:0,target:null});
  const hoverTimer=useRef(null);
  const agentInput=useRef(null);
  const[fileMenu,setFileMenu]=useState(false);
  const[remotePos,setRemotePos]=useState({x:null,y:null});
  const remoteDrag=useRef(null);
  const[history,setHistory]=useState([{...PAGE_HTML}]);
  const[historyIdx,setHistoryIdx]=useState(0);
  const historyTimer=useRef(null);

  // Update page visually immediately, but debounce history recording (500ms)
  const updatePageHtml=useCallback((updater)=>{
    setPageHtmlMap(prev=>{
      const next=typeof updater==="function"?updater(prev):{...prev,...updater};
      // Debounce history push
      if(historyTimer.current)clearTimeout(historyTimer.current);
      historyTimer.current=setTimeout(()=>{
        setHistory(h=>{const newH=h.slice(0,historyIdx+1);newH.push({...next});return newH});
        setHistoryIdx(i=>i+1);
      },500);
      return next;
    });
  },[historyIdx]);

  const undo=useCallback(()=>{
    if(historyIdx<=0)return;
    const ni=historyIdx-1;setHistoryIdx(ni);setPageHtmlMap({...history[ni]});
  },[historyIdx,history]);

  const redo=useCallback(()=>{
    if(historyIdx>=history.length-1)return;
    const ni=historyIdx+1;setHistoryIdx(ni);setPageHtmlMap({...history[ni]});
  },[historyIdx,history]);

  const onRemoteDown=useCallback((e)=>{
    if(e.target.tagName==="INPUT"||e.target.tagName==="SELECT"||e.target.tagName==="BUTTON"||e.target.tagName==="CANVAS")return;
    e.preventDefault();
    const el=e.currentTarget.closest(".dp-remote");
    const rect=el.getBoundingClientRect();
    remoteDrag.current={startX:e.clientX,startY:e.clientY,origX:rect.left,origY:rect.top};
    const onMove=(ev)=>{if(!remoteDrag.current)return;const dx=ev.clientX-remoteDrag.current.startX;const dy=ev.clientY-remoteDrag.current.startY;setRemotePos({x:remoteDrag.current.origX+dx,y:remoteDrag.current.origY+dy})};
    const onUp=()=>{remoteDrag.current=null;window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp)};
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
  },[]);

  // Update aria regions when page changes
  const prevPage=useRef(curPage);
  if(prevPage.current!==curPage){prevPage.current=curPage;setAriaRegions(parseAriaRegions(pageHtmlMap[curPage]||""))}

  // When aria regions reordered → rebuild page HTML
  function onAriaReorder(fromIdx,toIdx){
    const arr=[...ariaRegions];
    const[moved]=arr.splice(fromIdx,1);
    const insertAt=toIdx>fromIdx?toIdx-1:toIdx;
    arr.splice(insertAt,0,moved);
    setAriaRegions(arr);
    setDragIdx(null);
    setDropTarget(null);
    const newHtml=arr.map(r=>r.html).join("\n");
    updatePageHtml(prev=>({...prev,[curPage]:`<div style="font-family:Pretendard,-apple-system,sans-serif;background:#fff;min-height:667px;color:#1d1d1f">${newHtml}</div>`}));
  }
  const[wpTab,setWpTab]=useState("기능 명세서");
  const[addMenu,setAddMenu]=useState(false);
  const[designDocEdit,setDesignDocEdit]=useState(false);
  const[specScope,setSpecScope]=useState("범용");
  const[mdScope,setMdScope]=useState("범용");
  const[ruleAlerts,setRuleAlerts]=useState({"디자인 원칙":{desc:"'접근성 우선' 항목 추가됨"},"고정 설정값":{desc:"DEBOUNCE_MS: 300→500 변경"}}); 
  const[wfSubTab,setWfSubTab]=useState("기획");
  const[triggerBoard,setTriggerBoard]=useState(false);
  const[designDocText,setDesignDocText]=useState(`# 설계안\n\n## 페이지 구성\n- 홈 대시보드: 오늘의 운동 현황, 칼로리, 빠른 시작\n- 로그인: 이메일/비밀번호, 소셜 로그인\n- 운동 기록: 운동 목록, 세트/횟수 입력\n\n## 상태 레이어\n- 모달A: 로그인 팝업 (홈에서 트리거)\n\n## 핵심 플로우\n1. 앱 실행 → 홈 대시보드\n2. '운동 시작' → 운동 종류 선택\n3. 세트/횟수 입력 → 저장 → 대시보드 갱신`);
  const[selEl,setSelEl]=useState(null);
  // Foundation
  const[fnTab,setFnTab]=useState("파운데이션");
  const[fnSub,setFnSub]=useState("전체");
  // Collect
  const[clSub,setClSub]=useState("파운데이션");
  // Commit
  const[cmTab,setCmTab]=useState("API/DB");
  // Rules
  const[ruTab,setRuTab]=useState("전체");
  // Manage
  const[mgTab,setMgTab]=useState("GitHub");
  const[rpTab,setRpTab]=useState("에이전트");
  const[rpOpen,setRpOpen]=useState(true);

  // ── Dynamic data state ──
  const[projects,setProjects]=useState(DEFAULT_PROJECTS);
  const[sources,setSources]=useState([]);
  const[uiComponents,setUiComponents]=useState([]);
  const[tokenSets,setTokenSets]=useState([]);
  const[catalogData,setCatalogData]=useState(EMPTY_CATALOG);
  const[loaded,setLoaded]=useState(false);

  // ── GitHub sync ──
  const[githubSync,setGithubSync]=useState(()=>{try{return JSON.parse(localStorage.getItem('githubSyncConfig')||'null')||null;}catch{return null;}});
  const[dataSha,setDataSha]=useState(null);
  const[syncStatus,setSyncStatus]=useState('idle');
  const[syncErrMsg,setSyncErrMsg]=useState('');
  // 손상 감지 → 복원 확인 모달
  const[repairPrompt,setRepairPrompt]=useState(null); // null | {raw, repaired, info, source}
  const applyRepair=(raw,repaired)=>{
    // 복원 전 원본: localStorage에 통째로 보존
    const snap={savedAt:new Date().toISOString(),data:raw};
    localStorage.setItem('prerepair_snapshot',JSON.stringify(snap));
    // 복원 후 적용
    if(Array.isArray(repaired.projects)&&repaired.projects.length)setProjects(repaired.projects);
    if(Array.isArray(repaired.sources))setSources(repaired.sources);
    if(Array.isArray(repaired.uiComponents))setUiComponents(repaired.uiComponents);
    if(Array.isArray(repaired.tokenSets))setTokenSets(repaired.tokenSets);
    setRepairPrompt(null);
  };
  const[showSyncSetup,setShowSyncSetup]=useState(false);
  const[supabaseConfig,setSupabaseConfig]=useState(()=>{try{return JSON.parse(localStorage.getItem('supabaseConfig')||'null')||null;}catch{return null;}});
  const[showSnapshotPanel,setShowSnapshotPanel]=useState(false);
  const syncTimerRef=useRef(null);

  // Load from localStorage → then GitHub
  useEffect(()=>{
    (async()=>{
      try{
        // localStorage 로드 — 손상 감지 시 확인 후 복원
        const pr=await storage.get('projects');
        const sr=await storage.get('sources');
        const cr=await storage.get('uiComponents');
        const tr=await storage.get('tokenSets');
        const rawData={
          projects:pr?.value?JSON.parse(pr.value):[],
          sources:sr?.value?JSON.parse(sr.value):[],
          uiComponents:cr?.value?JSON.parse(cr.value):[],
          tokenSets:tr?.value?JSON.parse(tr.value):[],
        };
        const corruptInfo=detectCorruption(rawData);
        if(corruptInfo){
          // 손상 감지 → 사용자 확인 대기 (모달)
          const repairedData=repairAppData(rawData);
          // 손상 원본을 우선 적용 (모달 뜨는 동안 사용 가능하게)
          if(Array.isArray(rawData.projects)&&rawData.projects.length)setProjects(rawData.projects);
          if(Array.isArray(rawData.sources))setSources(rawData.sources);
          if(Array.isArray(rawData.uiComponents))setUiComponents(rawData.uiComponents);
          if(Array.isArray(rawData.tokenSets))setTokenSets(rawData.tokenSets);
          setRepairPrompt({raw:rawData,repaired:repairedData,info:corruptInfo,source:'localStorage'});
        } else {
          if(Array.isArray(rawData.projects)&&rawData.projects.length)setProjects(rawData.projects);
          if(Array.isArray(rawData.sources))setSources(rawData.sources);
          if(Array.isArray(rawData.uiComponents))setUiComponents(rawData.uiComponents);
          if(Array.isArray(rawData.tokenSets))setTokenSets(rawData.tokenSets);
        }
        const cat=await storage.get('catalogData');if(cat?.value){const c=deserializeCatalog(cat.value);if(c.nodes?.length)setCatalogData(c);}
      }catch{}
      const cfg=(()=>{try{return JSON.parse(localStorage.getItem('githubSyncConfig')||'null');}catch{return null;}})();
      if(cfg?.enabled&&cfg.token&&cfg.repo){
        setSyncStatus('syncing');
        try{
          const result=await loadFromGitHub(cfg.token,cfg.repo,cfg.branch||'main');
          if(result?.raw){
            const corruptInfo=detectCorruption(result.raw);
            if(corruptInfo){
              // 손상 감지 → 원본 우선 적용 후 확인 모달
              const r=result.raw;
              if(Array.isArray(r.projects)&&r.projects.length)setProjects(r.projects);
              if(Array.isArray(r.sources))setSources(r.sources);
              if(Array.isArray(r.uiComponents))setUiComponents(r.uiComponents);
              if(Array.isArray(r.tokenSets))setTokenSets(r.tokenSets);
              if(r.catalogData?.nodes?.length)setCatalogData(r.catalogData);
              setRepairPrompt({raw:result.raw,repaired:result.data,info:corruptInfo,source:'GitHub'});
            } else {
              const d=result.data;
              if(Array.isArray(d.projects)&&d.projects.length)setProjects(d.projects);
              if(Array.isArray(d.sources))setSources(d.sources);
              if(Array.isArray(d.uiComponents))setUiComponents(d.uiComponents);
              if(Array.isArray(d.tokenSets))setTokenSets(d.tokenSets);
              if(d.catalogData?.nodes?.length)setCatalogData(d.catalogData);
            }
            setDataSha(result.sha);setSyncStatus('ok');
          }else{setSyncStatus('idle');}
        }catch{setSyncStatus('error');}
      }
      setLoaded(true);
    })();
  },[]);

  // Save to localStorage — repairAppData가 로드 시 자동 복구하므로 별도 필터링 불필요
  useEffect(()=>{
    if(!loaded)return;
    (async()=>{
      try{
        await storage.set('projects',JSON.stringify(projects));
        await storage.set('sources',JSON.stringify(sources));
        await storage.set('uiComponents',JSON.stringify(uiComponents));
        await storage.set('tokenSets',JSON.stringify(tokenSets));
        await storage.set('catalogData',serializeCatalog(catalogData));
      }catch{}
    })();
  },[projects,sources,uiComponents,tokenSets,catalogData,loaded]);

  // GitHub auto-save (2s debounce)
  useEffect(()=>{
    if(!loaded||!githubSync?.enabled||!githubSync?.token||!githubSync?.repo)return;
    if(syncTimerRef.current)clearTimeout(syncTimerRef.current);
    syncTimerRef.current=setTimeout(async()=>{
      setSyncStatus('syncing');setSyncErrMsg('');
      try{
        const appData={projects,sources,uiComponents,tokenSets,catalogData};
        const newSha=await saveToGitHub(githubSync.token,githubSync.repo,githubSync.branch||'main',appData,dataSha);
        if(newSha)setDataSha(newSha);
        setSyncStatus('ok');
      }catch(e){setSyncStatus('error');setSyncErrMsg(e?.message||'알 수 없는 오류');}
    },2000);
    return()=>clearTimeout(syncTimerRef.current);
  },[projects,sources,uiComponents,tokenSets,catalogData,loaded,githubSync]);

  const pushNow=async()=>{
    if(!githubSync?.enabled||!githubSync?.token||!githubSync?.repo)return;
    if(syncTimerRef.current)clearTimeout(syncTimerRef.current);
    setSyncStatus('syncing');setSyncErrMsg('');
    try{
      const appData={projects,sources,uiComponents,tokenSets,catalogData};
      const newSha=await saveToGitHub(githubSync.token,githubSync.repo,githubSync.branch||'main',appData,dataSha);
      if(newSha)setDataSha(newSha);
      setSyncStatus('ok');
    }catch(e){setSyncStatus('error');setSyncErrMsg(e?.message||'알 수 없는 오류');}
  };
  // ── Supabase 1시간 자동 스냅샷 프롬프트 ──
  const[autoSnapPrompt,setAutoSnapPrompt]=useState(null); // null | {count, last_at, projectStats}
  const[autoSnapSkip,setAutoSnapSkip]=useState(false);    // 이 세션에서 묻지 않기
  const autoSnapIntervalRef=useRef(null);
  useEffect(()=>{
    if(!supabaseConfig?.url||!supabaseConfig?.key||autoSnapSkip)return;
    autoSnapIntervalRef.current=setInterval(async()=>{
      try{
        const{getProjectStats}=await import('./utils/supabaseSync.js');
        const st=await getProjectStats(supabaseConfig.url,supabaseConfig.key);
        const totalCount=st.reduce((s,x)=>s+x.count,0);
        const lastAt=st.sort((a,b)=>new Date(b.last_at)-new Date(a.last_at))[0]?.last_at||null;
        setAutoSnapPrompt({count:totalCount,last_at:lastAt,stats:st});
      }catch{}
    },60*60*1000); // 1시간
    return()=>clearInterval(autoSnapIntervalRef.current);
  },[supabaseConfig,autoSnapSkip]);

  const[showCollectPopup,setShowCollectPopup]=useState(false);
  const DEFAULT_COLLECT_URLS=[];
  const[cpUrls,setCpUrls]=useState(DEFAULT_COLLECT_URLS);
  const[cpDomains,setCpDomains]=useState(["게임"]);
  const[cpStyles,setCpStyles]=useState(["글래스모피즘"]);
  const[cpMaterials,setCpMaterials]=useState({"파운데이션":["컬러","타이포"],"비주얼 에셋":["배경/텍스처"]});
  const[cpDecomp,setCpDecomp]=useState(["원자","블록"]);
  const[cpSched,setCpSched]=useState("즉시");
  const[cpUrlInput,setCpUrlInput]=useState("");
  const[cpBusy,setCpBusy]=useState(false);
  const[cpResult,setCpResult]=useState(null); // {count, error}
  const cpApiKey=()=>localStorage.getItem('claudeApiKey')||'';

  // ── 프로젝트 모달 (생성/수정 공용) ──
  const PROJ_TYPES=['원자','블록','섹션','페이지','프로젝트'];
  const FOCUS_OPTIONS=[
    {v:'핵심',c:'rgba(226,75,74,0.9)'},
    {v:'빠르면 좋음',c:'rgba(186,117,23,0.9)'},
    {v:'다음 대상',c:'rgba(136,135,128,0.88)'},
    {v:'부가',c:'rgba(95,94,90,0.88)'},
  ];
  const FOCUS_COLOR=(f)=>FOCUS_OPTIONS.find(o=>o.v===f)?.c||'rgba(95,94,90,0.88)';
  const getDDay=(dueDate)=>{
    if(!dueDate)return null;
    const diff=Math.ceil((new Date(dueDate)-new Date())/(1000*60*60*24));
    if(diff===0)return'D-Day';if(diff>0)return`D-${diff}`;return`D+${Math.abs(diff)}`;
  };
  const emptyProjForm=()=>({name:'',color:'#1a2a3a',status:'페이지',focus:'핵심',level:'구현 필요',dueDate:'',tags:[]});
  const[showProjModal,setShowProjModal]=useState(false);
  const[projModalMode,setProjModalMode]=useState('create'); // 'create' | 'edit'
  const[projForm,setProjForm]=useState(emptyProjForm());
  const[editingProjId,setEditingProjId]=useState(null);
  const[tagInput,setTagInput]=useState('');
  const[projCols,setProjCols]=useState(4); // 그리드 열 수: 3, 4, 6
  const pf=(k,v)=>setProjForm(f=>({...f,[k]:v}));
  const openCreateModal=()=>{setProjForm(emptyProjForm());setProjModalMode('create');setTagInput('');setShowProjModal(true);};
  const openEditModal=(p)=>{setProjForm({name:p.name,color:p.color||'#1a2a3a',status:p.status||'페이지',focus:p.focus||'핵심',level:p.level||'구현 필요',dueDate:p.dueDate||'',tags:p.tags||[]});setEditingProjId(p.id);setProjModalMode('edit');setTagInput('');setShowProjModal(true);};
  const closeProjModal=()=>{setShowProjModal(false);setEditingProjId(null);};
  const submitProjModal=()=>{
    if(!projForm.name.trim())return;
    const nowIso=new Date().toISOString();
    if(projModalMode==='create'){
      setProjects(p=>[...p,{id:Date.now(),...projForm,name:projForm.name.trim(),updatedAt:nowIso,pages:0,states:0}]);
    } else {
      setProjects(p=>p.map(x=>x.id===editingProjId?{...x,...projForm,name:projForm.name.trim(),updatedAt:nowIso}:x));
    }
    closeProjModal();
  };
  const deleteProject=(id)=>{if(window.confirm('프로젝트를 삭제할까요?'))setProjects(p=>p.filter(x=>x.id!==id));};
  const addTag=(t)=>{const v=t.trim();if(v&&!projForm.tags.includes(v))pf('tags',[...projForm.tags,v]);setTagInput('');};
  const removeTag=(t)=>pf('tags',projForm.tags.filter(x=>x!==t));
  const renameProject=(id,name)=>{setProjects(p=>p.map(x=>x.id===id?{...x,name}:x));setEditingProjId(null);};
  const toggleSet=(arr,setArr,v)=>setArr(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  const toggleMatSub=(cat,sub)=>setCpMaterials(p=>{const cur=p[cat]||[];const has=cur.includes(sub);const next=has?cur.filter(x=>x!==sub):[...cur,sub];const copy={...p};if(next.length>0)copy[cat]=next;else delete copy[cat];return copy;});
  const toggleMatCat=(cat)=>setCpMaterials(p=>{const copy={...p};if(copy[cat])delete copy[cat];else copy[cat]=[];return copy;});

  const inEditor = nav==="studio" && oP;
  const scC=c=>c==="g"?"var(--green)":c==="o"?"var(--orange)":"var(--red)";
  const totalCollect=catalogData?.nodes?.length||0;
  const activeState = STATES.find(s=>s.id===curState);

  // Preview element selection
  // Style change from remote → update pageHtmlMap → re-render preview
  const handleStyleChange=useCallback((newStyleStr)=>{
    if(!selElement)return;
    try{
      const parser=new DOMParser();
      const doc=parser.parseFromString(curPageHtml,"text/html");
      // Find the element by matching original outerHTML
      const origHtml=selElement.html;
      const all=doc.body.querySelectorAll("*");
      for(const el of all){
        if(el.outerHTML===origHtml){
          el.setAttribute("style",newStyleStr);
          const newPageHtml=doc.body.innerHTML;
          updatePageHtml(prev=>({...prev,[curPage]:newPageHtml}));
          // Update selElement with new html/style
          const newStyleObj={};
          newStyleStr.split(";").forEach(p=>{const idx=p.indexOf(":");if(idx===-1)return;const k=p.slice(0,idx).trim();const v=p.slice(idx+1).trim();if(k&&v)newStyleObj[k]=v});
          setSelElement(prev=>({...prev,html:el.outerHTML,style:newStyleObj}));
          break;
        }
      }
    }catch(err){console.error("style change error:",err)}
  },[selElement,curPageHtml,curPage]);

  // Guess element metadata — reads actual DOM + builds tree path
  const guessElMeta=(target)=>{
    try{
      const tag=(target.tagName||"div").toLowerCase();
      const cls=typeof target.className==="string"?target.className:(target.className?.baseVal||"");
      const id=target.id||"";
      const aria=(target.getAttribute&&target.getAttribute("aria-label"))||"";
      const ph=(target.getAttribute&&target.getAttribute("placeholder"))||"";
      const role=(target.getAttribute&&target.getAttribute("role"))||"";
      const href=(target.getAttribute&&target.getAttribute("href"))||"";
      const src=(target.getAttribute&&target.getAttribute("src"))||"";
      const type=(target.getAttribute&&target.getAttribute("type"))||"";
      const text=(target.textContent||"").trim().replace(/\s+/g," ").slice(0,30);
      const style=(target.getAttribute&&target.getAttribute("style"))||"";
      const label=aria||ph||text||id||cls.split(" ")[0]||tag;

      // codeName
      let codeName;
      if(id) codeName=`#${id}`;
      else if(cls){
        const firstCls=cls.split(" ").find(c=>c&&c.length>1&&!c.startsWith("_"));
        codeName=firstCls?`.${firstCls}`:tag;
      }else{
        const short=text.slice(0,12).replace(/[^a-zA-Z0-9가-힣]/g,"");
        codeName=short?`${tag}[${short}]`:tag;
      }

      // compType
      let compType="요소";
      if(["button","input","select","textarea","a","span","label","img"].includes(tag)) compType="원자";
      else if(tag==="nav"||tag==="form"||(tag==="div"&&target.children&&target.children.length>=2&&target.children.length<=6)) compType="블록";
      else if(tag==="section"||(tag==="div"&&target.children&&target.children.length>6)) compType="섹션";
      else if(tag==="header"||tag==="footer") compType="섹션";
      else if(tag==="svg"||tag==="path"||tag==="img") compType="에셋";

      // Build actual DOM tree path: walk up to pv-render or iphone-content
      const treePath=[];
      let node=target;
      let depth=0;
      while(node&&depth<10){
        const nTag=(node.tagName||"").toLowerCase();
        if(!nTag||nTag==="html"||nTag==="body")break;
        const nCls=typeof node.className==="string"?node.className:(node.className?.baseVal||"");
        // Stop at container boundaries
        if(nCls.includes("pv-render")||nCls.includes("iphone-content"))break;
        const nId=node.id;
        const nFirst=nCls?nCls.split(" ").find(c=>c&&c.length>1):"";
        const nName=nId?`${nTag}#${nId}`:nFirst?`${nTag}.${nFirst}`:nTag;
        treePath.unshift(nName);
        node=node.parentElement;
        depth++;
      }

      // folder = joined tree path
      const folder=treePath.length>0?treePath.join(" > "):`${tag}`;

      return {tag,label,codeName,folder,compType,cls,id,style:style.slice(0,80),text:text.slice(0,20),type,href,src,treePath};
    }catch(err){return {tag:"div",label:"요소",codeName:"div",folder:"div",compType:"요소",cls:"",id:"",style:"",text:"",type:"",href:"",src:"",treePath:[]}}
  };

  // Build element info — actual DOM + user rules from state
  const buildElInfo=(target)=>{
    const meta=guessElMeta(target);
    const style=(target.getAttribute&&target.getAttribute("style"))||"";

    // Inline style props
    const styleProps=style.split(";").map(s=>s.trim()).filter(Boolean);
    const inlineStyles=styleProps.length>0?styleProps.map(s=>`${s}`).join("\n"):"(인라인 스타일 없음)";

    // User-defined MD rules (from state)
    const userRule=elUserRules[meta.codeName]||"";

    // Trigger
    let trigger="없음";
    const onClick=target.getAttribute&&target.getAttribute("onclick");
    if(onClick) trigger=`onClick → ${onClick.slice(0,40)}`;
    else if(meta.tag==="button") trigger=`onClick → (${meta.text||"action"})`;
    else if(meta.tag==="a"&&meta.href) trigger=`onClick → navigate("${meta.href.slice(0,30)}")`;
    else if(meta.tag==="input") trigger=`onChange → update(${meta.type||"text"})`;
    else if(meta.tag==="form") trigger="onSubmit → handleSubmit()";
    else if(meta.tag==="select") trigger="onChange → selectOption()";

    // Siblings
    let before="없음";
    let after="없음";
    const prev=target.previousElementSibling;
    const next=target.nextElementSibling;
    if(prev){const pm=guessElMeta(prev);before=`${pm.compType}: ${pm.codeName}`}
    if(next){const nm=guessElMeta(next);after=`${nm.compType}: ${nm.codeName}`}

    // Parent
    const parent=target.parentElement;
    let parentInfo="";
    if(parent&&parent.tagName){const pmeta=guessElMeta(parent);parentInfo=`${pmeta.codeName} (${pmeta.compType})`}

    // Children count
    const childCount=target.children?target.children.length:0;

    return {...meta,inlineStyles,userRule,trigger,before,after,parentInfo,childCount};
  };

  // Build bottom sheet data from actual DOM element
  const buildSheetData=(target)=>{
    const meta=guessElMeta(target);
    const cn=meta.codeName;
    const metaFields={tag:meta.tag,compType:meta.compType,folder:meta.folder,label:meta.label};
    // Return saved data if exists, but always merge meta
    if(elSheetData[cn])return {codeName:cn,...metaFields,...elSheetData[cn]};
    const style=(target.getAttribute&&target.getAttribute("style"))||"";
    const aria=(target.getAttribute&&target.getAttribute("aria-label"))||"";
    const role=(target.getAttribute&&target.getAttribute("role"))||"";
    const tabIdx=(target.getAttribute&&target.getAttribute("tabindex"))||"";
    const onClick=(target.getAttribute&&target.getAttribute("onclick"))||"";
    // Build from DOM
    const data={};
    // 인터랙션
    if(meta.tag==="button") data["인터랙션"]=`onClick → (${meta.text||"action"})\nhover → opacity:0.85\nactive → scale(0.98)`;
    else if(meta.tag==="input") data["인터랙션"]=`onChange → update(${meta.type||"text"})\nfocus → border highlight\nblur → validate`;
    else if(meta.tag==="a") data["인터랙션"]=`onClick → navigate("${meta.href||"#"}")`;
    else if(onClick) data["인터랙션"]=onClick.slice(0,60);
    else data["인터랙션"]="없음";
    // 접근성
    const accParts=[];
    if(aria)accParts.push(`aria-label: "${aria}"`);
    if(role)accParts.push(`role: ${role}`);
    if(tabIdx)accParts.push(`tabIndex: ${tabIdx}`);
    accParts.push(meta.tag==="button"||meta.tag==="a"?"키보드: Enter/Space":"");
    data["접근성"]=accParts.filter(Boolean).join("\n")||`<${meta.tag}> 기본`;
    // 시각
    const styleShort=style.split(";").filter(Boolean).slice(0,5).join("\n")||"인라인 스타일 없음";
    data["시각"]=styleShort;
    // 훅
    data["훅"]=meta.tag==="input"?"useDebounce":meta.tag==="nav"?"useScrollPosition":"없음";
    // 헬퍼
    data["헬퍼"]=meta.text&&/\d/.test(meta.text)?"formatNumber":"없음";
    // API
    data["API"]="없음";
    // 데이터
    if(meta.tag==="input") data["데이터"]=`${meta.type||"text"}: string`;
    else if(meta.tag==="img") data["데이터"]=`src: "${(meta.src||"").slice(0,30)}"`;
    else data["데이터"]=meta.text?`"${meta.text.slice(0,20)}"`:meta.tag;
    // store
    data["store"]="없음";
    // 정보 연결 — with meaning
    const prev=target.previousElementSibling;
    const next=target.nextElementSibling;
    const parent=target.parentElement;
    const connParts=[];
    if(parent&&parent.tagName){
      const pm=guessElMeta(parent);
      connParts.push(`부모: ${pm.codeName}\n  → 이 요소를 감싸고 있는 컨테이너. 부모의 레이아웃(flex/grid)에 따라 이 요소 위치가 결정됨.`);
    }
    if(prev){
      const pm=guessElMeta(prev);
      connParts.push(`이전: ${pm.codeName}\n  → 바로 위에 렌더되는 형제. 이 요소보다 먼저 화면에 나타남. 이전 요소의 높이/여백이 이 요소 시작 위치에 영향.`);
    }
    if(next){
      const nm=guessElMeta(next);
      connParts.push(`이후: ${nm.codeName}\n  → 바로 아래에 렌더되는 형제. 이 요소 다음에 화면에 나타남. 이 요소가 사라지면 이후 요소가 위로 올라옴.`);
    }
    if(parent&&parent.children&&parent.children.length>1){
      connParts.push(`형제 총: ${parent.children.length}개\n  → 같은 부모 안에 있는 요소 수. 이 중 하나가 삭제/추가되면 나머지 배치도 바뀔 수 있음.`);
    }
    data["정보 연결"]=connParts.join("\n\n")||"독립 요소 (부모/형제 없음)";
    // 참조 DB
    data["참조 DB"]=meta.tag==="form"?"User, Record":meta.tag==="input"?"해당 필드 스키마":"없음";
    // 스니펫 — full for copy
    data["스니펫"]=(target.outerHTML||"").slice(0,300);
    return {codeName:cn,...metaFields,...data};
  };

  // Save sheet data
  const saveSheetData=(codeName,data)=>{
    const d={...data};
    delete d.codeName;
    setElSheetData(p=>({...p,[codeName]:d}));
  };

  // Get zoom factor for container inside .iphone
  const getZoom=(container)=>{
    let p=container;
    while(p&&p.parentElement){
      if(p.classList&&p.classList.contains("iphone")){
        const z=window.getComputedStyle(p).zoom;
        return z?parseFloat(z):1;
      }
      p=p.parentElement;
    }
    return 1;
  };
  // Get element rect relative to container (scroll + zoom aware)
  const getRelRect=(container,target)=>{
    const cRect=container.getBoundingClientRect();
    const tRect=target.getBoundingClientRect();
    const z=getZoom(container);
    return {
      top:(tRect.top-cRect.top)/z+container.scrollTop,
      left:(tRect.left-cRect.left)/z+container.scrollLeft,
      width:tRect.width/z,
      height:tRect.height/z
    };
  };
  const clientToContainer=(container,clientX,clientY)=>{
    const cRect=container.getBoundingClientRect();
    const z=getZoom(container);
    return {
      x:(clientX-cRect.left)/z+container.scrollLeft,
      y:(clientY-cRect.top)/z+container.scrollTop
    };
  };

  const handlePvClick=useCallback((e)=>{
    e.stopPropagation();
    if(dragDoneRef.current){dragDoneRef.current=false;return}
    try{
      let target=e.target;
      const container=e.currentTarget;
      if(!target||!target.tagName){return}
      if(target===container){setPvHighlight(null);setSelElement(null);setElInfo(null);return}
      while(target.parentElement&&target.parentElement!==container&&target.children.length===0&&target.parentElement.children.length===1){
        target=target.parentElement;
      }
      const rect=getRelRect(container,target);
      const meta=guessElMeta(target);

      // Target mode handled by mouseup in handlePvTargetDown
      if(targetMode)return;

      const now=Date.now();
      if(now-lastClickRef.current.time<400&&lastClickRef.current.tag===meta.codeName){
        const styleStr=(target.getAttribute&&target.getAttribute("style"))||"";
        const styleObj={};
        styleStr.split(";").forEach(p=>{
          const idx=p.indexOf(":");if(idx===-1)return;
          const k=p.slice(0,idx).trim();const v=p.slice(idx+1).trim();
          if(k&&v)styleObj[k]=v;
        });
        setSelElement({html:target.outerHTML,tag:meta.tag,style:styleObj,label:meta.label,rect});
        setPvHighlight({rect,tag:meta.tag,codeName:meta.codeName,compType:meta.compType});
        setElInfo(buildElInfo(target));
        setWpTab("와이어프레임");
        lastClickRef.current={time:0,tag:null};
      }else{
        setPvHighlight({rect,tag:meta.tag,codeName:meta.codeName,compType:meta.compType});
        setElInfo(buildElInfo(target));
        setElInfoExpand(false);
        lastClickRef.current={time:now,tag:meta.codeName};
      }
    }catch(err){console.error("pvClick:",err)}
  },[targetMode]);

  // Target mode drag
  const handlePvTargetDown=useCallback((e)=>{
    if(!targetMode)return;
    const container=e.currentTarget;
    const start=clientToContainer(container,e.clientX,e.clientY);
    dragSelRef.current={startX:start.x,startY:start.y,container,moved:false};

    const onMove=(ev)=>{
      ev.preventDefault();
      if(!dragSelRef.current)return;
      const ds=dragSelRef.current;
      const cur=clientToContainer(ds.container,ev.clientX,ev.clientY);
      if(Math.abs(cur.x-ds.startX)>4||Math.abs(cur.y-ds.startY)>4)ds.moved=true;
      if(ds.moved){
        setDragSel({x:Math.min(ds.startX,cur.x),y:Math.min(ds.startY,cur.y),w:Math.abs(cur.x-ds.startX),h:Math.abs(cur.y-ds.startY)});
      }
    };
    const onUp=(ev)=>{
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
      const ds=dragSelRef.current;
      if(!ds){return}
      dragDoneRef.current=true;
      setTimeout(()=>{dragDoneRef.current=false},100);

      if(!ds.moved){
        // Single click in target mode — find element at click point
        const clickEl=document.elementFromPoint(ev.clientX,ev.clientY);
        if(clickEl&&ds.container.contains(clickEl)&&clickEl!==ds.container){
          let target=clickEl;
          while(target.parentElement&&target.parentElement!==ds.container&&target.children.length===0&&target.parentElement.children.length===1){
            target=target.parentElement;
          }
          const rect=getRelRect(ds.container,target);
          const meta=guessElMeta(target);
          const ref=`@[${meta.compType}:${meta.codeName}]`;
          if(agentInput.current){
            const ta=agentInput.current;
            const pos=ta.selectionStart||ta.value.length;
            ta.value=ta.value.slice(0,pos)+ref+" "+ta.value.slice(pos);
            ta.focus();
          }
          setPvHighlight({rect,tag:meta.tag,codeName:meta.codeName,compType:meta.compType});
          setElInfo(buildElInfo(target));
          try{
            const sheetData=buildSheetData(target);
            setElSheet({...sheetData,rect});
            setElSheetEdit(false);
          }catch(err){console.error("sheet err:",err)}
        }
        dragSelRef.current=null;
        setTargetMode(false);
        return;
      }

      // Drag completed
      const end=clientToContainer(ds.container,ev.clientX,ev.clientY);
      const selRect={x:Math.min(ds.startX,end.x),y:Math.min(ds.startY,end.y),w:Math.abs(end.x-ds.startX),h:Math.abs(end.y-ds.startY)};
      if(selRect.w<10||selRect.h<10){setDragSel(null);dragSelRef.current=null;setTargetMode(false);return}
      // Find the largest element whose bounds are fully inside the drag rect
      let bestEl=null;
      let bestArea=0;
      const children=ds.container.children;
      const findBest=(parent)=>{
        for(let i=0;i<parent.children.length;i++){
          const child=parent.children[i];
          try{
            const tag=(child.tagName||"").toLowerCase();
            if(["script","style","br","hr"].includes(tag))continue;
            const elR=getRelRect(ds.container,child);
            if(elR.width<5||elR.height<5)continue;
            // Check if element is mostly inside drag rect (80%+ overlap)
            const overlapX=Math.max(0,Math.min(elR.left+elR.width,selRect.x+selRect.w)-Math.max(elR.left,selRect.x));
            const overlapY=Math.max(0,Math.min(elR.top+elR.height,selRect.y+selRect.h)-Math.max(elR.top,selRect.y));
            const overlapArea=overlapX*overlapY;
            const elArea=elR.width*elR.height;
            if(elArea>0&&overlapArea/elArea>0.5){
              if(elArea>bestArea){bestArea=elArea;bestEl=child}
            }
            // Also check children for better fit
            if(child.children.length>0)findBest(child);
          }catch(e){}
        }
      };
      findBest(ds.container);
      // Use largest element, or fallback to individual elements
      let refStr="";
      let highlightName="";
      if(bestEl){
        const m=guessElMeta(bestEl);
        refStr=`@[${m.compType}:${m.codeName}]`;
        highlightName=m.codeName;
        // Also open bottom sheet for this element
        const sheetData=buildSheetData(bestEl);
        setElSheet({...sheetData,rect:getRelRect(ds.container,bestEl)});
        setElSheetEdit(false);
      }
      if(refStr&&agentInput.current){
        const ta=agentInput.current;
        const pos=ta.selectionStart||ta.value.length;
        ta.value=ta.value.slice(0,pos)+refStr+" "+ta.value.slice(pos);
        ta.focus();
      }
      setPvHighlight({rect:{top:selRect.y,left:selRect.x,width:selRect.w,height:selRect.h},tag:"영역",codeName:highlightName||"선택 영역",compType:"드래그 선택"});
      setDragSel(null);
      dragSelRef.current=null;
      setTargetMode(false);
    };
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
  },[targetMode]);

  const handlePvMouseMove=useCallback((e)=>{
    if(targetMode)return;
    const container=e.currentTarget;
    let target=e.target;
    if(!target||!target.tagName)return;
    if(target===container){clearTimeout(hoverTimer.current);setPvHover(null);return}
    while(target.parentElement&&target.parentElement!==container&&target.children.length===0&&target.parentElement.children.length===1){
      target=target.parentElement;
    }
    const rect=getRelRect(container,target);
    const meta=guessElMeta(target);
    clearTimeout(hoverTimer.current);
    hoverTimer.current=setTimeout(()=>{
      setPvHover({...meta,rect});
    },300);
  },[targetMode]);

  const handlePvMouseLeave=useCallback(()=>{
    clearTimeout(hoverTimer.current);
    setPvHover(null);
  },[]);

  // Resize logic
  const resizing=useRef(false);
  const onMouseDown=useCallback(()=>{resizing.current=true;
    const onMove=(e)=>{if(resizing.current){setPvW(w=>Math.max(435,Math.min(window.innerWidth*0.55,e.clientX)))}};
    const onUp=()=>{resizing.current=false;window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp)};
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
  },[inEditor]);

  const themeObj={ac:"#007AFF",bg:"#fff",tx:"#1d1d1f",ib:"#f2f2f7",ibr:"rgba(0,0,0,0.1)",t2:"#6e6e73",t3:"#aeaeb2",cb:"rgba(0,0,0,0.1)",card:"#f5f5f7",abg:"rgba(0,122,255,0.1)"};
  const handleSnapshotRestore=(data)=>{
    // repairAppData가 손상 복구 처리 — 별도 필터링 불필요
    const repaired=repairAppData(data);
    if(Array.isArray(repaired.projects)&&repaired.projects.length)setProjects(repaired.projects);
    if(Array.isArray(repaired.sources))setSources(repaired.sources);
    if(Array.isArray(repaired.uiComponents))setUiComponents(repaired.uiComponents);
    if(Array.isArray(data.tokenSets))setTokenSets(data.tokenSets);
    if(data.catalogData?.nodes?.length)setCatalogData(data.catalogData);
  };
  return(<>
    {repairPrompt&&<div onClick={()=>setRepairPrompt(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400}}>
      <div onClick={e=>e.stopPropagation()} style={{width:480,background:themeObj.card,borderRadius:16,padding:28,border:`1px solid ${themeObj.cb}`}}>
        <h3 style={{margin:"0 0 6px",fontSize:15,color:themeObj.tx}}>⚠️ 손상된 데이터 감지</h3>
        <p style={{margin:"0 0 16px",fontSize:11,color:themeObj.t3}}>
          출처: <b style={{color:themeObj.t2}}>{repairPrompt.source}</b> · {repairPrompt.info.count}개 항목 손상됨 (atob 인코딩 오류)
        </p>
        <div style={{background:themeObj.ib,borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:11,color:themeObj.t2}}>
          <div style={{fontWeight:600,marginBottom:8,color:themeObj.tx}}>변경 예시:</div>
          {repairPrompt.info.examples.map((ex,i)=>(
            <div key={i} style={{marginBottom:5,display:"flex",gap:8,alignItems:"center"}}>
              <span style={{color:themeObj.t3,minWidth:70}}>[{ex.field}]</span>
              <span style={{color:"#F44336",fontFamily:"monospace"}}>{ex.before}</span>
              <span style={{color:themeObj.t3}}>→</span>
              <span style={{color:"#5DCAA5",fontFamily:"monospace"}}>{ex.after}</span>
            </div>
          ))}
        </div>
        <div style={{background:"rgba(0,122,255,0.08)",borderRadius:8,padding:"8px 12px",marginBottom:20,fontSize:11,color:themeObj.t2}}>
          복원 시 <b>복원 전 원본</b>은 <code>localStorage → prerepair_snapshot</code>에 별도 보존됩니다.
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setRepairPrompt(null)} style={{flex:1,padding:"9px 0",fontSize:12,border:`1px solid ${themeObj.ibr}`,borderRadius:8,cursor:"pointer",background:themeObj.ib,color:themeObj.t2}}>
            취소 (손상된 상태 유지)
          </button>
          <button onClick={()=>applyRepair(repairPrompt.raw,repairPrompt.repaired)} style={{flex:2,padding:"9px 0",fontSize:12,fontWeight:600,border:"none",borderRadius:8,cursor:"pointer",background:"#007AFF",color:"#fff"}}>
            ✓ 복원하기 (원본도 함께 저장)
          </button>
        </div>
      </div>
    </div>}
    {showSyncSetup&&<GitHubSyncSetup t={themeObj} config={githubSync} onSave={(cfg)=>{setGithubSync(cfg);localStorage.setItem("githubSyncConfig",JSON.stringify(cfg));}} onClose={()=>setShowSyncSetup(false)} onPull={(data)=>{const r=repairAppData(data);if(Array.isArray(r.projects)&&r.projects.length)setProjects(r.projects);if(Array.isArray(r.sources))setSources(r.sources);if(Array.isArray(r.uiComponents))setUiComponents(r.uiComponents);if(Array.isArray(r.tokenSets))setTokenSets(r.tokenSets);if(data.catalogData?.nodes?.length)setCatalogData(data.catalogData);}} appData={{projects,sources,uiComponents,tokenSets,catalogData}} dataSha={dataSha} onShaUpdate={setDataSha}/>}
    {showSnapshotPanel&&<SnapshotPanel t={themeObj} config={supabaseConfig} onSaveConfig={(cfg)=>{setSupabaseConfig(cfg);localStorage.setItem("supabaseConfig",JSON.stringify(cfg));}} appData={{projects,sources,uiComponents,tokenSets,catalogData}} projects={projects} onRestore={handleSnapshotRestore} onClose={()=>setShowSnapshotPanel(false)}/>}
    {autoSnapPrompt&&!autoSnapSkip&&<AutoSnapPrompt t={themeObj} prompt={autoSnapPrompt} supabaseConfig={supabaseConfig} appData={{projects,sources,uiComponents,tokenSets,catalogData}} projects={projects} onDone={()=>setAutoSnapPrompt(null)} onSkipSession={()=>{setAutoSnapSkip(true);setAutoSnapPrompt(null);}}/>}
    <style>{CSS}</style>
  <div className={`app ${dark?"dark":"light"}`}>

    {/* ═══ SIDEBAR (갤러리 모드만) ═══ */}
    {!inEditor&&(
      <div className="sb">
        <div className="sb-h">
          <div className="sb-logo" onClick={()=>{setNav("studio");setStTab("프로젝트")}}>Visual App Studio</div>
          <button className="sb-tb" onClick={()=>setDark(!dark)}>{dark?<Sun/>:<Moon/>}</button>
        </div>
        <div className="sb-sr"><Search/><input placeholder="검색..."/></div>
        <div className="sb-s">
          <div className={`sb-i ${nav==="studio"?"on":""}`} onClick={()=>{setNav("studio");setStTab("프로젝트")}}><span className="ic">🏠</span>스튜디오<span className="bd">{projects.length}</span></div>
          <div className={`sb-i ${nav==="foundation"?"on":""}`} onClick={()=>setNav("foundation")}><span className="ic">🎨</span>파운데이션</div>
          <div className={`sb-i ${nav==="collect"?"on":""}`} onClick={()=>setNav(nav==="collect"?"studio":"collect")}><span className="ic">📥</span>카탈로그{totalCollect>0&&<span className="bd" style={{background:"var(--orange)"}}>{totalCollect}</span>}</div>
          <div className={`sb-i ${nav==="references"?"on":""}`} onClick={()=>setNav("references")}><span className="ic">📚</span>레퍼런스</div>
          <div className="sb-dv"/>
          <div className={`sb-i ${nav==="commit"?"on":""}`} onClick={()=>setNav("commit")}><span className="ic">📋</span>커밋</div>
          <div className={`sb-i ${nav==="rules"?"on":""}`} onClick={()=>setNav("rules")}><span className="ic">📄</span>규칙/문서</div>
        </div>
        <div className="sb-ft">
          <div style={{padding:"6px 12px",display:"flex",alignItems:"center",gap:6,fontSize:11}}>
            <span title={syncStatus==="error"&&syncErrMsg?syncErrMsg:undefined} style={{color:githubSync?.enabled?(syncStatus==="ok"?"var(--green)":syncStatus==="error"?"var(--red)":syncStatus==="syncing"?"var(--orange)":"var(--t3)"):"var(--t3)",fontWeight:600,cursor:syncStatus==="error"?"help":"default"}}>
              {githubSync?.enabled?(syncStatus==="ok"?"✓ 동기화됨":syncStatus==="error"?`✗ 오류`:syncStatus==="syncing"?"↻ 저장중…":"대기"):"☁ 미연결"}
            </span>
            {syncStatus==="error"&&syncErrMsg&&<span style={{fontSize:9,color:"var(--red)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={syncErrMsg}>{syncErrMsg}</span>}
            {githubSync?.enabled&&<button onClick={pushNow} disabled={syncStatus==="syncing"} style={{marginLeft:"auto",fontSize:10,padding:"2px 8px",borderRadius:5,border:"1px solid var(--sep)",background:"var(--bg2)",color:"var(--t2)",cursor:"pointer"}}>Push</button>}
          </div>
          <div style={{padding:"0 12px 6px",display:"flex",alignItems:"center",gap:6,fontSize:11}}>
            <span style={{color:supabaseConfig?.url?"var(--green)":"var(--t3)",fontWeight:600}}>
              {supabaseConfig?.url?"🗄️ Supabase 연결됨":"🗄️ Supabase 미연결"}
            </span>
            <button onClick={()=>setShowSnapshotPanel(true)} style={{marginLeft:"auto",fontSize:10,padding:"2px 8px",borderRadius:5,border:"1px solid var(--sep)",background:"var(--bg2)",color:"var(--t2)",cursor:"pointer"}}>스냅샷</button>
          </div>
          <div className={`sb-i ${nav==="manage"?"on":""}`} onClick={()=>setNav("manage")}><span className="ic">🔗</span>관리</div>
        </div>
      </div>
    )}

    {/* ═══ EDITOR (프로젝트 열림) ═══ */}
    {inEditor&&(
      <div className="ed">
        <div className="ed-body">
          {/* 2. 프리뷰 패널 (헤더 + 콘텐츠) */}
          <div className={`pv${targetMode?" target-mode":""}`} style={{width:pvW}}>
            {/* 플로팅 디자인 리모컨 */}
            {selElement&&!pvAria&&!pvCode&&(
              <div className="dp-remote" style={remotePos.x!==null?{position:"fixed",left:remotePos.x,top:remotePos.y,right:"auto"}:{}} onClick={e=>e.stopPropagation()} onMouseDown={onRemoteDown}>
                <div className="dp-remote-head" style={{cursor:"grab"}}>
                  <span style={{fontSize:10,fontWeight:700,fontFamily:"monospace",color:T.accent}}>{selElement.tag}</span>
                  <span style={{fontSize:11,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selElement.label}</span>
                  <button style={{background:"none",border:"none",cursor:"pointer",color:T.unit,fontSize:14,padding:0}} onClick={()=>setSelElement(null)}>✕</button>
                </div>
                <DesignRemoteBody key={selElement.tag+"_"+selElement.label} selElement={selElement} onStyleChange={handleStyleChange}/>
              </div>
            )}
            {/* 프리뷰 헤더 */}
            <div className="ed-bar">
              <button className="ed-back" onClick={()=>{setOP(null);setCurState(null)}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                갤러리
              </button>
              <div className="ed-sep"/>
              <button className="ed-btn" title="실행취소" onClick={undo} style={historyIdx<=0?{opacity:.3}:{}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 2.64-7.36L3 7"/></svg></button>
              <button className="ed-btn" title="실행복구" onClick={redo} style={historyIdx>=history.length-1?{opacity:.3}:{}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-2.64-7.36L21 7"/></svg></button>
              <div className="ed-sep"/>
              <button className="ed-btn" onClick={()=>setPvMode(pvMode==="full"?"phone":"full")} title={pvMode==="full"?"폰 보기":"풀 보기"} style={{color:"var(--blue)"}}>{pvMode==="phone"?"📱":"🖥"}</button>
              <button className="ed-btn" onClick={()=>setPvDark(!pvDark)} title={pvDark?"앱 라이트모드":"앱 다크모드"}>{pvDark?<Sun/>:<Moon/>}</button>
              <div className="ed-sep"/>
              <select className="ed-dd" value={curState||curPage} onChange={e=>{const v=e.target.value;if(v.startsWith("s")){setCurState(v);setCurPage(STATES.find(s=>s.id===v)?.page||"p1")}else{setCurPage(v);setCurState(null)}setSelEl(null)}}>
                <optgroup label="페이지">
                  {PAGES.map(pg=><option key={pg.id} value={pg.id}>{pg.emoji} {pg.name}</option>)}
                </optgroup>
                <optgroup label="상태 레이어">
                  {STATES.map(st=><option key={st.id} value={st.id}>{st.emoji} {st.name}</option>)}
                </optgroup>
              </select>
              <button className="ed-btn" onClick={()=>{setPvAria(!pvAria);setMicroPopup(null);setSelAria(null)}} title="아리아 보기" style={pvAria?{color:"var(--blue)"}:{}}>A</button>
            </div>
            <div className="pv-frame" onClick={(e)=>{if(e.target===e.currentTarget){if(!pvCode)setShowStrip(!showStrip);setPvHighlight(null);setSelElement(null);setElInfo(null);setElSheet(null);setSheetTip(null);setEditingRule(false)}}}>
              {targetMode&&<div style={{position:"absolute",top:0,left:0,right:0,zIndex:20,background:"rgba(0,122,255,.9)",color:"#fff",fontSize:11,fontWeight:600,textAlign:"center",padding:"4px 0",letterSpacing:.3}}>🎯 클릭 또는 드래그로 영역 선택</div>}
              {/* 아리아 뷰 — 영역별 독립 렌더링 + 저장 */}
              {pvAria&&ariaRegions&&(
                <div style={{width:"100%",overflow:"auto",padding:16,background:"var(--bg1)",position:"relative"}} onClick={e=>{e.stopPropagation();if(!targetMode)setSelAria(null)}} onMouseDown={handlePvTargetDown}>
                  {/* 드래그 선택 사각형 (아리아 뷰) */}
                  {targetMode&&dragSel&&dragSel.w>4&&<div style={{position:"absolute",top:dragSel.y,left:dragSel.x,width:dragSel.w,height:dragSel.h,border:"2px dashed var(--blue)",background:"rgba(0,122,255,.05)",borderRadius:2,pointerEvents:"none",zIndex:15}}/>}
                  {/* 맨 위 드롭존 */}
                  <div onDragOver={e=>{e.preventDefault();setDropTarget(0)}} onDragLeave={()=>setDropTarget(null)} onDrop={e=>{e.preventDefault();if(dragIdx!==null&&dragIdx!==0)onAriaReorder(dragIdx,0);setDropTarget(null)}} style={{height:dropTarget===0&&dragIdx!==0?4:0,background:dropTarget===0&&dragIdx!==0?"var(--blue)":"transparent",borderRadius:2,transition:"height .15s",marginBottom:dropTarget===0&&dragIdx!==0?8:0}}/>
                  {ariaRegions.map((region,i)=>{
                    const borders=["#007AFF","#34C759","#FF9500","#5856D6","#FF3B30","#5AC8FA"];
                    const b=borders[i%borders.length];
                    const isDropHere=dropTarget===i+1&&dragIdx!==i&&dragIdx!==i+1;
                    return(
                      <div key={i}>
                        <div draggable
                          onDragStart={e=>{setDragIdx(i);e.dataTransfer.effectAllowed="move"}}
                          onDragEnd={()=>{setDragIdx(null);setDropTarget(null)}}
                          style={{marginBottom:0,opacity:dragIdx===i?0.3:(selAria!==null&&selAria!==i?0.45:1),cursor:"grab",transition:"opacity .15s"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,opacity:selAria!==null&&selAria!==i?0.4:1,transition:"opacity .15s"}}>
                            <span style={{fontSize:14,color:"var(--t3)",cursor:"grab",userSelect:"none",lineHeight:1}}>⠿</span>
                            <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",color:selAria===i?b:"var(--t3)",border:`1px solid ${selAria===i?b:"var(--sep)"}`,padding:"1px 6px",borderRadius:3}}>{region.role}</span>
                            <span style={{fontSize:12,fontWeight:600,color:"var(--t1)"}}>{region.label}</span>
                            <span style={{fontSize:9,color:"var(--t3)",fontFamily:"monospace"}}>&lt;{region.tag}&gt;</span>
                            <div style={{marginLeft:"auto",display:"flex",gap:4}}>
                              <button className="cb" style={{fontSize:9}} onClick={e=>{e.stopPropagation();e.preventDefault();navigator.clipboard.writeText(region.html).then(()=>{const btn=e.currentTarget;btn.textContent="✅ 완료";setTimeout(()=>{btn.textContent="📋 복사"},1200)})}}>📋 복사</button>
                              <button className="cb" style={{fontSize:9}} onClick={e=>{e.stopPropagation();e.preventDefault();const content="<!DOCTYPE html><html><head><meta charset='utf-8'><title>"+region.label+"</title></head><body>"+region.html+"</body></html>";const a=document.createElement("a");a.setAttribute("href","data:text/html;charset=utf-8,"+encodeURIComponent(content));a.setAttribute("download",`${region.role}_${(region.label||"region").replace(/[^a-zA-Z0-9가-힣]/g,"_")}.html`);a.setAttribute("target","_blank");a.style.display="none";document.body.appendChild(a);a.click();setTimeout(()=>document.body.removeChild(a),200)}}>💾 저장</button>
                            </div>
                          </div>
                          <div onClick={e=>{e.stopPropagation();setSelAria(selAria===i?null:i)}} onDoubleClick={e=>{e.stopPropagation();setSelAria(i);setWpTab("와이어프레임")}} style={{borderRadius:10,overflow:"hidden",background:"#fff",border:selAria===i?`2.5px solid ${b}`:"1px solid var(--sep)",boxShadow:selAria===i?`0 0 0 3px ${b}30`:"none",transition:"border .15s, box-shadow .15s",cursor:"pointer",...(pvDark?{filter:"invert(1) hue-rotate(180deg)"}:{})}}>
                            <div dangerouslySetInnerHTML={{__html:region.html}}/>
                          </div>
                        </div>
                        {/* 아이템 사이 드롭존 — 넓은 히트 영역 */}
                        <div
                          onDragOver={e=>{e.preventDefault();setDropTarget(i+1)}}
                          onDragLeave={()=>setDropTarget(null)}
                          onDrop={e=>{e.preventDefault();if(dragIdx!==null)onAriaReorder(dragIdx,i+1);setDropTarget(null)}}
                          style={{padding:"6px 0",cursor:dragIdx!==null?"copy":"default"}}>
                          <div style={{height:isDropHere?4:1,background:isDropHere?"var(--blue)":"transparent",borderRadius:2,transition:"height .1s, background .1s"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* 코드 뷰 */}
              {!pvAria&&pvCode&&(
                <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",background:"#1e1e1e",position:"relative"}}>
                  <div style={{display:"flex",gap:4,padding:"8px 12px",borderBottom:"1px solid #333",flexShrink:0}}>
                    <button className="cb" style={{fontSize:10,color:"#aaa",borderColor:"#444"}} onClick={e=>{e.stopPropagation();e.preventDefault();navigator.clipboard.writeText(curPageHtml).then(()=>{const btn=e.currentTarget;btn.textContent="✅ 완료";setTimeout(()=>{btn.textContent="📋 복사"},1200)})}}>📋 복사</button>
                    <button className="cb" style={{fontSize:10,color:"#aaa",borderColor:"#444"}} onClick={e=>{e.stopPropagation();setPvCode(false)}}>✕ 닫기</button>
                  </div>
                  <textarea style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.8,color:"#d4d4d4",background:"transparent",border:"none",outline:"none",resize:"none",padding:"12px 16px",width:"100%",boxSizing:"border-box"}} defaultValue={curPageHtml} spellCheck={false} onClick={e=>e.stopPropagation()}/>
                </div>
              )}
              {!pvCode&&!pvAria&&pvMode==="full"&&(
                <div className="pv-full" style={pvDark?{filter:"invert(1) hue-rotate(180deg)"}:{}}>
                  <div className="pv-render" dangerouslySetInnerHTML={{__html:curPageHtml}} onClick={handlePvClick} onMouseDown={handlePvTargetDown} onMouseMove={handlePvMouseMove} onMouseLeave={handlePvMouseLeave}/>
                  {/* Highlight overlay (single click) */}
                  {pvHighlight&&pvHighlight.rect&&<>
                    <div style={{position:"absolute",top:pvHighlight.rect.top,left:pvHighlight.rect.left,width:pvHighlight.rect.width,height:pvHighlight.rect.height,border:"2px dashed #007AFF",background:"none",borderRadius:3,pointerEvents:"none",zIndex:10}}/>
                    <div style={{position:"absolute",top:Math.max(0,pvHighlight.rect.top-20),left:pvHighlight.rect.left,zIndex:11,pointerEvents:"none",display:"flex",gap:4}}>
                      <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",background:"#007AFF",color:"#fff",padding:"2px 6px",borderRadius:"3px 3px 0 0",lineHeight:"14px"}}>{pvHighlight.codeName||pvHighlight.tag}</span>
                      {pvHighlight.compType&&<span style={{fontSize:9,fontWeight:500,background:"rgba(0,122,255,.15)",color:"#007AFF",padding:"2px 6px",borderRadius:"3px 3px 0 0",lineHeight:"14px"}}>{pvHighlight.compType}</span>}
                    </div>
                  </>}
                  {/* Hover tooltip */}
                  {pvHover&&pvHover.rect&&<div className="pv-tooltip" style={{position:"absolute",top:Math.max(0,pvHover.rect.top-42),left:pvHover.rect.left}}>
                    <span style={{fontWeight:600,color:"#1a1a1a"}}>{pvHover.codeName}</span>
                    <span style={{color:"#666",margin:"0 4px"}}>·</span>
                    <span style={{color:"#888"}}>{pvHover.compType}</span>
                    <span style={{color:"#666",margin:"0 4px"}}>·</span>
                    <span style={{color:"#666",fontFamily:"monospace",fontSize:9}}>{pvHover.folder}</span>
                  </div>}
                  {/* Design remote overlay (double click) */}
                  {/* Drag selection rectangle */}
                  {targetMode&&dragSel&&dragSel.w>4&&<div style={{position:"absolute",top:dragSel.y,left:dragSel.x,width:dragSel.w,height:dragSel.h,border:"2px dashed var(--blue)",background:"rgba(0,122,255,.05)",borderRadius:2,pointerEvents:"none",zIndex:15}}/>}
                  {/* Selection overlay */}
                  {selElement&&selElement.rect&&<div style={{position:"absolute",top:selElement.rect.top,left:selElement.rect.left,width:selElement.rect.width,height:selElement.rect.height,border:"2px dashed #FF9500",background:"none",borderRadius:4,pointerEvents:"none",zIndex:11}}/>}
                  {curState&&(<>
                    <div className="pv-state-bg"/>
                    <div className="pv-state-layer" onClick={e=>e.stopPropagation()}>
                      <div className="pv-state-head">
                        <span>{activeState?.emoji} {activeState?.name}</span>
                        <span style={{fontSize:10,color:"var(--t3)",background:"var(--bg4)",padding:"2px 7px",borderRadius:4}}>모달</span>
                      </div>
                      <div className="pv-state-body">
                        <input className="pv-state-input" placeholder="📧 이메일" defaultValue="user@example.com"/>
                        <input className="pv-state-input" type="password" placeholder="🔑 비밀번호" defaultValue="password"/>
                        <button className="pv-state-btn primary">로그인</button>
                        <button className="pv-state-btn ghost">닫기</button>
                      </div>
                    </div>
                  </>)}
                </div>
              )}

              {/* 폰 모드 — iPhone 13 Pro */}
              {!pvCode&&!pvAria&&pvMode==="phone"&&(
                <div className="pv-phone-wrap">
                  <div className="iphone" style={{zoom:Math.min((pvW-40)/410,0.88)}}>
                    <div className="iphone-inner">
                    <div className="iphone-bezel">
                    <div className="iphone-notch"><div className="iphone-notch-speaker"/><div className="iphone-notch-cam"/></div>
                    <div className="iphone-screen" style={pvDark?{filter:"invert(1) hue-rotate(180deg)"}:{}}>
                      <div className="iphone-status" style={pvDark?{background:"#000",color:"#fff"}:{}}>
                        <span>9:41</span>
                        <div className="iphone-status-r">
                          <div className="iphone-bars">
                            <span style={{height:4,background:pvDark?"#fff":"#0a0a0a"}}/><span style={{height:7,background:pvDark?"#fff":"#0a0a0a"}}/><span style={{height:10,background:pvDark?"#fff":"#0a0a0a"}}/><span style={{height:13,background:pvDark?"#fff":"#0a0a0a"}}/>
                          </div>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill={pvDark?"#fff":"#0a0a0a"}><path d="M1.42 6.72a1 1 0 011.38-.3A16.67 16.67 0 0112 3.5c3.37 0 6.55 1.02 9.2 2.92a1 1 0 01-1.08 1.68A14.67 14.67 0 0012 5.5a14.67 14.67 0 00-8.12 2.6 1 1 0 01-1.38-.3l-.08-.08zM5.4 11a1 1 0 011.34-.42A10.7 10.7 0 0112 9a10.7 10.7 0 015.26 1.58 1 1 0 01-.92 1.76A8.7 8.7 0 0012 11a8.7 8.7 0 00-4.34 1.34A1 1 0 015.4 11zm4.2 4a1 1 0 011.22-.5A4.6 4.6 0 0112 14.2c.4 0 .8.1 1.18.3a1 1 0 01-.72 1.86l-.46-.16-.46.16a1 1 0 01-.72-1.86l-.22.5zM12 18a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/></svg>
                          <div className="iphone-batt"><div className="iphone-batt-fill" style={{width:"82%"}}/></div>
                        </div>
                      </div>
                      <div className="iphone-content" onClick={handlePvClick} onMouseDown={handlePvTargetDown} onMouseMove={handlePvMouseMove} onMouseLeave={handlePvMouseLeave}>
                        <div dangerouslySetInnerHTML={{__html:curPageHtml}}/>
                        {/* ═══ Overlays (phone mode) ═══ */}
                        {pvHighlight&&pvHighlight.rect&&<>
                          <div style={{position:"absolute",top:pvHighlight.rect.top,left:pvHighlight.rect.left,width:pvHighlight.rect.width,height:pvHighlight.rect.height,border:"2px dashed #007AFF",background:"none",borderRadius:3,pointerEvents:"none",zIndex:10}}/>
                          <div style={{position:"absolute",top:Math.max(0,pvHighlight.rect.top-20),left:pvHighlight.rect.left,zIndex:11,pointerEvents:"none",display:"flex",gap:4}}>
                            <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",background:"#007AFF",color:"#fff",padding:"2px 6px",borderRadius:"3px 3px 0 0",lineHeight:"14px"}}>{pvHighlight.codeName||pvHighlight.tag}</span>
                            {pvHighlight.compType&&<span style={{fontSize:9,fontWeight:500,background:"rgba(0,122,255,.15)",color:"#007AFF",padding:"2px 6px",borderRadius:"3px 3px 0 0",lineHeight:"14px"}}>{pvHighlight.compType}</span>}
                          </div>
                        </>}
                        {pvHover&&pvHover.rect&&<div className="pv-tooltip" style={{position:"absolute",top:Math.max(0,pvHover.rect.top-42),left:pvHover.rect.left}}>
                          <span style={{fontWeight:600,color:"#1a1a1a"}}>{pvHover.codeName}</span>
                          <span style={{color:"#666",margin:"0 4px"}}>·</span>
                          <span style={{color:"#888"}}>{pvHover.compType}</span>
                          <span style={{color:"#666",margin:"0 4px"}}>·</span>
                          <span style={{color:"#666",fontFamily:"monospace",fontSize:9}}>{pvHover.folder}</span>
                        </div>}
                        {targetMode&&dragSel&&dragSel.w>4&&<div style={{position:"absolute",top:dragSel.y,left:dragSel.x,width:dragSel.w,height:dragSel.h,border:"2px dashed var(--blue)",background:"rgba(0,122,255,.05)",borderRadius:2,pointerEvents:"none",zIndex:15}}/>}
                        {selElement&&selElement.rect&&<div style={{position:"absolute",top:selElement.rect.top,left:selElement.rect.left,width:selElement.rect.width,height:selElement.rect.height,border:"2px dashed #FF9500",background:"none",borderRadius:4,pointerEvents:"none",zIndex:11}}/>}
                        {/* ═══ End overlays ═══ */}
                        {curState&&(<>
                          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.4)",zIndex:3}}/>
                          <div style={{position:"absolute",zIndex:4,left:20,right:20,top:120,background:"#fff",borderRadius:16,boxShadow:"0 12px 40px rgba(0,0,0,.25)",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
                            <div style={{padding:"14px 16px",borderBottom:"1px solid #eee",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                              <span>{activeState?.emoji} {activeState?.name}</span>
                              <span style={{fontSize:11,color:"#aeaeb2"}}>모달</span>
                            </div>
                            <div style={{padding:16}}>
                              <input style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #e8e8ed",fontSize:14,marginBottom:10,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}} placeholder="📧 이메일" defaultValue="user@example.com"/>
                              <input style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #e8e8ed",fontSize:14,marginBottom:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}} type="password" placeholder="🔑 비밀번호" defaultValue="password"/>
                              <button style={{width:"100%",padding:12,borderRadius:10,border:"none",background:"#007AFF",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:6}}>로그인</button>
                              <button style={{width:"100%",padding:12,borderRadius:10,border:"none",background:"#f5f5f7",color:"#6e6e73",fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>닫기</button>
                            </div>
                          </div>
                        </>)}
                      </div>
                      <div className="iphone-home"><div className="iphone-home-bar"/></div>
                    </div>
                    </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Agent change badge */}
            {agentChanges.length>0&&!pvCode&&!pvAria&&(
              <div className="pv-badge" onClick={()=>{if(elSheet&&elSheet.codeName==="__changes__")setElSheet(null);else setElSheet({codeName:"__changes__"})}}>
                {agentChanges.length}
              </div>
            )}

            {/* Bottom sheet — element specs */}
            {elSheet&&elSheet.codeName!=="__changes__"&&(
              <div className="pv-sheet" onClick={e=>e.stopPropagation()}>
                <div style={{padding:"10px 14px",borderBottom:"0.5px solid var(--sep)",display:"flex",alignItems:"center",gap:6,position:"sticky",top:0,background:"var(--elbg,#fff)",zIndex:1}} onMouseEnter={e=>{const b=e.currentTarget.querySelector(".sheet-edit-btn");if(b)b.style.opacity=1}} onMouseLeave={e=>{const b=e.currentTarget.querySelector(".sheet-edit-btn");if(b&&!elSheetEdit)b.style.opacity=0}}>
                  <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",background:"var(--blue)",color:"#fff",padding:"2px 6px",borderRadius:3}}>{elSheet.codeName}</span>
                  <span style={{fontSize:10,color:"var(--t3)"}}>요소 명세</span>
                  <button className="sheet-edit-btn" onClick={()=>{if(elSheetEdit){saveSheetData(elSheet.codeName,elSheet);setElSheetEdit(false)}else setElSheetEdit(true)}} style={{marginLeft:"auto",opacity:elSheetEdit?1:0,background:"none",border:"none",cursor:"pointer",color:elSheetEdit?"var(--blue)":"var(--t2)",fontSize:12,padding:"2px 4px",transition:"opacity .15s"}}>{elSheetEdit?"✓ 저장":"✏️"}</button>
                  <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:12,padding:0}} onClick={()=>{if(elSheetEdit){saveSheetData(elSheet.codeName,elSheet)};setElSheet(null);setElSheetEdit(false);setSheetTip(null)}}>✕</button>
                </div>
                {/* 소속 분류 */}
                <div style={{padding:"6px 14px",borderBottom:"0.5px solid var(--sep)",background:"var(--bg3)",display:"flex",alignItems:"center",gap:4,flexWrap:"wrap",fontSize:10}}>
                  {(()=>{
                    const tag=elSheet.tag||"div";
                    const ct=elSheet.compType||"요소";
                    const tree=(elSheet.folder||"").split(" > ").filter(Boolean);
                    // Determine page
                    const pageLabel=PAGES.find(p=>p.id===curPage)?.name||curPage;
                    // Build breadcrumb: 프로젝트 > 페이지 > 계층 > 폴더추정 > 요소
                    const folderGuess=
                      ["button","input","select","textarea","a","label"].includes(tag)?"/atoms/"+tag+"s/":
                      ["nav","form","ul","ol","table"].includes(tag)?"/components/"+tag+"/":
                      ["header","footer","section"].includes(tag)?"/sections/"+tag+"/":
                      ["svg","img","path"].includes(tag)?"/assets/":
                      "/components/";
                    const crumbs=[
                      {label:projects.find(p=>p.id===oP)?.name||"프로젝트",color:"var(--t3)"},
                      {label:pageLabel,color:"var(--blue)"},
                      {label:ct,color:ct==="원자"?"var(--cyan)":ct==="블록"?"var(--orange)":ct==="섹션"?"var(--purple)":ct==="에셋"?"var(--green)":"var(--t2)"},
                      {label:folderGuess,color:"var(--t3)",mono:true},
                    ];
                    return crumbs.map((c,i)=>(
                      <span key={i} style={{display:"inline-flex",alignItems:"center",gap:4}}>
                        {i>0&&<span style={{color:"var(--t3)",fontSize:9}}>›</span>}
                        <span style={{padding:"1px 6px",borderRadius:3,background:i===2?c.color+"18":"transparent",color:c.color,fontWeight:i===2?600:400,fontFamily:c.mono?"monospace":"inherit"}}>{c.label}</span>
                      </span>
                    ));
                  })()}
                </div>
                {/* 트리 경로 */}
                {elSheet.folder&&elSheet.folder.includes(" > ")&&(
                  <div style={{padding:"4px 14px",borderBottom:"0.5px solid var(--sep)",fontSize:9,fontFamily:"monospace",color:"var(--blue)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={elSheet.folder}>
                    DOM: {elSheet.folder}
                  </div>
                )}
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                  <tbody>
                    {[
                      {f:"인터랙션",tip:"이 요소를 누르거나 입력하면 뭐가 실행되는지.\n\n예시 — '운동 시작' 버튼이면:\n· 클릭 → 운동 종류 선택 화면으로 이동\n· 로딩 중엔 버튼 비활성화 + 스피너 표시\n· 에러 시 토스트 알림 표시\n\n설정법: 여기에 onClick → navigate('/exercise') 식으로 적으면\n에이전트가 해당 코드에 연결합니다.\n\n파일 위치: components/StartButton.jsx 안의 onClick 함수"},
                      {f:"접근성",tip:"시각장애인이 스크린리더로 이 요소를 들었을 때 뭐라고 읽히는지.\n\n예시 — 검색 아이콘 버튼이면:\n· aria-label=\"운동 검색\" (아이콘만 있으니 텍스트 필수)\n· role=\"button\" (클릭 가능하다는 의미)\n· tabIndex=0 (Tab키로 이동 가능)\n· Enter/Space 키로 작동\n\n설정법: 여기에 aria-label 값을 적으면 자동 적용.\n비어있으면 스크린리더가 '버튼' 이라고만 읽어서\n무슨 버튼인지 알 수 없음.\n\n파일 위치: JSX 태그에 직접 속성으로 들어감"},
                      {f:"시각",tip:"이 요소의 겉모습 — 색, 크기, 여백, 둥글기, 그림자.\n\n예시 — Primary 버튼이면:\n· 배경: #007AFF (파란색)\n· 글자: #FFFFFF 15px 굵기600\n· 모서리: 12px 둥글게\n· 패딩: 상하14px 좌우0 (꽉 채움)\n· hover시: 밝기 90%\n\n설정법: CSS 속성을 그대로 적으면 됨.\n디자인 리모컨(더블클릭)에서도 수정 가능.\n\n파일 위치: style 속성 또는 styles/buttons.css"},
                      {f:"훅",tip:"이 요소가 쓰는 '자동 연결 장치'.\n화면이 열릴 때 자동으로 데이터를 불러오거나,\n입력값이 바뀔 때 자동으로 뭔가 실행해주는 것.\n\n예시 — 검색 입력창이면:\n· useDebounce(300ms): 타이핑 멈추고 0.3초 후 검색 실행\n  (글자 칠 때마다 검색하면 서버 과부하)\n· useRef: 입력창에 자동 포커스\n\n예시 — 대시보드 통계면:\n· useQuery('stats'): 화면 열리면 서버에서 통계 자동 로딩\n\n설정법: 훅 이름을 적으면 에이전트가 import 연결.\n\n파일 위치: hooks/useDebounce.js"},
                      {f:"헬퍼",tip:"숫자 변환, 날짜 형식, 글자 자르기 같은 '계산 도구'.\n코드 여기저기서 반복해서 쓰는 작은 함수들.\n\n예시 — 칼로리 표시면:\n· formatNumber(1240) → '1,240' (콤마 넣기)\n\n예시 — 운동 기록 날짜면:\n· formatDate('2026-03-29') → '3월 29일 (토)'\n· timeAgo('2026-03-29T10:00') → '2시간 전'\n\n예시 — 긴 운동 이름이면:\n· truncate('바벨 루마니안 데드리프트', 8) → '바벨 루마니...'\n\n설정법: 함수명을 적으면 에이전트가 utils/에서 찾거나 생성.\n\n파일 위치: utils/formatNumber.js, utils/formatDate.js"},
                      {f:"API",tip:"이 요소가 서버와 주고받는 데이터 통신.\n'어떤 주소로, 어떤 데이터를, 어떤 방식으로' 보내는지.\n\n예시 — 로그인 버튼이면:\n· POST /api/auth/login\n  보내는 것: {email, password}\n  받는 것: {token, user}\n  실패 시: {error: '비밀번호 불일치'}\n\n예시 — 운동 목록이면:\n· GET /api/exercises?date=2026-03-29\n  받는 것: [{id, name, sets, reps}]\n\n설정법: 메서드 + URL + 보내는/받는 형태를 적으면\n에이전트가 api/ 폴더에 통신 함수를 생성.\n\n파일 위치: api/auth.js, api/exercises.js"},
                      {f:"데이터",tip:"이 요소가 다루는 정보의 '빈칸 양식'.\n어떤 형태의 값을 받고, 어떤 형태로 보여주는지.\n\n예시 — 운동 기록 카드면:\n  받는 데이터(props):\n  · name: '벤치프레스' (글자, 필수)\n  · sets: 3 (숫자, 필수)\n  · reps: 10 (숫자, 필수)\n  · weight: 60 (숫자, 선택, 단위:kg)\n\n예시 — 이메일 입력창이면:\n  · type: 'email'\n  · 유효성: @ 포함, .com/.co.kr 등\n  · 에러문구: '올바른 이메일을 입력하세요'\n\n설정법: 필드명: 타입 (필수/선택) 형태로 적으면\n에이전트가 schemas/에 검증 코드 생성.\n\n파일 위치: schemas/exercise.js, types/Exercise.ts"},
                      {f:"store",tip:"이 요소가 읽거나 쓰는 '전역 공유 기억'.\n화면을 이동해도 사라지지 않는 데이터.\n\n예시 — 헤더의 사용자 이름 표시면:\n· authStore.user.name 읽기\n  (로그인 시 저장된 값을 헤더가 읽어와 표시)\n\n예시 — 운동 시작 버튼이면:\n· exerciseStore.currentExercise 쓰기\n  (선택한 운동을 저장 → 다음 화면에서 사용)\n\n설정법: storeName.필드명 읽기/쓰기로 적으면\n에이전트가 store 구독 코드 연결.\n\n파일 위치: store/authStore.js\n예시 코드: const {user} = useAuthStore()"},
                      {f:"정보 연결",tip:"이 요소의 위아래 관계 — 누구 안에 있고, 옆에 뭐가 있는지.\n\n표시 내용 해석법:\n· 부모: div[오늘운동기록]\n  = 이 요소가 '오늘 운동 기록'이라는 영역 안에 들어있음.\n  부모가 삭제되면 이 요소도 함께 사라짐.\n\n· 이전: div[데드리프트3세트]\n  = 화면에서 이 요소 바로 위에 '데드리프트 3세트' 카드가 있음.\n  이전 요소 높이가 바뀌면 이 요소 위치도 밀림.\n\n· 이후: button[세트추가]\n  = 이 요소 바로 아래에 '세트 추가' 버튼이 있음.\n  이 요소가 사라지면 버튼이 위로 올라옴.\n\n· 형제 총: 5개\n  = 같은 부모 안에 5개 요소가 나란히 있음.\n\n설정법: 에이전트가 DOM에서 자동 감지.\n관계가 바뀌면 '이전 요소 연결 변경됨' 알림.\n\n파일 위치: 코드의 JSX 중첩 구조 (별도 파일 없음)"},
                      {f:"참조 DB",tip:"이 요소가 읽거나 쓰는 DB 테이블과 필드.\n\n예시 — 운동 기록 폼이면:\n· 테이블: exercises\n  필드: id, name, type, muscle_group\n· 테이블: records  \n  필드: id, exercise_id, sets, reps, weight, date\n· 관계: records.exercise_id → exercises.id\n\n예시 — 로그인 폼이면:\n· 테이블: users\n  필드: id, email, password_hash, name\n· 인증: Supabase Auth (별도)\n\n설정법: 테이블명과 사용하는 필드를 적으면\n에이전트가 API 호출 시 올바른 필드 매핑.\n\n파일 위치: supabase/migrations/ 또는 schemas/"},
                      {f:"스니펫",tip:"이 요소의 실제 HTML/JSX 코드 일부.\n지금 프리뷰에 보이는 그 요소의 소스코드.\n\n용도:\n· 에이전트에게 '이 코드 수정해줘' 할 때 참고\n· 다른 프로젝트에 복붙할 때 사용\n· 코드 리뷰 시 현재 구현 확인\n\n설정법: 자동 생성 (편집 불필요).\n수정하고 싶으면 코드뷰(</>) 모드에서 직접 편집.\n\n파일 위치: 해당 컴포넌트 파일\n예: components/LoginButton.jsx"},
                    ].map(({f,tip})=>(
                      <tr key={f} style={{borderBottom:"0.5px solid var(--sep)"}}>
                        <td style={{padding:"6px 14px",color:"var(--t3)",fontWeight:600,width:60,verticalAlign:"top",whiteSpace:"nowrap",position:"relative",cursor:"help"}}
                          onMouseEnter={e=>{const r=e.currentTarget.getBoundingClientRect();setSheetTip({field:f,tip,x:r.right+4,y:r.top})}}
                          onMouseLeave={()=>setSheetTip(null)}>
                          {f}
                        </td>
                        <td style={{padding:"6px 14px",color:"var(--t1)",fontFamily:f==="스니펫"?"monospace":"inherit",wordBreak:"break-all"}}>
                          {elSheetEdit?
                            <textarea value={elSheet[f]||""} onChange={e=>setElSheet(p=>({...p,[f]:e.target.value}))} style={{width:"100%",boxSizing:"border-box",border:"0.5px solid var(--sep)",borderRadius:4,padding:"3px 6px",fontSize:10,fontFamily:"inherit",color:"var(--t1)",background:"var(--bg3)",resize:"vertical",outline:"none",minHeight:24,lineHeight:1.5}}/>
                            :<>
                              <pre style={{margin:0,whiteSpace:"pre-wrap",lineHeight:1.5,fontSize:10}}>{elSheet[f]||<span style={{color:"var(--t3)",fontStyle:"italic"}}>없음</span>}</pre>
                              {f==="스니펫"&&elSheet[f]&&<button onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(elSheet[f]);const b=e.currentTarget;b.textContent="✅ 복사됨";setTimeout(()=>{b.textContent="📋 복사"},1200)}} style={{marginTop:4,background:"none",border:"0.5px solid var(--sep)",borderRadius:4,padding:"2px 8px",fontSize:9,color:"var(--blue)",cursor:"pointer"}}>📋 복사</button>}
                            </>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Term tooltip */}
                {sheetTip&&<div style={{position:"fixed",left:Math.min(sheetTip.x,window.innerWidth-340),top:Math.max(8,Math.min(sheetTip.y,window.innerHeight-300)),zIndex:9999,background:"#FFFDE7",border:"1px solid #E0D84C",padding:"10px 14px",fontSize:11,lineHeight:1.7,color:"#333",maxWidth:320,whiteSpace:"pre-wrap",pointerEvents:"none",boxShadow:"0 2px 8px rgba(0,0,0,.12)"}}>{sheetTip.tip}</div>}
              </div>
            )}

            {/* Agent changes list */}
            {elSheet&&elSheet.codeName==="__changes__"&&(
              <div className="pv-sheet" onClick={e=>e.stopPropagation()}>
                <div style={{padding:"10px 14px",borderBottom:"0.5px solid var(--sep)",display:"flex",alignItems:"center",gap:6,position:"sticky",top:0,background:"var(--elbg,#fff)",zIndex:1}}>
                  <span style={{fontSize:10,fontWeight:700,color:"var(--red)"}}>에이전트 변경사항</span>
                  <span style={{fontSize:9,color:"var(--t3)"}}>{agentChanges.length}건</span>
                  <button style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:12,padding:0}} onClick={()=>setElSheet(null)}>✕</button>
                </div>
                {agentChanges.map((ch,i)=>(
                  <div key={i} style={{padding:"8px 14px",borderBottom:"0.5px solid var(--sep)",display:"flex",gap:8,alignItems:"flex-start"}}>
                    <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",background:"rgba(255,59,48,.1)",color:"var(--red)",padding:"2px 6px",borderRadius:3,flexShrink:0}}>{ch.codeName}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:10,color:"var(--t2)",marginBottom:2}}>{ch.field}</div>
                      <div style={{fontSize:10,fontFamily:"monospace"}}>
                        <span style={{color:"var(--red)",textDecoration:"line-through"}}>{ch.old}</span>
                        <span style={{color:"var(--t3)",margin:"0 4px"}}>→</span>
                        <span style={{color:"var(--green)"}}>{ch.new_}</span>
                      </div>
                    </div>
                    <span style={{fontSize:9,color:"var(--t3)",flexShrink:0}}>{ch.time}</span>
                  </div>
                ))}
                <div style={{padding:"8px 14px",display:"flex",gap:6}}>
                  <button className="btn pr" style={{fontSize:10,padding:"4px 12px"}}>전체 승인</button>
                  <button className="cb" style={{fontSize:10}}>전체 거부</button>
                </div>
              </div>
            )}

            {/* 페이지 썸네일 스트립 또는 아리아 마이크로 요소 스트립 */}
            {showStrip&&!pvAria&&(
              <div className="pv-strip" onWheel={e=>{e.currentTarget.scrollLeft+=e.deltaY;e.preventDefault()}}>
                {PAGES.map(pg=>(
                  <div key={pg.id} className={`pv-thumb ${curPage===pg.id&&!curState?"on":""}`}
                    onClick={e=>{e.stopPropagation();setCurPage(pg.id);setCurState(null)}}>
                    <div className="pv-thumb-render">
                      <div className="pv-thumb-inner" dangerouslySetInnerHTML={{__html:PAGE_HTML[pg.id]||""}}/>
                    </div>
                  </div>
                ))}
                {STATES.map(st=>(
                  <div key={st.id} className={`pv-thumb ${curState===st.id?"on":""}`}
                    onClick={e=>{e.stopPropagation();setCurState(st.id);setCurPage(st.page)}}
                    style={curState===st.id?{borderColor:"var(--purple)"}:{}}>
                    <div className="pv-thumb-render" style={{position:"relative"}}>
                      <div className="pv-thumb-inner" style={{opacity:.3}} dangerouslySetInnerHTML={{__html:PAGE_HTML[st.page]||""}}/>
                      <div style={{position:"absolute",inset:"15% 8%",background:"var(--bg2)",border:"2px solid var(--purple)",borderRadius:6,boxShadow:"0 2px 8px rgba(88,86,214,.2)"}}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 아리아 모드: 마이크로 요소 썸네일 스트립 */}
            {pvAria&&showStrip&&(
              <div className="micro-strip" onWheel={e=>{e.currentTarget.scrollLeft+=e.deltaY;e.preventDefault()}}>
                {parseMicroElements(curPageHtml).map((mel,i)=>(
                  <div key={i} className="pv-thumb" onClick={e=>{e.stopPropagation();setMicroPopup(mel)}}>
                    <div className="pv-thumb-render" style={{display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                      <div style={{transform:"scale(0.5)",transformOrigin:"center center",pointerEvents:"none"}} dangerouslySetInnerHTML={{__html:mel.html}}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 마이크로 요소 팝업 */}
            {microPopup&&(
              <>
                <div className="micro-popup-overlay" onClick={()=>setMicroPopup(null)}/>
                <div className="micro-popup">
                  <div className="micro-popup-head">
                    <span>{microPopup.icon}</span>
                    <span>{microPopup.label}</span>
                    <span style={{fontSize:9,color:"var(--t3)",fontFamily:"monospace"}}>&lt;{microPopup.tag}&gt;</span>
                    <span style={{fontSize:9,color:"var(--t3)",fontFamily:"monospace",marginLeft:4}}>{microPopup.type}</span>
                    <button className="ed-btn" style={{marginLeft:"auto",width:24,height:24}} onClick={()=>setMicroPopup(null)}>✕</button>
                  </div>
                  <div className="micro-popup-body" dangerouslySetInnerHTML={{__html:microPopup.html}}/>
                  <div className="micro-popup-foot">
                    <button className="cb" style={{fontSize:10}} onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(microPopup.html).then(()=>{const btn=e.currentTarget;btn.textContent="✅ 완료";setTimeout(()=>{btn.textContent="📋 HTML 복사"},1200)})}}>📋 HTML 복사</button>
                    <button className="cb" style={{fontSize:10}} onClick={e=>{e.stopPropagation();const json=JSON.stringify({type:microPopup.type,tag:microPopup.tag,label:microPopup.label,html:microPopup.html},null,2);navigator.clipboard.writeText(json).then(()=>{const btn=e.currentTarget;btn.textContent="✅ 완료";setTimeout(()=>{btn.textContent="📋 JSON 복사"},1200)})}}>📋 JSON 복사</button>
                    <button className="cb" style={{fontSize:10}} onClick={e=>{e.stopPropagation();const content="<!DOCTYPE html><html><head><meta charset='utf-8'><title>"+microPopup.label+"</title></head><body>"+microPopup.html+"</body></html>";const a=document.createElement("a");a.setAttribute("href","data:text/html;charset=utf-8,"+encodeURIComponent(content));a.setAttribute("download",`${microPopup.type}_${microPopup.label.replace(/[^a-zA-Z0-9가-힣]/g,"_")}.html`);a.setAttribute("target","_blank");a.style.display="none";document.body.appendChild(a);a.click();setTimeout(()=>document.body.removeChild(a),200)}}>💾 저장</button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 2.5 오른쪽 패널 (파일/수집/에이전트) */}
          {rpOpen?(<div className="rp" style={{width:400}}>
            <div className="ed-bar" style={{background:"var(--elbg)",borderBottom:"1px solid var(--sep)"}}>
              <div className="rp-tabs" style={{flex:1,border:"none"}}>
                {["파일","수집","에이전트"].map(t=><button key={t} className={`rp-tab${rpTab===t?" on":""}`} onClick={()=>setRpTab(t)}>{t}</button>)}
              </div>
              <button className="ed-btn" title="패널 접기" onClick={()=>setRpOpen(false)} style={{fontSize:14,flexShrink:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            </div>
            <div className="rp-ct" style={rpTab==="에이전트"?{display:"none"}:{}}>
              {rpTab==="파일"&&(
                <div style={{padding:16}}>
                  <div style={{fontSize:12,fontWeight:600,color:"var(--t1)",marginBottom:12}}>프로젝트 파일</div>
                  {[
                    {f:"index.html",sz:"2.1KB",loc:["로컬","GitHub"]},
                    {f:"home.html",sz:"4.3KB",loc:["로컬","GitHub","Supabase"]},
                    {f:"login.html",sz:"1.8KB",loc:["로컬","GitHub"]},
                    {f:"dashboard.html",sz:"6.2KB",loc:["로컬"]},
                    {f:"components/",loc:["로컬","GitHub"]},
                    {f:"styles/",loc:["로컬","GitHub"]},
                    {f:"assets/",loc:["로컬","Supabase"]},
                    {f:"hooks/",loc:["로컬","GitHub"]},
                    {f:"api/",loc:["로컬","GitHub"]},
                    {f:"store/",loc:["로컬","GitHub"]},
                    {f:"schemas/",loc:["로컬"]},
                  ].map((item,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,cursor:"pointer",fontSize:12,color:"var(--t1)",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <span style={{fontSize:13}}>{item.f.endsWith("/")?"📁":"📄"}</span>
                      <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.f}</span>
                      <div style={{display:"flex",gap:2,flexShrink:0}}>
                        {item.loc.map(l=><span key={l} style={{fontSize:8,padding:"1px 4px",borderRadius:3,fontWeight:600,background:l==="GitHub"?"rgba(36,41,47,.1)":l==="Supabase"?"rgba(62,207,142,.1)":"rgba(0,122,255,.08)",color:l==="GitHub"?"#24292f":l==="Supabase"?"#1a9f60":"var(--blue)"}}>{l==="GitHub"?"GH":l==="Supabase"?"SB":"LC"}</span>)}
                      </div>
                      {item.sz&&<span style={{fontSize:9,color:"var(--t3)",flexShrink:0}}>{item.sz}</span>}
                    </div>
                  ))}
                </div>
              )}
              {rpTab==="수집"&&(
                <div style={{padding:16}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:600,color:"var(--t1)"}}>수집 라이브러리</div>
                    <button className="cb" style={{fontSize:10}} onClick={()=>setShowCollectPopup(true)}>🤖 수집 보내기</button>
                  </div>
                  {Object.entries(COLLECT_DATA).filter(([,v])=>v.length>0).map(([cat,items])=>(
                    <div key={cat} style={{marginBottom:14}}>
                      <div style={{fontSize:11,fontWeight:600,color:"var(--t3)",marginBottom:6}}>{cat}</div>
                      {items.map((item,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,border:"0.5px solid var(--sep)",marginBottom:4,cursor:"pointer",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <span style={{fontSize:14}}>{item.emoji}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.n}</div>
                            {item.t&&<div style={{fontSize:10,color:"var(--t3)"}}>{item.t}</div>}
                          </div>
                          <button className="cb" style={{fontSize:9,flexShrink:0}}>적용</button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* ─── 에이전트 탭 (rp-ct 밖, rp 안) ─── */}
            {rpTab==="에이전트"&&(
              <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
                {/* 대화 메시지 영역 */}
                <div style={{flex:1,overflowY:"auto",padding:"16px 14px",msOverflowStyle:"none",scrollbarWidth:"none"}}>
                  {/* 에이전트 메시지 — 좌측, 말풍선 없이 본문만 */}
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12,color:"var(--t1)",lineHeight:1.7}}>안녕하세요! 프로젝트를 분석하고 있어요. 어떤 작업을 도와드릴까요?</div>
                  </div>
                  {/* 유저 메시지 — 우측, 말풍선 */}
                  <div style={{display:"flex",justifyContent:"flex-end",marginBottom:20}}>
                    <div style={{maxWidth:"85%",fontSize:12,color:"#fff",lineHeight:1.6,background:"var(--blue)",borderRadius:"18px 18px 4px 18px",padding:"10px 16px"}}>히어로 배경을 그라데이션으로 바꿔줘</div>
                  </div>
                  {/* 에이전트 편집 제안 */}
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12,color:"var(--t1)",lineHeight:1.7,marginBottom:10}}>히어로 섹션의 배경을 변경할게요.</div>
                    <div style={{border:"0.5px solid var(--sep)",borderRadius:10,overflow:"hidden",marginBottom:8}}>
                      <div style={{padding:"8px 12px",background:"var(--bg3)",display:"flex",alignItems:"center",gap:6,borderBottom:"0.5px solid var(--sep)"}}>
                        <span style={{fontSize:12}}>📄</span>
                        <span style={{fontSize:11,fontWeight:500,color:"var(--t1)",fontFamily:"monospace"}}>home.html</span>
                        <span style={{fontSize:10,color:"var(--t3)",marginLeft:"auto"}}>+1 -1</span>
                      </div>
                      <div style={{padding:"8px 12px",fontSize:11,fontFamily:"monospace",lineHeight:1.8}}>
                        <div style={{color:"var(--red)",opacity:.7}}>- background: #f5f5f7;</div>
                        <div style={{color:"var(--green)"}}>+ background: linear-gradient(135deg, #667eea, #764ba2);</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button className="btn pr" style={{fontSize:11,padding:"5px 14px",borderRadius:8,gap:4}}>✓ 승인</button>
                      <button className="cb" style={{fontSize:11,padding:"5px 14px",borderRadius:8}}>✕ 거부</button>
                      <button className="cb" style={{fontSize:11,padding:"5px 14px",borderRadius:8}}>👁 미리보기</button>
                    </div>
                  </div>
                  {/* 유저 메시지 */}
                  <div style={{display:"flex",justifyContent:"flex-end",marginBottom:20}}>
                    <div style={{maxWidth:"85%",fontSize:12,color:"#fff",lineHeight:1.6,background:"var(--blue)",borderRadius:"18px 18px 4px 18px",padding:"10px 16px"}}>CTA 버튼 색상도 #FF6B35로 바꿔줘</div>
                  </div>
                  {/* 에이전트 — 코드블록 포함 */}
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12,color:"var(--t1)",lineHeight:1.7,marginBottom:8}}>CTA 버튼의 배경색을 변경했어요.</div>
                    <div style={{background:"var(--bg3)",borderRadius:8,padding:"10px 14px",fontFamily:"monospace",fontSize:11,color:"var(--t1)",lineHeight:1.6,overflowX:"auto"}}>
                      <span style={{color:"var(--t3)"}}>background:</span> <span style={{color:"var(--blue)"}}>#FF6B35</span>;
                    </div>
                  </div>
                </div>
                {/* ─── 요소 정보 패널 ─── */}
                {elInfo&&(
                  <div style={{flexShrink:0,margin:"0 12px 8px",border:"0.5px solid var(--sep)",borderRadius:12,overflow:"hidden",background:"var(--bg)",maxHeight:"45vh",overflowY:"auto",msOverflowStyle:"none",scrollbarWidth:"none"}}>
                    {/* 헤더: 이름 + 타입 */}
                    <div style={{padding:"10px 14px",borderBottom:"0.5px solid var(--sep)",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",position:"sticky",top:0,background:"var(--bg)",zIndex:1}}>
                      <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",background:"var(--blue)",color:"#fff",padding:"2px 6px",borderRadius:3}}>{elInfo.codeName}</span>
                      <span style={{fontSize:9,fontWeight:500,background:"rgba(0,122,255,.1)",color:"var(--blue)",padding:"2px 6px",borderRadius:3}}>{elInfo.compType}</span>
                      <span style={{fontSize:9,color:"var(--t3)",fontFamily:"monospace"}}>&lt;{elInfo.tag}&gt;</span>
                      {elInfo.childCount>0&&<span style={{fontSize:9,color:"var(--t3)"}}>{elInfo.childCount}개 자식</span>}
                      <button style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:12,padding:0}} onClick={()=>{setElInfo(null);setEditingRule(false)}}>✕</button>
                    </div>
                    <div style={{padding:"8px 14px"}}>
                      {/* 1. DOM 트리 경로 */}
                      <div style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:4}}>트리 경로</div>
                      <div style={{fontSize:10,color:"var(--blue)",fontFamily:"monospace",lineHeight:1.6,padding:"4px 8px",background:"var(--bg3)",borderRadius:6,overflowX:"auto",whiteSpace:"nowrap",marginBottom:4}}>{elInfo.folder}</div>
                      {elInfo.parentInfo&&<div style={{fontSize:10,color:"var(--t3)",marginBottom:2}}>부모: {elInfo.parentInfo}</div>}
                      {elInfo.label&&elInfo.label!==elInfo.tag&&<div style={{fontSize:10,color:"var(--t2)",fontStyle:"italic",marginBottom:2}}>내용: "{elInfo.label}"</div>}

                      <div style={{height:.5,background:"var(--sep)",margin:"8px 0"}}/>

                      {/* 2. 사용자 규칙 (MD) */}
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                        <div style={{fontSize:10,fontWeight:600,color:"var(--t3)"}}>사용자 규칙 (MD)</div>
                        {!editingRule&&<button className="cb" style={{fontSize:9,marginLeft:"auto"}} onClick={()=>{setEditingRule(true);setEditRuleText(elUserRules[elInfo.codeName]||"")}}>{elUserRules[elInfo.codeName]?"수정":"추가"}</button>}
                      </div>
                      {editingRule?(
                        <div>
                          <textarea value={editRuleText} onChange={e=>setEditRuleText(e.target.value)} placeholder={"규칙을 마크다운으로 작성하세요.\n예:\n- 최소 터치 영역 44px\n- hover 시 opacity:0.85\n- 비활성 시 opacity:0.4"} style={{width:"100%",boxSizing:"border-box",minHeight:60,border:"1px solid var(--sep)",borderRadius:6,padding:6,fontSize:11,fontFamily:"monospace",color:"var(--t1)",background:"var(--bg3)",resize:"vertical",outline:"none",lineHeight:1.6}}/>
                          <div style={{display:"flex",gap:4,marginTop:4}}>
                            <button className="btn pr" style={{fontSize:9,padding:"3px 10px"}} onClick={()=>{setElUserRules(p=>({...p,[elInfo.codeName]:editRuleText}));setEditingRule(false)}}>저장</button>
                            <button className="cb" style={{fontSize:9}} onClick={()=>setEditingRule(false)}>취소</button>
                            {elUserRules[elInfo.codeName]&&<button className="cb" style={{fontSize:9,color:"var(--red)"}} onClick={()=>{setElUserRules(p=>{const c={...p};delete c[elInfo.codeName];return c});setEditingRule(false)}}>삭제</button>}
                          </div>
                        </div>
                      ):(
                        elUserRules[elInfo.codeName]?(
                          <pre style={{fontSize:11,color:"var(--t1)",lineHeight:1.6,margin:0,whiteSpace:"pre-wrap",fontFamily:"monospace",padding:"6px 8px",background:"rgba(0,122,255,.04)",borderRadius:6,border:"0.5px solid rgba(0,122,255,.15)",maxHeight:elInfoExpand?999:56,overflow:"hidden"}}>{elUserRules[elInfo.codeName]}</pre>
                        ):(
                          <div style={{fontSize:11,color:"var(--t3)",fontStyle:"italic",padding:"4px 0"}}>등록된 규칙 없음</div>
                        )
                      )}
                      {!editingRule&&elUserRules[elInfo.codeName]&&elUserRules[elInfo.codeName].split("\n").length>3&&(
                        <div style={{fontSize:10,color:"var(--blue)",cursor:"pointer",marginTop:2}} onClick={()=>setElInfoExpand(!elInfoExpand)}>{elInfoExpand?"접기 ↑":"더보기 ↓"}</div>
                      )}

                      <div style={{height:.5,background:"var(--sep)",margin:"8px 0"}}/>

                      {/* 3. 인라인 스타일 */}
                      <div style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:4}}>인라인 스타일</div>
                      <pre style={{fontSize:10,color:"var(--t2)",lineHeight:1.5,margin:0,whiteSpace:"pre-wrap",fontFamily:"monospace",padding:"4px 8px",background:"var(--bg3)",borderRadius:6,maxHeight:48,overflow:"hidden"}}>{elInfo.inlineStyles}</pre>

                      <div style={{height:.5,background:"var(--sep)",margin:"8px 0"}}/>

                      {/* 4. 트리거 / 이전 / 이후 */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                        <div>
                          <div style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:3}}>트리거</div>
                          <div style={{fontSize:10,color:"var(--t1)",lineHeight:1.4,fontFamily:"monospace",wordBreak:"break-all"}}>{elInfo.trigger}</div>
                        </div>
                        <div>
                          <div style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:3}}>이전 요소</div>
                          <div style={{fontSize:10,color:"var(--t1)",lineHeight:1.4}}>{elInfo.before}</div>
                        </div>
                        <div>
                          <div style={{fontSize:10,fontWeight:600,color:"var(--t3)",marginBottom:3}}>이후 요소</div>
                          <div style={{fontSize:10,color:"var(--t1)",lineHeight:1.4}}>{elInfo.after}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* ─── Claude 스타일 입력창 ─── */}
                <div style={{flexShrink:0,padding:"0 12px 12px"}}>
                  <div style={{border:"1px solid var(--sep2)",borderRadius:20,background:"var(--elbg)",overflow:"hidden",transition:"border-color .15s"}} onFocus={e=>e.currentTarget.style.borderColor="var(--blue)"} onBlur={e=>e.currentTarget.style.borderColor="var(--sep2)"}>
                    <textarea ref={agentInput} placeholder="에이전트에게 메시지 보내기..." rows={4} style={{width:"100%",boxSizing:"border-box",padding:"12px 16px 4px",border:"none",outline:"none",fontSize:13,fontFamily:"inherit",color:"var(--t1)",background:"transparent",resize:"none",lineHeight:"20px",display:"block"}}/>
                    <div style={{display:"flex",alignItems:"center",padding:"4px 8px 8px",gap:2}}>
                      <button style={{width:28,height:28,borderRadius:8,border:"none",background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"var(--t2)",flexShrink:0}} title="파일 첨부">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                      <button onClick={()=>setTargetMode(!targetMode)} style={{width:28,height:28,borderRadius:8,border:"none",background:targetMode?"rgba(0,122,255,.12)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:targetMode?"var(--blue)":"var(--t2)",flexShrink:0}} title="요소 타겟 선택">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l14 7-7 2-2 7z"/><path d="M14 14l3 3"/></svg>
                      </button>
                      <div style={{display:"flex",gap:1,background:"var(--bg3)",borderRadius:8,padding:2,marginLeft:2}}>
                        {["대화","명령","코드"].map((m,i)=><button key={m} style={{fontSize:10,padding:"3px 8px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:500,background:i===0?"var(--bg)":"transparent",color:i===0?"var(--t1)":"var(--t3)",boxShadow:i===0?"0 1px 2px rgba(0,0,0,.06)":"none"}}>{m}</button>)}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:4,marginLeft:6}}>
                        <span style={{fontSize:10,color:"var(--t3)"}}>자동승인</span>
                        <div style={{width:28,height:16,borderRadius:99,background:"var(--sep2)",position:"relative",cursor:"pointer",flexShrink:0}}>
                          <div style={{width:12,height:12,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:2,boxShadow:"0 1px 2px rgba(0,0,0,.2)",transition:".15s"}}/>
                        </div>
                      </div>
                      <div style={{marginLeft:"auto"}}>
                        <button style={{width:28,height:28,borderRadius:99,border:"none",background:"var(--t3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:".15s"}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>):(<div style={{width:32,flexShrink:0,background:"var(--bg)",borderLeft:"1px solid var(--sep)",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:8}}>
            <button className="ed-btn" title="패널 펼치기" onClick={()=>setRpOpen(true)} style={{fontSize:14}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>)}
          <div className="resize-handle" onMouseDown={onMouseDown}/>

          {/* 3. 작업 공간 */}
          <div className="wp2">
            <div className="ed-bar" style={{borderBottom:"1px solid var(--sep)",gap:0}}>
              {/* 도구 그룹 */}
              <button className="ed-btn" onClick={()=>setPvCode(!pvCode)} title={pvCode?"렌더링 보기":"코드 보기"} style={pvCode?{color:"var(--blue)"}:{}}>{pvCode?"👁":"</>"}</button>
              <button className="ed-btn" onClick={()=>setTriggerBoard(!triggerBoard)} title="트리거 연결 보드" style={{color:triggerBoard?"var(--blue)":"inherit"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l2-6h4"/><path d="M13 12l2 6h4"/></svg>
              </button>
              <div style={{position:"relative"}}>
                <button className="ed-btn" onClick={()=>setAddMenu(!addMenu)} title="새로 만들기" style={{fontSize:16,color:addMenu?"var(--blue)":"var(--t2)"}}>+</button>
                {addMenu&&(<>
                  <div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setAddMenu(false)}/>
                  <div style={{position:"absolute",top:36,left:0,zIndex:100,background:"var(--bg2)",border:"1px solid var(--sep2)",borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,.15)",minWidth:160,padding:4}}>
                    {[
                      {icon:"📄",label:"새 페이지",action:()=>setAddMenu(false)},
                      {icon:"⚛️",label:"새 원자 등록",action:()=>setAddMenu(false)},
                      {icon:"🧱",label:"새 블록 등록",action:()=>setAddMenu(false)},
                      {icon:"📐",label:"새 섹션 등록",action:()=>setAddMenu(false)},
                      {sep:true},
                      {icon:"📋",label:"전체 페이지 복사",action:()=>{navigator.clipboard.writeText(curPageHtml);setAddMenu(false)}},
                      {icon:"📥",label:"코드 넣기",action:()=>{setPvCode(true);setAddMenu(false)}},
                      {icon:"💾",label:"로컬에 저장",action:()=>{const c="<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>"+curPageHtml+"</body></html>";const a=document.createElement("a");a.setAttribute("href","data:text/html;charset=utf-8,"+encodeURIComponent(c));a.setAttribute("download",`${curPage}.html`);a.setAttribute("target","_blank");a.style.display="none";document.body.appendChild(a);a.click();setTimeout(()=>document.body.removeChild(a),200);setAddMenu(false)}},
                    ].map((item,i)=>item.sep?<div key={i} style={{height:1,background:"var(--sep)",margin:"3px 8px"}}/>:(
                      <div key={i} onClick={item.action} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:6,cursor:"pointer",fontSize:12,color:"var(--t1)",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <span style={{fontSize:14}}>{item.icon}</span>{item.label}
                      </div>
                    ))}
                  </div>
                </>)}
              </div>
              {/* 구분선 */}
              <div style={{width:1,height:20,background:"var(--sep)",margin:"0 6px",flexShrink:0}}/>
              {/* 문서 탭 그룹 */}
              <div style={{display:"flex",gap:0,flex:1,overflow:"hidden"}}>
                {["기능 명세서","와이어프레임","MD","연결","에셋","전역 규칙","자료"].map(t=><button key={t} className="ed-btn" onClick={()=>{setWpTab(t);setTriggerBoard(false)}} style={{fontSize:11,width:"auto",padding:"0 10px",fontWeight:wpTab===t&&!triggerBoard?600:400,color:wpTab===t&&!triggerBoard?"var(--blue)":"var(--t2)",borderBottom:wpTab===t&&!triggerBoard?"2px solid var(--blue)":"2px solid transparent",borderRadius:0,transition:".15s",whiteSpace:"nowrap",flexShrink:0,position:"relative"}}>{t}{t==="전역 규칙"&&Object.keys(ruleAlerts).length>0&&<span style={{position:"absolute",top:2,right:2,width:6,height:6,borderRadius:3,background:"#FF3B30"}}/>}</button>)}
              </div>
            </div>
            <div className="wp2-ct">
              {/* ═══ 트리거 보드 ═══ */}
              {triggerBoard&&(
                <div style={{padding:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l2-6h4"/><path d="M13 12l2 6h4"/></svg>
                    <span style={{fontSize:12,fontWeight:700,color:"var(--t1)"}}>트리거 연결 보드</span>
                    <span style={{fontSize:9,color:"var(--t3)"}}>링크 테이블</span>
                  </div>
                  {/* 연결 테이블 */}
                  <div style={{border:"0.5px solid var(--sep)",borderRadius:10,overflow:"hidden",marginBottom:12}}>
                    {[
                      {from:"btn-login",event:"onClick",to:"api-login",toType:"api",color:"#FF9500",status:"활성"},
                      {from:"api-login",event:"onSuccess",to:"page-dashboard",toType:"page",color:"#007AFF",status:"활성"},
                      {from:"api-login",event:"onFail",to:"toast-error",toType:"ui",color:"#FF3B30",status:"활성"},
                      {from:"btn-start",event:"onClick",to:"modal-exercise",toType:"modal",color:"#007AFF",status:"활성"},
                      {from:"form-record",event:"onSubmit",to:"api-records",toType:"api",color:"#FF9500",status:"초안"},
                    ].map((link,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderBottom:i<4?"0.5px solid var(--sep)":"none",cursor:"pointer",fontSize:10,transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <span style={{width:4,height:4,borderRadius:2,background:link.color,flexShrink:0}}/>
                        <span style={{fontFamily:"monospace",color:"var(--t1)",fontWeight:600,minWidth:70}}>{link.from}</span>
                        <span style={{color:"var(--t3)"}}>→</span>
                        <span style={{fontSize:9,color:link.color,fontWeight:500}}>{link.event}</span>
                        <span style={{color:"var(--t3)"}}>→</span>
                        <span style={{fontFamily:"monospace",color:"var(--t1)",flex:1}}>{link.to}</span>
                        <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:link.toType==="api"?"rgba(255,149,0,.1)":link.toType==="page"?"rgba(0,122,255,.1)":"rgba(52,199,89,.1)",color:link.toType==="api"?"var(--orange)":link.toType==="page"?"var(--blue)":"var(--green)",fontWeight:600}}>{link.toType}</span>
                        <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:link.status==="초안"?"rgba(255,149,0,.1)":"rgba(52,199,89,.06)",color:link.status==="초안"?"var(--orange)":"var(--green)"}}>{link.status}</span>
                      </div>
                    ))}
                  </div>
                  {/* 연결 추가 */}
                  <div style={{display:"flex",gap:4,marginBottom:16}}>
                    <button className="btn pr" style={{fontSize:10,padding:"4px 12px"}}>+ 연결 추가</button>
                    <button className="cb" style={{fontSize:10}}>AI로 생성</button>
                  </div>
                  {/* 선택된 연결 편집 */}
                  <div style={{border:"0.5px solid var(--sep)",borderRadius:10,padding:12,background:"var(--bg)"}}>
                    <div style={{fontSize:11,fontWeight:600,color:"var(--t1)",marginBottom:10}}>연결 편집</div>
                    <div style={{display:"grid",gridTemplateColumns:"60px 1fr",gap:"6px 8px",fontSize:10}}>
                      {[
                        {label:"출발",value:"btn-login"},
                        {label:"출발조건",value:"input-email 비어있지 않음"},
                        {label:"이벤트",value:"onClick"},
                        {label:"도착",value:"api-login"},
                        {label:"데이터",value:"input-email, input-password"},
                        {label:"도착조건",value:"응답 성공 (200)"},
                        {label:"성공 시",value:"page-dashboard + store 저장"},
                        {label:"실패 시",value:"에러 토스트"},
                      ].map((f,i)=>(
                        <React.Fragment key={i}>
                          <span style={{color:"var(--t3)",fontWeight:600,paddingTop:4}}>{f.label}</span>
                          <div style={{background:"var(--bg3)",borderRadius:6,padding:"4px 8px",fontFamily:"monospace",color:"var(--t1)",border:"0.5px solid var(--sep)",cursor:"pointer"}}>{f.value} <span style={{color:"var(--t3)"}}>▼</span></div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  {/* 연결선 범례 */}
                  <div style={{display:"flex",gap:12,marginTop:12,fontSize:9,color:"var(--t3)"}}>
                    <span><span style={{display:"inline-block",width:12,height:2,background:"#007AFF",borderRadius:1,verticalAlign:"middle",marginRight:4}}/>UI 트리거</span>
                    <span><span style={{display:"inline-block",width:12,height:2,background:"#34C759",borderRadius:1,verticalAlign:"middle",marginRight:4}}/>데이터 전달</span>
                    <span><span style={{display:"inline-block",width:12,height:2,background:"#FF9500",borderRadius:1,verticalAlign:"middle",marginRight:4}}/>API 호출</span>
                  </div>
                </div>
              )}
              {/* ═══ 기능 명세서 ═══ */}
              {wpTab==="기능 명세서"&&!triggerBoard&&(
                <div style={{padding:12}}>
                  {/* 범용/개별 토글 */}
                  <div style={{display:"flex",gap:2,background:"var(--bg3)",borderRadius:8,padding:2,marginBottom:14}}>
                    {["범용","개별"].map(s=><button key={s} onClick={()=>setSpecScope(s)} style={{flex:1,fontSize:10,padding:"5px 0",borderRadius:6,border:"none",cursor:"pointer",fontWeight:600,background:specScope===s?"var(--bg)":"transparent",color:specScope===s?"var(--t1)":"var(--t3)",boxShadow:specScope===s?"0 1px 3px rgba(0,0,0,.06)":"none"}}>{s==="개별"?`개별 — ${PAGES.find(p=>p.id===curPage)?.name||curPage}`:s}</button>)}
                  </div>
                  {/* 러프 */}
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:"var(--t1)"}}>러프 (초안)</span>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:specScope==="범용"?"var(--bg3)":"rgba(0,122,255,.08)",color:specScope==="범용"?"var(--t3)":"var(--blue)"}}>{specScope}</span>
                    </div>
                    <div style={{border:"0.5px solid var(--sep)",borderRadius:10,padding:12,background:"var(--bg3)",marginBottom:8}}>
                      {specScope==="범용"?(<>
                        <div style={{fontSize:12,color:"var(--t1)",lineHeight:1.7,marginBottom:8}}>
                          <div style={{fontWeight:600,marginBottom:4}}>프로젝트 목표</div>
                          운동 기록 앱 — 사용자가 매일 운동을 기록하고, 진행 상황을 대시보드에서 확인할 수 있도록 한다.
                        </div>
                        <div style={{fontSize:12,color:"var(--t1)",lineHeight:1.7}}>
                          <div style={{fontWeight:600,marginBottom:4}}>핵심 기능</div>
                          1. 운동 추가/기록 2. 대시보드 (칼로리, 시간) 3. 로그인/회원가입 4. 운동 히스토리 조회
                        </div>
                      </>):(<>
                        <div style={{fontSize:12,color:"var(--t1)",lineHeight:1.7}}>
                          <div style={{fontWeight:600,marginBottom:4}}>{PAGES.find(p=>p.id===curPage)?.emoji} {PAGES.find(p=>p.id===curPage)?.name} — 러프</div>
                          {curPage==="p1"?"오늘의 운동 현황, 칼로리 소모, 운동 시간 요약.\n'운동 시작하기' CTA 버튼으로 빠른 진입.\n하단 탭바로 다른 화면 이동.":curPage==="p2"?"이메일+비밀번호 로그인.\n소셜 로그인(Google, Apple) 지원.\n회원가입, 비밀번호 찾기 링크.":"운동 종류별 기록 목록.\n세트/횟수/무게 입력 폼.\n완료 시 대시보드로 복귀."}
                        </div>
                      </>)}
                    </div>
                    <button className="cb" style={{fontSize:10}}>러프 편집</button>
                  </div>
                  {/* 첨부 문서 */}
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                      <span style={{fontSize:10,fontWeight:600,color:"var(--t3)"}}>첨부 문서</span>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:specScope==="범용"?"var(--bg3)":"rgba(0,122,255,.08)",color:specScope==="범용"?"var(--t3)":"var(--blue)"}}>{specScope}</span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {(specScope==="범용"?[
                        {n:"기획_초안_v2.xlsx",t:"Excel"},
                        {n:"화면설계_러프.pdf",t:"PDF"},
                        {n:"사용자 인터뷰 정리",t:"Docs"},
                        {n:"경쟁사 분석표",t:"Sheets"},
                      ]:[
                        {n:`${PAGES.find(p=>p.id===curPage)?.name}_설계.md`,t:"MD"},
                        ...(curPage==="p1"?[{n:"Strava 대시보드 캡처.png",t:"IMG"}]:[]),
                        ...(curPage==="p2"?[{n:"소셜로그인 플로우.pdf",t:"PDF"}]:[]),
                      ]).map((d,i)=>(
                        <span key={i} style={{fontSize:10,padding:"3px 8px",borderRadius:6,border:"0.5px solid var(--sep)",color:"var(--t1)",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
                          {d.n}
                          <span style={{fontSize:8,color:"var(--t3)"}}>{d.t}</span>
                          <span style={{fontSize:9,color:"var(--t3)",cursor:"pointer"}}>✕</span>
                        </span>
                      ))}
                      <span style={{fontSize:10,padding:"3px 8px",borderRadius:6,border:"0.5px dashed var(--sep2)",color:"var(--t3)",cursor:"pointer"}}>+ 추가</span>
                    </div>
                  </div>
                  <div style={{height:.5,background:"var(--sep)",margin:"0 0 16px"}}/>
                  {/* 설계안 */}
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:"var(--t1)"}}>설계안</span>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(0,122,255,.1)",color:"var(--blue)"}}>러프 반영</span>
                      <div style={{display:"flex",gap:2,marginLeft:4}}>
                        <span style={{fontSize:8,padding:"1px 4px",borderRadius:3,fontWeight:600,background:"rgba(36,41,47,.1)",color:"#24292f"}}>GH</span>
                        <span style={{fontSize:8,padding:"1px 4px",borderRadius:3,fontWeight:600,background:"rgba(0,122,255,.08)",color:"var(--blue)"}}>LC</span>
                      </div>
                      <button className="cb" style={{fontSize:9,marginLeft:"auto"}} onClick={()=>setDesignDocEdit(!designDocEdit)}>{designDocEdit?"닫기":"✏️ 편집"}</button>
                    </div>
                    {designDocEdit?(
                      <div>
                        <textarea value={designDocText} onChange={e=>setDesignDocText(e.target.value)} style={{width:"100%",boxSizing:"border-box",minHeight:200,border:"0.5px solid var(--sep)",borderRadius:10,padding:"12px 14px",fontSize:11,fontFamily:"monospace",color:"var(--t1)",background:"var(--bg3)",resize:"vertical",outline:"none",lineHeight:1.7}}/>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                          <span style={{fontSize:9,color:"var(--green)"}}>● 자동 저장됨</span>
                          <button className="cb" style={{fontSize:9,marginLeft:"auto"}}>📋 복사</button>
                          <button className="cb" style={{fontSize:9}}>💾 .md 다운로드</button>
                        </div>
                      </div>
                    ):(
                      <div style={{border:"0.5px solid var(--sep)",borderRadius:10,overflow:"hidden"}}>
                        {PAGES.map((pg,i)=>{
                          const registered=pg.id!=="p3"; // p3 is not yet registered
                          return(
                          <div key={pg.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderBottom:i<PAGES.length-1?"0.5px solid var(--sep)":"none",cursor:"pointer"}} onClick={()=>{setCurPage(pg.id);setCurState(null)}}>
                            <span style={{fontSize:14}}>{pg.emoji}</span>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,fontWeight:500,color:"var(--t1)"}}>{pg.name}</div>
                              <div style={{fontSize:10,color:"var(--t3)"}}>{pg.id}.html</div>
                            </div>
                            {!registered&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:"rgba(255,149,0,.1)",color:"var(--orange)",fontWeight:600}}>미등록</span>}
                            <div style={{display:"flex",gap:2}}>
                              <span style={{fontSize:8,padding:"1px 4px",borderRadius:3,fontWeight:600,background:"rgba(36,41,47,.1)",color:"#24292f"}}>GH</span>
                              <span style={{fontSize:8,padding:"1px 4px",borderRadius:3,fontWeight:600,background:"rgba(0,122,255,.08)",color:"var(--blue)"}}>LC</span>
                            </div>
                            <span style={{fontSize:10,color:curPage===pg.id?"var(--blue)":"var(--t3)"}}>{curPage===pg.id?"편집중":"→"}</span>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                  <div style={{height:.5,background:"var(--sep)",margin:"0 0 16px"}}/>
                  {/* 기술 정의 */}
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:"var(--t1)"}}>기술 정의</span>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(52,199,89,.1)",color:"var(--green)"}}>AI 작성</span>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:specScope==="범용"?"var(--bg3)":"rgba(0,122,255,.08)",color:specScope==="범용"?"var(--t3)":"var(--blue)"}}>{specScope}</span>
                    </div>
                    <div style={{border:"0.5px solid var(--sep)",borderRadius:10,padding:12}}>
                      <div style={{fontSize:11,color:"var(--t1)",lineHeight:1.7,fontFamily:"monospace"}}>
                        {specScope==="범용"?(<>
                          <div style={{color:"var(--blue)",fontWeight:600,marginBottom:4}}>// 기술 스택</div>
                          <div>프레임워크: React 18 + Vite</div>
                          <div>스타일: Tailwind CSS + CSS Variables</div>
                          <div>상태관리: Zustand</div>
                          <div>API: Supabase (Auth + DB)</div>
                          <div style={{color:"var(--blue)",fontWeight:600,margin:"8px 0 4px"}}>// 데이터 모델</div>
                          <div>User → Exercise[] → Record[]</div>
                        </>):(<>
                          <div style={{color:"var(--blue)",fontWeight:600,marginBottom:4}}>// {PAGES.find(p=>p.id===curPage)?.name}</div>
                          {curPage==="p1"?(<><div>컴포넌트: Dashboard, StatsCard, StartButton</div><div>store: statsStore (칼로리,시간), exerciseStore</div><div>API: GET /api/stats/today</div><div>훅: useQuery("todayStats")</div></>):
                           curPage==="p2"?(<><div>컴포넌트: LoginForm, EmailInput, PasswordInput</div><div>store: authStore (user, token)</div><div>API: POST /api/auth/login</div><div>훅: useAuth()</div></>):
                           (<><div>컴포넌트: ExerciseList, RecordForm, AddButton</div><div>store: exerciseStore (목록, 현재선택)</div><div>API: GET /api/exercises, POST /api/records</div><div>훅: useMutation("addRecord")</div></>)}
                        </>)}
                      </div>
                      <div style={{display:"flex",gap:4,marginTop:10}}>
                        <button className="btn pr" style={{fontSize:10,padding:"4px 12px"}}>✓ 검수 승인</button>
                        <button className="cb" style={{fontSize:10}}>수정 요청</button>
                        <button className="cb" style={{fontSize:10}}>AI 재생성</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ 와이어프레임 (HTML) ═══ */}
              {wpTab==="와이어프레임"&&!triggerBoard&&(
                <div style={{padding:0}}>
                  {/* 기획 / 스토리보드 서브 탭 */}
                  <div style={{display:"flex",gap:2,background:"var(--bg3)",borderRadius:8,padding:2,margin:"12px 12px 0"}}>
                    {["기획","스토리보드"].map(t=><button key={t} onClick={()=>setWfSubTab(t)} style={{flex:1,fontSize:10,padding:"5px 0",borderRadius:6,border:"none",cursor:"pointer",fontWeight:600,background:wfSubTab===t?"var(--bg)":"transparent",color:wfSubTab===t?"var(--t1)":"var(--t3)",boxShadow:wfSubTab===t?"0 1px 3px rgba(0,0,0,.06)":"none"}}>{t}</button>)}
                  </div>
                  <div style={{padding:12}}>
                    {/* ── 기획 서브 탭 ── */}
                    {wfSubTab==="기획"&&(<>
                      <div style={{marginBottom:16}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                          <span style={{fontSize:11,fontWeight:700,color:"var(--t1)"}}>기획 의도 & 목적</span>
                          <div style={{marginLeft:"auto",display:"flex",gap:4}}>
                            <button className="cb" style={{fontSize:9}}>📤 업로드</button>
                            <button className="cb" style={{fontSize:9}}>✏️ 편집</button>
                          </div>
                        </div>
                        <textarea placeholder="이 화면의 기획 의도와 목적을 작성하세요..." style={{width:"100%",boxSizing:"border-box",minHeight:48,border:"0.5px solid var(--sep)",borderRadius:8,padding:"8px 10px",fontSize:11,fontFamily:"inherit",color:"var(--t1)",background:"var(--bg3)",resize:"vertical",outline:"none",lineHeight:1.6}} defaultValue={"운동 기록 앱의 메인 대시보드.\n사용자가 오늘의 운동 현황을 한눈에 파악하고 바로 운동을 시작할 수 있도록 한다."}/>
                      </div>
                      <div style={{marginBottom:16}}>
                        <div style={{fontSize:11,fontWeight:700,color:"var(--t1)",marginBottom:8}}>관련 자료</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {["📎 Strava 벤치마킹.pdf","📎 Nike Run 캡처.png","📎 기획 회의록.md"].map((f,i)=>(
                            <span key={i} style={{fontSize:10,padding:"4px 10px",borderRadius:6,border:"0.5px solid var(--sep)",color:"var(--blue)",cursor:"pointer"}}>{f}</span>
                          ))}
                          <span style={{fontSize:10,padding:"4px 10px",borderRadius:6,border:"0.5px dashed var(--sep2)",color:"var(--t3)",cursor:"pointer"}}>+ 자료 추가</span>
                        </div>
                      </div>
                      <div style={{marginBottom:16}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                          <span style={{fontSize:11,fontWeight:700,color:"var(--t1)"}}>사용자 스토리보드 러프</span>
                          <button className="cb" style={{fontSize:9,marginLeft:"auto"}}>📤 업로드</button>
                        </div>
                        <div style={{border:"0.5px solid var(--sep)",borderRadius:10,padding:12,background:"var(--bg3)"}}>
                          {["1. 사용자가 앱을 열면 대시보드가 보인다","2. 오늘의 칼로리 소모량, 운동 시간 표시","3. '운동 시작' 버튼 탭 → 운동 종류 선택 화면","4. 운동 완료 후 → 기록 저장 → 대시보드 갱신"].map((s,i)=>(
                            <div key={i} style={{fontSize:11,color:"var(--t1)",lineHeight:1.8,paddingLeft:4}}>{s}</div>
                          ))}
                        </div>
                        <button className="cb" style={{fontSize:10,marginTop:6}}>러프 편집</button>
                      </div>
                      <div style={{height:.5,background:"var(--sep)",margin:"0 0 16px"}}/>
                      <div style={{fontSize:11,fontWeight:700,color:"var(--t1)",marginBottom:8}}>최종 산출물</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        {[{icon:"📋",name:"기획서",status:"작성중",color:"var(--orange)",loc:["로컬"]},{icon:"🎯",name:"기획 의도",status:"완료",color:"var(--green)",loc:["로컬","GitHub"]}].map((d,i)=>(
                          <div key={i} style={{border:"0.5px solid var(--sep)",borderRadius:8,padding:"10px 12px",cursor:"pointer",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{fontSize:14}}>{d.icon}</span>
                              <span style={{fontSize:11,fontWeight:500,color:"var(--t1)"}}>{d.name}</span>
                              <div style={{display:"flex",gap:2,marginLeft:"auto"}}>
                                {d.loc.map(l=><span key={l} style={{fontSize:7,padding:"1px 3px",borderRadius:2,fontWeight:600,background:l==="GitHub"?"rgba(36,41,47,.1)":"rgba(0,122,255,.08)",color:l==="GitHub"?"#24292f":"var(--blue)"}}>{l==="GitHub"?"GH":"LC"}</span>)}
                              </div>
                            </div>
                            <div style={{fontSize:9,color:d.color,fontWeight:600,marginTop:4,paddingLeft:22}}>● {d.status}</div>
                          </div>
                        ))}
                      </div>
                      {/* 요소 설계 */}
                      {selElement&&(<>
                        <div style={{height:.5,background:"var(--sep)",margin:"16px 0"}}/>
                        <div style={{fontSize:11,fontWeight:700,color:"var(--t1)",marginBottom:8}}>선택 요소 설계</div>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                          <span style={{fontSize:10,fontWeight:700,fontFamily:"monospace",color:T.accent,border:`1px solid ${T.accent}`,padding:"1px 6px",borderRadius:3}}>{selElement.tag}</span>
                          <span style={{fontSize:12,fontWeight:600}}>{selElement.label}</span>
                        </div>
                        <div style={{background:"#1e1e1e",borderRadius:8,padding:8,maxHeight:60,overflow:"auto"}}>
                          <pre style={{fontFamily:"monospace",fontSize:9,lineHeight:1.5,color:"#d4d4d4",whiteSpace:"pre-wrap",wordBreak:"break-all",margin:0}}>{selElement.html.slice(0,200)}{selElement.html.length>200?"...":""}</pre>
                        </div>
                      </>)}
                    </>)}
                    {/* ── 스토리보드 서브 탭 ── */}
                    {wfSubTab==="스토리보드"&&(<>
                      <div style={{fontSize:11,fontWeight:700,color:"var(--t1)",marginBottom:10}}>사용자 스토리보드</div>
                      <div style={{border:"0.5px solid var(--sep)",borderRadius:10,overflow:"hidden",marginBottom:16}}>
                        {[
                          {step:"1",title:"앱 실행",desc:"스플래시 → 홈 대시보드 자동 진입 (로그인 상태면)"},
                          {step:"2",title:"대시보드 확인",desc:"오늘의 칼로리 소모, 운동 시간, 최근 운동 기록 확인"},
                          {step:"3",title:"운동 시작",desc:"'운동 시작하기' 버튼 → 운동 종류 선택 화면"},
                          {step:"4",title:"운동 기록",desc:"세트/횟수/무게 입력 → 타이머 → 완료 버튼"},
                          {step:"5",title:"기록 저장",desc:"서버 저장 → 성공 토스트 → 대시보드 갱신"},
                          {step:"6",title:"히스토리",desc:"날짜별 운동 기록 조회, 통계 그래프"},
                        ].map((s,i)=>(
                          <div key={i} style={{display:"flex",gap:10,padding:"10px 14px",borderBottom:i<5?"0.5px solid var(--sep)":"none",alignItems:"flex-start"}}>
                            <span style={{fontSize:10,fontWeight:700,color:"var(--blue)",background:"rgba(0,122,255,.08)",padding:"2px 6px",borderRadius:4,flexShrink:0}}>#{s.step}</span>
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:"var(--t1)"}}>{s.title}</div>
                              <div style={{fontSize:10,color:"var(--t2)",lineHeight:1.5}}>{s.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button className="cb" style={{fontSize:10}}>✏️ 편집</button>
                        <button className="cb" style={{fontSize:10}}>+ 단계 추가</button>
                      </div>
                      <div style={{height:.5,background:"var(--sep)",margin:"16px 0"}}/>
                      <div style={{border:"0.5px solid var(--sep)",borderRadius:8,padding:"10px 12px",cursor:"pointer",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14}}>📖</span>
                          <span style={{fontSize:11,fontWeight:500,color:"var(--t1)"}}>스토리보드 (최종)</span>
                          <div style={{display:"flex",gap:2,marginLeft:"auto"}}>
                            <span style={{fontSize:7,padding:"1px 3px",borderRadius:2,fontWeight:600,background:"rgba(0,122,255,.08)",color:"var(--blue)"}}>LC</span>
                          </div>
                        </div>
                        <div style={{fontSize:9,color:"var(--orange)",fontWeight:600,marginTop:4,paddingLeft:22}}>● 작성중</div>
                      </div>
                    </>)}
                  </div>
                </div>
              )}

              {/* ═══ MD ═══ */}
              {wpTab==="MD"&&!triggerBoard&&(
                <div style={{padding:12}}>
                  {/* 범용/개별 토글 */}
                  <div style={{display:"flex",gap:2,background:"var(--bg3)",borderRadius:8,padding:2,marginBottom:14}}>
                    {["범용","개별"].map(s=><button key={s} onClick={()=>setMdScope(s)} style={{flex:1,fontSize:10,padding:"5px 0",borderRadius:6,border:"none",cursor:"pointer",fontWeight:600,background:mdScope===s?"var(--bg)":"transparent",color:mdScope===s?"var(--t1)":"var(--t3)",boxShadow:mdScope===s?"0 1px 3px rgba(0,0,0,.06)":"none"}}>{s==="개별"?`개별 — ${PAGES.find(p=>p.id===curPage)?.name||curPage}`:s}</button>)}
                  </div>
                  {/* 1차 프롬프트 */}
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:"var(--t1)"}}>1차: 프롬프트 작업</span>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(0,122,255,.1)",color:"var(--blue)"}}>AI 지시</span>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:mdScope==="범용"?"var(--bg3)":"rgba(0,122,255,.08)",color:mdScope==="범용"?"var(--t3)":"var(--blue)"}}>{mdScope}</span>
                    </div>
                    <textarea placeholder={mdScope==="범용"?"에이전트에게 프로젝트 전체 문서화를 지시하세요...\n예: '컴포넌트 구조를 md로 정리해줘'":`에이전트에게 ${PAGES.find(p=>p.id===curPage)?.name||curPage} 페이지 문서화를 지시하세요...\n예: '이 페이지의 상태 흐름을 md로 정리해줘'`} style={{width:"100%",boxSizing:"border-box",minHeight:64,border:"0.5px solid var(--sep)",borderRadius:8,padding:"8px 10px",fontSize:11,fontFamily:"inherit",color:"var(--t1)",background:"var(--bg3)",resize:"vertical",outline:"none",lineHeight:1.6}}/>
                    <div style={{display:"flex",gap:4,marginTop:6}}>
                      <button className="btn pr" style={{fontSize:10,padding:"4px 12px"}}>AI 문서 생성</button>
                      <button className="cb" style={{fontSize:10}}>템플릿 선택</button>
                    </div>
                  </div>
                  <div style={{height:.5,background:"var(--sep)",margin:"0 0 16px"}}/>
                  {/* 2차 문서화 */}
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:"var(--t1)"}}>2차: 문서화 (MD)</span>
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(52,199,89,.1)",color:"var(--green)"}}>편집 가능</span>
                    </div>
                    <div style={{fontFamily:"monospace",fontSize:11,lineHeight:1.8,color:"var(--t1)",whiteSpace:"pre-wrap",background:"var(--bg3)",borderRadius:8,padding:12,border:"0.5px solid var(--sep)",maxHeight:200,overflow:"auto"}}>
{mdScope==="범용"?`# FitTrack 프로젝트 구조

## 페이지
- 홈 대시보드 (p1)
- 로그인 (p2)  
- 운동 기록 (p3)

## 컴포넌트 계층
\`\`\`
/atoms/    → 버튼, 인풋, 토글
/blocks/   → 카드, 폼, 네비
/sections/ → 히어로, 통계 그리드
/pages/    → 홈, 로그인, 운동기록
\`\`\`

## 상태 관리
- 모달A: 로그인 팝업 (p1 트리거)
`:`# ${PAGES.find(p=>p.id===curPage)?.name||curPage}

## 구성 요소
${curPage==="p1"?"- StatsCard: 칼로리/시간 표시\n- StartButton: 운동 시작 CTA\n- RecentList: 최근 운동 목록":curPage==="p2"?"- LoginForm: 이메일+비밀번호\n- SocialLoginButtons: Google/Apple\n- SignupLink: 회원가입 링크":"- ExerciseList: 운동 종류 목록\n- RecordForm: 세트/횟수/무게 입력\n- AddButton: 기록 추가"}

## 상태
${STATES.filter(s=>s.page===curPage).map(s=>`- ${s.emoji} ${s.name}: ${s.trigger}`).join("\n")||"- 없음"}
`}</div>
                    <div style={{display:"flex",gap:4,marginTop:6}}>
                      <button className="cb" style={{fontSize:10}}>MD 편집</button>
                      <button className="cb" style={{fontSize:10}}>💾 저장</button>
                      <button className="cb" style={{fontSize:10}}>📋 복사</button>
                    </div>
                  </div>
                  <div style={{height:.5,background:"var(--sep)",margin:"0 0 16px"}}/>
                  {/* 최종 산출물 */}
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--t1)",marginBottom:8}}>최종 산출물</div>
                    {(mdScope==="범용"?[
                      {icon:"📝",name:"README.md",status:"생성됨",time:"3분 전",loc:["로컬","GitHub"]},
                      {icon:"📐",name:"DESIGN_RULES.md",status:"생성됨",time:"5분 전",loc:["로컬","GitHub"]},
                      {icon:"🎨",name:"디자인 규칙서.md",status:"미작성",time:"-",loc:[]},
                      {icon:"🔧",name:"TECH_SPEC.md",status:"검수 대기",time:"8분 전",loc:["로컬"]},
                      {icon:"🧭",name:"MIGRATION_PROMPT.md",status:"미생성",time:"-",loc:[]},
                      {icon:"📋",name:"COMPONENT_RULES.md",status:"미생성",time:"-",loc:[]},
                    ]:[
                      {icon:"📄",name:`${curPage}_SPEC.md`,status:curPage==="p1"?"생성됨":"미생성",time:curPage==="p1"?"6분 전":"-",loc:curPage==="p1"?["로컬"]:[]},
                      {icon:"🗺️",name:`${curPage}_FLOW.md`,status:"미생성",time:"-",loc:[]},
                    ]).map((d,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,border:"0.5px solid var(--sep)",marginBottom:4,cursor:"pointer",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <span style={{fontSize:14}}>{d.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:500,color:"var(--t1)",fontFamily:"monospace"}}>{d.name}</div>
                          <div style={{fontSize:9,color:d.status==="미생성"?"var(--t3)":d.status==="검수 대기"?"var(--orange)":"var(--green)"}}>{d.status} · {d.time}</div>
                        </div>
                        <div style={{display:"flex",gap:2,flexShrink:0}}>
                          {d.loc.map(l=><span key={l} style={{fontSize:8,padding:"1px 4px",borderRadius:3,fontWeight:600,background:l==="GitHub"?"rgba(36,41,47,.1)":"rgba(0,122,255,.08)",color:l==="GitHub"?"#24292f":"var(--blue)"}}>{l==="GitHub"?"GH":"LC"}</span>)}
                        </div>
                        <div style={{display:"flex",gap:2,flexShrink:0}}>
                          <button className="cb" style={{fontSize:9}}>{d.status==="미생성"?"생성":"열기"}</button>
                          <button className="cb" style={{fontSize:9}}>📤</button>
                          {d.status!=="미생성"&&<button className="cb" style={{fontSize:9,color:"var(--red)"}}>✕</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ 연결 ═══ */}
              {wpTab==="연결"&&!triggerBoard&&(
                <div style={{padding:12}}>
                  {[
                    {icon:"🗄️",name:"참조 DB 스키마",desc:"프로젝트 데이터 모델 정의",default_:"## Users\nid: uuid (PK)\nemail: text (unique, not null)\nname: text\npassword_hash: text\nprofile_image: text (nullable)\ncreated_at: timestamp\n\n## Exercises\nid: uuid (PK)\nname: text (not null)\ntype: text (cardio | strength | flexibility)\nmuscle_group: text\n\n## Records\nid: uuid (PK)\nexercise_id: uuid (FK → exercises.id)\nuser_id: uuid (FK → users.id)\nsets: int\nreps: int\nweight: float (nullable, kg)\ndate: date (not null)\nmemo: text (nullable)"},
                    {icon:"🔗",name:"정보 연결성 관리",desc:"컴포넌트 간 데이터 흐름 · 의존 관계",default_:"## Store → Component 매핑\nauthStore:\n  → LoginForm (읽기/쓰기: user, token)\n  → Header (읽기: user.name, user.avatar)\n  → ProtectedRoute (읽기: isLoggedIn)\n\nstatsStore:\n  → Dashboard (읽기: todayCalories, todayMinutes)\n  → StatsCard (읽기: weeklyStats[])\n\nexerciseStore:\n  → ExerciseList (읽기: exercises[])\n  → RecordForm (읽기/쓰기: currentExercise)\n  → AddButton (쓰기: addRecord())\n\n## API → Store 흐름\nPOST /auth/login → authStore.setUser()\nGET /stats/today → statsStore.setToday()\nGET /exercises → exerciseStore.setList()\nPOST /records → exerciseStore.addRecord()"},
                  ].map((rule,i)=>(
                    <div key={i} style={{marginBottom:18}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}} onMouseEnter={e=>{const b=e.currentTarget.querySelector(".gr-edit");if(b)b.style.opacity=1}} onMouseLeave={e=>{const b=e.currentTarget.querySelector(".gr-edit");if(b)b.style.opacity=0}}>
                        <span style={{fontSize:14}}>{rule.icon}</span>
                        <span style={{fontSize:11,fontWeight:600,color:"var(--t1)"}}>{rule.name}</span>
                        <span style={{fontSize:9,color:"var(--t3)"}}>{rule.desc}</span>
                        <button className="gr-edit cb" style={{fontSize:9,marginLeft:"auto",opacity:0,transition:"opacity .15s"}}>✏️ 편집</button>
                      </div>
                      <pre style={{fontSize:10,color:"var(--t1)",lineHeight:1.6,margin:0,whiteSpace:"pre-wrap",fontFamily:"monospace",padding:"8px 10px",background:"var(--bg3)",borderRadius:8,border:"0.5px solid var(--sep)",maxHeight:200,overflow:"auto"}}>{rule.default_}</pre>
                    </div>
                  ))}
                </div>
              )}


              {/* ═══ 에셋 ═══ */}
              {wpTab==="에셋"&&!triggerBoard&&(
                <div style={{padding:12}}>
                  <div style={{fontSize:12,fontWeight:600,color:"var(--t1)",marginBottom:12}}>에셋 관리</div>
                  {[
                    {icon:"🎨",name:"컬러 팔레트",count:12,desc:"Primary, Secondary, Semantic 컬러"},
                    {icon:"🔤",name:"타이포그래피",count:6,desc:"Heading 1~4, Body, Caption"},
                    {icon:"✨",name:"아이콘",count:48,desc:"Lucide 기반 커스텀 아이콘 세트"},
                    {icon:"🖼️",name:"이미지",count:8,desc:"히어로, 온보딩, 플레이스홀더"},
                    {icon:"🎭",name:"캐릭터/일러스트",count:3,desc:"운동 캐릭터, 빈 상태 일러스트"},
                    {icon:"🌈",name:"그라디언트/배경",count:4,desc:"카드 배경, 히어로 그라디언트"},
                  ].map((asset,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"0.5px solid var(--sep)",marginBottom:6,cursor:"pointer",transition:".15s",background:"var(--bg)"}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="var(--bg)"}>
                      <span style={{fontSize:18}}>{asset.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:600,color:"var(--t1)"}}>{asset.name}</div>
                        <div style={{fontSize:9,color:"var(--t3)"}}>{asset.desc}</div>
                      </div>
                      <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:"var(--bg3)",color:"var(--t2)",fontWeight:600}}>{asset.count}</span>
                    </div>
                  ))}
                  <div style={{height:.5,background:"var(--sep)",margin:"12px 0"}}/>
                  <div style={{fontSize:11,fontWeight:600,color:"var(--t1)",marginBottom:8}}>토큰 프리셋</div>
                  {["글로벌 (다크 모던)","라이트 테마","컴포넌트별 오버라이드"].map((t,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,border:"0.5px solid var(--sep)",marginBottom:4,cursor:"pointer",fontSize:11,color:"var(--t1)"}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <span style={{fontSize:10}}>🎛️</span>{t}
                      <span style={{marginLeft:"auto",fontSize:9,color:i===0?"var(--green)":"var(--t3)"}}>{i===0?"적용중":"→"}</span>
                    </div>
                  ))}
                  <div style={{display:"flex",gap:4,marginTop:8}}>
                    <button className="btn pr" style={{fontSize:10,padding:"4px 12px"}}>+ 에셋 추가</button>
                    <button className="cb" style={{fontSize:10}}>📤 업로드</button>
                  </div>
                </div>
              )}
              {/* ═══ 전역 규칙 ═══ */}
              {wpTab==="전역 규칙"&&!triggerBoard&&(
                <div style={{padding:12}}>
                  {[
                    {icon:"🎯",name:"디자인 원칙",desc:"최상위 철학",default_:"- 명확성 우선\n- 일관성 유지\n- 피드백을 반드시 제공"},
                    {icon:"🏷️",name:"네이밍 규칙",desc:"이름 짓는 법",default_:"- 컴포넌트: PascalCase\n- 파일명: kebab-case\n- CSS 변수: --color-{semantic}"},
                    {icon:"📐",name:"레이아웃 규칙",desc:"반응형, 간격",default_:"- 브레이크포인트: 375/768/1200\n- 최대너비: 1200px\n- 간격: 8px 단위"},
                    {icon:"⚙️",name:"고정 설정값",desc:"환경변수, 상수",default_:"- API_BASE: https://api.fittrack.com\n- MAX_UPLOAD: 10MB\n- DEBOUNCE_MS: 300\n- TOAST_DURATION: 3000"},
                  ].map((rule,i)=>(
                    <div key={i} style={{marginBottom:14,background:"var(--bg)",borderRadius:10,border:ruleAlerts[rule.name]?"1.5px solid #FF3B30":"0.5px solid var(--sep)",padding:12,position:"relative"}}>
                      {ruleAlerts[rule.name]&&<div style={{position:"absolute",top:-4,right:-4,fontSize:8,padding:"1px 6px",borderRadius:8,background:"#FF3B30",color:"#fff",fontWeight:700}}>AI 변경됨</div>}
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                        <span style={{fontSize:14}}>{rule.icon}</span>
                        <span style={{fontSize:11,fontWeight:600,color:"var(--t1)"}}>{rule.name}</span>
                        <span style={{fontSize:9,color:"var(--t3)"}}>{rule.desc}</span>
                        <div style={{marginLeft:"auto",display:"flex",gap:4}}>
                          {ruleAlerts[rule.name]&&<button className="cb" style={{fontSize:9,color:"var(--green)"}} onClick={()=>setRuleAlerts(p=>{const c={...p};delete c[rule.name];return c})}>✓ 확인</button>}
                          <button className="cb" style={{fontSize:9}}>✏️ 편집</button>
                        </div>
                      </div>
                      <pre style={{fontSize:10,color:"var(--t1)",lineHeight:1.6,margin:0,whiteSpace:"pre-wrap",fontFamily:"monospace",padding:"8px 10px",background:"var(--bg3)",borderRadius:8,border:"0.5px solid var(--sep)"}}>{rule.default_}</pre>
                      {ruleAlerts[rule.name]&&<div style={{fontSize:9,color:"#4FC3F7",fontStyle:"italic",marginTop:6,paddingLeft:2}} data-ai-ignore="true">↳ {ruleAlerts[rule.name].desc}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* ═══ 자료 ═══ */}
              {wpTab==="자료"&&!triggerBoard&&(
                <div style={{padding:12}}>
                  {/* URL */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:600,color:"var(--t1)",marginBottom:8}}>🔖 URL 북마크</div>
                    {[
                      {label:"Apple HIG",pinned:true},
                      {label:"Material 3 컴포넌트",pinned:true},
                      ...(curPage==="p1"?[{label:"Strava 대시보드 참고",pinned:false}]:curPage==="p2"?[{label:"소셜 로그인 가이드",pinned:false}]:[{label:"운동 앱 UX 벤치마킹",pinned:false}])
                    ].map((b,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:6,marginBottom:2,cursor:"pointer",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <span style={{fontSize:10,flexShrink:0,cursor:"pointer"}} title={b.pinned?"범용 (고정)":"이 페이지만"}>{b.pinned?"📌":"📄"}</span>
                        <span style={{fontSize:11,color:"var(--blue)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{b.label}</span>
                        {!b.pinned&&<span style={{fontSize:8,color:"var(--t3)",flexShrink:0}}>{PAGES.find(p=>p.id===curPage)?.name}</span>}
                        <span style={{fontSize:9,color:"var(--t3)",flexShrink:0}}>↗</span>
                      </div>
                    ))}
                    <button className="cb" style={{fontSize:9,marginTop:4}}>+ URL 추가</button>
                  </div>
                  <div style={{height:.5,background:"var(--sep)",margin:"0 0 16px"}}/>
                  {/* 스크린샷 — 페이지별 */}
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:600,color:"var(--t1)"}}>📸 스크린샷 / 캡처</span>
                      <span style={{fontSize:9,color:"var(--blue)",padding:"1px 6px",borderRadius:4,background:"rgba(0,122,255,.08)"}}>{PAGES.find(p=>p.id===curPage)?.name}</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                      {(curPage==="p1"?["대시보드_v1.png","통계카드.png"]:curPage==="p2"?["로그인_폼.png"]:["운동목록_v2.png","기록입력.png"]).map((f,i)=>(
                        <div key={i} style={{aspectRatio:"4/3",borderRadius:8,background:"var(--bg3)",border:"0.5px solid var(--sep)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"var(--t3)",textAlign:"center",padding:4,cursor:"pointer"}}>{f}</div>
                      ))}
                      <div style={{aspectRatio:"4/3",borderRadius:8,border:"0.5px dashed var(--sep2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"var(--t3)",cursor:"pointer"}}>+</div>
                    </div>
                  </div>
                  <div style={{height:.5,background:"var(--sep)",margin:"0 0 16px"}}/>
                  {/* 다운로드 파일 — 고정+페이지별 */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:600,color:"var(--t1)",marginBottom:8}}>📁 다운로드 파일</div>
                    {[
                      {name:"UI킷_v3.sketch",size:"24MB",loc:["로컬"],pinned:true},
                      {name:"아이콘팩.zip",size:"3.2MB",loc:["로컬","GitHub"],pinned:true},
                      ...(curPage==="p1"?[{name:"dashboard_mockup.fig",size:"8MB",loc:["로컬"],pinned:false}]:curPage==="p2"?[{name:"login_flow.pdf",size:"420KB",loc:["로컬"],pinned:false}]:[])
                    ].map((f,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:6,border:"0.5px solid var(--sep)",marginBottom:3}}>
                        <span style={{fontSize:10,flexShrink:0,cursor:"pointer"}} title={f.pinned?"범용 (고정)":"이 페이지만"}>{f.pinned?"📌":"📄"}</span>
                        <span style={{fontSize:11,color:"var(--t1)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                        <div style={{display:"flex",gap:2,flexShrink:0}}>
                          {f.loc.map(l=><span key={l} style={{fontSize:7,padding:"1px 3px",borderRadius:2,fontWeight:600,background:l==="GitHub"?"rgba(36,41,47,.1)":l==="Supabase"?"rgba(62,207,142,.1)":"rgba(0,122,255,.08)",color:l==="GitHub"?"#24292f":l==="Supabase"?"#1a9f60":"var(--blue)"}}>{l==="GitHub"?"GH":l==="Supabase"?"SB":"LC"}</span>)}
                        </div>
                        <span style={{fontSize:9,color:"var(--t3)",flexShrink:0}}>{f.size}</span>
                      </div>
                    ))}
                    <button className="cb" style={{fontSize:9,marginTop:4}}>+ 파일 추가</button>
                  </div>
                  <div style={{height:.5,background:"var(--sep)",margin:"0 0 16px"}}/>
                  {/* 도움말 */}
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:600,color:"var(--t1)"}}>📖 개발 기초 용어 도움말</span>
                    </div>
                    <div style={{border:"0.5px solid var(--sep)",borderRadius:8,padding:"10px 12px",cursor:"pointer",marginBottom:6}} onMouseEnter={e=>e.currentTarget.style.background="var(--cardh)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{fontSize:11,color:"var(--blue)",marginBottom:2}}>Google Docs 문서</div>
                      <div style={{fontSize:9,color:"var(--t3)",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>docs.google.com/document/d/10xM2UbQ...</div>
                    </div>
                    <button className="cb" style={{fontSize:9}}>+ 문서 추가</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ═══ MAIN (갤러리 모드) ═══ */}
    {!inEditor&&(
      <div className="mn">
        <div className="toolbar">
          <div className="tb-t">
            {nav==="studio"&&"스튜디오"}
            {nav==="foundation"&&"파운데이션"}
            {nav==="collect"&&"카탈로그"}
            {nav==="references"&&"레퍼런스"}
            {nav==="commit"&&"커밋"}
            {nav==="rules"&&"규칙/문서"}
            {nav==="manage"&&"관리"}
          </div>
          <div className="tb-sp"/>
          {nav==="collect"&&<button className="btn" style={{background:"none",color:"var(--t2)",border:"1px solid var(--sep)",gap:4,fontSize:12}} onClick={()=>setShowCollectPopup(true)}><span style={{fontSize:14}}>🤖</span> 수집 보내기</button>}
          {nav==="studio"&&stTab==="프로젝트"&&<button className="btn pr" onClick={openCreateModal}><Plus/> 새 프로젝트</button>}
        </div>
        <div className="ct">
          {/* 스튜디오 */}
          {nav==="studio"&&(<>
            {/* 타입 탭 필터 */}
            <div className="fl">
              {["전체","원자","블록","섹션","페이지","프로젝트"].map(t=>{
                const cnt=t==="전체"?projects.length:projects.filter(p=>(p.status||'페이지')===t).length;
                return(<button key={t} className={`ch ${stTab===t?"on":""}`} onClick={()=>setStTab(t)}>
                  {t}{cnt>0&&<span style={{marginLeft:4,fontSize:9,opacity:.7}}>({cnt})</span>}
                </button>);
              })}
            </div>
            {(()=>{
              const filtered=stTab==="전체"?projects:projects.filter(p=>(p.status||'페이지')===stTab);
              return(<>
                {/* 열 수 조절 */}
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8,paddingLeft:2}}>
                  <span style={{fontSize:11,color:'var(--t3)',marginRight:4}}>보기</span>
                  {[{n:6,l:'작게'},{n:4,l:'기본'},{n:3,l:'크게'}].map(({n,l})=>(
                    <button key={n} onClick={()=>setProjCols(n)} style={{fontSize:10,padding:'3px 10px',borderRadius:5,border:'none',background:projCols===n?'var(--blue)':'var(--bg3)',color:projCols===n?'#fff':'var(--t3)',cursor:'pointer'}}>{l}</button>
                  ))}
                  <span style={{fontSize:10,color:'var(--t3)',marginLeft:'auto'}}>{filtered.length}개</span>
                </div>
                {/* 카드 그리드 */}
                <div className={`gr g${projCols}`}>{filtered.map(p=>{
                  const dDay=getDDay(p.dueDate);
                  const focusColor=FOCUS_COLOR(p.focus);
                  return(<div key={p.id} className="cd" style={{position:'relative'}} onMouseEnter={e=>e.currentTarget.querySelector('.proj-menu')&&(e.currentTarget.querySelector('.proj-menu').style.opacity=1)} onMouseLeave={e=>e.currentTarget.querySelector('.proj-menu')&&(e.currentTarget.querySelector('.proj-menu').style.opacity=0)}>
                    <div className="pt2" style={{background:`radial-gradient(circle at 30% 40%,${p.color||'#1a2a3a'}33,transparent 70%)`}} onClick={()=>{setOP(p.id);setCurPage("p1");setCurState(null);setSelEl(null)}}>
                      {/* 코너 레이블: focus + D-date */}
                      <div style={{position:'absolute',top:0,left:0,padding:'3px 8px',fontSize:9,fontWeight:600,color:'#fff',background:focusColor,borderBottomRightRadius:6,whiteSpace:'nowrap'}}>
                        {p.focus||'부가'}{dDay?`｜${dDay}`:''}
                      </div>
                      {/* 타입 뱃지 */}
                      <div className="ps2" style={{background:`${p.color||'#1a2a3a'}22`,color:p.color||'var(--t3)'}}>{p.status||'페이지'}</div>
                    </div>
                    <div className="pn2">{p.name}</div>
                    {/* 부가정보: 타입 · 구현수준 · 시간 */}
                    <div className="pm2">
                      {[p.status||'페이지', p.level, p.updatedAt ? new Date(p.updatedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : p.time].filter(Boolean).join(' · ')}
                    </div>
                    {/* 분류 태그 */}
                    {p.tags?.length>0&&<div style={{padding:'0 14px 10px',display:'flex',gap:4,flexWrap:'wrap'}}>{p.tags.map(t=><span key={t} style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:'var(--bg3)',color:'var(--t3)'}}>{t}</span>)}</div>}
                    <button className="proj-menu" onClick={e=>{e.stopPropagation();openEditModal(p);}} style={{position:'absolute',top:8,right:8,opacity:0,transition:'opacity .15s',background:'rgba(0,0,0,0.5)',border:'none',borderRadius:6,color:'#fff',fontSize:13,padding:'3px 7px',cursor:'pointer',backdropFilter:'blur(4px)'}}>···</button>
                  </div>);
                })}<div className="ac" onClick={openCreateModal}><span style={{fontSize:20}}>+</span>새 프로젝트</div></div>
              </>);
            })()}
          </>)}

          {/* 파운데이션 */}
          {nav==="foundation"&&(<>
            <div className="fl">{["파운데이션","비주얼 에셋"].map(t=><button key={t} className={`ch ${fnTab===t?"on":""}`} onClick={()=>{setFnTab(t);setFnSub("전체")}}>{t==="파운데이션"?"🎨 파운데이션 (토큰)":"📚 비주얼 에셋 (파일)"}</button>)}</div>
            {fnTab==="파운데이션"&&(<>
              <div className="ss">{["전체","컬러","타이포","아이콘","테마 시스템","트랜지션 프리셋"].map(t=><button key={t} className={`ssi ${fnSub===t?"on":""}`} onClick={()=>setFnSub(t)}>{t}</button>)}</div>
              {(fnSub==="전체"||fnSub==="컬러")&&<div className="rc"><div style={{fontSize:13,fontWeight:600,marginBottom:8}}>🎨 컬러</div>{[{n:"--primary",v:"#007AFF",c:"#007AFF",tag:"팔레트"},{n:"--success",v:"#34C759",c:"#34C759",tag:"시맨틱"},{n:"--warning",v:"#FF9500",c:"#FF9500",tag:"시맨틱"},{n:"--danger",v:"#FF3B30",c:"#FF3B30",tag:"시맨틱"}].map((t,i)=><div key={i} className="tr2"><div className="ts2" style={{background:t.c}}/><span className="tn2">{t.n}</span><span className="tv2">{t.v}</span><span style={{fontSize:9,color:"var(--t3)",marginLeft:"auto",background:"var(--bg4)",padding:"1px 6px",borderRadius:4}}>{t.tag}</span></div>)}</div>}
              {(fnSub==="전체"||fnSub==="타이포")&&<div className="rc"><div style={{fontSize:13,fontWeight:600,marginBottom:8}}>📝 타이포</div>{[{n:"--font-body",v:"400 / 14px",tag:"사이즈"},{n:"--font-title",v:"600 / 17px",tag:"사이즈"},{n:"--font-family",v:"Pretendard",tag:"폰트"}].map((t,i)=><div key={i} className="tr2"><div style={{width:24,height:24,borderRadius:6,background:"var(--bg4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--t2)"}}>Aa</div><span className="tn2">{t.n}</span><span className="tv2">{t.v}</span><span style={{fontSize:9,color:"var(--t3)",marginLeft:"auto",background:"var(--bg4)",padding:"1px 6px",borderRadius:4}}>{t.tag}</span></div>)}</div>}
              {(fnSub==="전체"||fnSub==="테마 시스템")&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div className="rc"><div style={{fontSize:12,fontWeight:600,marginBottom:6}}>☀️ 라이트</div>{[{n:"--bg",v:"#FFF",c:"#fff"},{n:"--blue",v:"#007AFF",c:"#007AFF"}].map((t,i)=><div key={i} className="tr2"><div className="ts2" style={{background:t.c}}/><span className="tn2">{t.n}</span><span className="tv2">{t.v}</span></div>)}</div><div className="rc"><div style={{fontSize:12,fontWeight:600,marginBottom:6}}>🌙 다크</div>{[{n:"--bg",v:"#000",c:"#000"},{n:"--blue",v:"#0A84FF",c:"#0A84FF"}].map((t,i)=><div key={i} className="tr2"><div className="ts2" style={{background:t.c}}/><span className="tn2">{t.n}</span><span className="tv2">{t.v}</span></div>)}</div></div>}
            </>)}
            {fnTab==="비주얼 에셋"&&(<>
              <div className="ss">{["전체","배경/텍스처","캐릭터","모션 파일","브랜드 마크"].map(t=><button key={t} className={`ssi ${fnSub===t?"on":""}`} onClick={()=>setFnSub(t)}>{t}</button>)}</div>
              <div className="gr g5">{[{n:"노이즈 텍스처",emoji:"🌫️",tag:"배경/텍스처",fmt:"PNG"},{n:"그라데이션 팩",emoji:"🌈",tag:"배경/텍스처",fmt:"CSS"},{n:"마스코트 Idle",emoji:"🐻",tag:"캐릭터",fmt:"JSON"},{n:"마스코트 Run",emoji:"🏃",tag:"캐릭터",fmt:"JSON"},{n:"로딩 스피너",emoji:"⏳",tag:"모션 파일",fmt:"JSON"},{n:"로고 마크",emoji:"💎",tag:"브랜드 마크",fmt:"SVG"}].filter(x=>fnSub==="전체"||x.tag===fnSub).map((item,i)=>(<div key={i} className="cd"><div className="cd-pv" style={{background:"var(--bg3)",height:90}}><span style={{fontSize:24}}>{item.emoji}</span><div className="cd-bg" style={{background:item.fmt==="SVG"?"var(--green)":item.fmt==="JSON"?"var(--orange)":"var(--purple)",color:"#fff"}}>{item.fmt}</div></div><div className="cd-i"><div className="cd-n" style={{fontSize:12}}>{item.n}</div><div style={{marginTop:2}}><span style={{fontSize:9,color:"var(--t3)",background:"var(--bg4)",padding:"1px 6px",borderRadius:4}}>{item.tag}</span></div></div><div className="cd-a"><button className="cb" style={{fontSize:10}}>복사</button><button className="cb" style={{fontSize:10}}>적용</button></div></div>))}<div className="ac" style={{minHeight:90}}><span style={{fontSize:16}}>+</span>추가</div></div>
            </>)}
          </>)}

          {/* 카탈로그 */}
          {nav==="collect"&&(<div style={{height:"100%",overflow:"hidden"}}><CatalogPanel catalog={catalogData} onCatalogChange={setCatalogData}/></div>)}

          {/* 레퍼런스 */}
          {nav==="references"&&(<ReferencesPanel/>)}

          {/* 커밋 */}
          {nav==="commit"&&(<>
            <div className="fl">{[{l:"🗄️ API/DB",id:"API/DB"},{l:"🤖 에이전트",id:"에이전트"},{l:"🔧 유틸",id:"유틸"},{l:"⚙️ config",id:"config"},{l:"🧠 store",id:"store"}].map(t=><button key={t.id} className={`ch ${cmTab===t.id?"on":""}`} onClick={()=>setCmTab(t.id)}>{t.l}</button>)}</div>
            {cmTab==="API/DB"&&(<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>{[{l:"연결됨",v:2,c:"var(--green)"},{l:"테스트중",v:1,c:"var(--orange)"},{l:"미연결",v:1,c:"var(--red)"}].map((x,i)=>(<div key={i} className="sc2"><div className="sv2" style={{color:x.c}}>{x.v}</div><div className="sl3">{x.l}</div></div>))}</div>{APIS.map((a,i)=>(<div key={i} className="ar"><span className="am2" style={{background:a.method==="GET"?"rgba(52,199,89,.12)":"rgba(0,122,255,.12)",color:a.method==="GET"?"var(--green)":"var(--blue)"}}>{a.method}</span><div><div style={{fontSize:13,fontWeight:500}}>{a.name}</div><div className="ae2">{a.ep}</div></div><div className="ad2" style={{background:scC(a.sc)}}/><span style={{fontSize:11,color:scC(a.sc),fontWeight:600}}>{a.s}</span><button className="cb" style={{marginLeft:8}}>테스트</button></div>))}</>)}
            {cmTab==="에이전트"&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{AGENTS.map((a,i)=>(<div key={i} className="ag"><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:16}}>{a.st}</span><span style={{fontSize:14,fontWeight:600}}>{a.name}</span><span style={{fontSize:10,color:"var(--t3)",marginLeft:"auto"}}>{a.last}</span></div><div style={{fontSize:12,color:"var(--t3)",marginBottom:6}}>{a.desc}</div><div style={{fontSize:11,color:"var(--t2)",padding:"6px 8px",background:"var(--bg3)",borderRadius:8,marginBottom:8}}>{a.result}</div><div style={{display:"flex",gap:4}}><button className="cb">실행</button><button className="cb">설정</button><button className="cb">로그</button></div></div>))}</div>)}
            {cmTab==="유틸"&&(<><div className="ss">{["API","훅","상태관리","헬퍼"].map(t=><button key={t} className="ssi">{t}</button>)}</div>{["useAuth.js","useForm.js","useApi.js","formatDate.js","authApi.js","authStore.js"].map((a,i)=>(<div key={i} className="li"><div className="ld" style={{background:"var(--cyan)"}}/><span style={{fontSize:13,fontWeight:500,fontFamily:"monospace"}}>{a}</span><span style={{fontSize:10,color:"var(--t3)",marginLeft:"auto"}}>유틸</span></div>))}</>)}
            {cmTab==="config"&&(<>{[{k:"API_BASE_URL",v:"https://api.fittrack.com"},{k:"SUPABASE_URL",v:"https://xxx.supabase.co"},{k:"TIMEOUT",v:"5000"},{k:"PAGE_SIZE",v:"20"}].map((e,i)=>(<div key={i} style={{display:"flex",gap:8,padding:"10px 0",borderBottom:"1px solid var(--sep)",alignItems:"center",minHeight:40}}><span style={{fontFamily:"monospace",fontSize:12,color:"var(--blue)",minWidth:150}}>{e.k}</span><span style={{fontFamily:"monospace",fontSize:12,color:"var(--t3)"}}>{e.v}</span><button className="cb" style={{marginLeft:"auto"}}>편집</button></div>))}</>)}
            {cmTab==="store"&&(<>{[{n:"authStore",desc:"로그인 유저 정보"},{n:"exerciseStore",desc:"운동 데이터 목록"},{n:"uiStore",desc:"모달/토스트 상태"}].map((x,i)=>(<div key={i} className="rc"><div style={{fontSize:13,fontWeight:600,fontFamily:"monospace",marginBottom:3}}>{x.n}</div><div style={{fontSize:12,color:"var(--t3)"}}>{x.desc}</div></div>))}</>)}
          </>)}

          {/* 규칙/문서 */}
          {nav==="rules"&&(<>
            <div className="fl">{RULE_CATS.map(t=><button key={t} className={`ch ${ruTab===t?"on":""}`} onClick={()=>setRuTab(t)}>{t}</button>)}</div>
            {RULES_ALL.filter(r=>ruTab==="전체"||r.cat===ruTab).map((r,ri)=>(<div key={ri} className="rc"><div style={{fontSize:13,fontWeight:600,marginBottom:8}}><span style={{color:"var(--blue)"}}>●</span> {r.cat}</div>{r.items.map((item,ii)=>(<div key={ii} className="ri" style={{flexDirection:"column",alignItems:"flex-start",gap:2,padding:"6px 0"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"var(--green)"}}>✓</span><span style={{fontSize:13,fontWeight:500}}>{item.t}</span></div><div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:20}}><span style={{fontSize:11,color:"var(--t3)",flex:1}}>예: {item.ex}</span>{item.tags.map((tag,ti)=>(<span key={ti} style={{fontSize:9,color:"var(--t3)",background:"var(--bg4)",padding:"1px 6px",borderRadius:4}}>{tag}</span>))}</div></div>))}</div>))}
          </>)}

          {/* 관리 */}
          {nav==="manage"&&(<>
            <div className="fl">{["GitHub","zip 관리","버전 관리","환경변수","배포"].map(t=><button key={t} className={`ch ${mgTab===t?"on":""}`} onClick={()=>setMgTab(t)}>{t}</button>)}</div>
            {mgTab==="GitHub"&&(<div className="rc"><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{fontSize:20}}>⬡</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{githubSync?.enabled?"GitHub 동기화 ON":"GitHub 연결 안 됨"}</div><div style={{fontSize:11,color:"var(--t3)"}}>{githubSync?.repo||"레포 미설정"}</div></div><div style={{fontSize:11,fontWeight:600,color:syncStatus==="ok"?"var(--green)":syncStatus==="error"?"var(--red)":syncStatus==="syncing"?"var(--orange)":"var(--t3)"}}>{syncStatus==="ok"?"✓ 동기화됨":syncStatus==="error"?"✗ 오류":syncStatus==="syncing"?"↻ 동기화중":"대기"}</div></div><button className="btn pr" style={{fontSize:11,padding:"4px 14px"}} onClick={()=>setShowSyncSetup(true)}>설정 열기</button></div>)}
            {mgTab==="zip 관리"&&(<><div className="rc"><div style={{fontSize:13,fontWeight:600,marginBottom:8}}>내보내기</div><button className="btn pr" style={{fontSize:11}}>📦 zip 다운로드</button></div><div className="rc"><div style={{fontSize:13,fontWeight:600,marginBottom:8}}>가져오기</div><button className="cb">📂 zip 업로드</button></div></>)}
            {mgTab==="버전 관리"&&(<>{[{v:"v1.3",date:"2026-03-28",msg:"모달A 트리거"},{v:"v1.2",date:"2026-03-27",msg:"카드 수정"},{v:"v1.0",date:"2026-03-24",msg:"초기 생성"}].map((v,i)=>(<div key={i} className="ar"><span style={{fontSize:12,fontWeight:700,color:"var(--blue)",fontFamily:"monospace",minWidth:36}}>{v.v}</span><div><div style={{fontSize:13,fontWeight:500}}>{v.msg}</div><div style={{fontSize:10,color:"var(--t3)"}}>{v.date}</div></div><button className="cb" style={{marginLeft:"auto"}}>롤백</button></div>))}</>)}
            {mgTab==="환경변수"&&(<>{[{k:"SUPABASE_URL",v:"https://xxx.supabase.co"},{k:"API_BASE_URL",v:"https://api.fittrack.com"}].map((e,i)=>(<div key={i} style={{display:"flex",gap:8,padding:"10px 0",borderBottom:"1px solid var(--sep)",alignItems:"center",minHeight:40}}><span style={{fontFamily:"monospace",fontSize:12,color:"var(--blue)",minWidth:160}}>{e.k}</span><span style={{fontFamily:"monospace",fontSize:12,color:"var(--t3)"}}>{e.v}</span><button className="cb" style={{marginLeft:"auto"}}>편집</button></div>))}</>)}
            {mgTab==="배포"&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}><div className="rc"><div style={{fontSize:13,fontWeight:600,marginBottom:8}}>프리뷰</div><div style={{fontSize:12,fontFamily:"monospace",color:"var(--cyan)",marginBottom:8}}>preview-fittrack.vas.app</div><button className="cb">새 프리뷰</button></div><div className="rc"><div style={{fontSize:13,fontWeight:600,marginBottom:8}}>프로덕션</div><div style={{fontSize:12,fontFamily:"monospace",color:"var(--green)",marginBottom:8}}>fittrack.vas.app</div><button className="btn pr" style={{fontSize:11,padding:"4px 12px"}}>배포하기</button></div></div>)}
          </>)}
        </div>
      </div>
    )}
  {showProjModal&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300}} onClick={e=>{if(e.target===e.currentTarget)closeProjModal();}}>
    <div style={{background:'var(--bg)',borderRadius:16,padding:28,width:440,maxHeight:'88vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.35)'}}>
      <div style={{fontSize:16,fontWeight:700,color:'var(--t1)',marginBottom:20}}>{projModalMode==='create'?'새 프로젝트':'프로젝트 수정'}</div>
      {/* 이름 + 컬러 */}
      <div style={{display:'flex',gap:10,marginBottom:14,alignItems:'flex-end'}}>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>이름</div>
          <input autoFocus value={projForm.name} onChange={e=>pf('name',e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitProjModal()} placeholder="프로젝트명" style={{width:'100%',padding:'8px 12px',fontSize:14,fontWeight:600,border:'1px solid var(--sep)',borderRadius:8,background:'var(--bg2)',color:'var(--t1)',outline:'none',boxSizing:'border-box'}}/>
        </div>
        <div>
          <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>컬러</div>
          <input type="color" value={projForm.color||'#1a2a3a'} onChange={e=>pf('color',e.target.value)} style={{width:44,height:36,border:'1px solid var(--sep)',borderRadius:8,cursor:'pointer',padding:2,background:'var(--bg2)'}}/>
        </div>
      </div>
      {/* 타입 */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>타입</div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {PROJ_TYPES.map(t=><button key={t} onClick={()=>pf('status',t)} style={{padding:'5px 12px',fontSize:11,borderRadius:7,border:'none',background:projForm.status===t?'var(--blue)':'var(--bg2)',color:projForm.status===t?'#fff':'var(--t2)',cursor:'pointer'}}>{t}</button>)}
        </div>
      </div>
      {/* 급함 (4단계) */}
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>급함</div>
        <div style={{display:'flex',gap:5}}>
          {FOCUS_OPTIONS.map(({v,c})=><button key={v} onClick={()=>pf('focus',v)} style={{flex:1,padding:'7px 0',fontSize:11,borderRadius:8,border:`1.5px solid ${projForm.focus===v?c:'var(--sep)'}`,background:projForm.focus===v?c+'22':'var(--bg2)',color:projForm.focus===v?c:'var(--t2)',cursor:'pointer',fontWeight:projForm.focus===v?600:400}}>{v}</button>)}
        </div>
      </div>
      {/* 구현 수준 + 목표일 */}
      <div style={{display:'flex',gap:10,marginBottom:14}}>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>구현 수준</div>
          <div style={{display:'flex',gap:5}}>
            {['구현 필요','시안만'].map(v=><button key={v} onClick={()=>pf('level',v)} style={{flex:1,padding:'7px 0',fontSize:11,borderRadius:8,border:`1.5px solid ${projForm.level===v?'var(--blue)':'var(--sep)'}`,background:projForm.level===v?'rgba(0,122,255,.1)':'var(--bg2)',color:projForm.level===v?'var(--blue)':'var(--t2)',cursor:'pointer'}}>{v}</button>)}
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>목표일 <span style={{fontWeight:400}}>(D-n 표시)</span></div>
          <input type="date" value={projForm.dueDate||''} onChange={e=>pf('dueDate',e.target.value)} style={{width:'100%',padding:'7px 10px',fontSize:12,border:'1px solid var(--sep)',borderRadius:8,background:'var(--bg2)',color:'var(--t1)',outline:'none',boxSizing:'border-box'}}/>
        </div>
      </div>
      {/* 분류 태그 */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>분류 태그</div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>
          {projForm.tags.map(t=><span key={t} style={{fontSize:11,padding:'3px 8px',borderRadius:6,background:'var(--bg3)',color:'var(--t2)',display:'flex',alignItems:'center',gap:4}}>{t}<span onClick={()=>removeTag(t)} style={{cursor:'pointer',opacity:.6,fontSize:13}}>×</span></span>)}
        </div>
        <div style={{display:'flex',gap:6}}>
          <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addTag(tagInput);}}} placeholder="태그 입력 후 Enter" style={{flex:1,padding:'6px 10px',fontSize:12,border:'1px solid var(--sep)',borderRadius:8,background:'var(--bg2)',color:'var(--t1)',outline:'none'}}/>
          <button onClick={()=>addTag(tagInput)} style={{padding:'6px 12px',borderRadius:8,border:'none',background:'var(--bg3)',color:'var(--t2)',fontSize:12,cursor:'pointer'}}>+ 추가</button>
        </div>
      </div>
      {/* 버튼 */}
      <div style={{display:'flex',gap:8}}>
        {projModalMode==='edit'&&<button onClick={()=>{closeProjModal();deleteProject(editingProjId);}} style={{padding:'9px 14px',borderRadius:9,border:'1px solid var(--red)',background:'transparent',color:'var(--red)',fontSize:12,cursor:'pointer'}}>삭제</button>}
        <button onClick={closeProjModal} style={{flex:1,padding:'9px 0',borderRadius:9,border:'1px solid var(--sep)',background:'var(--bg2)',color:'var(--t2)',fontSize:13,cursor:'pointer'}}>취소</button>
        <button onClick={submitProjModal} disabled={!projForm.name.trim()} style={{flex:2,padding:'9px 0',borderRadius:9,border:'none',background:projForm.name.trim()?'var(--blue)':'var(--bg3)',color:projForm.name.trim()?'#fff':'var(--t3)',fontSize:13,fontWeight:600,cursor:projForm.name.trim()?'pointer':'default'}}>{projModalMode==='create'?'프로젝트 만들기':'저장'}</button>
      </div>
    </div>
  </div>)}
  {showCollectPopup&&(<div className="cpop-overlay" onClick={e=>{if(e.target===e.currentTarget)setShowCollectPopup(false)}}>
    <div className="cpop">
      <div className="cpop-hd">
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>📥</span><span style={{fontWeight:600,fontSize:15,color:"var(--t1)"}}>수집 보내기</span></div>
        <div style={{width:28,height:28,borderRadius:"50%",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"var(--t2)",cursor:"pointer"}} onClick={()=>setShowCollectPopup(false)}>✕</div>
      </div>
      <div className="cpop-body">

        {/* URL */}
        <div style={{marginBottom:20}}>
          <div className="cpop-sec">수집 대상 URL</div>
          <div style={{border:"0.5px solid var(--sep)",borderRadius:10,padding:"10px 12px",minHeight:48}}>
            {cpUrls.map((u,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <span style={{fontSize:11,background:"rgba(0,122,255,.08)",color:"var(--blue)",padding:"2px 8px",borderRadius:99}}>{u}</span>
              <span style={{fontSize:11,color:"var(--t3)",cursor:"pointer"}} onClick={()=>setCpUrls(p=>p.filter((_,j)=>j!==i))}>✕</span>
            </div>))}
            <input value={cpUrlInput} onChange={e=>setCpUrlInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&cpUrlInput.trim()){setCpUrls(p=>[...p,cpUrlInput.trim()]);setCpUrlInput("")}}} placeholder="URL 입력 후 Enter" style={{border:"none",outline:"none",fontSize:12,background:"transparent",color:"var(--t1)",width:"100%"}}/>
          </div>
        </div>

        {/* Domain */}
        <div style={{marginBottom:20}}>
          <div className="cpop-sec">수집 대상 도메인</div>
          <div className="cpop-sub">어떤 종류의 앱/서비스에서 수집하나요?</div>
          <div className="cpop-tags">
            {["🎮 게임","🔔 알림/일정","🛒 커머스","💬 소셜/채팅","📊 대시보드","🏥 헬스케어","💰 핀테크","🎓 교육","🏋️ 피트니스","🍔 F&B","✈️ 여행","🎵 미디어"].map(d=>{const l=d.slice(d.indexOf(" ")+1);return <span key={d} className={`cpop-tag${cpDomains.includes(l)?" on":""}`} onClick={()=>toggleSet(cpDomains,setCpDomains,l)}>{d}</span>})}
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:99,border:"0.5px dashed var(--sep2)",cursor:"pointer"}}><span style={{fontSize:11,color:"var(--t3)"}}>+</span><input placeholder="직접 입력" onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){toggleSet(cpDomains,setCpDomains,e.target.value.trim());e.target.value=""}}} style={{border:"none",outline:"none",fontSize:11,background:"transparent",color:"var(--t1)",width:64}}/></div>
          </div>
        </div>

        {/* Prompt */}
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <div className="cpop-sec" style={{marginBottom:0}}>에이전트 프롬프트</div>
            <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
              {[
                {label:"수집 에이전트 복사",prompt:COLLECT_AGENT_PROMPT,color:"var(--blue)"},
                {label:"정규화 엔진 복사",prompt:NORMALIZE_ENGINE_PROMPT,color:"#5856d6"},
              ].map(({label,prompt,color})=>(
                <CopyButton key={label} label={label} text={prompt} color={color}/>
              ))}
            </div>
          </div>
          <textarea placeholder={"유저 프롬프트 (topic, 수집 목표 등)\n수집 에이전트 복사 → 시스템 프롬프트로 붙여넣기\n이 필드 → 유저 메시지로 붙여넣기"} style={{width:"100%",boxSizing:"border-box",minHeight:64,border:"0.5px solid var(--sep)",borderRadius:10,padding:"10px 12px",fontSize:12,resize:"vertical",fontFamily:"inherit",color:"var(--t1)",background:"var(--inputbg)"}}/>
        </div>

        {/* Style */}
        <div style={{marginBottom:20}}>
          <div className="cpop-sec">원하는 스타일</div>
          <div className="cpop-tags">
            {["글래스모피즘","뉴모피즘","미니멀","다크 모던","라이트 클린"].map(s=><span key={s} className={`cpop-tag${cpStyles.includes(s)?" on":""}`} onClick={()=>toggleSet(cpStyles,setCpStyles,s)}>{s}</span>)}
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:99,border:"0.5px dashed var(--sep2)",cursor:"pointer"}}><span style={{fontSize:11,color:"var(--t3)"}}>+</span><input placeholder="직접 입력" onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){toggleSet(cpStyles,setCpStyles,e.target.value.trim());e.target.value=""}}} style={{border:"none",outline:"none",fontSize:11,background:"transparent",color:"var(--t1)",width:64}}/></div>
          </div>
        </div>

        {/* Materials */}
        <div style={{marginBottom:20}}>
          <div className="cpop-sec">수집할 재료</div>
          <div className="cpop-sub">어떤 종류의 디자인 재료를 가져올까요?</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[{emoji:"🎨",name:"파운데이션",desc:"값과 규칙을 정의하는 추상적 재료",subs:["컬러","타이포","아이콘","테마","트랜지션"]},{emoji:"📚",name:"비주얼 에셋",desc:"실제 파일로 존재하는 시각적 재료",subs:["배경/텍스처","일러스트","일러스트 아이콘","브랜드 마크","캐릭터","모션(Lottie)"]}].map(m=>{const isOn=cpMaterials[m.name]!==undefined;return <div key={m.name} className={`cpop-card${isOn?" on":""}`} onClick={e=>{if(e.target.closest(".cpop-chip"))return;toggleMatCat(m.name)}}>
              <div className="cpop-chk">{isOn&&<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5 L4.5 7.5 L8 3" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
              <div style={{fontSize:16,marginBottom:4}}>{m.emoji}</div>
              <div style={{fontSize:12,fontWeight:600,color:"var(--t1)"}}>{m.name}</div>
              <div style={{fontSize:11,color:"var(--t3)",marginTop:2,lineHeight:1.4}}>{m.desc}</div>
              {isOn&&<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:8}}>{m.subs.map(s=><span key={s} className={`cpop-chip${(cpMaterials[m.name]||[]).includes(s)?" on":""}`} onClick={e=>{e.stopPropagation();toggleMatSub(m.name,s)}}>{s}</span>)}</div>}
            </div>})}
          </div>
        </div>

        {/* Decomposition */}
        <div style={{marginBottom:20}}>
          <div className="cpop-sec">분해 단위</div>
          <div className="cpop-sub">UI를 어디까지 쪼개서 가져올까요?</div>
          <div className="cpop-seg">
            {[{emoji:"⚛️",name:"원자",desc:"버튼, 인풋 등 최소 단위까지"},{emoji:"🧱",name:"블록",desc:"카드, 폼 등 덩어리 단위까지"},{emoji:"📐",name:"섹션",desc:"영역 단위까지"},{emoji:"📄",name:"페이지",desc:"화면 통째로"}].map(d=><div key={d.name} className={`cpop-seg-item${cpDecomp.includes(d.name)?" on":""}`} onClick={()=>toggleSet(cpDecomp,setCpDecomp,d.name)}>
              <div style={{fontSize:16,marginBottom:3}}>{d.emoji}</div>
              <div style={{fontSize:12,fontWeight:600,color:cpDecomp.includes(d.name)?"var(--blue)":"var(--t1)"}}>{d.name}</div>
              <div style={{fontSize:11,color:"var(--t3)",marginTop:2,lineHeight:1.3}}>{d.desc}</div>
              <div className="cpop-chk2">{cpDecomp.includes(d.name)&&<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5 L4.5 7.5 L8 3" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
            </div>)}
          </div>
        </div>

        {/* Schedule */}
        <div>
          <div className="cpop-sec">수집 예약</div>
          <div className="cpop-sched">
            {[{id:"즉시",label:"즉시 실행"},{id:"예약",label:"예약",sub:"날짜/시간 지정"},{id:"정기",label:"정기 수집",sub:"매일/매주/매월"}].map(s=><div key={s.id} className={`cpop-sched-item${cpSched===s.id?" on":""}`} onClick={()=>setCpSched(s.id)}>
              <div style={{fontSize:12,fontWeight:600,color:cpSched===s.id?"var(--blue)":"var(--t1)"}}>{s.label}</div>
              {s.sub&&<div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{s.sub}</div>}
            </div>)}
          </div>
        </div>

      </div>
      <div className="cpop-ft">
        <div style={{fontSize:11,color:"var(--t3)",maxWidth:300,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {cpDomains.length>0&&cpDomains.join(", ")+" · "}
          {Object.keys(cpMaterials).length>0&&"재료: "+Object.entries(cpMaterials).map(([k,v])=>v.length>0?`${k}(${v.length})`:k).join(", ")+" · "}
          {cpDecomp.length>0&&"분해: "+cpDecomp.join("+")}
          {" · "+cpSched}
        </div>
        <div style={{display:"flex",gap:8,flexDirection:"column",width:"100%"}}>
          {cpResult&&(<div style={{fontSize:11,padding:"7px 12px",borderRadius:8,background:cpResult.error?"rgba(255,59,48,.08)":cpResult.status?"rgba(0,122,255,.08)":"rgba(52,199,89,.08)",color:cpResult.error?"var(--red)":cpResult.status?"var(--blue)":"var(--green)"}}>{cpResult.error?`❌ ${cpResult.error}`:cpResult.status?cpResult.status:`✅ ${cpResult.count}개 노드 추가됨 — 카탈로그로 이동합니다...`}</div>)}
          <div style={{display:"flex",gap:8}}>
            <button className="btn" style={{background:"var(--bg3)",color:"var(--t2)",border:"none",fontSize:13,padding:"8px 16px"}} onClick={()=>{setShowCollectPopup(false);setCpResult(null);}}>닫기</button>
            <button className="btn" style={{background:"none",color:"var(--t2)",border:"1px solid var(--sep)",fontSize:12,padding:"8px 14px"}} onClick={()=>{
              const userPrompt=buildCollectUserPrompt({urls:cpUrls,domains:cpDomains,styles:cpStyles,materials:cpMaterials,decomp:cpDecomp,agentMemo:''});
              navigator.clipboard.writeText(userPrompt).catch(()=>{});
            }}>유저 프롬프트 복사</button>
            <button className="btn pr" disabled={cpBusy} style={{flex:1,fontSize:13,padding:"8px 0",opacity:cpBusy?0.5:1}} onClick={async()=>{
              setCpBusy(true);setCpResult(null);
              try{
                const{collectDirectly,collectByTopic}=await import("./utils/githubCodeFetch.js");
                const{mergeToCatalog}=await import("./utils/catalogParser.js");
                const onProgress=(msg)=>setCpResult({status:msg});
                let total=0;
                // 1. URL 목록 수집
                if(cpUrls.length>0){
                  setCpResult({status:`📡 ${cpUrls.length}개 URL 수집 중...`});
                  const batches=await collectDirectly(cpUrls,null,onProgress);
                  for(const b of batches){setCatalogData(prev=>mergeToCatalog(prev,b));total+=b.nodes.length;}
                }
                // 2. 주제/도메인 기반 GitHub Code Search (LLM 확장 포함)
                if(cpDomains.length>0||cpStyles.length>0){
                  let expandedTerms=[];
                  const apiKey=cpApiKey();
                  if(apiKey){
                    setCpResult({status:`🤖 주제 확장 중...`});
                    const{expandTopicsWithLLM}=await import("./utils/claudeAnalyze.js");
                    expandedTerms=await expandTopicsWithLLM(cpDomains,cpStyles,apiKey);
                  }
                  setCpResult({status:`🔍 주제 검색 중: ${[...cpDomains,...expandedTerms.slice(0,3)].join(', ')}...`});
                  const batches=await collectByTopic({domains:cpDomains,styles:cpStyles,materials:Object.keys(cpMaterials),expandedTerms},null,onProgress);
                  for(const b of batches){setCatalogData(prev=>mergeToCatalog(prev,b));total+=b.nodes.length;}
                }
                setCpResult({count:total});
                setTimeout(()=>{setShowCollectPopup(false);setCpResult(null);setNav("collect");},2000);
              }catch(e){setCpResult({error:e.message});}
              finally{setCpBusy(false);}
            }}>{cpBusy?'수집 중...':'🚀 자동 수집 시작'}</button>
          </div>
        </div>
      </div>
    </div>
  </div>)}
  </div>
  </>);
}
