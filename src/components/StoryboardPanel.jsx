import { useState } from "react";

export default function StoryboardPanel({ project, onUpdateProject, t }) {
  const [tab, setTab] = useState("storyboard"); // "materials" | "storyboard"
  const [steps, setSteps] = useState(project.storyboard || [
    {
      id: "s1", title: "앱 실행 — 데이터 로딩",
      desc: "Firestore에서 오늘 운동 데이터 fetch. 로딩 중 shimmer 스켈레톤 표시. 3초 timeout 시 에러 토스트.",
      variants: [{ id: "sv1", name: "스켈레톤 로딩", code: '<div style="padding:24px;background:#1a1a2e;border-radius:12px"><div style="height:16px;width:60%;background:#2a2a40;border-radius:4px;margin-bottom:12px"></div><div style="height:12px;width:80%;background:#2a2a40;border-radius:4px;margin-bottom:8px"></div><div style="height:12px;width:40%;background:#2a2a40;border-radius:4px"></div></div>' }],
      variantIdx: 0,
      links: [{ label: "Firestore 스펙", url: "" }, { label: "프롬프트 복사", copy: "스켈레톤 로딩 UI를 만들어줘" }],
      prompt: "스켈레톤 로딩 UI를 만들어줘",
    },
  ]);
  const [editingStep, setEditingStep] = useState(null);
  const [newStepTitle, setNewStepTitle] = useState("");

  const updateSteps = (newSteps) => {
    setSteps(newSteps);
    onUpdateProject({ ...project, storyboard: newSteps });
  };

  const addStep = () => {
    const s = {
      id: "s" + Date.now(),
      title: newStepTitle.trim() || `스텝 ${steps.length + 1}`,
      desc: "",
      variants: [],
      variantIdx: 0,
      links: [],
      prompt: "",
    };
    updateSteps([...steps, s]);
    setNewStepTitle("");
    setEditingStep(s.id);
  };

  const updateStep = (id, patch) => {
    updateSteps(steps.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const deleteStep = (id) => {
    updateSteps(steps.filter(s => s.id !== id));
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: t.card }}>
      {/* Tabs: 자료 / 스토리보드 */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.cb}`, flexShrink: 0 }}>
        {[["materials", "자료"], ["storyboard", "스토리보드"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: "8px 0", fontSize: 12, border: "none", cursor: "pointer",
            background: "transparent", color: tab === k ? t.ac : t.t3,
            borderBottom: tab === k ? `2px solid ${t.ac}` : "2px solid transparent",
            fontWeight: tab === k ? 600 : 400
          }}>{label}</button>
        ))}
      </div>

      {/* ===== 자료 TAB ===== */}
      {tab === "materials" && (
        <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
          <div style={{ fontSize: 12, color: t.t2, marginBottom: 12 }}>
            설명용 자료를 업로드하면 AI가 분석하여 스토리보드를 자동 생성합니다.
          </div>

          {/* Upload area */}
          <div style={{
            border: `2px dashed ${t.cb}`, borderRadius: 12, padding: 24,
            textAlign: "center", cursor: "pointer", marginBottom: 12
          }}>
            <div style={{ fontSize: 24, color: t.t3, marginBottom: 8 }}>+</div>
            <div style={{ fontSize: 12, color: t.t3, lineHeight: 1.6 }}>
              PDF, PPT, 이미지, 텍스트 파일<br/>
              드래그하거나 클릭하여 업로드
            </div>
          </div>

          {/* Upload categories */}
          {["설명글", "PDF 설명", "PPT 설명", "프롬프트 (생성 전)", "프롬프트 (수정용)", "로직 그래프 이미지"].map(cat => (
            <div key={cat} style={{
              padding: "10px 12px", marginBottom: 4, borderRadius: 6,
              border: `1px solid ${t.cb}`, background: t.ib,
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <span style={{ fontSize: 11, color: t.t2 }}>{cat}</span>
              <span style={{ fontSize: 10, color: t.t3 }}>미등록</span>
            </div>
          ))}

          <button style={{
            width: "100%", padding: 10, marginTop: 12,
            background: t.ac, color: "#fff", border: "none",
            borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            opacity: 0.5
          }} disabled>
            AI 분석 & 스토리보드 생성
          </button>
          <div style={{ fontSize: 10, color: t.t3, marginTop: 6, textAlign: "center" }}>
            자료를 업로드하면 활성화됩니다
          </div>
        </div>
      )}

      {/* ===== 스토리보드 TAB ===== */}
      {tab === "storyboard" && (
        <div style={{ flex: 1, overflow: "auto", padding: "10px 14px" }}>
          {steps.map((step, i) => (
            <div key={step.id} style={{ marginBottom: 20 }}>
              {/* Step header: number + title */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 12, flexShrink: 0,
                  background: t.ac, color: "#fff", fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>{i + 1}</div>
                {editingStep === step.id ? (
                  <input value={step.title}
                    onChange={e => updateStep(step.id, { title: e.target.value })}
                    onBlur={() => setEditingStep(null)}
                    onKeyDown={e => e.key === "Enter" && setEditingStep(null)}
                    autoFocus
                    style={{
                      flex: 1, padding: "4px 8px", background: t.ib,
                      border: `1px solid ${t.ibr}`, borderRadius: 4,
                      fontSize: 13, fontWeight: 600, color: t.tx, outline: "none"
                    }} />
                ) : (
                  <div onClick={() => setEditingStep(step.id)} style={{
                    flex: 1, fontSize: 13, fontWeight: 600, color: t.tx, cursor: "text"
                  }}>{step.title}</div>
                )}
                <span onClick={() => deleteStep(step.id)}
                  style={{ fontSize: 14, color: t.t3, cursor: "pointer", padding: "0 4px", opacity: 0.5 }}>×</span>
              </div>

              {/* Preview card */}
              <div style={{
                background: t.ib, borderRadius: 8, overflow: "hidden",
                border: `1px solid ${t.ibr}`, marginBottom: 6
              }}>
                {step.variants.length > 0 ? (
                  <div style={{ padding: 8, minHeight: 60 }}
                    dangerouslySetInnerHTML={{ __html: step.variants[step.variantIdx]?.code || "" }} />
                ) : (
                  <div style={{
                    padding: 16, textAlign: "center", color: t.t3, fontSize: 11,
                    minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center"
                  }}>시안 없음 — 터치하여 추가</div>
                )}

                {/* Variant strip (camera album mini) */}
                {step.variants.length > 1 && (
                  <div style={{
                    display: "flex", gap: 4, padding: "4px 8px",
                    borderTop: `1px solid ${t.ibr}`, overflowX: "auto"
                  }}>
                    {step.variants.map((v, vi) => (
                      <div key={v.id} onClick={() => updateStep(step.id, { variantIdx: vi })}
                        style={{
                          padding: "2px 8px", fontSize: 10, borderRadius: 4, cursor: "pointer",
                          background: step.variantIdx === vi ? t.abg : "transparent",
                          color: step.variantIdx === vi ? t.ac : t.t3,
                          border: `1px solid ${step.variantIdx === vi ? t.ac : t.ibr}`
                        }}>{v.name}</div>
                    ))}
                    <div style={{ padding: "2px 8px", fontSize: 10, color: t.t3, cursor: "pointer" }}>+</div>
                  </div>
                )}
              </div>

              {/* Description */}
              <textarea value={step.desc}
                onChange={e => updateStep(step.id, { desc: e.target.value })}
                placeholder="이 스텝의 설명..."
                rows={2}
                style={{
                  width: "100%", padding: "6px 8px", background: "transparent",
                  border: "none", borderBottom: `1px solid ${t.cb}`,
                  fontSize: 11, color: t.t2, outline: "none", resize: "none",
                  lineHeight: 1.6, boxSizing: "border-box", fontFamily: "inherit"
                }} />

              {/* Links */}
              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                {(step.links || []).map((link, li) => (
                  <span key={li}
                    onClick={() => link.copy ? copyText(link.copy) : null}
                    style={{
                      fontSize: 10, color: t.ac, cursor: "pointer",
                      textDecoration: "underline", textUnderlineOffset: 2
                    }}>
                    {link.label} ↗
                  </span>
                ))}
                {step.prompt && (
                  <span onClick={() => copyText(step.prompt)}
                    style={{
                      fontSize: 10, color: t.t3, cursor: "pointer",
                      textDecoration: "underline", textUnderlineOffset: 2
                    }}>
                    프롬프트 복사 ↗
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Add step */}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={newStepTitle} onChange={e => setNewStepTitle(e.target.value)}
              placeholder="새 스텝 제목..."
              onKeyDown={e => e.key === "Enter" && addStep()}
              style={{
                flex: 1, padding: "6px 10px", background: t.ib,
                border: `1px solid ${t.ibr}`, borderRadius: 6,
                fontSize: 11, color: t.tx, outline: "none"
              }} />
            <button onClick={addStep} style={{
              padding: "6px 12px", background: t.ac, color: "#fff",
              border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600
            }}>+ 스텝</button>
          </div>
        </div>
      )}
    </div>
  );
}
