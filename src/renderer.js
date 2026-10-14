import { iso, fromIso, aimAngle, CHUNK_WORLD, TILE_SIZE, randomGenerator } from './world.js';
import { SWING_DURATION, swordUpgraded, bladeLength } from './combat.js';
import { FIRE_RADIUS, fireActive } from './combat.js';
import { renderTerrain, renderMap, MAP_SPAN } from './terrain.js';

function ellipse(c,x,y,rx,ry,color,rotation=0) { c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);c.fill(); }
function poly(c,points,color,stroke) { c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();} }
function line(c,points,color,width=1) {c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}

export class Renderer {
  constructor(canvas,minimap,state) {
    this.canvas=canvas;this.c=canvas.getContext('2d');this.map=minimap;this.mc=minimap.getContext('2d');this.state=state;
    this.camera=iso(state.player.x,state.player.y);this.zoom=1;this.width=1;this.height=1;
    this.terrainCache=new Map();
    this.treeSprites=Array.from({length:8},(_,i)=>this.makeTree(i));
    this.mapBackground=this.makeMap();
  }
  rebuildWorld(){this.terrainCache.clear();this.mapBackground=this.makeMap();this.mapCell=null;this.camera=iso(this.state.player.x,this.state.player.y);}
  screenToWorld(x,y){return fromIso((x-this.width/2)/this.zoom+this.camera.x,(y-this.height*.55)/this.zoom+this.camera.y);}
  resize() {
    const {width,height}=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    this.width=width;this.height=height;this.dpr=dpr;
    this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);
    this.zoom=Math.min(1.25,Math.max(.74,width/1250));
  }
  drawTerrain(){
    const rangeX=this.width/this.zoom/2+CHUNK_WORLD,rangeY=this.height/this.zoom/2+CHUNK_WORLD;
    for(const chunk of this.state.world.chunks.values()){
      const center=iso((chunk.cx+.5)*CHUNK_WORLD,(chunk.cy+.5)*CHUNK_WORLD);
      if(Math.abs(center.x-this.camera.x)>rangeX||Math.abs(center.y-this.camera.y)>rangeY)continue;
      let cached=this.terrainCache.get(chunk.key);if(!cached){cached=renderTerrain(this.state.world,chunk);this.terrainCache.set(chunk.key,cached);}
      this.c.drawImage(cached.canvas,cached.x,cached.y);
    }
    for(const key of this.terrainCache.keys())if(!this.state.world.chunks.has(key))this.terrainCache.delete(key);
    while(this.terrainCache.size>24)this.terrainCache.delete(this.terrainCache.keys().next().value);
  }
  makeTree(index) {
    const canvas=document.createElement('canvas');canvas.width=210;canvas.height=240;
    const c=canvas.getContext('2d');c.translate(95,216);
    const pine=index>4,r=randomGenerator(index+13);
    // The shadows fall consistently to the lower right.
    ellipse(c,17,3,pine?40:51,17,'#3e633b26',.12);
    ellipse(c,8,0,22,8,'#3e5f3836');
    poly(c,[[-9,-55],[7,-59],[9,-2],[1,4],[-9,0]],'#6d6542');
    poly(c,[[1,-57],[7,-59],[9,-2],[1,4]],'#4e5838');
    line(c,[[-2,-10],[-3,-49],[-17,-66]],'#9e8a54',3);
    line(c,[[3,-35],[20,-57]],'#5d603e',5);
    if(pine) {
      const colors=['#243c32','#304b36','#3c593b','#586c43'];
      for(let i=0;i<4;i++) {
        const y=-27-i*31,w=57-i*11,h=76-i*4;
        poly(c,[[-w,y-6],[0,y-h],[w,y-6],[w*.35,y+8],[-w*.4,y+6]],colors[i],'#345b4120');
        poly(c,[[-w,y-6],[0,y-h],[-w*.18,y-10]],['#3f5940','#4c6544','#63774b','#7f8556'][i]);
        poly(c,[[0,y-h],[w,y-6],[w*.35,y+8],[4,y-10]],'#254f3c24');
        line(c,[[-w*.72,y-9],[-w*.32,y-7]],'#a0b57538',2);
      }
    } else {
      const variant=index%5;
      const palettes=[['#374934','#53613e','#747a49','#92925c'],['#314434','#485b3b','#657343','#858b50'],['#633b30','#864e36','#a66a40','#ba8954'],['#434936','#5e6341','#7d794a','#95915b'],['#304432','#41573b','#5e6d40','#7c804e']];
      const colors=palettes[variant];
      const blobs=[[-34,-72,30],[-7,-68,38],[26,-72,35],[-42,-101,29],[-13,-103,39],[23,-108,36],[43,-95,26],[-26,-132,27],[4,-140,35],[28,-132,25],[-4,-163,22]];
      blobs.forEach(([x,y,rad],i)=>{
        const pts=Array.from({length:10},(_,j)=>{const a=j/10*Math.PI*2;return [x+Math.cos(a)*rad*(.88+r()*.18),y+Math.sin(a)*rad*(.8+r()*.17)];});
        poly(c,pts,colors[i<3?0:i<7?1:2]);
        if(i>3)poly(c,[[x-rad*.7,y-rad*.3],[x-rad*.2,y-rad*.8],[x+rad*.4,y-rad*.65],[x+rad*.1,y-rad*.2]],colors[3]+'77');
      });
      for(let i=0;i<60;i++) {
        const x=(r()-.5)*91,y=-70-r()*90;
        ellipse(c,x,y,2+r()*3,1.2,colors[i%3]+'90',-.35);
      }
    }
    return canvas;
  }
  makeMap() { return renderMap(this.state.world,this.state.player); }
  draw() {
    const c=this.c,{player,world,time}=this.state,p=iso(player.x,player.y);
    if(!this.state.paused){this.camera.x+=(p.x-this.camera.x)*.08;this.camera.y+=(p.y-this.camera.y)*.08;}
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);
    const shake=this.state.shake*30;
    c.save();c.translate(this.width/2+Math.sin(time*140)*shake,this.height*.55+Math.cos(time*170)*shake*.6);c.scale(this.zoom,this.zoom);c.translate(-this.camera.x,-this.camera.y);
    this.drawTerrain();
    for(const stain of this.state.stains){const pos=iso(stain.x,stain.y);ellipse(c,pos.x,pos.y,stain.size,stain.size*.45,`rgba(104,22,26,${Math.min(.6,stain.life/5)})`);ellipse(c,pos.x+stain.size*.8,pos.y+2,stain.size*.25,stain.size*.2,'#7b242e66');}
    // A few fine drifting cloud shadows and airborne seeds animate the landscape.
    for(let i=0;i<3;i++) {
      const x=this.camera.x+Math.sin(time*.025+i*3)*650,y=this.camera.y+Math.cos(time*.02+i)*330;
      const gradient=c.createRadialGradient(x,y,0,x,y,230);gradient.addColorStop(0,'#314f2910');gradient.addColorStop(1,'#314f2900');
      c.fillStyle=gradient;c.fillRect(x-230,y-230,460,460);
    }
    const objects=[...world.trees.map(o=>({...o,kind:'tree'})),...world.rocks.map(o=>({...o,kind:'rock'})),...world.animals.filter(a=>!a.dead||a.deathTimer>0).map(o=>({...o,kind:'animal'})),...world.gems.filter(g=>!g.collected).map(o=>({...o,kind:'gem'})),...world.hearts.filter(h=>!h.collected).map(o=>({...o,kind:'heart'})),...world.skulls.filter(s=>!s.collected).map(o=>({...o,kind:'skull'})),{...player,kind:'player'}];
    if(fireActive(player,time))this.fireRing(c,p,time,player,false);
    for(const animal of world.animals)if(!animal.dead&&animal.spawnDelay>0){const s=iso(animal.x,animal.y);this.spawnPortal(c,s,animal,time);}
    objects.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
    // Fade occluding canopies around the current fight and its drops as well as the hero.
    const visibleSubjects=[p,...world.animals.filter(a=>(!a.dead||a.deathTimer>0)&&(a.health<a.maxHealth)&&Math.hypot(a.x-player.x,a.y-player.y)<240).map(a=>iso(a.x,a.y)),...world.skulls.filter(s=>!s.collected&&Math.hypot(s.x-player.x,s.y-player.y)<200).map(s=>iso(s.x,s.y))];
    const rangeX=this.width/this.zoom/2+150,rangeY=this.height/this.zoom/2+230;
    for(const o of objects) {
      const pos=iso(o.x,o.y);
      if(Math.abs(pos.x-this.camera.x)>rangeX || Math.abs(pos.y-this.camera.y)>rangeY)continue;
      c.save();c.translate(pos.x,pos.y);
      if(o.kind==='tree') {
        if(visibleSubjects.some(subject=>subject.y<pos.y && subject.y>pos.y-195*o.size && Math.abs(subject.x-pos.x)<69*o.size))c.globalAlpha=.3;
        c.scale(o.size,o.size);c.drawImage(this.treeSprites[o.type==='pine'?5+Math.floor(o.variation*3):Math.floor(o.variation*5)],-95,-216);
      }
      else if(o.kind==='rock')this.rock(c,o);
      else if(o.kind==='player')this.player(c,o);
      else if(o.kind==='animal'&&o.spawnDelay<=0)this.animal(c,o);
      else if(o.kind==='gem')this.gem(c,o,time);
      else if(o.kind==='skull')this.skull(c,o,time);
      else if(o.kind==='heart')this.heart(c,time);


      c.restore();
    }
    if(fireActive(player,time))this.fireRing(c,p,time,player,true);
    for(const explosion of this.state.explosions)this.explosion(c,explosion);
    if(this.state.nuclear)this.nuclearBlast(c,this.state.nuclear);
    for(const shot of this.state.projectiles){const pos=iso(shot.x,shot.y),trail=iso(shot.x-shot.vx*.045,shot.y-shot.vy*.045);c.save();c.globalCompositeOperation='lighter';line(c,[[trail.x,trail.y-20],[pos.x,pos.y-20]],'#ffb94cab',4);ellipse(c,pos.x,pos.y-20,4,4,'#fff3ad');c.restore();}
    for(const particle of this.state.particles){const pos=iso(particle.x,particle.y);c.globalAlpha=Math.max(0,Math.min(1,particle.life/(particle.maxLife*.4)));if(particle.glow)c.globalCompositeOperation='lighter';
      if(particle.chunk){c.save();c.translate(pos.x,pos.y-particle.z);c.rotate(particle.rotation);c.fillStyle=particle.color;c.fillRect(-particle.size/2,-particle.size/2,particle.size,particle.size);c.restore();}
      else ellipse(c,pos.x,pos.y-particle.z,particle.size,particle.z===0?particle.size*.45:particle.size,particle.color);
      c.globalCompositeOperation='source-over';}
    c.globalAlpha=1;
    for(const number of this.state.damageNumbers){const pos=iso(number.x,number.y);c.globalAlpha=Math.min(1,number.life*3);c.font=`bold ${number.killed?17:14}px monospace`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#251415';const text=number.killed?'KILL':'−1';const y=pos.y-54-(.65-number.life)*32;c.strokeText(text,pos.x,y);c.fillStyle=number.killed?'#ffba73':'#fff0d3';c.fillText(text,pos.x,y);}c.globalAlpha=1;
    for(let i=0;i<23;i++) {
      const x=this.camera.x+Math.sin(i*87.31)*700+Math.sin(time*.22+i)*20,y=this.camera.y+Math.cos(i*14.75)*430-Math.sin(time*.35+i)*15;
      ellipse(c,x,y,1.5,1,i%3?'#dd9b5660':'#ef674a99',-.4);
      if(i%6===0) {line(c,[[x,y],[x+2,y-4]],'#de714866',1.5);}
    }
    c.restore();this.drawMap();
  }
  fireRing(c,p,time,player,front) {
    const fade=Math.min(1,(player.fireEndsAt-time)*4),rx=FIRE_RADIUS*1.225,ry=FIRE_RADIUS*.707;
    c.save();c.translate(p.x,p.y);c.globalAlpha=fade;
    c.globalCompositeOperation='lighter';
    if(!front) {
      const glow=c.createRadialGradient(0,0,10,0,0,rx+22);glow.addColorStop(0,'#fc4d0900');glow.addColorStop(.7,'#ed4a161b');glow.addColorStop(.9,'#ff761d4d');glow.addColorStop(1,'#ff6e1200');
      c.save();c.scale(1,.58);c.fillStyle=glow;c.fillRect(-rx-25,-rx-25,(rx+25)*2,(rx+25)*2);c.restore();
      c.strokeStyle='#fa4a16a8';c.lineWidth=10;c.beginPath();c.ellipse(0,0,rx,ry,0,0,Math.PI*2);c.stroke();
      c.strokeStyle='#ffd175e0';c.lineWidth=2;c.beginPath();c.ellipse(0,0,rx-4,ry-2,0,0,Math.PI*2);c.stroke();
    }
    for(let i=0;i<62;i++) {
      const angle=i/62*Math.PI*2,ground=iso(Math.cos(angle)*FIRE_RADIUS,Math.sin(angle)*FIRE_RADIUS);
      if((ground.y>=0)!==front)continue;
      const flicker=Math.sin(time*17+i*2.3),h=21+12*Math.sin(i*7.2)**2+flicker*7,x=ground.x,y=ground.y;
      poly(c,[[x-7,y],[x-8,y-10],[x-2,y-h*.7],[x+Math.sin(time*12+i)*5,y-h],[x+5,y-h*.4],[x+9,y-5],[x+5,y+2]],'#e8400ab0');
      poly(c,[[x-4,y],[x-4,y-9],[x+1,y-h*.66],[x+5,y-10],[x+4,y]],'#ffb22dcc');
      poly(c,[[x-2,y],[x,y-h*.33],[x+3,y]],'#fff1a9df');
      if(i%4===0)ellipse(c,x+Math.sin(time*5+i)*8,y-h-9-Math.sin(time*8+i)*7,1.8,2.5,'#ffc866aa');
    }
    c.restore();
  }
  spawnPortal(c,p,animal,time) {
    c.save();c.translate(p.x,p.y);const pulse=.75+Math.sin(time*8+animal.id)*.15;
    ellipse(c,0,0,29*pulse,17*pulse,'#ad321d45');
    c.strokeStyle='#fb713eaa';c.lineWidth=2;c.beginPath();c.ellipse(0,0,26,15,0,time*3,time*3+Math.PI*1.6);c.stroke();
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2+time*2;line(c,[[Math.cos(a)*19,Math.sin(a)*11],[Math.cos(a)*26,Math.sin(a)*15]],'#f4bb68a0',1.5);}
    c.fillStyle='#f2a567';c.font='bold 9px monospace';c.textAlign='center';c.fillText('SPAWNING',0,-26);c.restore();
  }
  explosion(c,e) {
    if(e.delay>0)return;
    const p=iso(e.x,e.y),t=1-e.life/e.maxLife,r=18+t*130;
    c.save();c.translate(p.x,p.y);c.scale(e.scale||1,e.scale||1);c.globalAlpha=Math.max(0,1-t);c.globalCompositeOperation='lighter';
    c.strokeStyle='#ffa13ab0';c.lineWidth=5*(1-t)+1;c.beginPath();c.ellipse(0,0,r*1.2,r*.65,0,0,Math.PI*2);c.stroke();
    c.strokeStyle='#fff1b399';c.lineWidth=2;c.beginPath();c.ellipse(0,0,r*1.38,r*.75,0,0,Math.PI*2);c.stroke();
    const fire=c.createRadialGradient(0,-20,0,0,-20,40+t*55);fire.addColorStop(0,t<.25?'#fff3bfd9':'#ffd16a40');fire.addColorStop(.35,'#ffad4180');fire.addColorStop(.7,'#f6491d35');fire.addColorStop(1,'#db281300');
    c.fillStyle=fire;c.fillRect(-100,-120,200,200);c.restore();
  }
  rock(c,o) {
    c.scale(o.size,o.size);ellipse(c,5,1,25,10,'#3d5b3730');
    poly(c,[[-23,-4],[-18,-22],[-2,-31],[18,-25],[28,-7],[15,4],[-9,6]],'#8b9581');
    poly(c,[[-23,-4],[-18,-22],[-2,-31],[2,-14],[-8,-6]],'#b7bc9d');
    poly(c,[[2,-14],[-2,-31],[18,-25],[28,-7],[15,4]],'#9fa88b');
    poly(c,[[-9,6],[-8,-6],[2,-14],[15,4]],'#7c8d74');
    line(c,[[-15,-18],[-4,-23]],'#d1d1ae88',2);ellipse(c,-14,1,8,3,'#7e9957');
  }
  player(c,p) {
    c.save();
    const projected=iso(Math.cos(aimAngle(p)),Math.sin(aimAngle(p))),facing=projected.x<0?-1:1,back=projected.y<-.25;
    if(this.state.gameOver){const t=Math.min(1,this.state.deathElapsed/1.4);c.rotate(t*1.4);c.globalAlpha=1-t*.65;}
    if(p.hurtFlash>0)c.filter='brightness(1.7) sepia(.4)';
    ellipse(c,5,2,19,8,'#3e543b40');
    // A small selection ring keeps the hero easy to find among the trees.
    c.strokeStyle=swordUpgraded(p)?'#f16c45aa':'#eac6a066';c.lineWidth=1.4;c.beginPath();c.ellipse(0,2,25,12,0,0,Math.PI*2);c.stroke();
    const bob=p.moving?Math.abs(Math.sin(p.step))*2:Math.sin(this.state.time*2)*.6;
    c.translate(0,-bob);c.scale(facing,1);
    if(this.state.time<p.invulnerableUntil&&Math.floor(this.state.time*18)%2===0)c.globalAlpha=.55;
    const walk=p.moving?Math.sin(p.step)*4:0;
    // Sword, boots, red shirt, denim overalls, then the unmistakable red cap.
    ellipse(c,-8,-1+walk,8,4,'#594736');ellipse(c,8,-1-walk,8,4,'#594736');
    poly(c,[[-12,-18],[-1,-18],[-2,-1+walk],[-12,-2+walk]],'#41657b');
    poly(c,[[1,-18],[11,-18],[12,-2-walk],[1,-1-walk]],'#36566c');
    ellipse(c,0,-27,15,13,'#bc4439');
    ellipse(c,-14,-24+walk*.3,5,8,'#d55343',-.3);ellipse(c,14,-24-walk*.3,5,8,'#c34436',.3);
    poly(c,[[-10,-31],[-6,-32],[-5,-22],[6,-22],[7,-32],[11,-31],[12,-12],[-11,-12]],'#4f7891');
    poly(c,[[3,-22],[10,-22],[12,-12],[3,-11]],'#3b617a');
    ellipse(c,-5,-22,1.6,1.6,'#e6c76d');ellipse(c,7,-22,1.6,1.6,'#e6c76d');
    ellipse(c,-17,-18+walk*.3,5,5,'#f4e9ce');ellipse(c,17,-18-walk*.3,5,5,'#f4e9ce');
    ellipse(c,0,-44,14,14,'#8d5737');ellipse(c,2,-43,13,13,'#edb782');
    ellipse(c,-11,-42,4,5,'#e3a778');
    ellipse(c,10,-42,6,5,'#f2bd8c');
    ellipse(c,3,-38,8,3.5,'#624333');ellipse(c,10,-39,4,3,'#624333');
    ellipse(c,7,-47,1.5,3,'#313b36');ellipse(c,7.2,-48,0.5,1,'#fff8dc');
    line(c,[[4,-51],[9,-52]],'#78513a',2);
    ellipse(c,-1,-54,16,10,'#d65141');
    poly(c,[[-16,-54],[-13,-62],[-5,-66],[6,-66],[13,-61],[15,-53]],'#e05b47');
    ellipse(c,8,-53,15,3.5,'#b83d33');ellipse(c,-3,-57,6,6,'#fbefcf');
    c.fillStyle='#c34537';c.font='bold 9px Arial';c.textAlign='center';c.fillText('M',-3,-53.8);
    line(c,[[-11,-61],[-5,-63],[3,-63]],'#ef816366',2);
    if(back){ellipse(c,0,-44,13,12,'#855337');ellipse(c,0,-54,16,9,'#d64d3e');poly(c,[[-14,-54],[-11,-62],[1,-66],[12,-61],[15,-53]],'#df5844');}
    c.restore();if(!this.state.gameOver)this.sword(c,p);
  }
  sword(c,p){
    const angle=p.attack>0?p.swingAngle:aimAngle(p),progress=p.attack>0?1-p.attack/SWING_DURATION:.5;
    const swing=angle+(p.attack>0?(progress-.5)*2.3:0),vector=iso(Math.cos(swing),Math.sin(swing));
    const rotation=Math.atan2(vector.y,vector.x),length=bladeLength(p),upgraded=swordUpgraded(p);
    c.save();c.translate(0,-25);c.rotate(rotation);c.translate(16,0);
    poly(c,[[0,-4],[length-10,-5],[length,0],[length-10,5],[0,4]],upgraded?'#ffe3b0':'#f1f4d4');poly(c,[[0,0],[length,0],[length-10,5],[0,4]],upgraded?'#d78b5d':'#9bbdb6');
    line(c,[[0,-9],[0,9]],'#d9bb69',3);line(c,[[-9,0],[0,0]],'#6b6244',4);
    if(upgraded)line(c,[[6,-2],[length-13,-2]],'#f47b41',1.5);
    c.restore();
    if(p.attack>0){const points=[];for(let i=0;i<18;i++){const a=angle+(progress-.5)*2.3-.7+i/17*.7,v=iso(Math.cos(a),Math.sin(a)),len=(length+16)/Math.hypot(v.x,v.y);points.push([v.x*len,v.y*len-25]);}line(c,points,upgraded?'#ffad62bb':'#ffedbfaa',7);}
    const tip=iso(Math.cos(aimAngle(p))*30,Math.sin(aimAngle(p))*30);ellipse(c,tip.x,tip.y,2.5,1.7,'#f4a56a99');
  }
  heart(c,time){
    ellipse(c,0,1,10,4,'#30182144');c.save();c.translate(0,-17+Math.sin(time*3)*2);c.fillStyle='#ec636f';c.beginPath();c.moveTo(0,10);c.bezierCurveTo(-20,-2,-10,-15,0,-6);c.bezierCurveTo(10,-15,20,-2,0,10);c.fill();line(c,[[-7,-4],[-4,-7]],'#ffc0ac',2);c.restore();
  }
  nuclearBlast(c,n){
    const p=iso(n.x,n.y),t=1-n.life/n.maxLife,r=Math.min(1164,55+t*1900),fade=Math.min(1,n.life);
    c.save();c.translate(p.x,p.y);c.globalAlpha=fade;c.globalCompositeOperation='lighter';
    c.strokeStyle='#ffbd57cc';c.lineWidth=18*(1-t)+2;c.beginPath();c.ellipse(0,0,r,r*.577,0,0,Math.PI*2);c.stroke();
    const glow=c.createRadialGradient(0,-80,0,0,-80,330);glow.addColorStop(0,'#fff8c7aa');glow.addColorStop(.3,'#ffc77188');glow.addColorStop(1,'#fa5b1300');c.fillStyle=glow;c.fillRect(-350,-430,700,700);
    c.globalCompositeOperation='source-over';poly(c,[[-36,0],[-52,-210],[-90,-245],[90,-245],[52,-210],[36,0]],'#f3ad5740');
    for(let i=0;i<7;i++)ellipse(c,(i-3)*43,-230-Math.sin(i/6*Math.PI)*65,75+t*25,44+t*18,i%2?'#ef9b4566':'#fbd08b99');
    c.restore();
  }
  animal(c,a) {
    const cow=a.type==='cow',sheep=a.type==='sheep',s=cow?1.1:sheep?.84:.8;
    if(a.dead){const fade=a.deathTimer/.18;c.globalAlpha*=fade;c.translate(0,-(1-fade)*18);c.scale(1+(1-fade)*.5,Math.max(.1,fade));}
    c.scale(s,s);ellipse(c,2,1,cow?27:22,10,'#405b3b36');
    const facing=Math.cos(a.angle)-Math.sin(a.angle)>0?1:-1;c.scale(facing,1);
    if(a.stun>0)c.translate(0,-Math.sin(a.stun/.18*Math.PI)*9);
    if(a.hitFlash>0)c.filter='sepia(1) saturate(5) hue-rotate(315deg) brightness(1.3)';
    const walk=Math.sin(a.step)*2;
    const leg=cow?'#7f8170':sheep?'#777458':'#8a603d';
    for(const [x,y,offset] of [[-15,-7,1],[9,-7,-1],[-9,-1,-1],[16,-1,1]]) {
      line(c,[[x,-17],[x,y+walk*offset]],leg,5);ellipse(c,x,y+walk*offset,3.5,2,cow?'#515747':'#655e45');
    }
    if(cow) {
      line(c,[[-22,-26],[-30,-17],[-28,-10]],'#7f8064',2);ellipse(c,-28,-9,3,4,'#4f5644');
      ellipse(c,-1,-24,26,16,'#cdd1b5',-.1);ellipse(c,-3,-28,24,13,'#eeecd2',-.1);
      ellipse(c,-14,-29,9,7,'#525e4c',-.3);ellipse(c,6,-23,8,9,'#58624f',.4);ellipse(c,-1,-36,6,3,'#5c6552');
      ellipse(c,23,-27,12,13,'#f1ecd0',-.2);
      ellipse(c,15,-37,7,3,'#7e8468',.5);ellipse(c,31,-36,6,3,'#b2b594',-.4);
      poly(c,[[18,-38],[16,-46],[22,-40]],'#ddd8ae');poly(c,[[28,-39],[32,-46],[31,-37]],'#ddd8ae');
      ellipse(c,27,-21,10,6,'#d3b496');ellipse(c,30,-21,1.2,1.2,'#7e6b54');ellipse(c,24,-21,1,1,'#7e6b54');
      ellipse(c,28,-31,1.5,2,'#414b3e');ellipse(c,18,-32,1.5,2,'#414b3e');
      line(c,[[16,-18],[23,-16]],'#967755',2);ellipse(c,20,-15,3,3,'#d6b66a');
    } else if(sheep) {
      ellipse(c,-1,-24,25,17,'#cfceb4');
      for(const [x,y,rx,ry] of [[-18,-27,11,11],[-10,-36,11,10],[3,-37,12,10],[15,-31,12,11],[-18,-16,10,8],[-4,-21,13,12],[10,-18,11,10]])ellipse(c,x,y,rx,ry,'#eee9cd');
      ellipse(c,-10,-35,7,5,'#faf3d8');ellipse(c,3,-38,6,4,'#faf3d8');
      ellipse(c,23,-24,10,12,'#8b8b70',-.3);ellipse(c,27,-19,7,5,'#a4a088');
      ellipse(c,16,-30,7,3,'#797d63',.55);ellipse(c,31,-31,6,3,'#797d63',-.45);
      ellipse(c,22,-35,9,6,'#e6e3c7');ellipse(c,27,-26,1.5,1.7,'#3c473c');ellipse(c,31,-19,1,1,'#626851');
    } else {
      line(c,[[-20,-20],[-28,-28],[-27,-36]],'#a67949',5);
      ellipse(c,-3,-21,24,12,'#b18a55',-.06);ellipse(c,-5,-25,20,9,'#c49b60');
      ellipse(c,12,-22,8,10,'#e1c491');ellipse(c,21,-30,12,11,'#c39b63');
      ellipse(c,16,-31,5,11,'#805d3e',-.3);ellipse(c,26,-23,9,6,'#e0c18c');
      ellipse(c,32,-25,3,2.5,'#414838');ellipse(c,26,-33,1.7,2,'#3b4333');
      line(c,[[15,-19],[25,-19]],'#a35343',3);ellipse(c,22,-17,2,2,'#c8b469');
    }
    if(!a.dead){ellipse(c,cow?28:27,cow?-31:sheep?-26:-33,2.1,2.1,'#ed382f');
      c.fillStyle=a.lunge>0?'#ff6b39':'#ce5138';c.font='bold 11px monospace';c.textAlign='center';c.fillText('!',0,-66);}
    c.filter='none';
    if(!a.dead){c.fillStyle='#271b1b';c.fillRect(-21,-59,42,5);c.fillStyle=a.lunge>0?'#ff9a54':'#c94f3a';c.fillRect(-20,-58,40*a.health/a.maxHealth,3);}
  }
  skull(c,skull,time) {
    const age=time-skull.bornAt,bob=Math.sin(time*3+skull.id)*2;
    ellipse(c,0,1,12,5,'#221b1a55');
    c.translate(0,-15-bob-Math.max(0,1-age/.4)*16);
    const glow=c.createRadialGradient(0,0,0,0,0,28);glow.addColorStop(0,'#f2974e50');glow.addColorStop(1,'#e34e2900');c.fillStyle=glow;c.fillRect(-28,-28,56,56);
    ellipse(c,0,-3,11,10,'#e4d5b3');poly(c,[[-7,1],[7,1],[6,10],[-6,10]],'#cab88e','#74664f');
    ellipse(c,-4,-3,3.1,3.3,'#302a29');ellipse(c,4,-3,3.1,3.3,'#302a29');
    poly(c,[[0,0],[-2,4],[2,4]],'#5a493e');
    for(const x of [-3,0,3])line(c,[[x,7],[x,10]],'#6c5944',1);
    line(c,[[-6,-9],[-1,-11],[4,-10]],'#fff0cc',1.5);
  }
  gem(c,g,time) {
    const bob=Math.sin(time*2.7+g.phase)*3;
    ellipse(c,0,0,9,4,'#4e75402a');
    const glow=c.createRadialGradient(0,-15,0,0,-15,26);glow.addColorStop(0,'#d6f7bd33');glow.addColorStop(1,'#d6f7bd00');c.fillStyle=glow;c.fillRect(-26,-41,52,52);
    c.translate(0,bob-15);
    poly(c,[[0,-13],[7,-6],[6,6],[0,13],[-6,6],[-7,-6]],'#c4f3bf','#5caa7c');
    poly(c,[[0,-13],[1,-4],[-1,10],[-6,6],[-7,-6]],'#ddf9c7');
    poly(c,[[0,-13],[7,-6],[6,6],[0,13],[1,-4]],'#79c99f');
    poly(c,[[0,-13],[-7,-6],[1,-4],[7,-6]],'#eafbd8');
    line(c,[[-3,-4],[-3,2]],'#ffffe8',1.3);
    if(Math.sin(time*3+g.phase)>0.85) {line(c,[[12,-15],[12,-9]],'#fff9d2',1.2);line(c,[[9,-12],[15,-12]],'#fff9d2',1.2);}
  }
  drawMap() {
    const c=this.mc,{player,world}=this.state,key=`${Math.floor(player.x/TILE_SIZE)},${Math.floor(player.y/TILE_SIZE)}`;
    if(this.mapCell!==key){this.mapBackground=this.makeMap();this.mapCell=key;}
    c.clearRect(0,0,148,112);c.drawImage(this.mapBackground.canvas,0,0);
    const project=o=>({x:8+(o.x/TILE_SIZE-this.mapBackground.originCol)/MAP_SPAN*132,y:6+(o.y/TILE_SIZE-this.mapBackground.originRow)/MAP_SPAN*100});
    c.save();c.beginPath();c.rect(8,6,132,100);c.clip();
    for(const heart of world.hearts)if(!heart.collected){const p=project(heart);ellipse(c,p.x,p.y,1.7,1.7,'#f78691');}
    for(const skull of world.skulls)if(!skull.collected){const p=project(skull);ellipse(c,p.x,p.y,2,2,'#ee8b62');}
    for(const animal of world.animals)if(!animal.dead){const p=project(animal);ellipse(c,p.x,p.y,1.5,1.5,animal.spawnDelay>0?'#ffb067':'#f36a45');}
    const p=project(player);ellipse(c,p.x,p.y,4,4,'#f8f0c2');ellipse(c,p.x,p.y,2.5,2.5,'#cd5d45');c.restore();
  }
}
