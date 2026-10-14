import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createAnimal, SPAWN, buildFlowField, distance, canMove } from '../src/world.js';
import { activateFire, fireActive, fireCooldown, burnAnimals, FIRE_DURATION, FIRE_COOLDOWN } from '../src/combat.js';
import { updateEnemies, updateSpawning, MAX_ENEMIES, SPAWN_INTERVAL } from '../src/enemies.js';
import { explodeAnimal, updateEffects } from '../src/effects.js';

const hero=()=>({...SPAWN,health:5,invulnerableUntil:0,hurtFlash:0});
test('fire lasts exactly two seconds and becomes ready ten seconds after activation',()=>{
  const player=hero();assert(activateFire(player,5));
  assert.equal(FIRE_DURATION,2);assert.equal(FIRE_COOLDOWN,10);
  assert(fireActive(player,5));assert(fireActive(player,6.999));assert(!fireActive(player,7));
  assert.equal(fireCooldown(player,7),8);assert(!activateFire(player,14.999));assert(activateFire(player,15));
  player.health=0;assert(!activateFire(player,30));
});
test('fire damages enemies around the hero, enforces burn ticks, and drops one skull per kill',()=>{
  const world=createWorld(),player=hero();
  world.animals=[createAnimal('sheep',90,player.x-50,player.y,0),createAnimal('cow',91,player.x+50,player.y,0),createAnimal('dog',92,player.x+200,player.y,0)];
  activateFire(player,0);
  assert.equal(burnAnimals(world,player,0).length,2);
  assert.equal(burnAnimals(world,player,.1).length,0);
  assert.equal(burnAnimals(world,player,.36).filter(h=>h.killed).length,1);
  assert.equal(burnAnimals(world,player,.72).filter(h=>h.killed).length,1);
  assert.equal(burnAnimals(world,player,1.1).length,0);assert.equal(world.skulls.length,2);
  assert.equal(world.animals[2].health,2);assert.equal(burnAnimals(world,player,2).length,0);
});
test('hostiles navigate a generated grid toward the player without crossing blocked tiles',()=>{
  for(const seed of [1,42,12345]) {
    const world=createWorld(seed),player={...hero(),invulnerableUntil:1000},flow=buildFlowField(world,SPAWN);
    const enemy=world.animals.find(a=>a.type==='dog');enemy.spawnDelay=0;world.animals=[enemy];
    const before=distance(enemy,player);
    for(let i=0;i<60*25;i++){updateEnemies(world,player,flow,1/60,i/60);assert(canMove(enemy.x,enemy.y,world));}
    assert(distance(enemy,player)<40,`seed ${seed}: enemy must reach hero from ${before}, got ${distance(enemy,player)}`);
  }
});
test('hostile contact damages health, respects invulnerability, and can kill the player',()=>{
  const world=createWorld(),player=hero(),enemy=createAnimal('dog',90,player.x+20,player.y,0);world.animals=[enemy];
  const flow=buildFlowField(world,player);
  assert(updateEnemies(world,player,flow,.01,1).playerHit);assert.equal(player.health,4);
  Object.assign(enemy,{x:player.x+10,y:player.y});updateEnemies(world,player,flow,.01,1.1);assert.equal(player.health,4);
  player.health=1;Object.assign(enemy,{x:player.x+10,y:player.y});
  assert(updateEnemies(world,player,flow,.01,2).dead);assert.equal(player.health,0);
});
test('an active fire ring repels a contact-range hostile before it can bite',()=>{
  const world=createWorld(),player=hero(),enemy=createAnimal('cow',90,player.x+25,player.y,0);world.animals=[enemy];
  activateFire(player,0);burnAnimals(world,player,0);
  const result=updateEnemies(world,player,buildFlowField(world,player),.04,.04);
  assert(!result.playerHit);assert.equal(player.health,5);assert(distance(enemy,player)>25);
});
test('spawn waves replenish hostiles while enforcing the active enemy cap',()=>{
  const world=createWorld();
  const count=world.animals.length;const timer=updateSpawning(world,SPAWN,SPAWN_INTERVAL,SPAWN_INTERVAL);
  assert.equal(world.animals.length,count+3);assert.equal(timer,SPAWN_INTERVAL);
  for(let i=0;i<20;i++)updateSpawning(world,SPAWN,SPAWN_INTERVAL,0);
  assert.equal(world.animals.filter(a=>!a.dead).length,MAX_ENEMIES);
  world.animals[0].dead=true;updateSpawning(world,SPAWN,1,0);
  assert.equal(world.animals.filter(a=>!a.dead).length,MAX_ENEMIES);
});
test('explosive deaths create shockwaves, many particles, debris, and clean up over time',()=>{
  const state={particles:[],explosions:[],stains:[],damageNumbers:[],shake:0,hitStop:0};
  explodeAnimal(state,{...SPAWN,id:1},'sword');
  assert(state.particles.length>250);assert(state.explosions.length>=4);
  assert(state.particles.some(p=>p.glow));assert(state.particles.some(p=>p.blood));assert(state.particles.some(p=>p.chunk));
  assert(state.shake>0);
  for(let i=0;i<100;i++)explodeAnimal(state,{...SPAWN,id:i},'fire');assert(state.particles.length<=2400);
  updateEffects(state,20);assert.equal(state.particles.length,0);assert.equal(state.explosions.length,0);assert.equal(state.stains.length,0);
});
