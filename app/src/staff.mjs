import { renderLabel as drawLabel, PRINTERS, LABEL_SIZES, DEFAULT_SIZE } from '../label.mjs';
// 라벨 크기: 50×80 포토카드(기본) / 50×30 이름표. 고른 값은 이 폰에 기억한다
let labelSize = localStorage.getItem('nl-label-size') || DEFAULT_SIZE;
if (!LABEL_SIZES[labelSize]) labelSize = DEFAULT_SIZE;
// 사진 표현: 회색조(B1 Pro) / 디더링. 실물로 비교해 고른다
let photoMode = localStorage.getItem('nl-photo-mode') || 'gray';
const renderLabel = (canvas, data, prn) => drawLabel(canvas, data, prn, labelSize, photoMode);
let printer = PRINTERS.B1_PRO;
import { decodePayload } from '../payload.mjs';
import { toFile, toQrChunks } from '../stats-core.mjs';
import * as SB from '../supabase.mjs';
import { BluefySafeNiimbotClient } from './niimbot-ble.mjs';
import { PhotoCollector, PHOTO_PREFIX } from '../photo-qr.mjs';
import qrcode from '../vendor/qrcode.mjs';
qrcode.stringToBytes = s => Array.from(new TextEncoder().encode(s));

const $ = id => document.getElementById(id);
const log = t => { $('log').textContent = `${new Date().toLocaleTimeString()} ${t}\n` + $('log').textContent; };
document.getElementById('model').onchange = e => { printer = PRINTERS[e.target.value]; if (current) renderLabel(document.getElementById('label'), current, printer); };
{
  const sel = document.getElementById('labelSize');
  sel.innerHTML = Object.entries(LABEL_SIZES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  sel.value = labelSize;
  sel.onchange = () => { labelSize = sel.value; localStorage.setItem('nl-label-size', labelSize); if (current) renderLabel(document.getElementById('label'), current, printer); };
  const pm = document.getElementById('photoMode');
  pm.value = photoMode;
  pm.onchange = () => { photoMode = pm.value; localStorage.setItem('nl-photo-mode', photoMode); if (current) renderLabel(document.getElementById('label'), current, printer); };
}
const toast = m => { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800); };

// ── 인쇄 기록 (이 폰 안에 저장 → 파일·QR로 내보내기 / Supabase 자동 업로드) ──
// 방문자 이름은 저장하지 않는다. 시각·방향·재인쇄·스태프가 고른 성별·연령층만 남긴다.
const dev = JSON.parse(localStorage.getItem('nl-dev') || 'null') ?? { id: Math.random().toString(36).slice(2, 6), name: '' };
if (!dev.name) dev.name = `인쇄폰-${dev.id}`;
localStorage.setItem('nl-dev', JSON.stringify(dev));
let seq = Number(localStorage.getItem('nl-seq') || '0');
const events = JSON.parse(localStorage.getItem('nl-events-v1') || '[]');
// 이전 형식(nl-stats) 기록 옮기기
const legacy = JSON.parse(localStorage.getItem('nl-stats') || 'null');
if (legacy) {
  for (const day of Object.values(legacy)) for (const e of day)
    events.push({ id: `${dev.id}-${(++seq).toString(36)}`, at: e.at, dev: dev.id, dir: 'ja2ko', reprint: !!e.reprint, gender: e.gender ?? 'unset', age: e.age ?? 'unset', final: true });
  localStorage.removeItem('nl-stats');
}
const kstDay = at => new Date(at + 9 * 3600e3).toISOString().slice(0, 10);
const persist = () => {
  localStorage.setItem('nl-events-v1', JSON.stringify(events)); localStorage.setItem('nl-seq', String(seq));
  const today = kstDay(Date.now());
  const n = events.filter(e => !e.reprint && kstDay(e.at) === today).length;
  $('count').textContent = `오늘 ${n}장`;
  $('recSummary').textContent = `이 폰 기록: 오늘 ${n}장 · 전체 ${events.filter(e => !e.reprint).length}장` +
    (SB.enabled() ? ` · 업로드 대기 ${events.filter(e => e.final && !e.up).length}건` : '');
};

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
    // Bluefy(iOS)에서도 B1 Pro가 목록에 보이도록 이름 접두사로 검색하는 클라이언트 (src/niimbot-ble.mjs)
    client = new BluefySafeNiimbotClient();
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
    log(`connected ${meta?.model} dir=${meta?.printDirection} write=${client.writeMode} interval=${client.getPacketInterval()}ms`);
  } catch (e) { client = null; setP('', '연결 실패'); log('connect error ' + e); toast('연결 실패: ' + e.message); }
};

async function printLabel() {
  if (!client) { toast('먼저 프린터를 연결하세요'); return false; }
  if (printing) return false;
  printing = true; $('printBtn').disabled = true; $('printBtn').textContent = '인쇄 중…';
  const meta = client.getModelMetadata();
  // 사진을 회색조로 그렸으면 회색조 인쇄, 아니면 흑백 인쇄
  const color = current?.photo && photoMode === 'gray' ? NB.PageColorType.Grayscale : NB.PageColorType.SingleColor;
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
    if (current.ev) { current.ev.gender = current.gender; current.ev.age = current.age; persist(); }   // 인쇄 뒤에 눌러도 방금 건에 반영
  };
};
chipRow($('gender'), GENDER, 'gender'); chipRow($('age'), AGE, 'age');

function show(p) {
  finalize();
  // 포토카드 번호: 오늘 이 폰에서 몇 번째 방문자인지
  const today = kstDay(Date.now());
  const no = events.filter(e => !e.reprint && kstDay(e.at) === today).length + 1;
  current = { ...p, photo: p.photoImg ?? null, no, date: Date.now(), gender: 'unset', age: 'unset', ev: null };
  renderLabel($('label'), current, printer);
  $('labelCard').hidden = false;
  document.querySelectorAll('.chip.on').forEach(b => b.classList.remove('on'));
  $('labelCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function record() {
  if (!current) return;
  const ev = { id: `${dev.id}-${(++seq).toString(36)}`, at: Date.now(), dev: dev.id, dir: current.bigLang === 'ja' ? 'ko2ja' : 'ja2ko',
    reprint: !!current.ev, gender: current.gender, age: current.age, final: false };
  events.push(ev);
  if (current.ev) current.ev.final = true;   // 재인쇄면 앞 기록은 확정
  current.ev = ev;
  persist();
}
// 다음 사람으로 넘어갈 때 앞사람 기록을 확정(성별·연령층 수정 끝) → 업로드 대상
function finalize() {
  if (current?.ev && !current.ev.final) { current.ev.final = true; persist(); upload(); }
}

// ── 사진 QR 조각 모으기 (방문자 화면이 이름 QR과 사진 QR들을 번갈아 띄운다) ──
const photos = new PhotoCollector();
let pending = null;   // 사진 조각을 기다리는 이름 정보
const showProgress = st => {
  $('photoProg').hidden = false; $('skipPhoto').hidden = false;
  $('photoProg').textContent = `📡 사진 받는 중 ${st.got}/${st.total} — 방문자 QR을 계속 비춰 주세요`;
};
const hideProgress = () => { $('photoProg').hidden = true; $('skipPhoto').hidden = true; };
async function completePending(withPhoto = true) {
  const p = pending; pending = null; hideProgress();
  if (!p) return;
  if (withPhoto && p.photo) { p.photoImg = await photos.image(p.photo.id).catch(() => null); }
  if (p.photo) photos.forget(p.photo.id);   // 사진은 이 화면 메모리에만 두고 바로 버린다
  if (p.photoImg) { navigator.vibrate?.([60, 40, 60]); toast('사진 받기 완료 ✅ 방문자에게 QR을 내려도 된다고 알려 주세요'); }
  await proceed(p);
}
$('skipPhoto').onclick = () => completePending(false);

async function proceed(p) {
  show(p);
  log(`scanned ${p.big}${p.photoImg ? ' +photo' : ''}`);
  if ($('auto').checked && client && !seen.has('printed:' + p.id)) { if (await printLabel()) seen.add('printed:' + p.id); }
}

async function handle(text) {
  if (text.startsWith(PHOTO_PREFIX)) {
    const st = photos.add(text);
    if (st && pending?.photo?.id === st.id) { showProgress(st); if (st.done) await completePending(); }
    return;
  }
  let p;
  try { p = decodePayload(text); } catch (e) { toast(e.message); return; }
  if (p.id === current?.id || p.id === pending?.id) return;   // 번갈아 뜨는 같은 이름 QR은 무시
  if (seen.has(p.id)) toast('이미 스캔한 QR이에요 (재인쇄는 버튼으로)');
  seen.add(p.id);
  if (p.photo) {
    pending = p;
    const st = photos.status(p.photo.id);
    showProgress({ got: st.got, total: p.photo.n });
    if (st.done) await completePending();
    return;
  }
  await proceed(p);
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
$('clearBtn').onclick = () => { finalize(); current = null; $('labelCard').hidden = true; window.scrollTo({ top: 0, behavior: 'smooth' }); };
// 시험용: ?frames=파일주소 로 열면 그 파일의 줄들을 QR처럼 처리 (사진 QR 흐름 확인)
{
  const f = new URLSearchParams(location.search).get('frames');
  if (f) fetch(f).then(r => r.text()).then(async t => { for (const line of t.split('\n').map(x => x.trim()).filter(Boolean)) await handle(line); });
}
// 여러 줄을 붙여 넣으면 한 줄씩 QR처럼 처리 (사진 조각 시험용)
$('manualBtn').onclick = async () => { for (const line of $('manual').value.split('\n').map(x => x.trim()).filter(Boolean)) await handle(line); };

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

// ── 기록 관리: 폰 이름, 내보내기(파일·텍스트·QR), Supabase 업로드 ──
$('devName').value = dev.name;
$('devName').onchange = () => { dev.name = $('devName').value.trim() || `인쇄폰-${dev.id}`; localStorage.setItem('nl-dev', JSON.stringify(dev)); toast('폰 이름 저장'); };
const exportData = () => { finalize(); return { devId: dev.id, devName: dev.name, events: events.map(({ final, up, ...e }) => e) }; };
const fileName = () => `nl-stats-${dev.name}-${kstDay(Date.now())}.json`;

$('expFile').onclick = async () => {
  const blob = new Blob([toFile(exportData())], { type: 'application/json' });
  const file = new File([blob], fileName(), { type: 'application/json' });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: fileName() }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName(); a.click();
};
$('expText').onclick = async () => {
  try { await navigator.clipboard.writeText(toFile(exportData())); toast('복사했어요. LINE·카톡 등에 붙여 넣어 보내세요'); }
  catch { toast('복사 실패: 파일로 내보내기를 써 주세요'); }
};

let chunks = [], chunkIdx = 0;
function drawQr(text) {
  const qr = qrcode(0, 'L'); qr.addData(text, 'Byte'); qr.make();
  const n = qr.getModuleCount(), cell = 6, q = 3, size = (n + q * 2) * cell, c = $('expQrCanvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) ctx.fillRect((k + q) * cell, (r + q) * cell, cell, cell);
  $('expQrPage').textContent = `${chunkIdx + 1} / ${chunks.length}  (${dev.name})`;
}
$('expQr').onclick = () => { chunks = toQrChunks(exportData()); chunkIdx = 0; drawQr(chunks[0]); $('qrModal').classList.add('open'); };
$('qrPrev').onclick = () => { if (chunkIdx > 0) drawQr(chunks[--chunkIdx]); };
$('qrNext').onclick = () => { if (chunkIdx < chunks.length - 1) drawQr(chunks[++chunkIdx]); };
$('qrClose').onclick = () => $('qrModal').classList.remove('open');

// Supabase (설정돼 있을 때만): 확정된 기록을 인터넷이 될 때 몰아서 올린다
let uploading = false;
async function upload() {
  if (!SB.enabled() || uploading || !navigator.onLine) return;
  const pending = events.filter(e => e.final && !e.up);
  if (!pending.length) return;
  uploading = true;
  try {
    await SB.uploadEvents(pending.map(({ final, up, ...e }) => e), dev.name);
    pending.forEach(e => { e.up = true; }); persist(); log(`uploaded ${pending.length}`);
  } catch (e) { log('upload ' + e.message); }
  finally { uploading = false; }
}
// 마지막 기록도 2분 지나면 확정해서 올린다
setInterval(() => { if (current?.ev && !current.ev.final && Date.now() - current.ev.at > 120000) finalize(); upload(); }, 30000);
addEventListener('online', upload);
$('sbState').textContent = SB.enabled() ? '자동 업로드: 켜짐 (인터넷이 되면 올라가요)' : '자동 업로드: 꺼짐 (Supabase 미설정) · 파일·QR로 모아 주세요';
persist(); upload();
