import { useState } from "react";
import { saveSnapshot, PROTECTED_TAG } from "../utils/supabaseSync.js";

/**
 * 1시간 자동 스냅샷 제안 토스트
 * Props:
 *   t              — 테마 객체
 *   prompt         — { count, last_at, stats }
 *   supabaseConfig — { url, key }
 *   appData        — 저장할 데이터
 *   projects       — 프로젝트 배열
 *   onDone         — () => void (닫기)
 *   onSkipSession  — () => void (이 세션 묻지 않기)
 */
export default function AutoSnapPrompt({
  t, prompt, supabaseConfig, appData, projects = [], onDone, onSkipSession,
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [projectTag, setProjectTag] = useState("전체");

  const fmtDate = (iso) => {
    if (!iso) return "없음";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const now = new Date().toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const projectOptions = [
    { value: "전체", label: "전체" },
    ...projects.map((p) => ({ value: p.name, label: `${p.emoji || ""} ${p.name}` })),
    { value: PROTECTED_TAG, label: `🔒 ${PROTECTED_TAG}` },
  ];

  const handleSave = async () => {
    if (!supabaseConfig?.url || !supabaseConfig?.key) return;
    setSaving(true);
    try {
      await saveSnapshot(
        supabaseConfig.url,
        supabaseConfig.key,
        `자동 스냅샷 ${now}`,
        appData,
        projectTag,
      );
      setSaved(true);
      setTimeout(onDone, 1500);
    } catch {
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 400,
      width: 320, background: t.card, borderRadius: 14,
      border: `1px solid ${t.cb}`, boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
      padding: 16, display: "flex", flexDirection: "column", gap: 10,
    }}>
      {saved ? (
        <div style={{ textAlign: "center", color: "#5DCAA5", fontSize: 13, fontWeight: 600, padding: "8px 0" }}>
          ✓ 스냅샷 저장됨
        </div>
      ) : (<>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>🗄️ 스냅샷 저장할까요?</div>
            <div style={{ fontSize: 11, color: t.t3, marginTop: 3 }}>
              1시간이 지났습니다
            </div>
          </div>
          <button onClick={onDone} style={{ background: "none", border: "none", color: t.t3, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* 현재 통계 */}
        <div style={{
          background: t.ib, borderRadius: 8, padding: "8px 10px",
          fontSize: 11, color: t.t3, display: "flex", flexDirection: "column", gap: 3,
        }}>
          <div>
            전체 저장된 버전: <b style={{ color: t.tx }}>{prompt.count}개</b>
          </div>
          <div>
            마지막 스냅샷: <b style={{ color: t.tx }}>{fmtDate(prompt.last_at)}</b>
          </div>
        </div>

        {/* 프로젝트 선택 */}
        <div>
          <label style={{ fontSize: 11, color: t.t2, display: "block", marginBottom: 4 }}>저장 대상</label>
          <select
            value={projectTag}
            onChange={(e) => setProjectTag(e.target.value)}
            style={{
              width: "100%", padding: "6px 8px", fontSize: 12, color: t.tx,
              background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 6, outline: "none",
            }}
          >
            {projectOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: "8px 0", fontSize: 12, fontWeight: 600,
              border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer",
              background: t.ac, color: "#fff", opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "저장 중…" : "저장"}
          </button>
          <button
            onClick={onDone}
            style={{
              flex: 1, padding: "8px 0", fontSize: 12, border: "none",
              borderRadius: 8, cursor: "pointer", background: t.ib, color: t.t2,
            }}
          >
            나중에
          </button>
          <button
            onClick={onSkipSession}
            style={{
              flex: 1, padding: "8px 0", fontSize: 11, border: "none",
              borderRadius: 8, cursor: "pointer", background: t.ib, color: t.t3,
            }}
          >
            안 물어보기
          </button>
        </div>
      </>)}
    </div>
  );
}
