// QR 데이터: 인쇄 기기가 서버 없이 라벨을 다시 그릴 수 있는 최소 정보만 담는다
//   NL1:{"v":1,"b":"다나카 상","s":[["田中","たなか"],["さん"]],"l":"ko","h":"san","id":"k3f9x2","t":1762850000}
export const PREFIX = 'NL1:';

export function encodePayload({ big, segs, bigLang, hon }) {
  const body = {
    v: 1, b: big,
    s: segs.map(s => (s.rt ? [s.text, s.rt] : [s.text])),
    l: bigLang, h: hon,
    id: Math.random().toString(36).slice(2, 8),
    t: Math.floor(Date.now() / 1000),
  };
  return PREFIX + JSON.stringify(body);
}

export function decodePayload(text) {
  if (!text?.startsWith(PREFIX)) throw new Error('このQRは名前シール用ではありません');
  const p = JSON.parse(text.slice(PREFIX.length));
  if (p.v !== 1 || typeof p.b !== 'string' || !Array.isArray(p.s)) throw new Error('QRの形式が正しくありません');
  return { id: p.id, t: p.t, hon: p.h, big: p.b, bigLang: p.l === 'ja' ? 'ja' : 'ko', segs: p.s.map(([text, rt]) => ({ text, rt })) };
}
