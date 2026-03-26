import { useState, useRef, useEffect, useCallback } from "react";

function parseStyle(str) {
  const o = {};
  if (!str) return o;
  str.split(";").forEach(p => {
    const i = p.indexOf(":");
    if (i < 0) return;
    const k = p.substring(0, i).trim();
    const v = p.substring(i + 1).trim();
    if (k && v) o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  return o;
}

function styleToStr(o) {
  return Object.entries(o)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`)
    .join(";");
}

export default function Editor({ project, onBack, onSave, t }) {
  const [code, setCode] = useState(project.code || "");
  const [selIdx, setSelIdx] = useState(null);
  const [els, setEls] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const previewRef = useRef(null);

  // Parse HTML into elements array
  useEffect(() => {
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = code;
      const arr = [];
      const walk = (node, depth) => {
        if (node.nodeType === 1) {
          const tag = node.tagName.toLowerCase();
          const styleObj = parseStyle(node.getAttribute("style") || "");
          const childNodes = Array.from(node.childNodes);
          const textContent = childNodes.length === 1 && childNodes[0].nodeType === 3
            ? childNodes[0].textContent.trim() : null;
          arr.push({ tag, so: styleObj, tc: textContent, depth });
          Array.from(node.children).forEach(c => walk(c, depth + 1));
        }
      };
      Array.from(tmp.children).forEach(c => walk(c, 0));
      setEls(arr);
    } catch (e) {
      setEls([]);
    }
  }, [code]);

  // Rebuild HTML from modified elements
  const rebuild = useCallback((newEls) => {
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = code;
      let i = 0;
      const walk = (node) => {
        if (node.nodeType === 1) {
          if (i < newEls.length) {
            node.setAttribute("style", styleToStr(newEls[i].so));
          }
          i++;
          Array.from(node.children).forEach(walk);
        }
      };
      Array.from(tmp.children).forEach(walk);
      return tmp.innerHTML;
    } catch (e) {
      return code;
    }
  }, [code]);

  // Update a style property
  const updateStyle = (key, value) => {
    if (selIdx === null) return;
    const newEls = els.map((el, i) => {
      if (i !== selIdx) return el;
      const s = { ...el.so };
      if (key === "fontSize") s.fontSize = value + "px";
      else if (key === "borderRadius") s.borderRadius = value + "px";
      else if (key === "gap") s.gap = value + "px";
      else if (key === "letterSpacing") s.letterSpacing = value + "px";
      else s[key] = value;
      return { ...el, so: s };
    });
    setEls(newEls);
    setCode(rebuild(newEls));
  };

  // Handle save
  const handleSave = () => {
    onSave({ ...project, code });
    onBack();
  };

  // Copy code
  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Click on preview to select element
  const handlePreviewClick = (e) => {
    if (!previewRef.current) return;
    let idx = 0;
    let found = -1;
    const walk = (node) => {
      if (node.nodeType === 1) {
        if (node === e.target) found = idx;
        idx++;
        Array.from(node.children).forEach(walk);
      }
    };
    Array.from(previewRef.current.children).forEach(walk);
    if (found >= 0 && found < els.length) setSelIdx(found);
  };

  const sel = selIdx !== null ? els[selIdx] : null;

  // Slider component
  const Slider = ({ label, value, onChange, min = 0, max = 100, step = 1, unit = "px" }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, height: 4, accentColor: t.ac }} />
        <input value={value} onChange={e => onChange(e.target.value)}
          style={{
            width: 44, padding: "4px 6px", background: t.ib,
            border: `1px solid ${t.ibr}`, borderRadius: 4,
            fontSize: 11, color: t.tx, fontFamily: "monospace",
            textAlign: "right", outline: "none"
          }} />
        {unit && <span style={{ fontSize: 10, color: t.t3, width: 18 }}>{unit}</span>}
      </div>
    </div>
  );

  // Color input
  const ColorField = ({ label, propKey }) => {
    const val = sel?.so[propKey] || "";
    const hex = val.startsWith("#") ? val : "#000000";
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="color" value={hex} onChange={e => updateStyle(propKey, e.target.value)}
            style={{ width: 28, height: 28, border: `1px solid ${t.ibr}`, borderRadius: 4, padding: 0, cursor: "pointer" }} />
          <input value={val} onChange={e => updateStyle(propKey, e.target.value)}
            style={{
              flex: 1, padding: "4px 8px", background: t.ib,
              border: `1px solid ${t.ibr}`, borderRadius: 4,
              fontSize: 11, color: t.tx, fontFamily: "monospace", outline: "none"
            }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: t.bg, color: t.tx, fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
        borderBottom: `1px solid ${t.cb}`, position: "sticky", top: 0, background: t.bg, zIndex: 10
      }}>
        <span onClick={onBack} style={{ cursor: "pointer", color: t.t3, fontSize: 18, padding: "0 4px" }}>←</span>
        <b style={{ fontSize: 15 }}>{project.name}</b>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => setShowCodeInput(!showCodeInput)}
            style={{ padding: "5px 12px", fontSize: 11, border: `1px solid ${t.cb}`, background: showCodeInput ? t.abg : "transparent", color: showCodeInput ? t.ac : t.t3, cursor: "pointer", borderRadius: 4 }}>
            {showCodeInput ? "코드 닫기" : "코드 입력"}
          </button>
          <button onClick={handleCopy}
            style={{ padding: "5px 12px", fontSize: 11, border: `1px solid ${t.ac}`, background: t.abg, color: copied ? t.gn : t.ac, cursor: "pointer", borderRadius: 4 }}>
            {copied ? "복사됨 ✓" : "코드 복사"}
          </button>
          <button onClick={handleSave}
            style={{ padding: "5px 12px", fontSize: 11, border: `1px solid ${t.gn}`, background: "transparent", color: t.gn, cursor: "pointer", borderRadius: 4, fontWeight: 600 }}>
            저장
          </button>
        </div>
      </div>

      {/* Code input */}
      {showCodeInput && (
        <div style={{ borderBottom: `1px solid ${t.cb}` }}>
          <textarea value={code}
            onChange={e => { setCode(e.target.value); setSelIdx(null); }}
            style={{
              width: "100%", height: 140, padding: 12, background: t.pv,
              border: "none", color: t.gn, fontFamily: "monospace",
              fontSize: 12, lineHeight: 1.6, resize: "vertical", outline: "none",
              boxSizing: "border-box"
            }}
            placeholder="HTML / JSX 코드를 붙여넣으세요..."
          />
        </div>
      )}

      {/* Main area: preview + properties side by side */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.cb}` }}>

        {/* Preview */}
        <div style={{ flex: 1, borderRight: `1px solid ${t.cb}` }}>
          <div style={{ padding: "6px 12px", borderBottom: `1px solid ${t.cb}`, fontSize: 11, color: t.t3 }}>
            미리보기
            {sel && <span style={{ marginLeft: 8, color: t.ac, fontWeight: 500 }}>&lt;{sel.tag}&gt; 선택됨</span>}
          </div>
          <div style={{
            minHeight: 350, padding: 24, background: t.pv,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div ref={previewRef} onClick={handlePreviewClick}
              dangerouslySetInnerHTML={{ __html: code }}
              style={{ maxWidth: "100%", cursor: "crosshair" }} />
          </div>
        </div>

        {/* Properties panel */}
        <div style={{ width: 260, flexShrink: 0, background: t.card }}>
          <div style={{ padding: "6px 12px", borderBottom: `1px solid ${t.cb}`, fontSize: 11, color: t.t3 }}>
            속성 편집
          </div>

          {!sel ? (
            <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: t.t3 }}>
              ← 미리보기에서<br />요소를 클릭하세요
            </div>
          ) : (
            <div style={{ maxHeight: 500, overflow: "auto", padding: "10px 14px" }}>
              {/* Selected element info */}
              <div style={{
                padding: "6px 10px", marginBottom: 12, background: t.abg,
                borderRadius: 6, fontSize: 12, color: t.ac, fontWeight: 500
              }}>
                &lt;{sel.tag}&gt;
                {sel.tc && <span style={{ fontWeight: 400, color: t.t3, marginLeft: 4 }}>"{sel.tc.slice(0, 12)}"</span>}
              </div>

              {/* Font size */}
              <Slider label="글자 크기" value={(sel.so.fontSize || "14").replace("px", "")}
                onChange={v => updateStyle("fontSize", v)} min={8} max={72} />

              {/* Font weight */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>글자 굵기</div>
                <select value={sel.so.fontWeight || "400"}
                  onChange={e => updateStyle("fontWeight", e.target.value)}
                  style={{
                    width: "100%", padding: "6px 8px", background: t.ib,
                    border: `1px solid ${t.ibr}`, borderRadius: 4,
                    fontSize: 12, color: t.tx, outline: "none"
                  }}>
                  {["300", "400", "500", "600", "700"].map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>

              <ColorField label="글자색" propKey="color" />
              <ColorField label="배경색" propKey="background" />

              {/* Text align */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>텍스트 정렬</div>
                <div style={{ display: "flex", gap: 2 }}>
                  {[["left", "좌"], ["center", "중"], ["right", "우"]].map(([v, label]) => (
                    <div key={v} onClick={() => updateStyle("textAlign", v)}
                      style={{
                        flex: 1, padding: "6px 0", textAlign: "center", fontSize: 11,
                        cursor: "pointer", borderRadius: 4,
                        background: (sel.so.textAlign || "left") === v ? t.abg : "transparent",
                        border: `1px solid ${(sel.so.textAlign || "left") === v ? t.ac : t.ibr}`,
                        color: (sel.so.textAlign || "left") === v ? t.ac : t.t3,
                        fontWeight: (sel.so.textAlign || "left") === v ? 600 : 400
                      }}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Padding */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>패딩</div>
                <input value={sel.so.padding || "0"}
                  onChange={e => updateStyle("padding", e.target.value)}
                  placeholder="예: 10px 20px"
                  style={{
                    width: "100%", padding: "6px 8px", background: t.ib,
                    border: `1px solid ${t.ibr}`, borderRadius: 4,
                    fontSize: 12, color: t.tx, fontFamily: "monospace", outline: "none",
                    boxSizing: "border-box"
                  }} />
              </div>

              <Slider label="둥글기" value={(sel.so.borderRadius || "0").replace("px", "")}
                onChange={v => updateStyle("borderRadius", v)} min={0} max={60} />

              <Slider label="간격 (gap)" value={(sel.so.gap || "0").replace("px", "")}
                onChange={v => updateStyle("gap", v)} min={0} max={60} />

              <Slider label="행간" value={sel.so.lineHeight || "1.5"}
                onChange={v => updateStyle("lineHeight", v)} min={0.8} max={3} step={0.1} unit="" />

              <Slider label="자간" value={(sel.so.letterSpacing || "0").replace("px", "")}
                onChange={v => updateStyle("letterSpacing", v)} min={-2} max={10} step={0.1} />
            </div>
          )}
        </div>
      </div>

      {/* Element bar */}
      <div style={{
        padding: "8px 14px", display: "flex", gap: 4, overflowX: "auto",
        background: t.card, borderBottom: `1px solid ${t.cb}`
      }}>
        <span style={{ fontSize: 10, color: t.t3, flexShrink: 0, marginRight: 4, lineHeight: "24px" }}>요소:</span>
        {els.map((el, i) => (
          <span key={i} onClick={() => setSelIdx(i)}
            style={{
              fontSize: 10, padding: "4px 10px", cursor: "pointer", flexShrink: 0,
              borderRadius: 4, lineHeight: "16px",
              background: selIdx === i ? t.abg : "transparent",
              color: selIdx === i ? t.ac : t.t3,
              border: `1px solid ${selIdx === i ? t.ac : t.cb}`
            }}>
            &lt;{el.tag}&gt;{el.tc ? ` "${el.tc.slice(0, 8)}"` : ""}
          </span>
        ))}
      </div>

      {/* Code view (always visible at bottom) */}
      <div style={{ padding: "6px 12px", borderBottom: `1px solid ${t.cb}`, fontSize: 11, color: t.t3, background: t.card }}>
        생성된 코드
      </div>
      <div style={{ padding: 12, background: t.pv, maxHeight: 200, overflow: "auto" }}>
        <pre style={{
          margin: 0, fontFamily: "monospace", fontSize: 11, lineHeight: 1.7,
          color: t.t2, whiteSpace: "pre-wrap", wordBreak: "break-all"
        }}>
          {code}
        </pre>
      </div>
    </div>
  );
}
