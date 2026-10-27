# 실시간 수학 클래스 웹 프로젝트

## 현재 단원: 명제와 증명 문제은행 (14문항)

현재 문제풀이는 `명제_문제은행.json`의 **14문항 4지선다와 풀이 빈칸**으로 교체했습니다. 선택한 답만 자동 채점하고, 빈칸은 모두 채웠는지로 문항 완료를 표시합니다. 빈칸 내용의 정오 여부는 자동 채점하지 않습니다. 질문·아이디어·교사 모니터링·최종 제출·CSV·지난 자료 삭제 구조와 클릭형 개념학습은 유지했습니다. 새 세트 ID는 `propositions-choice-v1`이며 기존 `propositions-v1` 및 `unit1-v1` 수업 기록을 보존합니다.

기존 Supabase 프로젝트에서는 아직 적용하지 않은 `001`~`004`만 번호순으로 적용한 뒤, `supabase/proposition-choice-bank-setup.sql`과 저장소 **밖**에 둔 `../명제_문제은행_정답_수파베이스_비공개.sql`을 순서대로 SQL Editor에서 실행합니다. 기존 프로젝트에 이미 적용한 SQL, 특히 `001_initial.sql`,을 다시 실행하지 마세요. 비공개 정답 SQL과 원본 문제은행 JSON은 GitHub에 올리지 마세요. 새 공개 웹 코드와 공개 설정 SQL만 업로드합니다.

문제풀이 공개 코드에는 정답 번호와 빈칸 정답이 없습니다. 서버는 선택지 ID `1`~`4`만 비교하고 학생에게 O/X와 점수를 반환합니다. **클릭형 개념학습 HTML에는 같은 주제의 풀이와 답이 포함되어 사이트에서 볼 수 있습니다.** 비밀 시험용으로 사용하지 마세요. 로컬 데모는 종전 단원 전용이므로 새 단원 확인에는 실제 Supabase 연결이 필요합니다. 기존 `propositions-v1` 수업이 진행 중이라면 종료한 뒤 새 코드를 배포하고 새 수업을 개설하세요.

기존 Google Apps Script 앱을 React + Vite + Supabase로 이전한 독립 웹 프로젝트입니다. 기존 폴더와 Apps Script 파일은 보존했습니다. 현재 학생 화면은 명제 14문항과 명제 클릭형 개념학습을 제공하며, 교사 대시보드, 질문·답글·아이디어 공유, 팝업 공지, 최종 제출·재제출, 제출 마감, 수업별 결과 CSV와 종료된 수업 자료 삭제 기능을 유지합니다. 학생이 수업에서 나가면 해당 학생·수업의 브라우저 답안 캐시는 삭제하지만 서버의 수업 기록은 유지합니다.

Google Sheets의 과거 학생 기록은 가져오지 않았습니다. 기존 Supabase 프로젝트에서는 적용하지 않은 마이그레이션을 번호 순서대로 실행합니다. 이미 적용한 파일은 다시 실행하지 않습니다.

## 1. 로컬에서 먼저 확인하기

Node.js 22 이상과 pnpm 11.25.0을 사용합니다. 터미널에서 이 README가 들어 있는 폴더를 열고 다음을 실행합니다.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

현재 4지선다 문제은행은 로컬 데모 자동 채점이 지원되지 않습니다. `VITE_DEMO_MODE=true`에서는 새 수업 개설을 막아 잘못된 채점 결과를 보여주지 않으므로, 새 단원은 실제 Supabase 연결로 확인하세요. 종전 13문항 데모 코드와 테스트는 회귀 검사용으로 보존했습니다.

```powershell
pnpm dev
```

`http://127.0.0.1:5173/`을 엽니다. 운영·명제 단원 확인에는 `VITE_DEMO_MODE=false`와 Supabase 프로젝트 URL·publishable key가 필요합니다. 교사와 학생은 다른 브라우저 프로필 또는 기기에서 시험하세요.

명령은 `pnpm test`(권한·데이터 검사), `pnpm build`(운영 빌드), `pnpm preview`(빌드 확인)도 제공합니다.

### 앞으로 문제은행 JSON을 다시 바꿀 때

원본 JSON에는 정답이 들어 있으므로 공개 저장소에 복사하지 않습니다. 다음 명령으로 공개 문제 데이터와 Supabase 공개 설정 SQL, 저장소 밖 비공개 정답 SQL을 다시 생성합니다. 문항 순서와 수가 달라지거나 이미 사용한 세트를 바꿀 때는 `scripts/import-proposition-bank.mjs`의 새 `problemSetId`를 먼저 정해 기존 수업 기록을 보호하세요.

```powershell
node scripts/import-proposition-bank.mjs 'C:\경로\명제_문제은행.json' '..\명제_문제은행_정답_수파베이스_비공개.sql'
pnpm test
pnpm build
```

## 2. Supabase 만들기

이미 사용 중인 Supabase 프로젝트에는 `001_initial.sql`을 다시 실행하지 않습니다. `002_student_identity.sql`~`004_proposition_problem_set.sql` 중 적용하지 않은 것만 번호 순서대로 실행한 뒤 `supabase/proposition-choice-bank-setup.sql`, 저장소 밖의 `명제_문제은행_정답_수파베이스_비공개.sql` 순서로 실행하고 웹 코드를 배포합니다. `002`는 학생 이름 입력 함수를 학년·반·번호 입력 함수로 교체하므로 수업이 없는 시간에 진행하세요. 아래 전체 절차는 새로운 프로젝트를 만들 때의 참고용입니다.

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인하고 새 Free 프로젝트를 만듭니다. 프로젝트 지역과 DB 비밀번호를 설정합니다.
2. SQL Editor에서 `supabase/migrations/001_initial.sql` 전체를 실행합니다. 이 스크립트는 신규 프로젝트에 한 번만 실행합니다. 기존 앱 테이블과 이름이 겹치는 프로젝트에서는 먼저 검토하세요.
3. 종전 13문항 세트도 유지하려면 `supabase/seed.sql`을 실행합니다. 현재 문제은행 수업만 운영한다면 생략할 수 있습니다.
4. `supabase/migrations/002_student_identity.sql`을 실행합니다. 기존 기록은 유지하고 새 학생의 학년·반·번호를 별도 열에 저장합니다.
5. `supabase/migrations/003_delete_past_session.sql`을 실행합니다. 종료된 수업을 해당 교사만 삭제할 수 있는 함수를 추가합니다.
6. `supabase/migrations/004_proposition_problem_set.sql`을 실행합니다. 이어서 `supabase/proposition-choice-bank-setup.sql`, 저장소 밖의 `명제_문제은행_정답_수파베이스_비공개.sql`을 실행합니다. 새 세트의 정답 14개가 없으면 수업을 개설할 수 없습니다. 이전 `propositions-v1` 세트를 계속 사용할 때만 기존 비공개 정답 SQL도 별도로 실행합니다.
7. Authentication에서 Anonymous Sign-Ins를 활성화합니다. 학생은 익명 인증을 이용해 학년·반·번호와 수업 코드를 입력하고 입장합니다.
8. Authentication → Users에서 교사의 이메일·비밀번호 사용자를 생성하고 사용자 UUID를 복사합니다. 공개 회원가입은 교사 권한을 부여하지 않습니다.
9. SQL Editor에서 아래 UUID를 실제 교사 UUID로 바꿔 실행합니다.

```sql
insert into public.teachers(user_id, display_name)
values ('실제-교사-사용자-UUID', '수학 선생님');
```

10. 프로젝트 Connect 또는 Settings → API Keys에서 프로젝트 URL과 **Publishable key**를 복사하여 `.env`를 완성합니다.

```env
VITE_SUPABASE_URL=https://프로젝트ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_공개키
VITE_DEMO_MODE=false
VITE_BASE_PATH=/
```

11. 개발 서버를 재시작합니다. 교사 이메일과 비밀번호로 로그인해 수업을 개설합니다. 실제 학생·교사 역할을 같은 PC에서 테스트하려면 별도 브라우저 프로필 또는 시크릿 창을 사용하세요. 같은 브라우저의 일반 탭은 실제 Supabase 로그인 정보를 공유합니다.

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

새 문제은행의 채점 정답은 운영 JavaScript 문제 데이터에 넣지 않고 서버에서 관리합니다. 제출 응답에는 O/X와 점수만 표시합니다. 공개되는 명제 클릭형 개념학습 HTML에는 같은 주제의 풀이와 정답이 포함되어 있으므로 비밀 시험용으로는 사용하지 마세요.

### 대안: GitHub Pages + Supabase

GitHub Actions 배포 파일 `.github/workflows/pages.yml`을 포함했습니다. Public 저장소에서는 종전 `seed.sql`·데모 파일의 정답과 개념학습 HTML의 풀이·정답도 누구나 볼 수 있습니다. **Supabase의 새 공개 설정 SQL과 저장소 밖 비공개 정답 SQL을 먼저 실행한 뒤 GitHub에 웹 코드를 업로드하세요.** 비공개 정답 SQL과 원본 JSON은 GitHub에 올리지 마세요. Pages 사용 가능 범위는 GitHub의 현재 요금제와 저장소 설정을 확인하세요.

1. GitHub 저장소 Settings → Pages → Source를 **GitHub Actions**로 선택합니다.
2. Settings → Secrets and variables → Actions → Variables에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`를 추가합니다. 둘 다 브라우저에 공개되는 설정입니다.
3. 일반 프로젝트 사이트는 기본 주소가 `/저장소이름/`입니다. 배포 작업이 이 경로를 자동 사용합니다. 사용자 사이트 또는 커스텀 도메인은 `VITE_BASE_PATH=/` 변수를 추가합니다.
4. Actions의 Deploy to GitHub Pages를 실행하거나 `main`에 변경사항을 올립니다. 빌드 전에 데이터·권한 검사를 자동 실행합니다.

교사는 모니터링 화면의 **수업별 자료 관리**에서 진행 중인 수업과 지난 수업의 결과를 CSV로 내려받을 수 있습니다. 종료된 수업은 확인창을 거쳐 자료 전체를 영구 삭제할 수 있으므로 CSV가 필요하면 먼저 내려받으세요. CSV는 미제출 학생도 포함하고, 제출자는 최신 최종 제출의 선택 답안·풀이 빈칸·채점 결과를 담습니다. 학년·반·번호는 별도 열입니다. 이전 버전에서 수집한 학생은 식별 문자열은 남지만 세 열이 비어 있을 수 있습니다. 학생은 입장 전 네 가지 활동 안내를 각각 확인해야 하며, 교사의 새 공지는 학생 화면에 팝업으로 표시됩니다.

## 데이터와 권한 구조

| 테이블 | 저장 내용 | 접근 |
|---|---|---|
| `teachers` | 승인된 교사 계정 | 본인 조회, 관리자는 SQL로 등록 |
| `problem_sets` | 문제 세트 정보 | 인증 사용자 조회 |
| `class_sessions` | 교사별 수업·코드·마감·공지 | 수업 교사와 참여 학생 |
| `participants` | 학생 학년·반·번호·진행률·제출 상태 | 같은 수업 참여자 |
| `student_answers` | 문항별 작성 중 답안 | 본인과 수업 교사 |
| `submissions` | 최근 제출·채점·수정 이유 | 본인과 수업 교사 |
| `ideas`, `questions` | 아이디어·질문·답글 | 같은 수업 참여자, 삭제는 교사 |
| `concept_learning_records` | 명제 클릭형 학습의 완료 기록(세부 클릭 수는 저장하지 않음) 및 종전 집합 개념학습 기록 | 본인과 수업 교사 |
| `private.answer_keys` | 채점용 정답 | 서버 함수만 접근 |

각 학생은 Supabase 사용자 UUID로 식별하고, 같은 수업에서 동일한 학년·반·번호는 한 번만 사용할 수 있습니다. 새 기기·시크릿 창·브라우저 데이터 삭제로 익명 인증이 사라지면 학년·반·번호만으로 이전 기록을 되찾을 수 없습니다. 별도 학생 계정이나 교사 승인 복구 기능은 향후 확장할 수 있습니다.

교사는 자신의 수업만 관리합니다. 새 수업 개설은 해당 교사의 이전 활성 수업을 종료합니다. 다른 교사의 수업에는 영향을 주지 않습니다. 수업 종료와 제출 마감은 서버가 검사합니다. 제출 후 작성 중 답안 변경은 허용하며, 재제출 시 수정 이유가 필요합니다. 최신 최종 제출을 갱신하는 기존 앱 동작을 유지합니다.

실시간 갱신은 `class_sessions`, `participants`, `submissions`, `ideas`, `questions`의 Postgres Changes를 이용합니다. 서버 초기화 파일에서 publication 등록을 처리하며, 연결 실패·이벤트 누락에 대비해 30초 간격과 탭 복귀 시 재조회합니다. 실제 Supabase의 Realtime 연결 검증은 클라우드 연결 후 필요합니다.

## 원본 및 검증

원본 위치는 `docs/source-manifest.json`에 기록했습니다. 원본 주요 7개 파일의 SHA-256을 함께 보관했으며 원본 파일을 수정하지 않았습니다. 원본 Google Sheets의 과거 데이터, 학습 유인물 생성 도구·유인물, 원본 문제 추출 문서는 새 앱으로 복사하지 않았습니다.

`pnpm test`는 로컬 PostgreSQL 엔진(PGlite)으로 실제 SQL 초기화·채점·입장·권한 정책을 검사합니다. Supabase Auth 및 Realtime 클라우드 서비스 자체의 검증은 아닙니다. 최신 확인 결과는 `docs/verification.md`에 정리합니다.

공식 안내: [Supabase 공개 키와 권한](https://supabase.com/docs/guides/getting-started/api-keys), [익명 인증과 제한](https://supabase.com/docs/guides/auth/auth-anonymous), [Realtime](https://supabase.com/docs/guides/realtime/postgres-changes), [GitHub Pages 제공 범위](https://docs.github.com/en/pages/getting-started-with-github-pages), [Vite 배포](https://vite.dev/guide/static-deploy.html).
