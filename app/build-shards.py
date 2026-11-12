# 이름 사전 생성 (JMnedict 이름 + KANJIDIC2 한자 읽기)
#  → dict/shard/{첫 글자 코드}.json  방문자 웹용: 입력한 글자의 조각만 받음
#  → dict/full.json                 오프라인용 통합본: 홈 화면 웹앱이 한 번에 저장
#  → dict/kanji.json                한자별 음독·훈독·이름용 읽기
# 출처: EDRDG JMnedict / KANJIDIC2, CC BY-SA 4.0
import gzip, re, json, os, collections, urllib.request

def fetch(url, path):
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path)
    return gzip.open(path, 'rt', encoding='utf-8').read()

k2h = lambda s: ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)

# 1) JMnedict: 성(surname) / 이름(given·fem·masc)
data = fetch('http://ftp.edrdg.org/pub/Nihongo/JMnedict.xml.gz', '/tmp/jmn.gz')
sur, giv = collections.defaultdict(set), collections.defaultdict(set)
for e in re.findall(r'<entry>(.*?)</entry>', data, re.S):
    ks = re.findall(r'<keb>(.*?)</keb>', e)
    rs = [k2h(r) for r in re.findall(r'<reb>(.*?)</reb>', e)]
    nts = set(re.findall(r'<name_type>&(\w+);</name_type>', e))
    for k in ks:
        if 'surname' in nts: sur[k].update(rs)
        if nts & {'given', 'fem', 'masc'}: giv[k].update(rs)

# 2) KANJIDIC2: 한자별 음독·훈독·이름용 읽기
data = fetch('http://www.edrdg.org/kanjidic/kanjidic2.xml.gz', '/tmp/kd2.gz')
kanji = {}
for ch in re.findall(r'<character>(.*?)</character>', data, re.S):
    lit = re.search(r'<literal>(.*?)</literal>', ch).group(1)
    on = {k2h(r).replace('-', '') for r in re.findall(r'<reading r_type="ja_on">(.*?)</reading>', ch)}
    kun = set()
    for r in re.findall(r'<reading r_type="ja_kun">(.*?)</reading>', ch):
        r = r.replace('-', ''); kun.add(r.replace('.', '')); kun.add(r.split('.')[0])
    kanji[lit] = {'on': sorted(on), 'kun': sorted(kun), 'nan': sorted(set(re.findall(r'<nanori>(.*?)</nanori>', ch)))}

os.makedirs('dict/shard', exist_ok=True)
shards = collections.defaultdict(lambda: {'s': {}, 'g': {}})
for kind, src in (('s', sur), ('g', giv)):
    for k, v in src.items():
        shards[k[0]][kind][k] = sorted(v)
for ch, d in shards.items():
    with open(f'dict/shard/{ord(ch):x}.json', 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
with open('dict/kanji.json', 'w', encoding='utf-8') as f:
    json.dump(kanji, f, ensure_ascii=False, separators=(',', ':'))
full = {'s': {k: sorted(v) for k, v in sur.items()}, 'g': {k: sorted(v) for k, v in giv.items()}}
with open('dict/full.json', 'w', encoding='utf-8') as f:
    json.dump(full, f, ensure_ascii=False, separators=(',', ':'))
# 노드 테스트용 전체본
json.dump({'s': {k: sorted(v) for k, v in sur.items()}, 'g': {k: sorted(v) for k, v in giv.items()}},
          open('/tmp/names.json', 'w'), ensure_ascii=False)
json.dump(kanji, open('/tmp/kanji.json', 'w'), ensure_ascii=False)
print(len(shards), 'shards,', len(kanji), 'kanji')
