// BluefySafeNiimbotClient 모의 테스트: 검색 필터, optionalServices, 특성 선택, 쓰기 방식 분기
import vm from 'node:vm';
import fs from 'node:fs';

globalThis.window = globalThis;
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }, configurable: true });
vm.runInThisContext(fs.readFileSync(new URL('./vendor/niimbluelib.min.js', import.meta.url), 'utf8') + '\nglobalThis.niimbluelib = niimbluelib;');
const { BluefySafeNiimbotClient } = await import('./src/niimbot-ble.mjs');

const SVC = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
function fakeDevice({ withoutResponse }) {
  const writes = [];
  const ch = {
    uuid: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
    properties: { notify: true, writeWithoutResponse: withoutResponse, write: !withoutResponse },
    addEventListener() {}, startNotifications: async () => ch,
    writeValueWithoutResponse: async b => writes.push(['withoutResponse', b.byteLength]),
    writeValueWithResponse: async b => writes.push(['withResponse', b.byteLength]),
  };
  const service = { uuid: SVC, getCharacteristics: async () => [ch] };
  const server = { getPrimaryService: async u => { if (u !== SVC) throw new Error('no'); return service; }, getPrimaryServices: async () => [service], disconnect() {} };
  return { writes, device: { name: 'B1-H123456789', gatt: { connect: async () => server, disconnect() {} }, addEventListener() {}, removeEventListener() {} } };
}

for (const withoutResponse of [true, false]) {
  const { device, writes } = fakeDevice({ withoutResponse });
  let opts;
  navigator.bluetooth = { requestDevice: async o => { opts = o; return device; } };
  const c = new BluefySafeNiimbotClient();
  c.negotiateAndGetPrinterInfo = async () => {};   // 실제 프린터 협상은 생략
  c.printerInfo = {};
  await c.connect();
  await c.sendRaw(new Uint8Array([0x55, 0x55, 1, 2, 3, 0xaa, 0xaa]), true);
  console.log(JSON.stringify({
    filters: opts.filters, optionalServices: opts.optionalServices,
    servicesInFilters: opts.filters.some(f => f.services), writeMode: c.writeMode, sent: writes, intervalMs: c.getPacketInterval(),
  }));
  await c.disconnect();   // 하트비트 중지
}
process.exit(0);
