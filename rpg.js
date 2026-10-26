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

  // =====================================================
  // ===== 戰鬥模式：每一組都是一場可操作的戰鬥 =====
  // =====================================================
  const MONSTERS = {
    squat:    { icon:'🗿', name:'岩石巨像' },
    bench:    { icon:'🐉', name:'熔岩幼龍' },
    deadlift: { icon:'👹', name:'深淵鬼王' },
    acc:      { icon:'🐺', name:'荒野狼群' },
  };
  document.head.insertAdjacentHTML('beforeend', `<style>
  .bt-open { width:100%; margin-top:10px; background:#2a2618; color:#D4A017; border:1px solid #D4A017; border-radius:8px;
    padding:12px; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; }
  .bt { position:fixed; inset:0; z-index:65; background:radial-gradient(circle at 50% 30%,#2a2230,#0e0f13 70%);
    display:flex; flex-direction:column; padding:calc(14px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));
    user-select:none; -webkit-user-select:none; touch-action:manipulation; }
  .bt[hidden] { display:none; }
  .bt-bar { display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#8B92A3; }
  .bt-x { background:none; border:none; color:#8B92A3; font-size:22px; cursor:pointer; }
  .bt-mon { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; min-height:200px; }
  .bt-name { font-weight:700; font-size:15px; margin-bottom:6px; }
  .bt-hp { width:min(320px,80%); height:12px; background:#15171C; border-radius:6px; overflow:hidden; box-shadow:0 0 0 1px #3a4050; }
  .bt-hp div { height:100%; background:linear-gradient(90deg,#B72E3D,#E07A3F); transition:width .25s; }
  .bt-hpt { font-family:'JetBrains Mono',monospace; font-size:12px; color:#8B92A3; margin-top:4px; }
  .bt-sprite { font-size:110px; line-height:1; margin-top:18px; transition:transform .1s, filter .1s; }
  .bt-sprite.hit { transform:translate(6px,-4px) rotate(4deg) scale(.95); filter:brightness(2.2) saturate(0); }
  .bt-sprite.dead { transform:scale(0) rotate(40deg); opacity:0; transition:transform .6s, opacity .6s; }
  .bt-dmg { position:absolute; font-family:'Bebas Neue',sans-serif; font-size:34px; color:#EDEAE1; pointer-events:none;
    text-shadow:0 2px 0 #000; animation:btFloat .8s ease-out forwards; }
  .bt-dmg.crit { color:#D4A017; font-size:48px; }
  @keyframes btFloat { from { transform:translateY(0) scale(1.3); opacity:1; } to { transform:translateY(-70px) scale(1); opacity:0; } }
  .bt.shake { animation:btShake .25s; }
  @keyframes btShake { 25% { transform:translateX(-6px); } 75% { transform:translateX(6px); } }
  .bt-panel { background:#1E222B; border-radius:14px; padding:14px; }
  .bt-row { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; }
  .bt-row label { font-size:12px; color:#8B92A3; width:44px; }
  .bt-step { display:flex; align-items:center; gap:6px; flex:1; justify-content:flex-end; }
  .bt-step button { width:44px; height:40px; border:none; border-radius:8px; background:#262b36; color:#EDEAE1; font-size:16px; font-weight:700; cursor:pointer; }
  .bt-step b { font-family:'JetBrains Mono',monospace; font-size:24px; min-width:84px; text-align:center; }
  .bt-rpe { display:flex; gap:4px; flex:1; justify-content:flex-end; flex-wrap:wrap; }
  .bt-rpe button { min-width:38px; height:34px; border:none; border-radius:6px; background:#262b36; color:#8B92A3; font-family:'JetBrains Mono',monospace; font-weight:700; cursor:pointer; }
  .bt-rpe button.on { background:#D4A017; color:#15171C; }
  .bt-atk { width:100%; height:84px; border:none; border-radius:14px; background:#B72E3D; color:#fff; font-family:'Bebas Neue',sans-serif;
    font-size:34px; letter-spacing:2px; cursor:pointer; box-shadow:0 6px 0 #6e1a24; transition:transform .05s, box-shadow .05s; }
  .bt-atk:active { transform:translateY(5px); box-shadow:0 1px 0 #6e1a24; }
  .bt-atk small { display:block; font-family:Inter,sans-serif; font-size:12px; letter-spacing:0; opacity:.85; }
  .bt-done { width:100%; margin-top:10px; height:50px; border:none; border-radius:12px; background:#EDEAE1; color:#15171C; font-size:16px; font-weight:700; cursor:pointer; }
  .bt-done:disabled { opacity:.35; }
  .bt-rest { position:absolute; inset:0; background:rgba(14,15,19,.94); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; z-index:2; }
  .bt-rest[hidden] { display:none; }
  .bt-ring { width:200px; height:200px; }
  .bt-ring text { font-family:'JetBrains Mono',monospace; fill:#EDEAE1; font-size:34px; font-weight:700; }
  .bt-rest-btns { display:flex; gap:8px; }
  .bt-rest-btns button { background:#262b36; color:#EDEAE1; border:none; border-radius:8px; padding:10px 18px; font-family:inherit; font-weight:700; cursor:pointer; }
  .bt-loot { font-size:15px; color:#D4A017; font-weight:700; text-align:center; min-height:20px; }
  @media (prefers-reduced-motion: reduce) { .bt.shake, .bt-dmg { animation:none; } }
  </style>`);

  const openBtn = document.createElement('button');
  openBtn.className = 'bt-open'; openBtn.type = 'button';
  openBtn.textContent = '⚔ 進入戰鬥模式';
  document.querySelector('button.add').after(openBtn);

  const bt = document.createElement('div');
  bt.className = 'bt'; bt.hidden = true;
  bt.innerHTML = `
    <div class="bt-bar"><span id="btStage"></span><button class="bt-x" id="btClose" aria-label="離開戰鬥">✕</button></div>
    <div class="bt-mon" id="btMon">
      <div class="bt-name" id="btName"></div>
      <div class="bt-hp"><div id="btHp"></div></div>
      <div class="bt-hpt" id="btHpt"></div>
      <div class="bt-sprite" id="btSprite"></div>
      <div class="bt-loot" id="btLoot"></div>
    </div>
    <div class="bt-panel">
      <div class="bt-row"><label>重量</label><div class="bt-step">
        <button data-w="-5">−5</button><button data-w="-2.5">−2.5</button><b id="btW">0</b><button data-w="2.5">+2.5</button><button data-w="5">+5</button></div></div>
      <div class="bt-row"><label>RPE</label><div class="bt-rpe" id="btRpe"></div></div>
      <button class="bt-atk" id="btAtk">ATTACK<small id="btAtkSub">每做一下點一次</small></button>
      <button class="bt-done" id="btDone" disabled>完成這組</button>
    </div>
    <div class="bt-rest" id="btRest" hidden>
      <div style="color:#8B92A3;font-size:13px;">組間休息・體力恢復中</div>
      <svg class="bt-ring" viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" fill="none" stroke="#262b36" stroke-width="10"/>
        <circle id="btRingArc" cx="100" cy="100" r="88" fill="none" stroke="#4FB477" stroke-width="10" stroke-linecap="round"
          transform="rotate(-90 100 100)" stroke-dasharray="553" stroke-dashoffset="0"/>
        <text id="btRingT" x="100" y="112" text-anchor="middle">3:00</text></svg>
      <div class="bt-rest-btns"><button id="btRestM">−30s</button><button id="btRestP">+30s</button><button id="btRestSkip">下一組</button></div>
    </div>`;
  document.body.appendChild(bt);
  const $b = id => document.getElementById(id);
  $b('btRpe').innerHTML = ['—',6,7,7.5,8,8.5,9,9.5,10].map(v => `<button data-rpe="${v==='—'?'':v}">${v}</button>`).join('');

  const B = { ex:null, w:0, reps:0, rpe:'', hpMax:1, dealt:0, topPrev:0, setDmg:0, restLeft:0, restMax:180, restTimer:null };

  function exCards(ex) { return cardsOfExercise(ex); }
  function setupBattle() {
    const ex = currentExercise();
    if (!ex) { alert('先在「新增紀錄」選好動作，再進入戰鬥。'); return false; }
    B.ex = ex;
    const date = $('fDate').value || todayStr();
    const all = exCards(ex);
    const prev = all.filter(c => c.date < date).sort((a,b) => b.date.localeCompare(a.date))[0];
    const today = all.find(c => c.date === date);
    B.hpMax = prev ? Math.max(1, Math.round(cardVolume(prev))) : 2000;
    B.dealt = today ? Math.round(cardVolume(today)) : 0;
    B.topPrev = prev ? Math.max(...prev.rows.map(r => r.weight)) : 0;
    const lastRow = (today && today.rows.slice(-1)[0]) || (prev && prev.rows[0]);
    B.w = parseFloat($('fWeight').value) || (lastRow ? lastRow.weight : 20);
    B.rpe = ''; B.reps = 0; B.setDmg = 0;
    const m = MONSTERS[ex.cat === 'main' ? ex.key : 'acc'];
    $b('btName').textContent = `${m.name}・${ex.label}`;
    $b('btSprite').textContent = m.icon;
    $b('btSprite').className = 'bt-sprite';
    $b('btStage').textContent = prev ? `目標：打贏上次 ${prev.date.slice(5)} 的總量` : '初次遭遇';
    $b('btLoot').textContent = '';
    return true;
  }
  function hpLeft() { return Math.max(0, B.hpMax - B.dealt - B.setDmg); }
  function renderBattle() {
    $b('btW').textContent = B.w;
    $b('btHp').style.width = (hpLeft() / B.hpMax * 100) + '%';
    $b('btHpt').textContent = `HP ${fmtNum(hpLeft())} / ${fmtNum(B.hpMax)}`;
    $b('btAtkSub').textContent = B.reps ? `第 ${B.reps} 下・傷害 ${fmtNum(B.setDmg)}` : '每做一下點一次';
    $b('btDone').disabled = !B.reps;
    $b('btDone').textContent = B.reps ? `完成這組：${B.w}kg × ${B.reps}${B.rpe ? ' @' + B.rpe : ''}` : '完成這組';
    [...$b('btRpe').children].forEach(b => b.classList.toggle('on', b.dataset.rpe === String(B.rpe)));
  }
  function floatDmg(n, crit) {
    const d = document.createElement('div');
    d.className = 'bt-dmg' + (crit ? ' crit' : '');
    d.textContent = (crit ? 'CRIT ' : '') + n;
    const mon = $b('btMon');
    d.style.left = (40 + Math.random() * 20) + '%';
    d.style.top = (45 + Math.random() * 10) + '%';
    mon.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }
  function attack() {
    if (hpLeft() <= 0 && B.reps === 0) return;
    B.reps++;
    const crit = B.topPrev > 0 && B.w > B.topPrev;
    const dmg = Math.round(B.w * (crit ? 1 : 1));
    B.setDmg += dmg;
    floatDmg(dmg, crit);
    const s = $b('btSprite');
    s.classList.add('hit'); setTimeout(() => s.classList.remove('hit'), 90);
    if (crit) { bt.classList.remove('shake'); void bt.offsetWidth; bt.classList.add('shake'); }
    haptic(crit); chime(crit ? [988, 1319] : [440 + B.reps * 20]);
    renderBattle();
  }
  function commitSet() {
    if (!B.reps) return;
    $('fWeight').value = B.w; $('fReps').value = B.reps; $('fSets').value = 1; $('fRpe').value = B.rpe;
    const wasAlive = B.hpMax - B.dealt > 0;
    window.handleAdd();
    B.dealt += B.setDmg; B.setDmg = 0; B.reps = 0; B.rpe = '';
    renderBattle();
    if (wasAlive && hpLeft() <= 0) {
      $b('btSprite').classList.add('dead');
      $b('btLoot').textContent = '★ 擊敗！今天總量超越上次';
      haptic(true); chime([523, 659, 784, 1047, 1319]);
      setTimeout(startRest, 1400);
    } else startRest();
  }
  function startRest() {
    clearInterval(B.restTimer);
    B.restMax = B.restLeft = (B.ex && B.ex.cat === 'main') ? 180 : 90;
    $b('btRest').hidden = false; tickRest();
    B.restTimer = setInterval(() => {
      B.restLeft--; tickRest();
      if (B.restLeft <= 0) { endRest(); haptic(true); chime([784, 784, 1047]); }
    }, 1000);
  }
  function tickRest() {
    const l = Math.max(0, B.restLeft);
    $b('btRingT').textContent = Math.floor(l / 60) + ':' + pad(l % 60);
    $b('btRingArc').setAttribute('stroke-dashoffset', 553 * (1 - l / B.restMax));
  }
  function endRest() { clearInterval(B.restTimer); $b('btRest').hidden = true; }

  openBtn.onclick = () => { if (!setupBattle()) return; bt.hidden = false; document.body.style.overflow = 'hidden'; renderBattle(); };
  $b('btClose').onclick = () => {
    if (B.reps && !confirm('這組還沒按「完成」，離開會放棄這組。確定？')) return;
    endRest(); bt.hidden = true; document.body.style.overflow = '';
  };
  bt.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
    B.w = Math.max(0, round1(B.w + parseFloat(b.dataset.w))); haptic(false); renderBattle();
  });
  $b('btRpe').onclick = e => { const b = e.target.closest('[data-rpe]'); if (b) { B.rpe = b.dataset.rpe; renderBattle(); } };
  $b('btAtk').addEventListener('pointerdown', e => { e.preventDefault(); attack(); });
  $b('btDone').onclick = commitSet;
  $b('btRestM').onclick = () => { B.restLeft = Math.max(1, B.restLeft - 30); tickRest(); };
  $b('btRestP').onclick = () => { B.restLeft += 30; B.restMax = Math.max(B.restMax, B.restLeft); tickRest(); };
  $b('btRestSkip').onclick = endRest;
})();