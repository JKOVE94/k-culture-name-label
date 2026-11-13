# k-culture-name-label

일본선교 **K-CULTURE 体験ブース**용 이름 라벨 웹앱입니다.

- 일본 이름(한자·히라가나·가타카나) → **한글**로, 한국 이름(한글) → **가타카나**로 바꿉니다.
- 방문자는 자기 폰에서 이름을 입력하고 QR을 만들고, **컬러 이름카드**를 사진으로 저장합니다.
- 스태프는 QR을 스캔해 **Niimbot B1 Pro**(흑백 감열 라벨프린터)로 이름 스티커를 바로 인쇄합니다.
- 서버 없이 기기 안에서 모두 처리합니다. 정적 파일만 올리면 되고, 오프라인에서도 동작하도록 설계했습니다.

> 상태: **프로토타입**. 화면, 변환, QR 왕복은 브라우저에서 확인했습니다. B1 Pro 실기 인쇄와 iPhone 카메라 스캔은 아직 검증하지 않았습니다.

## 화면

| 파일 | 대상 | 내용 |
|---|---|---|
| `app/index.html` | 방문자 | 「呼ばれたい名前」 입력 → 읽기 선택(한자일 때) → 호칭(さん/くん/ちゃん/名前だけ) → 한글 미리보기 → QR + 컬러 이름카드 저장 |
| `app/print.html` | 스태프 | QR 스캔 → 흑백 라벨 생성(567×354px, 300dpi) → B1 Pro 인쇄, 중복 스캔 경고, 성별·연령층 선택 입력, 오늘 인쇄 수 |
| `app/stats.html` | 리더 | 인쇄 폰들의 기록을 QR 스캔·파일·붙여넣기(·Supabase)로 모아 집계: 방문 수, 언어, 성별·연령층, 시간대, 일자별, 폰별, CSV |
| `app/label-test.html` | 개발 | 흑백 라벨 4종 미리보기 |
| `app/keepsake-test.html` | 개발 | 컬러 이름카드 3종 미리보기 |
| `app/ime-test.html` | 개발 | iPhone 일본어 키보드 조합 이벤트 확인용 |

## 구조

```
app/
├─ convert.mjs        한글→가타카나, 히라가나→한글 (つ: 어두 츠 / 어중 쓰, 표기 사전 우선)
├─ input.mjs          글자 종류 판별, 띄어쓰기·한국 성씨 분리
├─ rank.mjs           한자 읽기 후보 점수 (KANJIDIC2 음독·훈독·이름용 읽기로 검증)
├─ reading.mjs        키보드 힌트 + 이름 사전으로 읽기 결정
├─ honorific.mjs      호칭 (상·군·짱 / さん·くん·ちゃん)
├─ payload.mjs        QR 데이터 형식 NL1:{...}
├─ label.mjs          흑백 라벨 렌더러 (B1 Pro 567×354 / B1 384×240)
├─ keepsake.mjs       컬러 이름카드 1080×1350 + iPhone 공유 시트 저장
├─ build-shards.py    이름 사전 생성 → app/dict/ (생성본을 레포에 포함)
├─ dict/              shard/{글자}.json(방문자용 조각) · full.json(오프라인용 통합본) · kanji.json
├─ sw.js              Service Worker (오프라인 동작)
├─ manifest.webmanifest, icons/   홈 화면 웹앱 설정·아이콘 (scripts/make-icons.py)
├─ vercel.json        캐시 헤더, .vercelignore 테스트 파일 제외
├─ vendor/            qrcode-generator, jsQR, niimbluelib (오프라인용 로컬 사본)
└─ test*.mjs          변환·읽기·QR 왕복 테스트 (node)
docs/design.md        설계 문서
```

## 실행

```bash
cd app
python3 -m http.server 3000      # http://localhost:3000 (방문자), /print.html (스태프)
node test.mjs && node test-qr.mjs && node test-reading.mjs
python3 build-shards.py          # 사전을 다시 만들 때만 (JMnedict·KANJIDIC2 다운로드)
```

## 배포 (Vercel)

빌드가 없는 정적 사이트입니다. 서버 함수가 없어 리전 설정이 필요 없고, 파일은 CDN(도쿄 포함)에서 바로 나갑니다.

| 설정 | 값 |
|---|---|
| Framework Preset | Other |
| Root Directory | `app` |
| Build Command | (비움) |
| Output Directory | `.` |

- 사전을 다시 만들면 `sw.js`의 `DICT_CACHE` 값을, 코드를 바꾸면 `VERSION` 값을 올려야 홈 화면 웹앱이 새 버전을 받습니다.

## 오프라인 (팀원 폰)

1. **인터넷이 될 때** iPhone Safari로 사이트를 열고 공유 → 「홈 화면에 추가」
2. 홈 화면 아이콘으로 열면 사전 통합본(전송 약 1.7MB)을 자동으로 저장하고, 화면 아래에 「✅ オフラインでも使えます」가 표시됩니다.
3. 그 뒤에는 비행기 모드에서도 처음부터 실행되고, 한자 읽기 후보도 나옵니다.

- 방문자가 브라우저로 열 때는 사전을 미리 받지 않고, 입력한 글자의 조각(수 KB)만 받습니다.
## 오프라인 (스태프 인쇄 폰, Bluefy)

Bluefy는 Service Worker가 없어서 다른 방식을 씁니다.

- `print.html`은 **한 파일에 모든 코드와 라이브러리가 들어 있는 빌드 결과물**입니다 (약 390KB). 한 번 열리면 인터넷 요청이 더 필요 없습니다.
  - 수정은 `src/print.src.html`, `src/staff.mjs`에서 하고 `npm i && npm run build:staff`로 다시 만듭니다.
- `print.html`은 1일 동안 브라우저 캐시에 남기도록 했고, 온라인일 때마다 캐시를 최신으로 다시 채웁니다. 그래서 인터넷 없이 다시 열어도 캐시에서 열릴 수 있습니다. (Chromium에서 확인, **iPhone Bluefy는 실기 확인 필요**)
- 화면 위 띠가 온라인/오프라인을 보여 주고, 오프라인일 때는 실수로 닫거나 새로고침하면 경고합니다. 화면 꺼짐도 막습니다 (Bluefy API → Wake Lock).
- 「업데이트 확인」 버튼으로 새 버전을 받을 수 있습니다.
- Android Chrome에서 열면 Service Worker까지 동작해 완전 오프라인이 됩니다.

**출국 전 iPhone 점검**: Bluefy로 `print.html`을 열기 → Bluefy 앱을 완전히 종료 → 비행기 모드 → Bluefy로 다시 열기. 화면이 뜨면 오프라인 재실행 가능, 안 뜨면 "탭을 열어 둔 채 운영"으로 갑니다.

- 스태프 인쇄: iPhone은 Safari에서 Web Bluetooth를 쓸 수 없으므로 **Bluefy** 브라우저로 `print.html`을 엽니다.
- 카메라와 블루투스는 HTTPS에서만 동작합니다. 배포는 Cloudflare Pages 같은 정적 호스팅을 기준으로 합니다.

## 통계 모으기

기록은 **스태프 인쇄 폰 안에만** 저장됩니다: 인쇄 시각, 방향, 재인쇄 여부, 스태프가 고른 성별·연령층. 방문자 이름은 저장하지 않습니다.

- **B. 수동 (지금 사용)**: 인쇄 폰 「📊 인쇄 기록」에서 QR로 보내기 / 파일로 / 텍스트 복사 → 리더 폰 `stats.html`에서 QR 스캔·파일 선택·붙여넣기. 기록마다 `기기ID-일련번호`가 있어 여러 번 넣어도 중복되지 않습니다. QR 한 장에 약 25건이 들어갑니다.
- **A. 자동 (준비됨, 꺼짐)**: `app/supabase.mjs`에 URL·anon key를 넣고 `supabase/migrations/`의 SQL을 실행한 뒤 `npm run build:staff`. 다음 사람을 스캔하거나 2분이 지나면 앞 기록을 확정하고, 인터넷이 될 때 모아서 올립니다. `stats.html`에 「Supabase에서 불러오기」가 생깁니다.

## 데이터와 라이선스

- 이름 사전: [JMnedict](https://www.edrdg.org/enamdict/enamdict_doc.html), 한자 읽기: [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project). © Electronic Dictionary Research and Development Group, **CC BY-SA 4.0**. `app/dict/`는 이 데이터를 가공한 파생물이며 같은 CC BY-SA 4.0을 따릅니다. `build-shards.py`로 다시 만들 수 있습니다.
- `vendor/qrcode.mjs`: qrcode-generator (Kazuhiko Arase), MIT
- `vendor/jsQR.js`: jsQR (cozmo), Apache-2.0
- `vendor/niimbluelib.min.js`: NiimBlueLib (MultiMote), MIT. Niimbot 공식 제품이 아닌 비공식 구현입니다.
