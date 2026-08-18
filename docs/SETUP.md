# Firebase 설정 가이드

대결 모드(실시간 멀티플레이)를 쓰려면 Firebase Realtime Database가 필요합니다. 완전 무료 Spark 요금제로 충분합니다.

## 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 → **프로젝트 추가**
2. 프로젝트 이름 입력 (예: `wordchain-game`) → Google Analytics는 꺼도 됩니다.
3. 프로젝트가 만들어지면 왼쪽 메뉴에서 **빌드 → Realtime Database** 클릭 → **데이터베이스 만들기**
   - 위치: 서울과 가까운 `asia-southeast1` 등 선택
   - 보안 규칙: 우선 "테스트 모드"로 시작해도 되지만, 아래 3번에서 이 저장소의 규칙으로 교체하세요.
4. 왼쪽 메뉴 **빌드 → Authentication** → **시작하기** → **Sign-in method** 탭에서 **익명(Anonymous)** 로그인 활성화

## 2. 웹 앱 등록 & config 값 얻기

1. 프로젝트 개요 옆 톱니바퀴 → **프로젝트 설정**
2. **내 앱** 섹션에서 웹 아이콘(`</>`) 클릭 → 앱 닉네임 입력 → 앱 등록
3. 표시되는 `firebaseConfig` 객체(apiKey, authDomain, databaseURL, projectId, appId 등)를 복사

## 3. 이 프로젝트에 연결하기

두 가지 방법 중 하나를 선택하세요.

### 방법 A — 중앙화 (저장소에 공유 설정으로 커밋)

`src/firebase/firebaseConfig.js`를 열어 `CENTRAL_FIREBASE_CONFIG` 값을 2번에서 복사한 값으로 교체하고 커밋/푸시하세요. 이후 이 저장소를 클론하는 모든 사람이 같은 백엔드를 공유합니다 (친구들과 함께 쓰는 용도로 적합).

### 방법 B — 분산화 (내 브라우저에만 적용)

저장소를 건드리지 않고, 앱에서 우측 상단 ⚙️ 버튼을 눌러 config JSON을 붙여넣고 저장하세요. 이 설정은 `localStorage`에만 저장되며 다른 사람에게 공유되지 않습니다. 개인 프로젝트로 실험하거나, 중앙 프로젝트의 무료 티어 한도가 걱정될 때 사용하세요. "중앙 설정으로 초기화" 버튼으로 언제든 되돌릴 수 있습니다.

## 4. 보안 규칙 배포

저장소에 포함된 `database.rules.json`을 Firebase 콘솔의 Realtime Database → 규칙 탭에 붙여넣고 게시하세요. (Firebase CLI가 있다면 `firebase deploy --only database`로도 배포할 수 있습니다.)

## 5. (선택) Firebase Hosting으로 배포

무료로 정적 사이트를 배포하고 싶다면:

```bash
npm install -g firebase-tools   # Node.js 필요
firebase login
firebase use --add               # 프로젝트 선택
firebase deploy --only hosting,database
```

배포가 끝나면 `https://<프로젝트ID>.web.app` 주소로 누구나 접속해 함께 플레이할 수 있습니다.

## 무료 티어로 충분한 이유

- Realtime Database Spark 요금제: 동시 연결 100개, 저장 용량 1GB, 다운로드 10GB/월 — 친목 게임 용도로는 넉넉합니다.
- Authentication 익명 로그인: 무료, 제한 없음.
- Hosting Spark 요금제: 저장 10GB, 전송 360MB/일 — 정적 파일 몇 MB 수준인 이 프로젝트에 충분합니다.
