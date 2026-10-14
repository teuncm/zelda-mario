export function addParticles(state,x,y,color,count=12,options={}) {
  const { blood=false, speed=120, height=20, lifetime=1, gravity=430, glow=false, chunk=false }=options;
  for(let i=0;i<count;i++) {
    const angle=Math.random()*Math.PI*2,velocity=speed*(.25+Math.random()*.75);
    state.particles.push({x,y,z:height,vx:Math.cos(angle)*velocity,vy:Math.sin(angle)*velocity,vz:35+Math.random()*speed*.6,
      life:lifetime,maxLife:lifetime,color,blood,glow,chunk,gravity,size:chunk?3+Math.random()*4:blood?2+Math.random()*3:1.5+Math.random()*2.5,rotation:angle});
  }
  // Bound visual work during clustered fire kills and long survival runs.
  if(state.particles.length>2400)state.particles.splice(0,state.particles.length-2400);
}
export function explodeAnimal(state,animal,source) {
  const {x,y}=animal;
  addParticles(state,x,y,'#ffedb7',48,{speed:460,glow:true,lifetime:.7,height:25});
  addParticles(state,x,y,'#f46d2c',64,{speed:390,glow:true,lifetime:1.2,height:25});
  addParticles(state,x,y,'#a5232b',80,{speed:450,blood:true,lifetime:1.4,height:24});
  addParticles(state,x,y,'#6e1623',38,{speed:350,blood:true,chunk:true,lifetime:1.6,height:24});
  addParticles(state,x,y,source==='fire'?'#38302b':'#84725c',34,{speed:180,lifetime:1.9,height:30,gravity:-35,chunk:true});
  state.explosions.push({x,y,life:.65,maxLife:.65,seed:animal.id});
  for(let i=0;i<3;i++)state.explosions.push({x:x+Math.cos(i*2.1+animal.id)*32,y:y+Math.sin(i*2.1+animal.id)*32,life:.8,maxLife:.8,delay:.08+i*.05,scale:.55,seed:animal.id+i});
  state.stains.push({x,y,size:35,life:18});
  state.shake=Math.max(state.shake,.33);state.hitStop=.035;
}
export function nuclearEffect(state,player){
  state.nuclear={x:player.x,y:player.y,life:3,maxLife:3};state.shake=.8;
  addParticles(state,player.x,player.y,'#ffda82',180,{speed:1100,glow:true,lifetime:2.5,height:50});
  addParticles(state,player.x,player.y,'#dc5930',150,{speed:800,glow:true,lifetime:2,height:30});
}
export function updateEffects(state,dt) {
  state.particles=state.particles.filter(p=>{
    p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z=Math.max(0,p.z+p.vz*dt);p.vz-=p.gravity*dt;
    if(p.z===0){p.vx*=Math.exp(-12*dt);p.vy*=Math.exp(-12*dt);}p.rotation+=dt*5;
    return p.life>0;
  });
  state.explosions=state.explosions.filter(e=>{const wait=Math.min(Math.max(0,e.delay||0),dt);e.delay=Math.max(0,(e.delay||0)-dt);e.life-=dt-wait;return e.life>0;});
  if(state.nuclear&&(state.nuclear.life-=dt)<=0)state.nuclear=null;
  state.stains=state.stains.filter(s=>(s.life-=dt)>0).slice(-120);
  state.damageNumbers=state.damageNumbers.filter(n=>(n.life-=dt)>0);
}
