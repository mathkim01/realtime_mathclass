# 실시간 수학 클래스 웹 프로젝트

기존 Google Apps Script 앱을 React + Vite + Supabase로 이전한 독립 웹 프로젝트입니다. 기존 폴더와 Apps Script 파일은 보존했습니다. 문제 풀이 13문항, 집합 개념학습, 교사 대시보드, 질문·답글·아이디어 공유, 공지, 최종 제출·재제출, 제출 마감 기능을 제공합니다.

현재 상태: 로컬 Git 저장소와 앱 코드, 기존 Supabase 프로젝트 연결 및 데이터베이스 초기화가 준비되었습니다. 학생 익명 로그인과 기본 권한 검사를 통과했습니다. 교사 계정 생성·권한 등록과 실제 수업 테스트는 남아 있습니다. GitHub 업로드·배포는 사용자가 진행하며, Google Sheets의 과거 학생 기록은 아직 가져오지 않았습니다.

## 1. 로컬에서 먼저 확인하기

Node.js 22 이상과 pnpm 11.25.0을 사용합니다. 터미널에서 이 README가 들어 있는 폴더를 열고 다음을 실행합니다.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

화면을 먼저 체험하려면 `.env`의 `VITE_DEMO_MODE=true`로 바꾸고 실행합니다.

```powershell
pnpm dev
```

`http://127.0.0.1:5173/`을 엽니다. 데모에서 교사 로그인 → 새 수업을 개설하면 코드가 나옵니다. 학생 체험은 다른 새 탭에서 같은 코드를 입력합니다. 데모는 동일 브라우저에만 저장되며 다른 PC와 연결되지 않습니다. 실제 배포에서는 `VITE_DEMO_MODE=false`를 사용합니다.

명령은 `pnpm test`(권한·데이터 검사), `pnpm build`(운영 빌드), `pnpm preview`(빌드 확인)도 제공합니다.

## 2. Supabase 만들기

현재 연결한 프로젝트 `iiojgpaabvfghglptuzh`는 아래 2~4번 초기화가 이미 완료되어 있습니다. 로컬 `.env` 연결도 설정되어 있으므로 초기화 SQL을 재실행하지 말고, 5~6번 교사 계정 생성·등록부터 진행하세요. 아래 전체 절차는 다른 신규 프로젝트를 만들 때의 참고용입니다.

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인하고 새 Free 프로젝트를 만듭니다. 프로젝트 지역과 DB 비밀번호를 설정합니다.
2. SQL Editor에서 `supabase/migrations/001_initial.sql` 전체를 실행합니다. 이 스크립트는 신규 프로젝트에 한 번만 실행합니다. 기존 앱 테이블과 이름이 겹치는 프로젝트에서는 먼저 검토하세요.
3. 이어서 `supabase/seed.sql`을 실행합니다. 13문항의 문제 세트 정보와 서버 채점용 정답을 등록합니다. 이 파일은 다시 실행해도 동일 정답을 갱신합니다.
4. Authentication에서 Anonymous Sign-Ins를 활성화합니다. 학생은 익명 인증을 이용해 이름과 수업 코드만 입력하고 입장합니다.
5. Authentication → Users에서 교사의 이메일·비밀번호 사용자를 생성하고 사용자 UUID를 복사합니다. 공개 회원가입은 교사 권한을 부여하지 않습니다.
6. SQL Editor에서 아래 UUID를 실제 교사 UUID로 바꿔 실행합니다.

```sql
insert into public.teachers(user_id, display_name)
values ('실제-교사-사용자-UUID', '수학 선생님');
```

7. 프로젝트 Connect 또는 Settings → API Keys에서 프로젝트 URL과 **Publishable key**를 복사하여 `.env`를 완성합니다.

```env
VITE_SUPABASE_URL=https://프로젝트ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_공개키
VITE_DEMO_MODE=false
VITE_BASE_PATH=/
```

8. 개발 서버를 재시작합니다. 교사 이메일과 비밀번호로 로그인해 수업을 개설합니다. 실제 학생·교사 역할을 같은 PC에서 테스트하려면 별도 브라우저 프로필 또는 시크릿 창을 사용하세요. 같은 브라우저의 일반 탭은 실제 Supabase 로그인 정보를 공유합니다.

`secret`, `service_role`, DB 비밀번호는 프론트엔드 환경 변수에 넣지 않습니다. `VITE_` 변수는 빌드하면 브라우저에 공개됩니다. 공개 키는 사용자 인증과 DB 권한 정책을 함께 적용해 사용합니다.

### 학교에서 동시에 접속할 때

익명 인증은 기본적으로 IP당 시간당 30회 제한이 있습니다. 한 교실이 같은 공용 IP를 쓰면 학생 수에 따라 첫 입장이 막힐 수 있습니다. 첫 수업 전에 Supabase Auth Rate Limits를 예상 동시 인원과 사용 방식에 맞게 설정하고 실제 학교 네트워크에서 테스트하세요. 로그인 정보가 남아 있는 재접속은 새 익명 계정을 만들지 않습니다.

인터넷에 널리 공개할 때는 [Supabase의 CAPTCHA 권장 사항](https://supabase.com/docs/guides/auth/auth-anonymous)을 검토하세요. 현재 앱에는 CAPTCHA 입력 연동이 포함되어 있지 않으므로 CAPTCHA 보호를 활성화한다면 학생 입장 화면에 연동을 추가해야 합니다. 학생의 수업 코드 입력은 계정당 1분 10회로 서버에서 제한합니다.

## 3. GitHub에 새 저장소 올리기

새 저장소 이름 예시는 `math-classroom-web`입니다. 기존 Apps Script 저장소와 분리합니다. 정답 초기화 SQL과 데모 정답이 들어 있으므로 **Private 저장소를 권장합니다**. 학생 이름이나 답안 데이터는 저장소에 넣지 않습니다.

1. [GitHub 새 저장소](https://github.com/new)에서 빈 저장소를 만듭니다. README·라이선스·gitignore 자동 생성은 끕니다.
2. 로컬 프로젝트는 `main` 브랜치로 Git 초기화되어 있습니다. 본인의 Git 작성자 정보가 필요하다면 해당 저장소에만 설정합니다.

```powershell
git config user.name "본인 이름"
git config user.email "본인 GitHub 이메일 또는 GitHub noreply 주소"
git add .
git commit -m "Create Supabase math classroom web app"
git remote add origin https://github.com/본인계정/math-classroom-web.git
git push -u origin main
```

로그인은 GitHub의 정상 인증 화면에서 진행합니다. 토큰·비밀번호를 저장소나 README에 적지 않습니다. `.env`, `node_modules`, `dist`는 Git에서 제외됩니다.

## 4. 배포하기

### 권장: GitHub Private + Vercel + Supabase

1. Vercel에서 GitHub 저장소를 Import합니다.
2. Framework는 Vite, Build Command는 `pnpm build`, Output Directory는 `dist`로 설정합니다.
3. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DEMO_MODE=false`, `VITE_BASE_PATH=/`를 넣습니다.
4. Deploy를 실행합니다. 이후 GitHub `main`에 올리는 변경사항을 자동 배포합니다.
5. 실제 주소에서 교사 로그인, 학생 입장, 저장·질문·공지·마감·종료를 서로 다른 기기로 확인합니다.

문제의 정답은 운영 JavaScript 파일에 포함하지 않고 서버에서 채점합니다. 다만 **현재 수업용 동작은 첫 제출 후 정오표에서 정답을 제공합니다**. 정답을 끝까지 숨겨야 하는 시험 용도로 쓰려면 공개 시점을 별도로 바꿔야 합니다.

### 대안: GitHub Pages + Supabase

GitHub Actions 배포 파일 `.github/workflows/pages.yml`을 포함했습니다. GitHub Free에서 Pages를 사용하려면 일반적으로 Public 저장소가 필요합니다. Public 저장소에서는 `seed.sql`과 데모 파일의 정답도 누구나 볼 수 있습니다. 정답 공개가 괜찮은 연습용 앱에 적합합니다.

1. GitHub 저장소 Settings → Pages → Source를 **GitHub Actions**로 선택합니다.
2. Settings → Secrets and variables → Actions → Variables에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`를 추가합니다. 둘 다 브라우저에 공개되는 설정입니다.
3. 일반 프로젝트 사이트는 기본 주소가 `/저장소이름/`입니다. 배포 작업이 이 경로를 자동 사용합니다. 사용자 사이트 또는 커스텀 도메인은 `VITE_BASE_PATH=/` 변수를 추가합니다.
4. Actions의 Deploy to GitHub Pages를 실행하거나 `main`에 변경사항을 올립니다. 빌드 전에 데이터·권한 검사를 자동 실행합니다.

## 데이터와 권한 구조

| 테이블 | 저장 내용 | 접근 |
|---|---|---|
| `teachers` | 승인된 교사 계정 | 본인 조회, 관리자는 SQL로 등록 |
| `problem_sets` | 문제 세트 정보 | 인증 사용자 조회 |
| `class_sessions` | 교사별 수업·코드·마감·공지 | 수업 교사와 참여 학생 |
| `participants` | 학생 이름·진행률·제출 상태 | 같은 수업 참여자 |
| `student_answers` | 문항별 작성 중 답안 | 본인과 수업 교사 |
| `submissions` | 최근 제출·채점·수정 이유 | 본인과 수업 교사 |
| `ideas`, `questions` | 아이디어·질문·답글 | 같은 수업 참여자, 삭제는 교사 |
| `concept_learning_records` | 집합 개념학습 기록 | 본인과 수업 교사 |
| `private.answer_keys` | 채점용 정답 | 서버 함수만 접근 |

각 학생은 이름이 아닌 Supabase 사용자 UUID로 식별합니다. 동일 이름으로 다른 사람의 기록을 덮어쓰지 못합니다. 같은 학번·이름은 수업당 하나만 허용합니다. 새 기기·시크릿 창·브라우저 데이터 삭제로 익명 인증이 사라지면 이름만으로 이전 기록을 되찾을 수 없습니다. 별도 학생 계정이나 교사 승인 복구 기능은 향후 확장할 수 있습니다.

교사는 자신의 수업만 관리합니다. 새 수업 개설은 해당 교사의 이전 활성 수업을 종료합니다. 다른 교사의 수업에는 영향을 주지 않습니다. 수업 종료와 제출 마감은 서버가 검사합니다. 제출 후 작성 중 답안 변경은 허용하며, 재제출 시 수정 이유가 필요합니다. 최신 최종 제출을 갱신하는 기존 앱 동작을 유지합니다.

실시간 갱신은 `class_sessions`, `participants`, `submissions`, `ideas`, `questions`의 Postgres Changes를 이용합니다. 서버 초기화 파일에서 publication 등록을 처리하며, 연결 실패·이벤트 누락에 대비해 30초 간격과 탭 복귀 시 재조회합니다. 실제 Supabase의 Realtime 연결 검증은 클라우드 연결 후 필요합니다.

## 원본 및 검증

원본 위치는 `docs/source-manifest.json`에 기록했습니다. 원본 주요 7개 파일의 SHA-256을 함께 보관했으며 원본 파일을 수정하지 않았습니다. 원본 Google Sheets의 과거 데이터, 학습 유인물 생성 도구·유인물, 원본 문제 추출 문서는 새 앱으로 복사하지 않았습니다.

`pnpm test`는 로컬 PostgreSQL 엔진(PGlite)으로 실제 SQL 초기화·채점·입장·권한 정책을 검사합니다. Supabase Auth 및 Realtime 클라우드 서비스 자체의 검증은 아닙니다. 최신 확인 결과는 `docs/verification.md`에 정리합니다.

공식 안내: [Supabase 공개 키와 권한](https://supabase.com/docs/guides/getting-started/api-keys), [익명 인증과 제한](https://supabase.com/docs/guides/auth/auth-anonymous), [Realtime](https://supabase.com/docs/guides/realtime/postgres-changes), [GitHub Pages 제공 범위](https://docs.github.com/en/pages/getting-started-with-github-pages), [Vite 배포](https://vite.dev/guide/static-deploy.html).
