// ── 토큰 프리셋 라이브러리 ──
// DesignTokenEditor.jsx에서 추출 + 완전한 tokenSet 형태로 확장

export const TYPO_PRESETS = {
  heading: { size: 20, weight: "700", family: "system-ui", lineHeight: 1.4 },
  subheading: { size: 16, weight: "600", family: "system-ui", lineHeight: 1.4 },
  body: { size: 14, weight: "400", family: "system-ui", lineHeight: 1.6 },
  caption: { size: 11, weight: "400", family: "system-ui", lineHeight: 1.4 },
};

export const SPACING_PRESETS = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const RADIUS_PRESETS = { sm: 4, md: 8, lg: 12, xl: 16, full: 999 };
export const SHADOW_PRESETS = {
  none: "none",
  sm: "0 1px 3px rgba(0,0,0,0.12)",
  md: "0 4px 12px rgba(0,0,0,0.15)",
  lg: "0 8px 24px rgba(0,0,0,0.2)",
};

export const COLOR_GROUPS = [
  { key: "brand", label: "브랜드", fields: ["brand", "brandSub"] },
  { key: "status", label: "상태", fields: ["success", "warning", "error", "info"] },
  { key: "bg", label: "배경", fields: ["bg", "bgCard", "bgSub"] },
  { key: "text", label: "텍스트", fields: ["text", "textSub", "textDim"] },
];

export const COLOR_LABELS = {
  brand: "메인", brandSub: "보조",
  bg: "기본 배경", bgCard: "카드 배경", bgSub: "보조 배경",
  text: "기본 텍스트", textSub: "보조 텍스트", textDim: "흐린 텍스트",
  success: "성공", warning: "경고", error: "위험", info: "정보", accent: "강조",
};

export const TOKEN_TABS = [
  { key: "color", label: "색상", icon: "🎨" },
  { key: "typo", label: "글자", icon: "Aa" },
  { key: "spacing", label: "간격", icon: "↔" },
  { key: "radius", label: "둥글기", icon: "◰" },
  { key: "shadow", label: "그림자", icon: "▪" },
];

// 6개 프리셋 — 각각 완전한 tokenSet 형태
const PRESET_COLORS = [
  {
    id: "toss", name: "토스 스타일", desc: "다크 + 블루 포인트", style: "미니멀, 핀테크",
    header: "#1B1D2E",
    colors: {
      brand: "#3182F6", brandSub: "#1B64DA",
      bg: "#0D0F1C", bgCard: "#1B1D2E", bgSub: "#252836",
      text: "#F2F4F6", textSub: "#8B95A1", textDim: "#4E5968",
      success: "#00C853", warning: "#FF9100", error: "#F44336", info: "#3182F6",
      accent: "#3182F6",
    },
  },
  {
    id: "karrot", name: "당근 스타일", desc: "오렌지 + 따뜻한 톤", style: "커뮤니티, 마켓",
    header: "#FF6F00",
    colors: {
      brand: "#FF6F00", brandSub: "#E65100",
      bg: "#FFFFFF", bgCard: "#FFF8F0", bgSub: "#FFF3E0",
      text: "#212121", textSub: "#757575", textDim: "#BDBDBD",
      success: "#4CAF50", warning: "#FF9800", error: "#F44336", info: "#2196F3",
      accent: "#FF6F00",
    },
  },
  {
    id: "notion", name: "노션 스타일", desc: "흑백 + 미니멀", style: "생산성, 문서",
    header: "#191919",
    colors: {
      brand: "#000000", brandSub: "#37352F",
      bg: "#FFFFFF", bgCard: "#F7F6F3", bgSub: "#EBECED",
      text: "#37352F", textSub: "#787774", textDim: "#C3C2BF",
      success: "#448361", warning: "#C29243", error: "#EB5757", info: "#529CCA",
      accent: "#2EAADC",
    },
  },
  {
    id: "insta", name: "인스타 스타일", desc: "그라데이션 퍼플+핑크", style: "SNS, 크리에이터",
    header: "#833AB4",
    colors: {
      brand: "#833AB4", brandSub: "#C13584",
      bg: "#000000", bgCard: "#1A1A2E", bgSub: "#16213E",
      text: "#FAFAFA", textSub: "#A8A8A8", textDim: "#555555",
      success: "#4ADE80", warning: "#FBBF24", error: "#EF4444", info: "#833AB4",
      accent: "#E1306C",
    },
  },
  {
    id: "nature", name: "네이처 / 웰니스", desc: "그린 + 어스톤", style: "건강, 라이프스타일",
    header: "#0D9488",
    colors: {
      brand: "#0D9488", brandSub: "#059669",
      bg: "#FAFAF5", bgCard: "#F0FDF4", bgSub: "#ECFDF5",
      text: "#1A2E1A", textSub: "#6B7A6B", textDim: "#A3B8A3",
      success: "#22C55E", warning: "#EAB308", error: "#DC2626", info: "#0EA5E9",
      accent: "#0D9488",
    },
  },
  {
    id: "cyber", name: "사이버핑크", desc: "네온 + 다크", style: "게임, 테크",
    header: "#0A0A14",
    colors: {
      brand: "#E040FB", brandSub: "#7C4DFF",
      bg: "#0A0A14", bgCard: "#151528", bgSub: "#1A1A35",
      text: "#E8E8F0", textSub: "#9090B0", textDim: "#505070",
      success: "#00E676", warning: "#FFD600", error: "#FF1744", info: "#00E5FF",
      accent: "#E040FB",
    },
  },
];

// 완전한 tokenSet 형태로 확장
export const PRESETS = PRESET_COLORS.map((p) => ({
  ...p,
  typography: { ...TYPO_PRESETS },
  spacing: { ...SPACING_PRESETS },
  radius: { ...RADIUS_PRESETS },
  shadows: { ...SHADOW_PRESETS },
}));

// 프리셋에서 새 tokenSet 생성 헬퍼
export function createTokenSetFromPreset(preset) {
  const now = Date.now();
  return {
    id: "ts_" + now,
    name: preset.name,
    desc: preset.desc,
    createdAt: now,
    updatedAt: now,
    colors: { ...preset.colors },
    typography: JSON.parse(JSON.stringify(preset.typography)),
    spacing: { ...preset.spacing },
    radius: { ...preset.radius },
    shadows: { ...preset.shadows },
    github: null,
  };
}
