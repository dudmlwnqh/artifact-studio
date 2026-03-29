import { useState, useMemo } from "react";
import { PRESETS, COLOR_GROUPS, COLOR_LABELS, TOKEN_TABS } from "../data/tokenPresets.js";
import { generateTokenFiles, generateCSSVariables } from "../utils/tokenFileGenerator.js";
import GitHubConnector from "./GitHubConnector.jsx";

function ColorSwatch({ color, label, onChange, size = 36 }) {
  const id = "cp-" + label + "-" + Math.random().toString(36).slice(2, 6);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div
          style={{
            width: size, height: size, borderRadius: 6, background: color,
            border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
          }}
          onClick={() => document.getElementById(id)?.click()}
        />
        <input
          id={id} type="color" value={color}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: "absolute", top: 0, left: 0, width: size, height: size, opacity: 0, cursor: "pointer" }}
        />
      </div>
      {label && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{label}</div>}
    </div>
  );
}

function TokenPreview({ tokens }) {
  const c = tokens;
  return (
    <div style={{ background: c.bg, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ background: c.bgCard, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${c.bgSub}` }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>MyApp</span>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 12, color: c.brand, fontWeight: 500 }}>홈</span>
          <span style={{ fontSize: 12, color: c.textSub }}>검색</span>
          <span style={{ fontSize: 12, color: c.textSub }}>설정</span>
        </div>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: c.bgCard, borderRadius: 10, padding: 14, border: `1px solid ${c.bgSub}` }}>
          <div style={{ height: 60, background: c.bgSub, borderRadius: 6, marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 4 }}>카드 제목</div>
          <div style={{ fontSize: 12, color: c.textSub }}>설명 텍스트입니다</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ flex: 1, padding: "10px 0", background: c.brand, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>확인</button>
          <button style={{ flex: 1, padding: "10px 0", background: c.bgCard, color: c.textSub, border: `1px solid ${c.bgSub}`, borderRadius: 8, fontSize: 13 }}>취소</button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: c.success + "22", color: c.success }}>성공</span>
          <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: c.warning + "22", color: c.warning }}>경고</span>
          <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: c.error + "22", color: c.error }}>위험</span>
          <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: c.info + "22", color: c.info }}>정보</span>
        </div>
        <div style={{ background: c.bgCard, border: `1px solid ${c.bgSub}`, borderRadius: 8, padding: "10px 12px" }}>
          <span style={{ fontSize: 12, color: c.textDim }}>이메일을 입력하세요</span>
        </div>
      </div>
      <div style={{ display: "flex", borderTop: `1px solid ${c.bgSub}`, padding: "8px 0" }}>
        {["홈", "검색", "내정보"].map((label, i) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: i === 0 ? c.brand : c.bgSub, margin: "0 auto 3px" }} />
            <div style={{ fontSize: 9, color: i === 0 ? c.brand : c.textDim }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const WEIGHT_OPTIONS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
const TYPO_LABELS = { heading: "제목", subheading: "부제목", body: "본문", caption: "캡션" };

export default function DesignTokenEditor({ t, tokenSet, onSave, onClose }) {
  const initial = tokenSet || { colors: PRESETS[0].colors, typography: PRESETS[0].typography, spacing: PRESETS[0].spacing, radius: PRESETS[0].radius, shadows: PRESETS[0].shadows };

  const [colors, setColors] = useState({ ...initial.colors });
  const [typography, setTypography] = useState(JSON.parse(JSON.stringify(initial.typography)));
  const [spacing, setSpacing] = useState({ ...initial.spacing });
  const [radius, setRadius] = useState({ ...initial.radius });
  const [shadows, setShadows] = useState({ ...initial.shadows });

  const [tokenTab, setTokenTab] = useState("color");
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [history, setHistory] = useState([{ ...initial.colors }]);
  const [histIdx, setHistIdx] = useState(0);
  const [copied, setCopied] = useState(null);
  const [showGitHub, setShowGitHub] = useState(false);

  const updateColor = (key, value) => {
    const next = { ...colors, [key]: value };
    setColors(next);
    const newHist = [...history.slice(0, histIdx + 1), next];
    setHistory(newHist);
    setHistIdx(newHist.length - 1);
  };

  const applyPreset = (preset) => {
    setColors({ ...preset.colors });
    setTypography(JSON.parse(JSON.stringify(preset.typography)));
    setSpacing({ ...preset.spacing });
    setRadius({ ...preset.radius });
    setShadows({ ...preset.shadows });
    setHistory([...history, { ...preset.colors }]);
    setHistIdx(history.length);
    setShowPresetModal(false);
  };

  const undo = () => { if (histIdx > 0) { setHistIdx(histIdx - 1); setColors(history[histIdx - 1]); } };
  const redo = () => { if (histIdx < history.length - 1) { setHistIdx(histIdx + 1); setColors(history[histIdx + 1]); } };

  const randomShuffle = () => {
    const keys = Object.keys(colors);
    const vals = Object.values(colors);
    COLOR_GROUPS.forEach((g) => {
      const indices = g.fields.map((f) => keys.indexOf(f)).filter((i) => i >= 0);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vals[indices[i]], vals[indices[j]]] = [vals[indices[j]], vals[indices[i]]];
      }
    });
    const next = {};
    keys.forEach((k, i) => (next[k] = vals[i]));
    setColors(next);
    setHistory([...history, next]);
    setHistIdx(history.length);
  };

  const updateTypo = (key, field, value) => {
    setTypography((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: field === "size" ? Number(value) || 0 : value },
    }));
  };

  const updateSpacing = (key, value) => {
    setSpacing((prev) => ({ ...prev, [key]: Number(value) || 0 }));
  };

  const updateRadius = (key, value) => {
    setRadius((prev) => ({ ...prev, [key]: Number(value) || 0 }));
  };

  const updateShadow = (key, value) => {
    setShadows((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!onSave) return;
    onSave({
      ...tokenSet,
      colors,
      typography,
      spacing,
      radius,
      shadows,
      updatedAt: Date.now(),
    });
  };

  const handleExportClipboard = async (type) => {
    const ts = { ...tokenSet, colors, typography, spacing, radius, shadows, name: tokenSet?.name || "토큰 세트" };
    let text;
    if (type === "css") {
      text = generateCSSVariables(ts);
    } else if (type === "json") {
      text = JSON.stringify({ colors, typography, spacing, radius, shadows }, null, 2);
    } else {
      const files = generateTokenFiles(ts);
      text = Object.entries(files).map(([name, f]) => `// === ${name} ===\n${f.code}`).join("\n\n");
    }
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 1500);
  };

  const copyValue = async (val) => {
    await navigator.clipboard.writeText(val);
    setCopied(val);
    setTimeout(() => setCopied(null), 1000);
  };

  const inputStyle = {
    width: 60, padding: "4px 6px", fontSize: 12, color: t.tx,
    background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 4, outline: "none", textAlign: "center",
  };

  return (
    <div style={{ padding: 0, height: "100%", display: "flex", flexDirection: "column" }}>
      {/* 상단 액션 바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${t.cb}`, flexShrink: 0 }}>
        {onClose && (
          <button onClick={onClose} style={{ padding: "6px 10px", fontSize: 12, background: "transparent", color: t.t3, border: `1px solid ${t.cb}`, borderRadius: 6, cursor: "pointer" }}>← 뒤로</button>
        )}
        <span style={{ fontSize: 14, fontWeight: 600, color: t.tx }}>{tokenSet?.name || "새 토큰 세트"}</span>
        <button onClick={() => setShowPresetModal(true)} style={{ padding: "6px 14px", fontSize: 12, background: t.ac, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>프리셋 변경</button>

        {/* 내보내기 드롭다운 */}
        <div style={{ position: "relative" }}>
          <button onClick={() => handleExportClipboard("files")} style={{ padding: "6px 14px", fontSize: 12, background: "transparent", color: t.t3, border: `1px solid ${t.cb}`, borderRadius: 6, cursor: "pointer" }}>
            {copied === "files" ? "복사됨!" : "JS 복사"}
          </button>
        </div>
        <button onClick={() => handleExportClipboard("css")} style={{ padding: "6px 14px", fontSize: 12, background: "transparent", color: t.t3, border: `1px solid ${t.cb}`, borderRadius: 6, cursor: "pointer" }}>
          {copied === "css" ? "복사됨!" : "CSS 변수"}
        </button>
        <button onClick={() => handleExportClipboard("json")} style={{ padding: "6px 14px", fontSize: 12, background: "transparent", color: t.t3, border: `1px solid ${t.cb}`, borderRadius: 6, cursor: "pointer" }}>
          {copied === "json" ? "복사됨!" : "JSON"}
        </button>

        <button onClick={() => setShowGitHub(true)} style={{ padding: "6px 14px", fontSize: 12, background: "transparent", color: t.t3, border: `1px solid ${t.cb}`, borderRadius: 6, cursor: "pointer" }}>GitHub</button>

        <div style={{ flex: 1 }} />
        <button onClick={randomShuffle} style={{ padding: "6px 12px", fontSize: 11, background: "transparent", color: t.am, border: `1px solid ${t.cb}`, borderRadius: 6, cursor: "pointer" }}>🎲 셔플</button>
        <button onClick={undo} disabled={histIdx <= 0} style={{ padding: "4px 8px", fontSize: 11, background: "transparent", color: histIdx <= 0 ? t.cb : t.t3, border: `1px solid ${t.cb}`, borderRadius: 4, cursor: "pointer" }}>↩</button>
        <button onClick={redo} disabled={histIdx >= history.length - 1} style={{ padding: "4px 8px", fontSize: 11, background: "transparent", color: histIdx >= history.length - 1 ? t.cb : t.t3, border: `1px solid ${t.cb}`, borderRadius: 4, cursor: "pointer" }}>↪</button>
        {onSave && (
          <button onClick={handleSave} style={{ padding: "6px 16px", fontSize: 12, background: t.gn, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>저장</button>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 좌측: 토큰 편집기 */}
        <div style={{ width: "50%", borderRight: `1px solid ${t.cb}`, overflow: "auto", padding: 16 }}>
          {/* 토큰 카테고리 탭 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
            {TOKEN_TABS.map((tab) => (
              <button key={tab.key} onClick={() => setTokenTab(tab.key)} style={{
                padding: "5px 12px", fontSize: 11, borderRadius: 16, cursor: "pointer",
                border: tokenTab === tab.key ? `1px solid ${t.ac}` : `1px solid ${t.cb}`,
                background: tokenTab === tab.key ? t.abg : "transparent",
                color: tokenTab === tab.key ? t.ac : t.t3, fontWeight: tokenTab === tab.key ? 600 : 400,
              }}>{tab.icon} {tab.label}</button>
            ))}
          </div>

          {/* ── 색상 탭 ── */}
          {tokenTab === "color" && (
            <div>
              {COLOR_GROUPS.map((group) => (
                <div key={group.key} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: t.t2, fontWeight: 500, marginBottom: 8 }}>{group.label}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {group.fields.map((field) => (
                      <div key={field} style={{ textAlign: "center" }}>
                        <ColorSwatch color={colors[field]} label={COLOR_LABELS[field]} onChange={(v) => updateColor(field, v)} />
                        <div
                          onClick={() => copyValue(colors[field])}
                          style={{ fontSize: 9, color: t.t3, fontFamily: "monospace", cursor: "pointer", marginTop: 2 }}
                          title="클릭하여 복사"
                        >
                          {copied === colors[field] ? "복사!" : colors[field]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: t.t2, fontWeight: 500, marginBottom: 8 }}>강조</div>
                <ColorSwatch color={colors.accent} label="강조색" onChange={(v) => updateColor("accent", v)} />
              </div>
            </div>
          )}

          {/* ── 글자 탭 ── */}
          {tokenTab === "typo" && (
            <div>
              {Object.entries(typography).map(([key, val]) => (
                <div key={key} style={{ marginBottom: 16, padding: "10px 14px", background: t.ib, borderRadius: 8, border: `1px solid ${t.ibr}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: t.tx, fontWeight: 500 }}>{TYPO_LABELS[key] || key}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 10, color: t.t3, width: 40 }}>크기</label>
                    <input type="number" value={val.size} onChange={(e) => updateTypo(key, "size", e.target.value)} style={inputStyle} />
                    <span style={{ fontSize: 10, color: t.t3 }}>px</span>
                    <label style={{ fontSize: 10, color: t.t3, width: 40, marginLeft: 8 }}>굵기</label>
                    <select value={val.weight} onChange={(e) => updateTypo(key, "weight", e.target.value)} style={{ ...inputStyle, width: 70 }}>
                      {WEIGHT_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 10, color: t.t3, width: 40 }}>행간</label>
                    <input type="number" step="0.1" value={val.lineHeight || 1.4} onChange={(e) => updateTypo(key, "lineHeight", parseFloat(e.target.value) || 1.4)} style={inputStyle} />
                    <label style={{ fontSize: 10, color: t.t3, width: 40, marginLeft: 8 }}>글꼴</label>
                    <input type="text" value={val.family || "system-ui"} onChange={(e) => updateTypo(key, "family", e.target.value)} style={{ ...inputStyle, width: 120, textAlign: "left" }} />
                  </div>
                  <div style={{ fontSize: val.size, fontWeight: val.weight, lineHeight: val.lineHeight || 1.4, fontFamily: val.family || "system-ui", color: colors.text }}>
                    다람쥐 헌 쳇바퀴에 타고파
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 간격 탭 ── */}
          {tokenTab === "spacing" && (
            <div>
              {Object.entries(spacing).map(([key, val]) => (
                <div key={key} style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 30, fontSize: 11, color: t.t3, fontFamily: "monospace" }}>{key}</span>
                  <input type="number" value={val} onChange={(e) => updateSpacing(key, e.target.value)} style={inputStyle} />
                  <span style={{ fontSize: 10, color: t.t3 }}>px</span>
                  <div style={{ width: val * 3, height: 16, background: t.ac + "44", borderRadius: 3, transition: "width 0.2s" }} />
                </div>
              ))}
            </div>
          )}

          {/* ── 둥글기 탭 ── */}
          {tokenTab === "radius" && (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {Object.entries(radius).map(([key, val]) => (
                <div key={key} style={{ textAlign: "center" }}>
                  <div style={{ width: 50, height: 50, background: t.ac + "33", border: `2px solid ${t.ac}`, borderRadius: val }} />
                  <div style={{ fontSize: 10, color: t.t3, marginTop: 4, fontFamily: "monospace" }}>{key}</div>
                  <input type="number" value={val} onChange={(e) => updateRadius(key, e.target.value)} style={{ ...inputStyle, width: 50, marginTop: 4 }} />
                </div>
              ))}
            </div>
          )}

          {/* ── 그림자 탭 ── */}
          {tokenTab === "shadow" && (
            <div>
              {Object.entries(shadows).map(([key, val]) => (
                <div key={key} style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 70, height: 50, background: t.card, borderRadius: 8, boxShadow: val, border: `1px solid ${t.cb}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>{key}</div>
                    <input
                      type="text" value={val}
                      onChange={(e) => updateShadow(key, e.target.value)}
                      style={{ ...inputStyle, width: "100%", textAlign: "left" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우측: 라이브 프리뷰 */}
        <div style={{ flex: 1, overflow: "auto", padding: 16, background: colors.bg === "#FFFFFF" || colors.bg === "#FAFAF5" || colors.bg === "#FAFAF5" ? "#f5f5f5" : "#0a0a10" }}>
          <div style={{ maxWidth: 320, margin: "0 auto" }}>
            <TokenPreview tokens={colors} />
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            {["버튼", "카드", "입력칸", "배지"].map((label) => (
              <span key={label} style={{
                padding: "4px 12px", borderRadius: 16, fontSize: 10,
                background: colors.bgCard, color: colors.textSub,
                border: `1px solid ${colors.bgSub}`, cursor: "pointer",
              }}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 프리셋 모달 */}
      {showPresetModal && (
        <div onClick={() => setShowPresetModal(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 500, maxHeight: "80vh", overflow: "auto",
            background: t.card, borderRadius: 14, padding: 24, border: `1px solid ${t.cb}`,
          }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 17, color: t.tx }}>프리셋 라이브러리</h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: t.t3 }}>검증된 디자인 시스템을 한번에 로드. 적용 후 개별 수정 가능.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {PRESETS.map((p) => (
                <div key={p.id} style={{
                  borderRadius: 10, overflow: "hidden", cursor: "pointer",
                  border: `1px solid ${t.cb}`, background: t.bg,
                }} onClick={() => applyPreset(p)}>
                  <div style={{ height: 50, background: p.header, padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{p.desc}</div>
                  </div>
                  <div style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                      {[p.colors.brand, p.colors.bgCard || p.colors.bg, p.colors.text, p.colors.success, p.colors.error].map((c, i) => (
                        <div key={i} style={{ width: 18, height: 18, borderRadius: 4, background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 9, color: t.t3 }}>{p.style}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowPresetModal(false)} style={{
              width: "100%", marginTop: 14, padding: 8,
              border: `1px solid ${t.cb}`, background: "transparent",
              color: t.t3, borderRadius: 6, fontSize: 12, cursor: "pointer",
            }}>닫기</button>
          </div>
        </div>
      )}

      {/* GitHub 동기화 모달 */}
      {showGitHub && (
        <GitHubConnector
          t={t}
          tokenSet={{ ...tokenSet, colors, typography, spacing, radius, shadows }}
          onClose={() => setShowGitHub(false)}
          onSyncComplete={(updates) => {
            if (updates.colors) setColors(updates.colors);
            if (updates.github && onSave) {
              onSave({ ...tokenSet, colors: updates.colors || colors, typography, spacing, radius, shadows, github: updates.github, updatedAt: Date.now() });
            }
            setShowGitHub(false);
          }}
        />
      )}
    </div>
  );
}
