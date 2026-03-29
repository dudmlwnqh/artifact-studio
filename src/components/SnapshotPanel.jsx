import { useState, useEffect, useRef } from "react";
import {
  testConnection,
  listSnapshots,
  saveSnapshot,
  loadSnapshot,
  deleteSnapshot,
  getProjectStats,
  PROTECTED_TAG,
  MAX_PER_PROJECT,
} from "../utils/supabaseSync.js";

/**
 * Supabase 스냅샷 패널
 * Props:
 *   t            — 테마 객체
 *   config       — { url, key } | null
 *   onSaveConfig — (config) => void
 *   appData      — 현재 앱 데이터 (저장용)
 *   projects     — 프로젝트 배열 [{ id, name }] — 태그 빠른 선택용
 *   onRestore    — (data) => void
 *   onClose      — () => void
 */
export default function SnapshotPanel({
  t, config, onSaveConfig, appData, projects = [], onRestore, onClose,
}) {
  const [url, setUrl] = useState(config?.url || "");
  const [key, setKey] = useState(config?.key || "");
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [connOpen, setConnOpen] = useState(false); // 연결 섹션 펼침 여부 (오류/미연결 시 자동 펼침)

  // 저장용: 스냅샷 이름 + 프로젝트 태그
  const [label, setLabel] = useState("");
  const [tagInput, setTagInput] = useState("");          // 저장 시 붙일 태그
  const labelEditedRef = useRef(false);                  // 사용자가 직접 수정했는지

  // 필터용
  const [filterTag, setFilterTag] = useState(null);      // null = 전체
  const [allSnapshots, setAllSnapshots] = useState([]);  // 전체 목록 (태그 포함)
  const [stats, setStats] = useState([]);                // [{project_tag, count, last_at}]

  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [msg, setMsg] = useState({ text: "", ok: true });

  const cfg = { url: url.trim(), key: key.trim() };
  const ready = cfg.url && cfg.key && connected;

  // 필터 적용된 목록
  const snapshots = filterTag
    ? allSnapshots.filter((s) => s.project_tag === filterTag)
    : allSnapshots;

  // 기존 태그 목록 (stats에서 추출)
  const existingTags = stats.map((s) => s.project_tag).filter(Boolean);

  // 현재 저장용 태그의 통계
  const saveTag = tagInput.trim() || "전체";
  const curStat = stats.find((s) => s.project_tag === saveTag);
  const curCount = curStat?.count ?? 0;

  const inp = {
    width: "100%", padding: "8px 10px", fontSize: 12, color: t.tx,
    background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 6,
    outline: "none", fontFamily: "system-ui", boxSizing: "border-box",
  };
  const btn = (active, bg) => ({
    padding: "7px 14px", fontSize: 12, fontWeight: 600, border: "none",
    borderRadius: 6, cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.4, background: bg || t.ac, color: "#fff",
    flexShrink: 0,
  });

  useEffect(() => {
    if (config?.url && config?.key) {
      handleTest(config.url.trim(), config.key.trim(), true);
    } else {
      setConnOpen(true); // 설정 없으면 자동 펼침
    }
  }, []);

  // 태그 또는 통계 바뀔 때 자동 이름 생성 (사용자가 직접 수정하지 않은 경우만)
  useEffect(() => {
    if (!connected) return;
    if (labelEditedRef.current) return;
    const tag = tagInput.trim() || "전체";
    const stat = stats.find((s) => s.project_tag === tag);
    const n = (stat?.count ?? 0) + 1;
    const dateStr = new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
    setLabel(`${tag} v${n} · ${dateStr}`);
  }, [tagInput, stats, connected]);

  const refreshList = async (u = cfg.url, k = cfg.key) => {
    const [list, st] = await Promise.all([
      listSnapshots(u, k, null), // 전체 목록 가져옴
      getProjectStats(u, k),
    ]);
    setAllSnapshots(list);
    setStats(st);
  };

  const handleTest = async (u = cfg.url, k = cfg.key, silent = false) => {
    if (!u || !k) return;
    setTesting(true); setTestMsg("");
    try {
      await testConnection(u, k);
      setConnected(true);
      setConnOpen(false); // 연결 성공 → 접기
      if (!silent) { setTestMsg("✓ 연결 성공"); onSaveConfig({ url: u, key: k }); }
      await refreshList(u, k);
    } catch (e) {
      setConnected(false);
      setConnOpen(true); // 오류 → 자동 펼침
      setTestMsg("✗ " + e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!ready || !label.trim()) return;
    setSaving(true); setMsg({ text: "", ok: true });
    const tag = tagInput.trim() || "전체";
    try {
      await saveSnapshot(cfg.url, cfg.key, label.trim(), appData, tag);
      setLabel("");
      await refreshList();
      const pruned = tag !== PROTECTED_TAG && curCount >= MAX_PER_PROJECT;
      setMsg({ text: `✓ 저장 완료${pruned ? " (오래된 버전 자동 삭제됨)" : ""}`, ok: true });
    } catch (e) {
      setMsg({ text: "✗ " + e.message, ok: false });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (snap) => {
    if (!window.confirm(`"${snap.label}" 스냅샷으로 복원할까요?\n현재 데이터는 덮어써집니다.`)) return;
    setRestoring(snap.id); setMsg({ text: "", ok: true });
    try {
      const full = await loadSnapshot(cfg.url, cfg.key, snap.id);
      if (!full?.data) throw new Error("데이터 없음");
      onRestore(full.data);
      setMsg({ text: `✓ "${snap.label}" 복원 완료`, ok: true });
    } catch (e) {
      setMsg({ text: "✗ " + e.message, ok: false });
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (snap) => {
    if (!window.confirm(`"${snap.label}" 스냅샷을 삭제할까요?`)) return;
    setDeleting(snap.id);
    try {
      await deleteSnapshot(cfg.url, cfg.key, snap.id);
      setAllSnapshots((s) => s.filter((x) => x.id !== snap.id));
      setStats((st) => st.map((s) =>
        s.project_tag === snap.project_tag ? { ...s, count: s.count - 1 } : s
      ));
    } catch (e) {
      setMsg({ text: "✗ " + e.message, ok: false });
    } finally {
      setDeleting(null);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "방금";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const SQL = `-- 처음 설정하는 경우
create table public.snapshots (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  label text not null,
  project_tag text not null default '전체',
  data jsonb not null
);
alter table public.snapshots enable row level security;
create policy "anon_all" on public.snapshots
  for all to anon using (true) with check (true);

-- 이미 테이블이 있으면 이것만 실행
-- alter table public.snapshots
--   add column if not exists project_tag text not null default '전체';`;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 560, maxHeight: "92vh", overflowY: "auto",
        background: t.card, borderRadius: 16, padding: 28,
        border: `1px solid ${t.cb}`, display: "flex", flexDirection: "column", gap: 16,
      }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: t.tx }}>🗄️ Supabase 스냅샷</h3>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: t.t3 }}>
              태그별 최대 {MAX_PER_PROJECT}개 보존 · <b style={{ color: t.t2 }}>"{PROTECTED_TAG}"</b> 태그는 자동 삭제 제외
            </p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.t3, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        {/* 연결 설정 — 연결 성공 시 접힘, 오류/미연결 시 자동 펼침 */}
        <div style={{ background: t.ib, borderRadius: 10, border: `1px solid ${connected ? t.ibr : "#F4433644"}` }}>
          {/* 헤더 (항상 표시) */}
          <div
            onClick={() => setConnOpen((o) => !o)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", cursor: "pointer" }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: connected ? "#5DCAA5" : "#F44336" }}>
              {connected ? "✓ Supabase 연결됨" : "✗ Supabase 미연결"}
            </span>
            {connected && url && (
              <span style={{ fontSize: 10, color: t.t3, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {url.replace("https://", "").replace(".supabase.co", "")}
              </span>
            )}
            <span style={{ fontSize: 11, color: t.t3, marginLeft: "auto" }}>{connOpen ? "▲" : "▼"}</span>
          </div>
          {/* 접힌 내용 */}
          {connOpen && (
            <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${t.ibr}` }}>
              <div style={{ marginBottom: 8, marginTop: 10 }}>
                <label style={{ fontSize: 11, color: t.t3, display: "block", marginBottom: 4 }}>Project URL</label>
                <input value={url} onChange={(e) => { setUrl(e.target.value); setConnected(false); }}
                  placeholder="https://xxxxxxxxxxxx.supabase.co" style={inp} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: t.t3, display: "block", marginBottom: 4 }}>Anon (public) Key</label>
                <input type="password" value={key} onChange={(e) => { setKey(e.target.value); setConnected(false); }}
                  placeholder="eyJhbGci..." style={inp} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => handleTest()} disabled={!url.trim() || !key.trim() || testing}
                  style={btn(!!url.trim() && !!key.trim() && !testing)}>
                  {testing ? "확인 중…" : "연결 테스트"}
                </button>
                {testMsg && (
                  <span style={{ fontSize: 11, color: testMsg.startsWith("✓") ? "#5DCAA5" : "#F44336" }}>
                    {testMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SQL 안내 (미연결 시) */}
        {!connected && (
          <div style={{ padding: "10px 14px", background: t.abg, borderRadius: 8, fontSize: 10, color: t.t3, lineHeight: 1.8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <b style={{ color: t.t2, fontSize: 11 }}>Supabase SQL Editor에서 실행</b>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => { navigator.clipboard.writeText(SQL); }}
                  style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: `1px solid ${t.ibr}`, background: t.ib, color: t.t2, cursor: "pointer" }}
                >
                  SQL 복사
                </button>
                {url.trim() && (
                  <a
                    href={`https://supabase.com/dashboard/project/${url.trim().replace("https://", "").replace(".supabase.co", "")}/sql/new`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "none", background: "#3ECF8E", color: "#fff", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                  >
                    SQL Editor 열기 ↗
                  </a>
                )}
              </div>
            </div>
            <pre style={{
              margin: 0, padding: "8px 10px", background: t.ib,
              borderRadius: 6, fontSize: 10, color: t.t2,
              whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}>{SQL}</pre>
          </div>
        )}

        {connected && (<>
          {/* 저장 */}
          <div style={{ background: t.ib, borderRadius: 10, padding: 14, border: `1px solid ${t.ibr}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.t2, marginBottom: 10 }}>지금 저장</div>

            {/* 스냅샷 이름 */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: t.t3, display: "block", marginBottom: 4 }}>
                스냅샷 이름
                {labelEditedRef.current && (
                  <button
                    onClick={() => { labelEditedRef.current = false; setTagInput(v => v); }}
                    style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 4, border: `1px solid ${t.ibr}`, background: t.ib, color: t.t3, cursor: "pointer" }}
                  >↺ 자동 생성</button>
                )}
              </label>
              <input
                value={label}
                onChange={(e) => { labelEditedRef.current = true; setLabel(e.target.value); }}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="자동 생성됩니다"
                style={inp}
              />
            </div>

            {/* 프로젝트 태그 선택 */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: t.t3, display: "block", marginBottom: 6 }}>
                프로젝트 태그 <span style={{ fontWeight: 400 }}>(선택 — 비워두면 "전체")</span>
              </label>
              {/* 등록된 프로젝트 → 버튼으로 바로 선택 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                <button
                  onClick={() => setTagInput("")}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 8,
                    border: `1px solid ${!tagInput ? t.ac : t.ibr}`,
                    background: !tagInput ? t.ac + "22" : t.ib,
                    color: !tagInput ? t.ac : t.t3, cursor: "pointer",
                  }}
                >전체</button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setTagInput(tagInput === p.name ? "" : p.name)}
                    style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 8,
                      border: `1px solid ${tagInput === p.name ? t.ac : t.ibr}`,
                      background: tagInput === p.name ? t.ac + "22" : t.ib,
                      color: tagInput === p.name ? t.ac : t.t2, cursor: "pointer",
                    }}
                  >
                    {p.name}
                  </button>
                ))}
                {existingTags.filter((tag) => !projects.some((p) => p.name === tag) && tag !== PROTECTED_TAG).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTagInput(tagInput === tag ? "" : tag)}
                    style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 8,
                      border: `1px solid ${tagInput === tag ? t.ac : t.ibr}`,
                      background: tagInput === tag ? t.ac + "22" : t.ib,
                      color: tagInput === tag ? t.ac : t.t3, cursor: "pointer",
                    }}
                  >#{tag}</button>
                ))}
                <button
                  onClick={() => setTagInput(PROTECTED_TAG)}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 8,
                    border: `1px solid ${tagInput === PROTECTED_TAG ? "#5DCAA5" : t.ibr}`,
                    background: tagInput === PROTECTED_TAG ? "#5DCAA522" : t.ib,
                    color: tagInput === PROTECTED_TAG ? "#5DCAA5" : t.t3, cursor: "pointer",
                  }}
                >🔒 {PROTECTED_TAG}</button>
              </div>
              {/* 직접 입력 (프로젝트 외 커스텀 태그) */}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="또는 직접 입력…"
                style={{ ...inp, fontSize: 11 }}
              />
              {/* 현재 태그의 저장 수 표시 */}
              {saveTag !== "전체" && (
                <div style={{ marginTop: 5, fontSize: 11, color: curCount >= MAX_PER_PROJECT && saveTag !== PROTECTED_TAG ? "#FF9500" : t.t3 }}>
                  {saveTag === PROTECTED_TAG
                    ? "🔒 자동 삭제 제외 — 무제한 보존"
                    : curCount >= MAX_PER_PROJECT
                      ? `⚠️ "${saveTag}" 한도 도달 (${curCount}개) — 저장 시 가장 오래된 버전 자동 삭제`
                      : `"${saveTag}" 태그: 현재 ${curCount}개 / 최대 ${MAX_PER_PROJECT}개`}
                </div>
              )}
            </div>

            <button onClick={handleSave} disabled={!label.trim() || saving}
              style={{ ...btn(!!label.trim() && !saving), width: "100%" }}>
              {saving ? "저장 중…" : "💾 저장"}
            </button>
          </div>

          {/* 상태 메시지 */}
          {msg.text && (
            <div style={{
              padding: "7px 12px", borderRadius: 6, fontSize: 11,
              background: msg.ok ? "#5DCAA522" : "#F4433622",
              color: msg.ok ? "#5DCAA5" : "#F44336",
            }}>
              {msg.text}
            </div>
          )}

          {/* 스냅샷 목록 */}
          <div>
            {/* 태그 필터 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.t2, marginBottom: 8 }}>
                저장된 스냅샷 ({snapshots.length}{filterTag ? ` — #${filterTag}` : " — 전체"})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                <button
                  onClick={() => setFilterTag(null)}
                  style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 12,
                    border: `1px solid ${filterTag === null ? t.ac : t.ibr}`,
                    background: filterTag === null ? t.ac + "22" : "transparent",
                    color: filterTag === null ? t.ac : t.t3,
                    cursor: "pointer",
                  }}
                >
                  전체 ({allSnapshots.length})
                </button>
                {stats.map((s) => (
                  <button
                    key={s.project_tag}
                    onClick={() => setFilterTag(filterTag === s.project_tag ? null : s.project_tag)}
                    style={{
                      fontSize: 11, padding: "3px 10px", borderRadius: 12,
                      border: `1px solid ${filterTag === s.project_tag ? t.ac : t.ibr}`,
                      background: filterTag === s.project_tag ? t.ac + "22" : "transparent",
                      color: filterTag === s.project_tag ? t.ac : t.t3,
                      cursor: "pointer",
                    }}
                  >
                    {s.project_tag === PROTECTED_TAG ? "🔒" : "#"}{s.project_tag} ({s.count})
                  </button>
                ))}
              </div>
            </div>

            {snapshots.length === 0 ? (
              <div style={{ fontSize: 11, color: t.t3, padding: "8px 0" }}>
                {filterTag ? `"${filterTag}" 태그의 스냅샷이 없습니다.` : "저장된 스냅샷이 없습니다."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {snapshots.map((s) => (
                  <div key={s.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 12px", background: t.ib, borderRadius: 8,
                    border: `1px solid ${t.ibr}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 10, color: t.t3, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span>{fmtDate(s.created_at)}</span>
                        {s.project_tag && s.project_tag !== "전체" && (
                          <span style={{ color: s.project_tag === PROTECTED_TAG ? "#5DCAA5" : t.ac }}>
                            {s.project_tag === PROTECTED_TAG ? `🔒 ${s.project_tag}` : `#${s.project_tag}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleRestore(s)} disabled={restoring === s.id}
                      style={{ ...btn(restoring !== s.id, "#5DCAA5"), padding: "5px 10px", fontSize: 11 }}>
                      {restoring === s.id ? "복원 중…" : "↩ 복원"}
                    </button>
                    <button onClick={() => handleDelete(s)} disabled={deleting === s.id}
                      style={{ ...btn(deleting !== s.id, "#F44336"), padding: "5px 10px", fontSize: 11 }}>
                      {deleting === s.id ? "…" : "삭제"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>)}

        <button onClick={onClose} style={{ ...btn(true, t.ibr), color: t.t2, width: "100%" }}>닫기</button>
      </div>
    </div>
  );
}
