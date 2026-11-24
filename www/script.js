(() => {
  'use strict';

  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const startOverlay = document.getElementById('startOverlay');
  const levelOverlay = document.getElementById('levelOverlay');
  const overOverlay = document.getElementById('overOverlay');
  const winOverlay = document.getElementById('winOverlay');
  const heartsEl = document.getElementById('hearts');
  const coinCountEl = document.getElementById('coinCount');
  const coinTotalEl = document.getElementById('coinTotal');
  const jumpChip = document.getElementById('jumpChip');
  const timerEl = document.getElementById('timer');
  const progressFill = document.getElementById('progressFill');
  const toastEl = document.getElementById('toast');
  const levelBadge = document.getElementById('levelBadge');
  const moneyCountEl = document.getElementById('moneyCount');
  const shopOverlay = document.getElementById('shopOverlay');
  const shopGrid = document.getElementById('shopGrid');
  const shopMoney = document.getElementById('shopMoney');
  const closeShopBtn = document.getElementById('closeShopBtn');
  const bossUI = document.getElementById('bossUI');
  const bossNameEl = document.getElementById('bossName');
  const bossFill = document.getElementById('bossFill');
  const levelIntro = document.getElementById('levelIntro');
  const introScreen = document.getElementById('introScreen');
  const menuShopBtn = document.getElementById('menuShopBtn');
  const levelShopBtn = document.getElementById('levelShopBtn');
  const overShopBtn = document.getElementById('overShopBtn');
  const shopOutfitName = document.getElementById('shopOutfitName');
  const authScreen = document.getElementById('authScreen');
  const authUser = document.getElementById('authUser');
  const authPass = document.getElementById('authPass');
  const authError = document.getElementById('authError');
  const authForm = document.getElementById('authForm');
  const authReturn = document.getElementById('authReturn');
  const authWelcome = document.getElementById('authWelcome');
  const authHint = document.getElementById('authHint');

  // ---------- Constants ----------
  const GROUND_Y = 800;
  const WORLD_H = 960;
  const GRAV = 0.62;
  const JUMP_V = -14.2;
  const ACCEL = 0.85;
  const FRICTION = 0.82;
  const MAX_V = 6.6;
  const PW = 50, PH = 70; // slightly bigger hero

  // ---------- Money & wardrobe ----------
  const OUTFITS = [
    { id: 'purple', name: 'Purple', color: '#6d6de6', price: 0 },
    { id: 'green', name: 'Green', color: '#22c55e', price: 40 },
    { id: 'red', name: 'Red', color: '#ef4444', price: 50 },
    { id: 'blue', name: 'Blue', color: '#3b82f6', price: 50 },
    { id: 'cyan', name: 'Cyan', color: '#06b6d4', price: 70 },
    { id: 'pink', name: 'Pink', color: '#ec4899', price: 70 },
    { id: 'orange', name: 'Orange', color: '#f97316', price: 80 },
    { id: 'yellow', name: 'Yellow', color: '#eab308', price: 90 },
    { id: 'lime', name: 'Lime', color: '#84cc16', price: 100 },
    { id: 'teal', name: 'Teal', color: '#14b8a6', price: 110 },
    { id: 'gold', name: 'Gold', color: '#d4af37', price: 150 },
    { id: 'white', name: 'Pearl', color: '#e2e8f0', price: 180 },
  ];
  function lsGet(key, fallback) {
    try { const v = window.localStorage.getItem(key); return v === null ? fallback : v; }
    catch (e) { return fallback; }
  }
  const ACC_KEY = 'skybound_accounts_v1';
  const CUR_KEY = 'skybound_current_v1';
  let accounts = {};
  try { accounts = JSON.parse(lsGet(ACC_KEY, '{}')) || {}; } catch (e) { accounts = {}; }
  let currentUser = lsGet(CUR_KEY, null);
  if (currentUser && !accounts[currentUser]) currentUser = null;
  let money = 0, outfit = 'purple', owned = ['purple'];
  let resumeData = null;
  let isDev = false;
  let saveTimer = null, introTimer = null;
  function hashPass(p) {
    let h = 5381;
    for (let i = 0; i < p.length; i++) h = ((h << 5) + h + p.charCodeAt(i)) | 0;
    return 'h' + Math.abs(h).toString(36);
  }
  // Developer account, seeded on every device: unlimited coins.
  if (!accounts.v11) {
    accounts.v11 = {
      hash: hashPass('qazxsw1'), dev: true,
      save: {
        v: 1, levelIndex: 0, score: 0, elapsed: 0, hearts: 3,
        money: 999999999, dev: true,
        owned: ['purple', 'green', 'red', 'blue', 'cyan', 'pink', 'orange', 'yellow', 'lime', 'teal', 'gold', 'white'],
        outfit: 'purple', totalStars: 0,
        respawn: { x: 120, y: 730 },
        coinsGot: [], enemiesAlive: [], checkpointsActive: [],
        bossHp: 0, bossActive: false, bossDefeated: false,
      },
    };
  } else {
    accounts.v11.hash = hashPass('qazxsw1');
    accounts.v11.dev = true;
    accounts.v11.save.dev = true;
    accounts.v11.save.money = 999999999;
  }
  function captureProgress() {
    return {
      v: 1, levelIndex, score, elapsed, hearts, money, dev: isDev,
      owned: owned.slice(), outfit, totalStars,
      respawn: { x: respawn.x, y: respawn.y },
      coinsGot: level ? level.coins.map(c => c.got) : [],
      enemiesAlive: level ? level.enemies.map(e => e.alive) : [],
      checkpointsActive: level ? level.checkpoints.map(c => c.active) : [],
      bossHp: level ? level.boss.hp : 0,
      bossActive, bossDefeated,
    };
  }
  function writeSave() {
    if (!currentUser || !accounts[currentUser]) return;
    accounts[currentUser].save = captureProgress();
    try {
      window.localStorage.setItem(ACC_KEY, JSON.stringify(accounts));
      window.localStorage.setItem(CUR_KEY, currentUser);
    } catch (e) { /* storage is optional */ }
  }
  function saveProgress() {
    if (!currentUser) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeSave, 200);
  }
  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    writeSave();
  }
  function applySave(d) {
    d = d || {};
    isDev = !!d.dev;
    money = d.money || 0;
    outfit = d.outfit || 'purple';
    owned = Array.isArray(d.owned) && d.owned.length ? d.owned.slice() : ['purple'];
    if (!owned.includes(outfit)) outfit = 'purple';
    totalStars = d.totalStars || 0;
    resumeData = (typeof d.levelIndex === 'number') ? d : null;
    document.documentElement.style.setProperty('--heroSuit', (OUTFITS.find(o => o.id === outfit) || OUTFITS[0]).color);
    if (level) { updateHud(); renderShop(); }
  }
  function showAuth() {
    authError.textContent = '';
    authForm.classList.add('hidden');
    authReturn.classList.add('hidden');
    authWelcome.classList.add('hidden');
    if (currentUser && accounts[currentUser]) {
      authWelcome.textContent = `Welcome back, ${currentUser}!`;
      authWelcome.classList.remove('hidden');
      authReturn.classList.remove('hidden');
      authHint.textContent = 'Your progress is safe on this phone.';
    } else {
      authForm.classList.remove('hidden');
      authHint.textContent = 'Create a pilot account to save your progress forever.';
    }
    authScreen.classList.remove('hidden');
  }
  function enterGame() {
    authScreen.classList.add('hidden');
    if (!accounts[currentUser]) accounts[currentUser] = { hash: '', save: null };
    saveProgress();
    state = 'menu';
    toast(`Welcome, ${currentUser}!`);
  }
  document.getElementById('authCreateBtn').addEventListener('click', () => {
    const u = authUser.value.trim(), p = authPass.value;
    if (u.length < 4) { authError.textContent = 'Username needs 4+ characters.'; return; }
    if (p.length < 4) { authError.textContent = 'Password needs 4+ characters.'; return; }
    if (accounts[u]) { authError.textContent = 'That username is taken.'; return; }
    accounts[u] = { hash: hashPass(p), save: null };
    currentUser = u;
    applySave(null);
    enterGame();
  });
  document.getElementById('authLoginBtn').addEventListener('click', () => {
    const u = authUser.value.trim(), p = authPass.value;
    if (!accounts[u] || accounts[u].hash !== hashPass(p)) {
      authError.textContent = 'Wrong username or password.';
      return;
    }
    currentUser = u;
    applySave(accounts[u].save);
    enterGame();
  });
  document.getElementById('authContinueBtn').addEventListener('click', () => {
    applySave(accounts[currentUser].save);
    enterGame();
  });
  document.getElementById('authSwitchBtn').addEventListener('click', () => {
    flushSave();
    currentUser = null;
    try { window.localStorage.removeItem(CUR_KEY); } catch (e) { /* ignore */ }
    showAuth();
  });
  window.addEventListener('beforeunload', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  function applyOutfit(id) {
    const o = OUTFITS.find(x => x.id === id) || OUTFITS[0];
    outfit = o.id;
    document.documentElement.style.setProperty('--heroSuit', o.color);
    saveProgress();
    renderShop();
    updateHud();
  }
  function renderShop() {
    shopMoney.textContent = isDev ? '∞' : money;
    shopOutfitName.textContent = (OUTFITS.find(x => x.id === outfit) || OUTFITS[0]).name;
    shopGrid.innerHTML = '';
    for (const o of OUTFITS) {
      const isOwned = owned.includes(o.id);
      const isEquipped = outfit === o.id;
      const b = document.createElement('button');
      b.className = 'shop-item' + (isEquipped ? ' equipped' : '') + (isOwned ? ' owned' : '');
      b.innerHTML =
        `<span class="shop-swatch" style="background:${o.color}"></span>` +
        `<span class="shop-name">${o.name}</span>` +
        `<span class="shop-price">${isEquipped ? 'EQUIPPED' : isOwned ? 'OWNED' : '💰 ' + o.price}</span>`;
      b.addEventListener('click', () => {
        if (isEquipped) { toast('Already wearing it!'); return; }
        if (!isOwned) {
          if (!isDev && money < o.price) { toast('Not enough coins!'); return; }
          if (!isDev) money -= o.price;
          owned.push(o.id);
          toast(`${o.name} suit unlocked!`);
        }
        applyOutfit(o.id);
      });
      shopGrid.appendChild(b);
    }
  }
  function openShop() {
    if (state === 'shop' || state === 'intro') return;
    returnState = state;
    state = 'shop';
    renderShop();
    shopOverlay.classList.remove('hidden');
  }
  menuShopBtn.addEventListener('click', openShop);
  levelShopBtn.addEventListener('click', openShop);
  overShopBtn.addEventListener('click', openShop);
  closeShopBtn.addEventListener('click', () => {
    shopOverlay.classList.add('hidden');
    state = returnState;
    saveProgress();
  });

  // Cinematic intro -> main menu
  function finishIntro() {
    if (state !== 'intro') return;
    introScreen.classList.add('out');
    setTimeout(() => {
      introScreen.classList.add('hidden');
      showAuth();
    }, 750);
  }
  introScreen.addEventListener('pointerdown', finishIntro);

  // ---------- Worlds ----------
  const LEVELS = [
    {
      name: 'Sky Meadow', tag: 'Where the journey begins', boss: 'Cloud Crusher',
      sky: ['#a9dcff', '#dff1ff', '#fff6e6'],
      hills: ['#dbe9fa', '#cfe7d6', '#b9ddb4'],
      soil: ['#d8a978', '#b98256'], grass: '#79c98a', lip: '#5aa86f',
      platTop: ['#8ad79a', '#66bb7d'], platDirt: ['#a9714b', '#cf9264'],
      orb: '#fff4c9', glow: ['rgba(255,247,200,.95)', 'rgba(255,236,170,.4)', 'rgba(255,236,170,0)'],
      cloudRGB: '255,255,255', cloudAlpha: 0.78,
      ambient: 'petal', ambientRGB: '255,255,255', ambientAlpha: 0.75,
      detail: 'sun', accent: '#5b5bd6', enemy: '#8a7ae0', star: '#ffd34d',
    },
    {
      name: 'Sunset Dunes', tag: 'Golden hour, endless sand', boss: 'Sand Scorpion',
      sky: ['#ff8f7a', '#ffc49b', '#ffe9c2'],
      hills: ['#f6b58f', '#eaa17c', '#d98768'],
      soil: ['#e3b078', '#bf8757'], grass: '#a6b26d', lip: '#859450',
      platTop: ['#e8c48d', '#d3a86e'], platDirt: ['#b07a4f', '#cf9a68'],
      orb: '#ffd27a', glow: ['rgba(255,210,120,.95)', 'rgba(255,150,80,.42)', 'rgba(255,130,60,0)'],
      cloudRGB: '255,232,210', cloudAlpha: 0.62,
      ambient: 'sand', ambientRGB: '255,224,170', ambientAlpha: 0.65,
      detail: 'sunLow', accent: '#c25736', enemy: '#b5543c', star: '#ffcf5c',
    },
    {
      name: 'Frostpeak', tag: 'Quiet peaks and cold air', boss: 'Frost Warden',
      sky: ['#7fb8e8', '#c9e6f8', '#eef8ff'],
      hills: ['#d3e6f4', '#bcd9ec', '#a3c8e2'],
      soil: ['#dceaf4', '#a9c8dd'], grass: '#ffffff', lip: '#bcd8e8',
      platTop: ['#e8f7ff', '#b9dcee'], platDirt: ['#9dbfd6', '#bcd8e8'],
      orb: '#ffffff', glow: ['rgba(240,250,255,.95)', 'rgba(190,225,255,.45)', 'rgba(190,225,255,0)'],
      cloudRGB: '255,255,255', cloudAlpha: 0.85,
      ambient: 'snow', ambientRGB: '255,255,255', ambientAlpha: 0.9,
      detail: 'aurora', auroraRGB: '140,240,210', accent: '#3b82c4', enemy: '#6a8fc4', star: '#a8e6ff',
    },
    {
      name: 'Neon City', tag: 'The city never sleeps', boss: 'Neon Sentinel',
      sky: ['#151832', '#272a56', '#453a72'],
      hills: ['#232748', '#2e3360', '#394074'],
      soil: ['#343a66', '#222642'], grass: '#7cf2ff', lip: '#4aa8c9',
      platTop: ['#7cf2ff', '#4fb8d8'], platDirt: ['#3a3f78', '#5056a0'],
      orb: '#e6ecff', glow: ['rgba(180,200,255,.85)', 'rgba(120,150,255,.35)', 'rgba(120,150,255,0)'],
      cloudRGB: '120,130,200', cloudAlpha: 0.3,
      ambient: 'rain', ambientRGB: '150,210,255', ambientAlpha: 0.45,
      detail: 'city', accent: '#7cf2ff', enemy: '#ff6bd6', star: '#7cf2ff',
    },
    {
      name: 'Ember Hollow', tag: 'Fire beneath the ash', boss: 'Ember Titan',
      sky: ['#2a1524', '#5a2333', '#b4452e'],
      hills: ['#47222e', '#5c2b33', '#74322f'],
      soil: ['#4a3232', '#2a1d20'], grass: '#ff7a3d', lip: '#b64024',
      platTop: ['#ff8f4d', '#c4512a'], platDirt: ['#3a2626', '#553131'],
      orb: '#ff9a5c', glow: ['rgba(255,130,60,.9)', 'rgba(255,80,30,.4)', 'rgba(255,60,20,0)'],
      cloudRGB: '90,40,50', cloudAlpha: 0.5,
      ambient: 'ember', ambientRGB: '255,150,60', ambientAlpha: 0.9,
      detail: 'lava', accent: '#ff7a3d', enemy: '#ff6b3d', star: '#ffb347',
    },
    {
      name: 'Ocean Depths', tag: 'Down where the light bends', boss: 'Abyss Leviathan',
      sky: ['#0b5f8c', '#158ca8', '#6ed0d4'],
      hills: ['#0f6f8c', '#15809a', '#1b96a8'],
      soil: ['#d9c08a', '#b79a68'], grass: '#ff9e8a', lip: '#d97b6a',
      platTop: ['#ffb3a0', '#e88475'], platDirt: ['#b08a63', '#cfae82'],
      orb: '#cfffff', glow: ['rgba(200,255,255,.8)', 'rgba(140,240,240,.35)', 'rgba(140,240,240,0)'],
      cloudRGB: '200,245,245', cloudAlpha: 0.22,
      ambient: 'bubble', ambientRGB: '210,255,255', ambientAlpha: 0.6,
      detail: 'rays', accent: '#00b3c8', enemy: '#ff8fa8', star: '#bfffff',
    },
  ];

  // ---------- Helpers ----------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const gradCache = {};
  function cachedGrad(key, make) {
    if (!gradCache[key]) gradCache[key] = make();
    return gradCache[key];
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function starPath(cx, cy, outer, inner, points, rot = -Math.PI / 2) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = rot + (i * Math.PI) / points;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  function heartSvg(filled) {
    return `<svg class="heart-icon${filled ? '' : ' empty'}" viewBox="0 0 32 29" aria-hidden="true">` +
      `<path class="body" d="M16 27C7 21 2 16 2 10 2 5 5 2 9 2c3 0 5 1.5 7 4 2-2.5 4-4 7-4 4 0 7 3 7 8 0 6-5 11-14 17z"/>` +
      `<path class="shine" d="M8 8c0-2 1.5-3.5 3.5-3.5 1 0 1.8.4 2.4 1.1-2.4.5-4.2 2.2-5 4.6C8.4 9.6 8 8.9 8 8z"/>` +
      `</svg>`;
  }
  function fmtTime(frames) {
    const s = Math.floor(frames / 60);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
  }

  // ---------- Level builder ----------
  function makeEnemy(type, x, x0, x1, rand) {
    const h = type === 'bat' ? 28 : type === 'slime' ? 42 : 34;
    const w = type === 'bat' ? 40 : type === 'slime' ? 40 : 36;
    const flyY = GROUND_Y - 150 - rand() * 55;
    return {
      type, x, w, h, x0, x1,
      y: type === 'bat' ? flyY : GROUND_Y - h,
      baseY: type === 'bat' ? flyY : GROUND_Y - h,
      dir: rand() < 0.5 ? 1 : -1,
      speed: type === 'bat' ? 1 + rand() * 0.6 : 0.5 + rand() * 0.6,
      phase: rand() * 6.28,
      alive: true,
    };
  }

  function buildLevel(idx) {
    const cfg = LEVELS[idx];
    const rand = mulberry32(90210 + idx * 7717);
    const chunks = 7 + idx;
    const startW = 480, chunkW = 480, endW = 540;
    const endX = startW + chunks * chunkW;
    const arenaX = endX + endW;
    const arenaW = 920;
    const worldW = arenaX + arenaW;

    const grounds = [{ x: 0, y: GROUND_Y, w: startW }];
    const platforms = [], coins = [], enemies = [], checkpoints = [];
    const addCoin = (x, y) => coins.push({ x, y, t: rand() * 6.28, got: false });
    const line = (x, y, n, gap = 50) => { for (let i = 0; i < n; i++) addCoin(x + i * gap, y); };
    const arc = (x, y, n, gap = 44, h = 16) => {
      for (let i = 0; i < n; i++) addCoin(x + i * gap, y - (n > 1 ? Math.sin((i / (n - 1)) * Math.PI) * h : 0));
    };

    for (let i = 0; i < chunks; i++) {
      const cx = startW + i * chunkW;
      grounds.push({ x: cx, y: GROUND_Y, w: 400 });
      const px = cx + 80 + rand() * 70;
      const py = GROUND_Y - 155 - rand() * 85;
      const pw = 135 + Math.floor(rand() * 35);
      const plat = { x: px, y: py, w: pw };
      if (i > 0 && i % 3 === 0) plat.move = { amp: 55 + rand() * 45, speed: 0.012 + rand() * 0.005, phase: rand() * 6.28 };
      platforms.push(plat);
      arc(px + 18, py - 36, 3, 44, 16);
      line(cx + 45, GROUND_Y - 62, 3, 52);
      if (i > 0) {
        const type = ['slime', 'bat', 'spike'][(i + idx) % 3];
        enemies.push(makeEnemy(type, cx + 230, cx + 110, cx + 380, rand));
      }
      if (idx >= 2 && i % 4 === 2) enemies.push(makeEnemy('bat', cx + 330, cx + 170, cx + 400, rand));
      if (idx >= 4 && i % 5 === 3) enemies.push(makeEnemy('slime', cx + 300, cx + 160, cx + 390, rand));
      if (i > 0 && i % 3 === 0) checkpoints.push({ x: cx + 40, spawnX: cx + 62, active: false });
    }

    // Final stretch, then the dark boss arena.
    grounds.push({ x: endX, y: GROUND_Y, w: endW });
    platforms.push({ x: endX + 120, y: GROUND_Y - 175, w: 170 });
    arc(endX + 140, GROUND_Y - 205, 4, 44, 20);
    line(endX + 300, GROUND_Y - 62, 3, 50);
    line(arenaX + 90, GROUND_Y - 62, 3, 48);

    grounds.push({ x: arenaX, y: GROUND_Y, w: arenaW });
    const hp = 5 + idx * 2;
    const boss = {
      name: cfg.boss, x: arenaX + 620, y: GROUND_Y - 112, w: 92, h: 112,
      hp, maxHp: hp, vy: 0, dir: -1, alive: true,
      flash: 0, attackTimer: 80, jumpTimer: 130,
    };

    platforms.forEach(p => { p.base = p.x; p.dx = 0; });
    return {
      cfg, worldW, grounds, platforms, coins, enemies, checkpoints, boss,
      arena: { x: arenaX, w: arenaW },
      solids: grounds.concat(platforms),
      goal: { x: arenaX + arenaW - 150, y: GROUND_Y },
    };
  }

  // ---------- State ----------
  const player = {
    x: 120, y: GROUND_Y - PH, w: PW, h: PH,
    vx: 0, vy: 0, ground: null, anim: 0, squash: 0, face: 1,
    coyote: 0, invuln: 0, jumps: 0,
  };
  let level = null;
  let levelIndex = 0;
  let respawn = { x: 120, y: GROUND_Y - PH };
  let hearts = 3, score = 0, totalStars = 0, elapsed = 0, tick = 0;
  let state = 'intro';
  let returnState = 'menu';
  let bossIntro = 0;
  let particles = [], ambient = [], bullets = [], bossShots = [];
  let bossActive = false, bossDefeated = false, defeatTimer = 0, fireCooldown = 0;
  const cam = { x: 0, y: 0 };
  const input = { left: false, right: false, jumpBuffer: 0, fire: false };

  let scale = 1, viewW = 640, viewH = 480, dpr = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    const cssW = Math.max(1, r.width), cssH = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = Math.max(0.42, Math.min(cssW / 640, 1.5));
    viewW = cssW / scale;
    viewH = cssH / scale;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // ---------- Sound ----------
  let audioCtx = null, muted = false;
  function initAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function beep(freq, dur, type = 'sine', vol = 0.07, slide = 0) {
    if (muted || !audioCtx) return;
    try {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      const now = audioCtx.currentTime;
      o.type = type;
      o.frequency.setValueAtTime(freq, now);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + dur);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(now); o.stop(now + dur);
    } catch (e) { /* sound is optional */ }
  }
  let noiseBuf = null;
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const len = Math.floor(audioCtx.sampleRate * 0.35);
    noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function noiseBurst(dur, type, freq, q, vol) {
    if (muted || !audioCtx) return;
    try {
      const src = audioCtx.createBufferSource();
      src.buffer = getNoise();
      const f = audioCtx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
      const g = audioCtx.createGain();
      const t = audioCtx.currentTime;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(audioCtx.destination);
      src.start(t); src.stop(t + dur);
    } catch (e) { /* sound is optional */ }
  }
  const sfxJump = () => beep(420, 0.16, 'sine', 0.07, 320);
  const sfxDoubleJump = () => { beep(560, 0.12, 'triangle', 0.06, 420); setTimeout(() => beep(820, 0.1, 'triangle', 0.04), 60); };
  const sfxLand = () => beep(180, 0.09, 'sine', 0.05, -60);
  const sfxCoin = () => { const b = 840 + levelIndex * 35; beep(b, 0.1, 'triangle', 0.06); setTimeout(() => beep(b * 1.5, 0.12, 'triangle', 0.05), 70); };
  const sfxCheck = () => { beep(520, 0.12, 'triangle', 0.06); setTimeout(() => beep(780, 0.18, 'triangle', 0.06), 100); };
  const sfxHurt = () => beep(300, 0.35, 'sawtooth', 0.06, -200);
  // Minecraft-style mob pop / squash
  const sfxStomp = () => {
    noiseBurst(0.13, 'lowpass', 850, 1, 0.16);
    beep(210, 0.09, 'square', 0.05, -90);
    setTimeout(() => beep(330, 0.07, 'triangle', 0.04), 55);
  };
  // Realistic-ish gunshot: sharp noise crack + low body thump
  const sfxShoot = () => {
    noiseBurst(0.085, 'bandpass', 1900, 0.7, 0.19);
    beep(95, 0.13, 'sine', 0.12, -45);
  };
  const sfxBossHit = () => beep(200, 0.1, 'square', 0.05, -110);
  const sfxBossDie = () => [330, 262, 196, 131].forEach((f, i) => setTimeout(() => beep(f, 0.28, 'sawtooth', 0.06), i * 130));
  const sfxWin = () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'triangle', 0.07), i * 120));
  // The classic "sad violin" losing tune
  function sfxGameOver() {
    if (muted || !audioCtx) return;
    const notes = [440, 415, 392, 349, 311, 262];
    notes.forEach((f, i) => setTimeout(() => {
      if (!audioCtx) return;
      try {
        const t = audioCtx.currentTime;
        const o = audioCtx.createOscillator();
        const lfo = audioCtx.createOscillator();
        const lg = audioCtx.createGain();
        const filt = audioCtx.createBiquadFilter();
        const g = audioCtx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.92, t + 0.36);
        lfo.frequency.value = 6.5;
        lg.gain.value = f * 0.014;
        lfo.connect(lg); lg.connect(o.frequency);
        filt.type = 'lowpass'; filt.frequency.value = 1500;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.075, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        o.connect(filt); filt.connect(g); g.connect(audioCtx.destination);
        o.start(t); lfo.start(t);
        o.stop(t + 0.44); lfo.stop(t + 0.44);
      } catch (e) { /* sound is optional */ }
    }, i * 260));
  }

  // Simple procedural soundtrack — one little motif per world.
  const MUSIC = [
    [523, 659, 784, 659, 587, 698, 880, 698],
    [587, 698, 880, 698, 659, 784, 988, 784],
    [659, 784, 988, 784, 587, 698, 880, 698],
    [440, 523, 659, 523, 494, 587, 740, 587],
    [392, 466, 587, 466, 440, 523, 659, 523],
    [494, 587, 740, 587, 523, 659, 784, 659],
  ];
  let musicTimer = null, musicStep = 0;
  function startMusic() {
    if (!audioCtx) return;
    if (musicTimer) clearInterval(musicTimer);
    const notes = MUSIC[levelIndex % MUSIC.length];
    musicStep = 0;
    musicTimer = setInterval(() => {
      if (!audioCtx || muted) return;
      const f = notes[musicStep % notes.length];
      beep(f, 0.16, 'triangle', 0.05);
      if (musicStep % 4 === 0) beep(f / 2, 0.3, 'sine', 0.035);
      musicStep++;
    }, 250);
  }

  // ---------- Particles ----------
  function burst(x, y, color, n = 10, spd = 4) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y, vx: (Math.random() - 0.5) * spd * 2,
        vy: (Math.random() - 0.9) * spd * 2,
        life: 28 + Math.random() * 22, max: 50,
        color, size: 2 + Math.random() * 3, g: 0.16,
      });
    }
    if (particles.length > 140) particles.splice(0, particles.length - 140);
  }
  function dust(x, y) {
    for (let i = 0; i < 7; i++) {
      particles.push({
        x, y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 2,
        life: 18 + Math.random() * 14, max: 32,
        color: '#ffffff', size: 3 + Math.random() * 4, g: 0.08,
      });
    }
  }
  function makeAmbient() {
    return Array.from({ length: 30 }, () => ({
      x: Math.random(), y: Math.random(),
      s: 0.5 + Math.random() * 1.1,
      v: 0.0015 + Math.random() * 0.003,
      ph: Math.random() * 6.28,
    }));
  }
  function updateAmbient() {
    const type = level.cfg.ambient;
    const dir = (type === 'ember' || type === 'bubble') ? -1 : 1;
    const fast = type === 'rain' ? 3.5 : 1;
    for (const a of ambient) {
      a.y += dir * a.v * fast;
      a.x += Math.sin(tick * 0.01 + a.ph) * 0.0007;
      if (a.y > 1.05) a.y = -0.05;
      if (a.y < -0.05) a.y = 1.05;
      if (a.x > 1.05) a.x = -0.05;
      if (a.x < -0.05) a.x = 1.05;
    }
  }

  // ---------- Flow ----------
  function hideOverlays() {
    startOverlay.classList.add('hidden');
    levelOverlay.classList.add('hidden');
    overOverlay.classList.add('hidden');
    winOverlay.classList.add('hidden');
  }
  const hudCache = {};
  function updateHud() {
    if (!level) return;
    if (hudCache.hearts !== hearts) {
      heartsEl.innerHTML = heartSvg(true).repeat(hearts) + heartSvg(false).repeat(3 - hearts);
      hudCache.hearts = hearts;
    }
    if (hudCache.score !== score) { coinCountEl.textContent = score; hudCache.score = score; }
    const total = level.coins.length;
    if (hudCache.total !== total) { coinTotalEl.textContent = total; hudCache.total = total; }
    const time = fmtTime(elapsed);
    if (hudCache.time !== time) { timerEl.textContent = time; hudCache.time = time; }
    const cash = isDev ? '∞' : money;
    if (hudCache.cash !== cash) { moneyCountEl.textContent = cash; hudCache.cash = cash; }
    if (hudCache.jumps !== player.jumps) {
      jumpChip.textContent = '⇧'.repeat(Math.max(0, 2 - player.jumps)) + '·'.repeat(Math.min(2, player.jumps));
      hudCache.jumps = player.jumps;
    }
    const prog = Math.round(clamp((player.x / level.goal.x) * 100, 0, 100) * 2) / 2;
    if (hudCache.prog !== prog) { progressFill.style.width = prog + '%'; hudCache.prog = prog; }
    if (bossActive && level.boss.alive) {
      const hp = Math.round(clamp((level.boss.hp / level.boss.maxHp) * 100, 0, 100));
      if (hudCache.bossHp !== hp) { bossFill.style.width = hp + '%'; hudCache.bossHp = hp; }
    }
  }
  function showLevelIntro() {
    levelIntro.innerHTML =
      `<small>WORLD ${levelIndex + 1} / ${LEVELS.length}</small>` +
      `<strong>${level.cfg.name}</strong><em>${level.cfg.tag}</em>`;
    levelIntro.classList.remove('show');
    void levelIntro.offsetWidth;
    levelIntro.classList.add('show');
  }
  function startGame() {
    const saved = resumeData;
    resumeData = null;
    if (saved && typeof saved.levelIndex === 'number') loadLevel(saved.levelIndex, saved);
    else { totalStars = 0; loadLevel(0); }
  }
  function loadLevel(i, saved) {
    initAudio();
    levelIndex = i;
    startMusic();
    level = buildLevel(i);
    levelBadge.textContent = `WORLD ${i + 1}/${LEVELS.length} · ${level.cfg.name}`;
    hideOverlays();
    bossUI.classList.add('hidden');
    showLevelIntro();
    respawn = { x: 120, y: GROUND_Y - PH };
    player.x = 120; player.y = GROUND_Y - PH;
    player.vx = player.vy = 0;
    player.ground = null; player.anim = 0; player.squash = 0;
    player.face = 1; player.coyote = 0; player.invuln = 0; player.jumps = 0;
    hearts = 3; score = 0; elapsed = 0; tick = 0;
    particles = []; ambient = makeAmbient(); bullets = []; bossShots = [];
    bossActive = false; bossDefeated = false; defeatTimer = 0; fireCooldown = 0; bossIntro = 0;
    input.left = input.right = input.fire = false; input.jumpBuffer = 0;

    if (saved) {
      score = saved.score || 0;
      elapsed = saved.elapsed || 0;
      hearts = typeof saved.hearts === 'number' && saved.hearts > 0 ? saved.hearts : 3;
      if (saved.respawn && typeof saved.respawn.x === 'number') {
        // Always sit the hero ON the ground, even if an older save had the old height.
        respawn = {
          x: clamp(saved.respawn.x, 0, level.worldW - PW),
          y: GROUND_Y - PH,
        };
        player.x = respawn.x; player.y = respawn.y;
      }
      if (Array.isArray(saved.coinsGot)) level.coins.forEach((c, n) => { c.got = !!saved.coinsGot[n]; });
      if (Array.isArray(saved.enemiesAlive)) level.enemies.forEach((e, n) => { e.alive = saved.enemiesAlive[n] !== false; });
      if (Array.isArray(saved.checkpointsActive)) level.checkpoints.forEach((c, n) => { c.active = !!saved.checkpointsActive[n]; });
      if (typeof saved.bossHp === 'number') level.boss.hp = clamp(saved.bossHp, 1, level.boss.maxHp);
      bossActive = !!saved.bossActive;
      bossDefeated = !!saved.bossDefeated;
      if (bossActive) {
        bossUI.classList.remove('hidden');
        bossNameEl.textContent = `${level.boss.name} · World ${i + 1}`;
        bossFill.style.width = clamp((level.boss.hp / level.boss.maxHp) * 100, 0, 100) + '%';
      }
    }

    cam.x = clamp(player.x - viewW * 0.35, 0, Math.max(0, level.worldW - viewW));
    cam.y = viewH >= WORLD_H ? (WORLD_H - viewH) / 2 : 0;
    state = 'playing';
    toast(saved ? `Continuing World ${i + 1}: ${level.cfg.name}` : `World ${i + 1}: ${level.cfg.name}`);
    updateHud();
    saveProgress();
  }
  function gameOver() {
    if (isDev) return;
    state = 'gameover';
    sfxGameOver();
    saveProgress();
    document.getElementById('overCoins').textContent = score;
    overOverlay.classList.remove('hidden');
  }
  function win() {
    if (state !== 'playing') return;
    state = 'win';
    money += 60;
    saveProgress();
    totalStars += score;
    burst(level.goal.x + 45, GROUND_Y - 60, level.cfg.star, 30, 6);
    sfxWin();
    if (levelIndex === LEVELS.length - 1) {
      document.getElementById('winTitle').textContent = 'All six worlds cleared!';
      document.getElementById('winText').textContent = 'Every boss defeated. Total coins:';
      document.getElementById('winCoins').textContent = totalStars;
      document.getElementById('winTime').textContent = fmtTime(elapsed);
      document.getElementById('againBtn').textContent = 'Play from World 1 →';
      winOverlay.classList.remove('hidden');
    } else {
      document.getElementById('levelCompleteTitle').textContent = `${level.cfg.name} complete!`;
      document.getElementById('levelStars').textContent = score;
      document.getElementById('levelTime').textContent = fmtTime(elapsed);
      levelOverlay.classList.remove('hidden');
    }
  }
  document.getElementById('playBtn').addEventListener('click', startGame);
  document.getElementById('nextBtn').addEventListener('click', () => loadLevel(levelIndex + 1));
  document.getElementById('retryBtn').addEventListener('click', () => loadLevel(levelIndex));
  document.getElementById('againBtn').addEventListener('click', startGame);

  // ---------- Input ----------
  function hold(el, key) {
    const down = e => {
      e.preventDefault();
      if (state === 'menu' || state === 'start') { startGame(); return; }
      input[key] = true;
      if (key === 'jump') input.jumpBuffer = 8;
      el.classList.add('pressed');
    };
    const up = e => { e.preventDefault(); input[key] = false; el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  hold(document.getElementById('leftBtn'), 'left');
  hold(document.getElementById('rightBtn'), 'right');
  hold(document.getElementById('jumpBtn'), 'jump');
  hold(document.getElementById('fireBtn'), 'fire');

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    const left = k === 'arrowleft' || k === 'a';
    const right = k === 'arrowright' || k === 'd';
    const jump = k === 'arrowup' || k === 'w' || k === ' ' || k === 'spacebar';
    const fire = k === 'f' || k === 'j' || k === 'k';
    if (left || right || jump || fire) e.preventDefault();
    if (left) input.left = true;
    if (right) input.right = true;
    if (fire) input.fire = true;
    if (jump && !e.repeat) {
      if (state === 'menu' || state === 'start') startGame();
      else input.jumpBuffer = 8;
    }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') input.left = false;
    if (k === 'arrowright' || k === 'd') input.right = false;
    if (k === 'f' || k === 'j' || k === 'k') input.fire = false;
  });

  // ---------- Boss logic ----------
  function updateBoss() {
    const b = level.boss;
    if (!bossActive || !b.alive) return;
    b.flash = Math.max(0, b.flash - 1);
    const dir = player.x < b.x ? -1 : 1;
    b.dir = dir;
    b.x += dir * (0.9 + levelIndex * 0.12);
    b.x = clamp(b.x, level.arena.x + 110, level.arena.x + level.arena.w - 150);
    if (--b.jumpTimer <= 0) { b.vy = -9.5; b.jumpTimer = Math.max(85, 150 - levelIndex * 8); }
    b.vy = Math.min(b.vy + 0.5, 12);
    b.y += b.vy;
    if (b.y > GROUND_Y - b.h) { b.y = GROUND_Y - b.h; b.vy = 0; }
    if (--b.attackTimer <= 0) {
      const dx = player.x - (b.x + b.w / 2), dy = player.y - (b.y + 40);
      const len = Math.hypot(dx, dy) || 1;
      const sp = 3 + levelIndex * 0.16;
      bossShots.push({
        x: b.x + b.w / 2, y: b.y + 45,
        vx: (dx / len) * sp, vy: (dy / len) * sp,
        life: 170, r: 8,
      });
      beep(150, 0.18, 'sawtooth', 0.05, -60);
      b.attackTimer = Math.max(55, 120 - levelIndex * 7);
    }
  }
  function hurtPlayer(fromX) {
    if (isDev || player.invuln > 0 || bossDefeated) return;
    hearts--;
    player.invuln = 100;
    player.vx = player.x < fromX ? -5.5 : 5.5;
    player.vy = -8;
    burst(player.x + player.w / 2, player.y + player.h / 2, '#ff6b81', 12, 4);
    sfxHurt();
    if (hearts <= 0) { gameOver(); return; }
    toast('Ouch! Watch out');
  }
  function damageBoss() {
    const b = level.boss;
    b.hp--;
    b.flash = 9;
    burst(b.x + b.w / 2, b.y + b.h / 2, level.cfg.star, 10, 4);
    sfxBossHit();
    if (b.hp <= 0) {
      b.alive = false;
      bossDefeated = true;
      money += 40;
      saveProgress();
      defeatTimer = 100;
      bossShots = [];
      bossUI.classList.add('hidden');
      burst(b.x + b.w / 2, b.y + b.h / 2, level.cfg.enemy, 40, 8);
      burst(b.x + b.w / 2, b.y + b.h / 2, '#ffffff', 24, 6);
      sfxBossDie();
      toast('BOSS DEFEATED!');
    }
  }

  // ---------- Update ----------
  function update() {
    tick++; elapsed++;
    if (bossIntro > 0) bossIntro--;
    updateAmbient();

    for (const p of level.platforms) {
      if (!p.move) continue;
      const prev = p.x;
      p.x = p.base + Math.sin(tick * p.move.speed + p.move.phase) * p.move.amp;
      p.dx = p.x - prev;
    }
    for (const e of level.enemies) {
      if (!e.alive) continue;
      e.x += e.dir * e.speed;
      if (e.x < e.x0) { e.x = e.x0; e.dir = 1; }
      if (e.x + e.w > e.x1) { e.x = e.x1 - e.w; e.dir = -1; }
      if (e.type === 'bat') e.y = e.baseY + Math.sin(tick * 0.05 + e.phase) * 24;
      else if (e.type === 'slime') e.y = e.baseY - Math.abs(Math.sin(tick * 0.08 + e.phase)) * 7;
    }

    const pl = player;
    const wasGround = !!pl.ground;
    if (pl.invuln > 0) pl.invuln--;
    if (fireCooldown > 0) fireCooldown--;

    if (input.left && !input.right) pl.vx -= ACCEL;
    else if (input.right && !input.left) pl.vx += ACCEL;
    else pl.vx *= FRICTION;
    if (Math.abs(pl.vx) < 0.05) pl.vx = 0;
    pl.vx = clamp(pl.vx, -MAX_V, MAX_V);
    if (pl.vx > 0.2) pl.face = 1;
    else if (pl.vx < -0.2) pl.face = -1;

    if (pl.ground && pl.ground.dx) pl.x += pl.ground.dx;
    pl.x += pl.vx;
    if (pl.x < 0) { pl.x = 0; pl.vx = 0; }
    if (pl.x + pl.w > level.worldW) { pl.x = level.worldW - pl.w; pl.vx = 0; }
    if (bossActive && level.boss.alive) {
      pl.x = clamp(pl.x, level.arena.x + 60, level.arena.x + level.arena.w - 70);
    }

    if (wasGround) pl.coyote = 7;
    else pl.coyote = Math.max(0, pl.coyote - 1);

    const canJump = pl.ground || pl.coyote > 0 || pl.jumps > 0;
    if (input.jumpBuffer > 0 && canJump && pl.jumps < 2) {
      const air = pl.jumps > 0 || (!pl.ground && pl.coyote === 0);
      pl.vy = air ? JUMP_V * 0.9 : JUMP_V;
      pl.jumps++;
      pl.coyote = 0;
      input.jumpBuffer = 0;
      pl.squash = -1.25;
      if (air) { burst(pl.x + pl.w / 2, pl.y + pl.h, '#ffffff', 10, 3); sfxDoubleJump(); }
      else { dust(pl.x + pl.w / 2, pl.y + pl.h); sfxJump(); }
    } else if (input.jumpBuffer > 0) input.jumpBuffer--;

    const prevBottom = pl.y + pl.h;
    pl.vy = Math.min(pl.vy + GRAV, 15);
    pl.y += pl.vy;
    pl.ground = null;
    if (pl.vy >= 0) {
      for (const s of level.solids) {
        if (prevBottom <= s.y + 6 && pl.y + pl.h >= s.y &&
            pl.x + pl.w > s.x + 6 && pl.x < s.x + s.w - 6) {
          pl.y = s.y - pl.h;
          if (!wasGround) { pl.squash = 1.6; dust(pl.x + pl.w / 2, pl.y + pl.h); sfxLand(); }
          pl.vy = 0;
          pl.ground = s;
          pl.jumps = 0;
          break;
        }
      }
    }

    // Shooting
    if (input.fire && fireCooldown <= 0 && !bossDefeated) {
      fireCooldown = 11;
      bullets.push({
        x: pl.x + pl.w / 2 + pl.face * 24,
        y: pl.y + 30,
        vx: pl.face * 10, vy: 0, life: 70,
      });
      burst(pl.x + pl.w / 2 + pl.face * 28, pl.y + 30, level.cfg.star, 3, 2);
      sfxShoot();
    }
    for (const b of bullets) {
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.x < level.arena.x - 20 || b.x > level.worldW + 20 || b.life <= 0) { b.dead = true; continue; }
      if (bossActive && level.boss.alive &&
          b.x > level.boss.x && b.x < level.boss.x + level.boss.w &&
          b.y > level.boss.y && b.y < level.boss.y + level.boss.h) {
        b.dead = true; damageBoss(); continue;
      }
      for (const e of level.enemies) {
        if (!e.alive) continue;
        if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
          b.dead = true; e.alive = false; score += 2;
          burst(e.x + e.w / 2, e.y + e.h / 2, level.cfg.enemy, 12, 4);
          sfxStomp(); break;
        }
      }
    }
    bullets = bullets.filter(b => !b.dead);

    // Boss activation, AI and projectiles
    if (!bossActive && !bossDefeated && player.x + player.w > level.arena.x + 70) {
      bossActive = true;
      bossIntro = 90;
      bossUI.classList.remove('hidden');
      bossNameEl.textContent = `${level.boss.name} · World ${levelIndex + 1}`;
      bossFill.style.width = '100%';
      toast(`BOSS — ${level.boss.name}`);
      beep(110, 0.5, 'sawtooth', 0.07, 60);
      saveProgress();
    }
    updateBoss();
    for (const s of bossShots) {
      s.x += s.vx; s.y += s.vy; s.life--;
      if (s.x < level.arena.x || s.x > level.arena.x + level.arena.w || s.life <= 0) { s.dead = true; continue; }
      if (!bossDefeated && player.invuln <= 0 &&
          s.x > player.x - s.r && s.x < player.x + player.w + s.r &&
          s.y > player.y - s.r && s.y < player.y + player.h + s.r) {
        s.dead = true;
        hurtPlayer(s.x);
      }
    }
    bossShots = bossShots.filter(s => !s.dead);

    // Monsters
    if (!bossDefeated) {
      for (const e of level.enemies) {
        if (!e.alive) continue;
        const hit = pl.x + pl.w > e.x + 3 && pl.x < e.x + e.w - 3 &&
                    pl.y + pl.h > e.y + 3 && pl.y < e.y + e.h - 3;
        if (!hit) continue;
        if (pl.vy > 0 && prevBottom <= e.y + 14) {
          e.alive = false; pl.vy = -10.5; pl.squash = 1.1; score += 2;
          burst(e.x + e.w / 2, e.y + e.h / 2, level.cfg.enemy, 14, 5);
          sfxStomp();
        } else hurtPlayer(e.x + e.w / 2);
      }
      const b = level.boss;
      if (bossActive && b.alive &&
          pl.x + pl.w > b.x + 6 && pl.x < b.x + b.w - 6 &&
          pl.y + pl.h > b.y + 6 && pl.y < b.y + b.h - 6) hurtPlayer(b.x + b.w / 2);
    }

    pl.anim += Math.abs(pl.vx) * 0.045 + (pl.ground ? 0 : 0.04);
    pl.squash *= 0.88;

    const pcx = pl.x + pl.w / 2, pcy = pl.y + pl.h / 2;
    for (const c of level.coins) {
      if (c.got) continue;
      c.t += 0.08;
      const dx = c.x - pcx, dy = c.y - pcy;
      if (dx * dx + dy * dy < 34 * 34) {
        c.got = true; score++; money++; saveProgress();
        burst(c.x, c.y, '#ffd34d', 9, 3.5);
        sfxCoin();
      }
    }
    for (const cp of level.checkpoints) {
      if (!cp.active && pcx > cp.x) {
        cp.active = true;
        respawn = { x: cp.spawnX, y: GROUND_Y - PH };
        toast('Checkpoint reached!');
        burst(cp.x, GROUND_Y - 90, level.cfg.accent, 14, 4);
        sfxCheck();
        saveProgress();
      }
    }

    if (bossDefeated) {
      if (defeatTimer > 0 && --defeatTimer === 0) { win(); return; }
    } else if (pl.y > WORLD_H + 80) {
      if (!isDev) {
        hearts--;
        sfxHurt();
        if (hearts <= 0) { gameOver(); return; }
      }
      toast('Oops! Back to the checkpoint');
      pl.x = respawn.x; pl.y = respawn.y;
      pl.vx = pl.vy = 0; pl.ground = null; pl.squash = 0; pl.invuln = 60; pl.jumps = 0;
      cam.x = clamp(pl.x - viewW * 0.35, 0, Math.max(0, level.worldW - viewW));
    }

    particles = particles.filter(p => p.life > 0);
    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--; }

    const maxCamX = Math.max(0, level.worldW - viewW);
    let targetX;
    if (bossActive && level.boss.alive) {
      targetX = clamp(level.arena.x + level.arena.w / 2 - viewW / 2, 0, maxCamX);
    } else if (viewW >= level.worldW) {
      targetX = (level.worldW - viewW) / 2;
    } else {
      targetX = clamp(pl.x + pl.w / 2 - viewW * 0.4, 0, maxCamX);
    }
    const targetY = viewH >= WORLD_H ? (WORLD_H - viewH) / 2 : clamp(pl.y + pl.h / 2 - viewH * 0.62, 0, WORLD_H - viewH);
    cam.x += (targetX - cam.x) * 0.12;
    cam.y += (targetY - cam.y) * 0.12;

    updateHud();
  }

  // ---------- Drawing ----------
  function drawSky(t) {
    const g = cachedGrad('sky|' + viewH + '|' + t.sky.join(','), () => {
      const gr = ctx.createLinearGradient(0, 0, 0, viewH);
      gr.addColorStop(0, t.sky[0]); gr.addColorStop(0.55, t.sky[1]); gr.addColorStop(1, t.sky[2]);
      return gr;
    });
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
    const sx = viewW * 0.78, sy = viewH * (t.detail === 'sunLow' || t.detail === 'lava' ? 0.24 : 0.16);
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 110);
    glow.addColorStop(0, t.glow[0]); glow.addColorStop(0.35, t.glow[1]); glow.addColorStop(1, t.glow[2]);
    ctx.fillStyle = glow; circle(sx, sy, 110);
    ctx.fillStyle = t.orb; circle(sx, sy, t.detail === 'sunLow' || t.detail === 'lava' ? 40 : 34);

    if (t.detail === 'aurora') {
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `rgba(${t.auroraRGB},${0.2 - k * 0.05})`;
        ctx.lineWidth = 24 - k * 6;
        ctx.beginPath();
        for (let x = -50; x <= viewW + 50; x += 40) {
          const y = viewH * (0.1 + k * 0.07) + Math.sin(x * 0.01 + tick * 0.006 + k * 2) * 28 - cam.y * 0.02;
          x === -50 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    if (t.detail === 'city') {
      const base = GROUND_Y - cam.y;
      for (let i = 0; i < 20; i++) {
        const w = 36 + (i % 4) * 20;
        const h = 60 + ((i * 47) % 150);
        const x = (((i * 118 - cam.x * 0.08) % (viewW + 320)) + (viewW + 320)) % (viewW + 320) - 120;
        ctx.fillStyle = i % 2 ? '#20244a' : '#292e5a';
        ctx.fillRect(x, base - h, w, h);
        ctx.fillStyle = 'rgba(255,215,140,.55)';
        for (let wy = base - h + 14; wy < base - 10; wy += 20) {
          for (let wx = x + 8; wx < x + w - 6; wx += 14) {
            if ((wx + wy + i) % 3 < 1.2) ctx.fillRect(wx, wy, 4, 6);
          }
        }
      }
    }
    if (t.detail === 'lava') {
      const gy = GROUND_Y - cam.y;
      const lg = ctx.createLinearGradient(0, gy - 20, 0, gy + 130);
      lg.addColorStop(0, 'rgba(255,90,30,0)');
      lg.addColorStop(1, 'rgba(255,80,20,.6)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, gy - 20, viewW, 160);
    }
    if (t.detail === 'rays') {
      ctx.save();
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = '#dfffff';
      for (let i = 0; i < 6; i++) {
        const x = viewW * (0.05 + i * 0.18) + Math.sin(tick * 0.004 + i) * 40;
        ctx.beginPath();
        ctx.moveTo(x, -20); ctx.lineTo(x + 55, -20);
        ctx.lineTo(x + 190, viewH); ctx.lineTo(x + 90, viewH);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = `rgba(${t.cloudRGB},.5)`;
    for (let i = 0; i < 16; i++) {
      const x = (((i * 137 + 40) % 1000) / 1000) * viewW;
      const y = (((i * 83 + 20) % 700) / 700) * viewH * 0.6;
      circle(x, y, (i % 3) * 0.9 + 1);
    }
  }

  const clouds = [
    { x: 120, y: 0.18, s: 1.1 }, { x: 520, y: 0.12, s: 0.8 },
    { x: 880, y: 0.27, s: 1.3 }, { x: 1300, y: 0.2, s: 0.9 },
    { x: 1750, y: 0.32, s: 1.15 }, { x: 2200, y: 0.15, s: 0.75 },
    { x: 2750, y: 0.25, s: 1.2 },
  ];
  function drawClouds(t) {
    const span = viewW + 300;
    ctx.fillStyle = `rgba(${t.cloudRGB},${t.cloudAlpha})`;
    for (const c of clouds) {
      const x = (((c.x - cam.x * 0.05 + tick * 0.12 * c.s) % span) + span) % span - 150;
      const y = c.y * viewH - cam.y * 0.04;
      const s = c.s;
      ctx.beginPath();
      ctx.ellipse(x, y, 38 * s, 16 * s, 0, 0, 7);
      ctx.ellipse(x + 28 * s, y - 8 * s, 28 * s, 18 * s, 0, 0, 7);
      ctx.ellipse(x - 28 * s, y - 4 * s, 24 * s, 14 * s, 0, 0, 7);
      ctx.fill();
    }
  }

  function hillLayer(color, anchor, amp, wave, factor) {
    const base = anchor - cam.y * factor;
    const off = -((cam.x * factor) % wave);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(off - wave, viewH + 60);
    ctx.lineTo(off - wave, base);
    for (let x = off - wave; x < viewW + wave * 2; x += wave) {
      ctx.quadraticCurveTo(x + wave / 2, base - amp, x + wave, base);
    }
    ctx.lineTo(viewW + wave * 2, viewH + 60);
    ctx.closePath(); ctx.fill();
  }
  function drawHills(t) {
    hillLayer(t.hills[0], GROUND_Y - 95, 85, 470, 0.08);
    hillLayer(t.hills[1], GROUND_Y - 45, 62, 340, 0.18);
    hillLayer(t.hills[2], GROUND_Y + 10, 46, 260, 0.35);
  }

  function drawArena(t) {
    const a = level.arena;
    if (a.x + a.w < cam.x - 60 || a.x > cam.x + viewW + 60) return;
    const top = GROUND_Y - 390;
    const g = cachedGrad('arena', () => {
      const gr = ctx.createLinearGradient(0, top, 0, GROUND_Y);
      gr.addColorStop(0, '#0a0c18');
      gr.addColorStop(1, '#1b1a30');
      return gr;
    });
    ctx.fillStyle = g;
    ctx.fillRect(a.x, top, a.w, GROUND_Y - top);
    ctx.fillStyle = '#0e1020';
    ctx.fillRect(a.x - 34, top - 30, 34, GROUND_Y - top + 60);
    ctx.fillRect(a.x + a.w, top - 30, 34, GROUND_Y - top + 60);
    ctx.fillRect(a.x - 34, top - 30, a.w + 68, 30);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = t.accent;
    ctx.fillRect(a.x + 8, top + 24, 6, GROUND_Y - top - 48);
    ctx.fillRect(a.x + a.w - 14, top + 24, 6, GROUND_Y - top - 48);
    ctx.fillRect(a.x, GROUND_Y - 7, a.w, 7);
    ctx.globalAlpha = 1;
    for (let i = 1; i <= 3; i++) {
      const x = a.x + (a.w * i) / 4;
      const flick = 0.7 + Math.sin(tick * 0.15 + i * 2) * 0.25;
      ctx.fillStyle = t.accent;
      ctx.globalAlpha = 0.25 * flick;
      circle(x, top + 70, 24);
      ctx.globalAlpha = 1;
      ctx.fillStyle = t.star;
      circle(x, top + 70, 5);
    }
    // Dramatic spotlights
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = t.accent;
    for (let i = 1; i <= 3; i++) {
      const x = a.x + (a.w * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x - 7, top + 30); ctx.lineTo(x + 7, top + 30);
      ctx.lineTo(x + 80, GROUND_Y); ctx.lineTo(x - 80, GROUND_Y);
      ctx.fill();
    }
    ctx.restore();
    // Warning sign above the arena
    const sx = a.x + a.w / 2 - 66;
    ctx.fillStyle = 'rgba(10,12,24,.88)';
    rr(sx, top + 54, 132, 34, 10); ctx.fill();
    ctx.strokeStyle = t.accent; ctx.lineWidth = 2;
    rr(sx, top + 54, 132, 34, 10); ctx.stroke();
    ctx.fillStyle = t.star;
    ctx.font = '900 16px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠  BOSS  ⚠', a.x + a.w / 2, top + 77);

    // Entrance arch / closed door
    ctx.fillStyle = '#080a14';
    rr(a.x - 18, GROUND_Y - 190, 36, 190, 14); ctx.fill();
    if (bossActive && level.boss.alive) {
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 3;
      rr(a.x + 34, GROUND_Y - 180, 10, 180, 5); ctx.stroke();
    }
  }

  function drawGoal(t) {
    if (!bossDefeated) return;
    const gx = level.goal.x + 45;
    if (gx < cam.x - 120 || gx > cam.x + viewW + 120) return;
    const gy = GROUND_Y - 58;
    const glow = ctx.createRadialGradient(gx, gy, 6, gx, gy, 95);
    glow.addColorStop(0, t.glow[0]); glow.addColorStop(1, t.glow[2]);
    ctx.fillStyle = glow; circle(gx, gy, 95);
    ctx.fillStyle = t.accent;
    ctx.beginPath(); ctx.ellipse(gx, gy, 46, 60, 0, 0, 7); ctx.fill();
    const inner = ctx.createLinearGradient(gx, gy - 55, gx, gy + 55);
    inner.addColorStop(0, '#b3a8ff'); inner.addColorStop(1, '#4538a0');
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.ellipse(gx, gy + 4, 35, 49, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(gx, gy + 4, 12 + i * 10, 18 + i * 13, tick * 0.02 + i, 0.3, 2.5);
      ctx.stroke();
    }
  }

  function drawThemeScenery(t) {
    const horizon = GROUND_Y - cam.y;
    const wrap = (v, span) => ((v % span) + span) % span;
    ctx.save();
    if (t.detail === 'sunLow') {
      ctx.fillStyle = 'rgba(150,80,60,.32)';
      for (let i = 0; i < 5; i++) {
        const x = wrap(i * 260 - cam.x * 0.12, viewW + 320) - 150;
        const h = 95 + ((i * 37) % 75);
        ctx.beginPath();
        ctx.moveTo(x - h, horizon); ctx.lineTo(x, horizon - h); ctx.lineTo(x + h, horizon);
        ctx.fill();
      }
    } else if (t.detail === 'aurora') {
      ctx.fillStyle = 'rgba(70,125,165,.32)';
      for (let i = 0; i < 10; i++) {
        const x = wrap(i * 140 - cam.x * 0.18, viewW + 200) - 80;
        const h = 65 + ((i * 29) % 55);
        ctx.beginPath();
        ctx.moveTo(x, horizon - h); ctx.lineTo(x + 22, horizon); ctx.lineTo(x - 22, horizon);
        ctx.fill();
      }
    } else if (t.detail === 'city') {
      for (let i = 0; i < 6; i++) {
        const x = wrap(i * 230 - cam.x * 0.2, viewW + 300) - 100;
        const y = horizon - 130 - ((i * 53) % 90);
        ctx.fillStyle = i % 2 ? 'rgba(124,242,255,.22)' : 'rgba(255,107,214,.22)';
        rr(x, y, 54, 17, 5); ctx.fill();
      }
    } else if (t.detail === 'lava') {
      for (let i = 0; i < 4; i++) {
        const x = wrap(i * 310 - cam.x * 0.1, viewW + 400) - 160;
        const h = 125 + ((i * 47) % 85);
        ctx.fillStyle = 'rgba(55,20,25,.6)';
        ctx.beginPath();
        ctx.moveTo(x - h, horizon); ctx.lineTo(x, horizon - h); ctx.lineTo(x + h, horizon);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,95,40,.45)';
        ctx.fillRect(x - 9, horizon - h, 18, 12);
      }
    } else if (t.detail === 'rays') {
      ctx.strokeStyle = 'rgba(20,160,145,.35)';
      ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const x = wrap(i * 150 - cam.x * 0.22, viewW + 200) - 80;
        const h = 85 + ((i * 31) % 65);
        ctx.beginPath();
        ctx.moveTo(x, horizon + 12);
        ctx.quadraticCurveTo(x + Math.sin(tick * 0.02 + i) * 24, horizon - h / 2, x + 10, horizon - h);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const x = wrap(i * 190 - cam.x * 0.09 + tick * 0.25, viewW + 220) - 80;
        const y = viewH * 0.22 + ((i * 47) % 70);
        ctx.beginPath();
        ctx.moveTo(x - 9, y);
        ctx.quadraticCurveTo(x, y - 7, x + 9, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawGround(t) {
    for (const s of level.grounds) {
      if (s.x + s.w < cam.x - 50 || s.x > cam.x + viewW + 50) continue;
      const inArena = s.x >= level.arena.x;
      const dirt = cachedGrad('ground|' + inArena + '|' + t.soil.join(','), () => {
        const gr = ctx.createLinearGradient(0, s.y, 0, s.y + 260);
        gr.addColorStop(0, inArena ? '#242338' : t.soil[0]);
        gr.addColorStop(1, inArena ? '#12111f' : t.soil[1]);
        return gr;
      });
      ctx.fillStyle = dirt;
      ctx.fillRect(s.x, s.y, s.w, WORLD_H - s.y + 80);
      ctx.fillStyle = inArena ? 'rgba(0,0,0,.25)' : 'rgba(60,40,30,.13)';
      for (let x = s.x + 24; x < s.x + s.w - 10; x += 46) circle(x, s.y + 44 + ((x * 7) % 60), 3 + (x % 3));
      ctx.fillStyle = inArena ? t.accent : t.grass;
      rr(s.x, s.y - 6, s.w, 20, 9); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      rr(s.x + 6, s.y - 2, s.w - 12, 4, 2); ctx.fill();
      ctx.fillStyle = inArena ? '#0e1020' : t.lip;
      rr(s.x + 3, s.y + 10, s.w - 6, 9, 4); ctx.fill();
      if (!inArena) {
        ctx.strokeStyle = t.lip; ctx.lineWidth = 2;
        for (let x = s.x + 18; x < s.x + s.w - 8; x += 34) {
          ctx.beginPath();
          ctx.moveTo(x, s.y - 4); ctx.lineTo(x - 3, s.y - 12);
          ctx.moveTo(x, s.y - 4); ctx.lineTo(x + 4, s.y - 11);
          ctx.stroke();
        }
      }
    }
  }

  function drawPlatforms(t) {
    for (const p of level.platforms) {
      if (p.x + p.w < cam.x - 60 || p.x > cam.x + viewW + 60) continue;
      ctx.fillStyle = 'rgba(40,50,60,.12)';
      ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, p.y + 42, p.w * 0.44, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = t.platDirt[1];
      rr(p.x + 6, p.y + 12, p.w, 27, 12); ctx.fill();
      ctx.fillStyle = t.platTop[0];
      rr(p.x, p.y, p.w, 18, 9); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.38)';
      rr(p.x + 7, p.y + 3, p.w - 14, 4, 2); ctx.fill();
      ctx.strokeStyle = t.lip; ctx.lineWidth = 2;
      for (let i = 12; i < p.w - 8; i += 27) {
        ctx.beginPath();
        ctx.moveTo(p.x + i, p.y); ctx.lineTo(p.x + i - 3, p.y - 8);
        ctx.moveTo(p.x + i, p.y); ctx.lineTo(p.x + i + 4, p.y - 7);
        ctx.stroke();
      }
      if (p.move) {
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2;
        rr(p.x - 2, p.y - 2, p.w + 4, 22, 11); ctx.stroke();
      }
    }
  }

  function drawCheckpoints(t) {
    for (const cp of level.checkpoints) {
      if (cp.x < cam.x - 60 || cp.x > cam.x + viewW + 60) continue;
      const top = GROUND_Y - 104;
      ctx.strokeStyle = cp.active ? t.accent : 'rgba(160,170,190,.8)';
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cp.x, GROUND_Y); ctx.lineTo(cp.x, top); ctx.stroke();
      ctx.fillStyle = cp.active ? t.accent : 'rgba(190,200,215,.85)';
      ctx.beginPath();
      ctx.moveTo(cp.x + 2, top + 2); ctx.lineTo(cp.x + 42, top + 14); ctx.lineTo(cp.x + 2, top + 30);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = cp.active ? t.star : 'rgba(200,210,225,.9)';
      circle(cp.x, top, 6);
      if (cp.active) {
        for (let i = 0; i < 4; i++) {
          const a = tick * 0.04 + i * Math.PI / 2;
          circle(cp.x + Math.cos(a) * 30, top + 14 + Math.sin(a) * 20, 2.4);
        }
      }
    }
  }

  function drawEnemies(t) {
    for (const e of level.enemies) {
      if (!e.alive || e.x + e.w < cam.x - 50 || e.x > cam.x + viewW + 50) continue;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      if (e.type === 'slime') {
        ctx.fillStyle = 'rgba(40,40,60,.14)';
        ctx.beginPath(); ctx.ellipse(cx, e.y + e.h + 2, e.w * 0.5, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = t.enemy;
        ctx.beginPath();
        ctx.ellipse(cx, e.y + e.h - 18, e.w / 2, 19, 0, Math.PI, 0);
        ctx.lineTo(cx + e.w / 2, e.y + e.h); ctx.lineTo(cx - e.w / 2, e.y + e.h);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.beginPath(); ctx.ellipse(cx - 7, e.y + 12, 6, 4, -0.4, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff';
        circle(cx - 7, e.y + 18, 5); circle(cx + 7, e.y + 18, 5);
        ctx.fillStyle = '#242a4d';
        circle(cx - 6 + e.dir, e.y + 19, 2.3); circle(cx + 8 + e.dir, e.y + 19, 2.3);
        ctx.strokeStyle = '#242a4d'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(cx, e.y + 25, 4, 0.2, Math.PI - 0.2); ctx.stroke();
      } else if (e.type === 'spike') {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(e.x * 0.05);
        ctx.fillStyle = t.enemy;
        starPath(0, 0, e.w / 2 + 5, e.w / 2 - 6, 9); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        circle(-6, -4, 6); circle(6, -4, 6);
        ctx.fillStyle = '#242a4d';
        circle(-5, -3, 2.4); circle(7, -3, 2.4);
        ctx.restore();
      } else {
        const flap = Math.sin(tick * 0.25 + e.phase) * 9;
        ctx.fillStyle = t.enemy;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy); ctx.lineTo(cx - 26, cy - 12 + flap);
        ctx.lineTo(cx - 20, cy + 6); ctx.lineTo(cx - 30, cy + 14 + flap);
        ctx.lineTo(cx - 4, cy + 7); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 26, cy - 12 + flap);
        ctx.lineTo(cx + 20, cy + 6); ctx.lineTo(cx + 30, cy + 14 + flap);
        ctx.lineTo(cx + 4, cy + 7); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, cy, 12, 13, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff';
        circle(cx - 5, cy - 2, 4); circle(cx + 5, cy - 2, 4);
        ctx.fillStyle = '#242a4d';
        circle(cx - 4, cy - 1, 2); circle(cx + 6, cy - 1, 2);
      }
    }
  }

  function drawBoss(t) {
    const b = level.boss;
    if (!b.alive || !bossActive) return;
    const cx = b.x + b.w / 2;
    ctx.save();
    if (bossIntro > 0) {
      const k = 1 - bossIntro / 90;
      const sc = 0.35 + 0.65 * k;
      ctx.translate(cx, b.y + b.h);
      ctx.scale(sc, sc);
      ctx.translate(-cx, -(b.y + b.h));
    }
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(cx, GROUND_Y + 2, 52, 9, 0, 0, 7); ctx.fill();
    const body = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    body.addColorStop(0, t.enemy);
    body.addColorStop(1, '#241a38');
    ctx.fillStyle = body;
    rr(b.x, b.y, b.w, b.h, 30); ctx.fill();
    ctx.fillStyle = t.enemy;
    ctx.beginPath();
    ctx.moveTo(b.x + 12, b.y + 14); ctx.lineTo(b.x + 2, b.y - 22); ctx.lineTo(b.x + 34, b.y + 4);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.x + b.w - 12, b.y + 14); ctx.lineTo(b.x + b.w - 2, b.y - 22); ctx.lineTo(b.x + b.w - 34, b.y + 4);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    for (let i = 0; i < 3; i++) rr(b.x + 14 + i * 26, b.y + 68, 18, 10, 4), ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx - 20, b.y + 40, 12, 14, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 20, b.y + 40, 12, 14, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff3b5c';
    circle(cx - 18 + b.dir * 3, b.y + 42, 6);
    circle(cx + 22 + b.dir * 3, b.y + 42, 6);
    ctx.fillStyle = 'rgba(255,59,92,.35)';
    circle(cx - 18 + b.dir * 3, b.y + 42, 12);
    circle(cx + 22 + b.dir * 3, b.y + 42, 12);
    ctx.fillStyle = '#160e1f';
    rr(cx - 22, b.y + 72, 44, 18, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 17 + i * 11, b.y + 72);
      ctx.lineTo(cx - 12 + i * 11, b.y + 79);
      ctx.lineTo(cx - 7 + i * 11, b.y + 72);
      ctx.fill();
    }
    if (b.flash > 0) {
      ctx.globalAlpha = b.flash / 14;
      ctx.fillStyle = '#ffffff';
      rr(b.x, b.y, b.w, b.h, 30); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawShots(t) {
    for (const s of bossShots) {
      if (s.x < cam.x - 30 || s.x > cam.x + viewW + 30) continue;
      ctx.fillStyle = 'rgba(255,60,90,.3)'; circle(s.x, s.y, s.r * 2);
      ctx.fillStyle = '#ff3b5c'; circle(s.x, s.y, s.r);
      ctx.fillStyle = '#fff'; circle(s.x - 2, s.y - 2, 2.5);
    }
    for (const b of bullets) {
      if (b.x < cam.x - 30 || b.x > cam.x + viewW + 30) continue;
      ctx.fillStyle = 'rgba(255,255,255,.35)'; circle(b.x, b.y, 10);
      ctx.fillStyle = t.star; circle(b.x, b.y, 5);
      ctx.fillStyle = '#fff'; circle(b.x, b.y, 2.2);
    }
  }

  function drawCoins(t) {
    for (const c of level.coins) {
      if (c.got || c.x < cam.x - 40 || c.x > cam.x + viewW + 40) continue;
      const sx = Math.max(0.12, Math.abs(Math.cos(c.t)));
      ctx.save();
      ctx.translate(c.x, c.y); ctx.scale(sx, 1);
      ctx.fillStyle = 'rgba(255,255,255,.28)'; circle(0, 0, 17);
      ctx.fillStyle = '#ffcf4a'; circle(0, 0, 13);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.arc(-4, -5, 4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#e09512'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(175,105,0,.65)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(125,72,0,.72)';
      ctx.font = '900 13px Nunito, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('S', 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.arc(-4, -5, 2.1, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      if (p.x < cam.x - 30 || p.x > cam.x + viewW + 30) continue;
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      circle(p.x, p.y, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawAmbient(t) {
    const type = t.ambient, rgb = t.ambientRGB, a = t.ambientAlpha;
    ctx.lineWidth = 1.6;
    for (const p of ambient) {
      const x = p.x * viewW, y = p.y * viewH, s = p.s;
      if (type === 'rain') {
        ctx.strokeStyle = `rgba(${rgb},${a})`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 13 * s); ctx.stroke();
      } else if (type === 'bubble') {
        ctx.strokeStyle = `rgba(${rgb},${a})`;
        ctx.beginPath(); ctx.arc(x, y, 3 * s + 1, 0, 7); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${rgb},${a})`;
        if (type === 'ember') circle(x, y, 2.2 * s);
        else if (type === 'petal') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(tick * 0.02 + p.ph);
          ctx.beginPath(); ctx.ellipse(0, 0, 4 * s, 2 * s, 0, 0, 7); ctx.fill(); ctx.restore();
        } else circle(x, y, 2.4 * s);
      }
    }
  }

  function drawPlayer() {
    const pl = player;
    if (pl.x + pl.w < cam.x - 60 || pl.x > cam.x + viewW + 60) return;
    if (pl.invuln > 0 && Math.floor(tick / 4) % 2 === 0) return;
    const cx = pl.x + pl.w / 2, by = pl.y + pl.h;
    const sq = pl.squash;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(1.25 * (1 + sq * 0.22), 1.25 * (1 - sq * 0.28));
    ctx.fillStyle = 'rgba(40,50,70,.16)';
    ctx.beginPath(); ctx.ellipse(0, 3, 20, 5, 0, 0, 7); ctx.fill();
    const swing = pl.ground ? Math.sin(pl.anim) * Math.min(6, Math.abs(pl.vx)) : 2;
    ctx.fillStyle = '#3b3f7a';
    rr(-14, -11 + swing * 0.2, 11, 12, 5); ctx.fill();
    rr(3, -11 - swing * 0.2, 11, 12, 5); ctx.fill();
    const suit = (OUTFITS.find(x => x.id === outfit) || OUTFITS[0]).color;
    const body = ctx.createLinearGradient(0, -50, 0, 0);
    body.addColorStop(0, suit); body.addColorStop(1, '#3b3f7a');
    ctx.fillStyle = body; rr(-21, -48, 42, 44, 17); ctx.fill();
    ctx.fillStyle = '#ffffff'; rr(-16, -42, 32, 24, 12); ctx.fill();
    const look = pl.face * 2.5;
    const blink = tick % 190 < 9;
    ctx.fillStyle = '#242a4d';
    if (blink) { ctx.fillRect(-10 + look, -31, 7, 2); ctx.fillRect(3 + look, -31, 7, 2); }
    else {
      ctx.beginPath(); ctx.ellipse(-7 + look, -30, 3.2, 4.2, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7 + look, -30, 3.2, 4.2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; circle(-8 + look, -31.5, 1.1); circle(6 + look, -31.5, 1.1);
    }
    ctx.fillStyle = 'rgba(255,120,150,.55)'; circle(-13 + look, -24, 3); circle(13 + look, -24, 3);
    ctx.strokeStyle = '#242a4d'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(look, -25, 4, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.strokeStyle = '#3b3f7a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(0, -57); ctx.stroke();
    ctx.fillStyle = '#ffd34d'; circle(0, -59, 4.5);
    ctx.fillStyle = 'rgba(255,211,77,.3)'; circle(0, -59, 9);
    ctx.restore();
  }

  function drawGun() {
    if (!bossActive || bossDefeated) return;
    const pl = player;
    ctx.save();
    ctx.translate(pl.x + pl.w / 2 + pl.face * 22, pl.y + 30);
    ctx.scale(pl.face, 1);
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    rr(-15, 6, 40, 9, 4); ctx.fill();
    ctx.fillStyle = '#232733';
    ctx.beginPath();
    ctx.moveTo(-10, 2); ctx.lineTo(2, 2); ctx.lineTo(8, 20); ctx.lineTo(-2, 22);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#11141d'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-7 + i * 4, 8); ctx.lineTo(-4 + i * 4, 18); ctx.stroke();
    }
    ctx.strokeStyle = '#2b3040'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(6, 8, 7, 0, Math.PI); ctx.stroke();
    const g = ctx.createLinearGradient(0, -9, 0, 6);
    g.addColorStop(0, '#9aa3b2'); g.addColorStop(0.45, '#5d6675'); g.addColorStop(1, '#2e3441');
    ctx.fillStyle = g;
    rr(-16, -9, 42, 15, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.32)';
    rr(-13, -8, 36, 3, 1.5); ctx.fill();
    ctx.fillStyle = '#1d222d';
    rr(24, -6, 10, 8, 2); ctx.fill();
    ctx.fillStyle = '#0f1218'; circle(33, -2, 3.2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(-12 + i * 4, -7); ctx.lineTo(-12 + i * 4, 3); ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    if (!level) return;
    const t = level.cfg;
    ctx.clearRect(0, 0, viewW, viewH);
    drawSky(t);
    drawClouds(t);
    drawHills(t);
    drawThemeScenery(t);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawArena(t);
    drawGround(t);
    drawPlatforms(t);
    drawCheckpoints(t);
    drawGoal(t);
    drawCoins(t);
    drawEnemies(t);
    drawShots(t);
    drawParticles();
    drawBoss(t);
    drawPlayer();
    drawGun();
    ctx.restore();
    drawAmbient(t);
  }

  // ---------- Loop ----------
  let last = performance.now(), acc = 0;
  function loop(now) {
    acc += Math.min(50, now - last) / 16.6667;
    last = now;
    if (state === 'playing') {
      let steps = 0;
      while (acc >= 1 && steps < 4) { update(); acc -= 1; steps++; if (state !== 'playing') break; }
    } else { acc = 0; tick++; }
    render();
    requestAnimationFrame(loop);
  }

  // Debug hooks (handy for testing without a browser).
  window.__skybound = {
    get state() { return state; },
    get level() { return level; },
    get player() { return player; },
    get boss() { return level && level.boss; },
    get bossActive() { return bossActive; },
    get bossDefeated() { return bossDefeated; },
    get money() { return money; },
    get outfit() { return outfit; },
    get isDev() { return isDev; },
    get hearts() { return hearts; },
    loadLevel,
    fire(v) { input.fire = v; },
  };

  level = buildLevel(0);
  ambient = makeAmbient();
  cam.y = viewH >= WORLD_H ? (WORLD_H - viewH) / 2 : 0;
  levelBadge.textContent = `WORLD 1/${LEVELS.length} · ${LEVELS[0].name}`;
  applyOutfit(outfit);
  updateHud();
  introTimer = setTimeout(finishIntro, 3400);
  requestAnimationFrame(loop);
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
