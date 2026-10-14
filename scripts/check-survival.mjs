import assert from 'node:assert/strict';

export async function runGameChecks({ send, evaluate, delay, screenshot, waitFor }) {
  await send('Page.navigate',{url:'http://127.0.0.1:5173/?seed=42'});await delay(1500);
  assert.equal(await evaluate('document.title'),'Meadowbound — Blood & Thunder');
  assert.equal(await evaluate('document.querySelector("#game").width'),1366);
  await screenshot('desktop.png');
  await evaluate(`(async()=>{
    window.qa=await import(document.querySelector('script[type="module"][src*="/src/main.js"]').src);
    window.worldTools=await import('/src/world.js');window.combatTools=await import('/src/combat.js');
    window.audioCalls={hit:0,explosion:0,fireCast:0,playerHit:0,nuclear:0,gameOver:0,heal:0,radial:0};
    for(const name of Object.keys(audioCalls)){const original=qa.audio[name].bind(qa.audio);qa.audio[name]=(...args)=>{audioCalls[name]++;return original(...args);};}
    window.__qaAudioContexts=new Set();const original=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(){window.__qaAudioContexts.add(this);return original.call(this);};
    qa.state.world.animals=[];qa.state.spawnTimer=1000;
    document.querySelector('#dismiss-welcome').click();
  })()`);
  assert.equal(await evaluate('qa.state.player.health'),5,'No attacks before the first interaction');
  assert.equal(await evaluate('qa.state.world.seed'),42);
  const key=async(key,code,ms)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code});await delay(ms);await send('Input.dispatchKeyEvent',{type:'keyUp',key,code});};
  const before=await evaluate('qa.state.player.x');await key('d','KeyD',180);
  assert(await evaluate('qa.state.player.x')>before+20,'Keyboard movement advances across tiles');
  await evaluate('Object.assign(qa.state.player,qa.state.world.gems[0]);');await delay(80);
  assert(await evaluate('Number(document.querySelector("#gem-count").textContent)')>=1,'Gems remain collectible');
  assert.equal(await evaluate('qa.audio.ctx.state'),'running');

  // Real input damages a controlled enemy in the open center of the generated map.
  await evaluate(`{const {state}=qa;Object.assign(state.player,worldTools.SPAWN,{facing:1,cooldown:0,invulnerableUntil:state.time+100});
    window.target=worldTools.createAnimal('cow',900,state.player.x+40,state.player.y-20,0);state.world.animals=[target];}`);
  await key(' ','Space',45);
  assert.equal(await evaluate('target.health'),2);assert(await evaluate('qa.state.particles.some(p=>p.blood)'));
  assert(await evaluate('audioCalls.hit')>0,'Hit sound invoked by actual combat');await screenshot('combat.png');
  await evaluate(`for(let i=0;i<2;i++){Object.assign(target,{x:qa.state.player.x+40,y:qa.state.player.y-20});qa.state.player.cooldown=0;qa.attack();}`);
  assert(await evaluate('target.dead'));assert.equal(await evaluate('qa.state.world.skulls.length'),1);
  assert(await evaluate('qa.state.particles.length')>250);assert(await evaluate('qa.state.explosions.length')>=4);
  assert(await evaluate('audioCalls.explosion')>0);await screenshot('explosion.png');
  await evaluate(`{const skull=qa.state.world.skulls[0];Object.assign(qa.state.player,{x:skull.x,y:skull.y});qa.update(.5);}`);
  assert.equal(await evaluate('document.querySelector("#skull-count").textContent'),'01');
  await evaluate(`{const {state,update}=qa;for(let i=0;i<8;i++)state.world.skulls.push({id:1000+i,x:state.player.x,y:state.player.y,bornAt:state.time-1,collected:false});update(.02);}`);
  assert.equal(await evaluate('qa.state.player.skulls'),9);
  await evaluate(`{const {state}=qa;window.target=worldTools.createAnimal('sheep',901,state.player.x+30,state.player.y,0);target.health=1;state.world.animals=[target];state.player.cooldown=0;qa.attack();Object.assign(state.player,{x:target.x,y:target.y});qa.update(.5);}`);
  assert.equal(await evaluate('document.querySelector("#blade-name").textContent'),'THE REAPER');
  assert.equal(await evaluate('combatTools.swordReach(qa.state.player)'),165);
  await screenshot('reaper-upgrade.png');
  const swings=await evaluate('qa.state.player.attackId');await key(' ','Space',750);
  assert(await evaluate('qa.state.player.attackId')>=swings+3);

  // Z applies radial damage and knockback, follows the player, and obeys exact timers.
  await evaluate(`{const {state}=qa;Object.assign(state.player,worldTools.SPAWN,{health:5,invulnerableUntil:0,fireEndsAt:0,fireReadyAt:0});
    state.world.animals=[worldTools.createAnimal('cow',910,state.player.x+100,state.player.y,0),worldTools.createAnimal('dog',911,state.player.x-80,state.player.y,0)];}`);
  await key('z','KeyZ',30);
  assert(await evaluate('combatTools.fireActive(qa.state.player,qa.state.time)'));
  assert(await evaluate('qa.state.world.animals.every(a=>a.health<a.maxHealth)'));
  assert.equal(await evaluate('qa.state.player.health'),5,'Ring repels close attackers');
  assert.equal(await evaluate('qa.castFire()'),false,'Cannot recast during cooldown');
  assert.equal(await evaluate('document.querySelector("#fire-button").disabled'),true);
  assert.equal(await evaluate('audioCalls.fireCast'),1);await screenshot('fire-circle.png');
  const ringEnd=await evaluate('qa.state.player.fireEndsAt'),ringX=await evaluate('qa.state.player.x');
  await key('d','KeyD',130);assert(await evaluate('qa.state.player.x')>ringX);
  assert.equal(await evaluate('qa.state.player.fireEndsAt'),ringEnd);
  assert(await evaluate(`(()=>{const {state}=qa;state.world.animals=[];state.time=state.player.fireEndsAt-.02;qa.update(.01);return combatTools.fireActive(state.player,state.time);})()`));
  await evaluate('qa.update(.03)');assert.equal(await evaluate('combatTools.fireActive(qa.state.player,qa.state.time)'),false);
  assert.equal(await evaluate('document.querySelector("#fire-button").disabled'),true);
  assert.equal(await evaluate('(()=>{qa.state.time=qa.state.player.fireReadyAt-.02;qa.update(.01);return document.querySelector("#fire-button").disabled;})()'),true);
  await evaluate('qa.update(.02)');assert.equal(await evaluate('document.querySelector("#fire-button").disabled'),false);
  await key('z','KeyZ',20);assert.equal(await evaluate('audioCalls.fireCast'),2,'Ready again after ten seconds');

  await evaluate(`{const {state}=qa;state.world.animals=[];while(state.player.fireCasts<10){state.time=state.player.fireReadyAt;qa.castFire();}state.time=state.player.fireReadyAt;qa.update(.001);
    window.blastTargets=[worldTools.createAnimal('cow',940,state.player.x+200,state.player.y,0),worldTools.createAnimal('dog',941,state.player.x-400,state.player.y,.5),worldTools.createAnimal('sheep',942,state.player.x+1000,state.player.y,0)];state.world.animals=blastTargets;}`);
  assert.equal(await evaluate('document.querySelector("#skill-name").textContent'),'NUCLEAR STRIKE');
  await key('z','KeyZ',20);assert.equal(await evaluate('audioCalls.nuclear'),1);assert(await evaluate('blastTargets[0].dead&&blastTargets[1].dead&&!blastTargets[2].dead'));
  assert.equal(await evaluate('qa.state.player.fireCasts'),0);assert(await evaluate('!!qa.state.nuclear'));await screenshot('nuclear.png');

  // A real pickup path heals, and every growth threshold keeps increasing the weapon.
  await evaluate(`{const {state}=qa;state.world.animals=[];state.player.health=3;state.world.hearts=[{x:state.player.x,y:state.player.y,id:'h:qa',collected:false}];qa.update(.01);}`);
  assert.equal(await evaluate('qa.state.player.health'),4);assert.equal(await evaluate('audioCalls.heal'),1);
  await evaluate(`{const {state}=qa;state.world.skulls=[{x:state.player.x,y:state.player.y,id:950,bornAt:state.time-1,collected:false}];state.player.skulls=19;qa.update(.01);}`);
  assert.equal(await evaluate('combatTools.swordReach(qa.state.player)'),230);
  await evaluate(`{const {state}=qa;state.world.skulls=[{x:state.player.x,y:state.player.y,id:951,bornAt:state.time-1,collected:false}];state.player.skulls=99;qa.update(.01);state.player.nextRadialAt=0;qa.update(.02);}`);
  assert.equal(await evaluate('qa.state.player.skulls'),100);assert(await evaluate('qa.state.projectiles.length')>0);assert(await evaluate('audioCalls.radial')>0);
  assert.match(await evaluate('document.querySelector("#radial-status").textContent'),/ACTIVE/);await screenshot('radial-overdrive.png');

  // Check continuous mouse aiming and actual sword damage on all eight compass headings.
  await evaluate('qa.restart(42);qa.state.spawnTimer=1000;qa.state.world.animals=[];qa.state.player.invulnerableUntil=1000;');await delay(250);
  for(let i=0;i<8;i++){
    const angle=i/8*Math.PI*2;
    const pointer=await evaluate(`(()=>{const p=qa.state.player;window.target=worldTools.createAnimal('cow',960+${i},p.x+Math.cos(${angle})*65,p.y+Math.sin(${angle})*65,0);qa.state.world.animals=[target];p.cooldown=0;const point=worldTools.iso(target.x,target.y),rect=document.querySelector('#game').getBoundingClientRect();return{x:rect.left+qa.renderer.width/2+(point.x-qa.renderer.camera.x)*qa.renderer.zoom,y:rect.top+qa.renderer.height*.55+(point.y-qa.renderer.camera.y)*qa.renderer.zoom-25*qa.renderer.zoom};})()`);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:pointer.x,y:pointer.y});await key(' ','Space',35);
    assert.equal(await evaluate('target.health'),2,`Sword reaches compass heading ${i}`);
  }
  await screenshot('directional-sword.png');
  await evaluate(`{const p=worldTools.cellCenter(16000,-16000);Object.assign(qa.state.player,p);qa.state.world.animals=[];qa.update(.01);qa.renderer.camera=worldTools.iso(p.x,p.y);}`);await delay(100);
  assert.equal(await evaluate('qa.state.world.chunks.size'),49);assert(await evaluate('qa.renderer.terrainCache.size')<=24);assert.match(await evaluate('qa.state.world.centerChunk'),/2000,-2000/);await screenshot('distant-world.png');

  // Restore a new seeded simulation, then verify chase, spawns, health and death/retry.
  const oldTerrain=await evaluate('JSON.stringify(qa.state.world.tiles.map(t=>t.type))');
  await evaluate('qa.restart(43);qa.state.spawnTimer=1000;qa.state.world.animals=[];');
  assert.notEqual(await evaluate('JSON.stringify(qa.state.world.tiles.map(t=>t.type))'),oldTerrain);
  assert.equal(await evaluate('qa.state.world.seed'),43);
  await evaluate(`{const {state}=qa;state.player.invulnerableUntil=state.time+100;window.target=worldTools.createAnimal('dog',920,state.player.x+180,state.player.y,0);state.world.animals=[target];for(let i=0;i<120;i++)qa.update(1/60);}`);
  assert(await evaluate('worldTools.distance(target,qa.state.player)')<50,'Hostile actually pursues the hero');
  await evaluate('qa.state.spawnTimer=.01;qa.update(.02)');
  assert.equal(await evaluate('qa.state.world.animals.length'),4);assert.equal(await evaluate('qa.state.world.animals.filter(a=>a.spawnDelay>0).length'),3);
  await evaluate(`{const {state}=qa;Object.assign(target,{x:state.player.x+15,y:state.player.y,stun:0});Object.assign(state.player,{health:5,invulnerableUntil:0,fireEndsAt:0});state.world.animals=[target];qa.update(.02);}`);
  assert.equal(await evaluate('qa.state.player.health'),4);assert(await evaluate('audioCalls.playerHit')>0);
  assert.equal(await evaluate('document.querySelector("#player-health").getAttribute("aria-valuenow")'),'4');
  await evaluate('qa.update(.02)');assert.equal(await evaluate('qa.state.player.health'),4,'Invulnerability limits contact damage');
  await evaluate(`Object.assign(target,{x:qa.state.player.x+12,y:qa.state.player.y});Object.assign(qa.state.player,{health:1,invulnerableUntil:0});qa.update(.02);`);
  assert(await evaluate('qa.state.gameOver'));assert.equal(await evaluate('audioCalls.gameOver'),1);
  assert.equal(await evaluate('document.querySelector("#death-transition").hidden'),false);await delay(400);await screenshot('game-over-transition.png');
  await waitFor('qa.state.gameOverReady');assert.equal(await evaluate('document.querySelector("#modal-title").textContent'),'YOU FELL.');
  await screenshot('game-over.png');await key('Escape','Escape',10);assert(await evaluate('qa.state.paused'));
  await evaluate('document.querySelector("#resume-button").click()');assert.equal(await evaluate('qa.state.player.health'),5);
  assert.equal(await evaluate('qa.state.gameOver'),false);assert.equal(await evaluate('document.querySelector("#overlay").hidden'),true);
  const retrySeed=await evaluate('qa.state.world.seed');await evaluate('document.querySelector("#restart-button").click()');
  assert.notEqual(await evaluate('qa.state.world.seed'),retrySeed,'New-world button rerolls terrain');
  await evaluate('qa.state.world.animals=[];qa.state.spawnTimer=1000;');

  await evaluate('document.querySelector("#pause-button").click()');
  await waitFor('qa.audio.ctx.state==="suspended"');
  const paused=await evaluate('document.querySelector("#game").toDataURL()');await delay(400);
  assert.equal(await evaluate('document.querySelector("#game").toDataURL()'),paused,'Pause freezes scene and cooldowns');
  await evaluate('document.querySelector("#resume-button").click()');assert.equal(await evaluate('document.activeElement.id'),'game');
  await evaluate('document.querySelector("#sound-button").click()');await waitFor('qa.audio.ctx.state==="suspended"');
  await evaluate('document.querySelector("#sound-button").click()');await waitFor('qa.audio.ctx.state==="running"');
  await evaluate('document.querySelector("#help-button").click()');await screenshot('help.png');
  assert.match(await evaluate('document.querySelector(".help-rows").textContent'),/Fire circle/);
  await evaluate('document.querySelector("#resume-button").click()');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await delay(250);
  assert.equal(await evaluate('document.documentElement.scrollWidth'),390);await screenshot('mobile.png');
  await evaluate('document.querySelector("#fire-button").click()');assert(await evaluate('combatTools.fireActive(qa.state.player,qa.state.time)'));
  await screenshot('mobile-fire.png');assert.equal(await evaluate('window.__qaAudioContexts.size'),1);

  const audioRender=await evaluate(`(async()=>{
    const {RockAudio}=await import('/src/audio.js');const {STEP_DURATION}=await import('/src/score.js');
    async function render(effects){const rock=new RockAudio();rock.ctx=new OfflineAudioContext(2,22050*(effects?3:9),22050);rock.setupGraph();
      if(effects){rock.hit();rock.explosion();rock.fireCast();rock.playerHit();rock.nuclear();rock.heal();rock.radial();rock.gameOver();}else for(let i=0;i<80;i++)rock.playStep(i+320,.02+i*STEP_DURATION);
      const buffer=await rock.ctx.startRendering();let sum=0,peak=0,finite=true;for(const sample of buffer.getChannelData(0)){finite&&=Number.isFinite(sample);sum+=sample*sample;peak=Math.max(peak,Math.abs(sample));}
      return {rms:Math.sqrt(sum/buffer.length),peak,finite};}
    return {music:await render(false),combat:await render(true)};
  })()`);
  for(const result of Object.values(audioRender))assert(result.finite&&result.rms>.01&&result.peak<=1,'Music and combat effects render audibly without clipping');
  return {passed:true,audioRender,checks:['streaming and bounded chunk/cache counts','eight-direction mouse aiming and sword damage','healing heart pickup','repeating blade growth','100-skull radial overdrive','ten-ring nuclear cycle and kills','spectacular deaths and sound','Z duration and cooldown','hostile chase and spawning','health and invulnerability','game-over transition and sound','retry and reset','pause and audio controls','mobile layout and touch skill','offline music and all effect renders']};
}
