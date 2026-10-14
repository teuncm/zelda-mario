export const TILE_SIZE=64,CHUNK_SIZE=8,CHUNK_WORLD=TILE_SIZE*CHUNK_SIZE,LOAD_RADIUS=3;
export const WORLD_LIMIT=1_000_000_000;
export const SPAWN={x:1312,y:1312};
export const iso=(x,y)=>({x:(x-y)*.866,y:(x+y)*.5});
export const fromIso=(x,y)=>({x:y+x/1.732,y:y-x/1.732});
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const cellCenter=(col,row)=>({x:(col+.5)*TILE_SIZE,y:(row+.5)*TILE_SIZE});
export const cellIndex=(col,row)=>`${col},${row}`;
export const toCell=(x,y)=>({col:Math.floor(x/TILE_SIZE),row:Math.floor(y/TILE_SIZE)});
export const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
export function randomGenerator(seed=42){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function hash(seed,x,y,salt=0){let n=(seed^Math.imul(x,374761393)^Math.imul(y,668265263)^salt)>>>0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
const mod=(n,m)=>((n%m)+m)%m;
function noise(seed,col,row){const x=col/5,y=row/5,ix=Math.floor(x),iy=Math.floor(y);const s=v=>v*v*(3-2*v),fx=s(x-ix),fy=s(y-iy),lerp=(a,b,t)=>a+(b-a)*t;return lerp(lerp(hash(seed,ix,iy),hash(seed,ix+1,iy),fx),lerp(hash(seed,ix,iy+1),hash(seed,ix+1,iy+1),fx),fy);}
export function generateTile(seed,col,row){
  const position=cellCenter(col,row),variant=hash(seed,col,row,831),value=noise(seed,col,row);
  const road=mod(col,CHUNK_SIZE)===0||mod(row,CHUNK_SIZE)===0;
  const safe=Math.abs(col-20)<=3&&Math.abs(row-20)<=3;
  let type=road?'dirt':value<.28?'water':value>.74?'stone':'grass',obstacle;
  if(safe)type='grass';
  if(!safe&&!road&&type!=='water'){const roll=hash(seed,col,row,9241);if(roll<.14)obstacle='tree';else if(roll<.17)obstacle='rock';}
  return{col,row,...position,type,variant,obstacle,blocked:type==='water'||!!obstacle};
}
export function tileAt(world,x,y){if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>WORLD_LIMIT||Math.abs(y)>WORLD_LIMIT)return undefined;const{col,row}=toCell(x,y);return getTile(world,col,row);}
export function getTile(world,col,row){return world.tileMap.get(cellIndex(col,row))??generateTile(world.seed,col,row);}
export function neighbors(index){const[col,row]=index.split(',').map(Number);return[cellIndex(col-1,row),cellIndex(col+1,row),cellIndex(col,row-1),cellIndex(col,row+1)];}
function generateChunk(world,cx,cy){
  const tiles=[],trees=[],rocks=[],flowers=[],gems=[],hearts=[];
  for(let row=cy*CHUNK_SIZE;row<(cy+1)*CHUNK_SIZE;row++)for(let col=cx*CHUNK_SIZE;col<(cx+1)*CHUNK_SIZE;col++){
    const t=generateTile(world.seed,col,row);tiles.push(t);
    const r=hash(world.seed,col,row,1234);
    if(t.obstacle==='tree')trees.push({...t,size:.72+r*.45,type:r>.57?'pine':'oak',variation:hash(world.seed,col,row,723)});
    if(t.obstacle==='rock')rocks.push({...t,size:.7+r*.4});
    if(!t.blocked){
      // Roads form a connected lattice across all chunks, guaranteeing access to pickups.
      const road=t.type==='dirt',gemId=`g:${col},${row}`,heartId=`h:${col},${row}`;
      if((road&&hash(world.seed,col,row,554)<.065)||(col===22&&row===20))gems.push({x:t.x,y:t.y,id:gemId,collected:world.collectedPickups.has(gemId),phase:r*6.28});
      if((road&&hash(world.seed,col,row,825)<.028)||(col===18&&row===20))hearts.push({x:t.x,y:t.y,id:heartId,collected:world.collectedPickups.has(heartId)});
      if(t.type==='grass')for(let i=0;i<2;i++)flowers.push({x:t.x+(hash(world.seed,col,row,14+i)-.5)*48,y:t.y+(hash(world.seed,col,row,39+i)-.5)*48,type:r,size:r});
    }
  }
  return{cx,cy,key:cellIndex(cx,cy),tiles,trees,rocks,flowers,gems,hearts};
}
export function streamWorld(world,player){
  const cx=Math.floor(player.x/CHUNK_WORLD),cy=Math.floor(player.y/CHUNK_WORLD);
  if(world.centerChunk===cellIndex(cx,cy))return false;
  for(const[key,chunk]of world.chunks)if(Math.abs(chunk.cx-cx)>LOAD_RADIUS||Math.abs(chunk.cy-cy)>LOAD_RADIUS)world.chunks.delete(key);
  for(let y=cy-LOAD_RADIUS;y<=cy+LOAD_RADIUS;y++)for(let x=cx-LOAD_RADIUS;x<=cx+LOAD_RADIUS;x++){const key=cellIndex(x,y);if(!world.chunks.has(key))world.chunks.set(key,generateChunk(world,x,y));}
  world.tileMap=new Map();world.tiles=[];world.trees=[];world.rocks=[];world.flowers=[];world.gems=[];world.hearts=[];
  for(const chunk of world.chunks.values()){
    for(const tile of chunk.tiles){world.tiles.push(tile);world.tileMap.set(cellIndex(tile.col,tile.row),tile);}
    for(const name of ['trees','rocks','flowers','gems','hearts'])world[name].push(...chunk[name]);
  }
  world.centerChunk=cellIndex(cx,cy);world.revision++;
  const flow=buildFlowField(world,player);world.reachable=[...flow.keys()];
  world.animals=world.animals.filter(a=>distance(a,player)<CHUNK_WORLD*2.8);
  return true;
}
export function buildFlowField(world,target){
  const costs=new Map(),start=tileAt(world,target.x,target.y);if(!start||start.blocked)return costs;
  const key=cellIndex(start.col,start.row),queue=[key];costs.set(key,0);
  for(let head=0;head<queue.length;head++)for(const next of neighbors(queue[head])){const tile=world.tileMap.get(next);if(tile&&!tile.blocked&&!costs.has(next)){costs.set(next,costs.get(queue[head])+1);queue.push(next);}}
  return costs;
}
export function createAnimal(type,id,x,y,spawnDelay=.9){const maxHealth=type==='cow'?3:2;return{x,y,homeX:x,homeY:y,type,id,maxHealth,health:maxHealth,angle:0,stun:0,hits:0,step:0,dead:false,hitFlash:0,deathTimer:0,spawnDelay,nextBurnAt:0,lunge:0,nextLungeAt:0,hostile:true};}
export function createWorld(seed=42){const world={seed:Number(seed)>>>0,chunks:new Map(),tileMap:new Map(),collectedPickups:new Set(),centerChunk:null,revision:0,tiles:[],trees:[],rocks:[],flowers:[],gems:[],hearts:[],skulls:[],animals:[],reachable:[],spawnSerial:0,nextAnimalId:0};streamWorld(world,SPAWN);spawnAnimals(world,SPAWN,12);return world;}
export function canMove(x,y,world,radius=10){return[[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]].every(([dx,dy])=>{const tile=tileAt(world,x+dx,y+dy);return tile&&!tile.blocked;});}
export function moveEntity(entity,dx,dy,world,radius=10){const count=Math.max(1,Math.ceil(Math.hypot(dx,dy)/12));for(let i=0;i<count;i++){if(canMove(entity.x+dx/count,entity.y,world,radius))entity.x+=dx/count;if(canMove(entity.x,entity.y+dy/count,world,radius))entity.y+=dy/count;}}
export function spawnAnimals(world,player,count=2){
  const random=randomGenerator(world.seed^(++world.spawnSerial*2654435761));
  const candidates=world.reachable.map(key=>world.tileMap.get(key)).filter(t=>t&&distance(t,player)>=320&&distance(t,player)<=760&&!world.animals.some(a=>!a.dead&&distance(a,t)<TILE_SIZE*1.4));
  const spawned=[];
  while(spawned.length<count&&candidates.length){const tile=candidates.splice(Math.floor(random()*candidates.length),1)[0];if(spawned.some(a=>distance(a,tile)<TILE_SIZE*1.4))continue;const id=world.nextAnimalId++,animal=createAnimal(['cow','sheep','dog'][id%3],id,tile.x,tile.y);world.animals.push(animal);spawned.push(animal);}
  return spawned;
}
export function aimAngle(player){return Number.isFinite(player.aimAngle)?player.aimAngle:player.facing===-1?Math.PI*.75:-Math.PI*.25;}
export function animalsInSwordRange(player,animals,reach=100){
  const angle=aimAngle(player);
  return animals.filter(a=>{if(a.dead||a.spawnDelay>0)return false;const dx=a.x-player.x,dy=a.y-player.y,d=Math.hypot(dx,dy);return d<reach&&(d<25||(dx*Math.cos(angle)+dy*Math.sin(angle))/d>=Math.cos(Math.PI*.4));});
}
