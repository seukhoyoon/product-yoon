# CLAUDE.md

## 프로젝트 개요
- 영업 보상 구조 자동화 SaaS 랜딩페이지
- 타겟: 스타트업 CEO / CRO
- GitHub repo: product-Yoon
- 기술 스택: Next.js 14 + TypeScript + Tailwind CSS + recharts

## 코딩 규칙
- 컴포넌트는 한국어 주석 포함
- 스타일은 Tailwind CSS 클래스만 사용 (inline style 절대 금지)
- 모바일 퍼스트 반응형 필수
- 새 외부 라이브러리 추가 시 반드시 먼저 물어볼 것

## 상태 관리 규칙
- 탭 간 공유가 필요한 state는 반드시 최상위 컴포넌트에서 관리
- 설정값은 localStorage에 저장하되, 변경 시 즉시 모든 탭에 반영
- props drilling 3단계 이상이면 Context 사용

## Tailwind 설정 체크리스트
- tailwind.config.ts content에 'src/components/**/*.{ts,tsx}' 포함 필수
- globals.css에 @tailwind base/components/utilities 3줄 필수
- 새 컴포넌트 만들면 반드시 위 두 항목 확인 후 진행

## 브랜드 톤
- 전문적이되 친근하게
- CTA는 항상 행동 동사로 시작
- 다크 테마 기본 (bg-slate-900)

## 작업 순서 원칙
1. 코드 수정 전 반드시 현재 파일 구조 먼저 확인
2. 로직 변경과 UI 변경은 분리해서 작업
3. 각 작업 후 npm run build 로 에러 확인
4. 에러 발생 시 원인 설명 후 수정
