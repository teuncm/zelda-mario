import './style.css';
import { createWorld, SPAWN, distance, moveEntity, buildFlowField, randomSeed, streamWorld, aimAngle } from './world.js';
import { RockAudio } from './audio.js';
import { SWING_DURATION, SWING_COOLDOWN, MOVE_SPEED, SPRINT_SPEED, strikeAnimals, collectSkulls, swordTier, swordReach, activateFire, burnAnimals, fireActive, fireCooldown, FIRE_COOLDOWN, nuclearBlast, collectHearts, radialBurst, updateProjectiles, RADIAL_THRESHOLD, RADIAL_INTERVAL } from './combat.js';
import { updateEnemies, updateSpawning, SPAWN_INTERVAL, PLAYER_MAX_HEALTH } from './enemies.js';
import { addParticles, explodeAnimal, updateEffects, nuclearEffect } from './effects.js';
import { Renderer } from './renderer.js';

const icons = {
  sound:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2m0 3h.01"/>',
  pause:'<path d="M9 5v14M15 5v14"/>', play:'<path d="m8 5 11 7-11 7Z"/>',
  sword:'<path d="m14 3 7 0 0 7-11 10-6-6L14 3ZM6 18l-3 3m0-9 9 9m2-11 4-4"/>',
  leaf:'<path d="M20 3C8 2 2 9 6 16s15 4 14-13Z"/><path d="m4 21 11-12"/>',
  gem:'<path d="m12 2 7 6-1 9-6 5-6-5-1-9 7-6Z"/><path d="m12 2-3 7 3 13 3-13-3-7ZM5 8h14"/>',
  skull:'<path d="M8 19H6v-5a8 8 0 1 1 12 0v5h-2v3H8v-3Z"/><circle cx="8.5" cy="10" r="2"/><circle cx="15.5" cy="10" r="2"/><path d="m12 13-1.5 3h3L12 13Zm-1 6v3m3-3v3"/>',
  fire:'<path d="M13 2c2 6-4 7-2 11 2-1 3-3 3-5 5 4 7 8 4 12-3 4-11 2-12-2C3 12 7 8 9 6c-1 4 0 6 1 6-1-4 3-6 3-10Z"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.4 7a8 8 0 0 1 13-1L20 9M4 15l1.6 3a8 8 0 0 0 13-1"/>',
};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
document.querySelector('#app').innerHTML=`
  <header class="topbar">
    <a class="brand" href="./" aria-label="Meadowbound home"><span class="brand-mark">${icon('sword')}</span><span>MEADOWBOUND<span class="brand-dot"> /</span></span><span class="edition">BLOOD & THUNDER</span></a>
    <div class="top-actions"><span class="live-dot"></span><span class="world-status">HIT HARD. KEEP MOVING.</span><button class="icon-button" id="help-button" aria-label="How to play">${icon('help')}</button></div>
  </header>
  <main>
    <section class="game-shell" aria-label="Meadowbound adventure">
      <canvas id="game" tabindex="0" aria-label="Procedural isometric grid survival. WASD or arrows move, Shift sprints, hold Space or click to attack. Z casts a fire circle for 2 seconds with a 10 second cooldown. Hostile animals pursue and damage you. Ten skulls unlock a longer sword."></canvas>
      <div class="scene-grain"></div>
      <div class="game-top">
        <div class="location"><span class="eyebrow"><span class="tiny-sun">✦</span> ENDLESS / GRID SURVIVAL</span><h1>Bloodthorn Wilds</h1><span class="location-sub"><span></span> SEED <b id="world-seed"></b> / STREAM / <b id="world-coords"></b></span></div>
        <div class="hud-stack"><div class="player-hud"><div class="skull-count" aria-label="Skulls collected">${icon('skull')}<span id="skull-count">00</span><span class="skull-total">SKULLS</span></div><div class="gem-count">${icon('gem')}<span id="gem-count">00</span><span class="gem-total">GEMS</span></div></div><div class="health-row"><div id="player-health" role="meter" aria-label="Player health" aria-valuemin="0" aria-valuemax="5" aria-valuenow="5"></div><span id="enemy-count">12 HOSTILES</span></div><span id="radial-status" class="overdrive-badge">RADIAL OVERDRIVE / 0 / 100</span></div>
      </div>
      <div class="welcome" id="welcome"><span class="welcome-leaf">${icon('fire')}</span><span>THEY HUNT YOU. Z BURNS THEM. KEEP MOVING.</span><button id="dismiss-welcome" aria-label="Dismiss welcome">×</button></div>
      <div class="scene-tools"><button id="sound-button" class="glass-button" aria-label="Mute music" aria-pressed="false">${icon('sound')}<span>Sound on</span></button><button id="pause-button" class="glass-button square" aria-label="Pause game">${icon('pause')}</button><button id="fullscreen-button" class="glass-button square" aria-label="Enter fullscreen">${icon('expand')}</button><button id="restart-button" class="glass-button square" aria-label="Generate a new world">${icon('refresh')}</button></div>
      <button id="fire-button" class="skill-button" aria-label="Fire circle, Z. Lasts 2 seconds, 10 second cooldown"><kbd>Z</kbd>${icon('fire')}<span><strong id="skill-name">FIRE CIRCLE</strong><small id="fire-status">READY / 2s ACTIVE</small></span><i id="fire-cooldown-fill"></i></button>
      <div class="region-label"><span class="equalizer"><i></i><i></i><i></i><i></i></span> IRON IN THE GRASS <span class="track-tempo">144 BPM / 1:47 LOOP</span></div>
      <div class="minimap"><canvas id="minimap" width="148" height="112" aria-label="World map showing your location"></canvas><span><i></i> BLOODTHORN WILDS</span><b>N</b></div>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
      <div class="mobile-controls" aria-label="Touch controls"><div class="dpad"><button data-key="arrowup" aria-label="Move up">↑</button><button data-key="arrowleft" aria-label="Move left">←</button><button data-key="arrowdown" aria-label="Move down">↓</button><button data-key="arrowright" aria-label="Move right">→</button></div><button id="touch-attack" aria-label="Swing sword">${icon('sword')}</button></div>
      <div class="upgrade-flash" id="upgrade-flash" hidden><span>BLADE EVOLUTION / UNLOCKED</span><strong>THE REAPER</strong><p>EVERY 10 SKULLS / LONGER STEEL / NO LIMIT</p></div>
      <div id="death-transition" class="death-transition" hidden><span>RUN TERMINATED</span><strong>YOU FELL</strong><i></i></div><div class="modal-backdrop" id="overlay" hidden><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><span class="eyebrow">BLOOD & THUNDER / FIELD MANUAL</span><h2 id="modal-title">Make every hit count.</h2><p id="modal-copy">Explore a streamed wilderness. Every ten skulls grows your blade again. Ten fire rings arm a nuclear strike; 100 skulls unlock radial overdrive.</p><div class="help-rows"><div><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> <small>or arrows</small></span><strong>Move</strong></div><div><span><kbd>SHIFT</kbd></span><strong>Sprint</strong></div><div><span><kbd>SPACE</kbd> <small>hold / hold click</small></span><strong>Aim 360° · chain strikes</strong></div><div><span><kbd>Z</kbd>${icon('fire')}</span><strong>Fire circle · 2s / 10s cooldown</strong></div><div><span>${icon('skull')}</span><strong>Every 10 skulls = longer sword</strong></div><div><span><kbd>ESC</kbd></span><strong>Pause</strong></div></div><p class="help-note">Mouse aims in any direction; movement aims when the mouse is away. Hearts restore health. After 10 fire rings, Z detonates a nuclear blast. At 100 skulls, automatic radial shots unlock.</p><button id="resume-button" class="primary-button">INTO THE WILDS <span>↗</span></button></div></div>
    </section>
    <section class="adventure-bar" aria-label="Game controls and progress"><div class="adventure-title"><span class="sword-emblem">${icon('sword')}</span><div><h2 id="blade-name">STANDARD ISSUE</h2><p id="blade-description">Fast steel. Earn your next edge.</p></div></div><div class="control"><div class="key-cluster"><kbd>W</kbd><div><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div></div><span>Move <small>SHIFT TO SPRINT</small></span></div><div class="control"><kbd class="space-key">SPACE <span>⎵</span></kbd><span>Attack <small>HOLD TO CHAIN</small></span></div><div class="collection"><span class="collection-icon">${icon('skull')}</span><div><span class="collection-title" id="collection-title">NEXT BLADE GROWTH</span><div class="progress-track"><i id="progress-fill"></i></div><p id="skull-progress"><span id="skull-progress-count">0 / 10</span> skulls to evolve</p><span id="collected-label" class="sr-only">0 of 30</span></div></div></section>
  </main>
  <footer><span>STEEL. SKULLS. DISTORTION.</span><span class="footer-center">A MARIO × ZELDA INSPIRED ENDLESS SANDBOX</span><span><i></i> THE WILDS ARE OPEN</span></footer>`;

const canvas=document.querySelector('#game');
const requestedSeed=new URLSearchParams(location.search).get('seed');
const world=createWorld(requestedSeed!==null?Number(requestedSeed):randomSeed()), audio=new RockAudio();
const newPlayer=()=>({...SPAWN,facing:1,aimAngle:-Math.PI/4,swingAngle:-Math.PI/4,step:0,moving:false,sprinting:false,attack:0,cooldown:0,attackId:0,skulls:0,health:PLAYER_MAX_HEALTH,invulnerableUntil:1.5,hurtFlash:0,fireEndsAt:0,fireReadyAt:0,fireCasts:0,lastSkill:'fire',nextRadialAt:0});
const player=newPlayer();
const state={player,world,particles:[],projectiles:[],nuclear:null,explosions:[],stains:[],damageNumbers:[],time:0,paused:false,started:false,gameOver:false,deathElapsed:0,gameOverReady:false,collected:0,shake:0,hitStop:0,upgradeTime:0,spawnTimer:SPAWN_INTERVAL,flow:buildFlowField(world,player),nextFlowAt:0};
const renderer=new Renderer(canvas,document.querySelector('#minimap'),state);
const keys=new Set();
let lastTime=performance.now(), toastTimer, welcomeTimer, started=false,pointerAim=false;
function startAudio() { if(!state.started){state.started=true;player.invulnerableUntil=state.time+1.5;}if(!started){started=true;audio.start().catch(()=>{});welcomeTimer=setTimeout(()=>document.querySelector('#welcome').classList.add('dismissed'),6500);} }
function toast(message) { const el=document.querySelector('#toast'); el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2600); }
function particles(x,y,color,count=12,blood=false) {addParticles(state,x,y,color,count,{blood,speed:blood?220:100});}
function resolveHits(hits) {
  for(const {animal,killed,source} of hits) {
    if(source!=='nuclear')audio.hit(killed);particles(animal.x,animal.y,'#ba2831',24,true);particles(animal.x,animal.y,'#ee774a',12,true);
    state.damageNumbers.push({x:animal.x,y:animal.y,life:.65,killed});state.shake=Math.max(state.shake,.09);state.hitStop=.02;
    if(killed){explodeAnimal(state,animal,source);if(source!=='nuclear')audio.explosion();}
    else state.stains.push({x:animal.x,y:animal.y,size:12,life:12});
  }
}
function attack() {
  if(state.paused || player.cooldown>0) return;
  startAudio();player.swingAngle=aimAngle(player);player.attack=SWING_DURATION;player.cooldown=SWING_COOLDOWN;player.attackId++;audio.slash();
  resolveHits(strikeAnimals(world,player,state.time));
}
function castFire() {
  if(state.paused||state.gameOver)return false;
  startAudio();
  if(!activateFire(player,state.time))return false;
  if(player.lastSkill==='nuclear'){resolveHits(nuclearBlast(world,player,state.time));nuclearEffect(state,player);audio.nuclear();toast('NUCLEAR STRIKE / CHARGE RESET');}
  else{audio.fireCast();state.shake=Math.max(state.shake,.1);resolveHits(burnAnimals(world,player,state.time));}
  syncHud();return true;
}
function syncHud() {
  const health=document.querySelector('#player-health');health.setAttribute('aria-valuenow',String(player.health));
  health.innerHTML=Array.from({length:PLAYER_MAX_HEALTH},(_,i)=>`<i class="${i<player.health?'filled':''}"></i>`).join('');
  document.querySelector('#world-seed').textContent=world.seed.toString(16).toUpperCase().padStart(8,'0');
  document.querySelector('#world-coords').textContent=world.centerChunk;
  document.querySelector('#enemy-count').textContent=`${world.animals.filter(a=>!a.dead).length} HOSTILES`;
  const active=fireActive(player,state.time),cooldown=fireCooldown(player,state.time),button=document.querySelector('#fire-button');
  button.disabled=state.gameOver||cooldown>0;button.classList.toggle('active',active);button.classList.toggle('cooling',cooldown>0&&!active);
  const armed=player.fireCasts>=10;
  document.querySelector('#skill-name').textContent=armed?'NUCLEAR STRIKE':'FIRE CIRCLE';button.classList.toggle('nuclear-ready',armed);
  document.querySelector('#fire-status').textContent=active?`BURN ${(player.fireEndsAt-state.time).toFixed(1)}s / ${player.fireCasts}/10`:cooldown>0?`${cooldown.toFixed(1)}s / ${armed?'NUKE NEXT':`${player.fireCasts}/10 CHARGE`}`:armed?'ARMED / PRESS Z':`READY / ${player.fireCasts}/10 CHARGE`;
  document.querySelector('#radial-status').textContent=player.skulls>=100?'✦ RADIAL OVERDRIVE ACTIVE':`RADIAL OVERDRIVE / ${player.skulls} / 100`;
  document.querySelector('#radial-status').classList.toggle('unlocked',player.skulls>=100);
  const tier=swordTier(player);document.querySelector('#blade-name').textContent=tier===0?'STANDARD ISSUE':tier===1?'THE REAPER':`REAPER LV.${tier}`;
  document.querySelector('#blade-description').textContent=`${swordReach(player)} REACH / ${player.skulls>=100?'RADIAL ACTIVE':'GROWS EVERY 10 SKULLS'}`;
  document.querySelector('#progress-fill').style.width=`${player.skulls%10*10}%`;
  document.querySelector('#skull-progress').textContent=`${player.skulls} / ${(tier+1)*10} skulls · NEXT GROWTH`;
  document.querySelector('#fire-cooldown-fill').style.width=`${cooldown/FIRE_COOLDOWN*100}%`;
}
function restart(seed=randomSeed()) {
  Object.assign(world,createWorld(seed));Object.assign(player,newPlayer());
  Object.assign(state,{particles:[],projectiles:[],nuclear:null,explosions:[],stains:[],damageNumbers:[],time:0,started:true,gameOver:false,deathElapsed:0,gameOverReady:false,collected:0,shake:0,hitStop:0,upgradeTime:0,spawnTimer:SPAWN_INTERVAL,flow:buildFlowField(world,player),nextFlowAt:0});
  pointerAim=false;document.querySelector('.game-shell').classList.remove('dying');document.querySelector('#death-transition').hidden=true;
  document.querySelector('#skull-count').textContent='00';document.querySelector('#gem-count').textContent='00';
  document.querySelector('#blade-name').textContent='STANDARD ISSUE';document.querySelector('#blade-description').textContent='Fast steel. Earn your next edge.';
  document.querySelector('#collection-title').textContent='NEXT BLADE GROWTH';document.querySelector('#skull-progress').innerHTML='<span id="skull-progress-count">0 / 10</span> skulls to evolve';
  document.querySelector('#progress-fill').style.width='0%';document.querySelector('#collected-label').textContent='0 of 30';document.querySelector('.sword-emblem').classList.remove('evolved');
  document.querySelector('#upgrade-flash').hidden=true;document.querySelector('#toast').classList.remove('visible');clearTimeout(toastTimer);
  renderer.rebuildWorld();setPaused(false);syncHud();
}
function setPaused(paused,help=false) {
  if(state.gameOver&&!state.gameOverReady)return;
  state.paused=paused;keys.clear();
  document.querySelector('.game-shell').classList.toggle('is-paused',paused);
  document.querySelector('#overlay').hidden=!paused;
  document.querySelector('#modal-title').textContent=state.gameOver?'YOU FELL.':help?'Make every hit count.':'HOLD FIRE.';
  document.querySelector('#modal-copy').textContent=state.gameOver?`${player.skulls} skulls claimed. The wilds won this round. Generate a new battlefield and go again.`:'Explore a streamed wilderness. Every ten skulls grows your blade again. Ten fire rings arm a nuclear strike; 100 skulls unlock radial overdrive.';
  document.querySelector('.help-rows').hidden=state.gameOver;
  document.querySelector('#resume-button').innerHTML=state.gameOver?'NEW WORLD / RETRY <span>↗</span>':help?'INTO THE WILDS <span>↗</span>':'BACK TO THE FIGHT <span>↗</span>';
  document.querySelector('#pause-button').innerHTML=icon(paused?'play':'pause');
  document.querySelector('#pause-button').setAttribute('aria-label',paused?'Resume game':'Pause game');
  if(paused) {audio.pause();document.querySelector('#resume-button').focus();}
  else {if(started)audio.start().catch(()=>{});canvas.focus();}
}
window.addEventListener('keydown',event=>{
  if(event.key==='Escape') {event.preventDefault();if(state.gameOver)return;startAudio();setPaused(!state.paused);return;}
  if(state.paused) {
    if(event.key==='Tab') {event.preventDefault();document.querySelector('#resume-button').focus();}
    return;
  }
  if(event.target.closest('button,a') && (event.key===' ' || event.key==='Enter')) return;
  const key=event.key.toLowerCase();
  if(key==='z'){event.preventDefault();if(!event.repeat)castFire();return;}
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift'].includes(key)) {event.preventDefault();startAudio();keys.add(key);if(key===' ' && !event.repeat)attack();}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();if(started&&!state.paused)setPaused(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!state.paused)setPaused(true);});
function aimAtPointer(e){if(state.paused||state.gameOver)return;const rect=canvas.getBoundingClientRect(),point=renderer.screenToWorld(e.clientX-rect.left,e.clientY-rect.top+25*renderer.zoom);player.aimAngle=Math.atan2(point.y-player.y,point.x-player.x);player.facing=Math.cos(player.aimAngle)-Math.sin(player.aimAngle)<0?-1:1;pointerAim=e.pointerType!=='touch';}
canvas.addEventListener('pointermove',aimAtPointer);canvas.addEventListener('pointerleave',()=>pointerAim=false);
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;aimAtPointer(e);canvas.focus();startAudio();keys.add('attack');canvas.setPointerCapture(e.pointerId);attack();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>keys.delete('attack'));
document.querySelector('#sound-button').addEventListener('click',()=>{
  const enabled=!audio.enabled;audio.setEnabled(enabled);started=true;
  document.querySelector('.game-shell').classList.toggle('sound-muted',!enabled);
  const button=document.querySelector('#sound-button');button.innerHTML=icon(enabled?'sound':'muted')+`<span>Sound ${enabled?'on':'off'}</span>`;
  button.setAttribute('aria-label',enabled?'Mute music':'Enable music');button.setAttribute('aria-pressed',String(!enabled));
  if(state.paused)audio.pause();
});
document.querySelector('#help-button').addEventListener('click',()=>setPaused(true,true));
document.querySelector('#pause-button').addEventListener('click',()=>setPaused(!state.paused));
document.querySelector('#resume-button').addEventListener('click',()=>{startAudio();if(state.gameOver)restart();else setPaused(false);});
document.querySelector('#restart-button').addEventListener('click',()=>{startAudio();restart();});
document.querySelector('#fire-button').addEventListener('click',()=>{castFire();canvas.focus();});
document.querySelector('#dismiss-welcome').addEventListener('click',()=>{clearTimeout(welcomeTimer);document.querySelector('#welcome').classList.add('dismissed');});
document.querySelector('#fullscreen-button').addEventListener('click',async()=>{
  try { if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.game-shell').requestFullscreen(); }
  catch {toast('Fullscreen isn’t available in this browser.');}
});
document.querySelectorAll('[data-key]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{e.preventDefault();startAudio();keys.add(button.dataset.key);button.setPointerCapture(e.pointerId);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.key));
});
const touchAttack=document.querySelector('#touch-attack');
touchAttack.addEventListener('pointerdown',e=>{e.preventDefault();keys.add('attack');touchAttack.setPointerCapture(e.pointerId);attack();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])touchAttack.addEventListener(event,()=>keys.delete('attack'));
function update(dt) {
  if(state.gameOver){if(!state.gameOverReady){state.deathElapsed+=dt;state.time+=dt;state.shake=Math.max(0,state.shake-dt);updateEffects(state,dt);if(state.deathElapsed>=2.2){state.gameOverReady=true;document.querySelector('#death-transition').hidden=true;setPaused(true);}}return;}
  state.hitStop=Math.max(0,state.hitStop-dt);
  state.time+=dt;
  state.shake=Math.max(0,state.shake-dt);state.upgradeTime=Math.max(0,state.upgradeTime-dt);
  document.querySelector('#upgrade-flash').hidden=state.upgradeTime===0;
  if(!state.started){updateEffects(state,dt);syncHud();return;}
  player.hurtFlash=Math.max(0,player.hurtFlash-dt);
  player.cooldown=Math.max(0,player.cooldown-dt);
  if(keys.has(' ')||keys.has('attack'))attack();
  const sx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
  const sy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
  let dx=sx/.866+sy,dy=sy-sx/.866,len=Math.hypot(dx,dy);
  player.moving=len>0;player.sprinting=keys.has('shift');player.attack=Math.max(0,player.attack-dt);
  if(len) {
    if(!pointerAim)player.aimAngle=Math.atan2(dy,dx);
    const speed=player.sprinting?SPRINT_SPEED:MOVE_SPEED;
    dx=dx/len*speed*dt;dy=dy/len*speed*dt;
    if(state.hitStop<=0)moveEntity(player,dx,dy,world);
    if(sx)player.facing=sx;player.step+=dt*(player.sprinting?21:17);
  }
  if(streamWorld(world,player))state.nextFlowAt=0;
  resolveHits(burnAnimals(world,player,state.time));
  if(state.time>=state.nextFlowAt){state.flow=buildFlowField(world,player);state.nextFlowAt=state.time+.2;}
  state.spawnTimer=updateSpawning(world,player,dt,state.spawnTimer);
  if(player.skulls>=RADIAL_THRESHOLD&&state.time>=player.nextRadialAt){state.projectiles.push(...radialBurst(player,state.time));player.nextRadialAt=state.time+RADIAL_INTERVAL;audio.radial();}
  const shots=updateProjectiles(world,player,state.projectiles,dt,state.time);state.projectiles=shots.projectiles;resolveHits(shots.hits);
  const combat=updateEnemies(world,player,state.flow,dt,state.time);
  if(combat.playerHit){audio.playerHit();particles(player.x,player.y,'#e45337',12,true);state.shake=Math.max(state.shake,.16);}
  if(combat.dead){state.gameOver=true;state.deathElapsed=0;state.gameOverReady=false;player.fireEndsAt=0;keys.clear();document.querySelector('.game-shell').classList.add('dying');document.querySelector('#death-transition').hidden=false;audio.gameOver();particles(player.x,player.y,'#e6976b',60);syncHud();return;}
  world.animals=world.animals.filter(a=>!a.dead||a.deathTimer>0);
  world.gems.forEach(g=>{
    if(!g.collected && distance(g,player)<32) {
      g.collected=true;world.collectedPickups.add(g.id);state.collected++;audio.pickup();particles(g.x,g.y,'#d8fff1',18);
      document.querySelector('#gem-count').textContent=String(state.collected).padStart(2,'0');
      document.querySelector('#collected-label').textContent=`${state.collected} GEMS`;
    }
  });
  const healed=collectHearts(world,player,PLAYER_MAX_HEALTH);
  if(healed.length){audio.heal();for(const h of healed)particles(h.x,h.y,'#f28f99',20);toast(`HEALTH RESTORED / ${player.health} / ${PLAYER_MAX_HEALTH}`);}
  const drops=collectSkulls(world,player,state.time);
  if(drops.collected.length) {
    audio.skull();for(const skull of drops.collected)particles(skull.x,skull.y,'#eecf91',18);
    document.querySelector('#skull-count').textContent=String(player.skulls).padStart(2,'0');
    document.querySelector('#progress-fill').style.width=`${Math.min(player.skulls/10,1)*100}%`;
    const progressCount=document.querySelector('#skull-progress-count');
    if(progressCount)progressCount.textContent=`${Math.min(player.skulls,10)} / 10`;
    if(drops.upgraded) {
      audio.upgrade();state.upgradeTime=2;state.shake=.22;
      document.querySelector('#upgrade-flash').hidden=false;
      document.querySelector('#upgrade-flash strong').textContent=drops.radialUnlocked?'RADIAL OVERDRIVE':`BLADE LEVEL ${swordTier(player)}`;
      document.querySelector('#upgrade-flash p').textContent=drops.radialUnlocked?'100 SKULLS / AUTOMATIC 360° BURSTS':`${swordReach(player)} REACH / NEXT GROWTH AT ${(swordTier(player)+1)*10} SKULLS`;
      document.querySelector('.sword-emblem').classList.add('evolved');
    } else toast(`SKULL CLAIMED / ${player.skulls} TOTAL / ${10-player.skulls%10} TO NEXT GROWTH`);
  }
  updateEffects(state,dt);syncHud();
}
function frame(now) {const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;if(!state.paused)update(dt);renderer.draw();requestAnimationFrame(frame);}
new ResizeObserver(()=>renderer.resize()).observe(canvas);
renderer.resize();syncHud();requestAnimationFrame(frame);

// Module exports also let integration checks drive the same live game simulation.
export { state, attack, update, castFire, restart, audio, renderer };
