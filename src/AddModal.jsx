import { useState } from "react";
import { EMOJIS, BG_COLORS } from "./theme.js";

export default function AddModal({ onAdd, onClose, t }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🏠");
  const [bg, setBg] = useState("#0f2027");
  const [tags, setTags] = useState("");
  const [code, setCode] = useState(
    '<div style="padding:20px;background:#1a1a2e;border-radius:8px;color:#fff;text-align:center">새 프로젝트</div>'
  );

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      id: "p" + Date.now(),
      name: name.trim(),
      emoji,
      bg,
      pri: "다음 대상",
      priC: "#666",
      tags: tags.split(",").map(s => s.trim()).filter(Boolean),
      pct: 0,
      code,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, maxHeight: "90vh", overflow: "auto",
          background: t.card, borderRadius: 12, padding: 24,
          border: `1px solid ${t.cb}`
        }}
      >
        <h3 style={{ margin: "0 0 20px", fontSize: 17, color: t.tx }}>새 프로젝트 추가</h3>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: t.t3, marginBottom: 6 }}>프로젝트 이름 *</div>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="프로젝트 이름을 입력하세요"
            style={{
              width: "100%", padding: "10px 12px", background: t.ib,
              border: `1px solid ${t.ibr}`, borderRadius: 8,
              fontSize: 14, color: t.tx, outline: "none", boxSizing: "border-box"
            }}
          />
        </div>

        {/* Emoji */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: t.t3, marginBottom: 6 }}>아이콘</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {EMOJIS.map(e => (
              <span key={e} onClick={() => setEmoji(e)}
                style={{
                  width: 34, height: 34, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 18, cursor: "pointer",
                  borderRadius: 6,
                  border: `2px solid ${emoji === e ? t.ac : "transparent"}`,
                  background: emoji === e ? t.abg : "transparent"
                }}>
                {e}
              </span>
            ))}
          </div>
        </div>

        {/* Background color */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: t.t3, marginBottom: 6 }}>배경색</div>
          <div style={{ display: "flex", gap: 6 }}>
            {BG_COLORS.map(c => (
              <div key={c} onClick={() => setBg(c)}
                style={{
                  width: 32, height: 32, borderRadius: 6, background: c,
                  cursor: "pointer",
                  border: `2px solid ${bg === c ? t.ac : "transparent"}`
                }} />
            ))}
          </div>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: t.t3, marginBottom: 6 }}>태그 (쉼표로 구분)</div>
          <input
            value={tags} onChange={e => setTags(e.target.value)}
            placeholder="예: 트래커, 코어, 인증"
            style={{
              width: "100%", padding: "10px 12px", background: t.ib,
              border: `1px solid ${t.ibr}`, borderRadius: 8,
              fontSize: 14, color: t.tx, outline: "none", boxSizing: "border-box"
            }}
          />
        </div>

        {/* Code */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: t.t3, marginBottom: 6 }}>초기 HTML 코드</div>
          <textarea
            value={code} onChange={e => setCode(e.target.value)}
            rows={4}
            style={{
              width: "100%", padding: "10px 12px", background: t.ib,
              border: `1px solid ${t.ibr}`, borderRadius: 8,
              fontSize: 12, color: t.gn, fontFamily: "monospace",
              outline: "none", resize: "vertical", boxSizing: "border-box"
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{
              padding: "10px 20px", fontSize: 13,
              border: `1px solid ${t.cb}`, background: "transparent",
              color: t.t3, cursor: "pointer", borderRadius: 8
            }}>
            취소
          </button>
          <button onClick={handleSubmit}
            style={{
              padding: "10px 20px", fontSize: 13, fontWeight: 600,
              border: `1px solid ${t.ac}`, background: t.abg,
              color: t.ac, cursor: "pointer", borderRadius: 8
            }}>
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
