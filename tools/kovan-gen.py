#!/usr/bin/env python3
"""Harf Kovanı bölümlerini üretir.

tools/kovan-sozluk.txt içindeki elle seçilmiş kelimelerden harf havuzları kurar,
her havuzdan çıkan bütün kelimeleri hesaplar ve js/data/kovan-levels.js dosyasını yazar.
Oyun çalışırken arama yapmaz: bölümdeki kelimeler baştan bellidir.

    python3 tools/kovan-gen.py
"""
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ALPHA = set('abcçdefgğhıijklmnoöprsştuüvyz')
VOWELS = set('aeıioöuü')
# Havuz olarak tercih edilen temalar: arıcılık ve doğa önce gelsin
THEME = set('kovan petek nektar polen bahçe çiçek bal arıcı larva kraliçe yonca orman tarla meyve bahar tohum yaprak'.split())


def load(path):
    out = []
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        w = line.strip()
        if not w or w.startswith('#'):
            continue
        out.append(w)
    return out


def main():
    raw = load(ROOT / 'tools' / 'kovan-sozluk.txt')
    words, bad = [], []
    seen = set()
    for w in raw:
        if w in seen:
            continue
        seen.add(w)
        if not set(w) <= ALPHA:
            bad.append((w, 'yabancı harf'))
            continue
        if not (3 <= len(w) <= 7):
            bad.append((w, f'{len(w)} harf'))
            continue
        words.append(w)

    big = set(load(ROOT / 'data' / 'words.txt'))
    yok = [w for w in words if w not in big]

    print(f'sözlük: {len(raw)} satır, {len(words)} kelime kullanıldı, {len(bad)} eleme')
    for w, why in bad:
        print(f'  - {w} ({why})')
    print(f'words.txt içinde olmayan {len(yok)} kelime:')
    print('  ' + ' '.join(yok))

    by_len = {}
    for w in words:
        by_len.setdefault(len(w), []).append(w)

    def spellable(pool_counter, w):
        c = Counter(w)
        return all(pool_counter[ch] >= n for ch, n in c.items())

    cands = {}
    for anchor in words:
        if not (5 <= len(anchor) <= 7):
            continue
        letters = Counter(anchor)
        if len(letters) < 4:
            continue
        if sum(n for ch, n in letters.items() if ch in VOWELS) < 2:
            continue
        found = [w for w in words if len(w) <= len(anchor) and spellable(letters, w)]
        lens = Counter(len(w) for w in found)
        lo, hi = {5: (5, 11), 6: (7, 14), 7: (8, 16)}[len(anchor)]
        if not (lo <= len(found) <= hi):
            continue
        if sum(n for L, n in lens.items() if L >= 4) < 3:
            continue
        # Üç harfli kelime seli olmasın
        if lens[3] > len(found) * 0.6:
            continue
        sig = ''.join(sorted(anchor))
        score = len(found) + len(lens) * 2 + (6 if anchor in THEME else 0)
        old = cands.get(sig)
        if not old or score > old[0]:
            cands[sig] = (score, anchor, sorted(found, key=lambda w: (len(w), w)))

    want = {5: 12, 6: 20, 7: 28}
    # Aynı harf kümesinin tekrar etmemesi için: seçilenlere çok benzeyen havuzu atla
    taken = []

    def too_close(letters):
        for prev in taken:
            ortak = len(letters & prev)
            if ortak / len(letters | prev) > 0.7:
                return True
        return False

    picked = {5: [], 6: [], 7: []}
    for score, anchor, found in sorted(cands.values(), key=lambda t: -t[0]):
        L = len(anchor)
        if len(picked[L]) >= want[L]:
            continue
        letters = set(anchor)
        if too_close(letters):
            continue
        taken.append(letters)
        picked[L].append((score, anchor, found))

    out = []
    for L in (5, 6, 7):
        rows = picked[L]
        print(f'{L} harf: {len(rows)} bölüm')
        rows.sort(key=lambda t: (len(t[2]), t[1]))
        out += [(a, w) for _, a, w in rows]

    body = ',\n'.join("  { a: '%s', w: [%s] }" % (a, ', '.join(f"'{w}'" for w in ws)) for a, ws in out)
    js = (
        "// Harf Kovanı bölümleri: tools/kovan-gen.py üretir, elle düzenlenmez.\n"
        "// a = havuzu kuran kelime (harfler bundan gelir), w = o harflerden çıkan bütün kelimeler.\n"
        f"export const PUZZLES = [\n{body},\n];\n"
    )
    (ROOT / 'js' / 'data' / 'kovan-levels.js').write_text(js, encoding='utf-8')
    tot = sum(len(w) for _, w in out)
    print(f'yazıldı: {len(out)} bölüm, {tot} kelime, ortalama {tot / len(out):.1f}')


if __name__ == '__main__':
    main()
