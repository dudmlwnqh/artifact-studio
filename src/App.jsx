import { useState, useEffect, useCallback } from "react";
import { dark, light } from "./theme.js";
import { INIT_PROJECTS } from "./data.js";
import storage from "./storage.js";
import Editor from "./Editor.jsx";
import AddModal from "./AddModal.jsx";

const ZOOM = [
  { cols: 6, emo: 16, showTitle: false },
  { cols: 4, emo: 24, showTitle: true },
  { cols: 3, emo: 32, showTitle: true },
];

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [tab, setTab] = useState("artifact");
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState("basic");
  const [search, setSearch] = useState("");
  const [editProject, setEditProject] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [projects, setProjects] = useState(INIT_PROJECTS);
  const [loaded, setLoaded] = useState(false);
  const [sources, setSources] = useState([
    { id: "s1", name: "Primary Button", cat: "버튼", color: "#7C6AFF" },
    { id: "s2", name: "메인 컬러", cat: "팔레트", color: "#534AB7" },
    { id: "s3", name: "다크 배경", cat: "배경", color: null },
    { id: "s4", name: "카드 스택", cat: "레이아웃", color: "#22222e" },
  ]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceCat, setNewSourceCat] = useState("버튼");

  const t = isDark ? dark : light;
  const z = ZOOM[zoom];

  // Load projects from storage
  useEffect(() => {
    (async () => {
      try {
        const result = await storage.get("projects");
        if (result && result.value) {
          const parsed = JSON.parse(result.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProjects(parsed);
          }
        }
        const srcResult = await storage.get("sources");
        if (srcResult && srcResult.value) {
          const parsed = JSON.parse(srcResult.value);
          if (Array.isArray(parsed)) setSources(parsed);
        }
      } catch (e) {
        console.log("Storage load failed, using defaults");
      }
      setLoaded(true);
    })();
  }, []);

  // Save projects to storage whenever they change
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await storage.set("projects", JSON.stringify(projects));
        await storage.set("sources", JSON.stringify(sources));
      } catch (e) {
        console.log("Storage save failed");
      }
    })();
  }, [projects, sources, loaded]);

  const addProject = (p) => setProjects(prev => [...prev, p]);
  const saveProject = (p) => setProjects(prev => prev.map(x => x.id === p.id ? p : x));
  const deleteProject = (id) => {
    if (confirm("이 프로젝트를 삭제하시겠습니까?")) {
      setProjects(prev => prev.filter(x => x.id !== id));
    }
  };
  const addSource = () => {
    if (!newSourceName.trim()) return;
    setSources(prev => [...prev, { id: "s" + Date.now(), name: newSourceName.trim(), cat: newSourceCat, color: null }]);
    setNewSourceName("");
    setShowAddSource(false);
  };
  const deleteSource = (id) => {
    setSources(prev => prev.filter(x => x.id !== id));
  };

  // Filter projects by search
  const lc = search.toLowerCase();
  const filtered = projects.filter(p =>
    !search || p.name.toLowerCase().includes(lc) || p.tags.some(tg => tg.includes(lc))
  );

  // Editor view
  if (editProject) {
    return <Editor project={editProject} onBack={() => setEditProject(null)} onSave={saveProject} t={t} />;
  }

  return (
    <div style={{ background: t.bg, color: t.tx, fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
      {showAdd && <AddModal onAdd={addProject} onClose={() => setShowAdd(false)} t={t} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 10px" }}>
        <b style={{ fontSize: 18 }}>FitTrack</b>
        <div style={{ flex: 1 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="프로젝트 검색..."
            style={{
              width: "100%", padding: "9px 12px", background: t.ib,
              border: `1px solid ${t.ibr}`, borderRadius: 6,
              fontSize: 13, color: t.tx, outline: "none"
            }}
          />
        </div>
        <div onClick={() => setIsDark(!isDark)}
          style={{
            width: 40, height: 22, borderRadius: 11,
            background: isDark ? "#333" : "#bbb",
            position: "relative", cursor: "pointer"
          }}>
          <div style={{
            width: 18, height: 18, borderRadius: 9,
            background: isDark ? "#08080C" : "#fff",
            position: "absolute", top: 2, left: isDark ? 20 : 2,
            transition: "left 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10
          }}>
            {isDark ? "🌙" : "☀️"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.cb}`, margin: "0 16px" }}>
        {[["artifact", "아티팩트"], ["source", "소스"]].map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSearch(""); }}
            style={{
              flex: 1, padding: "10px 0", fontSize: 13,
              fontWeight: tab === k ? 600 : 400,
              color: tab === k ? t.ac : t.t3,
              background: "transparent", border: "none",
              borderBottom: tab === k ? `2px solid ${t.ac}` : "2px solid transparent",
              cursor: "pointer"
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Artifact Tab */}
      {tab === "artifact" && (
        <>
          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 6px" }}>
            <div style={{ display: "flex", border: `1px solid ${t.cb}`, borderRadius: 4, overflow: "hidden" }}>
              {[["basic", "기본"], ["detail", "상세"]].map(([k, label]) => (
                <button key={k} onClick={() => setMode(k)}
                  style={{
                    padding: "5px 14px", fontSize: 11,
                    fontWeight: mode === k ? 600 : 400,
                    border: "none", cursor: "pointer",
                    background: mode === k ? t.abg : "transparent",
                    color: mode === k ? t.ac : t.t3
                  }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => zoom > 0 && setZoom(zoom - 1)}
                style={{
                  width: 28, height: 28, border: `1px solid ${t.cb}`, borderRadius: 4,
                  background: "transparent", color: zoom === 0 ? t.cb : t.t2,
                  fontSize: 14, cursor: "pointer"
                }}>−</button>
              <span style={{ fontSize: 11, color: t.t3, minWidth: 28, textAlign: "center" }}>{z.cols}열</span>
              <button onClick={() => zoom < 2 && setZoom(zoom + 1)}
                style={{
                  width: 28, height: 28, border: `1px solid ${t.cb}`, borderRadius: 4,
                  background: "transparent", color: zoom === 2 ? t.cb : t.t2,
                  fontSize: 14, cursor: "pointer"
                }}>+</button>
            </div>
          </div>

          {/* Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${z.cols}, 1fr)`,
            gap: 2, padding: "0 16px"
          }}>
            {filtered.map(item => (
              <div key={item.id} style={{ position: "relative" }}>
                <div
                  onClick={() => setEditProject(item)}
                  style={{
                    aspectRatio: "1", overflow: "hidden", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `linear-gradient(135deg, ${item.bg}, ${item.bg}cc)`,
                    position: "relative"
                  }}
                >
                  <span style={{ fontSize: z.emo }}>{item.emoji}</span>

                  {mode === "detail" && (
                    <div style={{
                      position: "absolute", top: 0, left: 0,
                      padding: "3px 8px", fontSize: zoom === 2 ? 11 : 9,
                      fontWeight: 500, color: "#fff", background: item.priC
                    }}>
                      {item.pri}
                    </div>
                  )}

                  {z.showTitle && (
                    <div style={{
                      position: "absolute", bottom: mode === "detail" ? 5 : 0,
                      left: 0, right: 0, padding: "5px 8px",
                      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)"
                    }}>
                      <div style={{
                        fontSize: zoom === 2 ? 13 : 11, fontWeight: 500,
                        color: "#fff", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>
                        {item.name}
                      </div>
                      {mode === "detail" && (
                        <div style={{ display: "flex", gap: 3, marginTop: 2, fontSize: 8 }}>
                          {item.tags.map(tg => (
                            <span key={tg} style={{ color: "rgba(255,255,255,0.5)" }}>#{tg}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {mode === "detail" && item.pct > 0 && (
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      height: 5, background: "rgba(0,0,0,0.3)"
                    }}>
                      <div style={{
                        height: "100%", width: item.pct + "%",
                        background: item.pct >= 80 ? "#5DCAA5" : item.pct >= 50 ? "#A094FF" : "#EF9F27"
                      }} />
                    </div>
                  )}
                </div>

                {mode === "detail" && (
                  <span
                    onClick={e => { e.stopPropagation(); deleteProject(item.id); }}
                    style={{
                      position: "absolute", top: 2, right: 2,
                      fontSize: 12, color: "rgba(255,255,255,0.4)",
                      cursor: "pointer", padding: "2px 6px", zIndex: 1
                    }}
                  >×</span>
                )}
              </div>
            ))}

            {/* Add button */}
            <div onClick={() => setShowAdd(true)}
              style={{
                aspectRatio: "1", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", cursor: "pointer",
                background: isDark ? "#10101a" : t.card,
                color: t.t3, fontSize: z.emo * 0.7, gap: 4,
                border: `1px dashed ${t.cb}`
              }}>
              <span>+</span>
              {z.showTitle && <span style={{ fontSize: 10 }}>새 프로젝트</span>}
            </div>
          </div>

          <div style={{ padding: "10px 16px", fontSize: 11, color: t.t3 }}>
            {filtered.length}개 프로젝트 · 클릭하면 에디터 열림
          </div>
        </>
      )}

      {/* Source Tab */}
      {tab === "source" && (
        <div style={{ padding: 16 }}>
          {/* Add source form */}
          {showAddSource && (
            <div style={{
              marginBottom: 12, padding: 14, background: t.card,
              border: `1px solid ${t.cb}`, borderRadius: 8
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>자료 추가</div>
              <input value={newSourceName} onChange={e => setNewSourceName(e.target.value)}
                placeholder="자료 이름"
                style={{
                  width: "100%", padding: "8px 10px", marginBottom: 8, background: t.ib,
                  border: `1px solid ${t.ibr}`, borderRadius: 6, fontSize: 13, color: t.tx,
                  outline: "none", boxSizing: "border-box"
                }} />
              <select value={newSourceCat} onChange={e => setNewSourceCat(e.target.value)}
                style={{
                  width: "100%", padding: "8px 10px", marginBottom: 10, background: t.ib,
                  border: `1px solid ${t.ibr}`, borderRadius: 6, fontSize: 13, color: t.tx, outline: "none"
                }}>
                {["버튼", "팔레트", "배경", "레이아웃", "아이콘", "텍스트", "기타"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setShowAddSource(false)}
                  style={{ flex: 1, padding: "8px", border: `1px solid ${t.cb}`, background: "transparent", color: t.t3, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                  취소
                </button>
                <button onClick={addSource}
                  style={{ flex: 1, padding: "8px", border: "none", background: t.ac, color: "#fff", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                  추가
                </button>
              </div>
            </div>
          )}

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 8
          }}>
            {sources.map(d => (
              <div key={d.id} style={{ border: `1px solid ${t.cb}`, borderRadius: 8, overflow: "hidden", background: t.card, position: "relative" }}>
                <div style={{
                  height: 70, display: "flex", alignItems: "center", justifyContent: "center",
                  background: d.color || "#12121e", borderBottom: `1px solid ${t.cb}`
                }}>
                  {d.cat === "버튼" && <div style={{ padding: "4px 12px", background: d.color || "#7C6AFF", color: "#fff", fontSize: 9, borderRadius: 4 }}>{d.name}</div>}
                  {d.cat === "팔레트" && <div style={{ display: "flex", gap: 2 }}>{["#534AB7", "#7C6AFF", "#1D9E75", "#EF9F27"].map(c => <div key={c} style={{ width: 14, height: 14, background: c, borderRadius: 2 }} />)}</div>}
                  {d.cat !== "버튼" && d.cat !== "팔레트" && <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${d.color || "#0f2027"}, #2c5364)` }} />}
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: t.tx }}>{d.name}</div>
                  <div style={{ fontSize: 9, color: t.t3, marginTop: 2 }}>{d.cat}</div>
                </div>
                <span onClick={() => deleteSource(d.id)}
                  style={{
                    position: "absolute", top: 4, right: 6, fontSize: 14,
                    color: "rgba(255,255,255,0.5)", cursor: "pointer", lineHeight: 1
                  }}>×</span>
              </div>
            ))}
            <div onClick={() => setShowAddSource(true)} style={{
              border: `1px dashed ${t.cb}`, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              minHeight: 100, color: t.t3, fontSize: 11, cursor: "pointer"
            }}>
              + 자료 추가
            </div>
          </div>
          <div style={{ padding: "10px 0", fontSize: 11, color: t.t3 }}>
            {sources.length}개 자료 · × 클릭으로 삭제
          </div>
        </div>
      )}
    </div>
  );
}
