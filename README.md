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
├─ build-shards.py    이름 사전 생성 → app/dict/ (git에는 포함하지 않음)
├─ vendor/            qrcode-generator, jsQR, niimbluelib (오프라인용 로컬 사본)
└─ test*.mjs          변환·읽기·QR 왕복 테스트 (node)
docs/design.md        설계 문서
```

## 실행

```bash
cd app
python3 build-shards.py          # 처음 한 번: JMnedict·KANJIDIC2를 받아 dict/ 생성 (약 22MB)
python3 -m http.server 3000      # http://localhost:3000 (방문자), /print.html (스태프)
node test.mjs && node test-qr.mjs && node test-reading.mjs
```

- 스태프 인쇄: iPhone은 Safari에서 Web Bluetooth를 쓸 수 없으므로 **Bluefy** 브라우저로 `print.html`을 엽니다.
- 카메라와 블루투스는 HTTPS에서만 동작합니다. 배포는 Cloudflare Pages 같은 정적 호스팅을 기준으로 합니다.

## 데이터와 라이선스

- 이름 사전: [JMnedict](https://www.edrdg.org/enamdict/enamdict_doc.html), 한자 읽기: [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project). © Electronic Dictionary Research and Development Group, **CC BY-SA 4.0**. 저장소에는 포함하지 않고 `build-shards.py`로 받아 생성합니다.
- `vendor/qrcode.mjs`: qrcode-generator (Kazuhiko Arase), MIT
- `vendor/jsQR.js`: jsQR (cozmo), Apache-2.0
- `vendor/niimbluelib.min.js`: NiimBlueLib (MultiMote), MIT. Niimbot 공식 제품이 아닌 비공식 구현입니다.
