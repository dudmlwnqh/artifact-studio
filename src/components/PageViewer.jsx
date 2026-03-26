import { useState, useRef } from "react";

export default function PageViewer({ project, onUpdateProject, t, onEditPage }) {
  const [leftMode, setLeftMode] = useState("page");
  const [pageIdx, setPageIdx] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [stripVisible, setStripVisible] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  const pages = project.pages || [];
  const elements = project.elements || [];
  const current = pages[pageIdx] || null;
  const mockups = pages.filter(p => p.type === "시안");
  const storyboards = pages.filter(p => p.type === "스토리보드");

  const addPage = (type) => {
    if (!newCode.trim() && !newName.trim()) return;
    const pg = {
      id: "pg" + Date.now(),
      name: newName.trim() || `v${pages.length + 1}`,
      type,
      code: newCode.trim() || '<div style="padding:20px;color:#fff;text-align:center">새 시안</div>',
    };
    const newPages = [...pages, pg];
    onUpdateProject({ ...project, pages: newPages, code: newPages[0]?.code || project.code });
    setShowAddModal(false);
    setNewCode("");
    setNewName("");
    setPageIdx(newPages.length - 1);
  };

  const go = (dir) => setPageIdx(i => Math.max(0, Math.min(pages.length - 1, i + dir)));

  // Thumbnail card
  const Thumb = ({ pg, idx }) => (
    <div onClick={(e) => { e.stopPropagation(); setPageIdx(idx); }}
      style={{
        width: 64, height: 64, flexShrink: 0, cursor: "pointer",
        borderRadius: 6, overflow: "hidden",
        border: pageIdx === idx ? `2px solid ${t.ac}` : `1px solid rgba(255,255,255,0.1)`,
        background: "#0a0a14", position: "relative"
      }}>
      <div style={{
        transform: "scale(0.18)", transformOrigin: "top left",
        width: 355, height: 355, pointerEvents: "none"
      }} dangerouslySetInnerHTML={{ __html: pg.code }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: t.pv }}>
      {/* Mode toggle */}
      <div style={{
        display: "flex", padding: "4px 8px", borderBottom: `1px solid ${t.cb}`,
        background: t.card, flexShrink: 0, gap: 2
      }}>
        {[["page", "📖 페이지"], ["element", "🧩 영역 요소"]].map(([k, label]) => (
          <button key={k} onClick={() => setLeftMode(k)} style={{
            flex: 1, padding: "4px 0", fontSize: 11, border: "none", cursor: "pointer",
            borderRadius: 4, fontWeight: leftMode === k ? 600 : 400,
            background: leftMode === k ? t.abg : "transparent",
            color: leftMode === k ? t.ac : t.t3,
          }}>{label}</button>
        ))}
      </div>

      {/* ===== PAGE MODE ===== */}
      {leftMode === "page" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

          {/* EMPTY STATE */}
          {pages.length === 0 ? (
            <div onClick={() => setShowAddModal(true)} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 12
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 16,
                border: `2px dashed ${t.cb}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, color: t.t3
              }}>+</div>
              <div style={{ color: t.t3, fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>
                이 아리아의 UI 캡쳐/시안을<br/>여기에 업로드하세요
              </div>
              <div style={{ color: t.cb, fontSize: 11, textAlign: "center" }}>
                클로드와 대화하며 만든 시안, 레퍼런스 이미지 등
              </div>
            </div>
          ) : (
            <>
              {/* MAIN VIEWER - full bleed, no labels */}
              <div onClick={() => setStripVisible(v => !v)} style={{
                flex: 1, overflow: "auto", display: "flex",
                alignItems: "center", justifyContent: "center",
                padding: 0, cursor: "default", position: "relative"
              }}>
                {/* Rendered artifact - centered, natural size */}
                <div
                  onDoubleClick={(e) => { e.stopPropagation(); if (onEditPage && current) onEditPage(current); }}
                  dangerouslySetInnerHTML={{ __html: current?.code || "" }}
                  style={{
                    maxWidth: "90%", minWidth: 280,
                    userSelect: "none", WebkitUserSelect: "none",
                    borderRadius: 8,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
                  }}
                />

                {/* ◀ ▶ arrows - only on hover area */}
                {pages.length > 1 && pageIdx > 0 && (
                  <div onClick={(e) => { e.stopPropagation(); go(-1); }} style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: 40,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", opacity: 0.4, fontSize: 20, color: "#fff",
                    background: "linear-gradient(to right, rgba(0,0,0,0.3), transparent)"
                  }}>◀</div>
                )}
                {pages.length > 1 && pageIdx < pages.length - 1 && (
                  <div onClick={(e) => { e.stopPropagation(); go(1); }} style={{
                    position: "absolute", right: 0, top: 0, bottom: 0, width: 40,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", opacity: 0.4, fontSize: 20, color: "#fff",
                    background: "linear-gradient(to left, rgba(0,0,0,0.3), transparent)"
                  }}>▶</div>
                )}

                {/* Page indicator dots */}
                {pages.length > 1 && (
                  <div style={{
                    position: "absolute", bottom: stripVisible ? 90 : 8, left: "50%",
                    transform: "translateX(-50%)", display: "flex", gap: 5, zIndex: 3,
                    transition: "bottom 0.2s"
                  }}>
                    {pages.map((_, i) => (
                      <div key={i} onClick={(e) => { e.stopPropagation(); setPageIdx(i); }} style={{
                        width: 6, height: 6, borderRadius: 3, cursor: "pointer",
                        background: i === pageIdx ? t.ac : "rgba(255,255,255,0.3)"
                      }} />
                    ))}
                  </div>
                )}
              </div>

              {/* THUMBNAIL STRIP - slides up from bottom */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
                borderTop: `1px solid rgba(255,255,255,0.08)`,
                padding: "8px 10px",
                transform: stripVisible ? "translateY(0)" : "translateY(100%)",
                transition: "transform 0.25s ease",
                display: "flex", gap: 6, overflowX: "auto",
                alignItems: "center", zIndex: 5
              }}>
                {/* 시안 group */}
                {mockups.length > 0 && (
                  <>
                    <span style={{ writingMode: "vertical-lr", fontSize: 8, color: "rgba(255,255,255,0.35)", flexShrink: 0, padding: "2px 0" }}>시안</span>
                    {mockups.map(pg => <Thumb key={pg.id} pg={pg} idx={pages.indexOf(pg)} />)}
                  </>
                )}

                {/* Divider */}
                {mockups.length > 0 && storyboards.length > 0 && (
                  <div style={{ width: 1, height: 50, background: "rgba(255,255,255,0.1)", flexShrink: 0, margin: "0 2px" }} />
                )}

                {/* 스토리보드 group */}
                {storyboards.length > 0 && (
                  <>
                    <span style={{ writingMode: "vertical-lr", fontSize: 8, color: "rgba(255,255,255,0.35)", flexShrink: 0, padding: "2px 0" }}>스토리보드</span>
                    {storyboards.map(pg => <Thumb key={pg.id} pg={pg} idx={pages.indexOf(pg)} />)}
                  </>
                )}

                {/* + */}
                <div onClick={(e) => { e.stopPropagation(); setShowAddModal(true); }} style={{
                  width: 64, height: 64, flexShrink: 0, cursor: "pointer",
                  borderRadius: 6, border: `1px dashed rgba(255,255,255,0.15)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.3)", fontSize: 22
                }}>+</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== ELEMENT MODE ===== */}
      {leftMode === "element" && (
        <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
          {/* Page filter chips */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
            {pages.filter(p => p.type === "시안").map((pg, i) => (
              <button key={pg.id} onClick={() => setPageIdx(i)} style={{
                padding: "3px 10px", fontSize: 10, borderRadius: 12, cursor: "pointer",
                border: `1px solid ${pageIdx === i ? t.ac : t.cb}`,
                background: pageIdx === i ? t.abg : "transparent",
                color: pageIdx === i ? t.ac : t.t3,
                fontWeight: pageIdx === i ? 600 : 400
              }}>{pg.name}</button>
            ))}
          </div>

          {elements.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", fontSize: 11, color: t.t3 }}>
              등록된 영역 요소 없음
            </div>
          ) : (
            elements.map(el => (
              <div key={el.id} onClick={() => setSelectedElementId(el.id === selectedElementId ? null : el.id)}
                style={{
                  padding: "8px 10px", marginBottom: 4, borderRadius: 6, cursor: "pointer",
                  background: selectedElementId === el.id ? t.abg : t.card,
                  border: `1px solid ${selectedElementId === el.id ? t.ac : t.cb}`
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{el.emoji || "📦"}</span>
                  <span style={{ fontSize: 12, color: t.tx, fontWeight: 500 }}>{el.name}</span>
                </div>
                {selectedElementId === el.id && el.code && (
                  <div style={{
                    marginTop: 6, padding: 8, background: t.pv, borderRadius: 4,
                    userSelect: "none"
                  }} dangerouslySetInnerHTML={{ __html: el.code }} />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ADD MODAL */}
      {showAddModal && (
        <div onClick={() => setShowAddModal(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 380, maxHeight: "80vh", overflow: "auto",
            background: t.card, borderRadius: 12, padding: 20,
            border: `1px solid ${t.cb}`
          }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, color: t.tx }}>시안 추가</h3>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>이름</div>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="v2 리스트형"
                style={{
                  width: "100%", padding: "8px 10px", background: t.ib,
                  border: `1px solid ${t.ibr}`, borderRadius: 6,
                  fontSize: 13, color: t.tx, outline: "none", boxSizing: "border-box"
                }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>HTML / JSX 코드</div>
              <textarea value={newCode} onChange={e => setNewCode(e.target.value)}
                rows={8} placeholder='<div style="padding:20px;color:#fff">새 시안</div>'
                style={{
                  width: "100%", padding: "8px 10px", background: t.ib,
                  border: `1px solid ${t.ibr}`, borderRadius: 6,
                  fontSize: 12, color: t.gn, fontFamily: "monospace",
                  outline: "none", resize: "vertical", boxSizing: "border-box"
                }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowAddModal(false)}
                style={{ flex: 1, padding: 8, border: `1px solid ${t.cb}`, background: "transparent", color: t.t3, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={() => addPage("시안")}
                style={{ flex: 1, padding: 8, border: "none", background: t.ac, color: "#fff", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                시안
              </button>
              <button onClick={() => addPage("스토리보드")}
                style={{ flex: 1, padding: 8, border: `1px solid ${t.am}`, background: "transparent", color: t.am, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                스토리보드
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
