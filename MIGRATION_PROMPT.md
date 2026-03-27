# Artifact Studio — 새 작업자용 마이그레이션 프롬프트

> 이 프롬프트를 새 Claude Code 세션에 붙여넣으면 프로젝트를 이어받을 수 있습니다.

---

## 프롬프트 (복사해서 사용)

```
너는 전문 프론트엔드/백엔드 엔지니어야.
"Artifact Studio"라는 React 18 + Vite 프로젝트를 이어서 작업해야 해.

## 프로젝트 개요
- AI 아티팩트 관리 대시보드 + 비주얼 코드 에디터
- 비전공자도 앱 UI를 설계·편집·관리할 수 있는 올인원 도구
- 기술: React 18 (JSX) + Vite 6 + localStorage (Supabase 전환 예정)

## 저장소
https://github.com/dudmlwnqh/artifact-studio (main 브랜치)

## 시작하기
cd artifact-studio && npm install && npm run dev
→ http://localhost:3000

## 반드시 먼저 읽어야 할 파일
1. MIGRATION.md — 전체 구조, 데이터 모델, 기능 상태, 알려진 이슈
2. src/App.jsx — 메인 앱 (5탭 라우팅: 아티팩트/컴포넌트/디자인자료/백엔드DB/외주담당자)
3. src/Editor.jsx — 핵심 비주얼 에디터 (921줄, 가장 복잡)
4. src/theme.js — 다크/라이트 테마 색상 (이 도구 자체의 UI)
5. src/data.js — 초기 데모 데이터 (3개 프로젝트)

## 핵심 파일 구조
```
src/
├── App.jsx              — 메인 (갤러리 + 5탭)
├── Editor.jsx           — 비주얼 에디터 (속성편집, 코드뷰, 인터랙션)
├── AddModal.jsx         — 프로젝트 추가 모달
├── data.js / theme.js / storage.js — 데이터/테마/저장
└── components/
    ├── PageViewer.jsx       — 카메라앨범 UX (시안 프리뷰)
    ├── StoryboardPanel.jsx  — 우측 패널 (스토리보드/파일/자료)
    ├── ProjectFiles.jsx     — 프로젝트 파일 관리
    ├── DesignToolPanel.jsx  — CSS 속성 편집 리모컨
    ├── JsxRenderer.jsx      — HTML/JSX/Sandpack 렌더러
    ├── ComponentTab.jsx     — UI 컴포넌트 라이브러리
    ├── SourceTab.jsx        — 디자인자료/백엔드/외주
    └── DesignTokenEditor.jsx — 디자인 토큰 편집기 (미연결)
```

## 데이터 모델 (핵심)
프로젝트: { id, name, emoji, bg, tags, pct, code, pages[], elements[], storyboard[], projectFiles{}, interactions[] }
컴포넌트: { id, name, cat, code, tags }
테마: dark/light 객체 → t prop으로 모든 컴포넌트에 전달

## 현재 상태 & 다음 할 일

### 즉시 해야 할 것 (P0)
1. DesignTokenEditor.jsx를 디자인 자료 탭에 연결
   - App.jsx에서 import → tab === "design"일 때 렌더링
   - 6종 프리셋 (토스/당근/노션/인스타/네이처/사이버핑크) 내장
   - 색상/글자/간격/둥글기/그림자 편집 + 라이브 프리뷰

2. JsxRenderer Sandpack 모드 검증
   - Sandpack CDN 의존성 확인
   - projectFiles prop 전달 시 멀티파일 번들링 동작 확인

### 그 다음 (P1)
3. Supabase 연동 (localStorage → DB, 인증)
4. GitHub API 연동 (파일 CRUD, 커밋/푸시)
5. 이미지 색상 추출 (color-thief + Canvas API)

### 중기 (P2)
6. Editor.jsx 분리 (921줄 → 모듈화)
7. TypeScript 전환
8. 테스트 추가 (Vitest)

## 주의사항
- Editor.jsx가 921줄로 가장 크고 복잡함. 수정 시 주의
- 모든 스타일은 인라인 (CSS 파일 없음). 테마 객체 t를 통해 색상 참조
- Slider, ColorInput 컴포넌트는 Editor.jsx 밖에 정의됨 (리렌더링 시 드래그 끊김 방지)
- localStorage 키: "projects", "sources", "uiComponents"
- 단축키: Ctrl+Z(undo), Ctrl+Shift+Z(redo), Ctrl+S(save), Ctrl+I(eyedropper), Esc(close)
```

---

## 사용 방법

### 클라우드 (Claude Code Web)에서 사용 시
1. 새 세션 열기
2. 위 프롬프트 전체를 첫 메시지로 붙여넣기
3. "MIGRATION.md 읽고 현재 상태 파악해줘"라고 요청
4. 이어서 작업 요청

### 로컬 (Claude Code CLI)에서 사용 시
1. `git clone https://github.com/dudmlwnqh/artifact-studio.git`
2. `cd artifact-studio`
3. `claude` 실행
4. 위 프롬프트 붙여넣기 또는 "MIGRATION.md 읽어줘"
5. 이어서 작업

### VS Code + Claude Code 확장에서 사용 시
1. VS Code에서 artifact-studio 폴더 열기
2. Claude Code 확장 활성화
3. 위 프롬프트 붙여넣기
4. 파일을 직접 보면서 작업 가능

---

## 핵심 컨텍스트 (작업자가 알아야 할 것)

### 이 프로젝트의 비전
- 비전공자(기획자, 디자이너)가 코드를 몰라도 앱 화면을 설계할 수 있는 도구
- Claude 아티팩트에서 만든 UI 코드를 붙여넣으면 실시간 렌더링
- 디자인 시스템(토큰) → 컴포넌트 → 페이지 시안 → 스토리보드 순서로 앱 설계
- 최종 목표: Supabase + GitHub 연동으로 실제 배포까지

### 사용자 페르소나
- 코딩을 모르는 기획자/디자이너
- Claude와 대화하며 코드를 받아서 이 도구에 붙여넣는 방식
- "시각적으로 보면서 수정"이 핵심 가치

### 디자인 원칙
- 포토샵/Figma처럼 직관적인 조작 (드래그, 더블클릭, 컬러피커)
- 코드는 보이지 않게 (비전공자 모드), 필요시 토글로 확인
- 카메라 앨범 UX로 시안 관리 (썸네일 스트립, 스와이프)
- 모든 변경사항 자동 저장
