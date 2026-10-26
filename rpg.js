// ===== 力量曲線 RPG 層 =====
// 使用方式：在 index.html 主程式 </script> 之後加一行 <script src="rpg.js"></script>
// 完全不改記錄流程，只讀取 entries / profile 並包裝 handleAdd 與 renderAll。
(function () {
  const STATS = [
    { k: 'squat',    abbr: 'STR', name: '力量' },
    { k: 'bench',    abbr: 'POW', name: '爆發' },
    { k: 'deadlift', abbr: 'VIT', name: '韌性' },
  ];
  const RANKS = [
    { min: 0,   name: '見習', color: '#8B92A3' },
    { min: 250, name: '青銅', color: '#B8794A' },
    { min: 320, name: '白銀', color: '#C9CED8' },
    { min: 400, name: '黃金', color: '#D4A017' },
    { min: 470, name: '秘銀', color: '#6FC3D9' },
    { min: 530, name: '傳說', color: '#E07A3F' },
  ];
  const EXP_PER_KG = 0.1;            // 10 kg 訓練量 = 1 EXP
  const lvExp = L => 250 * (L - 1) * (L - 1); // 升到 L 級需要的累積 EXP

  // ---- 樣式 ----
  const css = `
  .rpg { position:relative; background:#1E222B; border-radius:14px; padding:18px 18px 16px; margin-bottom:24px;
    box-shadow: inset 0 0 0 1px #3a3220, inset 0 0 0 4px #1E222B, inset 0 0 0 5px #2a2618; }
  .rpg-top { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; }
  .rpg-lv { font-family:'Bebas Neue',sans-serif; font-size:56px; line-height:.85; color:#D4A017; }
  .rpg-lv small { font-size:18px; color:#8B92A3; margin-right:4px; }
  .rpg-class { font-size:15px; font-weight:700; margin-top:6px; }
  .rpg-rank { text-align:right; font-size:12px; color:#8B92A3; }
  .rpg-rank b { display:block; font-family:'JetBrains Mono',monospace; font-size:22px; }
  .rpg-xp { height:8px; background:#15171C; border-radius:4px; margin:14px 0 4px; overflow:hidden; }
  .rpg-xp div { height:100%; background:linear-gradient(90deg,#8a6a10,#D4A017); transition:width .6s ease; }
  .rpg-xp-t { font-size:11px; color:#8B92A3; display:flex; justify-content:space-between; }
  .rpg-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:14px; }
  .rpg-stat { background:#262b36; border-radius:8px; padding:8px 10px; border-top:3px solid var(--c); }
  .rpg-stat span { font-size:11px; color:#8B92A3; }
  .rpg-stat b { display:block; font-family:'JetBrains Mono',monospace; font-size:20px; }
  .rpg-toast { position:fixed; left:50%; bottom:calc(24px + env(safe-area-inset-bottom)); transform:translate(-50%,20px);
    background:#262b36; color:#EDEAE1; border:1px solid #D4A017; border-radius:10px; padding:10px 16px; font-size:14px;
    font-weight:700; z-index:60; opacity:0; transition:opacity .2s, transform .2s; pointer-events:none; text-align:center; }
  .rpg-toast.show { opacity:1; transform:translate(-50%,0); }
  .rpg-toast small { display:block; font-weight:500; color:#D4A017; font-size:12px; margin-top:2px; }
  .rpg-lvup { position:fixed; inset:0; z-index:70; background:rgba(10,11,14,.88); display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:8px; cursor:pointer; }
  .rpg-lvup[hidden] { display:none; }
  .rpg-lvup h2 { font-family:'Bebas Neue',sans-serif; font-size:64px; margin:0; color:#D4A017; letter-spacing:2px;
    animation:rpgPop .5s cubic-bezier(.2,1.6,.4,1); }
  .rpg-lvup p { margin:0; color:#EDEAE1; font-size:16px; }
  .rpg-lvup small { color:#8B92A3; font-size:12px; margin-top:18px; }
  @keyframes rpgPop { from { transform:scale(.4); opacity:0; } to { transform:none; opacity:1; } }
  @media (prefers-reduced-motion: reduce) { .rpg-lvup h2 { animation:none; } .rpg-xp div { transition:none; } }`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);

  // ---- DOM ----
  const card = document.createElement('div');
  card.className = 'rpg';
  document.getElementById('prGrid').before(card);
  const toast = document.createElement('div');
  toast.className = 'rpg-toast';
  document.body.appendChild(toast);
  const lvup = document.createElement('div');
  lvup.className = 'rpg-lvup'; lvup.hidden = true;
  lvup.onclick = () => (lvup.hidden = true);
  document.body.appendChild(lvup);

  // ---- 計算 ----
  function totalVolume() { return entries.reduce((s, c) => s + cardVolume(c), 0); }
  function snapshot() {
    const exp = Math.floor(totalVolume() * EXP_PER_KG);
    let L = 1; while (exp >= lvExp(L + 1)) L++;
    const bests = {}; STATS.forEach(s => { const b = allTimeBest(s.k); bests[s.k] = b ? b.val : 0; });
    const reps = {}; STATS.forEach(s => { reps[s.k] = {}; [1,3,5,8].forEach(n => { const b = repBest(s.k, n); reps[s.k][n] = b ? b.weight : 0; }); });
    const rows = entries.reduce((s, c) => s + c.rows.length, 0);
    return { exp, L, bests, reps, rows };
  }
  function className(sq, bp, dl) {
    if (!sq || !bp || !dl) return '冒險者';
    if (dl / sq > 1.25) return '破城者';
    if (bp / sq > 0.75) return '重槍騎士';
    if (dl / sq < 1.05) return '鐵壁守衛';
    return '全能戰士';
  }
  function rankOf(d) { return [...RANKS].reverse().find(r => d >= r.min) || RANKS[0]; }

  function renderCard() {
    const s = snapshot();
    const cur = STATS.map(x => refE1RM(x.k) || 0);
    const total = cur[0] && cur[1] && cur[2] ? cur[0] + cur[1] + cur[2] : null;
    const d = total && profile.bodyweight ? dots(total, profile.bodyweight, profile.sex) : null;
    const rank = d != null ? rankOf(d) : null;
    const lo = lvExp(s.L), hi = lvExp(s.L + 1);
    card.innerHTML = `
      <div class="rpg-top">
        <div><div class="rpg-lv"><small>Lv</small>${s.L}</div>
          <div class="rpg-class">${className(...cur)}</div></div>
        <div class="rpg-rank">${rank ? `<b style="color:${rank.color}">${Math.round(d)}</b>戰力・${rank.name}`
          : '<b>—</b>填體重並記錄三項 RPE 頂組'}</div>
      </div>
      <div class="rpg-xp"><div style="width:${((s.exp - lo) / (hi - lo) * 100).toFixed(1)}%"></div></div>
      <div class="rpg-xp-t"><span>${fmtNum(s.exp)} EXP</span><span>升級還差 ${fmtNum(hi - s.exp)}</span></div>
      <div class="rpg-stats">${STATS.map((x, i) => `<div class="rpg-stat" style="--c:${MAIN_LIFTS[x.k].color}">
        <span>${x.abbr} ${x.name}</span><b>${cur[i] ? Math.round(cur[i]) : '—'}</b></div>`).join('')}</div>`;
  }

  // ---- 回饋 ----
  function haptic(strong) {
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (H) H.impact({ style: strong ? 'HEAVY' : 'LIGHT' }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(strong ? [30, 40, 60] : 15);
  }
  let actx = null;
  function chime(notes) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.09;
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.13);
      });
    } catch (e) {}
  }
  let toastTimer;
  function showToast(main, sub) {
    toast.innerHTML = esc(main) + (sub ? `<small>${esc(sub)}</small>` : '');
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // ---- 包裝原本函式 ----
  const origAdd = window.handleAdd;
  window.handleAdd = function () {
    const before = snapshot();
    origAdd.apply(this, arguments);
    const after = snapshot();
    if (after.rows === before.rows) return; // 驗證失敗，沒有新增

    const gained = after.exp - before.exp;
    const drops = [];
    STATS.forEach(x => {
      if (after.bests[x.k] > before.bests[x.k] && before.bests[x.k] > 0)
        drops.push(`${MAIN_LIFTS[x.k].label} e1RM ${after.bests[x.k]}kg`);
      [1,3,5,8].forEach(n => {
        if (after.reps[x.k][n] > before.reps[x.k][n] && before.reps[x.k][n] > 0)
          drops.push(`${MAIN_LIFTS[x.k].label} ${n}RM ${after.reps[x.k][n]}kg`);
      });
    });

    if (after.L > before.L) {
      lvup.innerHTML = `<h2>LEVEL UP</h2><p>Lv ${before.L} → Lv ${after.L}</p>
        ${drops.length ? `<p style="color:#D4A017">★ ${esc(drops[0])}</p>` : ''}<small>點任意處繼續</small>`;
      lvup.hidden = false;
      haptic(true); chime([523, 659, 784, 1047]);
    } else if (drops.length) {
      showToast(`★ 傳說掉落：${drops[0]}`, `+${gained} EXP`);
      haptic(true); chime([659, 784, 1047]);
    } else {
      showToast(`+${gained} EXP`, '');
      haptic(false); chime([880]);
    }
  };

  const origRender = window.renderAll;
  window.renderAll = function () { origRender.apply(this, arguments); renderCard(); };
  renderCard();
})();
