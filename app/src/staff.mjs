import { renderLabel, PRINTERS } from '../label.mjs';
let printer = PRINTERS.B1_PRO;
import { decodePayload } from '../payload.mjs';

const $ = id => document.getElementById(id);
const log = t => { $('log').textContent = `${new Date().toLocaleTimeString()} ${t}\n` + $('log').textContent; };
document.getElementById('model').onchange = e => { printer = PRINTERS[e.target.value]; if (current) renderLabel(document.getElementById('label'), current, printer); };
const toast = m => { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800); };

// ── 오늘 인쇄 수 (기기 안에만 저장. 서버 동기화는 나중 단계) ──
const today = new Date().toISOString().slice(0, 10);
const stats = JSON.parse(localStorage.getItem('nl-stats') || '{}');
const showCount = () => { $('count').textContent = `오늘 ${stats[today]?.length ?? 0}장`; };
showCount();

// ── 프린터 (niimbluelib, Web Bluetooth) ──
const NB = window.niimbluelib;
let client = null, printing = false;
const hasBt = !!navigator.bluetooth;
$('btWarn').hidden = hasBt;
const setP = (state, text) => { $('pDot').className = 'dot ' + state; $('pStatus').textContent = text; };
$('connect').onclick = async () => {
  if (!hasBt) return toast('Bluefy 앱에서 열어 주세요');
  if (client) { await client.disconnect(); client = null; return; }
  try {
    setP('busy', '연결 중…');
    client = NB.instantiateClient('bluetooth');
    client.on('disconnect', () => { client = null; setP('', '프린터 연결 끊김'); $('connect').textContent = '연결'; });
    await client.connect();
    const meta = client.getModelMetadata();
    setP('on', `${meta?.model ?? '프린터'} 연결됨`); $('connect').textContent = '끊기';
    // 연결된 프린터의 해상도·헤드 폭에 맞춰 라벨을 다시 그린다
    if (meta?.dpi && meta?.printheadPixels) {
      printer = { name: meta.model, dpi: meta.dpi, headPx: meta.printheadPixels };
      if (PRINTERS[meta.model]) $('model').value = meta.model;
      if (current) renderLabel($('label'), current, printer);
    }
    log(`connected ${meta?.model} dir=${meta?.printDirection}`);
  } catch (e) { client = null; setP('', '연결 실패'); log('connect error ' + e); toast('연결 실패: ' + e.message); }
};

async function printLabel() {
  if (!client) { toast('먼저 프린터를 연결하세요'); return false; }
  if (printing) return false;
  printing = true; $('printBtn').disabled = true; $('printBtn').textContent = '인쇄 중…';
  const meta = client.getModelMetadata();
  const color = NB.PageColorType.SingleColor;
  const encoded = NB.ImageEncoder.encodeCanvas($('label'), color, meta?.printDirection ?? 'top');
  const task = client.protocol.newPrintTask(client.getPrintTaskType() ?? 'B1', {
    totalPages: 1, statusPollIntervalMs: 100, statusTimeoutMs: 8000, pageColor: color, density: Number($('density').value),
  });
  try {
    await task.printInit(); await task.printPage(encoded, 1);
    await task.waitForPageFinished(); await task.waitForFinished();
    record(); toast('인쇄 완료 ✅'); return true;
  } catch (e) { log('print error ' + e); toast('인쇄 실패: ' + e.message); return false; }
  finally { await task.printEnd().catch(() => {}); printing = false; $('printBtn').disabled = false; $('printBtn').textContent = '인쇄하기'; }
}

// ── 현재 라벨 + 스태프 입력 ──
let current = null;
const seen = new Set();
const GENDER = [['m', '남'], ['f', '여']];
const AGE = [['child', '어린이'], ['10s', '10대'], ['20s', '20대'], ['30s', '30대'], ['40s', '40대'], ['50s', '50대'], ['60p', '60대+']];
const chipRow = (el, items, key) => {
  el.innerHTML = items.map(([id, t]) => `<button class="chip" data-id="${id}">${t}</button>`).join('');
  el.onclick = e => {
    const id = e.target.dataset?.id; if (!id || !current) return;
    current[key] = current[key] === id ? 'unset' : id;
    [...el.children].forEach(b => b.classList.toggle('on', b.dataset.id === current[key]));
    if (current.recorded) saveStats();   // 인쇄 뒤에 눌러도 방금 건에 반영
  };
};
chipRow($('gender'), GENDER, 'gender'); chipRow($('age'), AGE, 'age');

function show(p) {
  current = { ...p, gender: 'unset', age: 'unset', recorded: false };
  renderLabel($('label'), p, printer);
  $('labelCard').hidden = false;
  document.querySelectorAll('.chip.on').forEach(b => b.classList.remove('on'));
  $('labelCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function record() {
  if (!current) return;
  (stats[today] ??= []).push({ at: Date.now(), reprint: current.recorded, gender: current.gender, age: current.age });
  current.recorded = true; current.idx = stats[today].length - 1;
  saveStats();
}
function saveStats() {
  if (current?.idx != null) Object.assign(stats[today][current.idx], { gender: current.gender, age: current.age });
  localStorage.setItem('nl-stats', JSON.stringify(stats)); showCount();
}

async function handle(text) {
  let p;
  try { p = decodePayload(text); } catch (e) { toast(e.message); return; }
  if (seen.has(p.id)) toast('이미 스캔한 QR이에요 (재인쇄는 버튼으로)');
  seen.add(p.id);
  show(p);
  log(`scanned ${p.big}`);
  if ($('auto').checked && client && !seen.has('printed:' + p.id)) { if (await printLabel()) seen.add('printed:' + p.id); }
}

// ── QR 스캔 (jsQR) ──
let stream = null, raf = 0;
const work = document.createElement('canvas'), wctx = work.getContext('2d', { willReadFrequently: true });
$('scanBtn').onclick = async () => {
  if (stream) return stopScan();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    $('video').srcObject = stream; await $('video').play();
    $('videoWrap').hidden = false; $('scanBtn').textContent = '⏹ 스캔 멈추기';
    let last = 0;
    const tick = t => {
      raf = requestAnimationFrame(tick);
      if (t - last < 120) return; last = t;           // 초당 약 8번만 검사 (배터리 절약)
      const v = $('video'); if (!v.videoWidth) return;
      const s = Math.min(v.videoWidth, v.videoHeight, 640);
      work.width = work.height = s;
      wctx.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, s, s);
      const code = window.jsQR(wctx.getImageData(0, 0, s, s).data, s, s, { inversionAttempts: 'dontInvert' });
      if (code) {
        const text = new TextDecoder().decode(new Uint8Array(code.binaryData));
        if (text !== handle.last || t - handle.at > 3000) { handle.last = text; handle.at = t; navigator.vibrate?.(60); handle(text); }
      }
    };
    raf = requestAnimationFrame(tick);
  } catch (e) { toast('카메라를 열 수 없어요: ' + e.message); log('camera ' + e); }
};
function stopScan() {
  cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); stream = null;
  $('videoWrap').hidden = true; $('scanBtn').textContent = '📷 QR 스캔 시작';
}

$('printBtn').onclick = () => printLabel();
$('pngBtn').onclick = () => { const a = document.createElement('a'); a.href = $('label').toDataURL('image/png'); a.download = 'label.png'; a.click(); };
$('clearBtn').onclick = () => { current = null; $('labelCard').hidden = true; window.scrollTo({ top: 0, behavior: 'smooth' }); };
$('manualBtn').onclick = () => handle($('manual').value.trim());

// ── 오프라인 운영 (Bluefy에는 Service Worker가 없으므로 "한 번 열면 끝까지" + HTTP 캐시) ──
// 이 페이지는 빌드할 때 라이브러리·코드를 모두 한 파일(print.html)에 넣는다.
// 그래서 한 번 열린 뒤에는 인터넷 없이 스캔·라벨 생성·인쇄가 모두 된다.
const VERSION = typeof __STAFF_VERSION__ === 'string' ? __STAFF_VERSION__ : 'dev';
$('ver').textContent = VERSION;

const showNet = () => {
  const on = navigator.onLine;
  $('netbar').classList.toggle('off', !on);
  $('net').textContent = on ? '🟢 온라인' : '✈️ 오프라인 · 그대로 계속 쓸 수 있어요 (탭을 닫지 마세요)';
};
addEventListener('online', () => { showNet(); refreshCache(); });
addEventListener('offline', showNet);
showNet();

// 오프라인 상태에서 실수로 새로고침·닫기를 막는다 (다시 열려면 인터넷이 필요할 수 있음)
addEventListener('beforeunload', e => { if (!navigator.onLine) { e.preventDefault(); e.returnValue = ''; } });

// 화면 꺼짐 방지: Bluefy 전용 API → 표준 Wake Lock 순서로 시도
try { navigator.bluetooth?.setScreenDimEnabled?.(false); } catch {}
let wake = null;
const keepAwake = async () => { try { wake = await navigator.wakeLock?.request('screen'); } catch {} };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
keepAwake();

// 온라인일 때 이 페이지의 HTTP 캐시를 최신으로 채워 둔다.
// 다음에 인터넷 없이 열 때 브라우저가 이 캐시를 쓸 수 있게 하기 위함 (캐시 유지 1일, vercel.json)
async function refreshCache() {
  if (!navigator.onLine) return null;
  try {
    const r = await fetch(location.pathname, { cache: 'reload' });
    const text = await r.text();
    return text.match(/name="staff-version" content="([^"]+)"/)?.[1] ?? null;
  } catch { return null; }
}
refreshCache();

$('updBtn').onclick = async () => {
  if (!navigator.onLine) return toast('오프라인이라 확인할 수 없어요');
  const latest = await refreshCache();
  if (!latest) return toast('확인 실패');
  if (latest === VERSION) return toast(`최신 버전이에요 (${VERSION})`);
  if (confirm(`새 버전 ${latest}이 있어요. 지금 다시 열까요?`)) location.reload();
};

// Android Chrome·Safari처럼 Service Worker가 되는 브라우저에서는 완전 오프라인도 지원
// (?nosw: Service Worker 없는 Bluefy 환경을 다른 브라우저에서 흉내 내 시험할 때)
if (!new URLSearchParams(location.search).has('nosw')) navigator.serviceWorker?.register('./sw.js').catch(() => {});
