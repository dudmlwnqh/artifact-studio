# Artifact Studio — 기술 설계 & 체크리스트

## 앱 목적 (한 문장)
**비전공자가 코드 없이, 웹 한 화면에서 앱 UI를 설계·편집·소스관리·배포까지 하는 올인원 스튜디오.**

---

## 1. 핵심 기술 인프라 (3대 연동)

### A. GitHub 연동 — 코드 파일 관리
```
필요 패키지: @octokit/rest (GitHub API)
인증: GitHub OAuth (Personal Access Token 또는 GitHub App)

기능:
├── 파일 읽기 (GET /repos/:owner/:repo/contents/:path)
├── 파일 쓰기 (PUT /repos/:owner/:repo/contents/:path)
├── 커밋 생성 (자동 커밋 메시지)
├── 브랜치 관리 (main, feature branches)
├── 파일 트리 표시 (좌측 사이드바)
└── Diff 보기 (변경사항 미리보기)

연동 대상 파일:
├── colors.js, typography.js, spacing.js (디자인 토큰)
├── theme.js (테마 설정)
├── App.jsx, 각종 컴포넌트 (시안 코드)
├── data.js (초기 데이터)
└── 이미지/에셋 파일 (GitHub LFS 또는 Supabase Storage)
```

### B. Supabase 연동 — DB + Auth + Storage
```
필요 패키지: @supabase/supabase-js

기능:
├── Auth: 사용자 로그인/회원가입 (이메일, GitHub OAuth)
├── Database:
│   ├── projects 테이블 — 프로젝트 메타데이터
│   ├── pages 테이블 — 시안/스토리보드
│   ├── components 테이블 — UI 컴포넌트 라이브러리
│   ├── design_tokens 테이블 — 색상/폰트/간격 세트
│   ├── sources 테이블 — 디자인 자료
│   ├── storyboards 테이블 — 스토리보드 스텝
│   └── contacts 테이블 — 외주/담당자
├── Storage:
│   ├── images/ — 캐릭터, 텍스쳐, 배경 이미지
│   ├── exports/ — 내보내기 파일
│   └── uploads/ — 사용자 업로드
└── Realtime: 실시간 저장 동기화
```

### C. Vercel 연동 — 배포
```
필요: Vercel API Token + 프로젝트 ID

기능:
├── 빌드 트리거 (Push 후 자동 배포)
├── 배포 상태 표시 (빌드 중/성공/실패)
├── 프리뷰 URL 생성 (PR별 미리보기)
└── 환경변수 관리 (API 키 등)
```

---

## 2. 소스 관리 — 디자인 소스 탭 설계

### 데이터 구조
```javascript
// design_token_set (세트 = 이름 붙여서 저장)
{
  id: "set_toss_dark",
  name: "토스 다크",
  description: "토스 스타일 다크모드",

  colors: {
    brand: { value: "#3182F6", label: "브랜드 메인" },
    brandSub: { value: "#1B64DA", label: "브랜드 보조" },
    bg: { value: "#0D0F1C", label: "기본 배경" },
    bgCard: { value: "#1B1D2E", label: "카드 배경" },
    text: { value: "#F2F4F6", label: "기본 텍스트" },
    success: { value: "#00C853", label: "성공" },
    warning: { value: "#FF9100", label: "경고" },
    error: { value: "#F44336", label: "위험" },
  },

  typography: {
    heading: { size: 20, weight: 700, family: "Pretendard", label: "제목" },
    subheading: { size: 16, weight: 600, family: "Pretendard", label: "부제목" },
    body: { size: 14, weight: 400, family: "Pretendard", label: "본문" },
    caption: { size: 11, weight: 400, family: "Pretendard", label: "캡션" },
  },

  spacing: {
    xs: { value: 4, label: "아주 작은" },
    sm: { value: 8, label: "작은" },
    md: { value: 16, label: "보통" },
    lg: { value: 24, label: "큰" },
    xl: { value: 32, label: "아주 큰" },
  },

  radius: {
    sm: { value: 4, label: "약간" },
    md: { value: 8, label: "보통" },
    lg: { value: 16, label: "둥근" },
    full: { value: 999, label: "원형" },
  },

  shadows: {
    none: { value: "none", label: "없음" },
    sm: { value: "0 1px 3px rgba(0,0,0,0.12)", label: "약한" },
    md: { value: "0 4px 12px rgba(0,0,0,0.15)", label: "중간" },
    lg: { value: "0 8px 24px rgba(0,0,0,0.2)", label: "강한" },
  },

  // GitHub 연동
  github: {
    colorsFile: "src/tokens/colors.js",
    typographyFile: "src/tokens/typography.js",
    spacingFile: "src/tokens/spacing.js",
  },

  createdAt: "2024-01-01",
  updatedAt: "2024-01-15",
}
```

### 기능 목록
```
[디자인 소스 탭]
├── 토큰 세트 관리
│   ├── 세트 목록 (이름, 미리보기, 날짜)
│   ├── 세트 추가 (프리셋 선택 / 이미지 추출 / 직접 만들기)
│   ├── 세트 복제 & 수정
│   ├── 세트 이름 변경
│   └── 세트 삭제
│
├── 토큰 편집기
│   ├── 색상 — 컬러피커 + 스포이드 + 그룹(브랜드/상태/배경/텍스트)
│   ├── 글자 — 크기/굵기/폰트/행간 슬라이더
│   ├── 간격 — 패딩/마진 시각적 바
│   ├── 둥글기 — 모서리 프리뷰
│   └── 그림자 — 프리셋 4종 + 커스텀
│
├── 라이브 프리뷰
│   ├── 앱 화면 미리보기 (토큰 적용된 모습)
│   ├── 부품별 미리보기 (버튼/카드/입력칸/배지)
│   └── 라이트/다크 토글
│
├── 프리셋 라이브러리 (모달)
│   ├── 6종 내장 (토스/당근/노션/인스타/네이처/사이버핑크)
│   ├── JSON 가져오기/내보내기
│   └── 커뮤니티 공유 (Supabase 연동 후)
│
├── 이미지 색상 추출 (모달)
│   ├── 이미지 드래그&드롭 업로드
│   ├── Canvas API + color-thief로 대표색 추출
│   ├── HSL 분석 → 따뜻한톤/차가운톤/포인트/고대비 자동 분류
│   ├── 랜덤 셔플 (팔레트 라인 내에서 역할 무작위 배치)
│   └── 스포이드 모드 (클릭한 픽셀 색상 선택)
│
├── GitHub 연동
│   ├── colors.js / typography.js / spacing.js 직접 읽기/쓰기
│   ├── 토큰 수정 → GitHub 자동 커밋
│   └── GitHub에서 변경 → 앱에 자동 반영
│
└── 활용
    ├── 복사 — 토큰 값 클립보드 복사
    ├── 선택해서 쓰기 — 시안 편집 시 토큰 참조
    ├── 일괄 입히기 — 선택한 세트를 프로젝트 전체에 적용
    └── 내보내기 — JSON / CSS Variables / Tailwind config
```

---

## 3. JSX 풀 렌더링 설계

### 문제
App.jsx를 시안에 넣으면 import하는 파일들(theme.js, data.js 등)이 없어서 에러.

### 해결: 프로젝트 파일 시스템
```
웹 앱 내에서 관리하는 파일들:
├── /App.jsx          ← 시안 코드 (사용자가 붙여넣기)
├── /theme.js         ← 디자인 소스 탭에서 생성/수정
├── /data.js          ← 초기 데이터 (편집 가능)
├── /storage.js       ← 저장소 연결 설정
├── /components/      ← 컴포넌트 탭에서 생성한 것들
│   ├── Button.jsx
│   ├── Card.jsx
│   └── Modal.jsx
└── /utils/           ← 유틸리티 함수

렌더링 방식:
1. 사용자가 App.jsx 붙여넣기
2. import 구문 분석 → 필요한 파일 목록 추출
3. 프로젝트 파일에서 해당 파일 찾기
4. 모든 파일을 Sandpack에 전달 → 멀티파일 번들링 → 렌더링
5. 파일이 없으면 → "이 파일이 필요합니다" 안내 + 추가 UI
```

### import 자동 해석 흐름
```
사용자 코드: import { dark } from "./theme.js"
                    ↓
import 파싱: "./theme.js" 필요
                    ↓
프로젝트 파일 검색: projectFiles["theme.js"] 있음?
                    ↓
  ├── 있음 → Sandpack files에 포함
  └── 없음 → "theme.js 파일을 추가해주세요" 안내
              ├── 디자인 소스 탭에서 자동 생성 (토큰 → theme.js)
              └── 직접 코드 입력
```

---

## 4. 체크리스트

### Phase 1: 기반 인프라 (필수)
- [ ] Supabase 프로젝트 생성 & 환경변수 설정
- [ ] Supabase Auth 연동 (GitHub OAuth)
- [ ] DB 테이블 생성 (projects, pages, components, design_tokens, sources)
- [ ] localStorage → Supabase 마이그레이션 (storage.js 교체)
- [ ] Supabase Storage 버킷 생성 (images, uploads)
- [ ] GitHub OAuth 앱 등록 & Personal Access Token 관리

### Phase 2: GitHub 연동
- [ ] @octokit/rest 설치 & 초기화
- [ ] GitHub 인증 플로우 (PAT 입력 또는 OAuth)
- [ ] 파일 트리 읽기 (저장소 내용 표시)
- [ ] 파일 읽기/쓰기 API 래퍼
- [ ] 커밋 생성 (자동 메시지)
- [ ] 푸시 기능
- [ ] 브랜치 목록/전환
- [ ] 좌측 사이드바에 파일 탐색기 UI

### Phase 3: 디자인 토큰 시스템
- [ ] DesignTokenEditor 연결 (App.jsx → 디자인 자료 탭)
- [ ] 토큰 세트 CRUD (Supabase 저장)
- [ ] 색상 편집기 (컬러피커 + 그룹)
- [ ] 타이포그래피 편집기 (크기/굵기/폰트)
- [ ] 간격/둥글기/그림자 편집기
- [ ] 라이브 프리뷰 (토큰 → 앱 화면)
- [ ] 프리셋 라이브러리 (6종 내장)
- [ ] 프리셋 JSON 가져오기/내보내기
- [ ] 랜덤 셔플 & 되돌리기
- [ ] color-thief 설치 & 이미지 색상 추출
- [ ] 토큰 → GitHub 파일 자동 동기화 (colors.js 등)

### Phase 4: JSX 풀 렌더링
- [ ] import 구문 파서 (코드에서 import 경로 추출)
- [ ] 프로젝트 파일 → Sandpack files 변환
- [ ] 누락 파일 감지 & 안내 UI
- [ ] 토큰 세트 → theme.js 자동 생성
- [ ] 컴포넌트 라이브러리 → import 가능한 파일로 변환

### Phase 5: Vercel 연동
- [ ] Vercel API 토큰 입력 UI
- [ ] 배포 트리거 (GitHub push 후)
- [ ] 배포 상태 표시 (빌드중/성공/실패)
- [ ] 프리뷰 URL 표시

### Phase 6: 고급 기능
- [ ] 에셋 업로드 (이미지, 텍스쳐 → Supabase Storage)
- [ ] 캐릭터/고정 파일 관리
- [ ] API 연동 관리 탭 (엔드포인트, 키, 테스트)
- [ ] 버전 관리 (스냅샷 저장/복원)
- [ ] 다중 사용자 협업 (Supabase Realtime)
- [ ] 커뮤니티 프리셋 공유 갤러리

---

## 5. Supabase DB 스키마 (초안)

```sql
-- 사용자
create table profiles (
  id uuid references auth.users primary key,
  display_name text,
  avatar_url text,
  github_token text,  -- 암호화 저장
  vercel_token text,
  created_at timestamptz default now()
);

-- 프로젝트
create table projects (
  id text primary key,
  user_id uuid references profiles(id),
  name text not null,
  emoji text,
  bg text,
  pri text,
  pri_color text,
  tags text[],
  pct integer default 0,
  code text,
  github_repo text,     -- 연결된 GitHub 저장소
  vercel_project text,  -- 연결된 Vercel 프로젝트
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 페이지 (시안/스토리보드)
create table pages (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  name text,
  type text check (type in ('시안', '스토리보드')),
  code text,
  sort_order integer,
  created_at timestamptz default now()
);

-- 디자인 토큰 세트
create table design_token_sets (
  id text primary key,
  user_id uuid references profiles(id),
  name text not null,
  description text,
  colors jsonb,
  typography jsonb,
  spacing jsonb,
  radius jsonb,
  shadows jsonb,
  is_preset boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- UI 컴포넌트
create table ui_components (
  id text primary key,
  user_id uuid references profiles(id),
  name text,
  category text,
  code text,
  tags text[],
  created_at timestamptz default now()
);

-- 디자인 자료
create table design_assets (
  id text primary key,
  user_id uuid references profiles(id),
  name text,
  category text,
  file_type text,
  file_url text,       -- Supabase Storage URL
  preview_code text,   -- HTML 미리보기
  tags text[],
  created_at timestamptz default now()
);

-- 프로젝트 파일 (import 지원)
create table project_files (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  filename text,
  code text,
  file_type text,
  label text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS 정책
alter table projects enable row level security;
create policy "Users can CRUD own projects"
  on projects for all using (auth.uid() = user_id);
-- (나머지 테이블도 동일 패턴)
```

---

## 6. 프롬프트 설계안 (다음 세션용)

### 세션 1: Supabase 기반 구축
```
Artifact Studio 프로젝트를 이어서 작업합니다.
MIGRATION.md와 TECH_DESIGN.md를 먼저 읽어주세요.

이번 세션 목표:
1. Supabase 프로젝트 연결 (@supabase/supabase-js 설치)
2. src/lib/supabase.js 생성 (클라이언트 초기화)
3. storage.js를 Supabase로 교체 (localStorage → DB)
4. 기존 데이터 마이그레이션 (INIT_PROJECTS → Supabase)
5. 로그인 UI 추가 (Supabase Auth, GitHub OAuth)

Supabase 프로젝트 URL: [여기에 입력]
Supabase Anon Key: [여기에 입력]
```

### 세션 2: GitHub 연동
```
Artifact Studio 프로젝트를 이어서 작업합니다.

이번 세션 목표:
1. @octokit/rest 설치
2. GitHub OAuth 인증 플로우 (PAT 저장)
3. 파일 트리 읽기 API
4. 파일 읽기/쓰기/커밋 기능
5. 에디터 좌측에 GitHub 파일 탐색기 사이드바 추가

GitHub 저장소: dudmlwnqh/artifact-studio
```

### 세션 3: 디자인 토큰 시스템
```
Artifact Studio 프로젝트를 이어서 작업합니다.

이번 세션 목표:
1. DesignTokenEditor.jsx를 디자인 자료 탭에 연결
2. 토큰 세트 CRUD (Supabase 저장)
3. 색상 편집기 완성 (컬러피커 + 그룹 + 스포이드)
4. 프리셋 JSON 가져오기/내보내기
5. 토큰 → theme.js 자동 생성 → GitHub 커밋
6. color-thief 설치 & 이미지 색상 추출
7. 랜덤 셔플 기능

참고: TECH_DESIGN.md의 "디자인 소스 탭 설계" 섹션
```

### 세션 4: JSX 풀 렌더링 + Vercel
```
Artifact Studio 프로젝트를 이어서 작업합니다.

이번 세션 목표:
1. import 구문 파서 구현 (코드에서 import 경로 추출)
2. 프로젝트 파일 + GitHub 파일 → Sandpack files 통합
3. 누락 파일 감지 & 자동 안내
4. App.jsx 넣으면 모든 import 해결되어 렌더링
5. Vercel API 연동 (배포 트리거, 상태 표시)
```

---

## 7. 페이지 구조 (최종 목표)

```
┌─────────────────────────────────────────────────────────┐
│ 헤더: 로고 | 검색 | [GitHub ✓] [Supabase ✓] [Vercel ✓] │
├─────────────────────────────────────────────────────────┤
│ 탭: 아티팩트 | 컴포넌트 | 디자인소스 | 백엔드·DB | 외주  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [아티팩트]  프로젝트 카드 그리드                          │
│             → 클릭 → 에디터                              │
│                                                         │
│  [컴포넌트]  UI 조각 라이브러리 (드래그&드롭 조합)         │
│                                                         │
│  [디자인소스] 토큰 에디터 | 프리셋 | 이미지 추출           │
│              색상·글자·간격·둥글기·그림자                   │
│              GitHub 파일 직접 동기화                       │
│                                                         │
│  [백엔드·DB] Supabase 테이블 관리                        │
│              API 엔드포인트 설정                           │
│              환경변수 관리                                 │
│                                                         │
│  [외주·담당자] 연락처 + 작업 상태 + 일정                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ 에디터 (프로젝트 진입 시):                                │
│ ┌──────────┬───────────────┬──────────────────┐         │
│ │ GitHub   │ 시안 미리보기  │ 스토리보드        │         │
│ │ 파일     │ (카메라 앨범)  │ + 파일 관리       │         │
│ │ 탐색기   │               │ + 자료 업로드      │         │
│ │          │ ← 토큰 적용 →│                    │         │
│ │          │               │                    │         │
│ │          │ [편집] 클릭 →  │                    │         │
│ │          │ 디자인 리모컨  │                    │         │
│ └──────────┴───────────────┴──────────────────┘         │
├─────────────────────────────────────────────────────────┤
│ 하단: 배포 상태 | 마지막 저장 | 마지막 커밋               │
└─────────────────────────────────────────────────────────┘
```
