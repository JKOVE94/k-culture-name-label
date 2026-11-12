// 부스앱 이름 변환 프로토타입 (오프라인, 순수 JS)
// 1) 한글 → 가타카나   2) 히라가나 → 한글(국립국어원 일본어 표기법 기반)

// ───────────── 1. 한글 → 가타카나 ─────────────
const CHO = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const JUNG = ['a','e','ya','ye','o','e','yo','ye','o','wa','we','we','yo','u','wo','we','wi','yu','u','ui','i'];
const JONG = ['','k','k','k','n','n','n','t','l','l','l','l','l','l','l','l','m','p','p','t','t','ng','t','t','k','t','p','t'];

// 자음 그룹별 [a,i,u,e,o] 가나
const ROW = {
  k:['カ','キ','ク','ケ','コ'], g:['ガ','ギ','グ','ゲ','ゴ'],
  t:['タ','ティ','トゥ','テ','ト'], d:['ダ','ディ','ドゥ','デ','ド'],
  p:['パ','ピ','プ','ペ','ポ'], b:['バ','ビ','ブ','ベ','ボ'],
  ch:['チャ','チ','チュ','チェ','チョ'], j:['ジャ','ジ','ジュ','ジェ','ジョ'],
  s:['サ','シ','ス','セ','ソ'], n:['ナ','ニ','ヌ','ネ','ノ'], m:['マ','ミ','ム','メ','モ'],
  r:['ラ','リ','ル','レ','ロ'], h:['ハ','ヒ','フ','ヘ','ホ'], '':['ア','イ','ウ','エ','オ'],
};
const Y = { k:'キ', g:'ギ', p:'ピ', b:'ビ', n:'ニ', m:'ミ', r:'リ', h:'ヒ', t:'テ', d:'デ' }; // + ャュョ
const SMALL = { a:'ャ', u:'ュ', o:'ョ' };
const W = { a:'ァ', e:'ェ', o:'ォ', i:'ィ' };
const IDX = { a:0, i:1, u:2, e:3, o:4 };

function syllable(c, v) {
  if (v === 'ui') v = c === '' ? 'wi' : 'i';            // 의→ウィ, 희→ヒ
  if (v[0] === 'y') {
    const base = v.slice(1);
    if (c === '') return { ya:'ヤ', yu:'ユ', yo:'ヨ', ye:'イェ' }[v];
    if (base === 'e') return ROW[c][3];                   // 계→ケ, 혜→ヘ
    if (['s','ch','j'].includes(c)) return ROW[c][1].replace(/ィ$/,'') + SMALL[base]; // 셔→ショ
    return (Y[c] ?? ROW[c][1]) + SMALL[base];
  }
  if (v[0] === 'w') {
    const base = v.slice(1);
    if (c === '') return { wa:'ワ', we:'ウェ', wo:'ウォ', wi:'ウィ' }[v];
    if (c === 'h') return 'フ' + W[base];                  // 화→ファ, 휘→フィ
    if (['s','ch','j'].includes(c) && base !== 'i') return ROW[c][IDX[base]]; // 최→チェ, 좌→チャ
    const u = ROW[c][2];
    return u.replace(/ゥ$/,'') + W[base];                  // 과→クァ, 권→クォン
  }
  return ROW[c][IDX[v]];
}

const FINAL = { k:'ク', n:'ン', ng:'ン', m:'ム', l:'ル', p:'プ', t:'ッ' };
const VOICE = { g:'g', d:'d', b:'b', j:'j' };
const UNVOICED = { g:'k', d:'t', b:'p', j:'ch', kk:'k', tt:'t', pp:'p', jj:'ch', ss:'s' };

export function hangulToKatakana(word) {
  let out = '', prevFinal = null;
  for (const [i, ch] of [...word].entries()) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) { out += ch; prevFinal = null; continue; }
    let c = CHO[Math.floor(code / 588)];
    const v = JUNG[Math.floor((code % 588) / 28)];
    const f = JONG[code % 28];
    // 어두(이름 첫 글자) 또는 막힌 받침 뒤 → 무성음, 모음·울림 받침 뒤 → 유성음 (민준→ミンジュン, 지훈→チフン)
    const voiced = i > 0 && (prevFinal === '' || ['n','ng','m','l'].includes(prevFinal));
    if (VOICE[c] && voiced) c = VOICE[c]; else c = UNVOICED[c] ?? c;
    out += syllable(c, v) + (FINAL[f] ?? '');
    prevFinal = f;
  }
  return out;
}

// ───────────── 2. 히라가나 → 한글 ─────────────
// [어두형, 어중형]
const K = {
  あ:'아',い:'이',う:'우',え:'에',お:'오',
  か:['가','카'],き:['기','키'],く:['구','쿠'],け:['게','케'],こ:['고','코'],
  さ:'사',し:'시',す:'스',せ:'세',そ:'소',
  た:['다','타'],ち:['지','치'],つ:'쓰',て:['데','테'],と:['도','토'],
  な:'나',に:'니',ぬ:'누',ね:'네',の:'노',
  は:'하',ひ:'히',ふ:'후',へ:'헤',ほ:'호',
  ま:'마',み:'미',む:'무',め:'메',も:'모',
  や:'야',ゆ:'유',よ:'요',ら:'라',り:'리',る:'루',れ:'레',ろ:'로',わ:'와',ゐ:'이',ゑ:'에',を:'오',
  が:'가',ぎ:'기',ぐ:'구',げ:'게',ご:'고',ざ:'자',じ:'지',ず:'즈',ぜ:'제',ぞ:'조',
  だ:'다',ぢ:'지',づ:'즈',で:'데',ど:'도',ば:'바',び:'비',ぶ:'부',べ:'베',ぼ:'보',
  ぱ:'파',ぴ:'피',ぷ:'푸',ぺ:'페',ぽ:'포',ゔ:'부',
};
const YOON = {
  きゃ:['갸','캬'],きゅ:['규','큐'],きょ:['교','쿄'],
  ちゃ:['자','차'],ちゅ:['주','추'],ちょ:['조','초'],
  しゃ:'샤',しゅ:'슈',しょ:'쇼',じゃ:'자',じゅ:'주',じょ:'조',
  にゃ:'냐',にゅ:'뉴',にょ:'뇨',ひゃ:'햐',ひゅ:'휴',ひょ:'효',
  みゃ:'먀',みゅ:'뮤',みょ:'묘',りゃ:'랴',りゅ:'류',りょ:'료',
  ぎゃ:'갸',ぎゅ:'규',ぎょ:'교',びゃ:'뱌',びゅ:'뷰',びょ:'뵤',ぴゃ:'퍄',ぴゅ:'퓨',ぴょ:'표',
  ふぁ:'파',ふぃ:'피',ふぇ:'페',ふぉ:'포',てぃ:'티',でぃ:'디',
  // 가타카나 외래 표기 (ウィ・シェ・チェ・ヴァ 등, 히라가나로 정규화된 형태)
  うぃ:'위',うぇ:'웨',うぉ:'워',いぇ:'예',しぇ:'셰',じぇ:'제',ちぇ:'체',つぁ:'차',つぇ:'체',
  とぅ:'투',どぅ:'두',てゅ:'튜',でゅ:'듀',ふゅ:'퓨',くぁ:'콰',ぐぁ:'과',
  ゔぁ:'바',ゔぃ:'비',ゔぇ:'베',ゔぉ:'보',
};
const SMALL_VOWEL = { ぁ:'아', ぃ:'이', ぅ:'우', ぇ:'에', ぉ:'오' };
const VOWEL_OF = s => { // 한글 음절의 중성 모음 계열 (장음 판정용)
  const j = Math.floor(((s.charCodeAt(0) - 0xac00) % 588) / 28);
  return { 0:'a', 8:'o', 12:'o', 13:'u', 17:'u', 18:'u', 20:'i', 5:'e', 4:'o', 6:'o' }[j];
};
const addJong = (s, jong) => String.fromCharCode(s.charCodeAt(0) + jong); // ㄴ=4, ㅅ=19

// tsu: 'auto' = 어두 츠 / 어중 쓰 (つき→츠키, まつや→마쓰야), '쓰' 또는 '츠' = 고정
export function hiraganaToHangul(input, { tsu = 'auto', dropLong = true } = {}) {
  const s = [...input.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))];
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const two = s[i] + (s[i + 1] ?? '');
    const pos = out.length === 0 ? 0 : 1;
    const pick = v => Array.isArray(v) ? v[pos] : v;
    if (s[i] === 'ん' && out.length) { out.push(addJong(out.pop(), 4)); continue; }
    if (s[i] === 'っ' && out.length) { out.push(addJong(out.pop(), 19)); continue; }
    if (s[i] === 'ー') continue;
    // 장음 생략: おう·おお→오, うう→우, ああ→아, いい→이 (えい는 관용대로 유지: けいこ→게이코)
    if (dropLong && out.length) {
      const last = out[out.length - 1], vw = VOWEL_OF(last);
      const hasJong = (last.charCodeAt(0) - 0xac00) % 28 !== 0;
      if (!hasJong && ((s[i] === 'う' && (vw === 'o' || vw === 'u')) ||
          (s[i] === 'お' && vw === 'o') || (s[i] === 'あ' && vw === 'a') || (s[i] === 'い' && vw === 'i'))) continue;
    }
    if (YOON[two]) { out.push(pick(YOON[two])); i++; continue; }
    const v = K[s[i]] ?? SMALL_VOWEL[s[i]];
    if (v === undefined) { out.push(s[i]); continue; }
    out.push(s[i] === 'つ' ? (tsu === 'auto' ? ['츠', '쓰'][pos] : tsu) : pick(v));
  }
  return out.join('');
}

// ───────────── 3. 표기 사전 (예외 우선 → 규칙) ─────────────
// overrides: [{ kind:'ja2ko'|'ko2ja', part:'family'|'given'|'any', source, value }]
export function convertPart({ kind, part, source, overrides = [], options = {} }) {
  const hit = overrides.find(o => o.kind === kind && o.source === source && o.part === part)
           ?? overrides.find(o => o.kind === kind && o.source === source && o.part === 'any');
  if (hit) return { value: hit.value, from: 'dictionary' };
  const value = kind === 'ja2ko' ? hiraganaToHangul(source, options) : hangulToKatakana(source);
  return { value, from: 'rule' };
}
