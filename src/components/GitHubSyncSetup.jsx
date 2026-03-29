import { useState } from "react";
import { validateToken, listBranches } from "../utils/githubApi.js";
import { loadFromGitHub, saveToGitHub } from "../utils/githubDataSync.js";

/**
 * GitHub 데이터베이스 연동 설정 패널
 * Props:
 *   t           — 테마 객체
 *   config      — { token, repo, branch, enabled } 현재 설정
 *   onSave      — (newConfig) => void
 *   onClose     — () => void
 *   onPull      — (data) => void  GitHub → 앱 데이터 반영
 *   appData     — { projects, sources, uiComponents, tokenSets }  (Push용)
 *   dataSha     — 현재 파일 SHA
 *   onShaUpdate — (newSha) => void
 */
export default function GitHubSyncSetup({
  t, config, onSave, onClose, onPull, appData, dataSha, onShaUpdate
}) {
  const [token, setToken] = useState(config?.token || "");
  const [repo, setRepo] = useState(config?.repo || "");
  const [branch, setBranch] = useState(config?.branch || "main");
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [branches, setBranches] = useState([]);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | validating | pulling | pushing | ok | error
  const [msg, setMsg] = useState("");

  const inp = {
    width: "100%", padding: "8px 10px", fontSize: 12, color: t.tx,
    background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 6,
    outline: "none", fontFamily: "monospace",
  };
  const btn = (active, bg) => ({
    padding: "8px 14px", fontSize: 12, fontWeight: 600, border: "none",
    borderRadius: 6, cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.45, background: bg || t.ac, color: "#fff",
  });

  const handleValidate = async () => {
    if (!token.trim()) return;
    setStatus("validating"); setMsg("");
    try {
      const u = await validateToken(token.trim());
      if (u) {
        setUser(u);
        if (repo.trim()) {
          try {
            const br = await listBranches(token.trim(), repo.trim());
            setBranches(br);
          } catch { setBranches([]); }
        }
        setStatus("ok"); setMsg("토큰 확인 완료");
      } else {
        setStatus("error"); setMsg("유효하지 않은 토큰");
      }
    } catch (e) {
      setStatus("error"); setMsg(e.message);
    }
  };

  const handleRepoChange = async (v) => {
    setRepo(v);
    if (token && v.includes("/")) {
      try {
        const br = await listBranches(token.trim(), v.trim());
        setBranches(br);
      } catch { setBranches([]); }
    }
  };

  const handleSave = () => {
    onSave({ token: token.trim(), repo: repo.trim(), branch, enabled });
    onClose();
  };

  const handlePull = async () => {
    if (!token || !repo) return;
    setStatus("pulling"); setMsg("");
    try {
      const result = await loadFromGitHub(token.trim(), repo.trim(), branch);
      if (!result) { setStatus("error"); setMsg("artifact-studio-data.json 파일을 찾을 수 없습니다"); return; }
      onPull(result.data);
      onShaUpdate(result.sha);
      setStatus("ok"); setMsg("Pull 완료 — 앱 데이터가 GitHub 버전으로 복원되었습니다");
    } catch (e) {
      setStatus("error"); setMsg("Pull 실패: " + e.message);
    }
  };

  const handlePush = async () => {
    if (!token || !repo || !appData) return;
    setStatus("pushing"); setMsg("");
    try {
      const newSha = await saveToGitHub(token.trim(), repo.trim(), branch, appData, dataSha);
      onShaUpdate(newSha);
      setStatus("ok"); setMsg("Push 완료 — 현재 앱 데이터를 GitHub에 저장했습니다");
    } catch (e) {
      setStatus("error"); setMsg("Push 실패: " + e.message);
    }
  };

  const busy = status === "validating" || status === "pulling" || status === "pushing";

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 500, maxHeight: "90vh", overflowY: "auto",
        background: t.card, borderRadius: 16, padding: 28,
        border: `1px solid ${t.cb}`,
      }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: t.tx }}>GitHub 데이터베이스 연동</h3>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: t.t3 }}>
              앱 데이터 전체를 GitHub 레포에 자동 저장합니다
            </p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.t3, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        {/* 자동 저장 토글 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", background: t.abg, borderRadius: 10, marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>자동 저장 활성화</div>
            <div style={{ fontSize: 11, color: t.t3, marginTop: 2 }}>
              데이터 변경 5초 후 GitHub에 자동 커밋
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            style={{
              width: 44, height: 24, borderRadius: 12, cursor: "pointer",
              background: enabled ? t.ac : t.ibr, position: "relative", transition: "background 0.2s",
              border: "none", padding: 0, flexShrink: 0,
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: 10, background: "#fff",
              position: "absolute", top: 2, left: enabled ? 22 : 2, transition: "left 0.2s",
            }} />
          </button>
        </div>

        {/* 토큰 */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: t.t2, display: "block", marginBottom: 4 }}>
            GitHub Personal Access Token
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="password" value={token} onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              style={{ ...inp, flex: 1 }}
            />
            <button
              onClick={handleValidate}
              disabled={!token.trim() || busy}
              style={btn(!!token.trim() && !busy)}
            >
              {status === "validating" ? "확인 중..." : "확인"}
            </button>
          </div>
          {user && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#5DCAA5" }}>
              ✓ {user.login} ({user.name || "이름 없음"})
            </div>
          )}
        </div>

        {/* 레포 */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: t.t2, display: "block", marginBottom: 4 }}>
            레포지토리 (owner/repo)
          </label>
          <input
            value={repo} onChange={e => handleRepoChange(e.target.value)}
            placeholder="your-name/artifact-studio-data"
            style={inp}
          />
          <div style={{ fontSize: 10, color: t.t3, marginTop: 4 }}>
            artifact-studio-data.json 파일이 이 레포에 저장됩니다
          </div>
        </div>

        {/* 브랜치 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: t.t2, display: "block", marginBottom: 4 }}>브랜치</label>
          {branches.length > 0 ? (
            <select value={branch} onChange={e => setBranch(e.target.value)} style={{ ...inp, fontFamily: "system-ui" }}>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          ) : (
            <input value={branch} onChange={e => setBranch(e.target.value)} style={inp} />
          )}
        </div>

        {/* 수동 동기화 버튼 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={handlePush}
            disabled={!token || !repo || busy}
            style={{ ...btn(!!token && !!repo && !busy, t.ac), flex: 1 }}
          >
            {status === "pushing" ? "저장 중..." : "↑ 지금 Push (앱 → GitHub)"}
          </button>
          <button
            onClick={handlePull}
            disabled={!token || !repo || busy}
            style={{ ...btn(!!token && !!repo && !busy, "#5DCAA5"), flex: 1 }}
          >
            {status === "pulling" ? "불러오는 중..." : "↓ 지금 Pull (GitHub → 앱)"}
          </button>
        </div>

        {/* 상태 메시지 */}
        {msg && (
          <div style={{
            padding: "8px 12px", borderRadius: 6, marginBottom: 14, fontSize: 11,
            background: status === "error" ? "#F4433622" : "#5DCAA522",
            color: status === "error" ? "#F44336" : "#5DCAA5",
          }}>
            {msg}
          </div>
        )}

        {/* 안내 */}
        <div style={{
          padding: "12px 14px", background: t.ib, borderRadius: 8,
          border: `1px solid ${t.ibr}`, marginBottom: 20,
          fontSize: 10, color: t.t3, lineHeight: 1.7,
        }}>
          <b style={{ color: t.t2 }}>저장되는 데이터</b><br />
          프로젝트, 소스/코드, UI 컴포넌트, 디자인 토큰 세트 전체<br />
          <b style={{ color: t.t2 }}>PAT 권한</b>: repo (Full control of private repositories)<br />
          <b style={{ color: t.t2 }}>브라우저 캐시를 지워도</b> GitHub에서 Pull하면 즉시 복구됩니다
        </div>

        {/* 저장 버튼 */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ ...btn(true, t.ibr), color: t.t2, flex: 1 }}>취소</button>
          <button onClick={handleSave} style={{ ...btn(true), flex: 2 }}>설정 저장</button>
        </div>
      </div>
    </div>
  );
}
