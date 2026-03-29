import { useState } from "react";
import { generateTokenFiles } from "../utils/tokenFileGenerator.js";

// 파일 타입별 설명 + 아이콘 + 색상
const FILE_TEMPLATES = [
  {
    type: "theme",
    icon: "🎨",
    name: "theme.js",
    label: "테마 / 색상",
    desc: "앱에서 사용하는 색상 모음. 다크모드·라이트모드 색상, 브랜드 컬러 등.",
    template: `export const dark = {\n  bg: "#08080C",\n  text: "#E8E8EE",\n  accent: "#7C6AFF",\n};\n\nexport const light = {\n  bg: "#FFFFFF",\n  text: "#1a1a1a",\n  accent: "#534AB7",\n};`,
  },
  {
    type: "data",
    icon: "📋",
    name: "data.js",
    label: "초기 데이터",
    desc: "화면에 보여줄 목록, 카드, 메뉴 등의 기본 데이터. 서버 연결 전 테스트용.",
    template: `export const ITEMS = [\n  { id: 1, name: "항목 1", emoji: "🏠" },\n  { id: 2, name: "항목 2", emoji: "🔑" },\n];`,
  },
  {
    type: "component",
    icon: "🧩",
    name: "Component.jsx",
    label: "화면 부품 (컴포넌트)",
    desc: "버튼, 카드, 모달 등 재사용 가능한 화면 조각. 여러 페이지에서 공유.",
    template: `export default function MyComponent({ title, onClick }) {\n  return (\n    <div style={{padding:16, background:"#1a1a2e", borderRadius:8}}>\n      <h3 style={{color:"#fff", margin:0}}>{title}</h3>\n      <button onClick={onClick} style={{marginTop:8, padding:"8px 16px", background:"#7C6AFF", color:"#fff", border:"none", borderRadius:6, cursor:"pointer"}}>클릭</button>\n    </div>\n  );\n}`,
  },
  {
    type: "util",
    icon: "🔧",
    name: "utils.js",
    label: "유틸리티 / 도구",
    desc: "날짜 변환, 숫자 포맷, 데이터 가공 등 도우미 함수 모음.",
    template: `export function formatDate(d) {\n  return new Date(d).toLocaleDateString("ko-KR");\n}\n\nexport function formatNumber(n) {\n  return n.toLocaleString("ko-KR");\n}`,
  },
  {
    type: "storage",
    icon: "💾",
    name: "storage.js",
    label: "저장소 연결",
    desc: "데이터를 저장하고 불러오는 기능. localStorage, Supabase 등.",
    template: `const storage = {\n  get(key) { return JSON.parse(localStorage.getItem(key)); },\n  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },\n};\nexport default storage;`,
  },
  {
    type: "style",
    icon: "✨",
    name: "styles.js",
    label: "스타일 모음",
    desc: "자주 쓰는 스타일을 모아둔 파일. 버튼 스타일, 카드 스타일 등.",
    template: `export const buttonStyle = {\n  padding: "10px 20px",\n  background: "#7C6AFF",\n  color: "#fff",\n  border: "none",\n  borderRadius: 8,\n  cursor: "pointer",\n};\n\nexport const cardStyle = {\n  padding: 16,\n  background: "#1a1a2e",\n  borderRadius: 12,\n};`,
  },
  {
    type: "custom",
    icon: "📄",
    name: "custom.js",
    label: "직접 작성",
    desc: "원하는 이름과 내용으로 자유롭게 작성하는 파일.",
    template: `// 여기에 코드를 작성하세요\n`,
  },
];

const inputBg = "rgba(255,255,255,0.05)";
const inputBorder = "1px solid rgba(255,255,255,0.08)";

const LINK_MODES = [
  { key: "reference", label: "참조", icon: "🔗", desc: "토큰 변경 시 자동 반영" },
  { key: "copy", label: "복사", icon: "📋", desc: "스냅샷 복사 (독립)" },
  { key: "locked", label: "잠금", icon: "🔒", desc: "수동 업데이트" },
];

export default function ProjectFiles({ files: filesProp, onChange, t, tokenSets, project, onUpdateProject }) {
  // 로컬 state로 관리하여 즉시 반영
  const [localFiles, setLocalFiles] = useState(filesProp || {});
  const files = localFiles;
  const [showAdd, setShowAdd] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customName, setCustomName] = useState("");
  const [linkMode, setLinkMode] = useState(project?.tokenLinkMode || "reference");

  // 변경 시 부모에게도 전달
  const updateFiles = (newFiles) => {
    setLocalFiles(newFiles);
    onChange(newFiles);
  };

  const fileList = Object.entries(files || {});

  const addFile = (template) => {
    const name = template.type === "custom" && customName.trim()
      ? customName.trim()
      : template.name;
    // 중복 방지
    let finalName = name;
    let i = 1;
    while (files[finalName]) { finalName = name.replace(".", `${++i}.`); }

    const updated = {
      ...files,
      [finalName]: {
        code: template.template,
        type: template.type,
        label: template.label,
        desc: template.desc,
        icon: template.icon,
      }
    };
    updateFiles(updated);
    setShowAdd(false);
    setSelectedTemplate(null);
    setCustomName("");
    setEditingFile(finalName);
  };

  const updateFile = (name, code) => {
    onChange({ ...files, [name]: { ...files[name], code } });
  };

  const deleteFile = (name) => {
    const updated = { ...files };
    delete updated[name];
    updateFiles(updated);
    if (editingFile === name) setEditingFile(null);
  };

  const renameFile = (oldName, newName) => {
    if (!newName.trim() || newName === oldName || files[newName]) return;
    const updated = {};
    Object.entries(files).forEach(([k, v]) => {
      updated[k === oldName ? newName : k] = v;
    });
    updateFiles(updated);
    if (editingFile === oldName) setEditingFile(newName);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px", borderBottom: `1px solid ${t.cb}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>📁 프로젝트 파일</div>
          <div style={{ fontSize: 10, color: t.t3, marginTop: 2 }}>시안이 import하는 파일들을 여기서 관리</div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          padding: "5px 12px", fontSize: 11, background: t.ac, color: "#fff",
          border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600
        }}>+ 추가</button>
      </div>

      {/* 토큰 세트 연결 */}
      {tokenSets && tokenSets.length > 0 && (
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t.cb}`, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: t.t2, marginBottom: 6, fontWeight: 500 }}>🎨 토큰 세트 연결</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={project?.tokenSetId || ""}
              onChange={(e) => {
                const tsId = e.target.value || null;
                const ts = tokenSets.find((s) => s.id === tsId);

                if (!tsId) {
                  // 연결 해제 — autoGenerated 파일 제거
                  const cleaned = {};
                  Object.entries(files).forEach(([name, f]) => {
                    if (!f.autoGenerated) cleaned[name] = f;
                  });
                  updateFiles(cleaned);
                  if (onUpdateProject) onUpdateProject({ ...project, tokenSetId: null, tokenLinkMode: null, tokenLockedAt: null, projectFiles: cleaned });
                  return;
                }

                if (linkMode === "copy") {
                  // 복사 모드: 파일을 복사하고 tokenSetId는 null
                  const generated = generateTokenFiles(ts);
                  // autoGenerated 제거 후 복사
                  const cleaned = {};
                  Object.entries(files).forEach(([name, f]) => {
                    if (!f.autoGenerated) cleaned[name] = f;
                  });
                  const merged = { ...cleaned, ...Object.fromEntries(
                    Object.entries(generated).map(([k, v]) => [k, { ...v, autoGenerated: false }])
                  )};
                  updateFiles(merged);
                  if (onUpdateProject) onUpdateProject({ ...project, tokenSetId: null, tokenLinkMode: "copy", projectFiles: merged });
                } else if (linkMode === "locked") {
                  // 잠금 모드: tokenSetId + lockedAt 저장
                  const generated = generateTokenFiles(ts);
                  const cleaned = {};
                  Object.entries(files).forEach(([name, f]) => {
                    if (!f.autoGenerated) cleaned[name] = f;
                  });
                  const merged = { ...cleaned, ...generated };
                  updateFiles(merged);
                  if (onUpdateProject) onUpdateProject({ ...project, tokenSetId: tsId, tokenLinkMode: "locked", tokenLockedAt: ts.updatedAt, projectFiles: merged });
                } else {
                  // 참조 모드: tokenSetId 저장, autoGenerated 파일 생성
                  const generated = generateTokenFiles(ts);
                  const cleaned = {};
                  Object.entries(files).forEach(([name, f]) => {
                    if (!f.autoGenerated) cleaned[name] = f;
                  });
                  const merged = { ...cleaned, ...generated };
                  updateFiles(merged);
                  if (onUpdateProject) onUpdateProject({ ...project, tokenSetId: tsId, tokenLinkMode: "reference", projectFiles: merged });
                }
              }}
              style={{
                flex: 1, padding: "5px 8px", fontSize: 11, color: t.tx,
                background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 4, outline: "none",
              }}
            >
              <option value="">선택 안 함</option>
              {tokenSets.map((ts) => (
                <option key={ts.id} value={ts.id}>{ts.name}</option>
              ))}
            </select>

            {/* 모드 선택 */}
            <div style={{ display: "flex", gap: 2, border: `1px solid ${t.cb}`, borderRadius: 4, overflow: "hidden" }}>
              {LINK_MODES.map((m) => (
                <button key={m.key} onClick={() => setLinkMode(m.key)}
                  title={m.desc}
                  style={{
                    padding: "3px 8px", fontSize: 10, border: "none", cursor: "pointer",
                    background: linkMode === m.key ? t.abg : "transparent",
                    color: linkMode === m.key ? t.ac : t.t3,
                  }}>{m.icon} {m.label}</button>
              ))}
            </div>
          </div>

          {/* 잠금 모드 업데이트 알림 */}
          {project?.tokenLinkMode === "locked" && project?.tokenSetId && (() => {
            const ts = tokenSets.find((s) => s.id === project.tokenSetId);
            if (ts && ts.updatedAt > (project.tokenLockedAt || 0)) {
              return (
                <div style={{ marginTop: 6, padding: "6px 10px", background: t.am + "22", borderRadius: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: t.am }}>토큰 세트가 업데이트되었습니다</span>
                  <button
                    onClick={() => {
                      const generated = generateTokenFiles(ts);
                      const cleaned = {};
                      Object.entries(files).forEach(([name, f]) => {
                        if (!f.autoGenerated) cleaned[name] = f;
                      });
                      const merged = { ...cleaned, ...generated };
                      updateFiles(merged);
                      if (onUpdateProject) onUpdateProject({ ...project, tokenLockedAt: ts.updatedAt, projectFiles: merged });
                    }}
                    style={{ padding: "2px 8px", fontSize: 10, background: t.am, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                  >업데이트</button>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto" }}>
        {/* File list */}
        {fileList.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 12, color: t.t3, lineHeight: 1.8 }}>
              아직 등록된 파일이 없습니다.<br/>
              <span style={{ color: t.t2 }}>시안 코드에서 import하는 파일을 여기에 추가하세요.</span><br/>
              <span style={{ fontSize: 10, color: t.t3 }}>예: 색상 테마, 데이터, 컴포넌트 등</span>
            </div>
          </div>
        ) : (
          <div style={{ padding: 8 }}>
            {fileList.map(([name, file]) => (
              <div key={name} style={{
                marginBottom: 6, borderRadius: 8, overflow: "hidden",
                border: editingFile === name ? `1px solid ${t.ac}` : `1px solid ${t.cb}`,
                background: editingFile === name ? t.abg : t.card,
              }}>
                {/* File header */}
                <div onClick={() => setEditingFile(editingFile === name ? null : name)}
                  style={{
                    padding: "8px 12px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8
                  }}>
                  <span style={{ fontSize: 16 }}>{file.icon || "📄"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: t.tx }}>{name}</span>
                      {file.autoGenerated && (
                        <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 8, background: t.ac + "22", color: t.ac }}>
                          {project?.tokenLinkMode === "locked" ? "🔒잠금" : project?.tokenLinkMode === "copy" ? "📋복사" : "🔗참조"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: t.t3, marginTop: 1 }}>{file.label || file.type}</div>
                  </div>
                  {file.autoGenerated ? (
                    <span style={{ fontSize: 10, color: t.t3, padding: "0 4px" }}>자동</span>
                  ) : (
                    <span onClick={(e) => { e.stopPropagation(); deleteFile(name); }}
                      style={{ fontSize: 14, color: t.t3, cursor: "pointer", padding: "0 4px", opacity: 0.5 }}>×</span>
                  )}
                </div>

                {/* File editor (expanded) */}
                {editingFile === name && (
                  <div style={{ padding: "0 12px 12px" }}>
                    <div style={{ fontSize: 10, color: t.t3, marginBottom: 6, lineHeight: 1.5 }}>
                      {file.desc}
                    </div>
                    <textarea
                      value={file.code}
                      onChange={e => updateFile(name, e.target.value)}
                      spellCheck={false}
                      style={{
                        width: "100%", minHeight: 120, padding: 10,
                        background: "rgba(0,0,0,0.3)", border: inputBorder,
                        borderRadius: 6, color: "#5DCAA5",
                        fontFamily: '"SF Mono","Cascadia Code",monospace',
                        fontSize: 11, lineHeight: 1.6, outline: "none",
                        resize: "vertical", boxSizing: "border-box"
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add file modal */}
      {showAdd && (
        <div onClick={() => { setShowAdd(false); setSelectedTemplate(null); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
          }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 380, maxHeight: "80vh", overflow: "auto",
            background: t.card, borderRadius: 14, padding: 20,
            border: `1px solid ${t.cb}`
          }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 15, color: t.tx }}>파일 추가</h3>
            <p style={{ margin: "0 0 16px", fontSize: 11, color: t.t3 }}>
              시안 코드가 import하는 파일을 선택하세요. 무슨 파일인지 모르겠으면 설명을 읽어보세요.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {FILE_TEMPLATES.map(tmpl => (
                <div key={tmpl.type}
                  onClick={() => setSelectedTemplate(selectedTemplate?.type === tmpl.type ? null : tmpl)}
                  style={{
                    padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                    border: selectedTemplate?.type === tmpl.type ? `1px solid ${t.ac}` : `1px solid ${t.cb}`,
                    background: selectedTemplate?.type === tmpl.type ? t.abg : "transparent",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{tmpl.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.tx }}>{tmpl.label}</div>
                      <div style={{ fontSize: 10, color: t.t3, marginTop: 2 }}>{tmpl.desc}</div>
                    </div>
                  </div>

                  {/* 선택 시 파일명 입력 */}
                  {selectedTemplate?.type === tmpl.type && (
                    <div style={{ marginTop: 10 }}>
                      {tmpl.type === "custom" && (
                        <input value={customName} onChange={e => setCustomName(e.target.value)}
                          placeholder="파일 이름 (예: Header.jsx)"
                          style={{
                            width: "100%", padding: "6px 10px", marginBottom: 8,
                            background: inputBg, border: inputBorder, borderRadius: 6,
                            fontSize: 12, color: t.tx, outline: "none", boxSizing: "border-box"
                          }} />
                      )}
                      <button onClick={() => addFile(tmpl)} style={{
                        width: "100%", padding: "8px",
                        background: t.ac, color: "#fff", border: "none",
                        borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600
                      }}>
                        {tmpl.type === "custom" ? (customName || tmpl.name) : tmpl.name} 추가
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => { setShowAdd(false); setSelectedTemplate(null); }}
              style={{
                width: "100%", marginTop: 12, padding: 8,
                border: `1px solid ${t.cb}`, background: "transparent",
                color: t.t3, borderRadius: 6, fontSize: 12, cursor: "pointer"
              }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
