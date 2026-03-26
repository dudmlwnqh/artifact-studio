import { useState, useCallback } from "react";

// 카메라 앨범 UX: 메인 뷰어 + 하단 썸네일 스트립
// 빈 상태: 코드/파일 추가 안내
// 페이지 보기 / 영역 요소 보기 모드

export default function PageViewer({ project, onUpdateProject, t, onEditPage }) {
  const [leftMode, setLeftMode] = useState("page"); // "page" | "element"
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [showStrip, setShowStrip] = useState(true);
  const [showAddCode, setShowAddCode] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  const pages = project.pages || [];
  const elements = project.elements || [];
  const currentPage = pages[selectedPageIdx] || null;

  // Add a new page/variant
  const addPage = (type = "시안") => {
    if (!newCode.trim() && !newName.trim()) return;
    const newPage = {
      id: "pg" + Date.now(),
      name: newName.trim() || `v${pages.length + 1}`,
      type,
      code: newCode.trim() || '<div style="padding:20px;color:#fff;text-align:center">새 시안</div>',
    };
    onUpdateProject({
      ...project,
      pages: [...pages, newPage],
      code: pages.length === 0 ? newPage.code : project.code,
    });
    setShowAddCode(false);
    setNewCode("");
    setNewName("");
    setSelectedPageIdx(pages.length); // select the new one
  };

  const deletePage = (idx) => {
    const newPages = pages.filter((_, i) => i !== idx);
    onUpdateProject({ ...project, pages: newPages });
    if (selectedPageIdx >= newPages.length) setSelectedPageIdx(Math.max(0, newPages.length - 1));
  };

  const goNext = () => setSelectedPageIdx(i => Math.min(pages.length - 1, i + 1));
  const goPrev = () => setSelectedPageIdx(i => Math.max(0, i - 1));

  // Group pages by type for thumbnail strip
  const mockups = pages.filter(p => p.type === "시안");
  const storyboards = pages.filter(p => p.type === "스토리보드");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: t.pv }}>
      {/* Mode toggle: 페이지 / 영역 요소 */}
      <div style={{
        display: "flex", gap: 0, padding: "6px 10px", borderBottom: `1px solid ${t.cb}`,
        background: t.card, flexShrink: 0
      }}>
        {[["page", "📖 페이지"], ["element", "🧩 영역 요소"]].map(([k, label]) => (
          <button key={k} onClick={() => setLeftMode(k)}
            style={{
              flex: 1, padding: "5px 0", fontSize: 11, border: "none", cursor: "pointer",
              borderRadius: 4, fontWeight: leftMode === k ? 600 : 400,
              background: leftMode === k ? t.abg : "transparent",
              color: leftMode === k ? t.ac : t.t3,
            }}>{label}</button>
        ))}
      </div>

      {/* PAGE MODE */}
      {leftMode === "page" && (
        <>
          {/* Main viewer */}
          <div style={{ flex: 1, position: "relative", overflow: "auto" }}
            onClick={() => setShowStrip(s => !s)}>

            {/* Empty state */}
            {!currentPage ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "100%", gap: 16, padding: 40
              }}>
                <div onClick={(e) => { e.stopPropagation(); setShowAddCode(true); }}
                  style={{
                    width: 80, height: 80, borderRadius: 16,
                    border: `2px dashed ${t.cb}`, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 28, color: t.t3, cursor: "pointer"
                  }}>+</div>
                <div style={{ textAlign: "center", color: t.t3, fontSize: 13 }}>
                  이 아리아의 UI 캡쳐/시안을<br />여기에 업로드하세요
                </div>
                <div style={{ textAlign: "center", color: t.cb, fontSize: 11 }}>
                  클로드와 대화하며 만든 시안, 레퍼런스 이미지 등
                </div>
              </div>
            ) : (
              /* Render current page */
              <div style={{
                padding: 16, display: "flex", flexDirection: "column",
                alignItems: "center", minHeight: 300
              }}>
                {/* ◀ ▶ navigation */}
                {pages.length > 1 && (
                  <>
                    <div onClick={(e) => { e.stopPropagation(); goPrev(); }}
                      style={{
                        position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                        width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 18, cursor: "pointer", zIndex: 5,
                        opacity: selectedPageIdx === 0 ? 0.3 : 1
                      }}>◀</div>
                    <div onClick={(e) => { e.stopPropagation(); goNext(); }}
                      style={{
                        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                        width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 18, cursor: "pointer", zIndex: 5,
                        opacity: selectedPageIdx === pages.length - 1 ? 0.3 : 1
                      }}>▶</div>
                  </>
                )}

                {/* Page name */}
                <div style={{ fontSize: 13, fontWeight: 600, color: t.tx, marginBottom: 4 }}>
                  {currentPage.name}
                </div>
                <div style={{ fontSize: 10, color: t.t3, marginBottom: 12 }}>
                  {currentPage.type} — HTML 아티팩트 렌더링
                </div>

                {/* Rendered HTML */}
                <div
                  dangerouslySetInnerHTML={{ __html: currentPage.code }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditPage) onEditPage(currentPage);
                  }}
                  style={{ cursor: "pointer", maxWidth: "100%", minHeight: 100 }}
                />

                {/* Edit button */}
                <button onClick={(e) => { e.stopPropagation(); if (onEditPage) onEditPage(currentPage); }}
                  style={{
                    marginTop: 12, padding: "6px 16px", fontSize: 11,
                    background: t.abg, color: t.ac, border: `1px solid ${t.ac}`,
                    borderRadius: 6, cursor: "pointer"
                  }}>
                  편집
                </button>
              </div>
            )}
          </div>

          {/* Thumbnail strip (togglable) */}
          {showStrip && pages.length > 0 && (
            <div style={{
              flexShrink: 0, borderTop: `1px solid ${t.cb}`, background: t.card,
              padding: "8px 10px", overflowX: "auto", display: "flex", gap: 6,
              alignItems: "flex-end"
            }}>
              {/* 시안 group */}
              {mockups.length > 0 && (
                <>
                  <div style={{
                    writingMode: "vertical-lr", fontSize: 9, color: t.t3,
                    padding: "4px 0", flexShrink: 0
                  }}>시안</div>
                  {mockups.map(pg => {
                    const idx = pages.indexOf(pg);
                    return (
                      <div key={pg.id} onClick={(e) => { e.stopPropagation(); setSelectedPageIdx(idx); }}
                        style={{
                          width: 80, flexShrink: 0, cursor: "pointer",
                          border: selectedPageIdx === idx ? `2px solid ${t.ac}` : `1px solid ${t.cb}`,
                          borderRadius: 6, overflow: "hidden", background: t.bg
                        }}>
                        <div style={{ overflow: "hidden", padding: 4, transform: "scale(0.3)", transformOrigin: "top left", width: 266, height: 166 }}
                          dangerouslySetInnerHTML={{ __html: pg.code }} />
                        <div style={{ padding: "3px 6px", fontSize: 9, color: t.tx, textAlign: "center",
                          borderTop: `1px solid ${t.cb}`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {pg.name}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Divider */}
              {mockups.length > 0 && storyboards.length > 0 && (
                <div style={{ width: 1, height: 60, background: t.cb, flexShrink: 0, margin: "0 4px" }} />
              )}

              {/* 스토리보드 group */}
              {storyboards.length > 0 && (
                <>
                  <div style={{
                    writingMode: "vertical-lr", fontSize: 9, color: t.t3,
                    padding: "4px 0", flexShrink: 0
                  }}>스토리보드</div>
                  {storyboards.map(pg => {
                    const idx = pages.indexOf(pg);
                    return (
                      <div key={pg.id} onClick={(e) => { e.stopPropagation(); setSelectedPageIdx(idx); }}
                        style={{
                          width: 80, flexShrink: 0, cursor: "pointer",
                          border: selectedPageIdx === idx ? `2px solid ${t.ac}` : `1px solid ${t.cb}`,
                          borderRadius: 6, overflow: "hidden", background: t.bg
                        }}>
                        <div style={{ overflow: "hidden", padding: 4, transform: "scale(0.3)", transformOrigin: "top left", width: 266, height: 166 }}
                          dangerouslySetInnerHTML={{ __html: pg.code }} />
                        <div style={{ padding: "3px 6px", fontSize: 9, color: t.tx, textAlign: "center",
                          borderTop: `1px solid ${t.cb}` }}>
                          {pg.name}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* + Add */}
              <div onClick={(e) => { e.stopPropagation(); setShowAddCode(true); }}
                style={{
                  width: 60, height: 60, flexShrink: 0, cursor: "pointer",
                  border: `1px dashed ${t.cb}`, borderRadius: 6,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  color: t.t3, fontSize: 18, gap: 2
                }}>
                <span>+</span>
                <span style={{ fontSize: 8 }}>추가</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ELEMENT MODE */}
      {leftMode === "element" && (
        <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
          {/* Page selector */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
            {(project.pages || []).filter(p => p.type === "시안").map((pg, i) => (
              <button key={pg.id} onClick={() => setSelectedPageIdx(i)}
                style={{
                  padding: "4px 10px", fontSize: 10, borderRadius: 4, cursor: "pointer",
                  border: `1px solid ${selectedPageIdx === i ? t.ac : t.cb}`,
                  background: selectedPageIdx === i ? t.abg : "transparent",
                  color: selectedPageIdx === i ? t.ac : t.t3,
                  fontWeight: selectedPageIdx === i ? 600 : 400
                }}>{pg.name}</button>
            ))}
          </div>

          {/* Element list */}
          <div style={{ fontSize: 10, color: t.t3, marginBottom: 6 }}>
            {currentPage?.name || "페이지"} 영역 요소
          </div>
          {elements.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: t.t3 }}>
              아직 등록된 영역 요소가 없습니다
            </div>
          ) : (
            elements.map(el => (
              <div key={el.id} onClick={() => setSelectedElementId(el.id)}
                style={{
                  padding: "8px 10px", marginBottom: 4, borderRadius: 6, cursor: "pointer",
                  background: selectedElementId === el.id ? t.abg : t.card,
                  border: `1px solid ${selectedElementId === el.id ? t.ac : t.cb}`
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{el.emoji || "📦"}</span>
                  <span style={{ fontSize: 12, color: t.tx, fontWeight: 500 }}>{el.name}</span>
                </div>
                {/* Mini preview */}
                {selectedElementId === el.id && el.code && (
                  <div style={{ marginTop: 6, padding: 8, background: t.pv, borderRadius: 4 }}
                    dangerouslySetInnerHTML={{ __html: el.code }} />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add code modal */}
      {showAddCode && (
        <div onClick={() => setShowAddCode(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              width: 400, maxHeight: "80vh", overflow: "auto",
              background: t.card, borderRadius: 12, padding: 20,
              border: `1px solid ${t.cb}`
            }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, color: t.tx }}>시안/코드 추가</h3>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: t.t3, marginBottom: 4 }}>이름</div>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="v2 리스트형"
                style={{
                  width: "100%", padding: "8px 10px", background: t.ib,
                  border: `1px solid ${t.ibr}`, borderRadius: 6,
                  fontSize: 13, color: t.tx, outline: "none", boxSizing: "border-box"
                }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: t.t3, marginBottom: 4 }}>HTML/JSX 코드</div>
              <textarea value={newCode} onChange={e => setNewCode(e.target.value)}
                rows={8} placeholder='<div style="padding:20px;color:#fff">새 시안 코드</div>'
                style={{
                  width: "100%", padding: "8px 10px", background: t.ib,
                  border: `1px solid ${t.ibr}`, borderRadius: 6,
                  fontSize: 12, color: t.gn, fontFamily: "monospace",
                  outline: "none", resize: "vertical", boxSizing: "border-box"
                }} />
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowAddCode(false)}
                style={{ flex: 1, padding: "8px", border: `1px solid ${t.cb}`, background: "transparent", color: t.t3, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={() => addPage("시안")}
                style={{ flex: 1, padding: "8px", border: "none", background: t.ac, color: "#fff", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                시안 추가
              </button>
              <button onClick={() => addPage("스토리보드")}
                style={{ flex: 1, padding: "8px", border: `1px solid ${t.am}`, background: "transparent", color: t.am, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                스토리보드 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
