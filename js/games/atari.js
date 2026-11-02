// Atari Salonu: üç kartuş, tek dolap. Tarama çizgileri, kalın pikseller, chiptune sesler.
// DNA Yılanı: eşleşen bazı ye. Hücre Kırıcı: tuğlaları kır. Virüs İstilası: bölünen virüsleri vur.

import { Life, html, toHTML, fitCanvas, clamp, rand, randInt, pick } from '../core/dom.js';
import { sfx, buzz, tone, hiss } from '../core/audio.js';
import { makeFx, label, shake } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast, icon } from '../core/ui.js';

const PAL = { bg: '#120a2a', ink: '#2a1636', green: '#5bff9f', cyan: '#4fe8ff', pink: '#ff5fa2', yellow: '#ffd94f', red: '#ff5468', purple: '#b58aff', white: '#f4f0ff' };
const COMP = { A: 'T', T: 'A', G: 'C', C: 'G' };
const BASES = ['A', 'T', 'G', 'C'];
const BASE_C = { A: PAL.green, T: PAL.red, G: PAL.yellow, C: PAL.cyan };

const CARTS = [
  { id: 'yilan', name: 'DNA Yılanı', tag: 'Eşleşen bazı ye, kuyruğun uzasın', c: PAL.green },
  { id: 'kirici', name: 'Hücre Kırıcı', tag: 'Zarları kır, hücreyi çöz', c: PAL.cyan },
  { id: 'virus', name: 'Virüs İstilası', tag: 'Bölünen virüsleri temizle', c: PAL.pink },
];

const beep = (f, dur = 0.06, vol = 0.07, type = 'square') => tone({ type, f, dur, vol, attack: 0.002 });
const sweep = (f, f2, dur = 0.18) => tone({ type: 'square', f, f2, dur, vol: 0.07, attack: 0.002 });

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ best: {}, plays: 0, stars: [] });
  const f = api.frame({ onBack: () => api.exit() });
  let local = null;
  let st = null;
  const end = () => {
    if (local) local.dispose();
    local = null;
    st = null;
  };

  function menu() {
    end();
    f.onBack = () => api.exit();
    f.setTitle(api.game.title);
    menuScreen(f.main, api.game, {
      art: `<svg class="art" viewBox="0 0 200 150"><rect x="14" y="10" width="172" height="112" rx="10" fill="#2a1636"/><rect x="26" y="20" width="148" height="80" rx="5" fill="#120a2a"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${34 + (i % 5) * 28}" y="${30 + Math.floor(i / 5) * 22}" width="18" height="12" rx="2" fill="${['#5bff9f', '#4fe8ff', '#ff5fa2', '#ffd94f'][i % 4]}"/>`).join('')}<rect x="78" y="86" width="44" height="7" rx="3" fill="#f4f0ff"/><circle class="a-ball" cx="100" cy="74" r="5" fill="#f4f0ff"/><rect x="60" y="122" width="80" height="16" rx="5" fill="#3a2d5c"/><rect x="30" y="104" width="24" height="9" rx="3" fill="#ff5468"/></svg>`,
      sub: 'Üç kartuş, tek dolap. Jeton bitmez, rekor senin.',
      stats: CARTS.map((c) => [c.name, data.best[c.id] || 0]),
      how: [
        'DNA Yılanı: ekranda parmağını kaydır, yılan o yöne döner. Üstte yazan bazın eşini ye.',
        'Hücre Kırıcı: parmağını sağa sola sürükle, paleti oynat. Hiç can vermeden bitirmeye çalış.',
        'Virüs İstilası: parmağınla gemiyi kaydır, ateş kendiliğinden. Büyük virüs vurulunca ikiye bölünür.',
        'Her kartuşun kendi rekoru var, rekorlar cihazda kalır.',
      ],
      buttons: CARTS.map((c) => ({ label: `${c.name}  ·  ${data.best[c.id] || 0}`, main: false, icon: 'play', act: () => play(c.id) })),
    });
    f.main.querySelectorAll('.menu-btns .btn').forEach((b, i) => {
      if (CARTS[i]) {
        b.style.background = CARTS[i].c;
        b.style.color = '#1a0f33';
      }
    });
  }

  function play(cart) {
    end();
    local = new Life();
    const my = local;
    const fx = makeFx({ font: '"Press Start 2P", monospace' });
    const game = { cart, score: 0, lives: 3, over: false, paused: false, wave: 1, sub: '', t: 0 };
    st = game;
    const info = CARTS.find((c) => c.id === cart);
    f.setTitle(info.name);
    f.main.innerHTML = toHTML(html`
      <div class="at">
        <div class="at-cab">
          <div class="at-screen">
            <canvas class="at-cv"></canvas>
            <div class="at-scan"></div>
            <div class="at-glare"></div>
          </div>
        </div>
        <div class="at-hud">
          <span>SKOR <b data-score>0</b></span>
          <span data-mid></span>
          <span>REKOR <b data-best>${data.best[cart] || 0}</b></span>
        </div>
      </div>`);
    const wrap = f.main.querySelector('.at');
    const cv = wrap.querySelector('.at-cv');
    const scoreEl = wrap.querySelector('[data-score]');
    const midEl = wrap.querySelector('[data-mid]');
    const bestEl = wrap.querySelector('[data-best]');
    const stage = fitCanvas(cv, my, null, 1.5);

    const setScore = (n) => {
      game.score = Math.max(0, Math.round(n));
      scoreEl.textContent = game.score;
      if (game.score > (data.best[cart] || 0)) {
        data.best[cart] = game.score;
        bestEl.textContent = game.score;
        api.touch();
      }
    };
    const setMid = (s) => { midEl.innerHTML = toHTML(s); };

    function finish(title, sub) {
      if (game.over) return;
      game.over = true;
      data.plays++;
      api.touch();
      const coins = 3 + Math.floor(game.score / 120);
      api.finish({ coins });
      const best = data.best[cart] || 0;
      my.timeout(() => {
        resultSheet({
          won: game.score >= best && game.score > 0,
          title,
          sub,
          coins,
          stats: [['Skor', game.score], ['Rekor', best], ['Dalga', game.wave]],
          buttons: [
            { label: 'Yeniden', main: true, icon: 'replay', act: () => play(cart) },
            ...CARTS.filter((c) => c.id !== cart).map((c) => ({ label: c.name, icon: 'play', act: () => play(c.id) })),
            { label: 'Dolaba Dön', icon: 'list', act: () => menu() },
          ],
        });
      }, 700);
    }

    f.onBack = () => {
      if (game.over) { menu(); return; }
      game.paused = true;
      pauseSheet({
        onResume: () => { game.paused = false; },
        onRestart: () => play(cart),
        onQuit: () => menu(),
      });
    };

    // Kalın piksel ızgarası: oyunlar sanal çözünürlükte çalışır
    const VW = 160;
    let VH = 200;
    let px = 1;
    let ox = 0;
    let oy = 0;
    const fit = () => {
      const { W, H } = stage;
      VH = Math.round(VW * clamp(H / W, 0.7, 1.9));
      px = Math.min(W / VW, H / VH);
      ox = (W - VW * px) / 2;
      oy = (H - VH * px) / 2;
    };
    const R = (g, x, y, w, h, c) => {
      g.fillStyle = c;
      g.fillRect(ox + Math.round(x) * px, oy + Math.round(y) * px, Math.max(px, Math.round(w) * px), Math.max(px, Math.round(h) * px));
    };
    const TXT = (g, x, y, s, c, size = 7) => {
      g.save();
      g.fillStyle = c;
      g.font = `400 ${size * px}px "Press Start 2P", monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s, ox + x * px, oy + y * px);
      g.restore();
    };
    const toV = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left - ox) / px, y: (e.clientY - r.top - oy) / px };
    };

    /* ================= DNA YILANI ================= */
    function snake() {
      const CELL = 8;
      const cols = Math.floor(VW / CELL);
      const rows = Math.floor((VH - 24) / CELL);
      const s = {
        body: [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }],
        dir: { x: 1, y: 0 }, next: { x: 1, y: 0 }, step: 0, speed: 6.5,
        want: pick(BASES), items: [], grow: 0, dead: false,
      };
      const freeCell = () => {
        let p;
        let guard = 0;
        do {
          p = { x: randInt(0, cols - 1), y: randInt(0, rows - 1) };
          guard++;
        } while (guard < 80 && (s.body.some((b) => b.x === p.x && b.y === p.y) || s.items.some((i) => i.x === p.x && i.y === p.y)));
        return p;
      };
      const spawn = () => {
        s.items = [];
        const right = COMP[s.want];
        s.items.push({ ...freeCell(), b: right, ok: true });
        for (const b of BASES) if (b !== right) s.items.push({ ...freeCell(), b, ok: false });
      };
      spawn();
      setMid(html`Ye: <b data-want>${COMP[s.want]}</b>`);
      const wantEl = () => midEl.querySelector('[data-want]');

      let p0 = null;
      my.on(cv, 'pointerdown', (e) => { p0 = toV(e); });
      my.on(cv, 'pointermove', (e) => {
        if (!p0) return;
        const p = toV(e);
        const dx = p.x - p0.x;
        const dy = p.y - p0.y;
        if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
        const nd = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
        if (nd.x !== -s.dir.x || nd.y !== -s.dir.y) s.next = nd;
        p0 = p;
      });
      my.on(window, 'pointerup', () => { p0 = null; });

      const tick = () => {
        s.dir = s.next;
        const h = s.body[0];
        const n = { x: h.x + s.dir.x, y: h.y + s.dir.y };
        if (n.x < 0 || n.y < 0 || n.x >= cols || n.y >= rows || s.body.some((b) => b.x === n.x && b.y === n.y)) {
          s.dead = true;
          sfx.explode8 ? sfx.explode8() : sfx.boom();
          buzz(70);
          shake(wrap, 10);
          finish('Yılan Düğümlendi', `${game.score} puanla bitti. Eşini doğru seçmek kolay değil.`);
          return;
        }
        s.body.unshift(n);
        const it = s.items.find((i) => i.x === n.x && i.y === n.y);
        if (it) {
          if (it.ok) {
            s.grow += 2;
            setScore(game.score + 10 + s.body.length);
            s.speed = Math.min(15, s.speed + 0.25);
            s.want = pick(BASES);
            wantEl().textContent = COMP[s.want];
            spawn();
            beep(880, 0.05);
            beep(1320, 0.05);
            buzz(10);
            fx.burst(ox + (n.x + 0.5) * CELL * px, oy + (n.y + 0.5) * CELL * px, { n: 8, colors: [BASE_C[it.b], '#fff'], power: 160 });
          } else {
            setScore(game.score - 5);
            s.items = s.items.filter((q) => q !== it);
            beep(180, 0.12, 0.08, 'sawtooth');
            buzz(30);
            if (s.body.length > 4) s.body.pop();
          }
        }
        if (s.grow > 0) s.grow--; else s.body.pop();
      };

      return (dt, t) => {
        const { g } = stage;
        if (!game.paused && !s.dead) {
          s.step += dt * s.speed;
          while (s.step >= 1) { s.step -= 1; tick(); }
        }
        R(g, 0, 0, VW, VH, PAL.bg);
        // Çerçeve
        for (let x = 0; x < cols; x++) R(g, x * CELL, rows * CELL + 2, CELL - 1, 2, '#2a1f55');
        s.items.forEach((i) => {
          R(g, i.x * CELL + 1, i.y * CELL + 1, CELL - 2, CELL - 2, BASE_C[i.b]);
          TXT(g, i.x * CELL + CELL / 2, i.y * CELL + CELL / 2 + 0.5, i.b, '#120a2a', 5);
        });
        s.body.forEach((b, k) => {
          const c = k === 0 ? PAL.white : k % 2 ? PAL.green : PAL.cyan;
          R(g, b.x * CELL + 1, b.y * CELL + 1, CELL - 2, CELL - 2, c);
          if (k === 0) {
            R(g, b.x * CELL + 2 + (s.dir.x > 0 ? 3 : 0), b.y * CELL + 3, 2, 2, PAL.ink);
            R(g, b.x * CELL + 2 + (s.dir.x < 0 ? 0 : 3), b.y * CELL + 3, 2, 2, PAL.ink);
          }
        });
        TXT(g, VW / 2, VH - 10, `EŞİ: ${COMP[s.want]}`, PAL.yellow, 7);
        fx.draw(g, dt);
      };
    }

    /* ================= HÜCRE KIRICI ================= */
    function breaker() {
      const s = { px: VW / 2, pw: 34, bx: VW / 2, by: VH - 40, vx: 42, vy: -62, bricks: [], wave: 1, drops: [], wide: 0, stuck: true };
      const build = (w) => {
        s.bricks = [];
        const cols = 9;
        const rows = Math.min(6, 3 + Math.floor(w / 2));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (w > 2 && (r + c) % 7 === 3) continue;
            s.bricks.push({ x: 6 + c * 17, y: 24 + r * 9, w: 15, h: 7, hp: r < 1 && w > 1 ? 2 : 1, c: [PAL.pink, PAL.purple, PAL.cyan, PAL.green, PAL.yellow, PAL.red][r % 6] });
          }
        }
      };
      build(1);
      setMid(html`CAN <b data-l>3</b>`);
      const lifeEl = () => midEl.querySelector('[data-l]');

      const movePad = (e) => {
        const p = toV(e);
        s.px = clamp(p.x, s.pw / 2, VW - s.pw / 2);
        if (s.stuck) s.bx = s.px;
      };
      my.on(cv, 'pointerdown', (e) => {
        movePad(e);
        if (s.stuck) {
          s.stuck = false;
          s.vx = rand(-30, 30);
          s.vy = -66;
          beep(660, 0.05);
        }
      });
      my.on(cv, 'pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') movePad(e); });

      return (dt) => {
        const { g } = stage;
        const pw = s.pw + (s.wide > 0 ? 18 : 0);
        if (!game.paused && !game.over) {
          if (s.wide > 0) s.wide -= dt;
          if (s.stuck) {
            s.bx = s.px;
            s.by = VH - 40;
          } else {
            const steps = 3;
            for (let k = 0; k < steps; k++) {
              s.bx += (s.vx * dt) / steps;
              s.by += (s.vy * dt) / steps;
              if (s.bx < 3) { s.bx = 3; s.vx = Math.abs(s.vx); beep(500, 0.03); }
              if (s.bx > VW - 3) { s.bx = VW - 3; s.vx = -Math.abs(s.vx); beep(500, 0.03); }
              if (s.by < 16) { s.by = 16; s.vy = Math.abs(s.vy); beep(500, 0.03); }
              // Palet
              if (s.by > VH - 36 && s.by < VH - 28 && Math.abs(s.bx - s.px) < pw / 2 + 2 && s.vy > 0) {
                s.vy = -Math.abs(s.vy);
                s.vx = clamp((s.bx - s.px) * 3.4, -78, 78);
                beep(760, 0.04);
                buzz(6);
              }
              for (let i = 0; i < s.bricks.length; i++) {
                const b = s.bricks[i];
                if (s.bx > b.x - 2 && s.bx < b.x + b.w + 2 && s.by > b.y - 2 && s.by < b.y + b.h + 2) {
                  const fromSide = s.bx < b.x || s.bx > b.x + b.w;
                  if (fromSide) s.vx = -s.vx; else s.vy = -s.vy;
                  b.hp--;
                  setScore(game.score + 12);
                  beep(300 + b.hp * 220, 0.04);
                  buzz(6);
                  if (b.hp <= 0) {
                    s.bricks.splice(i, 1);
                    fx.burst(ox + (b.x + b.w / 2) * px, oy + (b.y + b.h / 2) * px, { n: 7, colors: [b.c, '#fff'], power: 170, shape: 'square' });
                    if (Math.random() < 0.12) s.drops.push({ x: b.x + b.w / 2, y: b.y, kind: Math.random() < 0.5 ? 'wide' : 'life' });
                  }
                  break;
                }
              }
            }
            if (s.by > VH - 6) {
              game.lives--;
              lifeEl().textContent = Math.max(0, game.lives);
              sfx.fail();
              buzz(60);
              shake(wrap, 8);
              if (game.lives <= 0) { finish('Hücre Dağıldı', `${game.score} puan. Palet biraz daha erken yerinde olmalı.`); return; }
              s.stuck = true;
            }
            if (!s.bricks.length) {
              s.wave++;
              game.wave = s.wave;
              setScore(game.score + 120);
              build(s.wave);
              s.stuck = true;
              sfx.fanfare();
              toast(`${s.wave}. dalga`);
            }
          }
          for (let i = s.drops.length - 1; i >= 0; i--) {
            const d = s.drops[i];
            d.y += 34 * dt;
            if (d.y > VH - 34 && Math.abs(d.x - s.px) < pw / 2 + 4) {
              if (d.kind === 'wide') s.wide = 9; else { game.lives++; lifeEl().textContent = game.lives; }
              sfx.coin();
              s.drops.splice(i, 1);
            } else if (d.y > VH) s.drops.splice(i, 1);
          }
        }
        R(g, 0, 0, VW, VH, PAL.bg);
        for (let x = 0; x < VW; x += 8) R(g, x, 14, 4, 1, '#2a1f55');
        s.bricks.forEach((b) => {
          R(g, b.x, b.y, b.w, b.h, b.c);
          R(g, b.x, b.y, b.w, 2, 'rgba(255,255,255,.35)');
          if (b.hp > 1) R(g, b.x + b.w / 2 - 1, b.y + 2, 2, 3, '#120a2a');
        });
        s.drops.forEach((d) => R(g, d.x - 2, d.y, 5, 5, d.kind === 'wide' ? PAL.cyan : PAL.pink));
        R(g, s.px - pw / 2, VH - 32, pw, 5, PAL.white);
        R(g, s.px - pw / 2, VH - 32, pw, 2, PAL.cyan);
        R(g, s.bx - 2, s.by - 2, 4, 4, PAL.yellow);
        if (s.stuck) TXT(g, VW / 2, VH - 52, 'DOKUN', PAL.white, 7);
        fx.draw(g, dt);
      };
    }

    /* ================= VİRÜS İSTİLASI ================= */
    function invaders() {
      const s = { x: VW / 2, shots: [], foes: [], cool: 0, wave: 0, hitFlash: 0 };
      const spawnWave = () => {
        s.wave++;
        game.wave = s.wave;
        const n = 2 + Math.min(5, s.wave);
        for (let k = 0; k < n; k++) {
          s.foes.push({ x: rand(14, VW - 14), y: rand(18, 44), vx: rand(-16, 16) * (1 + s.wave * 0.08), vy: rand(5, 11), size: 2, hp: 2 });
        }
        if (s.wave > 1) toast(`${s.wave}. dalga`);
      };
      spawnWave();
      setMid(html`CAN <b data-l>3</b>`);
      const lifeEl = () => midEl.querySelector('[data-l]');
      const move = (e) => { s.x = clamp(toV(e).x, 8, VW - 8); };
      my.on(cv, 'pointerdown', move);
      my.on(cv, 'pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') move(e); });

      const split = (fo) => {
        if (fo.size <= 1) return;
        for (const d of [-1, 1]) s.foes.push({ x: fo.x, y: fo.y, vx: d * (18 + s.wave * 2), vy: fo.vy, size: fo.size - 1, hp: 1 });
      };

      return (dt, t) => {
        const { g } = stage;
        if (!game.paused && !game.over) {
          s.cool -= dt;
          if (s.cool <= 0) {
            s.cool = 0.28;
            s.shots.push({ x: s.x, y: VH - 24 });
            sfx.blaster ? sfx.blaster() : beep(1200, 0.04);
          }
          for (let i = s.shots.length - 1; i >= 0; i--) {
            const sh = s.shots[i];
            sh.y -= 150 * dt;
            if (sh.y < 10) { s.shots.splice(i, 1); continue; }
            for (let k = s.foes.length - 1; k >= 0; k--) {
              const fo = s.foes[k];
              const r = fo.size * 4 + 2;
              if (Math.abs(fo.x - sh.x) < r && Math.abs(fo.y - sh.y) < r) {
                s.shots.splice(i, 1);
                fo.hp--;
                beep(420, 0.03);
                if (fo.hp <= 0) {
                  s.foes.splice(k, 1);
                  setScore(game.score + fo.size * 18);
                  split(fo);
                  fx.burst(ox + fo.x * px, oy + fo.y * px, { n: 10, colors: [PAL.purple, PAL.white], power: 200 });
                  sfx.explode8 ? sfx.explode8() : beep(140, 0.12, 0.08, 'sawtooth');
                  buzz(10);
                }
                break;
              }
            }
          }
          for (const fo of s.foes) {
            fo.x += fo.vx * dt;
            fo.y += fo.vy * dt * 0.35;
            if (fo.x < 8 || fo.x > VW - 8) fo.vx = -fo.vx;
            if (fo.y > VH - 34) {
              fo.y = 18;
              game.lives--;
              s.hitFlash = 0.4;
              lifeEl().textContent = Math.max(0, game.lives);
              sfx.fail();
              buzz(60);
              shake(wrap, 9);
              if (game.lives <= 0) { finish('Hücre Düştü', `${s.wave}. dalgada ${game.score} puan.`); return; }
            }
          }
          if (!s.foes.length) {
            setScore(game.score + 60);
            spawnWave();
          }
          if (s.hitFlash > 0) s.hitFlash -= dt;
        }
        R(g, 0, 0, VW, VH, s.hitFlash > 0 ? '#3a0f24' : PAL.bg);
        for (let k = 0; k < 16; k++) {
          const sx = (k * 37) % VW;
          const sy = ((k * 53 + t / 24) % VH);
          R(g, sx, sy, 1, 1, '#3a2d6c');
        }
        s.foes.forEach((fo) => {
          const r = fo.size * 4;
          R(g, fo.x - r, fo.y - r, r * 2, r * 2, PAL.purple);
          R(g, fo.x - r - 2, fo.y - 1, 2, 2, PAL.purple);
          R(g, fo.x + r, fo.y - 1, 2, 2, PAL.purple);
          R(g, fo.x - 1, fo.y - r - 2, 2, 2, PAL.purple);
          R(g, fo.x - 1, fo.y + r, 2, 2, PAL.purple);
          R(g, fo.x - r + 1, fo.y - 1, 2, 2, PAL.ink);
          R(g, fo.x + r - 3, fo.y - 1, 2, 2, PAL.ink);
        });
        s.shots.forEach((sh) => R(g, sh.x - 1, sh.y - 3, 2, 5, PAL.yellow));
        R(g, s.x - 6, VH - 22, 12, 4, PAL.cyan);
        R(g, s.x - 2, VH - 26, 4, 4, PAL.white);
        R(g, s.x - 8, VH - 18, 16, 3, PAL.cyan);
        fx.draw(g, dt);
      };
    }

    const step = cart === 'yilan' ? snake() : cart === 'kirici' ? breaker() : invaders();
    my.raf((dt, t) => {
      stage.begin();
      fit();
      game.t = t;
      step(game.paused ? 0 : Math.min(dt, 0.05), t);
      return undefined;
    });
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return st; },
    data,
  };
}
