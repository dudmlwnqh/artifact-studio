import { useState, useMemo } from "react";

// ── 프리셋 라이브러리 ──
const PRESETS = [
  { id:"toss", name:"토스 스타일", desc:"다크 + 블루 포인트", style:"미니멀, 핀테크",
    header:"#1B1D2E", colors:{ brand:"#3182F6", brandSub:"#1B64DA", bg:"#0D0F1C", bgCard:"#1B1D2E", bgSub:"#252836",
    text:"#F2F4F6", textSub:"#8B95A1", textDim:"#4E5968",
    success:"#00C853", warning:"#FF9100", error:"#F44336", info:"#3182F6",
    accent:"#3182F6" }},
  { id:"karrot", name:"당근 스타일", desc:"오렌지 + 따뜻한 톤", style:"커뮤니티, 마켓",
    header:"#FF6F00", colors:{ brand:"#FF6F00", brandSub:"#E65100", bg:"#FFFFFF", bgCard:"#FFF8F0", bgSub:"#FFF3E0",
    text:"#212121", textSub:"#757575", textDim:"#BDBDBD",
    success:"#4CAF50", warning:"#FF9800", error:"#F44336", info:"#2196F3",
    accent:"#FF6F00" }},
  { id:"notion", name:"노션 스타일", desc:"흑백 + 미니멀", style:"생산성, 문서",
    header:"#191919", colors:{ brand:"#000000", brandSub:"#37352F", bg:"#FFFFFF", bgCard:"#F7F6F3", bgSub:"#EBECED",
    text:"#37352F", textSub:"#787774", textDim:"#C3C2BF",
    success:"#448361", warning:"#C29243", error:"#EB5757", info:"#529CCA",
    accent:"#2EAADC" }},
  { id:"insta", name:"인스타 스타일", desc:"그라데이션 퍼플+핑크", style:"SNS, 크리에이터",
    header:"#833AB4", colors:{ brand:"#833AB4", brandSub:"#C13584", bg:"#000000", bgCard:"#1A1A2E", bgSub:"#16213E",
    text:"#FAFAFA", textSub:"#A8A8A8", textDim:"#555555",
    success:"#4ADE80", warning:"#FBBF24", error:"#EF4444", info:"#833AB4",
    accent:"#E1306C" }},
  { id:"nature", name:"네이처 / 웰니스", desc:"그린 + 어스톤", style:"건강, 라이프스타일",
    header:"#0D9488", colors:{ brand:"#0D9488", brandSub:"#059669", bg:"#FAFAF5", bgCard:"#F0FDF4", bgSub:"#ECFDF5",
    text:"#1A2E1A", textSub:"#6B7A6B", textDim:"#A3B8A3",
    success:"#22C55E", warning:"#EAB308", error:"#DC2626", info:"#0EA5E9",
    accent:"#0D9488" }},
  { id:"cyber", name:"사이버핑크", desc:"네온 + 다크", style:"게임, 테크",
    header:"#0A0A14", colors:{ brand:"#E040FB", brandSub:"#7C4DFF", bg:"#0A0A14", bgCard:"#151528", bgSub:"#1A1A35",
    text:"#E8E8F0", textSub:"#9090B0", textDim:"#505070",
    success:"#00E676", warning:"#FFD600", error:"#FF1744", info:"#00E5FF",
    accent:"#E040FB" }},
];

const TOKEN_TABS = [
  { key:"color", label:"색상", icon:"🎨" },
  { key:"typo", label:"글자", icon:"Aa" },
  { key:"spacing", label:"간격", icon:"↔" },
  { key:"radius", label:"둥글기", icon:"◰" },
  { key:"shadow", label:"그림자", icon:"▪" },
];

const TYPO_PRESETS = { heading:{ size:20, weight:"700" }, subheading:{ size:16, weight:"600" }, body:{ size:14, weight:"400" }, caption:{ size:11, weight:"400" } };
const SPACING_PRESETS = { xs:4, sm:8, md:16, lg:24, xl:32 };
const RADIUS_PRESETS = { sm:4, md:8, lg:12, xl:16, full:999 };
const SHADOW_PRESETS = { none:"none", sm:"0 1px 3px rgba(0,0,0,0.12)", md:"0 4px 12px rgba(0,0,0,0.15)", lg:"0 8px 24px rgba(0,0,0,0.2)" };

// ── 색상 그룹 정의 ──
const COLOR_GROUPS = [
  { key:"brand", label:"브랜드", fields:["brand","brandSub"] },
  { key:"status", label:"상태", fields:["success","warning","error","info"] },
  { key:"bg", label:"배경", fields:["bg","bgCard","bgSub"] },
  { key:"text", label:"텍스트", fields:["text","textSub","textDim"] },
];

const COLOR_LABELS = {
  brand:"메인", brandSub:"보조", bg:"기본 배경", bgCard:"카드 배경", bgSub:"보조 배경",
  text:"기본 텍스트", textSub:"보조 텍스트", textDim:"흐린 텍스트",
  success:"성공", warning:"경고", error:"위험", info:"정보", accent:"강조"
};

function ColorSwatch({ color, label, onChange, size = 36 }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div style={{ width: size, height: size, borderRadius: 6, background: color, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
          onClick={() => document.getElementById("cp-" + label)?.click()} />
        <input id={"cp-" + label} type="color" value={color}
          onChange={e => onChange(e.target.value)}
          style={{ position: "absolute", top: 0, left: 0, width: size, height: size, opacity: 0, cursor: "pointer" }} />
      </div>
      {label && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{label}</div>}
    </div>
  );
}

// ── 미리보기 컴포넌트 ──
function TokenPreview({ tokens, mode }) {
  const c = tokens;
  return (
    <div style={{ background: c.bg, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "system-ui,sans-serif" }}>
      {/* 상단바 */}
      <div style={{ background: c.bgCard, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${c.bgSub}` }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>MyApp</span>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 12, color: c.brand, fontWeight: 500 }}>홈</span>
          <span style={{ fontSize: 12, color: c.textSub }}>검색</span>
          <span style={{ fontSize: 12, color: c.textSub }}>설정</span>
        </div>
      </div>
      {/* 카드들 */}
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
        {/* 상태 뱃지 */}
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: c.success + "22", color: c.success }}>성공</span>
          <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: c.warning + "22", color: c.warning }}>경고</span>
          <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: c.error + "22", color: c.error }}>위험</span>
          <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: c.info + "22", color: c.info }}>정보</span>
        </div>
        {/* 입력 */}
        <div style={{ background: c.bgCard, border: `1px solid ${c.bgSub}`, borderRadius: 8, padding: "10px 12px" }}>
          <span style={{ fontSize: 12, color: c.textDim }}>이메일을 입력하세요</span>
        </div>
      </div>
      {/* 하단 탭 */}
      <div style={{ display: "flex", borderTop: `1px solid ${c.bgSub}`, padding: "8px 0" }}>
        {["홈","검색","내정보"].map((t,i) => (
          <div key={t} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: i === 0 ? c.brand : c.bgSub, margin: "0 auto 3px" }} />
            <div style={{ fontSize: 9, color: i === 0 ? c.brand : c.textDim }}>{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 메인 ──
export default function DesignTokenEditor({ t, onTokensChange }) {
  const [tokens, setTokens] = useState(PRESETS[0].colors);
  const [tokenTab, setTokenTab] = useState("color");
  const [mode, setMode] = useState("dark"); // dark | light
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [history, setHistory] = useState([PRESETS[0].colors]);
  const [histIdx, setHistIdx] = useState(0);

  const updateToken = (key, value) => {
    const next = { ...tokens, [key]: value };
    setTokens(next);
    const newHist = [...history.slice(0, histIdx + 1), next];
    setHistory(newHist);
    setHistIdx(newHist.length - 1);
    if (onTokensChange) onTokensChange(next);
  };

  const applyPreset = (preset) => {
    setTokens(preset.colors);
    setHistory([...history, preset.colors]);
    setHistIdx(history.length);
    setShowPresetModal(false);
    if (onTokensChange) onTokensChange(preset.colors);
  };

  const undo = () => { if (histIdx > 0) { setHistIdx(histIdx - 1); setTokens(history[histIdx - 1]); } };
  const redo = () => { if (histIdx < history.length - 1) { setHistIdx(histIdx + 1); setTokens(history[histIdx + 1]); } };

  const randomShuffle = () => {
    const keys = Object.keys(tokens);
    const vals = Object.values(tokens);
    // 같은 그룹 내에서만 셔플
    COLOR_GROUPS.forEach(g => {
      const indices = g.fields.map(f => keys.indexOf(f)).filter(i => i >= 0);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vals[indices[i]], vals[indices[j]]] = [vals[indices[j]], vals[indices[i]]];
      }
    });
    const next = {};
    keys.forEach((k, i) => next[k] = vals[i]);
    setTokens(next);
    setHistory([...history, next]);
    setHistIdx(history.length);
  };

  return (
    <div style={{ padding: 0, height: "100%" }}>
      {/* 상단 액션 바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${t.cb}` }}>
        <button onClick={() => setShowPresetModal(true)} style={{ padding: "6px 14px", fontSize: 12, background: t.ac, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>프리셋 변경</button>
        <button style={{ padding: "6px 14px", fontSize: 12, background: "transparent", color: t.t3, border: `1px solid ${t.cb}`, borderRadius: 6, cursor: "pointer" }}>이미지 추출</button>
        <button style={{ padding: "6px 14px", fontSize: 12, background: "transparent", color: t.t3, border: `1px solid ${t.cb}`, borderRadius: 6, cursor: "pointer" }}>내보내기</button>
        <div style={{ flex: 1 }} />
        <button onClick={randomShuffle} style={{ padding: "6px 12px", fontSize: 11, background: "transparent", color: t.am, border: `1px solid ${t.cb}`, borderRadius: 6, cursor: "pointer" }}>🎲 랜덤 셔플</button>
        <button onClick={undo} disabled={histIdx <= 0} style={{ padding: "4px 8px", fontSize: 11, background: "transparent", color: histIdx <= 0 ? t.cb : t.t3, border: `1px solid ${t.cb}`, borderRadius: 4, cursor: "pointer" }}>↩</button>
        <button onClick={redo} disabled={histIdx >= history.length - 1} style={{ padding: "4px 8px", fontSize: 11, background: "transparent", color: histIdx >= history.length - 1 ? t.cb : t.t3, border: `1px solid ${t.cb}`, borderRadius: 4, cursor: "pointer" }}>↪</button>
      </div>

      <div style={{ display: "flex", height: "calc(100% - 48px)" }}>
        {/* 좌측: 토큰 편집기 */}
        <div style={{ width: "50%", borderRight: `1px solid ${t.cb}`, overflow: "auto", padding: 16 }}>
          {/* 토큰 카테고리 탭 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
            {TOKEN_TABS.map(tab => (
              <button key={tab.key} onClick={() => setTokenTab(tab.key)} style={{
                padding: "5px 12px", fontSize: 11, borderRadius: 16, cursor: "pointer",
                border: tokenTab === tab.key ? `1px solid ${t.ac}` : `1px solid ${t.cb}`,
                background: tokenTab === tab.key ? t.abg : "transparent",
                color: tokenTab === tab.key ? t.ac : t.t3, fontWeight: tokenTab === tab.key ? 600 : 400
              }}>{tab.icon} {tab.label}</button>
            ))}
          </div>

          {/* 라이트/다크 토글 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, border: `1px solid ${t.cb}`, borderRadius: 6, overflow: "hidden", width: "fit-content" }}>
            {["light","dark"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "4px 14px", fontSize: 11, border: "none", cursor: "pointer",
                background: mode === m ? t.abg : "transparent",
                color: mode === m ? t.ac : t.t3
              }}>{m === "light" ? "라이트" : "다크"}</button>
            ))}
          </div>

          {/* ── 색상 탭 ── */}
          {tokenTab === "color" && (
            <div>
              {COLOR_GROUPS.map(group => (
                <div key={group.key} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: t.t2, fontWeight: 500, marginBottom: 8 }}>{group.label}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {group.fields.map(field => (
                      <ColorSwatch key={field} color={tokens[field]} label={COLOR_LABELS[field]}
                        onChange={v => updateToken(field, v)} />
                    ))}
                  </div>
                </div>
              ))}
              {/* 강조색 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: t.t2, fontWeight: 500, marginBottom: 8 }}>강조</div>
                <ColorSwatch color={tokens.accent} label="강조색" onChange={v => updateToken("accent", v)} />
              </div>
              {/* 선택한 색상 상세 */}
              <div style={{ padding: "10px 14px", background: t.ib, borderRadius: 8, border: `1px solid ${t.ibr}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: tokens.brand, border: "1px solid rgba(255,255,255,0.1)" }} />
                <div>
                  <div style={{ fontSize: 12, color: t.tx }}>브랜드 메인</div>
                  <div style={{ fontSize: 11, color: t.t3, fontFamily: "monospace" }}>{tokens.brand}</div>
                </div>
                <button onClick={() => navigator.clipboard.writeText(tokens.brand)} style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 10, border: `1px solid ${t.cb}`, background: "transparent", color: t.t3, borderRadius: 4, cursor: "pointer" }}>복사</button>
              </div>
            </div>
          )}

          {/* ── 글자 탭 ── */}
          {tokenTab === "typo" && (
            <div>
              {Object.entries(TYPO_PRESETS).map(([key, val]) => (
                <div key={key} style={{ marginBottom: 16, padding: "10px 14px", background: t.ib, borderRadius: 8, border: `1px solid ${t.ibr}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: t.tx, fontWeight: 500 }}>{{ heading:"제목", subheading:"부제목", body:"본문", caption:"캡션" }[key]}</span>
                    <span style={{ fontSize: 10, color: t.t3, fontFamily: "monospace" }}>{val.size}px / {val.weight}</span>
                  </div>
                  <div style={{ fontSize: val.size, fontWeight: val.weight, color: tokens.text }}>
                    다람쥐 헌 쳇바퀴에 타고파
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 간격 탭 ── */}
          {tokenTab === "spacing" && (
            <div>
              {Object.entries(SPACING_PRESETS).map(([key, val]) => (
                <div key={key} style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 30, fontSize: 11, color: t.t3, fontFamily: "monospace" }}>{key}</span>
                  <div style={{ width: val * 3, height: 16, background: t.ac + "44", borderRadius: 3 }} />
                  <span style={{ fontSize: 11, color: t.t2, fontFamily: "monospace" }}>{val}px</span>
                </div>
              ))}
            </div>
          )}

          {/* ── 둥글기 탭 ── */}
          {tokenTab === "radius" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {Object.entries(RADIUS_PRESETS).map(([key, val]) => (
                <div key={key} style={{ textAlign: "center" }}>
                  <div style={{ width: 50, height: 50, background: t.ac + "33", border: `2px solid ${t.ac}`, borderRadius: val }} />
                  <div style={{ fontSize: 10, color: t.t3, marginTop: 4, fontFamily: "monospace" }}>{key} ({val}px)</div>
                </div>
              ))}
            </div>
          )}

          {/* ── 그림자 탭 ── */}
          {tokenTab === "shadow" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {Object.entries(SHADOW_PRESETS).map(([key, val]) => (
                <div key={key} style={{ textAlign: "center" }}>
                  <div style={{ width: 70, height: 50, background: t.card, borderRadius: 8, boxShadow: val, border: `1px solid ${t.cb}` }} />
                  <div style={{ fontSize: 10, color: t.t3, marginTop: 4 }}>{key}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우측: 라이브 프리뷰 */}
        <div style={{ flex: 1, overflow: "auto", padding: 16, background: tokens.bg === "#FFFFFF" || tokens.bg === "#FAFAF5" ? "#f5f5f5" : "#0a0a10" }}>
          <div style={{ maxWidth: 320, margin: "0 auto" }}>
            <TokenPreview tokens={tokens} mode={mode} />
          </div>
          {/* 부품 미리보기 */}
          <div style={{ marginTop: 16, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            {["버튼","카드","입력칸","배지"].map(label => (
              <span key={label} style={{
                padding: "4px 12px", borderRadius: 16, fontSize: 10,
                background: tokens.bgCard, color: tokens.textSub,
                border: `1px solid ${tokens.bgSub}`, cursor: "pointer"
              }}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 프리셋 모달 */}
      {showPresetModal && (
        <div onClick={() => setShowPresetModal(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 500, maxHeight: "80vh", overflow: "auto",
            background: t.card, borderRadius: 14, padding: 24, border: `1px solid ${t.cb}`
          }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 17, color: t.tx }}>프리셋 라이브러리</h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: t.t3 }}>검증된 디자인 시스템을 한번에 로드. 적용 후 개별 수정 가능.</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {PRESETS.map(p => (
                <div key={p.id} style={{
                  borderRadius: 10, overflow: "hidden", cursor: "pointer",
                  border: `1px solid ${t.cb}`, background: t.bg
                }} onClick={() => applyPreset(p)}>
                  <div style={{ height: 50, background: p.header, padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{p.desc}</div>
                  </div>
                  <div style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                      {[p.colors.brand, p.colors.bgCard || p.colors.bg, p.colors.text, p.colors.success, p.colors.error].map((c,i) => (
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
              color: t.t3, borderRadius: 6, fontSize: 12, cursor: "pointer"
            }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
