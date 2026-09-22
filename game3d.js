// ===== GUNNY 3D — Three.js renderer + giu nguyen gameplay 2D =====
// dung ban UMD (three.min.js) de khong bi loi CORS/module
/* global THREE */

// --- helpers DOM / audio tai su dung tu ban 2D ---
// (logic choi: surface[], players[], bullets... copy y tu game.js, chi thay render = Three.js)

// goi lai audio + data tu items.js/shop.js (da load truoc)
const canvas2d = document.createElement('canvas'); // giu tuong thich ham cu neu co

if(!window.THREE){
  document.getElementById('gfx-mode').textContent='LỖI: không tải được Three.js (cần mạng)!';
  alert('Không tải được Three.js từ CDN. Bạn cần mạng, hoặc về bản 2D chơi nhé!');
} else {
main3D();
}
function main3D(){
const W = 1280, H = 720;
const cv = document.getElementById('scene');

// ===== THREE SETUP =====
const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(1280,560,false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87ceeb, 700, 2200);
const camera = new THREE.PerspectiveCamera(55, 1280/560, 1, 5000);
let camMode = 0; // 0 side, 1 follow, 2 top

// anh sang
const sun = new THREE.DirectionalLight(0xfff2d9, 2.2);
sun.position.set(300,500,400);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-800; sun.shadow.camera.right=800;
sun.shadow.camera.top=600; sun.shadow.camera.bottom=-200;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x3f3f2f, 0.9));
const rim = new THREE.DirectionalLight(0x88ccff, 0.6);
rim.position.set(-400,200,-300); scene.add(rim);

// stars / sun / moon se tao theo map
let skyGroup=null, terrainMesh=null, treeGroup=null, waterMesh=null, lavaMesh=null;
let playerMeshes=[], bulletMeshes=[], aimLine=null, aimTarget=null, muzzleLight=null;
let boomLights=[], particles3d=[], floatTexts=[];
let camShake=0, fxOn=true;

// FPS
let fpsN=0, fpsT=performance.now();
function fpsTick(){ fpsN++; const n=performance.now(); if(n-fpsT>800){ document.getElementById('fps').textContent=Math.round(fpsN*1000/(n-fpsT))+' FPS'; fpsN=0; fpsT=n; } }

// ====== COPY GAMEPLAY TU BAN 2D (rut gon, giu vat ly y het) ======
// ===== MAPS (mau 3D + vat ly) =====
const MAPS = {
  hill:{name:'Đồi Xanh',gravity:0.22,sky:0x87ceeb,fog:0xbfe8c8,ground:0x4d7c0f,top:0x65a30d,deco:'tree'},
  desert:{name:'Sa Mạc',gravity:0.22,sky:0xfdba74,fog:0xfde68a,ground:0xb45309,top:0xf59e0b,deco:'cactus'},
  moon:{name:'Mặt Trăng',gravity:0.11,sky:0x020617,fog:0x1e1b4b,ground:0x64748b,top:0x94a3b8,deco:'rock'},
  beach:{name:'Bãi Biển',gravity:0.2,sky:0x38bdf8,fog:0xfefce8,ground:0xd4a24e,top:0xfde68a,deco:'palm',water:true},
  volcano:{name:'Núi Lửa',gravity:0.24,sky:0x450a0a,fog:0x7c2d12,ground:0x44403c,top:0xef4444,deco:'lava',lava:true},
  ice:{name:'Băng Tuyết',gravity:0.2,sky:0xbae6fd,fog:0xffffff,ground:0x7dd3fc,top:0xf8fafc,deco:'pine'},
  forest:{name:'Rừng Ma',gravity:0.22,sky:0x052e16,fog:0x14532d,ground:0x3f3f46,top:0x4ade80,deco:'tree'}
};
let mode='bot', difficulty='normal', mapKey='hill';
let surface=[], players=[], bullets=[], particles=[], floaters=[];
let current=0, turnNum=1, timer=30, timerId=null, wind=0;
let gameActive=false, bulletFlying=false, charging=false, chargeDir=1, chargeVal=60;
let aimDrag=null, maxDmg=0, muzzle=0, lastWeapon='dua';
// ===== AUDIO =====
let soundOn=true, AC=null;
function ac(){ if(!AC){ try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } if(AC&&AC.state==='suspended')AC.resume(); return AC; }
function beep(f,d,t,v,s){ if(!soundOn)return; const c=ac(); if(!c)return; t=t||'sine'; v=v||0.2; s=s||0;
  const o=c.createOscillator(),g=c.createGain(); o.type=t; o.frequency.setValueAtTime(f,c.currentTime);
  if(s)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+s),c.currentTime+d);
  g.gain.setValueAtTime(v,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+d);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+d); }
function noiseBurst(d,v){ if(!soundOn)return; const c=ac(); if(!c)return; d=d||0.5; v=v||0.35;
  const n=Math.floor(c.sampleRate*d),b=c.createBuffer(1,n,c.sampleRate),dd=b.getChannelData(0);
  for(let i=0;i<n;i++)dd[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);
  const s=c.createBufferSource(); s.buffer=b; const g=c.createGain(); g.gain.value=v;
  const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900;
  s.connect(f); f.connect(g); g.connect(c.destination); s.start(); }
const SFX={ shoot(){beep(300,0.35,'sawtooth',0.18,500);}, boom(){noiseBurst(0.6,0.4);beep(90,0.5,'sine',0.3,-50);},
  hit(){beep(200,0.2,'square',0.15,-100);}, turn(){beep(660,0.12,'sine',0.15);},
  win(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.3,'sine',0.2),i*160));}, click(){beep(500,0.07,'sine',0.12);} };
// ===== TERRAIN LOGIC (y ban 2D) =====
function genTerrain(){
  surface=new Array(W);
  const base=H*0.62+(Math.random()*60-30);
  const f1=Math.random()*6.28,f2=Math.random()*6.28,f3=Math.random()*6.28;
  const a1=50+Math.random()*70,a2=20+Math.random()*35,a3=8+Math.random()*12;
  for(let x=0;x<W;x++){ surface[x]=base+Math.sin(x*0.004+f1)*a1+Math.sin(x*0.009+f2)*a2+Math.sin(x*0.03+f3)*a3;
    surface[x]=Math.max(H*0.35,Math.min(H-70,surface[x])); }
  for(let x=20;x<180;x++)surface[x]=surface[x]*0.3+surface[180]*0.7;
  for(let x=W-180;x<W-20;x++)surface[x]=surface[x]*0.3+surface[W-180]*0.7;
}
function groundY(x){ x=Math.max(0,Math.min(W-1,Math.round(x))); return surface[x]; }
function gunStat(key){ const g=(typeof GUNS!=='undefined'&&GUNS[key])?GUNS[key]:{dmg:35,radius:70,dig:1};
  return {dmg:(typeof gunDmg!=='undefined')?gunDmg(key):g.dmg,radius:g.radius||70,dig:g.dig||1,count:g.count||1,bounce:g.bounce||0,heal:!!g.heal,color:g.color||'#333'}; }
function rebuildTerrain3D(){ buildWorld3D(); }
function digHole(x,y,r,m){ r=r*(m||1);
  for(let ix=Math.max(0,Math.floor(x-r));ix<=Math.min(W-1,Math.ceil(x+r));ix++){
    const dx=ix-x,dy=surface[ix]-y;
    if(dx*dx+dy*dy<r*r){ const depth=Math.sqrt(Math.max(0,r*r-dx*dx)); surface[ix]=Math.max(surface[ix],y+depth*0.9); if(surface[ix]>H-10)surface[ix]=H-10; } }
  rebuildTerrain3D();
}
// ===== GAME FLOW =====
function makePlayer(x,face,isBot,name,gunKey){
  const st=(typeof gearStats!=='undefined')?gearStats():{hp:0,fuel:0,pow:0};
  return {x:x,y:groundY(x),hp:100+st.hp,maxhp:100+st.hp,fuel:100+st.fuel,maxfuel:100+st.fuel,angle:face===1?35:145,power:60,ammo:'shot',gunKey:gunKey||'dua',face:face,color:face===1?'#22c55e':'#ef4444',isBot:!!isBot,name:name,powBonus:st.pow||0};
}
function startGame(){
  genTerrain(); buildWorld3D();
  bullets=[];particles=[];floaters=[];particles3d.forEach(p=>scene.remove(p.mesh));particles3d=[];turnNum=1;maxDmg=0;
  const x1=90+Math.random()*60,x2=W-90-Math.random()*60;
  const myGun=(typeof profile!=='undefined')?profile.gun:'dua';
  const bg=['dua','bua','phao','tinhyeu','set'];
  const botGun=bg[Math.floor(Math.random()*bg.length)];
  players=[makePlayer(x1,1,false,'Gà 1',myGun),makePlayer(x2,-1,(mode==='bot'),mode==='bot'?'Máy':'Gà 2',(mode==='bot'?botGun:myGun))];
  buildPlayers3D();
  current=0;bulletFlying=false;gameActive=true;
  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('over-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('controls').classList.remove('hidden');
  document.getElementById('hint-bar').classList.remove('hidden');
  newTurn(true);
  toast('Lượt của '+players[0].name+'!');
}
function newWind(){ wind=Math.round((Math.random()*2-1)*8*10)/10; }
function newTurn(first){
  if(!gameActive)return;
  if(!first){current=(current+1)%2;if(current===0)turnNum++;}
  const p=players[current]; p.fuel=p.maxfuel||100; newWind(); SFX.turn();
  syncWeaponUI();syncSliders();updateHUD();
  clearInterval(timerId);timer=30;updateTimerUI();
  timerId=setInterval(()=>{ if(bulletFlying||!gameActive)return; timer--;updateTimerUI();
    if(timer<=0){clearInterval(timerId);toast('Hết giờ!');setTimeout(()=>nextAfterShot(),600);} },1000);
  if(p.isBot)setTimeout(botPlay,1200);
}
function updateTimerUI(){ document.getElementById('timer-val').textContent=timer;
  document.getElementById('timer-box').classList.toggle('danger',timer<=5); }
function angleRad(p){return p.angle*Math.PI/180;}
function fire(){ if(!gameActive||bulletFlying)return; const p=players[current]; if(p.isBot)return; doFire(p); }
function doFire(p){
  clearInterval(timerId);bulletFlying=true;document.getElementById('fire-btn').disabled=true;
  const gk=p.gunKey||'dua';lastWeapon=gk;muzzle=6;
  const st=gunStat(gk);
  let dmg=st.dmg,radius=st.radius,dig=st.dig,count=st.count;
  if(p.ammo==='skill'&&!st.heal){dmg=Math.round(dmg*1.6);radius=Math.round(radius*1.3);if(count>1)count+=2;}
  if(p.powBonus)dmg=Math.round(dmg*(1+p.powBonus*0.02));
  const rad=angleRad(p),speed=4+p.power*0.11;
  const sx=p.x+Math.cos(rad)*28,startY=p.y-30-Math.sin(rad)*22;
  const mk=(off)=>({x:sx,y:startY,vx:Math.cos(rad)*speed+(off||0),vy:-Math.sin(rad)*speed,trail:[],w:gk,dmg:dmg,radius:radius,dig:dig,bounce:st.bounce,heal:st.heal,color:st.color,owner:players.indexOf(p)});
  if(count>1)for(let i=0;i<count;i++)bullets.push(mk((i-(count-1)/2)*0.9)); else bullets.push(mk(0));
  SFX.shoot();p.x-=Math.cos(rad)*2;spawnMuzzle3D(p);
}
// ===== BULLETS / EXPLODE (y 2D + goi FX 3D) =====
function updateBullets(){
  const g=MAPS[mapKey].gravity;
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.trail.push({x:b.x,y:b.y});if(b.trail.length>22)b.trail.shift();
    b.vy+=g;b.vx+=wind*0.004;b.x+=b.vx;b.y+=b.vy;
    if(b.x<-40||b.x>W+40||b.y>H+40){bullets.splice(i,1);continue;}
    if(b.y>=groundY(b.x)){
      if((b.bounce||0)>0){b.bounce--;b.y=groundY(b.x)-4;b.vy=-Math.abs(b.vy)*0.55;b.vx*=0.8;continue;}
      explode(b.x,Math.min(b.y,groundY(b.x)),b);bullets.splice(i,1);continue; }
    for(let pi=0;pi<players.length;pi++){const p=players[pi];
      const dx=b.x-p.x,dy=b.y-(p.y-20);
      if(dx*dx+dy*dy<22*22){explode(b.x,b.y,b);bullets.splice(i,1);break;} }
  }
  syncBullets3D();
  if(bulletFlying&&bullets.length===0){
    setTimeout(()=>{settlePlayers();checkEnd()?null:nextAfterShot();},900);
    bulletFlying=false;document.getElementById('fire-btn').disabled=false;
  }
}
function explode(x,y,b){
  const wkey=(b&&b.w)||lastWeapon;
  const dmg0=(b&&typeof b.dmg==='number')?b.dmg:35;
  const radius=(b&&b.radius)||70,dig=(b&&b.dig)||1;
  const isHeal=!!(b&&b.heal),owner=(b&&typeof b.owner==='number')?b.owner:0;
  lastWeapon=wkey;digHole(x,y,radius,dig);SFX.boom();
  spawnExplosion3D(x,y,radius,(b&&b.color)||'#fb923c',isHeal);
  camShake=Math.min(14,radius/6);
  players.forEach((p,idx)=>{
    const dx=p.x-x,dy=(p.y-18)-y,d=Math.sqrt(dx*dx+dy*dy);
    if(d<radius+26){const fall=1-d/(radius+30);
      if(isHeal){let heal=Math.round((-dmg0)*(0.5+0.5*fall));if(heal<5)heal=5;
        p.hp=Math.min(p.maxhp||120,p.hp+heal);
        floaters.push({x:p.x,y:p.y-58,text:'+'+heal,life:1,color:'#22c55e',size:22});
        spawnFloatText3D(p.x,p.y-90,'+'+heal,'#22c55e');
      }else{let dmg=Math.round(dmg0*(0.4+0.6*fall));if(idx===owner)dmg=Math.round(dmg*0.5);if(dmg<1)dmg=1;
        p.hp=Math.max(0,p.hp-dmg);
        floaters.push({x:p.x,y:p.y-58,text:'-'+dmg,life:1,color:dmg>=30?'#ef4444':'#facc15',size:dmg>=30?24:19});
        spawnFloatText3D(p.x,p.y-90,'-'+dmg,dmg>=30?'#ef4444':'#facc15');
        if(dmg>maxDmg&&idx!==owner)maxDmg=dmg;
        p.x+=(dx>=0?1:-1)*fall*14;p.x=Math.max(20,Math.min(W-20,p.x));
        shakePlayer3D(idx);
        if(idx!==owner)SFX.hit();} }
  });
  syncPlayers3D();updateHUD();
}
function settlePlayers(){players.forEach(p=>{p.y=groundY(p.x);});syncPlayers3D();}
function nextAfterShot(){if(!gameActive)return;settlePlayers();newTurn(false);}
function checkEnd(){if(players[0].hp<=0||players[1].hp<=0){gameOver();return true;}return false;}
function gameOver(){
  gameActive=false;clearInterval(timerId);SFX.win();
  let title;const p1win=players[1].hp<=0&&players[0].hp>0;
  if(players[0].hp<=0&&players[1].hp<=0)title='🤝 HÒA NHAU!';
  else if(players[1].hp<=0)title='🏆 '+players[0].name.toUpperCase()+' THẮNG!';
  else title='🏆 '+players[1].name.toUpperCase()+' THẮNG!';
  let reward=100+Math.floor(Math.random()*100)+turnNum*10;
  if(typeof profile!=='undefined'){profile.gold+=reward;saveProfile();}
  document.getElementById('over-title').textContent=title;
  document.getElementById('over-stats').textContent='Số hiệp: '+turnNum+' • Đòn đau nhất: '+maxDmg+' • Map: '+MAPS[mapKey].name+' • +'+reward+' vàng';
  document.getElementById('over-screen').classList.remove('hidden');
  spawnFireworks3D();
}
// ===== BOT (y 2D) =====
function simDist(sx,sy,angle,power,tx,ty){
  const g=MAPS[mapKey].gravity,rad=angle*Math.PI/180,speed=4+power*0.11;
  let x=sx,y=sy,vx=Math.cos(rad)*speed,vy=-Math.sin(rad)*speed;
  for(let s=0;s<250;s++){vy+=g;vx+=wind*0.004;x+=vx;y+=vy;
    if(x<-40||x>W+40||y>H+40)return 9999;
    const dx=x-tx,dy=y-(ty-20);
    if(dx*dx+dy*dy<24*24)return 0;
    if(x>=0&&x<W&&y>=groundY(x))return Math.abs(x-tx)+Math.abs(y-ty)*0.5;}
  return 9999;
}
function botPlay(){
  if(!gameActive||bulletFlying)return;
  const me=players[current];if(!me.isBot)return;
  me.ammo=Math.random()<0.3?'skill':'shot';
  const sx=me.x,sy=me.y-30,foe=players[1-current];
  let best={a:me.face===1?45:135,p:60,d:1e9};
  for(let a=15;a<=165;a+=5)for(let p=20;p<=100;p+=5){
    const d=simDist(sx,sy,a,p,foe.x,foe.y);
    if(d<best.d){best={a:a,p:p,d:d};if(d===0)break;} }
  let eA=4,eP=6;
  if(difficulty==='easy'){eA=9;eP=13;}
  if(difficulty==='hard'){eA=1.6;eP=2.6;}
  me.angle=Math.max(10,Math.min(170,best.a+(Math.random()*2-1)*eA));
  me.power=Math.max(10,Math.min(100,best.p+(Math.random()*2-1)*eP));
  syncWeaponUI();syncSliders();updateHUD();
  toast('Máy đang ngắm...');
  setTimeout(()=>{if(gameActive&&players[current]===me)doFire(me);},900);
}
// ===== HUD =====
function pct(v,m){return Math.max(0,Math.min(100,Math.round(v/m*100)));}
function updateHUD(){
  if(!players.length)return;
  document.getElementById('hp1-fill').style.width=pct(players[0].hp,players[0].maxhp||100)+'%';
  document.getElementById('hp1-text').textContent=Math.ceil(players[0].hp)+'/'+(players[0].maxhp||100);
  document.getElementById('hp2-fill').style.width=pct(players[1].hp,players[1].maxhp||100)+'%';
  document.getElementById('hp2-text').textContent=Math.ceil(players[1].hp)+'/'+(players[1].maxhp||100);
  document.getElementById('fuel1').textContent='⛽ '+Math.round(players[0].fuel);
  document.getElementById('fuel2').textContent='⛽ '+Math.round(players[1].fuel);
  document.getElementById('wind-val').textContent=Math.abs(wind).toFixed(1);
  document.getElementById('wind-arrow').textContent=wind===0?'•':(wind>0?'→':'←');
  const p=players[current],gk=p?(p.gunKey||'dua'):'dua';
  const g=(typeof GUNS!=='undefined'&&GUNS[gk])?GUNS[gk]:{name:gk,icon:'🔫'};
  document.getElementById('turn-label').textContent='Lượt '+turnNum+': '+p.name+' • '+g.icon+' '+g.name;
  document.getElementById('turn-dot-1').classList.toggle('on',current===0&&gameActive);
  const d2=document.getElementById('turn-dot-2');if(d2)d2.classList.toggle('on',current===1&&gameActive);
  document.querySelector('.p1').classList.toggle('active-turn',current===0&&gameActive);
  document.querySelector('.p2').classList.toggle('active-turn',current===1&&gameActive);
}
function syncSliders(){const p=players[current];if(!p)return;
  document.getElementById('angle-slider').value=Math.round(p.angle);
  document.getElementById('angle-val').textContent=Math.round(p.angle)+'°';
  document.getElementById('power-val').textContent=Math.round(p.power);
  const nd=document.getElementById('power-needle');if(nd)nd.style.left=p.power+'%';}
function syncWeaponUI(){const p=players[current];if(!p)return;
  const bs=document.querySelectorAll('.wpn-btn');
  for(let i=0;i<bs.length;i++)bs[i].classList.toggle('active',bs[i].dataset.wpn===(p.ammo||'shot'));}
let toastId=null;
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');
  clearTimeout(toastId);toastId=setTimeout(()=>t.classList.remove('show'),2200);}
// ===== DIEU KHIEN =====
const keys={};
window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.repeat)return;keys[e.code]=true;
  if(e.code==='KeyC'){camMode=(camMode+1)%3;toast('📷 Camera '+(camMode===0?'cạnh':camMode===1?'theo đạn':'trên cao'));}
  if(!gameActive)return;
  const p=players[current];if(!p||p.isBot||bulletFlying)return;
  if(e.code==='Space'){charging=true;chargeVal=10;chargeDir=1;}
});
window.addEventListener('keyup',e=>{keys[e.code]=false;
  if(e.code==='Space'&&charging){charging=false;const p=players[current];
    if(p&&!p.isBot&&gameActive&&!bulletFlying){p.power=Math.round(chargeVal);syncSliders();updateHUD();doFire(p);}
    const gh=document.getElementById('power-ghost');if(gh)gh.style.width='0%';}});
function handleKeys(){
  if(!gameActive||bulletFlying)return;
  const p=players[current];if(!p||p.isBot)return;
  let moved=false;
  if(keys['ArrowLeft']||keys['KeyA']){if(p.fuel>0){p.x=Math.max(20,p.x-2.4);p.fuel-=0.7;p.face=-1;moved=true;}}
  if(keys['ArrowRight']||keys['KeyD']){if(p.fuel>0){p.x=Math.min(W-20,p.x+2.4);p.fuel-=0.7;p.face=1;moved=true;}}
  if(keys['ArrowUp']||keys['KeyW']){p.angle=Math.min(170,p.angle+1);syncSliders();}
  if(keys['ArrowDown']||keys['KeyS']){p.angle=Math.max(10,p.angle-1);syncSliders();}
  if(moved){p.y=groundY(p.x);updateHUD();syncPlayers3D();}
  if(charging){chargeVal+=chargeDir*1.6;
    if(chargeVal>=100){chargeVal=100;chargeDir=-1;}
    if(chargeVal<=10){chargeVal=10;chargeDir=1;}
    p.power=Math.round(chargeVal);
    const nd=document.getElementById('power-needle');if(nd)nd.style.left=chargeVal+'%';
    const gh=document.getElementById('power-ghost');if(gh)gh.style.width=chargeVal+'%';
    document.getElementById('power-val').textContent=Math.round(chargeVal);}
}
function canvasPos(e){const r=cv.getBoundingClientRect();
  return {x:(e.clientX-r.left)*W/r.width,y:H*0.78};}
cv.addEventListener('mousedown',e=>{if(!gameActive||bulletFlying)return;
  const p=players[current];if(!p||p.isBot)return;
  const r=cv.getBoundingClientRect();
  aimDrag={x0:p.x,y0:p.y-22,x1:(e.clientX-r.left)*W/r.width,y1:200};});
cv.addEventListener('mousemove',e=>{if(!aimDrag)return;
  const p=players[current];if(!p)return;
  const r=cv.getBoundingClientRect();
  aimDrag.x1=(e.clientX-r.left)*W/r.width;
  const dx=aimDrag.x0-aimDrag.x1,dy=250;
  let ang=Math.atan2(dy,dx)*180/Math.PI;
  if(ang<0)ang+=360;if(ang>180)ang=(ang>270?5:175);
  p.angle=Math.round(Math.max(10,Math.min(170,ang)));
  const dist=Math.min(400,Math.abs(dx));
  p.power=Math.round(15+dist/400*85);
  syncSliders();updateHUD();});
window.addEventListener('mouseup',()=>{aimDrag=null;});
document.getElementById('angle-slider').addEventListener('input',e=>{
  const p=players[current];if(!p||p.isBot||bulletFlying)return;
  p.angle=+e.target.value;document.getElementById('angle-val').textContent=p.angle+'°';updateHUD();});
const _w=document.querySelectorAll('.wpn-btn');
for(let i=0;i<_w.length;i++)_w[i].addEventListener('click',function(){
  const p=players[current];if(!p||bulletFlying||!gameActive||p.isBot)return;
  p.ammo=this.dataset.wpn;SFX.click();syncWeaponUI();updateHUD();});
document.getElementById('fire-btn').addEventListener('click',fire);
document.getElementById('again-btn').addEventListener('click',()=>{SFX.click();startGame();});
function goHome(){gameActive=false;clearInterval(timerId);
  document.getElementById('over-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('controls').classList.add('hidden');
  document.getElementById('hint-bar').classList.add('hidden');
  document.getElementById('menu-screen').classList.remove('hidden');}
document.getElementById('home-btn').addEventListener('click',goHome);
document.getElementById('menu-btn').addEventListener('click',goHome);
document.getElementById('sound-btn').addEventListener('click',function(){soundOn=!soundOn;this.textContent=soundOn?'🔊':'🔇';});
document.getElementById('cam-btn').addEventListener('click',()=>{camMode=(camMode+1)%3;});
document.getElementById('gfx-btn').addEventListener('click',function(){fxOn=!fxOn;this.classList.toggle('on',fxOn);
  document.getElementById('gfx-mode').textContent=fxOn?'Chất lượng CAO':'Chất lượng NHẸ';});
const _m=document.querySelectorAll('.mode-btn');
for(let i=0;i<_m.length;i++)_m[i].addEventListener('click',function(){
  const a=document.querySelectorAll('.mode-btn');for(let j=0;j<a.length;j++)a[j].classList.remove('active');
  this.classList.add('active');mode=this.dataset.mode;SFX.click();});
const _d=document.querySelectorAll('.diff-btn');
for(let i=0;i<_d.length;i++)_d[i].addEventListener('click',function(){
  const a=document.querySelectorAll('.diff-btn');for(let j=0;j<a.length;j++)a[j].classList.remove('active');
  this.classList.add('active');difficulty=this.dataset.diff;SFX.click();});
const _mp=document.querySelectorAll('.map-btn');
for(let i=0;i<_mp.length;i++)_mp[i].addEventListener('click',function(){
  const a=document.querySelectorAll('.map-btn');for(let j=0;j<a.length;j++)a[j].classList.remove('active');
  this.classList.add('active');mapKey=this.dataset.map;SFX.click();genTerrain();buildWorld3D();});
document.getElementById('start-btn').addEventListener('click',()=>{ac();SFX.click();startGame();});
// ===== WORLD: dia hinh + troi =====
const SX = v => (v - W/2);
const SY = v => (H - v);
function hex(h){ return new THREE.Color(h); }
function clearGroup(gr){ if(gr) scene.remove(gr); }
function buildWorld3D(){
  const m = MAPS[mapKey];
  scene.background = hex(m.sky);
  scene.fog = new THREE.Fog(m.fog, 900, 2600);
  sun.color.set(mapKey==='volcano'?0xffb36b:mapKey==='moon'?0xcdd6ff:0xfff2d9);
  clearGroup(terrainMesh); clearGroup(treeGroup); clearGroup(skyGroup);
  if(waterMesh){scene.remove(waterMesh);waterMesh=null;}
  if(lavaMesh){scene.remove(lavaMesh);lavaMesh=null;}
  const grp = new THREE.Group();
  const seg=150, depth=260;
  const geo = new THREE.PlaneGeometry(W, depth, seg, 6);
  const pos = geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const px = pos.getX(i);
    const x2d = Math.round(px + W/2);
    const gy = groundY(Math.max(0,Math.min(W-1,x2d)));
    const py = pos.getY(i);
    const t = (py + depth/2)/depth;
    const y3 = SY(gy) + (1-t)*-70 + Math.sin(px*0.02)*5*(1-t);
    pos.setXYZ(i, px, y3, py);
  }
  geo.computeVertexNormals();
  const terr = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color:m.ground, roughness:0.95, flatShading:true}));
  terr.receiveShadow = true;
  grp.add(terr);
  const tubePts=[]; for(let x=0;x<W;x+=16) tubePts.push(new THREE.Vector3(SX(x), SY(groundY(x))+1, depth/2));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tubePts), 120, 7, 6, false),
    new THREE.MeshStandardMaterial({color:m.top, roughness:0.8}));
  tube.castShadow=true; grp.add(tube);
  terrainMesh = grp; scene.add(grp);
  if(m.water){
    waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(W*1.2, 500),
      new THREE.MeshStandardMaterial({color:0x38bdf8, transparent:true, opacity:0.7, roughness:0.15, metalness:0.4}));
    waterMesh.rotation.x=-Math.PI/2; waterMesh.position.set(0, SY(H-40), 250);
    scene.add(waterMesh);
  }
  if(m.lava){
    lavaMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, 300),
      new THREE.MeshStandardMaterial({color:0xef4444, emissive:0xff4400, emissiveIntensity:1.2}));
    lavaMesh.rotation.x=-Math.PI/2; lavaMesh.position.set(0, SY(H-30), 200);
    scene.add(lavaMesh);
  }
  skyGroup = new THREE.Group();
  if(mapKey==='moon'){
    const sg = new THREE.BufferGeometry(); const sp=[];
    for(let i=0;i<400;i++) sp.push((Math.random()-0.5)*3000, 300+Math.random()*900, -1200-Math.random()*600);
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
    skyGroup.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0xffffff, size:4})));
    const earth = new THREE.Mesh(new THREE.SphereGeometry(60,24,24),
      new THREE.MeshStandardMaterial({color:0x38bdf8, emissive:0x0c4a6e, emissiveIntensity:0.6}));
    earth.position.set(-500,600,-1000); skyGroup.add(earth);
  } else {
    const s = new THREE.Mesh(new THREE.SphereGeometry(50,24,24), new THREE.MeshBasicMaterial({color:0xfff7cc}));
    s.position.set(450,620,-900); skyGroup.add(s);
  }
  const cm = new THREE.MeshStandardMaterial({color:0xffffff, roughness:1, transparent:true, opacity:0.92});
  for(let i=0;i<7;i++){
    const c = new THREE.Group();
    for(let j=0;j<4;j++){
      const b = new THREE.Mesh(new THREE.SphereGeometry(22+Math.random()*18, 10, 8), cm);
      b.position.set(j*26-40, Math.random()*10, Math.random()*10);
      c.add(b);
    }
    c.position.set((Math.random()-0.5)*1400, 420+Math.random()*180, -600);
    c.userData.v = 2+Math.random()*3;
    skyGroup.add(c);
  }
  const mm = new THREE.MeshStandardMaterial({color:mapKey==='moon'?0x334155:0x6b8f71, roughness:1, flatShading:true});
  for(let i=0;i<8;i++){
    const h = 150+Math.random()*220;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(120+Math.random()*80, h, 5), mm);
    cone.position.set(-1200+i*320, h/2-40, -1000);
    skyGroup.add(cone);
  }
  scene.add(skyGroup);
  treeGroup = new THREE.Group();
  for(let i=0;i<9;i++){
    const x = 120+Math.random()*(W-240);
    const t = buildTree3D(mapKey);
    t.position.set(SX(x), SY(groundY(x)), -60-Math.random()*80);
    treeGroup.add(t);
  }
  scene.add(treeGroup);
  syncPlayers3D(); syncBullets3D();
}
function buildTree3D(map){
  const g = new THREE.Group();
  if(map==='desert'||map==='beach'){
    const t = new THREE.Mesh(new THREE.CylinderGeometry(6,9,60,7),
      new THREE.MeshStandardMaterial({color:0x15803d, roughness:0.9}));
    t.position.y=30; t.castShadow=true; g.add(t);
  } else if(map==='moon'){
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(14),
      new THREE.MeshStandardMaterial({color:0x94a3b8, flatShading:true}));
    r.position.y=10; g.add(r);
  } else {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(5,8,40,7),
      new THREE.MeshStandardMaterial({color:0x78350f}));
    t.position.y=20; t.castShadow=true; g.add(t);
    const c = map==='ice'?0xe0f2fe:0x15803d;
    for(let i=0;i<3;i++){
      const cone = new THREE.Mesh(new THREE.ConeGeometry(30-i*7, 36, 8),
        new THREE.MeshStandardMaterial({color:c, flatShading:true}));
      cone.position.y=52+i*24; cone.castShadow=true; g.add(cone);
    }
  }
  return g;
}
// ===== GA 3D LOW-POLY =====
function buildChicken(colorHex, gunKey){
  const g = new THREE.Group();
  const bodyC = colorHex=== '#22c55e' ? 0x4ade80 : 0xf87171;
  const darkC = colorHex=== '#22c55e' ? 0x15803d : 0x991b1b;
  const body = new THREE.Mesh(new THREE.SphereGeometry(20, 18, 14),
    new THREE.MeshStandardMaterial({color:bodyC, roughness:0.6}));
  body.scale.set(1,1.1,0.9); body.position.y=26; body.castShadow=true; g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 10),
    new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.8}));
  belly.position.set(7,20,10); belly.scale.set(0.8,1,0.6); g.add(belly);
  const eyeW = new THREE.Mesh(new THREE.SphereGeometry(7,12,10),
    new THREE.MeshStandardMaterial({color:0xffffff}));
  eyeW.position.set(9,30,12); g.add(eyeW);
  const eyeB = new THREE.Mesh(new THREE.SphereGeometry(3,8,8),
    new THREE.MeshStandardMaterial({color:0x111111}));
  eyeB.position.set(12,30,17); g.add(eyeB);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(5,10,4),
    new THREE.MeshStandardMaterial({color:0xfb923c, flatShading:true}));
  beak.rotation.z=-Math.PI/2; beak.position.set(20,24,10); g.add(beak);
  for(let i=0;i<3;i++){
    const comb = new THREE.Mesh(new THREE.SphereGeometry(4.5,8,8),
      new THREE.MeshStandardMaterial({color:0xef4444}));
    comb.position.set(-4+i*6, 47, 0); g.add(comb);
  }
  const wing = new THREE.Mesh(new THREE.SphereGeometry(9,10,8),
    new THREE.MeshStandardMaterial({color:darkC, roughness:0.7}));
  wing.scale.set(0.6,1,0.8); wing.position.set(-12,26,0); wing.name='wing'; g.add(wing);
  const legM = new THREE.MeshStandardMaterial({color:0xf97316});
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,12,6), legM);
  l1.position.set(-6,6,0); g.add(l1);
  const l2 = l1.clone(); l2.position.x=6; g.add(l2);
  // sung theo loai
  const gun = new THREE.Group();
  const bm = new THREE.MeshStandardMaterial({color:0x713f12, roughness:0.6});
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(4,4,34,8), bm);
  barrel.rotation.z=Math.PI/2; barrel.castShadow=true; gun.add(barrel);
  let tipC = 0x22c55e;
  if(gunKey==='bua'){ tipC=0xb45309;
    const head = new THREE.Mesh(new THREE.BoxGeometry(16,16,16),
      new THREE.MeshStandardMaterial({color:0xb45309, roughness:0.7}));
    head.position.x=20; head.castShadow=true; gun.add(head);
  } else if(gunKey==='phao'){ tipC=0x374151;
    const mz = new THREE.Mesh(new THREE.CylinderGeometry(7,7,8,10),
      new THREE.MeshStandardMaterial({color:0x111827}));
    mz.rotation.z=Math.PI/2; mz.position.x=19; gun.add(mz);
  } else if(gunKey==='tinhyeu'){ tipC=0xec4899;
    const heart = new THREE.Mesh(new THREE.OctahedronGeometry(9),
      new THREE.MeshStandardMaterial({color:0xec4899, emissive:0xbe185d, emissiveIntensity:0.5}));
    heart.position.x=20; gun.add(heart);
  } else if(gunKey==='set'){ tipC=0xfde047;
    const bolt = new THREE.Mesh(new THREE.OctahedronGeometry(9),
      new THREE.MeshStandardMaterial({color:0xfde047, emissive:0xeab308, emissiveIntensity:0.9}));
    bolt.position.x=20; bolt.scale.set(0.7,1.3,0.7); gun.add(bolt);
  } else if(gunKey==='boom'){ tipC=0xfb923c;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(10,12,10),
      new THREE.MeshStandardMaterial({color:0xfb923c, emissive:0xf97316, emissiveIntensity:1}));
    orb.position.x=20; gun.add(orb);
  } else if(gunKey==='luuday'){ tipC=0x1f2937;
    const nade = new THREE.Mesh(new THREE.SphereGeometry(9,10,8),
      new THREE.MeshStandardMaterial({color:0x1f2937, roughness:0.4, metalness:0.5}));
    nade.position.x=20; gun.add(nade);
  } else if(gunKey==='thuoc'){ tipC=0x38bdf8;
    const box = new THREE.Mesh(new THREE.BoxGeometry(10,16,10),
      new THREE.MeshStandardMaterial({color:0xffffff}));
    box.position.x=20; gun.add(box);
    const cr = new THREE.Mesh(new THREE.BoxGeometry(11,5,11),
      new THREE.MeshStandardMaterial({color:0xef4444}));
    cr.position.x=20; gun.add(cr);
  } else {
    const mel = new THREE.Mesh(new THREE.SphereGeometry(9,12,10),
      new THREE.MeshStandardMaterial({color:0x22c55e, roughness:0.5}));
    mel.position.x=20; mel.castShadow=true; gun.add(mel);
  }
  gun.position.set(6,26,8);
  gun.name='gun';
  g.add(gun);
  // vong turn
  const ring = new THREE.Mesh(new THREE.TorusGeometry(34,2.4,8,40),
    new THREE.MeshBasicMaterial({color:0xfacc15}));
  ring.position.y=26; ring.rotation.x=Math.PI/2.4; ring.name='ring'; ring.visible=false;
  g.add(ring);
  return {group:g, gun:gun, ring:ring, wing:wing, tipColor:tipC};
}
function buildPlayers3D(){
  for(let i=0;i<playerMeshes.length;i++) scene.remove(playerMeshes[i].group);
  playerMeshes=[];
  for(let i=0;i<players.length;i++){
    const m = buildChicken(players[i].color, players[i].gunKey);
    scene.add(m.group); playerMeshes.push(m);
  }
  syncPlayers3D();
}
// ===== SYNC 2D -> 3D =====
function syncPlayers3D(){
  for(let i=0;i<players.length && i<playerMeshes.length;i++){
    const p=players[i], m=playerMeshes[i];
    m.group.position.set(SX(p.x), SY(p.y)-4, 130);
    m.group.rotation.y = p.face===1 ? 0.35 : Math.PI-0.35;
    const rad = p.angle*Math.PI/180;
    const aim = p.face===1 ? rad : Math.PI-rad;
    m.gun.rotation.z = 0;
    m.gun.rotation.y = 0;
    // quay sung theo goc (trong mat phang XY)
    m.gun.position.set(6,26,8);
    m.gun.rotation.z = p.face===1 ? rad : Math.PI-rad;
    m.ring.visible = (i===current && gameActive);
  }
}
function shakePlayer3D(i){ const m=playerMeshes[i]; if(!m)return;
  m.group.position.x += (Math.random()-0.5)*10; }
function syncBullets3D(){
  for(let i=0;i<bulletMeshes.length;i++) scene.remove(bulletMeshes[i]);
  bulletMeshes=[];
  for(let i=0;i<bullets.length;i++){
    const b=bullets[i];
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(9,12,10),
      new THREE.MeshStandardMaterial({color:new THREE.Color(b.color||'#333'), emissive:new THREE.Color(b.color||'#f60'), emissiveIntensity:0.8}));
    const l = new THREE.PointLight(new THREE.Color(b.color||'#fb923c'), 60, 220);
    mesh.add(l);
    mesh.position.set(SX(b.x), SY(b.y), 130);
    scene.add(mesh); bulletMeshes.push(mesh);
  }
}
// ===== FX 3D: no, lua, chu =====
function spawnExplosion3D(x2d,y2d,radius,color,heal){
  if(!fxOn) radius=Math.min(radius,70);
  const n = fxOn?90:35;
  const geo = new THREE.SphereGeometry(3.2,6,6);
  for(let i=0;i<n;i++){
    const c = heal?0x38bdf8:(Math.random()<0.7?new THREE.Color(color).getHex():[0xfacc15,0xfb923c,0x78716c][i%3]);
    const mt = new THREE.MeshBasicMaterial({color:c, transparent:true});
    const mesh = new THREE.Mesh(geo, mt);
    mesh.position.set(SX(x2d), SY(y2d), 130+(Math.random()-0.5)*40);
    const a=Math.random()*Math.PI*2, sp=(2+Math.random()*9)*(radius/70);
    scene.add(mesh);
    particles3d.push({mesh:mesh, vx:Math.cos(a)*sp, vy:Math.abs(Math.sin(a))*sp+3, vz:(Math.random()-0.5)*sp, life:1, decay:0.014+Math.random()*0.02});
  }
  // khoi
  for(let i=0;i<10;i++){
    const mt = new THREE.MeshBasicMaterial({color:0x555550, transparent:true, opacity:0.55});
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(10+Math.random()*14,8,8), mt);
    mesh.position.set(SX(x2d)+(Math.random()-0.5)*40, SY(y2d)+10, 110);
    scene.add(mesh);
    particles3d.push({mesh:mesh, vx:(Math.random()-0.5)*2, vy:2+Math.random()*2, vz:0, life:1, decay:0.008, grow:1.5});
  }
  // flash + shockwave
  const fl = new THREE.PointLight(heal?0x38bdf8:0xffaa33, 800, 700);
  fl.position.set(SX(x2d), SY(y2d)+30, 200);
  scene.add(fl); boomLights.push({light:fl, life:1});
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8,3,8,40),
    new THREE.MeshBasicMaterial({color:heal?0x38bdf8:0xffe08a, transparent:true, opacity:0.95}));
  ring.position.set(SX(x2d), SY(y2d)+8, 130);
  ring.rotation.x=Math.PI/2;
  scene.add(ring);
  particles3d.push({mesh:ring, vx:0,vy:0,vz:0, life:1, decay:0.05, shock:true, maxR:radius*2.4});
}
function spawnMuzzle3D(p){
  const rad=p.angle*Math.PI/180;
  const mx=SX(p.x+Math.cos(rad)*40), my=SY(p.y-30-Math.sin(rad)*30);
  if(!muzzleLight){ muzzleLight=new THREE.PointLight(0xffdd66, 300, 300); scene.add(muzzleLight); }
  muzzleLight.position.set(mx,my,180);
  muzzleLight.intensity=400;
  for(let i=0;i<8;i++){
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(3,6,6), new THREE.MeshBasicMaterial({color:0xfde047, transparent:true}));
    mesh.position.set(mx,my,150);
    scene.add(mesh);
    particles3d.push({mesh:mesh, vx:(Math.random()-0.5)*10, vy:Math.random()*8, vz:(Math.random()-0.5)*6, life:1, decay:0.09});
  }
}
function spawnFloatText3D(x2d,y2d,text,color){
  const c=document.createElement('canvas'); c.width=256; c.height=96;
  const g=c.getContext('2d');
  g.font='900 52px sans-serif'; g.textAlign='center';
  g.lineWidth=10; g.strokeStyle='rgba(0,0,0,.8)'; g.strokeText(text,128,64);
  g.fillStyle=color; g.fillText(text,128,64);
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false}));
  sp.scale.set(120,45,1);
  sp.position.set(SX(x2d), SY(y2d)+60, 220);
  scene.add(sp);
  floatTexts.push({mesh:sp, life:1});
}
function spawnFireworks3D(){
  for(let k=0;k<5;k++) setTimeout(()=>{
    const x=Math.random()*W;
    spawnExplosion3D(x, H*0.3, 60, ['#facc15','#ec4899','#38bdf8'][k%3], false);
  }, k*350);
}
function updateFX3D(){
  for(let i=particles3d.length-1;i>=0;i--){
    const p=particles3d[i];
    p.life-=p.decay;
    if(p.life<=0){ scene.remove(p.mesh); particles3d.splice(i,1); continue; }
    if(p.shock){ const s=1+(1-p.life)*p.maxR/8; p.mesh.scale.set(s,s,s);
      p.mesh.material.opacity=p.life; continue; }
    p.mesh.position.x+=p.vx; p.mesh.position.y+=p.vy; p.mesh.position.z+=p.vz;
    p.vy-=0.5;
    if(p.grow) p.mesh.scale.multiplyScalar(1.03);
    if(p.mesh.material) p.mesh.material.opacity=Math.min(1,p.life*1.5);
  }
  for(let i=boomLights.length-1;i>=0;i--){
    const b=boomLights[i]; b.life-=0.08;
    b.light.intensity*=0.82;
    if(b.life<=0){ scene.remove(b.light); boomLights.splice(i,1); }
  }
  for(let i=floatTexts.length-1;i>=0;i--){
    const f=floatTexts[i]; f.life-=0.014;
    f.mesh.position.y+=1.2;
    f.mesh.material.opacity=Math.max(0,f.life);
    if(f.life<=0){ scene.remove(f.mesh); floatTexts.splice(i,1); }
  }
  if(muzzleLight) muzzleLight.intensity*=0.8;
  if(skyGroup) for(let i=0;i<skyGroup.children.length;i++){
    const c=skyGroup.children[i];
    if(c.userData && c.userData.v){ c.position.x+=c.userData.v*0.2; if(c.position.x>900)c.position.x=-900; }
  }
}
// ===== AIM LINE 3D + CAMERA + LOOP =====
function updateAim3D(){
  if(aimLine){ scene.remove(aimLine); aimLine=null; }
  if(aimTarget){ scene.remove(aimTarget); aimTarget=null; }
  if(!gameActive||bulletFlying) return;
  const p=players[current]; if(!p||p.isBot) return;
  const rad=p.angle*Math.PI/180, speed=4+p.power*0.11, g=MAPS[mapKey].gravity;
  let x=p.x+Math.cos(rad)*34, y=p.y-22-Math.sin(rad)*34;
  let vx=Math.cos(rad)*speed, vy=-Math.sin(rad)*speed;
  const pts=[];
  for(let s=0;s<60;s++){
    vy+=g; vx+=wind*0.004; x+=vx; y+=vy;
    if(s%2===0) pts.push(new THREE.Vector3(SX(x), SY(y), 130));
    if(x>=0&&x<W&&y>=groundY(x)){
      aimTarget=new THREE.Mesh(new THREE.TorusGeometry(14,3,8,32),
        new THREE.MeshBasicMaterial({color:0xef4444}));
      aimTarget.position.set(SX(x), SY(y)+6, 130);
      scene.add(aimTarget);
      break;
    }
    if(x<-20||x>W+20||y>H) break;
  }
  if(pts.length>1){
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    aimLine=new THREE.Line(geo, new THREE.LineBasicMaterial({color:0xfacc15}));
    scene.add(aimLine);
  }
}
function updateCamera(){
  const t=performance.now()/1000;
  let cx=0, cy=330, cz=760, lx=0, ly=250;
  if(camMode===0){ cx=0; cy=340; cz=780; lx=0; ly=240; }
  else if(camMode===1){
    if(bullets.length){ const b=bullets[0];
      cx=SX(b.x)*0.7; cy=SY(Math.min(b.y,600))+80; cz=520; lx=SX(b.x)*0.8; ly=SY(b.y);
    } else if(players.length){ const p=players[current];
      cx=SX(p.x)*0.6; cy=SY(p.y)+120; cz=620; lx=SX(p.x)*0.7; ly=SY(p.y)+20; }
  } else { cx=0; cy=900; cz=420; lx=0; ly=100; }
  if(camShake>0.3){ cx+=(Math.random()-0.5)*camShake*3; cy+=(Math.random()-0.5)*camShake*3; camShake*=0.9; }
  else if(muzzle>0){ cx+=(Math.random()-0.5)*3; }
  camera.position.set(cx,cy,cz);
  camera.lookAt(lx,ly,130);
}
const clock = new THREE.Clock();
function loop3d(){
  requestAnimationFrame(loop3d);
  const dt = Math.min(clock.getDelta(), 0.05);
  handleKeys();
  if(gameActive) updateBullets();
  floaters.forEach(f=>{f.y-=0.7;f.life-=0.014;});
  floaters=floaters.filter(f=>f.life>0);
  // ga tho + canh quạt
  const t=performance.now()/300;
  for(let i=0;i<playerMeshes.length;i++){
    const m=playerMeshes[i];
    m.group.position.y += Math.sin(t+i*2)*0.15;
    if(m.wing) m.wing.rotation.z = Math.sin(t*1.5)*0.25;
    if(m.ring){ m.ring.visible=(i===current&&gameActive); m.ring.rotation.z+=0.02; }
  }
  if(muzzle>0) muzzle--;
  updateFX3D();
  updateAim3D();
  syncBullets3D();
  updateCamera();
  renderer.render(scene,camera);
  fpsTick();
}
genTerrain(); buildWorld3D(); loop3d();
} // het main3D
