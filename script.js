(() => {
  /*** CONFIG ***/
  const GRID = 24;           // cells per side
  const CELL = 30;           // base pixel cell (canvas is 720x720); we scale in CSS
  const EDGE = GRID * CELL;  // canvas size
  const INITIAL_LEN = 4;
  const PARTICLES = 36;
  const START_LIVES = 3;

  /*** DOM ***/
  const root = document.documentElement;
  const cvs = document.getElementById('board');
  const ctx = cvs.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('high');
  const livesEl = document.getElementById('lives');
  const livesHearts = document.getElementById('livesHearts');
  const overlay = document.getElementById('overlay');
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');
  const btnWalls = document.getElementById('btnWalls');
  const btnSound = document.getElementById('btnSound');
  const difficulty = document.getElementById('difficulty');
  const swatches = [...document.querySelectorAll('.sw')];
  const themeToggle = document.getElementById('themeToggle');
  const scoreList = document.getElementById('scoreList');
  const btnClearScores = document.getElementById('btnClearScores');

  const startMobile = document.getElementById('startMobile');
  const pauseMobile = document.getElementById('pauseMobile');
  const resetMobile = document.getElementById('resetMobile');
  const dpadButtons = [...document.querySelectorAll('.dpad button')];

  /*** THEME ***/
  const setAccent = (hex) => { root.style.setProperty('--accent', hex); root.style.setProperty('--accent-2', hex); };
  swatches.forEach(sw => sw.addEventListener('click', () => setAccent(sw.dataset.color)));

  const applyTheme = (t) => { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('neon-snake-theme', t); themeToggle.textContent = t === 'dark' ? '🌙 Dark' : '☀️ Light'; };
  applyTheme(localStorage.getItem('neon-snake-theme') || 'dark');
  themeToggle.addEventListener('click', () => { const cur = document.documentElement.getAttribute('data-theme'); applyTheme(cur === 'dark' ? 'light' : 'dark'); });

  /*** STATE ***/
  let snake, dir, nextDir, food, running=false, paused=false, score=0;
  let best=+localStorage.getItem('neon-snake-high')||0;
  let stepInterval = 1000 / Number(difficulty.value); // ms per step
  let acc = 0;  // time accumulator
  let last = 0; // last timestamp
  let particles = [];
  let walls = false;
  let soundOn = true;
  let lives = START_LIVES;

  highEl.textContent = best;
  updateLivesUI();

  /*** AUDIO (WebAudio, no assets) ***/
  const Audio = (()=>{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const beep = (freq=440, dur=0.06, type='sine', gain=0.06) => {
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = gain; g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(t0 + dur);
    };
    const eat = ()=> beep(760, 0.05, 'triangle', 0.08);
    const step = ()=> beep(220, 0.02, 'square', 0.03);
    const hit  = ()=> { beep(260,0.08,'sawtooth',0.07); };
    const over = ()=> { beep(200,0.12,'sawtooth',0.08); setTimeout(()=>beep(120,0.14,'sawtooth',0.08), 80); };
    return {eat, step, hit, over};
  })();

  /*** SCOREBOARD (localStorage) ***/
  function loadScores(){ try{ return JSON.parse(localStorage.getItem('neon-snake-scores')||'[]'); }catch{ return []; } }
  function saveScores(arr){ localStorage.setItem('neon-snake-scores', JSON.stringify(arr)); }
  function addScoreEntry(val){
    const list = loadScores();
    list.push({score: val, date: new Date().toISOString()});
    list.sort((a,b)=> b.score - a.score);
    const trimmed = list.slice(0, 10);
    saveScores(trimmed);
    if (trimmed.length && trimmed[0].score > best){ best = trimmed[0].score; localStorage.setItem('neon-snake-high', best); }
    renderScores();
  }
  function renderScores(){
    const list = loadScores();
    highEl.textContent = best;
    scoreList.innerHTML = '';
    if (!list.length){ scoreList.innerHTML = '<div>No scores yet</div><div>—</div><div>—</div>'; return; }
    list.forEach((e,i)=>{
      const rank = document.createElement('div'); rank.textContent = `${i+1}. ${e.score}`;
      const when = document.createElement('div'); when.textContent = new Date(e.date).toLocaleString();
      const tag = document.createElement('div'); tag.textContent = (i===0?'🏅 Best': '');
      scoreList.append(rank, when, tag);
    });
  }
  btnClearScores.addEventListener('click', ()=>{ if (confirm('Clear all saved scores?')){ localStorage.removeItem('neon-snake-scores'); renderScores(); }});
  renderScores();

  function updateLivesUI(){
    livesEl.textContent = lives;
    livesHearts.textContent = '❤'.repeat(lives);
  }

  function reset() {
    snake = [];
    const cx = Math.floor(GRID/2), cy = Math.floor(GRID/2);
    for (let i=0;i<INITIAL_LEN;i++) snake.push({x:cx-i,y:cy});
    dir = {x:1,y:0};
    nextDir = {x:1,y:0};
    score=0; scoreEl.textContent = score;
    lives = START_LIVES; updateLivesUI();
    spawnFood();
    particles.length = 0;
    acc = 0; last = performance.now();
  }

  function spawnFood() {
    do { food = {x: (Math.random()*GRID)|0, y: (Math.random()*GRID)|0}; }
    while (snake.some(s => s.x===food.x && s.y===food.y));
  }

  function setDifficulty() { stepInterval = 1000 / Number(difficulty.value); }
  difficulty.addEventListener('change', setDifficulty);

  /*** INPUT ***/
  const keyMap = { ArrowUp:{x:0,y:-1}, ArrowDown:{x:0,y:1}, ArrowLeft:{x:-1,y:0}, ArrowRight:{x:1,y:0}, w:{x:0,y:-1}, s:{x:0,y:1}, a:{x:-1,y:0}, d:{x:1,y:0} };
  window.addEventListener('keydown', (e)=>{
    if (e.key==='Enter') { start(); return; }
    if (e.key==='p' || e.key==='P') { togglePause(); return; }
    const v = keyMap[e.key]; if (!v) return;
    if (v.x === -dir.x && v.y === -dir.y) return;
    nextDir = v; if (soundOn) Audio.step();
  }, {passive:true});

  // Touch DPAD
  const dToVec = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
  dpadButtons.forEach(b=>{
    const act = ()=>{ const v = dToVec[b.dataset.d]; if (!v) return; if (v.x !== -dir.x || v.y !== -dir.y){ nextDir = v; if (soundOn) Audio.step(); } };
    b.addEventListener('touchstart', (e)=>{ e.preventDefault(); act(); }, {passive:false});
    b.addEventListener('click', act);
  });

  // Swipe gestures
  (function enableSwipe(){
    const el = cvs; let sx=0, sy=0, t=0;
    el.addEventListener('touchstart', (e)=>{ const p=e.touches[0]; sx=p.clientX; sy=p.clientY; t=Date.now(); }, {passive:true});
    el.addEventListener('touchend', (e)=>{
      const dx = (e.changedTouches[0].clientX - sx); const dy = (e.changedTouches[0].clientY - sy);
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Date.now()-t > 300) return; if (Math.max(adx,ady) < 24) return;
      const v = adx>ady ? (dx>0? dToVec.right : dToVec.left) : (dy>0? dToVec.down : dToVec.up);
      if (v.x === -dir.x && v.y === -dir.y) return;
      nextDir = v; if (soundOn) Audio.step(); if (navigator.vibrate) navigator.vibrate(12);
    }, {passive:true});
  })();

  // Buttons
  btnStart.addEventListener('click', start);
  btnPause.addEventListener('click', togglePause);
  btnReset.addEventListener('click', onReset);
  startMobile.addEventListener('click', start);
  pauseMobile.addEventListener('click', togglePause);
  resetMobile.addEventListener('click', onReset);
  btnWalls.addEventListener('click', ()=>{ walls = !walls; btnWalls.textContent = `Walls: ${walls? 'On':'Off'}`; });
  btnSound.addEventListener('click', ()=>{ soundOn = !soundOn; btnSound.textContent = soundOn? '🔊 Sound':'🔈 Muted'; });

  function onReset(){ reset(); draw(true); showOverlay('Press <span class="kbd">Enter</span> or tap <b>Start</b>'); }

  function start(){ if (!running){ reset(); running=true; paused=false; hideOverlay(); requestAnimationFrame(loop); }}
  function togglePause(){ if(!running) return; paused=!paused; paused? showOverlay('Paused — press <span class="kbd">P</span> / tap <b>Pause</b>'): hideOverlay(); }

  function showOverlay(html){ overlay.querySelector('.title').innerHTML = html; overlay.style.display='grid'; }
  function hideOverlay(){ overlay.style.display='none'; }

  /*** GAME LOOP ***/
  function loop(ts){
    if (!running){ return; }
    const dt = ts - last; last = ts; if (paused){ requestAnimationFrame(loop); return; }
    acc += dt;
    while(acc >= stepInterval){ step(); acc -= stepInterval; }
    draw();
    requestAnimationFrame(loop);
  }

  function step(){
    if (nextDir) dir = nextDir;
    const head = {x: (snake[0].x + dir.x), y: (snake[0].y + dir.y)};

    // wrap or walls
    if (!walls){ head.x = (head.x + GRID) % GRID; head.y = (head.y + GRID) % GRID; }

    // collision (self or wall)
    const hitWall = (walls && (head.x<0||head.y<0||head.x>=GRID||head.y>=GRID));
    const hitSelf = snake.some((s,i)=> i>6 && s.x===head.x && s.y===head.y);
    if (hitWall || hitSelf){
      handleLifeLoss();
      return; // skip usual movement this frame
    }

    snake.unshift(head);

    // eat
    if (head.x===food.x && head.y===food.y){
      score++; scoreEl.textContent=score;
      if (score>best){ best=score; localStorage.setItem('neon-snake-high', best); highEl.textContent=best; }
      spawnFood();
      burstParticles(head);
      if (soundOn) Audio.eat();
      stepInterval = Math.max(45, stepInterval*0.985);
    } else {
      snake.pop();
    }
  }

  function handleLifeLoss(){
    if (soundOn) Audio.hit();
    lives -= 1; updateLivesUI();
    if (navigator.vibrate) navigator.vibrate([15, 40]);

    if (lives > 0){
      // Soft reset snake to center, keep score and speed
      const cx = Math.floor(GRID/2), cy = Math.floor(GRID/2);
      snake = [];
      for (let i=0;i<INITIAL_LEN;i++) snake.push({x:cx-i,y:cy});
      dir = {x:1,y:0}; nextDir = {x:1,y:0};
      showOverlay(`Life lost — <b>${lives}</b> ${lives===1?'life':'lives'} left`);
      paused = true;
      setTimeout(()=>{ hideOverlay(); paused = false; }, 800);
    } else {
      gameOver();
    }
  }

  function gameOver(){
    running=false; showOverlay('Game Over — press <span class="kbd">Enter</span> / tap <b>Start</b>');
    if (soundOn) Audio.over();
    if (navigator.vibrate) navigator.vibrate([40, 40]);
    addScoreEntry(score);
    // open scoreboard automatically
    const details = document.getElementById('scoresBox');
    if (details && !details.open) details.open = true;
  }

  /*** RENDER ***/
  function draw(clearOnly=false){
    ctx.clearRect(0,0,EDGE,EDGE);

    // vignette
    const g = ctx.createRadialGradient(EDGE*0.5, EDGE*0.5, EDGE*0.1, EDGE*0.5, EDGE*0.5, EDGE*0.7);
    const theme = document.documentElement.getAttribute('data-theme');
    g.addColorStop(0, theme==='dark'?'rgba(0,0,0,0)':'rgba(255,255,255,0)');
    g.addColorStop(1, theme==='dark'?'rgba(0,0,0,0.28)':'rgba(0,0,0,0.06)');
    ctx.fillStyle = g; ctx.fillRect(0,0,EDGE,EDGE);
    if (clearOnly) return;

    // food
    drawFood(food.x, food.y);

    // snake body
    for (let i=snake.length-1; i>=0; i--){
      const s = snake[i];
      const t = i / Math.max(1, snake.length-1);
      const alpha = 0.35 + (1-t)*0.65;
      drawCell(s.x, s.y, alpha, i===0);
    }

    // particles
    updateParticles();
  }

  function drawCell(x,y,alpha=1,isHead=false){
    const px = x*CELL, py = y*CELL;
    const r = Math.floor(CELL*0.3);

    // glow
    ctx.shadowColor = getComputedStyle(root).getPropertyValue('--accent');
    ctx.shadowBlur = 28;

    // body cube
    const grad = ctx.createLinearGradient(px,py,px,py+CELL);
    grad.addColorStop(0, `rgba(255,255,255,${0.10*alpha})`);
    grad.addColorStop(1, `rgba(255,255,255,${0.02*alpha})`);
    ctx.fillStyle = grad;
    roundRect(ctx, px+3, py+3, CELL-6, CELL-6, r); ctx.fill();

    // border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(0,0,0,${0.18})`;
    if (document.documentElement.getAttribute('data-theme')==='dark') ctx.strokeStyle = `rgba(255,255,255,${0.22*alpha})`;
    ctx.lineWidth = 1.2;
    roundRect(ctx, px+3, py+3, CELL-6, CELL-6, r); ctx.stroke();

    if (isHead){
      const visor = ctx.createLinearGradient(px, py, px, py+CELL);
      visor.addColorStop(0, `rgba(255,255,255,.8)`);
      visor.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = visor; ctx.globalAlpha = .18; roundRect(ctx, px+6, py+5, CELL-12, CELL*.35, r/2); ctx.fill(); ctx.globalAlpha=1;
    }
  }

  function drawFood(x,y){
    const px = x*CELL + CELL/2, py = y*CELL + CELL/2;
    const rg = ctx.createRadialGradient(px-3, py-3, 2, px, py, CELL*.6);
    const accent = getComputedStyle(root).getPropertyValue('--accent').trim();
    rg.addColorStop(0, '#fff');
    rg.addColorStop(0.05, accent);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, CELL*.42, 0, Math.PI*2); ctx.fill();

    // sparkle
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(px-6, py-7, 3, 0, Math.PI*2); ctx.fill();
  }

  function roundRect(ctx,x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  /*** PARTICLES ***/
  function burstParticles(head){
    const base = { x: head.x*CELL + CELL/2, y: head.y*CELL + CELL/2 };
    for (let i=0;i<PARTICLES;i++){
      const a = (Math.random()*Math.PI*2);
      const sp = (Math.random()*2 + .6);
      particles.push({ x:base.x, y:base.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life: 600 + Math.random()*300 });
    }
  }
  function updateParticles(){
    particles = particles.filter(p => (p.life -= 16) > 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = getComputedStyle(root).getPropertyValue('--accent');
    for (const p of particles){
      p.x += p.vx; p.y += p.vy; p.vx *= .985; p.vy *= .985;
      ctx.globalAlpha = Math.max(0, p.life/900);
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // Initial paint
  reset(); draw(true);
})();
