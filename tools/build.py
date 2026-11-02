#!/usr/bin/env python3
"""sw.js dosyasını üretir: bütün dosyaların listesi ve içerikten çıkan sürüm.
Bir dosya değişince sürüm de değişir, telefon yeni hali indirir.
Kullanım: python3 tools/build.py"""
import hashlib
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', 'tools', 'node_modules'}
SKIP_FILES = {'sw.js', 'README.md', '.gitignore', '.nojekyll', 'LICENSES.md'}

# Boyutlar rem'e çevrilir: tablette kök yazı büyüyünce arayüz de orantılı büyür (@media satırları hariç)
for name in ('base.css', 'hub.css', 'games.css'):
    path = os.path.join(ROOT, 'css', name)
    out = []
    for line in open(path, encoding='utf-8').read().split('\n'):
        if line.lstrip().startswith('@media') or line.lstrip().startswith('html {'):
            out.append(line)
            continue
        out.append(re.sub(r'(?<![\w.#-])(-?\d*\.?\d+)px', lambda m: f"{round(float(m.group(1)) / 16, 4):g}rem", line))
    open(path, 'w', encoding='utf-8').write('\n'.join(out))

files = []
for base, dirs, names in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for n in names:
        if n in SKIP_FILES or n.startswith('.'):
            continue
        files.append(os.path.relpath(os.path.join(base, n), ROOT).replace(os.sep, '/'))
files.sort()
h = hashlib.sha256()
size = 0
for f in files:
    data = open(os.path.join(ROOT, f), 'rb').read()
    h.update(f.encode())
    h.update(data)
    size += len(data)
version = h.hexdigest()[:12]
sw = open(os.path.join(ROOT, 'tools', 'sw-template.js'), encoding='utf-8').read()
sw = sw.replace('__VERSION__', version).replace('__ASSETS__', json.dumps(['./'] + files, ensure_ascii=False, indent=2))
open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8').write(sw)
print(f'{len(files)} dosya, {size / 1024 / 1024:.1f} MB, sürüm {version}')
