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
  const [rightTab, setRightTab] = useState("style"); // "style" | "interaction"
  const [interactions, setInteractions] = useState(project.interactions || []);
  const [newTrigger, setNewTrigger] = useState("tap");
  const [newAction, setNewAction] = useState("toast");
  const [newActionMsg, setNewActionMsg] = useState("안녕하세요!");
  const [toast, setToast] = useState(null);
  const [bottomSheet, setBottomSheet] = useState(null);
  const [modal, setModal] = useState(null);
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
    onSave({ ...project, code, interactions });
    onBack();
  };

  // Fire interaction action
  const fireAction = (action, msg) => {
    if (action === "toast") {
      setToast(msg);
      setTimeout(() => setToast(null), 2500);
    } else if (action === "bottomSheet") {
      setBottomSheet(msg);
    } else if (action === "modal") {
      setModal(msg);
    }
  };

  // Add interaction
  const addInteraction = () => {
    if (selIdx === null) return;
    const newInt = {
      id: "i" + Date.now(),
      elIdx: selIdx,
      trigger: newTrigger,
      action: newAction,
      message: newActionMsg,
    };
    setInteractions(prev => [...prev, newInt]);
  };

  // Delete interaction
  const deleteInteraction = (id) => {
    setInteractions(prev => prev.filter(x => x.id !== id));
  };

  // Copy code
  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Long press tracking
  const longPressTimer = useRef(null);

  const handlePreviewMouseDown = (e) => {
    if (!previewRef.current) return;
    const idx = findElIdx(e.target);
    if (idx < 0) return;
    longPressTimer.current = setTimeout(() => {
      // Long press trigger
      interactions.filter(i => i.elIdx === idx && i.trigger === "longPress")
        .forEach(i => fireAction(i.action, i.message));
      longPressTimer.current = null;
    }, 600);
  };

  const handlePreviewMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const findElIdx = (target) => {
    if (!previewRef.current) return -1;
    let idx = 0, found = -1;
    const walk = (node) => {
      if (node.nodeType === 1) {
        if (node === target) found = idx;
        idx++;
        Array.from(node.children).forEach(walk);
      }
    };
    Array.from(previewRef.current.children).forEach(walk);
    return found;
  };

  // Click on preview to select element + fire tap interactions
  const handlePreviewClick = (e) => {
    const found = findElIdx(e.target);
    if (found >= 0 && found < els.length) {
      setSelIdx(found);
      // Fire tap interactions for this element
      interactions.filter(i => i.elIdx === found && i.trigger === "tap")
        .forEach(i => fireAction(i.action, i.message));
    }
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
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative"
          }}>
            <div ref={previewRef} onClick={handlePreviewClick}
              onMouseDown={handlePreviewMouseDown} onMouseUp={handlePreviewMouseUp}
              dangerouslySetInnerHTML={{ __html: code }}
              style={{ maxWidth: "100%", cursor: "crosshair" }} />

            {/* Toast overlay */}
            {toast && (
              <div style={{
                position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
                padding: "10px 20px", background: "#333", color: "#fff", borderRadius: 8,
                fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.3)", zIndex: 20,
                animation: "fadeIn 0.3s"
              }}>{toast}</div>
            )}

            {/* Bottom Sheet overlay */}
            {bottomSheet && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: t.card, borderTop: `1px solid ${t.cb}`,
                borderRadius: "12px 12px 0 0", padding: "16px 20px", zIndex: 20,
                boxShadow: "0 -4px 20px rgba(0,0,0,0.3)"
              }}>
                <div style={{ width: 40, height: 4, background: t.cb, borderRadius: 2, margin: "0 auto 12px" }} />
                <div style={{ fontSize: 14, marginBottom: 12 }}>{bottomSheet}</div>
                <button onClick={() => setBottomSheet(null)}
                  style={{ padding: "8px 16px", background: t.ac, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                  닫기
                </button>
              </div>
            )}

            {/* Modal overlay */}
            {modal && (
              <div onClick={() => setModal(null)} style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20
              }}>
                <div onClick={e => e.stopPropagation()} style={{
                  background: t.card, borderRadius: 12, padding: 24, minWidth: 200,
                  border: `1px solid ${t.cb}`, textAlign: "center"
                }}>
                  <div style={{ fontSize: 14, marginBottom: 16 }}>{modal}</div>
                  <button onClick={() => setModal(null)}
                    style={{ padding: "8px 20px", background: t.ac, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                    확인
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 260, flexShrink: 0, background: t.card }}>
          {/* Tab switcher */}
          <div style={{ display: "flex", borderBottom: `1px solid ${t.cb}` }}>
            {[["style", "속성 편집"], ["interaction", "인터랙션"]].map(([k, label]) => (
              <button key={k} onClick={() => setRightTab(k)}
                style={{
                  flex: 1, padding: "6px 0", fontSize: 11, border: "none", cursor: "pointer",
                  background: rightTab === k ? t.abg : "transparent",
                  color: rightTab === k ? t.ac : t.t3,
                  borderBottom: rightTab === k ? `2px solid ${t.ac}` : "2px solid transparent",
                  fontWeight: rightTab === k ? 600 : 400
                }}>{label}</button>
            ))}
          </div>

          {/* Style tab */}
          {rightTab === "style" && (
            !sel ? (
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

              {/* Padding - 7 sliders */}
              {(() => {
                const raw = sel.so.padding || "0";
                const parts = raw.replace(/px/g, "").trim().split(/\s+/).map(Number);
                let pt, pr, pb, pl;
                if (parts.length === 1) { pt = pr = pb = pl = parts[0] || 0; }
                else if (parts.length === 2) { pt = pb = parts[0] || 0; pr = pl = parts[1] || 0; }
                else if (parts.length === 3) { pt = parts[0] || 0; pr = pl = parts[1] || 0; pb = parts[2] || 0; }
                else { pt = parts[0] || 0; pr = parts[1] || 0; pb = parts[2] || 0; pl = parts[3] || 0; }
                const setPad = (top, right, bottom, left) =>
                  updateStyle("padding", `${top}px ${right}px ${bottom}px ${left}px`);
                return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: t.t3, marginBottom: 6 }}>패딩</div>
                    <Slider label="전체" value={Math.round((pt + pr + pb + pl) / 4)}
                      onChange={v => { const n = Number(v); setPad(n, n, n, n); }} min={0} max={100} />
                    <Slider label="상하" value={Math.round((pt + pb) / 2)}
                      onChange={v => { const n = Number(v); setPad(n, pr, n, pl); }} min={0} max={100} />
                    <Slider label="좌우" value={Math.round((pl + pr) / 2)}
                      onChange={v => { const n = Number(v); setPad(pt, n, pb, n); }} min={0} max={100} />
                    <Slider label="상" value={pt}
                      onChange={v => setPad(Number(v), pr, pb, pl)} min={0} max={100} />
                    <Slider label="하" value={pb}
                      onChange={v => setPad(pt, pr, Number(v), pl)} min={0} max={100} />
                    <Slider label="좌" value={pl}
                      onChange={v => setPad(pt, pr, pb, Number(v))} min={0} max={100} />
                    <Slider label="우" value={pr}
                      onChange={v => setPad(pt, Number(v), pb, pl)} min={0} max={100} />
                  </div>
                );
              })()}

              <Slider label="둥글기" value={(sel.so.borderRadius || "0").replace("px", "")}
                onChange={v => updateStyle("borderRadius", v)} min={0} max={60} />

              <Slider label="간격 (gap)" value={(sel.so.gap || "0").replace("px", "")}
                onChange={v => updateStyle("gap", v)} min={0} max={60} />

              <Slider label="행간" value={sel.so.lineHeight || "1.5"}
                onChange={v => updateStyle("lineHeight", v)} min={0.8} max={3} step={0.1} unit="" />

              <Slider label="자간" value={(sel.so.letterSpacing || "0").replace("px", "")}
                onChange={v => updateStyle("letterSpacing", v)} min={-2} max={10} step={0.1} />
            </div>
          ))}

          {/* Interaction tab */}
          {rightTab === "interaction" && (
            <div style={{ maxHeight: 500, overflow: "auto", padding: "10px 14px" }}>
              {/* Add new interaction */}
              {selIdx === null ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: t.t3 }}>
                  ← 미리보기에서 요소를 선택한 뒤<br />인터랙션을 추가하세요
                </div>
              ) : (
                <div style={{ marginBottom: 16, padding: 12, background: t.abg, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: t.ac, fontWeight: 600, marginBottom: 10 }}>
                    &lt;{els[selIdx]?.tag}&gt; 에 인터랙션 추가
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>트리거</div>
                    <select value={newTrigger} onChange={e => setNewTrigger(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 4, fontSize: 12, color: t.tx, outline: "none" }}>
                      <option value="tap">탭 (클릭)</option>
                      <option value="longPress">롱프레스</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>액션</div>
                    <select value={newAction} onChange={e => setNewAction(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 4, fontSize: 12, color: t.tx, outline: "none" }}>
                      <option value="toast">토스트</option>
                      <option value="bottomSheet">바텀시트</option>
                      <option value="modal">모달</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>메시지</div>
                    <input value={newActionMsg} onChange={e => setNewActionMsg(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 4, fontSize: 12, color: t.tx, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <button onClick={addInteraction}
                    style={{ width: "100%", padding: "8px", background: t.ac, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    + 인터랙션 추가
                  </button>
                </div>
              )}

              {/* Interaction list */}
              <div style={{ fontSize: 11, color: t.t3, marginBottom: 6 }}>
                등록된 인터랙션 ({interactions.length})
              </div>
              {interactions.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: t.t3 }}>
                  아직 인터랙션이 없습니다
                </div>
              ) : (
                interactions.map(intr => (
                  <div key={intr.id} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
                    marginBottom: 4, background: t.ib, borderRadius: 6, border: `1px solid ${t.ibr}`
                  }}>
                    <div style={{ flex: 1, fontSize: 11 }}>
                      <span style={{ color: t.ac, fontWeight: 500 }}>
                        {els[intr.elIdx]?.tag ? `<${els[intr.elIdx].tag}>` : `요소${intr.elIdx}`}
                      </span>
                      <span style={{ color: t.t3 }}> → </span>
                      <span style={{ color: t.am }}>
                        {intr.trigger === "tap" ? "탭" : "롱프레스"}
                      </span>
                      <span style={{ color: t.t3 }}> → </span>
                      <span style={{ color: t.gn }}>
                        {intr.action === "toast" ? "토스트" : intr.action === "bottomSheet" ? "바텀시트" : "모달"}
                      </span>
                      <div style={{ fontSize: 10, color: t.t3, marginTop: 2 }}>"{intr.message}"</div>
                    </div>
                    <span onClick={() => deleteInteraction(intr.id)}
                      style={{ cursor: "pointer", color: t.t3, fontSize: 14, padding: "0 4px" }}>×</span>
                  </div>
                ))
              )}
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
