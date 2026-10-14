import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,SPAWN,CHUNK_SIZE,LOAD_RADIUS,TILE_SIZE,streamWorld,generateTile,canMove,tileAt,cellIndex,buildFlowField,spawnAnimals,distance,moveEntity,animalsInSwordRange} from '../src/world.js';

test('streamed terrain is deterministic across seeds, seams and negative coordinates',()=>{
  const a=createWorld(42),b=createWorld(42);assert.deepEqual(a.tiles,b.tiles);assert.notDeepEqual(a.tiles,createWorld(43).tiles);
  for(const[col,row]of[[0,0],[-1,-1],[-8,8],[9999,-3300]])assert.deepEqual(generateTile(42,col,row),tileAt(a,(col+.5)*TILE_SIZE,(row+.5)*TILE_SIZE));
  assert.equal(a.chunks.size,(LOAD_RADIUS*2+1)**2);assert.equal(a.tiles.length,a.chunks.size*CHUNK_SIZE**2);
});
test('terrain streams beyond the old map in every direction with bounded loaded chunks',()=>{
  const world=createWorld();
  for(const p of [{x:1e6,y:1e6},{x:-1e6,y:1e6},{x:1e7,y:-1e7},SPAWN]){streamWorld(world,p);assert.equal(world.chunks.size,49);assert.equal(world.tiles.length,3136);assert(tileAt(world,p.x,p.y));}
  const traveler={x:32,y:32};moveEntity(traveler,-6000,0,world);assert(traveler.x<0);assert(canMove(traveler.x,traveler.y,world));
});
test('gems, hearts and hostiles occupy reachable cells; pickup state survives unloading',()=>{
  for(const seed of [0,1,42,12345]){
    const world=createWorld(seed),flow=buildFlowField(world,SPAWN);assert(canMove(SPAWN.x,SPAWN.y,world));assert(world.hearts.length>0);assert(world.gems.length>0);
    for(const entity of [...world.gems,...world.hearts,...world.animals]){const t=tileAt(world,entity.x,entity.y);assert(canMove(entity.x,entity.y,world));assert(flow.has(cellIndex(t.col,t.row)));}
    const gem=world.gems[0],heart=world.hearts[0];for(const p of [gem,heart]){p.collected=true;world.collectedPickups.add(p.id);}
    streamWorld(world,{x:100000,y:-100000});streamWorld(world,SPAWN);
    assert(world.gems.find(g=>g.id===gem.id).collected);assert(world.hearts.find(h=>h.id===heart.id).collected);
  }
});
test('water and obstacles block movement; enemies spawn on reachable cells with unique IDs',()=>{
  const world=createWorld();for(const p of world.tiles.filter(t=>t.blocked).slice(0,20))assert(!canMove(p.x,p.y,world));
  const spawned=spawnAnimals(world,SPAWN,6),flow=buildFlowField(world,SPAWN);assert.equal(spawned.length,6);assert.equal(new Set(world.animals.map(a=>a.id)).size,18);
  for(const a of spawned){const t=tileAt(world,a.x,a.y);assert(a.spawnDelay>0);assert(distance(a,SPAWN)>=320);assert(flow.has(cellIndex(t.col,t.row)));}
});
test('sword targeting supports every heading and rejects targets behind or still spawning',()=>{
  for(let i=0;i<16;i++){
    const angle=i/16*Math.PI*2,p={x:0,y:0,aimAngle:angle};
    const front={x:Math.cos(angle)*70,y:Math.sin(angle)*70},back={x:-front.x,y:-front.y};
    assert.deepEqual(animalsInSwordRange(p,[front,back]),[front]);
    assert.equal(animalsInSwordRange(p,[{...front,dead:true},{...front,spawnDelay:.5}]).length,0);
  }
});
