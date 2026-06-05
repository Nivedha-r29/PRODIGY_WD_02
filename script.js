const $ = id => document.getElementById(id);

let running = false;
let startTime = 0;
let elapsedBefore = 0;
let rafId = null;
let laps = [];

const timerEl = $('timer');
const lapList = $('lapList');
const ring = document.getElementById('ring');

function formatTime(ms, mode = 'ms'){
	const total = Math.max(0, Math.floor(ms));
	const hours = Math.floor(total / 3600000);
	const minutes = Math.floor((total % 3600000) / 60000);
	const seconds = Math.floor((total % 60000) / 1000);
	const millis = total % 1000;
	const hh = String(hours).padStart(2,'0');
	const mm = String(minutes).padStart(2,'0');
	const ss = String(seconds).padStart(2,'0');
	const mmm = String(millis).padStart(3,'0');
	if(mode === 'short') return `${mm}:${ss}.${mmm}`;
	return `${hh}:${mm}:${ss}.${mmm}`;
}

function updateUI(){
	const now = performance.now();
	const elapsed = elapsedBefore + (running ? now - startTime : 0);
	timerEl.textContent = formatTime(elapsed, $('formatSelect').value === 'short' ? 'short' : 'ms');
	const secondsPart = (elapsed/1000) % 60;
	const pct = secondsPart / 60;
	const circumference = 2 * Math.PI * 52;
	ring.style.strokeDasharray = `${circumference} ${circumference}`;
	ring.style.strokeDashoffset = `${circumference * (1 - pct)}`;
}

function tick(){
	updateUI();
	rafId = requestAnimationFrame(tick);
}

$('startBtn').addEventListener('click', ()=>{
	if(running) return;
	running = true;
	startTime = performance.now();
	requestAnimationFrame(tick);
});

$('pauseBtn').addEventListener('click', ()=>{
	if(!running) return;
	running = false;
	elapsedBefore += performance.now() - startTime;
	cancelAnimationFrame(rafId);
});

$('resetBtn').addEventListener('click', ()=>{
	running = false;
	startTime = 0;
	elapsedBefore = 0;
	laps = [];
	lapList.innerHTML = '';
	updateUI();
	cancelAnimationFrame(rafId);
});

$('lapBtn').addEventListener('click', ()=>{
	const elapsed = elapsedBefore + (running ? performance.now() - startTime : 0);
	const entry = {id: laps.length+1, time: elapsed, text: formatTime(elapsed)};
	laps.unshift(entry);
	renderLaps();
});

function renderLaps(){
	lapList.innerHTML = '';
	laps.forEach(l => {
		const li = document.createElement('li');
		li.textContent = `${l.id}. ${l.text}`;
		lapList.appendChild(li);
	});
}

// Update nav export link disabled state based on laps
function updateExportNavState(){
  const dl = $('downloadLink');
  if(!dl) return;
  if(laps.length === 0){ dl.classList.add('disabled'); dl.setAttribute('aria-disabled','true'); }
  else { dl.classList.remove('disabled'); dl.removeAttribute('aria-disabled'); }
}

$('copyBtn').addEventListener('click', async ()=>{
	if(laps.length === 0) return;
	const txt = laps.map(l=>`${l.id},${formatTime(l.time)}`).join('\n');
	try{ await navigator.clipboard.writeText(txt); alert('Laps copied to clipboard'); }catch(e){ alert('Copy failed'); }
});

$('clearLapsBtn').addEventListener('click', ()=>{ laps=[]; renderLaps(); });

$('exportBtn').addEventListener('click', ()=>{
	if(laps.length === 0) return;
	const csv = 'Lap,Time\n' + laps.map(l=>`${l.id},"${formatTime(l.time)}"`).join('\n');
	const blob = new Blob([csv], {type:'text/csv'});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url; a.download = 'laps.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// Auto-lap support
let autoLapTimer = null;
function setupAutoLap(){
	clearInterval(autoLapTimer);
	const sec = Number($('autoLapInterval').value);
	if(sec > 0){
		autoLapTimer = setInterval(()=>{ if(running) $('lapBtn').click(); }, sec*1000);
	}
}
$('autoLapInterval').addEventListener('change', setupAutoLap);

// Realtime clock
function updateRealtimeClock(){
	const now = new Date();
	$('currentClock').textContent = now.toLocaleTimeString();
}
setInterval(updateRealtimeClock, 1000); updateRealtimeClock();

// Navigation smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(link=>{
  link.addEventListener('click', e=>{
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
  });
});

// Countdown functionality
let cdRemaining = 0; let cdRunning = false; let cdInterval = null;
function parseMMSS(str){ const [mm,ss] = str.split(':'); return (parseInt(mm)||0)*60000 + (parseInt(ss)||0)*1000; }
$('cdInput').addEventListener('keypress', e=>{ if(e.key==='Enter') $('cdStart').click(); });
$('cdStart').addEventListener('click', ()=>{
	const val = $('cdInput').value;
	cdRemaining = parseMMSS(val);
	if(isNaN(cdRemaining) || cdRemaining<=0) return alert('Invalid countdown');
	if(cdRunning) clearInterval(cdInterval);
	cdRunning = true;
	$('cdDisplay').textContent = new Date(cdRemaining).toISOString().substr(14,5);
	cdInterval = setInterval(()=>{
		cdRemaining -= 1000;
		const mmss = new Date(Math.max(0,cdRemaining)).toISOString().substr(14,5);
		$('cdDisplay').textContent = mmss;
		if(cdRemaining<=0){ clearInterval(cdInterval); cdRunning=false; new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg').play(); }
	},1000);
});
$('cdStop').addEventListener('click', ()=>{ clearInterval(cdInterval); cdRunning=false; $('cdDisplay').textContent='00:00' });

// Initialize UI values
updateUI(); setupAutoLap();
// Session start
const sessionStart = Date.now();

// FPS monitor
let fps = 0; let lastFrame = performance.now(); let frames = 0; let fpsLast = performance.now();
function fpsTick(t){
	frames++;
	const diff = t - fpsLast;
	if(diff >= 500){ fps = Math.round((frames/diff)*1000); frames = 0; fpsLast = t; $('fpsDisplay').textContent = fps; }
	requestAnimationFrame(fpsTick);
}
requestAnimationFrame(fpsTick);

// Session uptime updater
setInterval(()=>{
	const ms = Date.now() - sessionStart;
	const hh = String(Math.floor(ms/3600000)).padStart(2,'0');
	const mm = String(Math.floor((ms%3600000)/60000)).padStart(2,'0');
	const ss = String(Math.floor((ms%60000)/1000)).padStart(2,'0');
	$('sessionUptime').textContent = `${hh}:${mm}:${ss}`;
},1000);

// Stats updater
function updateStats(){
	const total = elapsedBefore + (running ? performance.now() - startTime : 0);
	$('totalTime').textContent = formatTime(total);
	$('lapCount').textContent = laps.length;
	if(laps.length>0){
		const times = laps.map(l=>l.time).sort((a,b)=>a-b);
		const best = times[0];
		const avg = Math.round(laps.reduce((s,l)=>s+l.time,0)/laps.length);
		setValueWithPulse('bestLap', formatTime(best));
		setValueWithPulse('avgLap', formatTime(avg));
		const minutes = Math.max(0.001, total/60000);
		const pace = (laps.length / minutes).toFixed(2);
		setValueWithPulse('pace', pace);
	} else {
		['bestLap','avgLap','pace'].forEach(id=>$(id).textContent = '—');
	}
}

function setValueWithPulse(id, val){
	const el = $(id);
	el.textContent = val;
	el.classList.add('updated');
	setTimeout(()=>el.classList.remove('updated'),220);
}

// Hook renderLaps to also update stats
const oldRender = renderLaps;
renderLaps = function(){ oldRender(); updateStats(); };

// wrap oldRender to update nav export state whenever laps render
const prevRender = renderLaps;
renderLaps = function(){ prevRender(); updateExportNavState(); };

// updateStats periodically
setInterval(updateStats,500);

// Theme toggle
const themeSelect = $('themeToggle');
function applyTheme(t){ document.body.classList.remove('theme-dark','theme-neon-purple','theme-synthwave'); document.body.classList.add(t==='neon-purple'?'theme-neon-purple':t==='synthwave'?'theme-synthwave':'theme-dark'); localStorage.setItem('gs_theme', t); }
themeSelect.addEventListener('change', ()=>applyTheme(themeSelect.value));
const savedTheme = localStorage.getItem('gs_theme') || 'dark'; themeSelect.value = savedTheme; applyTheme(savedTheme);

// Reset session button clears laps and resets timers but does not change theme
$('resetSession').addEventListener('click', ()=>{
	$('resetBtn').click(); laps=[]; renderLaps(); elapsedBefore=0; startTime=performance.now();
});

// Notify when best lap achieved
let bestLapSoFar = Infinity;
const audioBest = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
const oldLapClick = $('lapBtn').onclick;
// ensure we detect best lap in lap handler
const originalLapHandler = $('lapBtn').onclick;
// override lap button listener to check best
$('lapBtn').addEventListener('click', ()=>{
	const current = laps.length>0 ? laps[0].time : null;
	if(current !== null && current < bestLapSoFar){ bestLapSoFar = current; audioBest.play().catch(()=>{}); }
});

// Nav export link triggers the existing export button
const downloadLink = $('downloadLink');
if(downloadLink){
	downloadLink.addEventListener('click', e=>{
		e.preventDefault();
		$('exportBtn').click();
	});
}

// Responsive nav toggle
const navToggle = $('navToggle');
const navLinks = document.querySelector('.nav-links');
if(navToggle && navLinks){
	navToggle.addEventListener('click', ()=>{
		const expanded = navToggle.getAttribute('aria-expanded') === 'true';
		navToggle.setAttribute('aria-expanded', String(!expanded));
		navLinks.classList.toggle('active');
	});
}

// Ensure nav export reflects current laps on load
updateExportNavState();
