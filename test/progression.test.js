import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,createAnimal,SPAWN,canMove} from '../src/world.js';
import {swordTier,swordReach,bladeLength,collectSkulls,activateFire,nuclearBlast,NUCLEAR_RADIUS,collectHearts,radialBurst,updateProjectiles} from '../src/combat.js';

test('every ten skulls increases sword length and reach without a progression cap',()=>{
  for(const tier of [0,1,2,9,10,100,10000]){const p={skulls:tier*10};assert.equal(swordTier(p),tier);assert.equal(swordReach(p),100+tier*65);assert.equal(bladeLength(p),52+tier*40);assert(swordReach({skulls:(tier+1)*10})>swordReach(p));}
  const world=createWorld(),p={...SPAWN,skulls:19};world.skulls=[{...SPAWN,id:1,bornAt:0,collected:false}];assert(collectSkulls(world,p,1).upgraded);assert.equal(swordTier(p),2);
  world.skulls.push({...SPAWN,id:2,bornAt:0,collected:false});p.skulls=99;assert(collectSkulls(world,p,2).radialUnlocked);assert.equal(p.skulls,100);
});
test('ten successful fire casts arm the eleventh activation as a nuclear blast and reset the cycle',()=>{
  const p={health:5};for(let cycle=0;cycle<2;cycle++){
    for(let i=0;i<10;i++){const time=cycle*110+i*10;assert(activateFire(p,time));assert.equal(p.lastSkill,'fire');assert.equal(p.fireCasts,i+1);assert(!activateFire(p,time+1));assert.equal(p.fireCasts,i+1);}
    assert(activateFire(p,cycle*110+100));assert.equal(p.lastSkill,'nuclear');assert.equal(p.fireCasts,0);assert.equal(p.fireEndsAt,0);
  }
});
test('a nuclear strike kills every nearby enemy including spawn portals, leaving distant ones intact',()=>{
  const w=createWorld(),p={...SPAWN};w.animals=[createAnimal('cow',1,p.x+300,p.y,0),createAnimal('dog',2,p.x,p.y-900,.5),createAnimal('sheep',3,p.x+NUCLEAR_RADIUS+5,p.y,0)];
  const hits=nuclearBlast(w,p,1);assert.equal(hits.length,2);assert(hits.every(h=>h.killed));assert.equal(w.skulls.length,2);assert(!w.animals[2].dead);assert.equal(nuclearBlast(w,p,2).length,0);
});
test('hearts heal without overhealing or consuming full-health pickups and never revive a dead player',()=>{
  const w=createWorld(),p={...SPAWN,health:4};w.hearts=[{...SPAWN,id:'h:test',collected:false},{...SPAWN,id:'h:test2',collected:false}];
  assert.equal(collectHearts(w,p).length,1);assert.equal(p.health,5);assert.equal(collectHearts(w,p).length,0);assert(!w.hearts[1].collected);assert(w.collectedPickups.has('h:test'));
  p.health=0;assert.equal(collectHearts(w,p).length,0);assert.equal(p.health,0);
});
test('radial projectiles cover all directions, damage real enemies and expire',()=>{
  const w=createWorld(),p={...SPAWN,skulls:100};w.animals=[createAnimal('dog',12,p.x+45,p.y,0)];
  const shots=radialBurst(p,0);assert.equal(shots.length,32);
  for(const axis of ['vx','vy']){assert(shots.some(s=>s[axis]>400));assert(shots.some(s=>s[axis]<-400));}
  const result=updateProjectiles(w,p,shots,.12,1);assert(result.hits.length>0);assert(w.animals[0].health<2);
  assert.equal(updateProjectiles(w,p,result.projectiles,3,4).projectiles.length,0);
});
