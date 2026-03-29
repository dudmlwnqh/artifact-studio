import { useState, useEffect } from "react";
import { validateToken, listBranches, getFile, commitMultipleFiles } from "../utils/githubApi.js";
import { generateTokenFiles } from "../utils/tokenFileGenerator.js";

export default function GitHubConnector({ t, tokenSet, onClose, onSyncComplete }) {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem("githubToken") || ""; } catch { return ""; }
  });
  const [repo, setRepo] = useState(tokenSet?.github?.repo || "");
  const [branch, setBranch] = useState(tokenSet?.github?.branch || "main");
  const [path, setPath] = useState(tokenSet?.github?.path || "src/tokens/");
  const [branches, setBranches] = useState([]);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | validating | valid | error | pushing | pulling | done
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // 토큰 저장
  useEffect(() => {
    if (token) {
      try { localStorage.setItem("githubToken", token); } catch {}
    }
  }, [token]);

  // 토큰 유효성 검사
  const handleValidate = async () => {
    if (!token.trim()) return;
    setStatus("validating");
    setError("");
    try {
      const result = await validateToken(token.trim());
      if (result) {
        setUser(result);
        setStatus("valid");
        if (repo.trim()) {
          const brList = await listBranches(token.trim(), repo.trim());
          setBranches(brList);
        }
      } else {
        setStatus("error");
        setError("토큰이 유효하지 않습니다");
      }
    } catch (e) {
      setStatus("error");
      setError(e.message);
    }
  };

  // 레포 변경 시 브랜치 목록 갱신
  const handleRepoChange = async (newRepo) => {
    setRepo(newRepo);
    if (token && newRepo.includes("/")) {
      try {
        const brList = await listBranches(token.trim(), newRepo.trim());
        setBranches(brList);
      } catch { setBranches([]); }
    }
  };

  // Push: 토큰 세트 → GitHub
  const handlePush = async () => {
    if (!token || !repo || !tokenSet) return;
    setStatus("pushing");
    setError("");
    try {
      const files = generateTokenFiles(tokenSet);
      const commitFiles = Object.entries(files).map(([name, f]) => ({
        path: (path.endsWith("/") ? path : path + "/") + name,
        content: f.code,
      }));

      const commitMsg = `토큰 업데이트: ${tokenSet.name}`;
      await commitMultipleFiles(token.trim(), repo.trim(), commitFiles, commitMsg, branch);
      setStatus("done");
      setMessage("Push 완료! 4개 파일이 커밋되었습니다.");

      if (onSyncComplete) {
        onSyncComplete({
          github: { repo: repo.trim(), branch, path, lastSyncAt: Date.now() },
        });
      }
    } catch (e) {
      setStatus("error");
      setError("Push 실패: " + e.message);
    }
  };

  // Pull: GitHub → 토큰 세트
  const handlePull = async () => {
    if (!token || !repo) return;
    setStatus("pulling");
    setError("");
    try {
      const basePath = path.endsWith("/") ? path : path + "/";
      const colorsFile = await getFile(token.trim(), repo.trim(), basePath + "colors.js", branch);

      if (!colorsFile) {
        setStatus("error");
        setError("colors.js 파일을 찾을 수 없습니다");
        return;
      }

      // colors.js에서 JSON 추출 시도
      const colorsMatch = colorsFile.content.match(/export const colors = ({[\s\S]*?});/);
      if (colorsMatch) {
        try {
          const parsed = JSON.parse(colorsMatch[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
          setStatus("done");
          setMessage("Pull 완료! colors.js에서 색상을 가져왔습니다.");
          if (onSyncComplete) {
            onSyncComplete({
              colors: parsed,
              github: { repo: repo.trim(), branch, path, lastSyncAt: Date.now() },
            });
          }
        } catch {
          setStatus("done");
          setMessage("Pull 완료! (색상 자동 파싱 실패 — 파일 내용을 수동 확인하세요)");
        }
      } else {
        setStatus("done");
        setMessage("Pull 완료! (colors 변수를 찾을 수 없음)");
      }
    } catch (e) {
      setStatus("error");
      setError("Pull 실패: " + e.message);
    }
  };

  const inputStyle = {
    width: "100%", padding: "8px 10px", fontSize: 12, color: t.tx,
    background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 6, outline: "none",
    fontFamily: "monospace",
  };

  const btnStyle = (active) => ({
    padding: "8px 16px", fontSize: 12, fontWeight: 600, border: "none",
    borderRadius: 6, cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.5,
  });

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480, maxHeight: "85vh", overflow: "auto",
        background: t.card, borderRadius: 14, padding: 24, border: `1px solid ${t.cb}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: t.tx }}>GitHub 동기화</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: t.t3, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        {/* 토큰 세트 이름 */}
        <div style={{ padding: "8px 12px", background: t.abg, borderRadius: 8, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {["brand", "bg", "text", "success", "error"].map((k) => (
              <div key={k} style={{ width: 14, height: 14, borderRadius: 3, background: tokenSet?.colors?.[k] || "#333" }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: t.tx, fontWeight: 500 }}>{tokenSet?.name || "토큰 세트"}</span>
        </div>

        {/* PAT 입력 */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: t.t2, display: "block", marginBottom: 4 }}>Personal Access Token</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="password" value={token} onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={handleValidate} disabled={!token.trim()} style={{ ...btnStyle(!!token.trim()), background: t.ac, color: "#fff" }}>
              {status === "validating" ? "..." : "확인"}
            </button>
          </div>
          {user && (
            <div style={{ marginTop: 6, fontSize: 11, color: t.gn, display: "flex", alignItems: "center", gap: 4 }}>
              <span>✓</span> {user.login} ({user.name || "이름 없음"})
            </div>
          )}
        </div>

        {/* 레포 / 브랜치 / 경로 */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: t.t2, display: "block", marginBottom: 4 }}>레포지토리 (owner/repo)</label>
          <input
            value={repo} onChange={(e) => handleRepoChange(e.target.value)}
            placeholder="dudmlwnqh/artifact-studio"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: t.t2, display: "block", marginBottom: 4 }}>브랜치</label>
            {branches.length > 0 ? (
              <select value={branch} onChange={(e) => setBranch(e.target.value)} style={{ ...inputStyle, fontFamily: "system-ui" }}>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            ) : (
              <input value={branch} onChange={(e) => setBranch(e.target.value)} style={inputStyle} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: t.t2, display: "block", marginBottom: 4 }}>파일 경로</label>
            <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="src/tokens/" style={inputStyle} />
          </div>
        </div>

        {/* 동기화 버튼 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={handlePush}
            disabled={!token || !repo || status === "pushing"}
            style={{ ...btnStyle(!!token && !!repo && status !== "pushing"), flex: 1, background: t.ac, color: "#fff" }}
          >
            {status === "pushing" ? "Pushing..." : "↑ Push (GitHub에 커밋)"}
          </button>
          <button
            onClick={handlePull}
            disabled={!token || !repo || status === "pulling"}
            style={{ ...btnStyle(!!token && !!repo && status !== "pulling"), flex: 1, background: t.gn, color: "#fff" }}
          >
            {status === "pulling" ? "Pulling..." : "↓ Pull (GitHub에서 불러오기)"}
          </button>
        </div>

        {/* 상태 메시지 */}
        {error && (
          <div style={{ padding: "8px 12px", background: "#F4433622", borderRadius: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#F44336" }}>{error}</span>
          </div>
        )}
        {message && (
          <div style={{ padding: "8px 12px", background: t.gn + "22", borderRadius: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: t.gn }}>{message}</span>
          </div>
        )}

        {/* 동기화 정보 */}
        {tokenSet?.github?.lastSyncAt && (
          <div style={{ fontSize: 10, color: t.t3, textAlign: "center" }}>
            마지막 동기화: {new Date(tokenSet.github.lastSyncAt).toLocaleString("ko-KR")}
          </div>
        )}

        {/* 안내 */}
        <div style={{ marginTop: 12, padding: "10px 12px", background: t.ib, borderRadius: 6, border: `1px solid ${t.ibr}` }}>
          <div style={{ fontSize: 10, color: t.t3, lineHeight: 1.6 }}>
            <b>Push</b>: colors.js, typography.js, spacing.js, theme.js → GitHub 커밋<br />
            <b>Pull</b>: GitHub의 colors.js → 토큰 세트 색상 업데이트<br />
            <b>PAT 권한</b>: repo (Full control of private repositories)
          </div>
        </div>
      </div>
    </div>
  );
}
