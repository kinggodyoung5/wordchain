# 🔤 끝말잇기

빌드 도구 없이 순수 HTML/CSS/JS로 만든 끝말잇기 웹 게임입니다.

- **싱글 모드**: 봇과 1대1 끝말잇기, 난이도 3단계(쉬움/보통/어려움)로 봇이 꺼내는 단어 범위가 달라짐
- **대결 모드**: Firebase Realtime Database로 여러 명이 실시간 동시 접속해 순서대로 진행
- 단어 검증: 표준국어대사전 기반 명사 약 18만 개 (2~3글자 위주, 고유명사 일부 제외)
- 비속어 필터: 리스트 기반 거부
- 시작 글자 비교: 기본은 마지막 글자 그대로 비교, 두음법칙(ㄴ/ㄹ 어두 변형)만 규칙 기반으로 추가 허용 — 그 외 복잡한 자모 처리는 없음
- 완전 무료 (Firebase Spark 무료 요금제로 충분)

### 난이도별 봇 단어 풀

봇은 "생각"하지 않고 즉시 사전에서 골라 답하기 때문에, 쉬움 난이도에서도 사람이 이길 수 있도록 실제 사용빈도 기준으로 풀 크기를 나눴습니다.

| 난이도 | 단어 수 | 기준 |
|---|---|---|
| 쉬움 | 700개 | 국립국어원 "한국어 학습용 어휘"(2004)에서 고유명사를 제외하고 실제 사용빈도 순위로 정렬한 상위 700개 |
| 보통 | 3,036개 | 같은 학습용 어휘 전체(고유명사 제외) |
| 어려움 | 182,963개 | 표준국어대사전 명사 전체 |

쉬움/보통은 실제 빈도 데이터 + 고유명사 제거를 거쳤지만, 어려움(전체 사전)은 표준국어대사전 명사를 그대로 쓰기 때문에 잘 알려지지 않은 지명·인명이 일부 섞여 있을 수 있습니다. (완전한 고유명사 제거는 개체명 인식 데이터가 필요해 아직 하지 못했습니다.)

### 데이터 출처

- 단어 목록: [han-dle/pd-korean-noun-list-for-wordles](https://github.com/han-dle/pd-korean-noun-list-for-wordles) (CC0, 공개 도메인) — `AllNouns`/`CommonNouns`에서 2글자 이상 한글 명사만 추출해 `src/data/words-full.json`(검증용, 어려움 풀), `src/data/words-common.json`(보통 풀)으로 가공했습니다.
- 사용빈도 순위: [한국어 위키낱말사전 "부록:자주 쓰이는 한국어 낱말 5800"](https://ko.wiktionary.org/wiki/%EB%B6%80%EB%A1%9D:%EC%9E%90%EC%A3%BC_%EC%93%B0%EC%9D%B4%EB%8A%94_%ED%95%9C%EA%B5%AD%EC%96%B4_%EB%82%B1%EB%A7%90_5800) — 국립국어연구원이 2004년 발표한 "한국어 학습용 어휘" 6,000개에서 고유명사를 뺀 5,888개를 실제 사용빈도 순으로 정리한 자료입니다. 이 순위와 우리 명사 사전을 교차 대조해 상위 700개를 뽑아 `src/data/words-easy.json`(쉬움 풀)으로 만들었습니다.
- 고유명사 제거: 위 빈도 목록(이미 고유명사 제거됨)에 없는 `words-common.json` 단어 63개를 직접 검토해 지명·국가명·왕조명 등 고유명사로 확인된 것만 골라 `words-common.json`/`words-full.json`에서 제외했습니다 (예: 서울, 부산, 미국, 신라, 세종대왕 등). 전체 사전(18만여 개)까지 완전히 정리한 것은 아닙니다.
- 비속어 목록: [LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) `ko` 파일 기반, 오탐 소지가 있는 일부 항목(고유 의미가 있는 일반 단어)은 제외하고 `src/data/profanity.json`으로 정리했습니다.

## 빠른 시작 (로컬에서 실행)

빌드 과정이 없으므로 정적 파일 서버만 있으면 됩니다.

```bash
# Node가 있다면
npx serve .

# Python이 있다면
python -m http.server 8080
```

브라우저에서 `http://localhost:8080` 접속. **싱글 모드는 Firebase 설정 없이 바로 플레이 가능**합니다.

대결 모드를 쓰려면 Firebase 프로젝트 연결이 필요합니다 → [docs/SETUP.md](docs/SETUP.md) 참고.

## 프로젝트 구조

```
index.html              화면 마크업 (메뉴/싱글/대결 로비·대기실·게임)
style.css               전체 스타일
src/
  main.js                라우팅 + 부트스트랩
  data/
    words.js              사전 로딩 + 난이도별 풀 구성
    words-easy.json         쉬움 풀 (사용빈도 상위 700 단어)
    words-common.json      보통 풀 / 시작 단어용 (~3천 단어, 고유명사 제외)
    words-full.json        어려움 풀 / 전체 검증 사전 (~18만 단어)
    profanity.js/.json     비속어 필터
  game/
    engine.js              단어 검증 규칙 (순수 함수)
    single.js               싱글 모드(봇) 로직
    multi.js                 대결 모드 로직 (Firebase RTDB 연동)
  firebase/
    firebaseConfig.js        중앙화 기본 설정 + 분산화(localStorage) 오버라이드
    firebaseClient.js        Firebase 지연 초기화 + 익명 로그인
database.rules.json     Realtime Database 보안 규칙
firebase.json           Firebase Hosting/DB 배포 설정
```

## Firebase 설정: 중앙화 + 분산화

- **중앙화**: `src/firebase/firebaseConfig.js`의 `CENTRAL_FIREBASE_CONFIG`에 저장소 전체가 공유하는 기본 Firebase 프로젝트 값을 채워 넣습니다. 저장소를 클론한 누구나 별도 설정 없이 같은 백엔드로 대결할 수 있습니다.
- **분산화**: 앱 우측 상단 ⚙️ 버튼 → 자신의 Firebase 프로젝트 config JSON을 붙여넣으면 **이 브라우저에만** 저장(localStorage)되어, 저장소를 건드리지 않고 개인 프로젝트로 테스트할 수 있습니다. "중앙 설정으로 초기화" 버튼으로 언제든 되돌릴 수 있습니다.

Firebase 웹 config 값(apiKey 등)은 비밀값이 아니라 클라이언트에 공개되는 식별자입니다 (보안은 Realtime Database 규칙이 담당). 그래도 프로젝트를 실제로 공개 배포한다면 `database.rules.json`을 반드시 함께 배포하세요.

## 다른 PC에서 이어서 개발하기

이 저장소는 Git으로 관리됩니다. 새 PC에서는:

```bash
git clone https://github.com/kinggodyoung5/wordchain.git
cd wordchain
```

빌드 과정이 없어 `npm install` 등이 필요 없고, 바로 정적 서버로 실행하면 됩니다. Firebase 중앙 설정은 저장소에 커밋되어 있으므로 별도 설정 없이 대결 모드까지 바로 테스트할 수 있습니다 (중앙 프로젝트를 아직 만들지 않았다면 [docs/SETUP.md](docs/SETUP.md) 참고).

작업 후에는 평소처럼 `git add`, `git commit`, `git push`로 동기화하세요.

## 알려진 제한사항

- 대결 모드는 클라이언트가 직접 Realtime Database에 쓰는 구조라, 결심한 사용자가 브라우저 콘솔로 규칙을 우회해 부정한 값을 쓰는 것까지 막지는 못합니다 (Cloud Functions 없는 완전 무료 구조의 트레이드오프). 캐주얼한 친목 게임 용도로는 충분합니다.
- 방(room) 데이터는 자동으로 삭제되지 않습니다. Realtime Database 무료 티어(1GB)로 캐주얼 사용에는 충분하지만, 오래된 방은 Firebase 콘솔에서 주기적으로 정리하는 것을 권장합니다.
