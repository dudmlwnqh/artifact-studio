import { useState } from "react";
import TokenSetManager from "./TokenSetManager.jsx";
import DesignTokenEditor from "./DesignTokenEditor.jsx";

const CATEGORIES = ["전체","버튼","팔레트","배경","캐릭터","레이아웃","레퍼런스"];
const FILE_TYPES = { jsx: "#7C6AFF", json: "#EF9F27", zip: "#5DCAA5", png: "#aaa", md: "#888", xlsx: "#2E7D32", lottie: "#FF6B00" };

const INIT_ASSETS = [
  { id:"a1", name:"Primary Button", cat:"버튼", fileType:"jsx", color:"#7C6AFF", preview:'<button style="padding:8px 20px;background:#7C6AFF;color:#fff;border:none;border-radius:6px;font-size:13px">Primary</button>', actions:["복사","적용"], tags:["코어"] },
  { id:"a2", name:"Secondary Outline", cat:"버튼", fileType:"jsx", color:"#2a2a40", preview:'<button style="padding:8px 20px;background:transparent;color:#fff;border:1px solid #7C6AFF;border-radius:6px;font-size:13px">Secondary</button>', actions:["복사","적용"], tags:["코어"] },
  { id:"a3", name:"Icon Button", cat:"버튼", fileType:"jsx", color:"#2a2a40", preview:'<div style="width:36px;height:36px;border-radius:18px;background:#2a2a40;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px">+</div>', actions:["복사","적용"], tags:[] },
  { id:"a4", name:"FAB 플로팅", cat:"버튼", fileType:"jsx", color:"#7C6AFF", preview:'<div style="width:48px;height:48px;border-radius:24px;background:#7C6AFF;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;box-shadow:0 4px 12px rgba(124,106,255,0.4)">+</div>', actions:["복사","적용"], tags:[] },
  { id:"a5", name:"메인 컬러 코드", cat:"팔레트", fileType:"json", color:null, preview:'<div style="display:flex;gap:4px"><div style="width:24px;height:24px;background:#534AB7;border-radius:4px"></div><div style="width:24px;height:24px;background:#7C6AFF;border-radius:4px"></div><div style="width:24px;height:24px;background:#1D9E75;border-radius:4px"></div><div style="width:24px;height:24px;background:#EF9F27;border-radius:4px"></div></div>', actions:["색상복사","상세"], tags:["브랜드"] },
  { id:"a6", name:"영역별 색상표", cat:"팔레트", fileType:"xlsx", color:null, preview:null, actions:["열기"], tags:[] },
  { id:"a7", name:"라운드 가이드", cat:"팔레트", fileType:"md", color:null, preview:null, actions:["열기"], tags:["가이드"] },
  { id:"a8", name:"다크 그라데이션 팩", cat:"배경", fileType:"zip", color:"#1a3a4a", preview:null, actions:["미리보기","적용"], tags:["유료"] },
  { id:"a9", name:"패턴 텍스처 v2", cat:"배경", fileType:"zip", color:"#2a2a3a", preview:null, actions:["미리보기","적용"], tags:[] },
  { id:"a10", name:"프리미엄 배경 3종", cat:"배경", fileType:"zip", color:"#3a1a5a", preview:null, actions:["미리보기","적용"], tags:["유료"] },
  { id:"a11", name:"마스코트 Idle", cat:"캐릭터", fileType:"json", color:null, preview:'<div style="font-size:40px;text-align:center">🏆</div>', actions:["재생","코드복사"], tags:["Lottie"] },
  { id:"a12", name:"마스코트 Run", cat:"캐릭터", fileType:"json", color:null, preview:'<div style="font-size:40px;text-align:center">🏃</div>', actions:["재생","코드복사"], tags:["Lottie"] },
  { id:"a13", name:"표정 시트", cat:"캐릭터", fileType:"png", color:null, preview:'<div style="font-size:28px;text-align:center">😀</div>', actions:["원본보기"], tags:[] },
  { id:"a14", name:"카드 스택 레이아웃", cat:"레이아웃", fileType:"jsx", color:"#1a1a2e", preview:'<div style="display:flex;flex-direction:column;gap:3px"><div style="height:8px;background:#2a2a40;border-radius:3px;width:70%"></div><div style="height:20px;background:#22222e;border-radius:3px"></div></div>', actions:["복사","미리보기"], tags:[] },
  { id:"a15", name:"리스트형 레이아웃", cat:"레이아웃", fileType:"jsx", color:"#1a1a2e", preview:null, actions:["복사","미리보기"], tags:[] },
  { id:"a16", name:"그리드 2x2", cat:"레이아웃", fileType:"jsx", color:"#1a1a2e", preview:null, actions:["복사","미리보기"], tags:[] },
  { id:"a17", name:"Nike Training Club", cat:"레퍼런스", fileType:"png", color:"#000", preview:null, actions:["원본보기"], tags:["캡쳐"] },
  { id:"a18", name:"Strava 활동피드", cat:"레퍼런스", fileType:"png", color:"#000", preview:null, actions:["원본보기"], tags:["캡쳐"] },
];

// 백엔드/DB 초기 데이터
const INIT_BACKEND = [
  { id:"b1", name:"Supabase", type:"DB", desc:"사용자 프로필, 운동기록, 설정값", areas:["P1 메인","P3 운동기록"] },
  { id:"b2", name:"Firebase Auth", type:"인증", desc:"소셜 로그인 (Google, Apple)", areas:["P2 로그인"] },
  { id:"b3", name:"Vercel", type:"배포", desc:"프론트엔드 배포 + Edge Functions", areas:[] },
];

// 외주/담당자 초기 데이터
const INIT_CONTACTS = [
  { id:"c1", name:"김디자인", role:"UI 디자이너", type:"외부 외주", contact:"design@email.com", tasks:["캐릭터 디자인","아이콘 팩"], status:"진행중" },
  { id:"c2", name:"박개발", role:"백엔드 개발", type:"기술 개발", contact:"dev@email.com", tasks:["API 연동","DB 설계"], status:"대기" },
];

export default function SourceTab({ sources, setSources, search, t, defaultSubTab, tokenSets, setTokenSets }) {
  const subTab = defaultSubTab || "design"; // 부모에서 직접 제어
  const [cat, setCat] = useState("전체");
  const [viewMode, setViewMode] = useState("card"); // card | list
  const [designView, setDesignView] = useState("tokens"); // tokens | assets
  const [editingTokenSet, setEditingTokenSet] = useState(null);
  const [recentIds] = useState(["a1","a8","a11","a14","a5"]);
  const [assets, setAssets] = useState(INIT_ASSETS);
  const [backends, setBackends] = useState(INIT_BACKEND);
  const [contacts, setContacts] = useState(INIT_CONTACTS);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddBackend, setShowAddBackend] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  const lc = (search || "").toLowerCase();

  // 필터링
  const filtered = assets.filter(a => {
    if (cat !== "전체" && a.cat !== cat) return false;
    if (lc && !a.name.toLowerCase().includes(lc) && !a.cat.toLowerCase().includes(lc) && !a.tags.some(t => t.toLowerCase().includes(lc))) return false;
    return true;
  });

  const filteredBackends = backends.filter(b =>
    !lc || b.name.toLowerCase().includes(lc) || b.desc.toLowerCase().includes(lc) || b.type.toLowerCase().includes(lc)
  );

  const filteredContacts = contacts.filter(c =>
    !lc || c.name.toLowerCase().includes(lc) || c.role.toLowerCase().includes(lc) || c.tasks.some(t => t.toLowerCase().includes(lc))
  );

  const catCounts = {};
  CATEGORIES.forEach(c => { catCounts[c] = c === "전체" ? assets.length : assets.filter(a => a.cat === c).length; });

  const actionStyle = { padding: "3px 8px", fontSize: 10, border: `1px solid ${t.cb}`, background: "transparent", color: t.t3, borderRadius: 4, cursor: "pointer" };

  return (
    <div style={{ padding: 16 }}>

      {/* ===== 디자인 자료 ===== */}
      {subTab === "design" && (<>
        {/* 토큰 세트 편집 오버레이 */}
        {editingTokenSet && (
          <div style={{ position: "fixed", inset: 0, background: t.bg, zIndex: 50, display: "flex", flexDirection: "column" }}>
            <DesignTokenEditor
              t={t}
              tokenSet={editingTokenSet}
              onSave={(updated) => {
                setTokenSets(prev => prev.map(s => s.id === updated.id ? updated : s));
                setEditingTokenSet(null);
              }}
              onClose={() => setEditingTokenSet(null)}
            />
          </div>
        )}

        {/* 세그먼트 컨트롤: 토큰 세트 / 디자인 에셋 */}
        <div style={{ display: "flex", gap: 2, marginBottom: 14, border: `1px solid ${t.cb}`, borderRadius: 6, overflow: "hidden", width: "fit-content" }}>
          {[["tokens", "토큰 세트"], ["assets", "디자인 에셋"]].map(([k, label]) => (
            <button key={k} onClick={() => setDesignView(k)} style={{
              padding: "6px 16px", fontSize: 12, border: "none", cursor: "pointer",
              background: designView === k ? t.abg : "transparent",
              color: designView === k ? t.ac : t.t3,
              fontWeight: designView === k ? 600 : 400,
            }}>{label}</button>
          ))}
        </div>

        {/* 토큰 세트 관리 */}
        {designView === "tokens" && tokenSets && (
          <TokenSetManager
            tokenSets={tokenSets}
            setTokenSets={setTokenSets}
            onEditSet={(ts) => setEditingTokenSet(ts)}
            t={t}
          />
        )}

        {/* 디자인 에셋 (기존) */}
        {designView === "assets" && (<>
        {/* 최근 사용 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: t.t3, marginBottom: 8 }}>최근 사용</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {recentIds.map(id => {
              const a = assets.find(x => x.id === id);
              if (!a) return null;
              return (
                <div key={id} style={{ width: 100, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${t.cb}`, background: t.card }}>
                  <div style={{ height: 50, background: a.color || "#12121e", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}
                    dangerouslySetInnerHTML={{ __html: a.preview || "" }} />
                  <div style={{ padding: "4px 6px", fontSize: 10, color: t.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 전체 자료 header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: t.t3 }}>전체 자료</div>
          <div style={{ display: "flex", gap: 2, border: `1px solid ${t.cb}`, borderRadius: 6, overflow: "hidden" }}>
            {[["card","카드"],["list","리스트"]].map(([k,label]) => (
              <button key={k} onClick={() => setViewMode(k)} style={{
                padding: "4px 10px", fontSize: 10, border: "none", cursor: "pointer",
                background: viewMode === k ? t.abg : "transparent",
                color: viewMode === k ? t.ac : t.t3
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* 카테고리 필터 칩 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{
              padding: "4px 12px", fontSize: 11, borderRadius: 16, cursor: "pointer", flexShrink: 0,
              border: cat === c ? `1px solid ${t.ac}` : `1px solid ${t.cb}`,
              background: cat === c ? t.abg : "transparent",
              color: cat === c ? t.ac : t.t3, fontWeight: cat === c ? 600 : 400
            }}>{c} {catCounts[c]}</button>
          ))}
        </div>

        {/* 카드 그리드 */}
        {viewMode === "card" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {filtered.map(a => (
              <div key={a.id} style={{ border: `1px solid ${t.cb}`, borderRadius: 8, overflow: "hidden", background: t.card, position: "relative" }}>
                {/* 파일 타입 뱃지 */}
                <div style={{ position: "absolute", top: 6, right: 6, padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: "rgba(0,0,0,0.5)", color: FILE_TYPES[a.fileType] || "#aaa", textTransform: "uppercase" }}>{a.fileType}</div>
                {/* 프리뷰 */}
                <div style={{ height: 80, background: a.color || "#12121e", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${t.cb}`, padding: 8 }}
                  dangerouslySetInnerHTML={{ __html: a.preview || `<div style="color:rgba(255,255,255,0.15);font-size:28px">📦</div>` }} />
                {/* 정보 */}
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.tx, marginBottom: 2 }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: t.t3 }}>
                    {a.cat}{a.tags.length > 0 ? " · " + a.tags.join(", ") : ""}
                  </div>
                  {/* 액션 버튼 */}
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {a.actions.map(act => (
                      <button key={act} style={actionStyle}>{act}</button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {/* + 자료 추가 */}
            <div onClick={() => setShowAddAsset(true)} style={{
              border: `1px dashed ${t.cb}`, borderRadius: 8,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              minHeight: 140, color: t.t3, fontSize: 11, cursor: "pointer", gap: 4
            }}>
              <span style={{ fontSize: 20 }}>+</span>
              자료 추가
            </div>
          </div>
        ) : (
          /* 리스트 뷰 */
          <div>
            {filtered.map(a => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                marginBottom: 4, borderRadius: 6, border: `1px solid ${t.cb}`, background: t.card
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 6, background: a.color || "#12121e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}
                  dangerouslySetInnerHTML={{ __html: a.preview ? `<div style="transform:scale(0.5);transform-origin:center">${a.preview}</div>` : '<div style="color:rgba(255,255,255,0.15);font-size:16px">📦</div>' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: t.tx }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: t.t3 }}>{a.cat} · {a.fileType.toUpperCase()}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {a.actions.slice(0, 2).map(act => (
                    <button key={act} style={actionStyle}>{act}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </>)}
      </>)}

      {/* ===== 백엔드 / DB ===== */}
      {subTab === "backend" && (<>
        <div style={{ fontSize: 11, color: t.t3, marginBottom: 12, lineHeight: 1.6 }}>
          프로젝트에서 사용하는 백엔드 서비스와 데이터베이스를 관리합니다.<br/>
          각 서비스가 어떤 페이지/영역에서 사용되는지 지정하세요.
        </div>
        {filteredBackends.map(b => (
          <div key={b.id} style={{
            padding: 14, marginBottom: 8, borderRadius: 8,
            border: `1px solid ${t.cb}`, background: t.card
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: t.abg, color: t.ac }}>{b.type}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>{b.name}</span>
            </div>
            <div style={{ fontSize: 11, color: t.t2, marginBottom: 6 }}>{b.desc}</div>
            {b.areas.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {b.areas.map(area => (
                  <span key={area} style={{ padding: "2px 8px", borderRadius: 12, fontSize: 9, border: `1px solid ${t.cb}`, color: t.t3 }}>{area}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        <button onClick={() => setShowAddBackend(true)} style={{
          width: "100%", padding: 12, border: `1px dashed ${t.cb}`,
          background: "transparent", color: t.t3, borderRadius: 8,
          fontSize: 11, cursor: "pointer"
        }}>+ 백엔드/DB 추가</button>
      </>)}

      {/* ===== 외주 / 담당자 ===== */}
      {subTab === "contacts" && (<>
        <div style={{ fontSize: 11, color: t.t3, marginBottom: 12, lineHeight: 1.6 }}>
          외부 외주 업체, 기술 개발자, 담당자 연락처를 관리합니다.
        </div>
        {filteredContacts.map(c => (
          <div key={c.id} style={{
            padding: 14, marginBottom: 8, borderRadius: 8,
            border: `1px solid ${t.cb}`, background: t.card
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: c.type === "외부 외주" ? "rgba(239,159,39,0.15)" : c.type === "기술 개발" ? "rgba(93,202,165,0.15)" : t.abg,
                color: c.type === "외부 외주" ? "#EF9F27" : c.type === "기술 개발" ? "#5DCAA5" : t.ac
              }}>{c.type}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>{c.name}</span>
              <span style={{
                marginLeft: "auto", padding: "2px 8px", borderRadius: 12, fontSize: 9,
                background: c.status === "진행중" ? "rgba(93,202,165,0.15)" : "rgba(255,255,255,0.05)",
                color: c.status === "진행중" ? "#5DCAA5" : t.t3
              }}>{c.status}</span>
            </div>
            <div style={{ fontSize: 11, color: t.t2, marginBottom: 4 }}>{c.role}</div>
            <div style={{ fontSize: 10, color: t.t3, marginBottom: 6 }}>{c.contact}</div>
            {c.tasks.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {c.tasks.map(task => (
                  <span key={task} style={{ padding: "2px 8px", borderRadius: 12, fontSize: 9, border: `1px solid ${t.cb}`, color: t.t3 }}>{task}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        <button onClick={() => setShowAddContact(true)} style={{
          width: "100%", padding: 12, border: `1px dashed ${t.cb}`,
          background: "transparent", color: t.t3, borderRadius: 8,
          fontSize: 11, cursor: "pointer"
        }}>+ 담당자 추가</button>
      </>)}
    </div>
  );
}
