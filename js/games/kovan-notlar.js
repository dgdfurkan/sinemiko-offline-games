// Harf Kovanı'nın bölüm sonu kartları: arıcılıkla ilgili notlar ve hareketli çizimleri.

import { html, raw } from '../core/dom.js';
import { openSheet, icon } from '../core/ui.js';
import { INK } from './kovan-bag.js';

/* ---------- Bölüm sonu: arıcılık notları ---------- */

const NOTES = [
  { a: 'cicek', t: 'Dört Milyon Çiçek', d: 'Bir kilo bal için koloninin gezdiği çiçek sayısı dört milyonu aşar. Bir arı tek seferde kendi ağırlığının yarısı kadar nektar taşır.' },
  { a: 'petek', t: 'Neden Altıgen?', d: 'Petek gözü altıgendir çünkü aynı miktar balmumuyla en çok hacmi, en az duvarla altıgen verir. Arılar bu hesabı kimseden öğrenmedi.' },
  { a: 'kralice', t: 'Günde İki Bin Yumurta', d: 'Kraliçe yumurtlama mevsiminde günde 1500-2000 yumurta bırakır, yani kendi ağırlığından fazlasını. Koloninin tek yumurtlayan arısıdır.' },
  { a: 'ari', t: 'Altı Haftalık Ömür', d: 'Yaz işçisi altı hafta kadar yaşar; ilk üç hafta kovan içinde bakıcılık, sonrası tarlacılık. Kışı geçiren arılar birkaç ay dayanır.' },
  { a: 'bal', t: 'Bal Nasıl Olgunlaşır?', d: 'Arı nektarı bal midesinde enzimle ayırır, peteğe bırakır. Kanat çırparak su oranını yüzde on sekizin altına indirir, sonra gözü mumla kapatır.' },
  { a: 'dans', t: 'Sekiz Çizen Dans', d: 'Besin yerini anlatan arı petek üstünde sekiz çizer. Dansın açısı güneşe göre yönü, titreşimin süresi uzaklığı söyler.' },
  { a: 'kovan', t: 'Elli Bin Nüfus', d: 'Bir kovan yazın elli altmış bin arıya çıkar. Kış gelince nüfus on bine iner, kalanlar baharı birlikte bekler.' },
  { a: 'arici', t: 'Duman Neden Verilir?', d: 'Duman arıların alarm kokusunu bastırır ve onları bal yemeye yöneltir. Karnı dolu arı sakinleşir, arıcı peteği rahat alır.' },
  { a: 'petek', t: 'Balmumu Pul Pul Gelir', d: 'Balmumu işçi arının karnındaki bezlerden küçük pullar halinde çıkar. Bir kilo mum için arılar kilolarca bal harcar.' },
  { a: 'kralice', t: 'Arı Sütü', d: 'Bütün larvalar ilk günler arı sütüyle beslenir. Beslenmeye devam eden larva kraliçe olur; gerisi işçi kalır. Aradaki tek fark yemek.' },
  { a: 'kovan', t: 'Propolis Tutkalı', d: 'Arılar ağaç reçinesinden propolis yapar, kovandaki çatlakları onunla kapatır. Hem yalıtım hem koruma işi görür.' },
  { a: 'ari', t: 'Kovanda Otuz Beş Derece', d: 'Yavruların bulunduğu bölüm otuz beş derece civarında tutulur. Sıcak olunca arılar kanatla serinletir, soğuk olunca titreyerek ısıtır.' },
  { a: 'cicek', t: 'Morötesini Görürler', d: 'Arılar kırmızıyı göremez ama morötesini görür. Çiçeklerde bizim fark etmediğimiz, nektarı işaret eden desenler var.' },
  { a: 'kovan', t: 'Oğul Verme', d: 'Kovan kalabalıklaşınca kraliçe arıların yarısıyla yeni yuva aramaya çıkar. Buna oğul denir; arıcı oğulu yakalayıp yeni kovana alır.' },
  { a: 'bal', t: 'Bal Bozulmaz', d: 'Suyu az, asidi yüksek ve doğal peroksit içerdiği için balda mikrop üremez. Ağzı kapalı balın yıllarca durması bundan.' },
  { a: 'arici', t: 'Kapaklı Göz Hasat Demek', d: 'Arıcı peteğe bakar: gözler mumla kapanmışsa bal olgundur. Kapaksız bal erken alınırsa suyu fazla kalır ve ekşir.' },
  { a: 'cicek', t: 'Tarımın Sessiz İşçisi', d: 'Yediğimiz bitkilerin büyük bölümü böcek tozlaşmasına bağlı. Arı bal verdiği için değil, tozlaşma yaptığı için paha biçilmez.' },
  { a: 'bal', t: 'Çiçek Tadı Verir', d: 'Akasya balı açık renkli ve akıcı, çam balı koyu ve yoğun olur. Tadı belirleyen şey arının gezdiği kaynaktır.' },
  { a: 'dans', t: 'Güneşi Pusula Yapar', d: 'Arı yön bulmak için güneşin yerini ve gökyüzündeki ışığın yönünü kullanır. Hava kapalıyken bile bu ışığı okuyabilir.' },
  { a: 'ari', t: 'Bir Çay Kaşığı', d: 'Tek bir işçi arı ömrü boyunca bir çay kaşığının on ikide biri kadar bal yapar. Kavanozdaki bal binlerce arının ortak işi.' },
  { a: 'kovan', t: 'Girişteki Bekçiler', d: 'Kovan girişinde bekçi arılar durur. Her koloninin kendine özgü kokusu vardır; yabancı koku içeri girmez.' },
  { a: 'petek', t: 'Aşağı Doğru Örerler', d: 'Arılar peteği yukarıdan aşağı doğru örer, yerçekimini kılavuz alır. Gözler hafif yukarı eğimlidir ki bal akıp dökülmesin.' },
  { a: 'arici', t: 'Binlerce Yıllık İş', d: 'Bal toplama sahneleri on bin yıllık kaya resimlerinde görülür. Arıcılık insanın en eski uğraşlarından biri.' },
  { a: 'kralice', t: 'Polen Protein, Bal Yakıt', d: 'Bal arının yakıtı, polen ise proteini. Polen gelmezse larvalar beslenmez ve koloni büyümeyi keser.' },
];

/* ---------- Not kartı çizimleri ---------- */

const bee = (x, y, s, rot = 0, cls = '') => `<g class="kv-n-bee ${cls}" transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
  <defs><clipPath id="kvAbdomen"><ellipse cx="15" cy="0" rx="16" ry="11.5"/></clipPath></defs>
  <path d="M5 8 q-3 7 -8 9 M12 9 q0 8 2 11 M19 7 q5 6 10 7" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
  <ellipse cx="-3" cy="15" rx="4.5" ry="3.5" fill="#f5c842" stroke="${INK}" stroke-width="1.8"/>
  <path d="M31 0 l7 2.5 -7 2.5z" fill="${INK}"/>
  <ellipse cx="15" cy="0" rx="16" ry="11.5" fill="#ffcd3c"/>
  <g clip-path="url(#kvAbdomen)">
    <rect x="7" y="-13" width="6" height="26" fill="${INK}"/>
    <rect x="17.5" y="-13" width="5.5" height="26" fill="${INK}"/>
    <rect x="27" y="-13" width="5" height="26" fill="${INK}"/>
    <ellipse cx="15" cy="-5" rx="11" ry="3.4" fill="#fff" opacity=".22"/>
  </g>
  <ellipse cx="15" cy="0" rx="16" ry="11.5" fill="none" stroke="${INK}" stroke-width="2.4"/>
  <path d="M-8 -10 l-2.5 -4 M-3 -11.5 l-1 -4.5 M2 -11 l1 -4.5 M-9 10 l-3 4 M-3 11.5 l-1 4.5" stroke="#c98b52" stroke-width="2" stroke-linecap="round"/>
  <circle cx="-2" cy="-0.5" r="11" fill="#f0a000" stroke="${INK}" stroke-width="2.4"/>
  <path d="M-11 -4 q4 -3 8 -2 M-11 3 q4 3 8 2" stroke="#c98b52" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <circle cx="-14" cy="-3" r="8" fill="${INK}"/>
  <ellipse cx="-18.5" cy="-4" rx="3" ry="4" fill="#fff6d8" opacity=".9"/>
  <circle cx="-18.5" cy="-3.4" r="1.5" fill="${INK}"/>
  <path d="M-17 -10 q-4 -7 -10 -7 M-13 -11 q-2 -8 -7 -10" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <circle cx="-27" cy="-17" r="2.2" fill="${INK}"/>
  <circle cx="-20" cy="-21" r="2.2" fill="${INK}"/>
  <g class="kv-n-wing"><path d="M0 -10 q-6 -22 10 -24 q14 -1 8 14 q-4 10 -18 10z" fill="#eaf6ff" stroke="${INK}" stroke-width="1.8" opacity=".92"/><path d="M4 -13 q4 -14 12 -17 M4 -11 q8 -8 16 -8" stroke="${INK}" stroke-width="1" fill="none" opacity=".5"/></g>
  <g class="kv-n-wing kv-n-wing2"><path d="M8 -9 q2 -16 14 -15 q10 1 4 11 q-5 7 -18 4z" fill="#dff0ff" stroke="${INK}" stroke-width="1.8" opacity=".85"/></g>
</g>`;
const combCell = (x, y, s, fill) => `<path d="M${x - s} ${y} L${x - s * 0.5} ${y - s * 0.87} L${x + s * 0.5} ${y - s * 0.87} L${x + s} ${y} L${x + s * 0.5} ${y + s * 0.87} L${x - s * 0.5} ${y + s * 0.87} Z" fill="${fill}" stroke="${INK}" stroke-width="2"/>`;
const combField = (x0, y0, cols, rows, fills) => {
  let out = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = 15;
      out += combCell(x0 + c * s * 1.74 + (r % 2 ? s * 0.87 : 0), y0 + r * s * 1.5, s, fills[(r * cols + c) % fills.length]);
    }
  }
  return out;
};
const NOTE_ART = {
  ari: `<svg viewBox="0 0 260 150">
    <circle cx="214" cy="34" r="22" fill="#fff3cf" opacity=".6"/>
    ${[[40, 120, 1], [80, 128, 0.8], [120, 124, 1.1], [170, 130, 0.9], [215, 122, 1]].map(([x, y, s]) => `<g class="kv-n-sway" style="animation-delay:${-x / 90}s"><path d="M${x} ${y} q4 -28 0 -44" stroke="#2f9e6a" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="${x}" cy="${y - 48 * s}" r="${8 * s}" fill="#b98bff" stroke="${INK}" stroke-width="2"/><circle cx="${x - 7 * s}" cy="${y - 40 * s}" r="${6 * s}" fill="#d0b0ff" stroke="${INK}" stroke-width="2"/><circle cx="${x + 7 * s}" cy="${y - 40 * s}" r="${6 * s}" fill="#d0b0ff" stroke="${INK}" stroke-width="2"/></g>`).join('')}
    <g class="kv-n-fly">${bee(74, 44, 1.35)}</g>
    <g class="kv-n-fly" style="animation-delay:-1.7s;animation-duration:4.2s">${bee(196, 74, 0.8, 12)}</g>
  </svg>`,
  petek: `<svg viewBox="0 0 260 150">
    ${combField(44, 30, 6, 4, ['#ffcd3c', '#f0a000', '#ffcd3c', '#fff6d8', '#f0a000', '#ffcd3c', '#fff6d8', '#ffcd3c'])}
    <g class="kv-n-drip"><path d="M100 96 q6 16 0 24 q-6 -8 0 -24z" fill="#f0a000" stroke="${INK}" stroke-width="2"/></g>
    <g class="kv-n-drip" style="animation-delay:-1.3s"><path d="M168 96 q6 16 0 24 q-6 -8 0 -24z" fill="#f0a000" stroke="${INK}" stroke-width="2"/></g>
    <g class="kv-n-fly">${bee(26, 112, 1)}</g>
  </svg>`,
  kovan: `<svg viewBox="0 0 260 150">
    <path d="M0 132 h260 v18 H0z" fill="#2f9e6a"/>
    <circle cx="36" cy="30" r="18" fill="#ffe27a" stroke="${INK}" stroke-width="2"/>
    ${[0, 1, 2].map((i) => `<g><rect x="${86 - i * 4}" y="${108 - i * 26}" width="${88 + i * 8}" height="24" rx="4" fill="${i % 2 ? '#fff6d8' : '#ffcd3c'}" stroke="${INK}" stroke-width="2.6"/><path d="M${92 - i * 4} ${120 - i * 26} h${76 + i * 8}" stroke="${INK}" stroke-width="1.6" opacity=".45"/></g>`).join('')}
    <path d="M74 56 h112 l-10 -14 H84z" fill="#c98b52" stroke="${INK}" stroke-width="2.6"/>
    <rect x="118" y="112" width="24" height="10" rx="3" fill="${INK}"/>
    <g class="kv-n-orbit" style="transform-origin:130px 84px">${bee(186, 84, 0.7)}</g>
    <g class="kv-n-orbit" style="transform-origin:130px 84px;animation-delay:-3s;animation-duration:7s">${bee(76, 84, 0.6, 180)}</g>
  </svg>`,
  kralice: `<svg viewBox="0 0 260 150">
    ${combField(52, 36, 5, 3, ['#fff6d8', '#ffe27a', '#fff6d8', '#ffe27a', '#fff6d8'])}
    <g>${bee(104, 84, 1.8)}</g>
    <g class="kv-n-bob">${bee(44, 48, 0.62, -18)}</g>
    <g class="kv-n-bob" style="animation-delay:-0.7s">${bee(192, 44, 0.62, 14)}</g>
    <g class="kv-n-bob" style="animation-delay:-1.4s">${bee(200, 108, 0.62, -8)}</g>
    <path d="M64 36 l9 -16 9 16 9 -11 2 18 h-40 l2 -18z" fill="#ffcd3c" stroke="${INK}" stroke-width="2.4"/>
  </svg>`,
  cicek: `<svg viewBox="0 0 260 150">
    <g class="kv-n-sway" style="transform-origin:130px 150px">
      <path d="M130 150 q-6 -46 0 -62" stroke="#2f9e6a" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M130 110 q-26 -8 -34 6 q22 10 34 -6z" fill="#2f9e6a" stroke="${INK}" stroke-width="2"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<ellipse cx="130" cy="60" rx="13" ry="30" fill="#ff9ec4" stroke="${INK}" stroke-width="2.2" transform="rotate(${i * 45} 130 60)"/>`).join('')}
      <circle cx="130" cy="60" r="17" fill="#ffcd3c" stroke="${INK}" stroke-width="2.4"/>
    </g>
    ${[[96, 44], [168, 40], [112, 24], [152, 70]].map(([x, y], i) => `<circle class="kv-n-pollen" style="animation-delay:${-i * 0.5}s" cx="${x}" cy="${y}" r="4.5" fill="#ffe27a" stroke="${INK}" stroke-width="1.6"/>`).join('')}
    <g class="kv-n-fly">${bee(60, 76, 1.1, 10)}</g>
  </svg>`,
  arici: `<svg viewBox="0 0 260 150">
    <path d="M0 136 h260 v14 H0z" fill="#2f9e6a"/>
    <rect x="150" y="56" width="70" height="80" rx="6" fill="#ffcd3c" stroke="${INK}" stroke-width="2.6"/>
    ${[0, 1, 2, 3].map((i) => `<path d="M${158 + i * 17} 62 v68" stroke="${INK}" stroke-width="2" opacity=".4"/>`).join('')}
    <path d="M62 136 l-6 -56 h48 l-6 56z" fill="#eaf6ff" stroke="${INK}" stroke-width="2.6"/>
    <path d="M56 80 q30 -14 54 0" fill="none" stroke="${INK}" stroke-width="2.6"/>
    <circle cx="83" cy="54" r="24" fill="#fff" stroke="${INK}" stroke-width="2.6"/>
    <path d="M59 54 h48" stroke="${INK}" stroke-width="2.2"/>
    <path d="M63 44 q20 -10 40 0" fill="none" stroke="${INK}" stroke-width="2.2"/>
    <ellipse cx="83" cy="60" rx="18" ry="12" fill="${INK}" opacity=".18"/>
    <path d="M55 26 q28 -18 56 0 l4 10 H51z" fill="#c98b52" stroke="${INK}" stroke-width="2.6"/>
    <path d="M110 92 q26 -6 40 -18" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g class="kv-n-smoke">${[[30, 86, 7], [22, 68, 9], [30, 48, 11]].map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#dfe8f2" opacity="${0.8 - i * 0.2}"/>`).join('')}</g>
    <path d="M24 136 l4 -42 h20 l4 42z" fill="#8c97a8" stroke="${INK}" stroke-width="2.6"/>
    <path d="M28 94 q10 -14 20 0z" fill="#c0cad6" stroke="${INK}" stroke-width="2.2"/>
    <g class="kv-n-fly" style="animation-duration:3s">${bee(196, 34, 0.7, 18)}</g>
  </svg>`,
  dans: `<svg viewBox="0 0 260 150">
    ${combField(40, 34, 6, 4, ['#fff6d8', '#ffe27a'])}
    <path class="kv-n-dash" d="M130 46 q-40 20 0 40 q40 20 0 40 q-40 -20 0 -40 q40 -20 0 -40" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="8 7" opacity=".75"/>
    <path d="M130 40 v-22 m0 0 l-7 8 m7 -8 l7 8" stroke="#ff5fa2" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <circle cx="214" cy="26" r="13" fill="#ffe27a" stroke="${INK}" stroke-width="2.2"/>
    <g class="kv-n-eight">${bee(118, 86, 0.95, -20)}</g>
  </svg>`,
  bal: `<svg viewBox="0 0 260 150">
    ${combField(176, 44, 2, 3, ['#ffcd3c', '#f0a000'])}
    <rect x="52" y="52" width="76" height="84" rx="12" fill="#fff6d8" stroke="${INK}" stroke-width="2.8"/>
    <path d="M56 92 q38 -14 68 0 v38 a8 8 0 0 1 -8 8 H64 a8 8 0 0 1 -8 -8z" fill="#f0a000"/>
    <rect x="46" y="38" width="88" height="18" rx="6" fill="#c98b52" stroke="${INK}" stroke-width="2.8"/>
    <path d="M90 38 v-22" stroke="${INK}" stroke-width="4"/>
    <g class="kv-n-dip">
      <path d="M150 22 v44" stroke="#c98b52" stroke-width="7" stroke-linecap="round"/>
      ${[0, 1, 2].map((i) => `<ellipse cx="150" cy="${70 + i * 11}" rx="${13 - i * 2}" ry="5.5" fill="#ffcd3c" stroke="${INK}" stroke-width="2"/>`).join('')}
      <path class="kv-n-drip" d="M150 100 q5 14 0 20 q-5 -6 0 -20z" fill="#f0a000" stroke="${INK}" stroke-width="2"/>
    </g>
    <g class="kv-n-fly" style="animation-duration:3.6s">${bee(214, 118, 0.7, -10)}</g>
  </svg>`,
};

export function noteSheet(li, after) {
  const n = NOTES[li % NOTES.length];
  openSheet(html`
    <div class="kv-note">
      <div class="kv-note-art">${raw(NOTE_ART[n.a])}</div>
      <small>Arıcılık Notu</small>
      <h2>${n.t}</h2>
      <p>${n.d}</p>
    </div>
    <button class="btn btn-main btn-big" data-act="ok">${icon('arrow')}Devam</button>`, {
    cls: 'sheet-note',
    actions: { ok: (close) => close() },
    onClose: () => after(),
  });
}
