// Oyun listesi: ana ekran kartları, temalar, müzikler

export const GROUPS = [
  ['dukkan', 'Dükkan Açtık'],
  ['lab', 'Biyo Lab'],
  ['kelime', 'Kelime Oyunları'],
  ['fizik', 'Kır ve Fizik'],
  ['eski', 'Eski Tip'],
];

export const GAMES = [
  { id: 'doner', group: 'dukkan', title: 'Dönerci Sinem', tag: 'Kes, sar, yetiştir', music: 'doner', card: '#ff7a3d', load: () => import('./games/doner.js') },
  { id: 'kafe', group: 'dukkan', title: 'Kafe Sinemiko', tag: 'Çizgisine kadar dök', music: 'kafe', card: '#c98b52', load: () => import('./games/kafe.js') },
  { id: 'dondurma', group: 'dukkan', title: 'Maraşlı Sinem', tag: 'Dondurmayı diz, müşteriyi kandır', music: 'dondurma', card: '#ff5f8f', load: () => import('./games/dondurma.js') },
  { id: 'taki', group: 'dukkan', title: 'Takı Atölyesi', tag: 'Boncuk boncuk bulmaca', music: 'taki', card: '#7a3f8f', load: () => import('./games/taki.js') },
  { id: 'fetih', group: 'lab', title: 'Beden Fethi', tag: 'Bil, organları fethet', music: 'lab', card: '#0fa3a3', load: () => import('./games/fetih.js') },
  { id: 'gen', group: 'lab', title: 'Gen Makası', tag: 'Mutasyonu kes, düzelt', music: 'lab', card: '#2a4fd6', load: () => import('./games/gen.js') },
  { id: 'nano', group: 'lab', title: 'Nano Yolculuk', tag: 'Damarların içinde uç', music: 'nano', card: '#d6324f', load: () => import('./games/nano.js') },
  { id: 'antikor', group: 'lab', title: 'Antikor Atışı', tag: 'Ger, fırlat, yık', music: 'antikor', card: '#8ccf3e', load: () => import('./games/antikor.js') },
  { id: 'petri', group: 'lab', title: 'Petri Kabı', tag: 'Atomdan canlıya büyüt', music: 'petri', card: '#7fd6d0', load: () => import('./games/petri.js') },
  { id: 'kovan', group: 'kelime', title: 'Harf Kovanı', tag: 'Petekten kelime çıkar', music: 'hive', card: '#ffb31a', load: () => import('./games/kovan.js') },
  { id: 'bulmaca', group: 'kelime', title: 'Biyo Bulmaca', tag: 'Laboratuvar defteri', music: 'bulmaca', card: '#f4ecd2', dark: true, load: () => import('./games/bulmaca.js') },
  { id: 'koyun', group: 'fizik', title: 'Bee Koyun', tag: 'Sürüyü ağıla götür', music: 'koyun', card: '#7cc95a', load: () => import('./games/koyun.js') },
  { id: 'ciz', group: 'fizik', title: 'Çiz Geç', tag: 'Çizdiğin düşer, top yuvarlanır', music: 'bulmaca', card: '#2f4a3c', load: () => import('./games/ciz.js') },
  { id: 'atari', group: 'eski', title: 'Atari Salonu', tag: 'Üç kartuş, sonsuz rekor', music: 'retro', card: '#2b1a4f', load: () => import('./games/atari.js') },
  { id: 'kahve', group: 'eski', title: 'Kahvehane', tag: 'Furkan\'a karşı tavla ve pişti', music: 'kahve', card: '#7a4a2a', load: () => import('./games/kahve.js') },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
