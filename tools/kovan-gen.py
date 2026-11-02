#!/usr/bin/env python3
"""Harf Kovanı kelime verilerini üretir.

Girdi: tools/kovan-sozluk.txt (elle seçilmiş, günlük Türkçede tanıdık kelimeler),
data/words.txt (büyük liste) ve Türkçe sıklık listesi (FrequencyWords, tools/.cache altına iner).

Çıktı:
    js/data/kovan-levels.js  Harf Çiçeği bölümleri: harf havuzu ve o havuzdan çıkan bütün kelimeler
    js/data/kovan-sozluk.js  Petek Avı'nın tahtaya koyduğu, arının gösterdiği kelimeler (sık olan önde)
    data/yaygin.txt          Tam puan alan kelimeler: büyük liste ile sıklık listesinin kesişimi

    python3 tools/kovan-gen.py
"""
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ALPHA = set('abcçdefgğhıijklmnoöprsştuüvyz')
VOWELS = set('aeıioöuü')
FREQ_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/tr/tr_50k.txt'
FREQ_FILE = ROOT / 'tools' / '.cache' / 'tr_50k.txt'
# Havuz olarak tercih edilen temalar: arıcılık ve doğa önce gelsin
THEME = set('kovan petek nektar polen bahçe çiçek arıcı larva kraliçe yonca orman tarla meyve bahar tohum yaprak'.split())
# Sıklık listesinde olsa da tam puanla kutlanmayacak kelimeler
DENY = set('sik göt piç bok ibne orospu kaltak fahişe sürtük gerzek seks porno penis meme taciz tecavüz kıç lan ulan sapık'.split())
# Sıklık listesinde bulunmayan elle seçilmişler orta sıraya girer
RANK_MISSING = 15000


def load(path):
    out = []
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        w = line.strip()
        if w and not w.startswith('#'):
            out.append(w)
    return out


def load_rank():
    if not FREQ_FILE.exists():
        FREQ_FILE.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(FREQ_URL, FREQ_FILE)
    rank = {}
    for i, line in enumerate(FREQ_FILE.read_text(encoding='utf-8').splitlines()):
        rank.setdefault(line.split(' ')[0], i + 1)
    return rank


def spellable(pool, w):
    return all(pool[ch] >= n for ch, n in Counter(w).items())


def make_puzzles(words):
    cands = {}
    for anchor in words:
        if not 5 <= len(anchor) <= 7:
            continue
        letters = Counter(anchor)
        if len(letters) < 4 or sum(n for ch, n in letters.items() if ch in VOWELS) < 2:
            continue
        found = [w for w in words if len(w) <= len(anchor) and spellable(letters, w)]
        lens = Counter(len(w) for w in found)
        lo, hi = {5: (5, 11), 6: (7, 14), 7: (8, 16)}[len(anchor)]
        if not lo <= len(found) <= hi:
            continue
        if sum(n for L, n in lens.items() if L >= 4) < 3 or lens[3] > len(found) * 0.6:
            continue
        sig = ''.join(sorted(anchor))
        score = len(found) + len(lens) * 2 + (6 if anchor in THEME else 0)
        if sig not in cands or score > cands[sig][0]:
            cands[sig] = (score, anchor, sorted(found, key=lambda w: (len(w), w)))

    want = {5: 12, 6: 20, 7: 26}
    taken = []
    picked = {5: [], 6: [], 7: []}
    for row in sorted(cands.values(), key=lambda t: -t[0]):
        L = len(row[1])
        letters = set(row[1])
        if len(picked[L]) >= want[L]:
            continue
        # Aynı harf kümesi tekrar etmesin: seçilenlere çok benzeyen havuzu atla
        if any(len(letters & p) / len(letters | p) > 0.7 for p in taken):
            continue
        taken.append(letters)
        picked[L].append(row)
    for L in picked:
        picked[L].sort(key=lambda t: (len(t[2]), t[1]))
        print(f'{L} harf: {len(picked[L])} bölüm')

    # Sıra: dörtlük ısınma, sonra beşli altılı dönüşümlü, ardından yediliye geçiş
    five, six, seven = [picked[5][:], picked[6][:], picked[7][:]]
    order = [five.pop(0) for _ in range(4)]
    while five:
        order.append(six.pop(0))
        order.append(five.pop(0))
    while six:
        order.append(six.pop(0))
        if six:
            order.append(six.pop(0))
        if seven:
            order.append(seven.pop(0))
    order += seven
    return [(r[1], r[2]) for r in order]


def main():
    raw = load(ROOT / 'tools' / 'kovan-sozluk.txt')
    rank = load_rank()
    big = set(load(ROOT / 'data' / 'words.txt'))
    seen, words, bad = set(), [], []
    for w in raw:
        if w in seen:
            continue
        seen.add(w)
        if not set(w) <= ALPHA or not 3 <= len(w) <= 7:
            bad.append(w)
            continue
        words.append(w)
    print(f'sözlük: {len(words)} kelime, {len(bad)} eleme: {" ".join(bad)}')

    # Petek Avı sözlüğü: sık kullanılan önde, oyun sıklığa göre ağırlıklı seçer
    by_rank = sorted(words, key=lambda w: (rank.get(w, RANK_MISSING), w))
    (ROOT / 'js' / 'data' / 'kovan-sozluk.js').write_text(
        '// Harf Kovanı sözlüğü: tools/kovan-gen.py üretir, elle düzenlenmez. Sık kullanılan kelimeler önde.\n'
        f"export const SOZLUK = '{' '.join(by_rank)}'.split(' ');\n", encoding='utf-8')

    # Yaygın kelimeler: nadir ve uydurma duran kelimeler bu listeye giremez
    common = sorted(w for w in big if w in rank and 3 <= len(w) <= 10 and w not in DENY)
    (ROOT / 'data' / 'yaygin.txt').write_text('\n'.join(common) + '\n', encoding='utf-8')
    print(f'yaygın: {len(common)} kelime')

    puzzles = make_puzzles(words)
    body = ',\n'.join("  { a: '%s', w: [%s] }" % (a, ', '.join(f"'{w}'" for w in ws)) for a, ws in puzzles)
    (ROOT / 'js' / 'data' / 'kovan-levels.js').write_text(
        '// Harf Çiçeği bölümleri: tools/kovan-gen.py üretir, elle düzenlenmez.\n'
        '// a = havuzu kuran kelime (harfler bundan gelir), w = o harflerden çıkan bütün kelimeler.\n'
        f'export const PUZZLES = [\n{body},\n];\n', encoding='utf-8')
    tot = sum(len(w) for _, w in puzzles)
    print(f'yazıldı: {len(puzzles)} bölüm, {tot} kelime, ortalama {tot / len(puzzles):.1f}')


if __name__ == '__main__':
    main()
