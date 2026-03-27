# Artifact Studio — 마이그레이션 가이드

## 프로젝트 개요
AI 아티팩트 관리 대시보드 + 비주얼 코드 에디터.
비전공자도 앱 UI를 설계·편집·관리할 수 있는 올인원 도구.

- **기술 스택:** React 18 + Vite 6 + JavaScript (JSX)
- **상태 관리:** React Hooks (useState/useRef/useCallback)
- **저장:** localStorage (Supabase 전환 예정)
- **렌더링:** HTML (dangerouslySetInnerHTML) + JSX (Babel + iframe) + Sandpack (멀티파일)

---

## 1. 로컬 환경 세팅

### 필수 요구사항
- Node.js 18+ (22 권장)
- npm 9+
- Git

### 설치 & 실행
```bash
# 1. 저장소 클론
git clone https://github.com/dudmlwnqh/artifact-studio.git
cd artifact-studio

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev
# → http://localhost:3000 에서 확인

# 4. 프로덕션 빌드
npm run build
npm run preview
```

### 의존성 목록
| 패키지 | 버전 | 용도 |
|--------|------|------|
| react | ^18.3.1 | UI 프레임워크 |
| react-dom | ^18.3.1 | DOM 렌더링 |
| @babel/standalone | ^7.29.2 | 브라우저 JSX 컴파일 |
| @codesandbox/sandpack-react | ^2.20.0 | 멀티파일 코드 프리뷰 |
| vite | ^6.0.0 | 빌드 도구 + 개발 서버 |
| @vitejs/plugin-react | ^4.3.4 | Vite React 플러그인 |

---

## 2. 파일 구조

```
artifact-studio/
├── index.html                     # HTML 진입점
├── package.json                   # 의존성 & 스크립트
├── vite.config.js                 # Vite 설정 (port 3000)
├── src/
│   ├── main.jsx                   # React 마운트
│   ├── App.jsx                    # 메인 앱 (갤러리 + 5탭 라우팅)
│   ├── Editor.jsx                 # 비주얼 에디터 (핵심, 921줄)
│   ├── AddModal.jsx               # 프로젝트 추가 모달
│   ├── data.js                    # 초기 데모 데이터 (3개 프로젝트)
│   ├── theme.js                   # 다크/라이트 테마 색상
│   ├── storage.js                 # localStorage 래퍼
│   └── components/
│       ├── PageViewer.jsx         # 페이지/영역 뷰어 (카메라 앨범 UX)
│       ├── StoryboardPanel.jsx    # 스토리보드 + 파일 + 자료 탭
│       ├── ProjectFiles.jsx       # 프로젝트 파일 관리 (import 지원)
│       ├── DesignToolPanel.jsx    # CSS 속성 편집 리모컨 (포토샵급)
│       ├── JsxRenderer.jsx        # HTML/JSX/Sandpack 렌더러
│       ├── ComponentTab.jsx       # UI 컴포넌트 라이브러리 (15개)
│       ├── SourceTab.jsx          # 디자인자료/백엔드/외주 관리
│       └── DesignTokenEditor.jsx  # 디자인 토큰 에디터 (미연결)
```

---

## 3. 컴포넌트 트리 & 데이터 흐름

```
App.jsx
 ├── state: projects, sources, uiComponents, tab, search, isDark
 ├── 저장: localStorage에 projects/sources/uiComponents 자동 저장
 │
 ├── [아티팩트 탭] → 프로젝트 카드 그리드
 │   └── 카드 클릭 → Editor.jsx
 │       ├── 좌측: PageViewer.jsx (미리보기/코드 토글)
 │       │   └── JsxRenderer.jsx (HTML/JSX 렌더링)
 │       ├── 중앙(조건부): DesignToolPanel.jsx (더블클릭 시 속성 편집)
 │       └── 우측: StoryboardPanel.jsx
 │           ├── 📁 파일 탭 → ProjectFiles.jsx
 │           ├── 스토리보드 탭 → 스텝 리스트
 │           └── 자료 탭 → 업로드 영역
 │
 ├── [컴포넌트 탭] → ComponentTab.jsx (UI 조각 라이브러리)
 ├── [디자인 자료 탭] → SourceTab.jsx (defaultSubTab="design")
 ├── [백엔드·DB 탭] → SourceTab.jsx (defaultSubTab="backend")
 └── [외주·담당자 탭] → SourceTab.jsx (defaultSubTab="contacts")
```

---

## 4. 핵심 데이터 모델

### Project (프로젝트)
```javascript
{
  id: "p1",
  name: "메인 대시보드",
  emoji: "🏠",
  bg: "#0f2027",          // 카드 배경색
  pri: "핵심｜D-5",       // 우선순위 라벨
  priC: "#c0392b",        // 우선순위 색상
  tags: ["트래커"],       // 검색 태그
  pct: 70,               // 완성률 (%)
  code: "<div>...</div>", // 메인 HTML/JSX 코드
  pages: [               // 시안/스토리보드 목록
    { id, name, type: "시안"|"스토리보드", code }
  ],
  elements: [            // 영역 요소 (컴포넌트 조각)
    { id, name, emoji, pages: ["p1"], code }
  ],
  storyboard: [          // 구현 스텝
    { id, title, desc, variants: [{id, name, code}], links, prompt }
  ],
  projectFiles: {        // import 지원 파일들
    "theme.js": { code, type, label, desc, icon }
  },
  interactions: [        // 인터랙션 설정
    { id, elIdx, trigger: "tap"|"longPress", action: "toast"|"modal"|"bottomSheet", message }
  ]
}
```

### UI Component (컴포넌트 탭)
```javascript
{ id, name, cat: "버튼"|"입력필드"|..., code, tags, createdAt }
```

### Source Asset (디자인 자료)
```javascript
{ id, name, cat, fileType, color, preview, actions, tags }
```

---

## 5. 현재 기능 상태

### ✅ 완성 (100%)
- 프로젝트 갤러리 (카메라 앨범 그리드, 줌 3단계)
- 다크/라이트 모드
- 프로젝트 CRUD
- 검색 필터링
- localStorage 자동 저장/불러오기
- HTML 실시간 렌더링
- 요소 선택 + 점선 하이라이트
- CSS 속성 편집 (타이포/색상/박스모델/border/효과)
- Undo/Redo (50단계)
- 자동 저장 (1초 디바운스)
- 코드 복사
- 텍스트 더블클릭 편집
- 미리보기/코드 뷰 토글
- 편집/실행 모드 토글
- 인터랙션 (탭/롱프레스 → 토스트/모달/바텀시트)
- 컴포넌트 라이브러리 (15종)
- 5개 독립 탭 (아티팩트/컴포넌트/디자인자료/백엔드DB/외주담당자)

### 🔧 부분 완성 (70-90%)
- 스포이드 색상 추출 (네이티브 EyeDropper API 지원 브라우저만)
- 리사이즈 핸들 (패딩 조절 가능, 크기 조절 미완)
- 프로젝트 파일 관리 (추가/편집 가능, import 해석은 Sandpack 의존)
- 스토리보드 스텝 관리 (기본 CRUD)
- JSX 렌더링 (단일 파일 OK, 멀티파일은 Sandpack CDN 의존)

### ⬜ 미구현
- DesignTokenEditor 연결 (파일만 생성됨)
- 이미지 색상 추출 (color-thief 미설치)
- 자료 파일 업로드 (UI만 있음)
- AI 분석 & 스토리보드 자동 생성
- Supabase DB 연동
- GitHub 파일 관리 (API 미연결)
- Vercel 배포 연동
- 버전 관리 (스냅샷)
- 커뮤니티 프리셋 공유

---

## 6. 단축키

| 단축키 | 기능 | 위치 |
|--------|------|------|
| Ctrl+Z | 실행취소 | Editor |
| Ctrl+Shift+Z / Ctrl+Y | 다시실행 | Editor |
| Ctrl+S | 저장 | Editor |
| Ctrl+I | 스포이드 모드 | Editor |
| Esc | 선택 해제 / 패널 닫기 | Editor |
| 더블클릭 | 텍스트 편집 | PageViewer |

---

## 7. 테마 시스템

`src/theme.js`는 **이 도구 자체의 UI 색상**.
사용자가 만드는 앱의 색상과는 별개.

```javascript
// 다크 테마 (기본)
{ bg: "#08080C", card: "#18182a", tx: "#E8E8EE", ac: "#A094FF", ... }

// 라이트 테마
{ bg: "#E8E8E2", card: "#FFFFFF", tx: "#1a1a1a", ac: "#534AB7", ... }
```

테마 객체는 `t` prop으로 모든 컴포넌트에 전달됨.
`t.bg`, `t.card`, `t.tx`, `t.ac`, `t.t2`, `t.t3` 등.

---

## 8. 다음 작업자를 위한 우선순위

### 즉시 (P0)
1. **DesignTokenEditor 연결** — 파일은 있으나 App.jsx에서 import/렌더링 안 됨
2. **JsxRenderer Sandpack 모드 검증** — CDN 의존성 확인, 오프라인 대응

### 단기 (P1)
3. **Supabase 연동** — localStorage → DB 전환, 인증 추가
4. **GitHub API 연동** — 파일 읽기/쓰기/커밋/푸시
5. **이미지 색상 추출** — color-thief 패키지 설치 + Canvas API

### 중기 (P2)
6. **Editor.jsx 리팩터링** — 921줄 → 여러 파일로 분리
7. **TypeScript 전환** — 점진적 마이그레이션
8. **테스트 추가** — Vitest 설정
9. **에러 바운더리** — 컴포넌트별 에러 처리

---

## 9. 알려진 이슈

1. **Editor.jsx 크기** — 921줄, 분리 필요
2. **Props 드릴링** — Context API 또는 상태관리 라이브러리 도입 필요
3. **XSS 위험** — dangerouslySetInnerHTML 사용 (사용자 코드 전용이라 의도적)
4. **Sandpack CDN** — 오프라인/네트워크 불안정 시 JSX 렌더링 실패
5. **브라우저 호환** — EyeDropper API는 Chrome 95+ 전용
6. **성능** — 대량 프로젝트 시 가상화(virtualization) 필요

---

## 10. Git 정보

- **저장소:** https://github.com/dudmlwnqh/artifact-studio
- **브랜치:** main (작업 브랜치)
- **최신 커밋:** `077470f` (DesignTokenEditor 생성)
- **총 커밋:** 41개
- **상태:** Clean (미커밋 변경 없음)
