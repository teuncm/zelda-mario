import { CHUNK_WORLD, TILE_SIZE, iso, randomGenerator, getTile } from './world.js';

export const TERRAIN_X=Math.ceil(CHUNK_WORLD*.866)+12,TERRAIN_Y=20;
function polygon(c,points,fill,stroke){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.8;c.stroke();}}
export function renderTerrain(world,chunk){
  const canvas=document.createElement('canvas');canvas.width=TERRAIN_X*2;canvas.height=CHUNK_WORLD+45;
  const c=canvas.getContext('2d'),random=randomGenerator(world.seed^Math.imul(chunk.cx,713)^Math.imul(chunk.cy,9823));
  const origin=iso(chunk.cx*CHUNK_WORLD,chunk.cy*CHUNK_WORLD);c.translate(TERRAIN_X-origin.x,TERRAIN_Y-origin.y);
  const colors={grass:['#6d754a','#73794e','#777e51','#6f774d'],dirt:['#ac9165','#a78c61','#b1956a','#a58a60'],stone:['#7b7b61','#76765d','#85816a','#7c7c65'],water:['#37645e','#3a6960','#3c6c64','#355f5a']};
  for(const tile of chunk.tiles){
    const x=tile.col*TILE_SIZE,y=tile.row*TILE_SIZE,points=[iso(x,y),iso(x+TILE_SIZE,y),iso(x+TILE_SIZE,y+TILE_SIZE),iso(x,y+TILE_SIZE)];
    polygon(c,points,colors[tile.type][Math.floor(tile.variant*4)],tile.type==='water'?'#9cc2a21c':'#342e231c');
    if(tile.type==='water'){
      for(let i=0;i<3;i++){const p=iso(x+8+random()*48,y+8+random()*48);c.strokeStyle='#aac4aa3b';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+5+random()*9,p.y);c.stroke();}
      for(const[col,row,a,b]of[[tile.col,tile.row-1,0,1],[tile.col+1,tile.row,1,2],[tile.col,tile.row+1,2,3],[tile.col-1,tile.row,3,0]])if(getTile(world,col,row).type!=='water'){c.beginPath();c.moveTo(points[a].x,points[a].y);c.lineTo(points[b].x,points[b].y);c.strokeStyle='#b1ac7566';c.lineWidth=2;c.stroke();}
    }else{
      for(let i=0;i<4;i++){const p=iso(x+random()*64,y+random()*64);c.fillStyle=tile.type==='dirt'?'#d5bc8c77':'#a5ad6b44';c.fillRect(p.x,p.y,1.5+random()*2,1);}
      if(tile.type==='stone'&&tile.variant>.6){const p=iso(tile.x,tile.y);c.beginPath();c.moveTo(p.x-14,p.y-7);c.lineTo(p.x+1,p.y-1);c.lineTo(p.x-4,p.y+6);c.strokeStyle='#4b4d3d66';c.stroke();}
    }
  }
  for(const f of chunk.flowers){const p=iso(f.x,f.y);c.strokeStyle=f.type>.7?'#aaa06d88':'#445d3b99';c.lineWidth=1;c.beginPath();c.moveTo(p.x-3,p.y);c.lineTo(p.x-5,p.y-5);c.moveTo(p.x,p.y+1);c.lineTo(p.x+1,p.y-7);c.moveTo(p.x+2,p.y);c.lineTo(p.x+5,p.y-3);c.stroke();}
  return{canvas,x:origin.x-TERRAIN_X,y:origin.y-TERRAIN_Y};
}
export const MAP_SPAN=36;
export function renderMap(world,player){
  const canvas=document.createElement('canvas');canvas.width=148;canvas.height=112;const c=canvas.getContext('2d');
  const originCol=Math.floor(player.x/TILE_SIZE)-MAP_SPAN/2,originRow=Math.floor(player.y/TILE_SIZE)-MAP_SPAN/2;
  c.fillStyle='#201f1a';c.fillRect(0,0,148,112);const colors={grass:'#657143',dirt:'#b69d70',water:'#4a8074',stone:'#88836a'};
  for(let y=0;y<MAP_SPAN;y++)for(let x=0;x<MAP_SPAN;x++){const tile=getTile(world,originCol+x,originRow+y);c.fillStyle=tile.obstacle==='tree'?'#344933':tile.obstacle==='rock'?'#686d59':colors[tile.type];c.fillRect(8+x/MAP_SPAN*132,6+y/MAP_SPAN*100,132/MAP_SPAN+.1,100/MAP_SPAN+.1);}
  c.strokeStyle='#d7b77a44';c.strokeRect(7,5,134,102);return{canvas,originCol,originRow};
}
