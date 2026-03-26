export const INIT_PROJECTS = [
  {
    id: "p1",
    name: "메인 대시보드",
    emoji: "🏠",
    bg: "#0f2027",
    pri: "핵심｜D-5",
    priC: "#c0392b",
    tags: ["트래커", "코어"],
    pct: 70,
    code: `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:32px;background:#1a1a2e;border-radius:12px">
  <h2 style="margin:0;font-size:20px;font-weight:600;color:#fff;text-align:center">FitTrack</h2>
  <p style="margin:0;font-size:13px;color:#9999b0;text-align:center">오늘 운동을 기록하세요</p>
  <button style="padding:10px 28px;background:#7C6AFF;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">시작하기</button>
</div>`,
    pages: [
      { id: "v1", name: "v1 카드형", type: "시안", code: `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:32px;background:#1a1a2e;border-radius:12px">
  <h2 style="margin:0;font-size:20px;font-weight:600;color:#fff;text-align:center">FitTrack</h2>
  <p style="margin:0;font-size:13px;color:#9999b0;text-align:center">오늘 운동을 기록하세요</p>
  <button style="padding:10px 28px;background:#7C6AFF;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">시작하기</button>
</div>` },
    ],
    elements: [
      { id: "e1", name: "인사말 헤더", emoji: "👋", pages: ["p1"], code: `<h2 style="margin:0;font-size:20px;font-weight:600;color:#fff;text-align:center">FitTrack</h2>` },
      { id: "e2", name: "시작 버튼", emoji: "🔘", pages: ["p1"], code: `<button style="padding:10px 28px;background:#7C6AFF;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">시작하기</button>` },
    ],
  },
  {
    id: "p2",
    name: "로그인",
    emoji: "🔑",
    bg: "#1b1b2f",
    pri: "빠르면 좋음",
    priC: "#b8860b",
    tags: ["인증"],
    pct: 30,
    code: `<div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:40px 32px;background:#141428;border-radius:12px">
  <h2 style="margin:0;font-size:18px;color:#fff">로그인</h2>
  <input style="width:200px;padding:10px;background:#1e1e36;border:1px solid #2a2a40;border-radius:8px;color:#fff;font-size:13px" placeholder="이메일"/>
  <button style="width:200px;padding:12px;background:#7C6AFF;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">로그인</button>
</div>`,
    pages: [],
    elements: [],
  },
  {
    id: "p3",
    name: "운동 기록",
    emoji: "💪",
    bg: "#1a002e",
    pri: "핵심｜D-3",
    priC: "#c0392b",
    tags: ["트래커", "코어"],
    pct: 85,
    code: `<div style="padding:24px;background:#1a1a2e;border-radius:12px">
  <h3 style="margin:0 0 16px;color:#fff;font-size:16px">운동 기록</h3>
  <div style="display:flex;gap:8px">
    <span style="padding:6px 14px;background:#7C6AFF;color:#fff;border-radius:20px;font-size:12px">벤치프레스</span>
    <span style="padding:6px 14px;background:#2a2a40;color:#aaa;border-radius:20px;font-size:12px">스쿼트</span>
  </div>
</div>`,
    pages: [],
    elements: [],
  },
];
