# 🔤 끝말잇기

빌드 도구 없이 순수 HTML/CSS/JS로 만든 끝말잇기 웹 게임입니다.

- **싱글 모드**: 봇과 1대1 끝말잇기
- **대결 모드**: Firebase Realtime Database로 여러 명이 실시간 동시 접속해 순서대로 진행
- 단어 검증: 표준국어대사전 기반 명사 약 18만 개 (2~3글자 위주) + 상용 어휘 3천여 개
- 비속어 필터: 리스트 기반 거부
- 시작 글자 비교: 기본은 마지막 글자 그대로 비교, 두음법칙(ㄴ/ㄹ 어두 변형)만 규칙 기반으로 추가 허용 — 그 외 복잡한 자모 처리는 없음
- 완전 무료 (Firebase Spark 무료 요금제로 충분)

### 데이터 출처

- 단어 목록: [han-dle/pd-korean-noun-list-for-wordles](https://github.com/han-dle/pd-korean-noun-list-for-wordles) (CC0, 공개 도메인) — `AllNouns`/`CommonNouns`에서 2글자 이상 한글 명사만 추출해 `src/data/words-full.json`(검증용, ~18만), `src/data/words-common.json`(봇/시작단어용, ~3천)으로 가공했습니다.
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
    words.js              사전 로딩
    words-common.json      상용 단어 (봇 선택/시작 단어용, ~3천 단어)
    words-full.json        전체 검증 사전 (~18만 단어)
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
