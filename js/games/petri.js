// Petri Kabı: kabın kenarından hücre fırlat. Aynı seviyedekiler değince birleşir, bir üst basamağa çıkar.
// Yerçekimi kabın ortasına çeker; kalabalık kenara taşarsa kültür bozulur. Atomdan canlıya kadar büyüt.

import { Life, fitCanvas, drag, rand, html } from '../core/dom.js';
import { sfx, buzz } from '../core/audio.js';
import { makeFx, inked, label, heartPath, shake } from '../core/fx.js';
import { menuScreen, resultSheet, askSheet, toast } from '../core/ui.js';
import { ART } from '../art.js';

const LADDER = [
  { name: 'Atom', c: '#8fd3ff', info: 'Maddenin yapıtaşı.' },
  { name: 'Molekül', c: '#a6e35a', info: 'Atomlar bağ kurunca oluşur.' },
  { name: 'Aminoasit', c: '#ffcd3c', info: 'Proteinlerin alfabesi. İnsanda 20 çeşidi kullanılır.' },
  { name: 'Protein', c: '#ff9f5a', info: 'Hücrenin işçileri: enzimler de birer proteindir.' },
  { name: 'Organel', c: '#ff7f7f', info: 'Hücrenin küçük organları, örneğin mitokondri.' },
  { name: 'Hücre', c: '#ff7fbf', info: 'Canlılığın en küçük birimi.' },
  { name: 'Doku', c: '#c58bff', info: 'Aynı işi yapan hücreler birlikte doku olur.' },
  { name: 'Organ', c: '#8c8bff', info: 'Dokular birleşip kalp gibi organları kurar.' },
  { name: 'Sistem', c: '#4fc3e8', info: 'Organlar birlikte sistem olur: dolaşım, sinir...' },
  { name: 'Canlı', c: '#2ed6a0', info: 'Sistemler birleşince bir organizma ortaya çıkar.' },
  { name: 'Sinem', c: '#ff5fa2', info: 'Evrimin vardığı son nokta. Bundan ötesi yok.' },
];
const radiusOf = (L, R) => R * (0.066 + L * 0.031);
const MAX_SPAWN = 4;

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ best: 0, top: 0, seen: [0], saved: null, games: 0 });
  const f = api.frame({ onBack: () => api.exit() });
  let run = null;

  function menu() {
    f.onBack = () => api.exit();
    f.setTitle(api.game.title);
    run = null;
    menuScreen(f.main, api.game, {
      art: ART.petri,
      sub: 'Kabın kenarından hücre fırlat, aynıları birleştir. Atomdan canlıya kadar büyüt.',
      stats: [['Rekor', data.best], ['En Üst Basamak', LADDER[data.top].name]],
      how: [
        'Parmağını ekranda gezdir: fırlatıcı kabın kenarında döner. Bırakınca ortaya doğru atış yapar.',
        'Aynı basamaktaki iki parça değince birleşir ve bir üste çıkar.',
        'Yerçekimi kabın merkezine çeker. Parçalar kenardan taşarsa kültür bozulur, oyun biter.',
        'Enzim küçük parçaları eritir, Santrifüj kabı sıkıştırır. Puan topladıkça kazanırsın.',
      ],
      buttons: [
        ...(data.saved ? [{ label: 'Kaldığın Yerden', main: true, icon: 'play', act: () => start(data.saved) }] : []),
        { label: 'Yeni Kültür', main: !data.saved, icon: data.saved ? 'replay' : 'play', act: async () => {
          if (data.saved) {
            const y = await askSheet({ title: 'Yeni Kültür', text: 'Yarım kalan kabın silinecek.', yes: 'Başla' });
            if (!y) return;
          }
          data.saved = null;
          api.touch();
          start(null);
        } },
      ],
      extra: html`<div class="petri-ladder">${LADDER.map((l, i) => html`<span class="pl ${i <= data.top ? 'on' : ''}" style="--c:${i <= data.top ? l.c : '#ffffff33'}"><i></i>${i <= data.top ? l.name : '?'}</span>`)}</div>`,
    });
  }

  function start(saved) {
    f.main.innerHTML = '<div class="petri-play"><canvas class="petri-cv"></canvas><div class="petri-hud"><span class="pt-score"><small>Puan</small><b data-score>0</b></span><span class="pt-next"><small>Sıradaki</small><b data-next></b></span></div><div class="petri-tools"><button class="btn btn-small" data-tool="enzim"></button><button class="btn btn-small" data-tool="spin"></button></div></div>';
    const wrap = f.main.firstElementChild;
    const cv = wrap.querySelector('canvas');
    const local = new Life();
    life.add(() => local.dispose());
    const s = fitCanvas(cv, local);
    const fx = makeFx({ font: '"Nunito", sans-serif' });
    const st = {
      cells: [], score: saved ? saved.score : 0, next: saved ? saved.next : rand(0, 1) < 0.5 ? 0 : 1, next2: saved ? saved.next2 : 0,
      angle: Math.PI / 2, aiming: false, cool: 0, danger: 0, over: false, enzim: saved ? saved.enzim : 1, spin: saved ? saved.spin : 1, milestone: saved ? saved.milestone : 1200, shake: 0, flash: 0,
    };
    run = st;
    const geo = () => {
      const R = Math.min(s.W * 0.47, s.H * 0.4);
      return { cx: s.W / 2, cy: s.H * 0.47, R };
    };
    const updateHud = () => {
      wrap.querySelector('[data-score]').textContent = st.score;
      wrap.querySelector('[data-next]').textContent = LADDER[st.next].name;
      wrap.querySelector('[data-tool="enzim"]').innerHTML = `Enzim ×${st.enzim}`;
      wrap.querySelector('[data-tool="spin"]').innerHTML = `Santrifüj ×${st.spin}`;
      wrap.querySelector('[data-tool="enzim"]').disabled = !st.enzim;
      wrap.querySelector('[data-tool="spin"]').disabled = !st.spin;
    };
    const rollNext = () => {
      st.next = st.next2;
      const maxL = Math.min(MAX_SPAWN - 1, Math.max(1, data.top - 2, ...st.cells.map((c) => c.L - 2)));
      st.next2 = Math.floor(Math.pow(Math.random(), 1.5) * (maxL + 1));
    };
    if (saved) {
      const { R } = geo();
      st.cells = saved.cells.map((c) => ({ x: c.u * R, y: c.v * R, vx: 0, vy: 0, L: c.L, wob: 0, age: 9, id: Math.random() }));
    } else rollNext();
    updateHud();

    const snapshot = () => {
      if (st.over) return;
      const { R } = geo();
      data.saved = { score: st.score, next: st.next, next2: st.next2, enzim: st.enzim, spin: st.spin, milestone: st.milestone, cells: st.cells.map((c) => ({ u: c.x / R, v: c.y / R, L: c.L })) };
      api.touch();
    };
    local.interval(snapshot, 4000);
    f.onBack = () => {
      snapshot();
      local.dispose();
      menu();
    };

    const shoot = () => {
      if (st.cool > 0 || st.over) return;
      const { R } = geo();
      const a = st.angle;
      const L = st.next;
      const r = radiusOf(L, R);
      const sp = R * 2.1;
      st.cells.push({ x: Math.cos(a) * (R + r * 0.2), y: Math.sin(a) * (R + r * 0.2), vx: -Math.cos(a) * sp, vy: -Math.sin(a) * sp, L, wob: 1, age: 0, id: Math.random() });
      st.cool = 0.42;
      rollNext();
      updateHud();
      sfx.whoosh();
      buzz(10);
    };

    drag(cv, local, {
      down: (p) => {
        const { cx, cy } = geo();
        st.aiming = true;
        st.angle = Math.atan2(p.y - cy, p.x - cx);
      },
      move: (p) => {
        const { cx, cy } = geo();
        st.angle = Math.atan2(p.y - cy, p.x - cx);
      },
      up: () => {
        if (st.aiming) shoot();
        st.aiming = false;
      },
    });
    local.on(wrap, 'click', (e) => {
      const b = e.target.closest('[data-tool]');
      if (!b || st.over) return;
      if (b.dataset.tool === 'enzim' && st.enzim > 0) {
        st.enzim--;
        const { cx, cy } = geo();
        const small = st.cells.filter((c) => c.L <= 1);
        for (const c of small) fx.burst(cx + c.x, cy + c.y, { n: 8, colors: [LADDER[c.L].c, '#fff'], power: 200 });
        st.cells = st.cells.filter((c) => c.L > 1);
        // Küçük kalmadıysa en küçükler erir
        if (!small.length && st.cells.length) {
          const min = Math.min(...st.cells.map((c) => c.L));
          st.cells = st.cells.filter((c) => c.L !== min);
        }
        sfx.splat();
        buzz(30);
      } else if (b.dataset.tool === 'spin' && st.spin > 0) {
        st.spin--;
        st.spinT = 1.4;
        sfx.whoosh();
        buzz(40);
      }
      updateHud();
    });

    const merge = (a, b) => {
      const { cx, cy, R } = geo();
      a.dead = true;
      b.dead = true;
      const L = a.L;
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      const pts = (L + 2) * (L + 2) * 10;
      st.score += pts;
      fx.burst(cx + x, cy + y, { n: 10 + L * 2, colors: [LADDER[L].c, LADDER[Math.min(10, L + 1)].c, '#fff'], power: 200 + L * 25, gravity: 0, shape: L > 6 ? 'heart' : 'circle' });
      fx.text(cx + x, cy + y - 18, `+${pts}`, '#fff', 15 + L);
      sfx.merge(L);
      buzz(10 + L * 2);
      if (L >= LADDER.length - 1) {
        // En üst basamak iki kere birleşince büyük kutlama, ikisi de kaybolur
        st.score += 2000;
        fx.text(cx + x, cy + y - 50, 'İki Sinem! +2000', '#ff5fa2', 26);
        sfx.fanfare();
      } else {
        const n = L + 1;
        st.cells.push({ x, y, vx: (a.vx + b.vx) * 0.25, vy: (a.vy + b.vy) * 0.25, L: n, wob: 1.2, age: 1, id: Math.random() });
        if (n > data.top) {
          data.top = n;
          api.touch();
          st.flash = 1;
          showDiscovery(n);
        }
        // Çevredekiler itilir
        const rr = radiusOf(n, R) * 2.4;
        for (const c of st.cells) {
          const dx = c.x - x;
          const dy = c.y - y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < rr) {
            c.vx += (dx / d) * R * 0.5 * (1 - d / rr);
            c.vy += (dy / d) * R * 0.5 * (1 - d / rr);
          }
        }
      }
      if (st.score >= st.milestone) {
        st.milestone += 2600;
        if (Math.random() < 0.5) st.enzim++;
        else st.spin++;
        toast('Yeni yardımcı kazandın!');
        sfx.good();
      }
      if (st.score > data.best) {
        data.best = st.score;
        api.touch();
      }
      updateHud();
    };

    const showDiscovery = (n) => {
      const d = LADDER[n];
      const box = document.createElement('div');
      box.className = 'petri-disc';
      box.innerHTML = `<b style="color:${d.c}">${d.name}</b><span>${d.info}</span>`;
      wrap.append(box);
      box.animate([{ transform: 'translate(-50%, -16px) scale(.8)', opacity: 0 }, { transform: 'translate(-50%, 0) scale(1)', opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      sfx.star(1);
      local.timeout(() => {
        box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => box.remove(), () => box.remove());
      }, 2800);
    };

    const gameOver = () => {
      st.over = true;
      data.saved = null;
      data.games++;
      const coins = Math.round(st.score / 40);
      api.finish({ coins });
      shake(wrap, 10);
      sfx.boom();
      const { cx, cy } = geo();
      st.cells.forEach((c, i) => local.timeout(() => {
        c.dead = true;
        fx.burst(cx + c.x, cy + c.y, { n: 6, colors: [LADDER[c.L].c, '#fff'], power: 220, gravity: 300 });
        sfx.pop(1 + c.L * 0.2);
      }, i * 40));
      local.timeout(() => {
        const topNow = LADDER[data.top].name;
        resultSheet({
          won: st.score >= data.best && st.score > 0,
          title: 'Kültür Taştı',
          sub: `Şimdiye kadar çıktığın en üst basamak: ${topNow}.`,
          coins,
          stats: [['Puan', st.score], ['Rekor', data.best]],
          buttons: [
            { label: 'Yeniden', main: true, icon: 'replay', act: () => { local.dispose(); start(null); } },
            { label: 'Menü', icon: 'home', act: () => { local.dispose(); menu(); } },
          ],
        });
      }, st.cells.length * 40 + 700);
    };

    const step = (dt) => {
      const { R } = geo();
      const G = R * 2.6;
      st.cool = Math.max(0, st.cool - dt);
      if (st.spinT > 0) st.spinT -= dt;
      const damp = Math.max(0, 1 - 2.2 * dt);
      const spinning = st.spinT > 0;
      for (const c of st.cells) {
        const d = Math.hypot(c.x, c.y) || 1;
        const g = spinning ? G * 3 : G;
        c.vx -= (c.x / d) * g * dt;
        c.vy -= (c.y / d) * g * dt;
        if (spinning) {
          c.vx += (-c.y / d) * R * 2.2 * dt;
          c.vy += (c.x / d) * R * 2.2 * dt;
        }
        c.vx *= damp;
        c.vy *= damp;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.age += dt;
        c.wob = Math.max(0, c.wob - dt * 2.4);
      }
      // Çarpışma: iki tur konum düzeltme
      const n = st.cells.length;
      for (let it = 0; it < 3; it++) {
        for (let i = 0; i < n; i++) {
          const a = st.cells[i];
          if (a.dead) continue;
          const ra = radiusOf(a.L, R);
          for (let j = i + 1; j < n; j++) {
            const b = st.cells[j];
            if (b.dead) continue;
            const rb = radiusOf(b.L, R);
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const min = ra + rb;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min) continue;
            const d = Math.sqrt(d2) || 0.01;
            if (a.L === b.L && !a.dead && !b.dead) {
              merge(a, b);
              break;
            }
            const nx = dx / d;
            const ny = dy / d;
            const over = min - d;
            const ma = ra * ra;
            const mb = rb * rb;
            const ka = mb / (ma + mb);
            const kb = ma / (ma + mb);
            a.x -= nx * over * ka;
            a.y -= ny * over * ka;
            b.x += nx * over * kb;
            b.y += ny * over * kb;
            const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rel < 0) {
              const imp = rel * 0.5;
              a.vx += nx * imp * ka * 2;
              a.vy += ny * imp * ka * 2;
              b.vx -= nx * imp * kb * 2;
              b.vy -= ny * imp * kb * 2;
              if (rel < -R * 0.7) {
                a.wob = Math.max(a.wob, 0.6);
                b.wob = Math.max(b.wob, 0.6);
                if (rel < -R * 1.2) sfx.squish();
              }
            }
          }
        }
      }
      st.cells = st.cells.filter((c) => !c.dead);
      // Taşma: yerleşmiş parça kenarı aşıyorsa sayaç işler
      let over = false;
      for (const c of st.cells) {
        const r = radiusOf(c.L, R);
        if (c.age > 1.6 && Math.hypot(c.x, c.y) + r > R * 1.0) {
          over = true;
          break;
        }
      }
      st.danger = over ? st.danger + dt : Math.max(0, st.danger - dt * 2);
      if (st.danger > 3) gameOver();
    };

    const drawCell = (g, c, x, y, r, t) => {
      const L = c.L;
      const d = LADDER[L];
      const w = 1 + Math.sin(c.wob * 9) * 0.12 * c.wob;
      g.save();
      g.translate(x, y);
      g.scale(w, 2 - w);
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      inked(g, d.c, Math.max(2, r * 0.09));
      g.beginPath();
      g.ellipse(-r * 0.32, -r * 0.42, r * 0.26, r * 0.16, -0.6, 0, Math.PI * 2);
      g.fillStyle = '#ffffff88';
      g.fill();
      // Basamağa göre iç süs
      g.strokeStyle = '#2a163655';
      g.lineWidth = Math.max(1.5, r * 0.06);
      if (L === 0) {
        g.beginPath();
        g.ellipse(0, 0, r * 0.72, r * 0.28, t / 900, 0, Math.PI * 2);
        g.stroke();
      } else if (L === 5) {
        g.beginPath();
        g.arc(r * 0.28, r * 0.24, r * 0.3, 0, Math.PI * 2);
        g.fillStyle = '#c0408f88';
        g.fill();
      } else if (L === 3 || L === 4) {
        g.beginPath();
        for (let k = 0; k <= 8; k++) {
          const px = -r * 0.65 + (k / 8) * r * 1.3;
          const py = Math.sin(k * 1.4) * r * 0.2 + r * 0.42;
          if (k) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.stroke();
      } else if (L === 10) {
        heartPath(g, 0, r * 0.62, r * 0.28);
        g.fillStyle = '#fff';
        g.fill();
      }
      // Yüz
      const blink = Math.sin(t / 1400 + c.id * 40) > 0.97;
      const ex = r * 0.3;
      const ey = -r * 0.1;
      const er = Math.max(1.6, r * 0.11);
      g.fillStyle = '#2a1636';
      if (blink) {
        g.fillRect(-ex - er, ey, er * 2, 1.8);
        g.fillRect(ex - er, ey, er * 2, 1.8);
      } else {
        g.beginPath();
        g.arc(-ex, ey, er, 0, Math.PI * 2);
        g.arc(ex, ey, er, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.arc(0, r * 0.14, r * 0.18, 0.2, Math.PI - 0.2);
      g.lineWidth = Math.max(1.5, r * 0.07);
      g.strokeStyle = '#2a1636';
      g.lineCap = 'round';
      g.stroke();
      if (L === 10) {
        // Yuvarlak gözlük
        g.beginPath();
        g.arc(-ex, ey, er * 2.2, 0, Math.PI * 2);
        g.moveTo(ex + er * 2.2, ey);
        g.arc(ex, ey, er * 2.2, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
      if (r > 26) label(g, x, y + r * 0.62, d.name, { size: Math.min(13, r * 0.26), font: '"Nunito", sans-serif', sw: 0.28 });
    };

    local.raf((dt, t) => {
      if (!s.W) return true;
      const { cx, cy, R } = geo();
      if (!st.over && dt > 0) step(dt);
      const g = s.g;
      s.begin();
      // Kap
      const glass = g.createRadialGradient(cx, cy - R * 0.2, R * 0.1, cx, cy, R);
      glass.addColorStop(0, '#f6fffb');
      glass.addColorStop(1, '#c9f0e6');
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      inked(g, glass, 5);
      g.beginPath();
      g.arc(cx, cy, R - 8, 0, Math.PI * 2);
      g.lineWidth = 2;
      g.strokeStyle = '#ffffffcc';
      g.stroke();
      // Tehlike halkası
      if (st.danger > 0) {
        g.beginPath();
        g.arc(cx, cy, R + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, st.danger / 3));
        g.lineWidth = 9;
        g.strokeStyle = `rgba(255,60,80,${0.6 + 0.4 * Math.sin(t / 70)})`;
        g.stroke();
      }
      // Nişan
      const a = st.angle;
      if (!st.over) {
        const r = radiusOf(st.next, R);
        const lx = cx + Math.cos(a) * (R + 16);
        const ly = cy + Math.sin(a) * (R + 16);
        if (st.aiming) {
          g.setLineDash([6, 8]);
          g.beginPath();
          g.moveTo(lx, ly);
          g.lineTo(cx, cy);
          g.lineWidth = 3;
          g.strokeStyle = '#2a163666';
          g.stroke();
          g.setLineDash([]);
        }
        const alpha = st.cool > 0 ? 0.35 : 1;
        g.globalAlpha = alpha;
        drawCell(g, { L: st.next, wob: 0, id: 0.3 }, lx, ly, Math.min(r, 26), t);
        g.globalAlpha = 1;
      }
      const sorted = st.cells.slice().sort((p, q) => q.L - p.L);
      for (const c of sorted) drawCell(g, c, cx + c.x, cy + c.y, radiusOf(c.L, R), t);
      if (st.flash > 0) {
        st.flash -= dt * 2;
        g.fillStyle = `rgba(255,255,255,${Math.max(0, st.flash) * 0.5})`;
        g.fillRect(0, 0, s.W, s.H);
      }
      fx.draw(g, dt);
      return true;
    });
    st.shoot = shoot;
    st.geo = geo;
  }

  menu();
  return {
    unmount() {
      if (run && !run.over && data && run.cells) {
        const R = run.geo ? run.geo().R : 1;
        data.saved = { score: run.score, next: run.next, next2: run.next2, enzim: run.enzim, spin: run.spin, milestone: run.milestone, cells: run.cells.map((c) => ({ u: c.x / R, v: c.y / R, L: c.L })) };
        api.touch();
      }
      life.dispose();
      f.dispose();
    },
    get run() { return run; },
  };
}

