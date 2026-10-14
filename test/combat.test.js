import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, SPAWN } from '../src/world.js';
import { strikeAnimals, collectSkulls, swordUpgraded, swordReach, bladeLength, MOVE_SPEED, SPRINT_SPEED } from '../src/combat.js';

function fixture(type='cow') {
  const world=createWorld(),player={...SPAWN,facing:1,skulls:0};
  const animal=world.animals.find(a=>a.type===type);
  animal.x=player.x+30;animal.y=player.y-10;animal.spawnDelay=0;
  world.animals=[animal];
  return {world,player,animal};
}
test('strikes damage each species and death produces exactly one skull',()=>{
  for(const [type,hits] of [['cow',3],['sheep',2],['dog',2]]) {
    const {world,player,animal}=fixture(type);
    for(let hit=1;hit<=hits;hit++) {
      const result=strikeAnimals(world,player,hit);
      assert.equal(result.length,1);
      assert.equal(animal.health,hits-hit);
      assert.equal(result[0].killed,hit===hits);
      assert.equal(world.skulls.length,hit===hits?1:0);
    }
    assert(animal.dead);
    assert.deepEqual(strikeAnimals(world,player,5),[]);
    assert.equal(world.skulls.length,1,'A corpse cannot generate extra drops');
  }
});
test('skull pickups require proximity and a visible drop, and cannot be counted twice',()=>{
  const {world,player,animal}=fixture('sheep');
  strikeAnimals(world,player,0);strikeAnimals(world,player,.25);
  assert.equal(collectSkulls(world,player,.4).collected.length,0);
  const skull=world.skulls[0];
  player.x=skull.x+100;
  assert.equal(collectSkulls(world,player,1).collected.length,0);
  player.x=animal.x;player.y=animal.y;
  assert.equal(collectSkulls(world,player,1).collected.length,1);
  assert.equal(player.skulls,1);
  assert.equal(collectSkulls(world,player,2).collected.length,0);
  assert.equal(player.skulls,1);
});
test('the tenth skull visibly lengthens the blade and increases real hit range',()=>{
  const {world,player,animal}=fixture();
  player.skulls=9;animal.x=player.x+125;animal.y=player.y;
  assert.equal(strikeAnimals(world,player,0).length,0);
  const initialLength=bladeLength(player);
  world.skulls=[{id:99,...player,bornAt:0,collected:false}];
  const pickup=collectSkulls(world,player,1);
  assert.equal(player.skulls,10);assert(pickup.upgraded);assert(swordUpgraded(player));
  assert.equal(swordReach(player),165);assert(bladeLength(player)>initialLength);
  assert.equal(strikeAnimals(world,player,2).length,1,'Longer blade hits previously unreachable targets');
  world.skulls.push({id:100,x:player.x,y:player.y,bornAt:0,collected:false});
  assert.equal(collectSkulls(world,player,3).upgraded,false,'Upgrade triggers only on the threshold crossing');
  assert.equal(player.skulls,11);assert(swordUpgraded(player));
});
test('normal movement is faster and sprinting adds another speed tier',()=>{
  assert(MOVE_SPEED>165*1.5);assert(SPRINT_SPEED>MOVE_SPEED);
});
