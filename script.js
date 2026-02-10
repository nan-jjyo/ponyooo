/* HAM CATCH - Vanilla JS
   - 4 detik loading -> home
   - play -> game
   - ham (+score), bom (lose life). 3 life habis -> end (game over)
   - replay -> langsung game
   - home -> balik home
   - kontrol: tombol panah + keyboard arrow
*/

const SCREENS = {
  loading: document.getElementById("screen-loading"),
  home: document.getElementById("screen-home"),
  game: document.getElementById("screen-game"),
  end: document.getElementById("screen-end"),
};

const btnPlay = document.getElementById("btnPlay");
const btnHome = document.getElementById("btnHome");
const btnReplay = document.getElementById("btnReplay");
const btnLeft = document.getElementById("btnLeft");
const btnRight = document.getElementById("btnRight");

const loadingFill = document.getElementById("loadingFill");
const loadingPips = document.getElementById("loadingPips");

const playfield = document.getElementById("playfield");
const playerEl = document.getElementById("player");

const scoreText = document.getElementById("scoreText");
const finalScore = document.getElementById("finalScore");

const lifeEls = [
  document.getElementById("life1"),
  document.getElementById("life2"),
  document.getElementById("life3"),
];

/* ========= ASSET PATHS ========= */
const ASSETS = {
  ponyo: "assets/ponyo1.PNG",
  ham: "assets/ham.PNG",
  bom: "assets/bom.PNG",
  sfx: {
    backsound: "assets/backsound.MP3",
    getHam: "assets/Getham.MP3",
    getBom: "assets/GetBom.MP3",
    gameOver: "assets/GameOver.MP3",
  },
};

/* ========= FALLBACK ASSETS (kalau file belum ada) =========
   Biar langsung kelihatan tanpa PNG kamu.
*/
const FALLBACK = {
  ponyo: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <rect width="64" height="64" rx="14" fill="#ffd5dc"/>
      <circle cx="32" cy="26" r="16" fill="#ff6b6b"/>
      <circle cx="26" cy="24" r="3" fill="#2b1b14"/>
      <circle cx="38" cy="24" r="3" fill="#2b1b14"/>
      <path d="M24 34c4 5 12 5 16 0" fill="none" stroke="#2b1b14" stroke-width="3" stroke-linecap="round"/>
      <rect x="18" y="42" width="28" height="14" rx="7" fill="#b64b2d"/>
    </svg>
  `),
  ham: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <rect width="64" height="64" rx="14" fill="#fff0f0"/>
      <path d="M18 38c0-10 8-18 18-18s18 8 18 18-8 18-18 18-18-8-18-18z" fill="#ff8fab"/>
      <circle cx="44" cy="38" r="5" fill="#ffc2d1"/>
      <circle cx="30" cy="34" r="4" fill="#ffc2d1"/>
      <rect x="10" y="34" width="12" height="8" rx="4" fill="#ffd5dc"/>
    </svg>
  `),
  bom: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <rect width="64" height="64" rx="14" fill="#f1ece7"/>
      <circle cx="30" cy="36" r="16" fill="#2f2f2f"/>
      <circle cx="24" cy="32" r="4" fill="#5a5a5a"/>
      <path d="M38 22l10-8" stroke="#2f2f2f" stroke-width="4" stroke-linecap="round"/>
      <path d="M48 14c6 2 6 10 0 12" fill="none" stroke="#b64b2d" stroke-width="4" stroke-linecap="round"/>
    </svg>
  `),
};

/* ========= AUDIO (ingat: autoplay sering diblok) ========= */
const audio = {
  backsound: new Audio(ASSETS.sfx.backsound),
  getHam: new Audio(ASSETS.sfx.getHam),
  getBom: new Audio(ASSETS.sfx.getBom),
  gameOver: new Audio(ASSETS.sfx.gameOver),
};
audio.backsound.loop = true;
audio.backsound.volume = 0.65;

/* ========= GAME STATE ========= */
let score = 0;
let lives = 3;
let running = false;

let playerX = 0;         // px relative to playfield
let playerSpeed = 260;   // px/s (keyboard)
let holdingLeft = false;
let holdingRight = false;

let lastT = 0;
let spawnT = 0;
let spawnEvery = 600;    // ms (akan random dikit)
let fallMin = 140;       // px/s
let fallMax = 240;       // px/s

const items = []; // {el, type:'ham'|'bom', x, y, vy, w, h}

/* ========= INIT ========= */
setupLoadingPips();
startLoadingThenHome();

/* ========= UI NAV ========= */
btnPlay.addEventListener("click", () => {
  // mulai backsound saat ada user gesture (lebih aman)
  safePlay(audio.backsound);
  startGame();
});

btnHome.addEventListener("click", () => {
  stopGame();
  showScreen("home");
  // coba putar backsound lagi
  safePlay(audio.backsound);
});

btnReplay.addEventListener("click", () => {
  safePlay(audio.backsound);
  startGame();
});

/* tombol panah mobile */
btnLeft.addEventListener("pointerdown", () => holdingLeft = true);
btnLeft.addEventListener("pointerup", () => holdingLeft = false);
btnLeft.addEventListener("pointercancel", () => holdingLeft = false);
btnLeft.addEventListener("pointerleave", () => holdingLeft = false);

btnRight.addEventListener("pointerdown", () => holdingRight = true);
btnRight.addEventListener("pointerup", () => holdingRight = false);
btnRight.addEventListener("pointercancel", () => holdingRight = false);
btnRight.addEventListener("pointerleave", () => holdingRight = false);

/* keyboard untuk PC */
window.addEventListener("keydown", (e) => {
  if (!running) return;
  if (e.key === "ArrowLeft") holdingLeft = true;
  if (e.key === "ArrowRight") holdingRight = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") holdingLeft = false;
  if (e.key === "ArrowRight") holdingRight = false;
});

/* klik/tap di mana aja buat bantu enable audio (kalau autoplay diblok) */
window.addEventListener("pointerdown", () => {
  if (currentScreen() === "home") safePlay(audio.backsound);
}, { passive: true });

/* ========= SCREEN HELPERS ========= */
function showScreen(name){
  Object.values(SCREENS).forEach(el => el.classList.remove("screen--active"));
  SCREENS[name].classList.add("screen--active");
  Object.entries(SCREENS).forEach(([k, el]) => {
    el.setAttribute("aria-hidden", k === name ? "false" : "true");
  });

  // On home show, try play backsound (may be blocked until gesture)
  if (name === "home") safePlay(audio.backsound);
}

function currentScreen(){
  return Object.entries(SCREENS).find(([,el]) => el.classList.contains("screen--active"))?.[0];
}

/* ========= LOADING ========= */
function setupLoadingPips(){
  loadingPips.innerHTML = "";
  for (let i=0; i<18; i++){
    const s = document.createElement("span");
    loadingPips.appendChild(s);
  }
}

function startLoadingThenHome(){
  showScreen("loading");

  const DURATION = 4000; // 4 detik
  const start = performance.now();

  function tick(t){
    const p = Math.min(1, (t - start) / DURATION);
    loadingFill.style.width = `${Math.round(p * 100)}%`;

    // pips nyala bertahap
    const lit = Math.floor(p * 18);
    [...loadingPips.children].forEach((pip, idx) => {
      pip.style.opacity = idx < lit ? "1" : ".35";
    });

    if (p < 1) requestAnimationFrame(tick);
    else {
      showScreen("home");
      // set fallback images kalau file PNG belum ada
      applyImageFallbacks();
    }
  }
  requestAnimationFrame(tick);
}

/* ========= FALLBACK IMAGE HANDLING ========= */
function applyImageFallbacks(){
  // ponyo on home and game
  setImgWithFallback(document.getElementById("homePonyo"), ASSETS.ponyo, FALLBACK.ponyo);
  setImgWithFallback(playerEl, ASSETS.ponyo, FALLBACK.ponyo);
}

function setImgWithFallback(imgEl, src, fallback){
  imgEl.onerror = () => { imgEl.src = fallback; };
  imgEl.src = src;
}

/* ========= GAME FLOW ========= */
function startGame(){
  stopGame(); // bersihin kalau sebelumnya jalan

  // reset state
  score = 0;
  lives = 3;
  scoreText.textContent = "0";
  updateLivesUI();

  // posisi player center
  const pf = playfield.getBoundingClientRect();
  playerX = (pf.width / 2) - (playerEl.clientWidth / 2);
  setPlayerX(playerX);

  // bersihin item jatuh
  items.splice(0, items.length);
  [...playfield.querySelectorAll(".falling")].forEach(el => el.remove());

  showScreen("game");
  running = true;

  lastT = performance.now();
  spawnT = 0;
  spawnEvery = 520 + Math.random()*240;

  requestAnimationFrame(loop);
}

function stopGame(){
  running = false;
  holdingLeft = false;
  holdingRight = false;
}

/* ========= MAIN LOOP ========= */
function loop(t){
  if (!running) return;

  const dt = (t - lastT) / 1000;
  lastT = t;

  // move player
  const pf = playfield.getBoundingClientRect();
  const playerW = playerEl.clientWidth || 44;

  let vx = 0;
  if (holdingLeft) vx -= playerSpeed;
  if (holdingRight) vx += playerSpeed;

  playerX += vx * dt;
  playerX = clamp(playerX, 6, pf.width - playerW - 6);
  setPlayerX(playerX);

  // spawn items
  spawnT += (dt * 1000);
  if (spawnT >= spawnEvery){
    spawnT = 0;
    spawnEvery = 480 + Math.random()*420;
    spawnItem(pf.width);
  }

  // update falling items
  const playerRect = getRectInPlayfield(playerEl);

  for (let i = items.length - 1; i >= 0; i--){
    const it = items[i];
    it.y += it.vy * dt;
    it.el.style.transform = `translate(${it.x}px, ${it.y}px)`;

    // collision
    const itemRect = {
      x: it.x,
      y: it.y,
      w: it.w,
      h: it.h
    };

    if (rectsOverlap(playerRect, itemRect)){
      // hit
      if (it.type === "ham"){
        score += 1;
        scoreText.textContent = String(score);
        safePlay(audio.getHam);
      } else {
        lives -= 1;
        updateLivesUI();
        safePlay(audio.getBom);
        if (lives <= 0){
          gameOver();
          return;
        }
      }
      it.el.remove();
      items.splice(i, 1);
      continue;
    }

    // remove if out
    if (it.y > pf.height + 60){
      it.el.remove();
      items.splice(i, 1);
    }
  }

  requestAnimationFrame(loop);
}

function spawnItem(playfieldW){
  const type = Math.random() < 0.68 ? "ham" : "bom"; // lebih banyak ham
  const el = document.createElement("img");
  el.className = "falling";
  el.alt = type;

  const src = type === "ham" ? ASSETS.ham : ASSETS.bom;
  const fallback = type === "ham" ? FALLBACK.ham : FALLBACK.bom;
  setImgWithFallback(el, src, fallback);

  // ukuran item (match CSS var)
  const size = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--item")) || 34;

  const x = 8 + Math.random() * (playfieldW - size - 16);
  const y = -50;
  const vy = rand(fallMin, fallMax);

  el.style.transform = `translate(${x}px, ${y}px)`;
  playfield.appendChild(el);

  items.push({ el, type, x, y, vy, w: size, h: size });
}

function gameOver(){
  running = false;

  // stop backsound
  audio.backsound.pause();
  audio.backsound.currentTime = 0;

  safePlay(audio.gameOver);

  finalScore.textContent = String(score);
  showScreen("end");
}

/* ========= HELPERS ========= */
function updateLivesUI(){
  lifeEls.forEach((el, idx) => {
    el.style.opacity = (idx < lives) ? "1" : ".25";
    el.style.filter = (idx < lives) ? "none" : "grayscale(1)";
  });
}

function setPlayerX(x){
  playerEl.style.left = `${x + (playerEl.clientWidth/2)}px`;
  playerEl.style.transform = "translateX(-50%)";
}

function getRectInPlayfield(el){
  // ngambil rect relatif playfield
  const pf = playfield.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - pf.left),
    y: (r.top - pf.top),
    w: r.width,
    h: r.height
  };
}

function rectsOverlap(a,b){
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function clamp(v, min, max){
  return Math.max(min, Math.min(max, v));
}

function rand(min, max){
  return min + Math.random() * (max - min);
}

function safePlay(aud){
  try{
    aud.currentTime = 0;
    const p = aud.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }catch(_){}
}

function svgDataUri(svgStr){
  const s = svgStr.trim()
    .replaceAll("\n", "")
    .replaceAll("\t", " ")
    .replace(/\s{2,}/g, " ");
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
}
