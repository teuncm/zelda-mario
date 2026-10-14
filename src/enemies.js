import { TILE_SIZE, tileAt, cellIndex, neighbors, distance, moveEntity, spawnAnimals } from './world.js';

export const MAX_ENEMIES = 24;
export const SPAWN_INTERVAL = 3.5;
export const PLAYER_MAX_HEALTH = 5;
export const CONTACT_RADIUS = 35;
export function updateEnemies(world, player, flow, dt, time) {
  let playerHit = false;
  for(const animal of world.animals) {
    if(animal.dead){animal.deathTimer=Math.max(0,animal.deathTimer-dt);continue;}
    if(animal.spawnDelay>0){animal.spawnDelay=Math.max(0,animal.spawnDelay-dt);continue;}
    animal.hitFlash=Math.max(0,animal.hitFlash-dt);animal.step+=dt*12;
    const d=distance(animal,player);
    if(animal.stun>0) {
      animal.stun=Math.max(0,animal.stun-dt);
      moveEntity(animal,Math.cos(animal.angle)*210*dt,Math.sin(animal.angle)*210*dt,world);
      continue;
    }
    const tile=tileAt(world,animal.x,animal.y);if(!tile)continue;
    const index=cellIndex(tile.col,tile.row);
    let target=player;
    if(flow.get(index)>0) {
      const next=neighbors(index).filter(i=>flow.has(i)&&flow.get(i)<flow.get(index)).sort((a,b)=>flow.get(a)-flow.get(b))[0];
      if(next!==undefined) {
        // Center before turning, preventing enemies from cutting through blocked corners.
        const centerOffset=Math.hypot(animal.x-tile.x,animal.y-tile.y);
        const nextTile=world.tileMap.get(next);
        target=centerOffset>8 && ((nextTile.col!==tile.col&&Math.abs(animal.y-tile.y)>8)||(nextTile.row!==tile.row&&Math.abs(animal.x-tile.x)>8))?tile:nextTile;
      }
    } else if(!flow.has(index))continue;
    if(d<110&&time>=animal.nextLungeAt){animal.lunge=.24;animal.nextLungeAt=time+1.7;}
    animal.lunge=Math.max(0,animal.lunge-dt);
    animal.angle=Math.atan2(target.y-animal.y,target.x-animal.x);
    const speed=animal.lunge>0?315:animal.type==='dog'?175:animal.type==='sheep'?145:120;
    const travel=Math.min(distance(animal,target),speed*dt);
    moveEntity(animal,Math.cos(animal.angle)*travel,Math.sin(animal.angle)*travel,world);
    if(distance(animal,player)<CONTACT_RADIUS && time>=player.invulnerableUntil && player.health>0) {
      player.health--;player.invulnerableUntil=time+.85;player.hurtFlash=.25;playerHit=true;
      const angle=Math.atan2(player.y-animal.y,player.x-animal.x);
      moveEntity(player,Math.cos(angle)*30,Math.sin(angle)*30,world);
    }
  }
  return { playerHit, dead: player.health<=0 };
}
export function updateSpawning(world, player, dt, timer) {
  timer-=dt;
  if(timer<=0) {
    const alive=world.animals.filter(a=>!a.dead).length;
    spawnAnimals(world,player,Math.min(3,Math.max(0,MAX_ENEMIES-alive)));
    timer=SPAWN_INTERVAL;
  }
  return timer;
}
