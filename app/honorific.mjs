// 호칭 선택: 방문자가 "어떻게 불리고 싶은지" 고른다 (さん / くん / ちゃん / 名前だけ)
export const HONORIFICS = [
  { id: 'san',  ja: 'さん',   ko: '상', labelJa: 'さん',    labelKo: '상 (さん)' },
  { id: 'kun',  ja: 'くん',   ko: '군', labelJa: 'くん',    labelKo: '군 (くん)' },
  { id: 'chan', ja: 'ちゃん', ko: '짱', labelJa: 'ちゃん',  labelKo: '짱 (ちゃん)' },
  { id: 'none', ja: '',       ko: '',   labelJa: '名前だけ', labelKo: '이름만' },
];
export const DEFAULT_HONORIFIC = 'san';

// 라벨에 찍을 두 줄을 만든다
// ja2ko(일본인): 큰 줄 = "다나카 상",  작은 줄 = "田中さん（たなか）"
// ko2ja(한국인): 큰 줄 = "キムさん",   작은 줄 = "김"
export function labelLines({ dir, src, read, out, h = DEFAULT_HONORIFIC }) {
  const x = HONORIFICS.find(o => o.id === h) ?? HONORIFICS[0];
  if (dir === 'ja2ko') {
    const big = x.ko ? `${out.join(' ')} ${x.ko}` : out.join(' ');
    const reading = read?.length ? `（${read.join(' ')}）` : '';
    return { big, small: `${src.join(' ')}${x.ja}${reading}` };
  }
  return { big: `${out.join('・')}${x.ja}`, small: src.join(' ') };
}
