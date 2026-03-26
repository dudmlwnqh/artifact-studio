import { useState } from "react";

const CATEGORIES = ["전체","버튼","입력필드","카드","리스트","모달","내비게이션","배지/태그","토글"];

const INIT_COMPONENTS = [
  // 버튼
  { id:"comp1", name:"Primary 버튼", cat:"버튼", tags:["코어"], code:'<button style="width:100%;padding:14px 0;background:#7C6AFF;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Primary 버튼</button>' },
  { id:"comp2", name:"Secondary 버튼", cat:"버튼", tags:["코어"], code:'<button style="width:100%;padding:14px 0;background:transparent;color:#333;border:1px solid #ddd;border-radius:8px;font-size:15px;font-weight:500;cursor:pointer">Secondary 버튼</button>' },
  { id:"comp3", name:"삭제 버튼", cat:"버튼", tags:["위험"], code:'<div style="display:flex;gap:8px"><button style="flex:1;padding:12px 0;background:#FF4757;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">삭제</button><button style="flex:1;padding:12px 0;background:#f0f0f0;color:#666;border:none;border-radius:8px;font-size:14px;cursor:pointer">취소</button></div>' },
  // 입력 필드
  { id:"comp4", name:"이메일 입력", cat:"입력필드", tags:["폼"], code:'<div><label style="display:block;font-size:13px;color:#333;margin-bottom:6px">이메일</label><input style="width:100%;padding:12px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box" placeholder="user@example.com"/></div>' },
  { id:"comp5", name:"비밀번호 입력", cat:"입력필드", tags:["폼"], code:'<div><label style="display:block;font-size:13px;color:#333;margin-bottom:6px">비밀번호</label><input type="password" style="width:100%;padding:12px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none;box-sizing:border-box" value="password123"/></div>' },
  { id:"comp6", name:"메모 입력", cat:"입력필드", tags:["폼"], code:'<div><label style="display:block;font-size:13px;color:#333;margin-bottom:6px">메모</label><textarea style="width:100%;padding:12px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;outline:none;resize:vertical;min-height:80px;box-sizing:border-box;font-family:inherit" placeholder="여기에 입력..."></textarea></div>' },
  // 카드
  { id:"comp7", name:"카드 (Card)", cat:"카드", tags:["레이아웃"], code:'<div style="border:1px solid #eee;border-radius:12px;overflow:hidden;background:#fff"><div style="height:120px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px">이미지 영역</div><div style="padding:16px"><div style="font-size:16px;font-weight:600;color:#111;margin-bottom:4px">카드 제목</div><div style="font-size:13px;color:#888;margin-bottom:12px">설명 텍스트가 여기에 들어갑니다.</div><div style="display:flex;justify-content:space-between;align-items:center"><a style="font-size:13px;color:#7C6AFF;text-decoration:none;cursor:pointer">더보기</a><span style="font-size:11px;color:#bbb">3분 전</span></div></div></div>' },
  // 리스트
  { id:"comp8", name:"리스트 아이템", cat:"리스트", tags:["데이터"], code:'<div style="display:flex;flex-direction:column;gap:1px;background:#f0f0f0;border-radius:10px;overflow:hidden"><div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff"><div style="width:36px;height:36px;border-radius:18px;background:#7C6AFF;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:600;flex-shrink:0">김</div><div style="flex:1"><div style="font-size:14px;font-weight:500;color:#111">김지수</div><div style="font-size:12px;color:#999">디자이너</div></div><span style="color:#ccc;font-size:16px">›</span></div><div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff"><div style="width:36px;height:36px;border-radius:18px;background:#5DCAA5;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:600;flex-shrink:0">박</div><div style="flex:1"><div style="font-size:14px;font-weight:500;color:#111">박민수</div><div style="font-size:12px;color:#999">개발자</div></div><span style="color:#ccc;font-size:16px">›</span></div><div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff"><div style="width:36px;height:36px;border-radius:18px;background:#EF9F27;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:600;flex-shrink:0">이</div><div style="flex:1"><div style="font-size:14px;font-weight:500;color:#111">이하은</div><div style="font-size:12px;color:#999">PM</div></div><span style="color:#ccc;font-size:16px">›</span></div></div>' },
  // 모달
  { id:"comp9", name:"삭제 확인 모달", cat:"모달", tags:["인터랙션"], code:'<div style="background:rgba(0,0,0,0.4);padding:40px 20px;border-radius:12px;display:flex;align-items:center;justify-content:center"><div style="background:#fff;border-radius:14px;padding:24px;width:280px;text-align:center"><div style="font-size:17px;font-weight:600;color:#111;margin-bottom:6px">삭제하시겠습니까?</div><div style="font-size:13px;color:#888;margin-bottom:20px">이 작업은 되돌릴 수 없습니다.</div><div style="display:flex;gap:8px"><button style="flex:1;padding:12px 0;background:#f5f5f5;color:#333;border:none;border-radius:8px;font-size:14px;cursor:pointer">취소</button><button style="flex:1;padding:12px 0;background:#FF4757;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">삭제</button></div></div></div>' },
  // 내비게이션
  { id:"comp10", name:"상단 헤더 바", cat:"내비게이션", tags:["레이아웃"], code:'<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;border-bottom:1px solid #eee"><span style="font-size:18px;font-weight:700;color:#111">MyApp</span><div style="display:flex;gap:16px"><span style="font-size:13px;color:#7C6AFF;font-weight:500;cursor:pointer">홈</span><span style="font-size:13px;color:#888;cursor:pointer">검색</span><span style="font-size:13px;color:#888;cursor:pointer">설정</span></div></div>' },
  { id:"comp11", name:"하단 탭바", cat:"내비게이션", tags:["레이아웃"], code:'<div style="display:flex;background:#fff;border-top:1px solid #eee;padding:8px 0"><div style="flex:1;text-align:center;cursor:pointer"><div style="width:24px;height:24px;background:#7C6AFF;border-radius:6px;margin:0 auto 4px"></div><div style="font-size:10px;color:#7C6AFF;font-weight:500">홈</div></div><div style="flex:1;text-align:center;cursor:pointer"><div style="width:24px;height:24px;background:#ddd;border-radius:6px;margin:0 auto 4px"></div><div style="font-size:10px;color:#999">검색</div></div><div style="flex:1;text-align:center;cursor:pointer"><div style="width:24px;height:24px;background:#ddd;border-radius:6px;margin:0 auto 4px"></div><div style="font-size:10px;color:#999">내 정보</div></div></div>' },
  // 배지/태그
  { id:"comp12", name:"상태 배지", cat:"배지/태그", tags:["상태"], code:'<div style="display:flex;gap:6px;flex-wrap:wrap"><span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:500;background:#E8F5E9;color:#2E7D32">완료</span><span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:500;background:#E3F2FD;color:#1565C0">진행중</span><span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:500;background:#FFEBEE;color:#C62828">긴급</span><span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:500;background:#F3E5F5;color:#7B1FA2">검토중</span></div>' },
  { id:"comp13", name:"기술 태그", cat:"배지/태그", tags:["기술"], code:'<div style="display:flex;gap:6px;flex-wrap:wrap"><span style="padding:4px 12px;border-radius:6px;font-size:12px;border:1px solid #ddd;color:#555">React</span><span style="padding:4px 12px;border-radius:6px;font-size:12px;border:1px solid #ddd;color:#555">TypeScript</span><span style="padding:4px 12px;border-radius:6px;font-size:12px;border:1px solid #ddd;color:#555">Tailwind</span></div>' },
  // 토글/체크박스
  { id:"comp14", name:"토글 스위치", cat:"토글", tags:["설정"], code:'<div style="display:flex;flex-direction:column;gap:16px"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;color:#111">알림 받기</span><div style="width:44px;height:24px;border-radius:12px;background:#7C6AFF;position:relative;cursor:pointer"><div style="width:20px;height:20px;border-radius:10px;background:#fff;position:absolute;top:2px;right:2px;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div></div></div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;color:#111">다크 모드</span><div style="width:44px;height:24px;border-radius:12px;background:#ddd;position:relative;cursor:pointer"><div style="width:20px;height:20px;border-radius:10px;background:#fff;position:absolute;top:2px;left:2px;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div></div></div></div>' },
  { id:"comp15", name:"체크박스", cat:"토글", tags:["폼"], code:'<div style="display:flex;flex-direction:column;gap:12px"><label style="display:flex;align-items:center;gap:10px;cursor:pointer"><div style="width:20px;height:20px;border-radius:4px;background:#7C6AFF;display:flex;align-items:center;justify-content:center"><span style="color:#fff;font-size:12px">✓</span></div><span style="font-size:14px;color:#111">이용약관 동의</span></label><label style="display:flex;align-items:center;gap:10px;cursor:pointer"><div style="width:20px;height:20px;border-radius:4px;border:1.5px solid #ddd"></div><span style="font-size:14px;color:#111">마케팅 수신 동의</span></label></div>' },
];

export default function ComponentTab({ components: compsProp, setComponents: setCompsProp, search, t }) {
  const [localComps, setLocalComps] = useState(compsProp || INIT_COMPONENTS);
  const [cat, setCat] = useState("전체");
  const [viewMode, setViewMode] = useState("card");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState("버튼");
  const [newCode, setNewCode] = useState("");

  const comps = localComps;
  const lc = (search || "").toLowerCase();

  const filtered = comps.filter(c => {
    if (cat !== "전체" && c.cat !== cat) return false;
    if (lc && !c.name.toLowerCase().includes(lc) && !c.cat.toLowerCase().includes(lc) && !c.tags.some(t => t.toLowerCase().includes(lc))) return false;
    return true;
  });

  const catCounts = {};
  CATEGORIES.forEach(c => { catCounts[c] = c === "전체" ? comps.length : comps.filter(x => x.cat === c).length; });

  const update = (newComps) => { setLocalComps(newComps); if (setCompsProp) setCompsProp(newComps); };

  const addComp = () => {
    if (!newName.trim() || !newCode.trim()) return;
    update([...comps, { id: "comp" + Date.now(), name: newName.trim(), cat: newCat, code: newCode.trim(), tags: [], createdAt: Date.now() }]);
    setShowAdd(false); setNewName(""); setNewCode("");
  };

  const deleteComp = (id) => update(comps.filter(c => c.id !== id));

  const copyCode = (code) => { navigator.clipboard.writeText(code).catch(() => {}); };

  const actionBtn = (label, onClick) => (
    <button onClick={onClick} style={{
      padding: "3px 8px", fontSize: 10, border: `1px solid ${t.cb}`,
      background: "transparent", color: t.t3, borderRadius: 4, cursor: "pointer"
    }}>{label}</button>
  );

  return (
    <div style={{ padding: 16 }}>
      {/* 카테고리 필터 + 뷰 토글 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{
              padding: "4px 12px", fontSize: 11, borderRadius: 16, cursor: "pointer", flexShrink: 0,
              border: cat === c ? `1px solid ${t.ac}` : `1px solid ${t.cb}`,
              background: cat === c ? t.abg : "transparent",
              color: cat === c ? t.ac : t.t3, fontWeight: cat === c ? 600 : 400
            }}>{c} {catCounts[c] > 0 ? catCounts[c] : ""}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 2, border: `1px solid ${t.cb}`, borderRadius: 6, overflow: "hidden", marginLeft: 8, flexShrink: 0 }}>
          {[["card","카드"],["list","리스트"]].map(([k,label]) => (
            <button key={k} onClick={() => setViewMode(k)} style={{
              padding: "4px 10px", fontSize: 10, border: "none", cursor: "pointer",
              background: viewMode === k ? t.abg : "transparent",
              color: viewMode === k ? t.ac : t.t3
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* 카드 뷰 */}
      {viewMode === "card" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {filtered.map(c => (
            <div key={c.id} style={{
              border: `1px solid ${t.cb}`, borderRadius: 10, overflow: "hidden",
              background: t.card, position: "relative"
            }}>
              {/* 카테고리 뱃지 */}
              <div style={{ position: "absolute", top: 6, left: 8, padding: "1px 8px", borderRadius: 4, fontSize: 9, background: "rgba(0,0,0,0.4)", color: t.ac }}>{c.cat}</div>
              {/* 프리뷰 */}
              <div style={{
                padding: 12, background: "#fafafa", borderBottom: `1px solid ${t.cb}`,
                height: 100, overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <div style={{ transform: "scale(0.75)", transformOrigin: "center", maxWidth: "133%" }}
                  dangerouslySetInnerHTML={{ __html: c.code }} />
              </div>
              {/* 이름 + 태그 */}
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.tx, marginBottom: 2 }}>{c.name}</div>
                <div style={{ fontSize: 10, color: t.t3 }}>{c.cat}{c.tags?.length > 0 ? " · " + c.tags.join(", ") : ""}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  {actionBtn("복사", () => copyCode(c.code))}
                  {actionBtn("적용", () => {})}
                  {actionBtn("×", () => deleteComp(c.id))}
                </div>
              </div>
            </div>
          ))}
          {/* + 추가 */}
          <div onClick={() => setShowAdd(true)} style={{
            border: `1px dashed ${t.cb}`, borderRadius: 10,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            minHeight: 180, color: t.t3, fontSize: 12, cursor: "pointer", gap: 6
          }}>
            <span style={{ fontSize: 24 }}>+</span>
            컴포넌트 추가
          </div>
        </div>
      ) : (
        /* 리스트 뷰 */
        <div>
          {filtered.map(c => (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              marginBottom: 4, borderRadius: 8, border: `1px solid ${t.cb}`, background: t.card
            }}>
              <div style={{
                width: 60, height: 45, borderRadius: 6, background: "#fafafa",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", flexShrink: 0, border: `1px solid ${t.cb}`
              }}>
                <div style={{ transform: "scale(0.35)", transformOrigin: "center" }}
                  dangerouslySetInnerHTML={{ __html: c.code }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: t.tx }}>{c.name}</div>
                <div style={{ fontSize: 10, color: t.t3 }}>{c.cat}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {actionBtn("복사", () => copyCode(c.code))}
                {actionBtn("적용", () => {})}
              </div>
            </div>
          ))}
          <div onClick={() => setShowAdd(true)} style={{
            padding: "12px", border: `1px dashed ${t.cb}`, borderRadius: 8,
            textAlign: "center", color: t.t3, fontSize: 11, cursor: "pointer", marginTop: 4
          }}>+ 컴포넌트 추가</div>
        </div>
      )}

      {/* 추가 모달 */}
      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 420, maxHeight: "85vh", overflow: "auto",
            background: t.card, borderRadius: 14, padding: 20, border: `1px solid ${t.cb}`
          }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, color: t.tx }}>컴포넌트 추가</h3>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>이름</div>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="컴포넌트 이름"
                style={{ width: "100%", padding: "8px 10px", background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 6, fontSize: 13, color: t.tx, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>카테고리</div>
              <select value={newCat} onChange={e => setNewCat(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 6, fontSize: 13, color: t.tx, outline: "none" }}>
                {CATEGORIES.filter(c => c !== "전체").map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>HTML 코드</div>
              <textarea value={newCode} onChange={e => setNewCode(e.target.value)} rows={8}
                placeholder='<button style="padding:12px 24px;background:#7C6AFF;color:#fff;border:none;border-radius:8px">버튼</button>'
                style={{ width: "100%", padding: "8px 10px", background: t.ib, border: `1px solid ${t.ibr}`, borderRadius: 6, fontSize: 12, color: "#5DCAA5", fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            </div>
            {/* 실시간 프리뷰 */}
            {newCode.trim() && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: t.t3, marginBottom: 4 }}>미리보기</div>
                <div style={{ padding: 16, background: "#fafafa", borderRadius: 8, border: `1px solid ${t.ibr}` }}
                  dangerouslySetInnerHTML={{ __html: newCode }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 8, border: `1px solid ${t.cb}`, background: "transparent", color: t.t3, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>취소</button>
              <button onClick={addComp} style={{ flex: 1, padding: 8, border: "none", background: t.ac, color: "#fff", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { INIT_COMPONENTS };
