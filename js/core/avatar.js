// Sinem'in blobu ve dolaptaki aksesuarlar. Furkan da Kahvehane'de rakip olarak çıkar.

import { raw } from './dom.js';

const BODY = 'M0,-48 C28,-48 46,-28 46,2 C46,32 28,48 0,48 C-28,48 -46,32 -46,2 C-46,-28 -28,-48 0,-48 Z';
const C = ['#4fb6ff', '#ff6fae'];

const FURKAN = {
  back: '<circle class="ink" cx="14" cy="-54" r="10" fill="#9c6a3d"/>',
  front: '<path class="ink" d="M-39,8 C-37,33 -20,45 0,45 C20,45 37,33 39,8 C33,25 18,33 0,33 C-18,33 -33,25 -39,8 Z" fill="#9a6a40"/>',
  hair: '<path class="ink" d="M-42,-12 C-44,-40 -22,-52 2,-51 C26,-50 44,-38 42,-12 C36,-25 24,-31 10,-30 C0,-29 -8,-25 -14,-20 C-22,-27 -34,-24 -42,-12 Z" fill="#b07a48"/><path d="M8,-46 L19,-47" stroke="#2a1636" stroke-width="4" stroke-linecap="round"/>',
};
const SINEM = {
  back: '<path class="ink" d="M-44,-22 C-58,-2 -54,22 -52,36 C-49,44 -41,43 -39,36 C-36,42 -28,42 -27,34 L27,34 C28,42 36,42 39,36 C41,43 49,44 52,36 C54,22 58,-2 44,-22 Z" fill="#4a2a20"/>',
  hair: '<path class="ink" d="M-45,-8 C-48,-40 -25,-53 0,-53 C25,-53 48,-40 45,-8 C41,-19 35,-24 27,-25 C22,-19 13,-21 9,-28 C3,-21 -8,-20 -14,-27 C-20,-21 -30,-21 -36,-24 C-40,-20 -43,-15 -45,-8 Z" fill="#4a2a20"/>',
};

const ring = (c) => `<g fill="none"><circle cx="-46" cy="13" r="5.5" stroke="#2a1636" stroke-width="5.6"/><circle cx="-46" cy="13" r="5.5" stroke="${c}" stroke-width="2.6"/><circle cx="46" cy="13" r="5.5" stroke="#2a1636" stroke-width="5.6"/><circle cx="46" cy="13" r="5.5" stroke="${c}" stroke-width="2.6"/></g>`;
const drop = (body) => [-46, 46].map((x) => `<g transform="translate(${x} 14)">${body}</g>`).join('');

// Dolap: her yuvada bir parça. Fiyat altın olarak
export const ITEMS = {
  glasses: [
    { id: 'g-round', name: 'Yuvarlak Gözlük', price: 0, svg: '<g fill="none" stroke="#2a1636" stroke-linecap="round"><circle cx="-16" cy="-4" r="12.5" stroke-width="3.4" fill="#ffffff26"/><circle cx="16" cy="-4" r="12.5" stroke-width="3.4" fill="#ffffff26"/><path d="M-3.5,-6 Q0,-9 3.5,-6 M-28.5,-6 L-41,-9 M28.5,-6 L41,-9" stroke-width="3.2"/></g>' },
    { id: 'g-heart', name: 'Kalp Gözlük', price: 120, svg: '<g stroke="#2a1636" stroke-width="3" stroke-linejoin="round"><path d="M-16,8 C-32,-2 -30,-16 -22,-16 C-18,-16 -16,-12 -16,-11 C-16,-12 -14,-16 -10,-16 C-2,-16 0,-2 -16,8 Z" fill="#ff5fa2cc"/><path d="M16,8 C0,-2 2,-16 10,-16 C14,-16 16,-12 16,-11 C16,-12 18,-16 22,-16 C30,-16 32,-2 16,8 Z" fill="#ff5fa2cc"/><path d="M-2,-8 L2,-8 M-30,-8 L-41,-10 M30,-8 L41,-10" fill="none"/></g>' },
    { id: 'g-sun', name: 'Güneş Gözlüğü', price: 90, svg: '<g stroke="#2a1636" stroke-width="3" stroke-linejoin="round"><path d="M-30,-13 H-3 V-2 Q-4,8 -16,8 Q-29,8 -30,-2 Z" fill="#2a1636"/><path d="M30,-13 H3 V-2 Q4,8 16,8 Q29,8 30,-2 Z" fill="#2a1636"/><path d="M-3,-9 H3 M-30,-9 L-41,-11 M30,-9 L41,-11" fill="none"/></g><path d="M-25,-9 L-16,-9 M8,-9 L17,-9" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>' },
    { id: 'g-lab', name: 'Lab Gözlüğü', price: 150, svg: '<g stroke="#2a1636" stroke-width="3.2" stroke-linejoin="round"><path d="M-34,-14 Q0,-20 34,-14 Q38,4 24,8 Q8,10 2,2 Q0,0 -2,2 Q-8,10 -24,8 Q-38,4 -34,-14 Z" fill="#9fe6ff66"/><path d="M-34,-8 L-43,-10 M34,-8 L43,-10" fill="none"/></g><path d="M-24,-10 L-12,-11" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>' },
  ],
  ear: [
    { id: 'e-hoop', name: 'Altın Halka', price: 0, svg: ring('#ffcd3c') },
    { id: 'e-silver', name: 'Gümüş Halka', price: 60, svg: ring('#dfe6ef') },
    { id: 'e-pearl', name: 'İnci Küpe', price: 110, svg: drop('<circle r="6.5" fill="#fff8ee" stroke="#2a1636" stroke-width="2.8"/><circle cx="-2" cy="-2" r="1.7" fill="#fff"/>') },
    { id: 'e-star', name: 'Yıldız Küpe', price: 140, svg: drop('<path d="M0,-8 L2.4,-2.6 L8,-2 L3.8,1.8 L5,7.6 L0,4.8 L-5,7.6 L-3.8,1.8 L-8,-2 L-2.4,-2.6 Z" fill="#ffcd3c" stroke="#2a1636" stroke-width="2.4" stroke-linejoin="round"/>') },
    { id: 'e-dna', name: 'DNA Küpe', price: 220, svg: drop('<path d="M-3,-9 Q5,-4 -3,1 Q5,6 -3,11 M3,-9 Q-5,-4 3,1 Q-5,6 3,11" fill="none" stroke="#2a1636" stroke-width="4.4"/><path d="M-3,-9 Q5,-4 -3,1 Q5,6 -3,11" fill="none" stroke="#2ed6a0" stroke-width="2"/><path d="M3,-9 Q-5,-4 3,1 Q-5,6 3,11" fill="none" stroke="#ff5fa2" stroke-width="2"/>') },
  ],
  hat: [
    { id: 'h-none', name: 'Şapkasız', price: 0, svg: '' },
    { id: 'h-beret', name: 'Bere', price: 130, svg: '<path class="ink" d="M-40,-36 C-46,-58 -14,-70 12,-66 C38,-62 48,-44 38,-36 C16,-46 -18,-46 -40,-36 Z" fill="#ff4f62"/><circle class="ink" cx="4" cy="-68" r="4" fill="#ff4f62"/>' },
    { id: 'h-cat', name: 'Kedi Kulağı', price: 100, svg: '<path class="ink" d="M-40,-30 L-34,-68 L-10,-48 Z" fill="#2a1636"/><path d="M-34,-40 L-31,-58 L-20,-48 Z" fill="#ff9ec7"/><path class="ink" d="M40,-30 L34,-68 L10,-48 Z" fill="#2a1636"/><path d="M34,-40 L31,-58 L20,-48 Z" fill="#ff9ec7"/>' },
    { id: 'h-crown', name: 'Taç', price: 400, svg: '<path class="ink" d="M-22,-48 L-26,-74 L-10,-60 L0,-78 L10,-60 L26,-74 L22,-48 Z" fill="#ffcd3c"/><circle cx="0" cy="-58" r="3.4" fill="#ff5fa2" stroke="#2a1636" stroke-width="2"/>' },
    { id: 'h-flower', name: 'Çiçek Taç', price: 180, svg: [-32, -16, 0, 16, 32].map((x, i) => `<g transform="translate(${x} ${-48 - (i === 2 ? 6 : i % 2 ? 4 : 0)})"><circle r="8" fill="${['#ff8cc0', '#ffcd3c', '#ff5fa2', '#a98bff', '#ff8cc0'][i]}" stroke="#2a1636" stroke-width="2.8"/><circle r="2.6" fill="#fff"/></g>`).join('') },
    { id: 'h-chef', name: 'Dönerci Kepi', price: 160, svg: '<path class="ink" d="M-30,-40 L-28,-52 L28,-52 L30,-40 Q0,-48 -30,-40 Z" fill="#fff"/><path class="ink" d="M-28,-52 C-44,-62 -28,-82 -12,-74 C-8,-88 14,-88 16,-74 C32,-82 44,-62 28,-52 Z" fill="#fff"/>' },
    { id: 'h-phones', name: 'Kulaklık', price: 200, svg: '<path d="M-46,-6 C-48,-72 48,-72 46,-6" fill="none" stroke="#2a1636" stroke-width="10" stroke-linecap="round"/><path d="M-46,-6 C-48,-72 48,-72 46,-6" fill="none" stroke="#2ed6a0" stroke-width="4.5" stroke-linecap="round"/><rect class="ink" x="-58" y="-20" width="15" height="28" rx="7" fill="#2ed6a0"/><rect class="ink" x="43" y="-20" width="15" height="28" rx="7" fill="#2ed6a0"/>' },
  ],
  neck: [
    { id: 'n-none', name: 'Sade', price: 0, svg: '' },
    { id: 'n-pearl', name: 'İnci Kolye', price: 170, svg: Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (0.2 + (i / 8) * 0.6); return `<circle cx="${(Math.cos(a) * 34).toFixed(1)}" cy="${(Math.sin(a) * 44).toFixed(1)}" r="4" fill="#fff8ee" stroke="#2a1636" stroke-width="2"/>`; }).join('') },
    { id: 'n-scarf', name: 'Fular', price: 120, svg: '<path class="ink" d="M-34,30 C-16,42 16,42 34,30 L36,40 C16,52 -16,52 -36,40 Z" fill="#ffcd3c"/><path class="ink" d="M14,44 L26,66 L8,62 Z" fill="#ffcd3c"/>' },
    { id: 'n-steth', name: 'Stetoskop', price: 240, svg: '<path d="M-26,18 C-26,50 26,50 26,18" fill="none" stroke="#2a1636" stroke-width="6" stroke-linecap="round"/><path d="M-26,18 C-26,50 26,50 26,18" fill="none" stroke="#4fb6ff" stroke-width="2.6" stroke-linecap="round"/><path d="M0,44 V54" stroke="#2a1636" stroke-width="5"/><circle class="ink" cx="0" cy="58" r="6" fill="#dfe6ef"/>' },
    { id: 'n-coat', name: 'Lab Önlüğü', price: 280, svg: '<path class="ink" d="M-40,26 C-30,44 -12,48 0,48 C12,48 30,44 40,26 L44,50 L-44,50 Z" fill="#fff"/><path class="ink" d="M-12,48 L0,34 L12,48 Z" fill="#dff4ff"/>' },
  ],
};
export const SLOT_NAMES = { hat: 'Baş', glasses: 'Gözlük', ear: 'Küpe', neck: 'Boyun' };
export const DEFAULT_WORN = { hat: 'h-none', glasses: 'g-round', ear: 'e-hoop', neck: 'n-none' };
const find = (slot, id) => ITEMS[slot].find((x) => x.id === id) || ITEMS[slot][0];

const EYES = `
  <g class="b-eyes">
    <ellipse class="b-white ink" cx="-16" cy="-4" rx="8.5" ry="10"/>
    <ellipse class="b-white ink" cx="16" cy="-4" rx="8.5" ry="10"/>
    <g class="b-pupils"><circle cx="-16" cy="-3" r="4.6"/><circle cx="16" cy="-3" r="4.6"/><circle class="b-dot" cx="-14.4" cy="-5" r="1.5"/><circle class="b-dot" cx="17.6" cy="-5" r="1.5"/></g>
  </g>
  <path class="b-happy" d="M-23,-1 Q-16,-10 -9,-1 M9,-1 Q16,-10 23,-1"/>`;
const MOUTH = `
  <g class="b-mouth">
    <path class="m-smile m-line" d="M-9,14 Q0,23 9,14"/>
    <g class="m-laugh"><path class="m-fill" d="M-11,12 Q0,31 11,12 Z"/><path class="m-tongue" d="M-5.5,21.5 Q0,27 5.5,21.5 Q0,18.5 -5.5,21.5 Z"/></g>
    <ellipse class="m-wow m-fill" cx="0" cy="18" rx="5" ry="6.5"/>
    <path class="m-sad m-line" d="M-8,21 Q0,13 8,21"/>
    <path class="m-smirk m-line" d="M-8,16 Q2,22 10,12"/>
  </g>`;

export function blob(who, { mood = 'happy', eyes = 'open', worn = null, cls = '', hands = true } = {}) {
  const p1 = who === 0;
  const w = { ...DEFAULT_WORN, ...(worn || {}) };
  const c = C[who];
  const parts = p1 ? '' : `${find('ear', w.ear).svg}${find('glasses', w.glasses).svg}`;
  return raw(`<svg class="blob ${cls}" data-mood="${mood}" data-eyes="${eyes}" viewBox="0 0 140 160" aria-hidden="true"><g transform="translate(70 92)">
    <ellipse class="b-shadow" cx="0" cy="52" rx="34" ry="6"/>
    <g class="b-bob">
      ${p1 ? FURKAN.back : SINEM.back}
      <g class="b-body"><path class="ink" d="${BODY}" fill="${c}"/><ellipse class="b-shine" cx="-21" cy="-27" rx="10" ry="5.5" transform="rotate(-32 -21 -27)"/></g>
      ${p1 ? '' : find('neck', w.neck).svg}
      <ellipse class="b-cheek" cx="-27" cy="9" rx="6" ry="4"/><ellipse class="b-cheek" cx="27" cy="9" rx="6" ry="4"/>
      ${p1 ? FURKAN.front : ''}
      ${p1 ? FURKAN.hair : SINEM.hair}
      ${EYES}
      ${parts}
      ${p1 ? '' : find('hat', w.hat).svg}
      ${MOUTH}
      ${hands ? `<circle class="ink" cx="-44" cy="28" r="9.5" fill="${c}"/><circle class="ink" cx="44" cy="28" r="9.5" fill="${c}"/>` : ''}
    </g>
  </g></svg>`);
}

// Oyun içi küçük müşteri bloblar: farklı renk, saç ve ifadeyle
const SKIN = ['#ffd2a8', '#f1b98c', '#c98f63', '#ffe0c2', '#8fd3ff', '#b7efcf', '#d8c6ff', '#ffc2dc'];
const HAIR = ['#2a1636', '#4a2a20', '#9c6a3d', '#d94f3d', '#e8c15a', '#7a5cff', '#2fbf71', '#f3f3f3'];
export function customer(seed, { mood = 'happy', cls = '' } = {}) {
  const s = SKIN[seed % SKIN.length];
  const h = HAIR[(seed * 7 + 3) % HAIR.length];
  const style = seed % 5;
  const hair = [
    `<path class="ink" d="M-42,-10 C-46,-44 -22,-52 0,-52 C22,-52 46,-44 42,-10 C34,-28 20,-30 0,-30 C-20,-30 -34,-28 -42,-10 Z" fill="${h}"/>`,
    `<path class="ink" d="M-40,-22 C-34,-50 34,-50 40,-22 C24,-34 -24,-34 -40,-22 Z" fill="${h}"/><circle class="ink" cx="0" cy="-56" r="10" fill="${h}"/>`,
    `<path class="ink" d="M-46,10 C-54,-42 -24,-54 0,-54 C24,-54 54,-42 46,10 C42,-16 30,-28 0,-28 C-30,-28 -42,-16 -46,10 Z" fill="${h}"/>`,
    `<path class="ink" d="M-30,-40 C-28,-60 -10,-50 -8,-46 C-4,-62 10,-60 10,-46 C16,-58 32,-52 30,-40 C14,-48 -14,-48 -30,-40 Z" fill="${h}"/>`,
    `<path class="ink" d="M-38,-30 L38,-30 L34,-46 C14,-58 -14,-58 -34,-46 Z" fill="${h}"/><path class="ink" d="M-44,-28 L44,-28 L44,-22 L-44,-22 Z" fill="${h}"/>`,
  ][style];
  return raw(`<svg class="blob cust ${cls}" data-mood="${mood}" data-eyes="open" viewBox="0 0 110 120" aria-hidden="true"><g transform="translate(55 66)"><g class="b-bob">
    <path class="ink" d="${BODY}" fill="${s}"/>
    <ellipse class="b-cheek" cx="-27" cy="9" rx="6" ry="4"/><ellipse class="b-cheek" cx="27" cy="9" rx="6" ry="4"/>
    ${hair}${EYES}${MOUTH}
  </g></g></svg>`);
}

export const setMood = (svg, mood, eyes) => {
  if (!svg) return;
  svg.dataset.mood = mood;
  if (eyes) svg.dataset.eyes = eyes;
};
