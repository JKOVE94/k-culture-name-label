// Bluefy(iOS) 호환 NIIMBOT Web Bluetooth 클라이언트
//
// niimbluelib 기본 클라이언트(NiimbotBluetoothClient)를 그대로 쓰되 세 군데만 덮어쓴다.
//  1) 장치 검색: filters에 services UUID를 넣지 않는다.
//     iOS(CoreBluetooth/Bluefy)는 filters의 services를 "광고 패킷에 이 UUID가 있는 기기만"으로 처리하는데,
//     B1 Pro는 초기 광고에 서비스 UUID를 싣지 않아 목록에서 빠진다.
//     → 이름 접두사(B1-시리얼번호, NIIMBOT…)로만 찾고, 서비스 UUID는 optionalServices로 접근 권한만 받는다.
//  2) 특성(characteristic) 찾기: 알려진 서비스 UUID를 먼저 직접 조회하고, 안 되면 전체 서비스를 훑는다.
//     notify + writeWithoutResponse 특성을 우선, 없으면 notify + write 특성도 허용한다.
//  3) 패킷 전송: writeWithoutResponse를 지원하면 writeValueWithoutResponse()를 우선 사용하고,
//     아니면 writeValueWithResponse()(구형 구현은 writeValue())로 보낸다.
//     iOS에서는 패킷 사이 간격을 조금 늘려 대용량 이미지 전송 중 끊김을 줄인다.
const NB = window.niimbluelib;

/** GATT 통신용 서비스 UUID (Bluefy 호환을 위해 반드시 소문자) */
export const NIIMBOT_SERVICE_UUIDS = ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'].map(u => u.toLowerCase());

/** 장치 검색 필터: 이름 접두사만 사용 (services 조건 없음) */
export const NIIMBOT_NAME_FILTERS = [{ namePrefix: 'B1' }, { namePrefix: 'NIIMBOT' }];

const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** iOS(Bluefy)에서 패킷 사이 간격(ms). 기본값은 라이브러리 기본 10ms */
export const IOS_PACKET_INTERVAL_MS = 15;

export class BluefySafeNiimbotClient extends NB.NiimbotBluetoothClient {
  constructor() {
    super();
    this.setServiceUuidFilter(NIIMBOT_SERVICE_UUIDS);
    if (IS_IOS) this.setPacketInterval(IOS_PACKET_INTERVAL_MS);
    this.writeMode = 'withoutResponse';
  }

  async connect(options) {
    if (options?.authorizedDevice !== undefined) return super.connect(options);
    const device = await navigator.bluetooth.requestDevice({
      filters: NIIMBOT_NAME_FILTERS,
      optionalServices: this.getServiceUuidFilter().map(u => u.toLowerCase()),
    });
    // 고른 기기를 넘겨 GATT 연결·알림 구독·프린터 정보 협상은 라이브러리 기본 흐름을 그대로 탄다
    return super.connect({ ...options, authorizedDevice: device });
  }

  async findSuitableBluetoothCharacteristic(gattServer) {
    // 1) 알려진 서비스 UUID로 직접 조회 (일부 Web BLE 구현은 인자 없는 getPrimaryServices()가 비어 있음)
    const services = [];
    for (const uuid of this.getServiceUuidFilter()) {
      try { services.push(await gattServer.getPrimaryService(uuid.toLowerCase())); } catch { /* 이 기기에 없음 */ }
    }
    // 2) 그래도 없으면 접근 가능한 전체 서비스
    if (!services.length) {
      try { services.push(...await gattServer.getPrimaryServices()); } catch { /* 무시 */ }
    }

    let fallback;
    for (const service of services) {
      if (service.uuid.length < 5) continue;   // 16비트 표준 서비스(배터리 등) 제외
      for (const c of await service.getCharacteristics()) {
        if (c.properties.notify && c.properties.writeWithoutResponse) {
          this.writeMode = 'withoutResponse';
          return c;
        }
        if (!fallback && c.properties.notify && c.properties.write) fallback = c;
      }
    }
    if (fallback) this.writeMode = 'withResponse';
    return fallback;
  }

  async sendRaw(data, force) {
    const send = async () => {
      const ch = this.channel;
      if (ch === undefined) throw new Error('Channel is closed');
      await NB.Utils.sleep(this.packetIntervalMs);
      const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      if (ch.properties.writeWithoutResponse && typeof ch.writeValueWithoutResponse === 'function') {
        await ch.writeValueWithoutResponse(buf);              // 우선: 응답 대기 없이 빠르게
      } else if (typeof ch.writeValueWithResponse === 'function') {
        await ch.writeValueWithResponse(buf);
      } else {
        await ch.writeValue(buf);                             // 구형 Web Bluetooth 구현
      }
      this.emit('rawpacketsent', new NB.RawPacketSentEvent(data));
    };
    if (force) await send();
    else await this.mutex.runExclusive(send);
  }
}
