# Artifact Studio

AI 아티팩트 관리 대시보드 + 비주얼 코드 에디터

## 설치 및 실행

```bash
# 1. 프로젝트 폴더로 이동
cd artifact-studio

# 2. 패키지 설치
npm install

# 3. 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000` 자동 열림.

## 구조

```
artifact-studio/
├── index.html          # HTML 진입점
├── package.json        # 의존성
├── vite.config.js      # Vite 설정
└── src/
    ├── main.jsx        # React 진입점
    ├── App.jsx         # 메인 앱 (갤러리 + 라우팅)
    ├── Editor.jsx      # 비주얼 코드 에디터
    ├── AddModal.jsx    # 프로젝트 추가 모달
    ├── theme.js        # 다크/라이트 테마 색상
    ├── data.js         # 초기 프로젝트 데이터
    └── storage.js      # localStorage 래퍼
```

## 현재 작동하는 기능

- 프로젝트 갤러리 (카메라 앨범 그리드, 확대/축소 3단계)
- 기본/상세 모드 토글
- 다크/라이트 모드
- 프로젝트 추가 (이름, 이모지, 배경색, 태그, 초기 코드)
- 프로젝트 삭제 (상세 모드에서 × 클릭)
- 비주얼 코드 에디터 (요소 선택 → CSS 속성 실시간 편집)
- 코드 복사
- 검색 필터링
- localStorage 자동 저장/불러오기
- 소스 탭 (디자인 자료 카드 그리드)

## 다음 구현 단계

- [ ] 인터랙션 편집 (트리거→액션 매핑)
- [ ] DB 연결 (Supabase 바인딩)
- [ ] 버전 관리 (스냅샷 저장/복원)
- [ ] Vercel 배포 연동
- [ ] AI 챗봇 코드 생성
- [ ] 푸시 알림 (FCM)

## Claude Code로 작업하기

Claude Code를 사용하면 이 프로젝트를 직접 실행하고 
에러를 보면서 수정할 수 있습니다:

```bash
# Claude Code 설치
npm install -g @anthropic-ai/claude-code

# 프로젝트 폴더에서 실행
cd artifact-studio
claude

# Claude Code에게 요청 예시:
# "npm run dev로 서버 띄우고 에러 확인해줘"
# "인터랙션 편집 기능 추가해줘"
# "Supabase 연동해줘"
```
