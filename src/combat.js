import { animalsInSwordRange, distance, canMove } from './world.js';

export const SWING_DURATION = .19;
export const SWING_COOLDOWN = .23;
export const MOVE_SPEED = 275;
export const SPRINT_SPEED = 385;
export const SKULL_UPGRADE_THRESHOLD = 10;
export const swordTier = player => Math.floor((player.skulls || 0) / SKULL_UPGRADE_THRESHOLD);
export const swordUpgraded = player => swordTier(player)>0;
export const swordReach = player => 100+65*swordTier(player);
export const bladeLength = player => 52+40*swordTier(player);
export const FIRE_DURATION = 2;
export const FIRE_COOLDOWN = 10;
export const FIRE_RADIUS = 145;
export const FIRE_TICK = .35;
export const NUCLEAR_RADIUS=950;
export const RADIAL_THRESHOLD=100;
export const RADIAL_INTERVAL=1.4;
export const fireActive = (player,time) => time < (player.fireEndsAt || 0);
export const fireCooldown = (player,time) => Math.max(0,(player.fireReadyAt || 0)-time);

export function activateFire(player,time) {
  if(player.health<=0 || fireCooldown(player,time)>0)return false;
  if((player.fireCasts||0)>=10){player.fireCasts=0;player.lastSkill='nuclear';player.fireEndsAt=0;}
  else{player.fireCasts=(player.fireCasts||0)+1;player.lastSkill='fire';player.fireEndsAt=time+FIRE_DURATION;}
  player.fireReadyAt=time+FIRE_COOLDOWN;
  return true;
}
export function damageAnimal(world,player,animal,time,source='sword',damage=1) {
  if(animal.dead || (animal.spawnDelay>0&&source!=='nuclear'))return null;
  animal.health=Math.max(0,animal.health-damage);animal.hits++;
  animal.stun=source==='fire'?.22:.18;animal.hitFlash=.15;
  animal.angle=Math.atan2(animal.y-player.y,animal.x-player.x);
  const killed=animal.health===0;
  if(killed) {
    animal.dead=true;animal.deathTimer=.18;
    world.skulls.push({id:animal.id,x:animal.x,y:animal.y,bornAt:time,collected:false});
  }
  return {animal,killed,source};
}

export function strikeAnimals(world, player, time) {
  const hits = [];
  for (const animal of animalsInSwordRange(player, world.animals, swordReach(player))) {
    const hit=damageAnimal(world,player,animal,time);if(hit)hits.push(hit);
  }
  return hits;
}
export function burnAnimals(world,player,time) {
  if(!fireActive(player,time))return [];
  const hits=[];
  for(const animal of world.animals) {
    if(animal.dead || animal.spawnDelay>0 || time<animal.nextBurnAt || distance(animal,player)>FIRE_RADIUS)continue;
    animal.nextBurnAt=time+FIRE_TICK;
    const hit=damageAnimal(world,player,animal,time,'fire');if(hit)hits.push(hit);
  }
  return hits;
}

export function collectSkulls(world, player, time) {
  const previousTier=swordTier(player),previousSkulls=player.skulls||0,collected=[];
  for (const skull of world.skulls) {
    if (!skull.collected && time - skull.bornAt >= .4 && distance(skull, player) < 35) {
      skull.collected = true;
      player.skulls = (player.skulls || 0) + 1;
      collected.push(skull);
    }
  }
  return {collected,upgraded:swordTier(player)>previousTier,tiersGained:swordTier(player)-previousTier,radialUnlocked:previousSkulls<RADIAL_THRESHOLD&&player.skulls>=RADIAL_THRESHOLD};
}
export function nuclearBlast(world,player,time){
  return world.animals.filter(a=>!a.dead&&distance(a,player)<=NUCLEAR_RADIUS).map(a=>damageAnimal(world,player,a,time,'nuclear',a.health)).filter(Boolean);
}
export function collectHearts(world,player,maxHealth=5){
  const collected=[];if(player.health<=0||player.health>=maxHealth)return collected;
  for(const heart of world.hearts){if(!heart.collected&&distance(heart,player)<35&&player.health<maxHealth){heart.collected=true;world.collectedPickups.add(heart.id);player.health=Math.min(maxHealth,player.health+1);collected.push(heart);}}
  return collected;
}
export function radialBurst(player,time){
  const phase=time*.35;return Array.from({length:32},(_,i)=>{const a=i/32*Math.PI*2+phase;return{x:player.x,y:player.y,vx:Math.cos(a)*440,vy:Math.sin(a)*440,life:2.2,id:`${time}:${i}`};});
}
export function updateProjectiles(world,player,projectiles,dt,time){
  const hits=[];
  for(const p of projectiles){
    const steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy)*dt/12));p.life-=dt;
    for(let i=0;i<steps&&p.life>0;i++){
      p.x+=p.vx*dt/steps;p.y+=p.vy*dt/steps;
      if(!canMove(p.x,p.y,world,2)){p.life=0;break;}
      const animal=world.animals.find(a=>!a.dead&&a.spawnDelay<=0&&distance(a,p)<23);
      if(animal){const hit=damageAnimal(world,player,animal,time,'radial');if(hit)hits.push(hit);p.life=0;break;}
    }
  }
  return{hits,projectiles:projectiles.filter(p=>p.life>0)};
}
