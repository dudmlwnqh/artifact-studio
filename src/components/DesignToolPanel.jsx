import { useState, useRef, useEffect, useCallback } from "react";

const PAIR = { top: "bottom", bottom: "top", left: "right", right: "left" };
const MAX_V = 60, OT = 8;
const FONTS = ["system-ui","Pretendard","Apple SD Gothic Neo","Noto Sans KR","Inter","Roboto","SF Pro","Helvetica Neue","Georgia","Times New Roman","Nanum Gothic","Nanum Myeongjo","monospace","cursive"];
const inputBg = "rgba(255,255,255,0.05)", inputBorder = "1px solid rgba(255,255,255,0.06)";
const monoFont = '"SF Mono","Cascadia Code",monospace', labelColor = "rgba(255,255,255,0.4)", dimColor = "rgba(255,255,255,0.25)";

function ColorInput({ label, value, onChange }) {
  const ref = useRef(null);
  const [hasEd] = useState(() => typeof window !== "undefined" && "EyeDropper" in window);
  const ed = async () => { if (!hasEd) return; try { const r = await new window.EyeDropper().open(); onChange(r.sRGBHex); } catch {} };
  return (<div>
    {label && <p style={{ fontSize: 11, color: labelColor, marginBottom: 4 }}>{label}</p>}
    <div style={{ background: inputBg, borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, border: inputBorder }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: value, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }} onClick={() => ref.current?.click()} />
        <input ref={ref} type="color" value={value.length === 4 ? value.replace(/#([0-9a-f])([0-9a-f])([0-9a-f])/i,'#$1$1$2$2$3$3') : value}
          onChange={(e) => onChange(e.target.value)} style={{ position: "absolute", top: 0, left: 0, width: 22, height: 22, opacity: 0, cursor: "pointer" }} />
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: monoFont, width: "100%", outline: "none" }} />
      {hasEd && <button onClick={ed} title="스포이드" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 22l1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="M14 4l.5-.5a2.12 2.12 0 013 3l-.5.5"/><path d="M14.5 5.5l4 4"/></svg>
      </button>}
    </div>
  </div>);
}

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
    const rc = cv.getBoundingClientRect(); const dpr = devicePixelRatio || 1;
    const w = rc.width, h = rc.height; dims.current = { w, h };
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const drag = dragRef.current;
    const { outer, border: bdr, content: con } = getBoxes(w, h);
    const mc = { light: "rgba(236,166,90,", accent: "#ECA65A" };
    const pc = { light: "rgba(127,119,221,", accent: "#7F77DD" };
    const hlDirs = (layer, dir) => { const all = layer === "margin" ? allM : allP; return all ? ["top","bottom","left","right"] : [dir, PAIR[dir]]; };
    const hlZone = (layer, ob, ib, col) => {
      const all = layer === "margin" ? allM : allP;
      ["top","bottom","left","right"].forEach(d => {
        const isA = all || (drag && drag.layer === layer && hlDirs(layer, drag.dir).includes(d));
        const isH = !drag && hover && hover.layer === layer && hlDirs(layer, hover.dir).includes(d);
        if (!isA && !isH) return;
        ctx.fillStyle = col + (isA ? "0.2)" : "0.1)");
        if (d === "top") ctx.fillRect(ob.x, ob.y, ob.w, Math.max(0, ib.y - ob.y));
        else if (d === "bottom") ctx.fillRect(ob.x, ib.y + ib.h, ob.w, Math.max(0, ob.y + ob.h - ib.y - ib.h));
        else if (d === "left") ctx.fillRect(ob.x, ib.y, Math.max(0, ib.x - ob.x), ib.h);
        else ctx.fillRect(ib.x + ib.w, ib.y, Math.max(0, ob.x + ob.w - ib.x - ib.w), ib.h);
      });
    };
    const drawVals = (layer, vals, ob, ib, col) => {
      const lp = { top: { x: (ob.x * 2 + ob.w) / 2, y: ob.y + Math.max(6, (ib.y - ob.y) / 2) }, bottom: { x: (ob.x * 2 + ob.w) / 2, y: ib.y + ib.h + Math.max(6, (ob.y + ob.h - ib.y - ib.h) / 2) }, left: { x: ob.x + Math.max(6, (ib.x - ob.x) / 2), y: (ob.y * 2 + ob.h) / 2 }, right: { x: ib.x + ib.w + Math.max(6, (ob.x + ob.w - ib.x - ib.w) / 2), y: (ob.y * 2 + ob.h) / 2 } };
      ["top","bottom","left","right"].forEach(d => {
        if (editing && editing.layer === layer && editing.dir === d) return;
        const z = lp[d], v = vals[d];
        const isA = (layer === "margin" ? allM : allP) || (drag && drag.layer === layer && hlDirs(layer, drag.dir).includes(d));
        const isH = !drag && hover && hover.layer === layer && hlDirs(layer, hover.dir).includes(d);
        ctx.font = `${isA || isH ? 500 : 400} 10px "SF Mono",monospace`;
        ctx.fillStyle = isA ? col.replace(",", ",") + "1)" : isH ? col + "0.8)" : col + "0.45)";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(v, z.x, z.y);
      });
    };
    rr(ctx, outer.x, outer.y, outer.w, outer.h, 8); ctx.fillStyle = mc.light + "0.06)"; ctx.fill();
    ctx.setLineDash([5, 3]); ctx.strokeStyle = mc.light + (allM ? "0.5)" : "0.25)"); ctx.lineWidth = 1;
    rr(ctx, outer.x, outer.y, outer.w, outer.h, 8); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    hlZone("margin", outer, bdr, mc.light);
    ctx.font = "500 8px 'SF Mono',monospace"; ctx.fillStyle = mc.light + "0.3)"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("margin", outer.x + 5, outer.y + 3);
    rr(ctx, bdr.x, bdr.y, bdr.w, bdr.h, 6); ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.5; rr(ctx, bdr.x, bdr.y, bdr.w, bdr.h, 6); ctx.stroke(); ctx.lineWidth = 1;
    rr(ctx, bdr.x, bdr.y, bdr.w, bdr.h, 6); ctx.fillStyle = pc.light + "0.06)"; ctx.fill();
    ctx.setLineDash([5, 3]); ctx.strokeStyle = pc.light + (allP ? "0.5)" : "0.25)"); ctx.lineWidth = 1;
    rr(ctx, bdr.x + 1, bdr.y + 1, bdr.w - 2, bdr.h - 2, 5); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    hlZone("padding", bdr, con, pc.light);
    ctx.font = "500 8px 'SF Mono',monospace"; ctx.fillStyle = pc.light + "0.3)"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("padding", bdr.x + 5, bdr.y + 4);
    rr(ctx, con.x, con.y, con.w, con.h, 4); ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 0.5; rr(ctx, con.x, con.y, con.w, con.h, 4); ctx.stroke();
    if (con.w > 36 && con.h > 14) { ctx.font = "400 10px 'SF Mono',monospace"; ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("content", con.x + con.w / 2, con.y + con.h / 2); }
    drawVals("margin", margin, outer, bdr, mc.light);
    drawVals("padding", padding, bdr, con, pc.light);
    const cur = hover || drag;
    if (!cur) cv.style.cursor = "default";
    else if (cur.dir === "center") cv.style.cursor = "pointer";
    else if (cur.dir === "top" || cur.dir === "bottom") cv.style.cursor = "ns-resize";
    else cv.style.cursor = "ew-resize";
  }, [margin, padding, allM, allP, hover, editing, getBoxes]);

  useEffect(() => { draw(); }, [draw]);

  const getPos = (e) => { const r = cvRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const lastTapRef = useRef({ time: 0, hit: null });

  const onDown = (e) => {
    const p = getPos(e); const h = hitTest(p.x, p.y); if (!h) return;
    const now = Date.now(); const lt = lastTapRef.current;
    if (h.layer !== "content" && lt.hit && lt.hit.layer === h.layer && lt.hit.dir === h.dir && now - lt.time < 400) { lastTapRef.current = { time: 0, hit: null }; setEditing(h); return; }
    lastTapRef.current = { time: now, hit: h };
    if (h.layer === "content") { setAllP(s => !s); return; }
    e.preventDefault(); cvRef.current.setPointerCapture(e.pointerId);
    const vals = h.layer === "margin" ? margin : padding;
    dragRef.current = h; startRef.current = { x: e.clientX, y: e.clientY, v: vals[h.dir], pv: vals[PAIR[h.dir]] }; draw();
  };
  const onMove = (e) => {
    if (!dragRef.current) { setHover(hitTest(getPos(e).x, getPos(e).y)); return; }
    e.preventDefault(); const d = dragRef.current; const { x: sx, y: sy, v: sv, pv: spv } = startRef.current;
    let delta; if (d.dir === "top") delta = sy - e.clientY; else if (d.dir === "bottom") delta = e.clientY - sy; else if (d.dir === "left") delta = sx - e.clientX; else delta = e.clientX - sx;
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
  const tb = (active, c) => ({ fontSize: 10, padding: "2px 7px", borderRadius: 4, border: "none", cursor: "pointer", background: active ? (c === "m" ? "rgba(236,166,90,0.18)" : "rgba(127,119,221,0.18)") : "rgba(255,255,255,0.04)", color: active ? (c === "m" ? "#ECA65A" : "#7F77DD") : "rgba(255,255,255,0.22)", fontFamily: "'SF Mono',monospace" });

  return (<div style={{ position: "relative" }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
      <button onClick={() => setAllM(s => !s)} style={tb(allM, "m")}>margin 전체 {allM ? "●" : "○"}</button>
      <button onClick={() => setAllP(s => !s)} style={tb(allP, "p")}>padding 전체 {allP ? "●" : "○"}</button>
    </div>
    <canvas ref={cvRef} style={{ width: "100%", aspectRatio: "1.45", display: "block", touchAction: "none" }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      onPointerLeave={() => { if (!dragRef.current) setHover(null); }} />
    {editing && (
      <div style={{ position: "absolute", left: 0, right: 0, top: 30, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <input autoFocus type="number" defaultValue={(editing.layer === "margin" ? margin : padding)[editing.dir]} min={0} max={MAX_V}
          style={{ pointerEvents: "auto", width: 50, height: 26, textAlign: "center", fontSize: 12, fontFamily: monoFont, border: `1.5px solid ${editing.layer === "margin" ? "#ECA65A" : "#7F77DD"}`, borderRadius: 6, background: "#1a1a2e", color: "#fff", outline: "none", padding: 0 }}
          onBlur={(e) => commitEdit(editing.layer, editing.dir, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } if (e.key === "Escape") setEditing(null); }} />
      </div>
    )}
    <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.2)", margin: "5px 0 0" }}>
      <span style={{ color: "rgba(236,166,90,0.5)" }}>margin</span><span style={{ color: "rgba(255,255,255,0.15)", margin: "0 4px" }}>—</span>
      <span style={{ color: "rgba(255,255,255,0.4)" }}>border</span><span style={{ color: "rgba(255,255,255,0.15)", margin: "0 4px" }}>—</span>
      <span style={{ color: "rgba(127,119,221,0.5)" }}>padding</span><span style={{ color: "rgba(255,255,255,0.15)", margin: "0 4px" }}>—</span>
      <span style={{ color: "rgba(255,255,255,0.3)" }}>content</span>
    </p>
  </div>);
}

function Section({ title, children }) { return (<div style={{ marginBottom: 20 }}><p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10, fontWeight: 500 }}>{title}</p>{children}</div>); }
function Divider() { return <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 20px" }} />; }
function NumberInput({ label, value, unit, onChange, step }) { return (<div><p style={{ fontSize: 11, color: labelColor, marginBottom: 4 }}>{label}</p><div style={{ background: inputBg, borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", border: inputBorder }}><input type="number" value={value} step={step || 1} onChange={(e) => onChange(Number(e.target.value))} style={{ background: "none", border: "none", color: "#fff", fontSize: 13, fontFamily: monoFont, width: "60%", outline: "none" }} />{unit && <span style={{ fontSize: 11, color: dimColor }}>{unit}</span>}</div></div>); }
function SliderInput({ label, value, min, max, step, unit, onChange }) { const d = step && step < 1 ? value.toFixed(1) : Math.round(value); return (<div><p style={{ fontSize: 11, color: labelColor, marginBottom: 4 }}>{label}</p><div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="range" min={min} max={max} step={step || 1} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, accentColor: "#7F77DD", height: 4, cursor: "pointer" }} /><div style={{ background: inputBg, borderRadius: 6, padding: "4px 8px", minWidth: 36, textAlign: "center", border: inputBorder }}><span style={{ fontSize: 12, fontFamily: monoFont, color: "#fff" }}>{d}</span>{unit && <span style={{ fontSize: 10, color: dimColor, marginLeft: 2 }}>{unit}</span>}</div></div></div>); }
function SegmentControl({ label, options, value, onChange }) { return (<div>{label && <p style={{ fontSize: 11, color: labelColor, marginBottom: 4 }}>{label}</p>}<div style={{ display: "flex", background: inputBg, borderRadius: 8, border: inputBorder, overflow: "hidden" }}>{options.map(opt => { const k = typeof opt === "string" ? opt : opt.key; const l = typeof opt === "string" ? opt : opt.label; return (<button key={k} onClick={() => onChange(k)} style={{ flex: 1, padding: "6px 0", border: "none", cursor: "pointer", fontSize: 11, fontWeight: value === k ? 500 : 400, background: value === k ? "rgba(127,119,221,0.2)" : "transparent", color: value === k ? "#AFA9EC" : "rgba(255,255,255,0.35)", fontFamily: monoFont }}>{l}</button>); })}</div></div>); }
function SelectInput({ label, value, options, onChange }) { return (<div><p style={{ fontSize: 11, color: labelColor, marginBottom: 4 }}>{label}</p><select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", background: inputBg, border: inputBorder, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", fontFamily: monoFont, appearance: "none", cursor: "pointer" }}>{options.map(o => <option key={o} value={o} style={{ background: "#1a1a2e" }}>{o}</option>)}</select></div>); }

// Props: { style, onChange(key, value), tagName, textContent, onClose }
export default function DesignToolPanel({ style: so, onChange, tagName, textContent, onClose }) {
  const s = so || {};
  const get = (k, def) => s[k] || def;
  const parsePx = (v) => parseInt(String(v || "0").replace("px", ""), 10) || 0;
  const parseBox = (v) => {
    const parts = String(v || "0").replace(/px/g, "").trim().split(/\s+/).map(Number);
    if (parts.length === 1) return { top: parts[0]||0, right: parts[0]||0, bottom: parts[0]||0, left: parts[0]||0 };
    if (parts.length === 2) return { top: parts[0]||0, right: parts[1]||0, bottom: parts[0]||0, left: parts[1]||0 };
    if (parts.length === 3) return { top: parts[0]||0, right: parts[1]||0, bottom: parts[2]||0, left: parts[1]||0 };
    return { top: parts[0]||0, right: parts[1]||0, bottom: parts[2]||0, left: parts[3]||0 };
  };

  const [margin, setMargin] = useState(parseBox(s.margin));
  const [padding, setPadding] = useState(parseBox(s.padding));

  useEffect(() => { onChange("margin", `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`); }, [margin]);
  useEffect(() => { onChange("padding", `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`); }, [padding]);

  const shadowMap = { none: "none", "약한": "0 1px 3px rgba(0,0,0,0.2)", "중간": "0 4px 14px rgba(0,0,0,0.35)", "강한": "0 10px 30px rgba(0,0,0,0.5)" };
  const curShadow = Object.entries(shadowMap).find(([,v]) => v === get("boxShadow","none"))?.[0] || "none";
  const ss = { width: "100%", background: inputBg, border: inputBorder, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, outline: "none", fontFamily: monoFont, appearance: "none", cursor: "pointer" };

  return (
    <div style={{ width: 300, background: "#13131f", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "#7F77DD", background: "rgba(127,119,221,0.15)", padding: "3px 10px", borderRadius: 6, fontWeight: 500 }}>{tagName || "div"}</span>
        {textContent && <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>"{textContent.slice(0, 15)}"</span>}
        <span onClick={onClose} style={{ marginLeft: "auto", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 16, padding: "0 4px" }}>×</span>
      </div>
      <div style={{ padding: 16, overflow: "auto", flex: 1 }}>
        <Section title="타이포그래피">
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 11, color: labelColor, marginBottom: 4 }}>폰트</p>
            <select value={get("fontFamily","system-ui")} onChange={e => onChange("fontFamily", e.target.value)} style={ss}>
              {FONTS.map(f => <option key={f} value={f} style={{ background: "#1a1a2e" }}>{f}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <NumberInput label="크기" value={parsePx(s.fontSize) || 14} unit="px" onChange={v => onChange("fontSize", v + "px")} />
            <SelectInput label="굵기" value={get("fontWeight","400")} options={["300","400","500","600","700"]} onChange={v => onChange("fontWeight", v)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <NumberInput label="행간" value={parseFloat(get("lineHeight","1.5"))} step={0.1} onChange={v => onChange("lineHeight", String(v))} />
            <NumberInput label="자간" value={parsePx(s.letterSpacing)} unit="px" step={0.1} onChange={v => onChange("letterSpacing", v + "px")} />
          </div>
          <SegmentControl label="정렬" options={[{ key: "left", label: "좌" }, { key: "center", label: "중" }, { key: "right", label: "우" }]} value={get("textAlign","left")} onChange={v => onChange("textAlign", v)} />
        </Section>
        <Divider />
        <Section title="색상">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <ColorInput label="글자색" value={get("color","#ffffff")} onChange={v => onChange("color", v)} />
            <ColorInput label="배경색" value={get("background","#000000")} onChange={v => onChange("background", v)} />
          </div>
        </Section>
        <Divider />
        <Section title="박스 모델">
          <CSSBoxModel margin={margin} setMargin={setMargin} padding={padding} setPadding={setPadding} />
        </Section>
        <Divider />
        <Section title="레이아웃">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <NumberInput label="간격(gap)" value={parsePx(s.gap)} unit="px" onChange={v => onChange("gap", v + "px")} />
            <NumberInput label="둥글기" value={parsePx(s.borderRadius)} unit="px" onChange={v => onChange("borderRadius", v + "px")} />
          </div>
        </Section>
        <Divider />
        <Section title="선 (border)">
          <div style={{ marginBottom: 8 }}>
            <SegmentControl label="스타일" options={["none","solid","dashed","dotted"]} value={get("borderStyle","none")} onChange={v => onChange("borderStyle", v)} />
          </div>
          {get("borderStyle","none") !== "none" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <SliderInput label="두께" value={parsePx(s.borderWidth)} min={0} max={10} unit="px" onChange={v => onChange("borderWidth", v + "px")} />
              <ColorInput label="색상" value={get("borderColor","#ffffff")} onChange={v => onChange("borderColor", v)} />
            </div>
          )}
        </Section>
        <Divider />
        <Section title="효과">
          <div style={{ marginBottom: 10 }}><SliderInput label="opacity" value={parseFloat(get("opacity","1"))} min={0} max={1} step={0.05} onChange={v => onChange("opacity", String(v))} /></div>
          <SegmentControl label="box-shadow" options={[{ key: "none", label: "없음" },{ key: "약한", label: "약한" },{ key: "중간", label: "중간" },{ key: "강한", label: "강한" }]} value={curShadow} onChange={v => onChange("boxShadow", shadowMap[v])} />
        </Section>
      </div>
    </div>
  );
}
