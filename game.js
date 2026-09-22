// ===== GUNNY WEB - game ban sung toa do =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---------- AUDIO (WebAudio, khong can file) ----------
let soundOn = true;
let AC = null;
function ac(){ if(!AC){ try{AC = new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } if(AC&&AC.state==='suspended')AC.resume(); return AC; }
function beep(freq,dur,type='sine',vol=0.2,slide=0){
  if(!soundOn) return; const c=ac(); if(!c) return;
  const o=c.createOscillator(), g=c.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,c.currentTime);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),c.currentTime+dur);
  g.gain.setValueAtTime(vol,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+dur);
}
function noiseBurst(dur=0.5,vol=0.35){
  if(!soundOn) return; const c=ac(); if(!c) return;
  const n=Math.floor(c.sampleRate*dur), buf=c.createBuffer(1,n,c.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);
  const s=c.createBufferSource(); s.buffer=buf;
  const g=c.createGain(); g.gain.value=vol; const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900;
  s.connect(f); f.connect(g); g.connect(c.destination); s.start();
}
const SFX = {
  shoot(){beep(300,0.35,'sawtooth',0.18,500);},
  boom(){noiseBurst(0.6,0.4);beep(90,0.5,'sine',0.3,-50);},
  hit(){beep(200,0.2,'square',0.15,-100);},
  turn(){beep(660,0.12,'sine',0.15);},
  win(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.3,'sine',0.2),i*160));},
  click(){beep(500,0.07,'sine',0.12);}
};

// ---------- STATE ----------
const MAPS = {
  hill:{name:'Đồi Xanh',gravity:0.22,sky:['#7dd3fc','#e0f2fe','#bbf7d0'],ground:'#4d7c0f',grass:'#65a30d'},
  desert:{name:'Sa Mạc',gravity:0.22,sky:['#fdba74','#fef3c7','#fde68a'],ground:'#b45309',grass:'#f59e0b'},
  moon:{name:'Mặt Trăng',gravity:0.11,sky:['#020617','#1e1b4b','#312e81'],ground:'#64748b',grass:'#94a3b8'}
};
const WEAPONS = {
  single:{name:'Thường',dmg:35,radius:70,dig:1},
  triple:{name:'Chùm x3',dmg:15,radius:52,dig:0.7,count:3},
  digger:{name:'Đào đất',dmg:12,radius:115,dig:2.2}
};
let mode='bot', difficulty='normal', mapKey='hill';
let surface=[]; // surfaceY per x pixel
let players=[], bullets=[], particles=[], floaters=[];
let current=0, turnNum=1, timer=30, timerId=null, wind=0;
let gameActive=false, bulletFlying=false, charging=false, chargeDir=1, chargeVal=60;
let aimDrag=null, maxDmg=0, shake=0;
let clouds=[];

// ---------- DIA HINH ----------
function genTerrain(){
  surface = new Array(W);
  let base = H*0.62 + (Math.random()*60-30);
  let f1 = Math.random()*Math.PI*2, f2 = Math.random()*Math.PI*2, f3 = Math.random()*Math.PI*2;
  let a1 = 50+Math.random()*70, a2 = 20+Math.random()*35, a3 = 8+Math.random()*12;
  let c1 = 0.002+Math.random()*0.003, c2 = 0.006+Math.random()*0.006, c3 = 0.02+Math.random()*0.02;
  for(let x=0;x<W;x++){
    surface[x] = base + Math.sin(x*c1+f1)*a1 + Math.sin(x*c2+f2)*a2 + Math.sin(x*c3+f3)*a3;
    surface[x] = Math.max(H*0.35, Math.min(H-70, surface[x]));
  }
  // lam phang cho spawn 2 ben
  for(let x=20;x<180;x++) surface[x]=surface[x]*0.3+surface[180]*0.7;
  for(let x=W-180;x<W-20;x++) surface[x]=surface[x]*0.3+surface[W-180]*0.7;
}
function groundY(x){ x=Math.max(0,Math.min(W-1,Math.round(x))); return surface[x]; }
function digHole(x,y,r){
  const dig = WEAPONS[lastWeapon].dig||1;
  r = r*dig;
  for(let ix=Math.max(0,Math.floor(x-r)); ix<=Math.min(W-1,Math.ceil(x+r)); ix++){
    const dx=ix-x, dy=surface[ix]-y;
    if(dx*dx+dy*dy < r*r){
      const depth = Math.sqrt(Math.max(0,r*r-dx*dx));
      surface[ix] = Math.max(surface[ix], y+depth*0.9);
      if(surface[ix]>H-10) surface[ix]=H-10;
    }
  }
}
// ---------- KHOI TAO TRAN ----------
let lastWeapon='single';
function initClouds(){
  clouds=[];
  for(let i=0;i<6;i++) clouds.push({x:Math.random()*W,y:30+Math.random()*150,s:0.5+Math.random()*1.2,v:0.2+Math.random()*0.4});
}
function startGame(){
  genTerrain(); initClouds();
  bullets=[];particles=[];floaters=[];turnNum=1;maxDmg=0;shake=0;
  const x1=90+Math.random()*60, x2=W-90-Math.random()*60;
  players=[
    {x:x1,y:groundY(x1),hp:100,fuel:100,angle:35,power:60,weapon:'single',face:1,color:'#22c55e',isBot:false,name:'Gà 1'},
    {x:x2,y:groundY(x2),hp:100,fuel:100,angle:145,power:60,weapon:'single',face:-1,color:'#ef4444',isBot:(mode==='bot'),name:mode==='bot'?'Máy':'Gà 2'}
  ];
  players.forEach(p=>p.y=groundY(p.x));
  current=0; bulletFlying=false;
  gameActive=true;
  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('over-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('controls').classList.remove('hidden');
  document.getElementById('hint-bar').classList.remove('hidden');
  document.querySelector('.p2 .p-name').innerHTML = '<span id="turn-dot-2" class="turn-dot"></span> '+(mode==='bot'?'Máy 🤖':'Gà 2 🐤');
  newTurn(true);
  toast('🎮 Lượt của '+players[0].name+'! Chúc may mắn!');
}
function newWind(){ wind = Math.round((Math.random()*2-1)*8*10)/10; }
function newTurn(first=false){
  if(!gameActive) return;
  if(!first){ current=(current+1)%2; if(current===0) turnNum++; }
  const p=players[current];
  p.fuel=100;
  newWind();
  SFX.turn();
  syncWeaponUI(); syncSliders(); updateHUD();
  startTimer();
  if(p.isBot){ setTimeout(botPlay, 1200); }
}
function startTimer(){
  clearInterval(timerId); timer=30; updateTimerUI();
  timerId=setInterval(()=>{
    if(bulletFlying||!gameActive) return;
    timer--; updateTimerUI();
    if(timer<=0){ clearInterval(timerId); toast('⏱️ Hết giờ! Tự động đổi lượt'); setTimeout(()=>nextAfterShot(),600); }
  },1000);
}
function updateTimerUI(){
  const el=document.getElementById('timer-val');
  el.textContent=timer;
  document.getElementById('timer-box').classList.toggle('danger',timer<=5);
}
// ---------- BAN & VAT LY ----------
function angleRad(p){ return p.angle*Math.PI/180; }
function fire(){
  if(!gameActive||bulletFlying) return;
  const p=players[current];
  if(p.isBot) return; // bot tu ban
  doFire(p);
}
function doFire(p){
  clearInterval(timerId);
  bulletFlying=true;
  document.getElementById('fire-btn').disabled=true;
  lastWeapon=p.weapon;
  const w=WEAPONS[p.weapon];
  const rad=angleRad(p);
  const speed=4+p.power*0.11;
  const sx=p.x+Math.cos(rad)*28, sy=p.y-26+Math.sin(rad)*-28*-1;
  const startY=p.y-30-Math.sin(rad)*22;
  const mk=(off)=>({x:sx,y:startY,vx:Math.cos(rad)*speed+(off||0),vy:-Math.sin(rad)*speed,trail:[],w:p.weapon,owner:players.indexOf(p)});
  if(p.weapon==='triple'){ bullets.push(mk(-0.9),mk(0),mk(0.9)); }
  else bullets.push(mk(0));
  SFX.shoot();
  // giat lui nhe
  p.x-=Math.cos(rad)*2;
}
function updateBullets(){
  const g=MAPS[mapKey].gravity;
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.trail.push({x:b.x,y:b.y}); if(b.trail.length>22)b.trail.shift();
    b.vy+=g;
    b.vx+=wind*0.004;
    b.x+=b.vx; b.y+=b.vy;
    // ra ngoai man hinh
    if(b.x<-40||b.x>W+40||b.y>H+40){ bullets.splice(i,1); continue; }
    // cham dat
    if(b.y>=groundY(b.x)){ explode(b.x,Math.min(b.y,groundY(b.x)),b.w,b.owner); bullets.splice(i,1); continue; }
    // cham nguoi
    for(let pi=0;pi<players.length;pi++){
      const p=players[pi];
      const dx=b.x-p.x, dy=b.y-(p.y-20);
      if(dx*dx+dy*dy<22*22){ explode(b.x,b.y,b.w,b.owner); bullets.splice(i,1); break; }
    }
  }
  if(bulletFlying&&bullets.length===0){
    // cho hat no bay xong roi doi luot
    setTimeout(()=>{ settlePlayers(); checkEnd() ? null : nextAfterShot(); }, 900);
    bulletFlying=false;
    document.getElementById('fire-btn').disabled=false;
  }
}
function explode(x,y,wkey,owner){
  const w=WEAPONS[wkey];
  lastWeapon=wkey;
  digHole(x,y,w.radius);
  shake=Math.min(14,w.radius/6);
  SFX.boom();
  // hat lua
  for(let i=0;i<36;i++){
    const a=Math.random()*Math.PI*2, sp=1+Math.random()*5;
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:1,decay:0.015+Math.random()*0.02,size:2+Math.random()*4,color:['#facc15','#fb923c','#ef4444','#78716c'][Math.floor(Math.random()*4)]});
  }
  for(let i=0;i<14;i++) particles.push({x,y,vx:(Math.random()-0.5)*2,vy:-1-Math.random()*2,life:1,decay:0.008,size:6+Math.random()*8,color:'rgba(120,113,108,.5)'});
  // sat thuong theo khoang cach
  players.forEach((p,idx)=>{
    const dx=p.x-x, dy=(p.y-18)-y;
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d<w.radius+26){
      const fall=1-d/(w.radius+30);
      let dmg=Math.round(w.dmg*(0.4+0.6*fall));
      // tu ban giam 50%
      if(idx===owner) dmg=Math.round(dmg*0.5);
      if(dmg<1)dmg=1;
      p.hp=Math.max(0,p.hp-dmg);
      floaters.push({x:p.x,y:p.y-58,text:'-'+dmg,life:1,color:dmg>=30?'#ef4444':'#facc15',size:dmg>=30?24:19});
      if(dmg>maxDmg&&idx!==owner) maxDmg=dmg;
      // day lui
      p.x+= (dx>=0?1:-1)*fall*14;
      p.x=Math.max(20,Math.min(W-20,p.x));
      if(idx!==owner) SFX.hit();
    }
  });
  updateHUD();
}
function settlePlayers(){
  players.forEach(p=>{ p.y=groundY(p.x); });
}
function nextAfterShot(){
  if(!gameActive) return;
  settlePlayers();
  newTurn(false);
}
function checkEnd(){
  const dead=players.findIndex(p=>p.hp<=0);
  // roi xuong ho sau cung van song, chi chet khi hp=0
  // neu ca 2 cung chet -> hoa
  if(players[0].hp<=0||players[1].hp<=0){
    gameOver(); return true;
  }
  return false;
}
function gameOver(){
  gameActive=false; clearInterval(timerId);
  SFX.win();
  let title,stats;
  if(players[0].hp<=0&&players[1].hp<=0){ title='🤝 HÒA NHAU!'; }
  else if(players[1].hp<=0){ title='🏆 '+players[0].name.toUpperCase()+' THẮNG!'; }
  else { title='🏆 '+players[1].name.toUpperCase()+' THẮNG!'; }
  stats=`Số hiệp: ${turnNum} • Đòn đau nhất: ${maxDmg} dmg • Map: ${MAPS[mapKey].name}`;
  document.getElementById('over-title').textContent=title;
  document.getElementById('over-stats').textContent=stats;
  document.getElementById('over-screen').classList.remove('hidden');
}
// ---------- BOT AI ----------
function simDist(sx,sy,angle,power,tx,ty){
  const g=MAPS[mapKey].gravity;
  const rad=angle*Math.PI/180;
  const speed=4+power*0.11;
  let x=sx,y=sy,vx=Math.cos(rad)*speed,vy=-Math.sin(rad)*speed;
  for(let s=0;s<250;s++){
    vy+=g; vx+=wind*0.004; x+=vx; y+=vy;
    if(x<-40||x>W+40||y>H+40) return 9999;
    const dx=x-tx,dy=y-(ty-20);
    if(dx*dx+dy*dy<24*24) return 0;
    if(x>=0&&x<W&&y>=groundY(x)) return Math.abs(x-tx)+Math.abs(y-ty)*0.5;
  }
  return 9999;
}
function botPlay(){
  if(!gameActive||bulletFlying) return;
  const me=players[current];
  if(!me.isBot) return;
  // chon vu khi
  const r=Math.random();
  me.weapon = r<0.65?'single':(r<0.85?'triple':'digger');
  const sx=me.x, sy=me.y-30;
  const foe=players[1-current];
  let best={a:me.face===1?45:135,p:60,d:1e9};
  for(let a=15;a<=165;a+=5){
    for(let p=20;p<=100;p+=5){
      const d=simDist(sx,sy,a,p,foe.x,foe.y);
      if(d<best.d){best={a,p,d}; if(d===0) break;}
    }
    if(best.d===0) break;
  }
  // tinh chinh min
  for(let da=-5;da<=5;da+=2){
    for(let dp=-5;dp<=5;dp+=2){
      const d=simDist(sx,sy,best.a+da,best.p+dp,foe.x,foe.y);
      if(d<best.d) best={a:best.a+da,p:best.p+dp,d};
    }
  }
  let errA=4,errP=6;
  if(difficulty==='easy'){errA=9;errP=13;}
  if(difficulty==='hard'){errA=1.6;errP=2.6;}
  me.angle=Math.max(10,Math.min(170,best.a+(Math.random()*2-1)*errA));
  me.power=Math.max(10,Math.min(100,best.p+(Math.random()*2-1)*errP));
  syncWeaponUI(); syncSliders(); updateHUD();
  toast('🤖 Máy đang ngắm...');
  setTimeout(()=>{ if(gameActive&&players[current]===me) doFire(me); }, 900);
}
// ---------- VE ----------
function drawSky(){
  const m=MAPS[mapKey];
  const gr=ctx.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,m.sky[0]); gr.addColorStop(0.55,m.sky[1]); gr.addColorStop(1,m.sky[2]);
  ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
  if(mapKey==='moon'){
    ctx.fillStyle='#fff';
    for(let i=0;i<70;i++){ const x=(i*173)%W,y=(i*97)%260; ctx.globalAlpha=0.4+((i*13)%50)/100; ctx.fillRect(x,y,2,2); }
    ctx.globalAlpha=1;
    ctx.fillStyle='#f8fafc'; ctx.beginPath(); ctx.arc(1050,110,46,0,7); ctx.fill();
    ctx.fillStyle='#cbd5e1'; ctx.beginPath(); ctx.arc(1036,100,10,0,7); ctx.arc(1062,120,7,0,7); ctx.fill();
  } else {
    ctx.fillStyle='rgba(255,255,240,.95)';
    ctx.beginPath(); ctx.arc(1120,100,42,0,7); ctx.fill();
    ctx.fillStyle='rgba(255,255,240,.35)'; ctx.beginPath(); ctx.arc(1120,100,60,0,7); ctx.fill();
  }
  clouds.forEach(c=>{
    ctx.fillStyle=mapKey==='moon'?'rgba(100,116,139,.5)':'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.arc(c.x,c.y,22*c.s,0,7); ctx.arc(c.x+24*c.s,c.y+4*c.s,17*c.s,0,7); ctx.arc(c.x-24*c.s,c.y+5*c.s,15*c.s,0,7);
    ctx.fill();
  });
}
function drawTerrain(){
  const m=MAPS[mapKey];
  ctx.beginPath(); ctx.moveTo(0,H);
  for(let x=0;x<W;x++) ctx.lineTo(x,surface[x]);
  ctx.lineTo(W,H); ctx.closePath();
  ctx.fillStyle=m.ground; ctx.fill();
  ctx.strokeStyle=m.grass; ctx.lineWidth=7; ctx.beginPath();
  for(let x=0;x<W;x++){ if(x===0)ctx.moveTo(x,surface[x]); else ctx.lineTo(x,surface[x]); }
  ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,.12)';
  for(let x=0;x<W;x+=46){ ctx.fillRect(x,surface[x]+14,20,7); }
}
function drawPlayer(p,idx){
  const isTurn=(idx===current&&gameActive);
  ctx.save(); ctx.translate(p.x,p.y);
  if(isTurn){ ctx.strokeStyle='#facc15'; ctx.lineWidth=3; ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.arc(0,-22,30+Math.sin(Date.now()/200)*3,0,7); ctx.stroke(); ctx.setLineDash([]); }
  // bong
  ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0,2,20,6,0,0,7); ctx.fill();
  // than ga
  ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(0,-22,17,0,7); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(-5,-27,6,0,7); ctx.fill();
  // mat
  const f=p.face;
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(6*f,-24,6,0,7); ctx.fill();
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(8*f,-24,2.6,0,7); ctx.fill();
  // mo
  ctx.fillStyle='#f97316'; ctx.beginPath(); ctx.moveTo(11*f,-20); ctx.lineTo(19*f,-17); ctx.lineTo(11*f,-14); ctx.closePath(); ctx.fill();
  // mao
  ctx.fillStyle='#dc2626';
  ctx.beginPath(); ctx.arc(-4,-38,5,0,7); ctx.arc(2,-40,5.5,0,7); ctx.arc(8,-38,5,0,7); ctx.fill();
  // nong sung
  const rad=p.angle*Math.PI/180;
  const bx=Math.cos(rad)*20, by=-Math.sin(rad)*20-16;
  ctx.strokeStyle='#1f2937'; ctx.lineWidth=8; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(bx,by); ctx.stroke();
  ctx.fillStyle='#111827'; ctx.beginPath(); ctx.arc(bx,by,5,0,7); ctx.fill();
  ctx.restore();
  // ten + hp mini
  ctx.fillStyle='#000'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center';
  ctx.fillText(p.name+(p.isBot?' 🤖':''), p.x, p.y-52);
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(p.x-24,p.y-50,48,5);
  ctx.fillStyle=p.hp>50?'#22c55e':(p.hp>25?'#facc15':'#ef4444');
  ctx.fillRect(p.x-24,p.y-50,48*(p.hp/100),5);
}
function drawAim(){
  if(!gameActive||bulletFlying) return;
  const p=players[current]; if(!p||p.isBot&&mode==='bot') { /* van ve cho bot xem */ }
  if(p.isBot) return;
  const rad=p.angle*Math.PI/180, speed=4+p.power*0.11, g=MAPS[mapKey].gravity;
  let x=p.x+Math.cos(rad)*28, y=p.y-30-Math.sin(rad)*22;
  let vx=Math.cos(rad)*speed, vy=-Math.sin(rad)*speed;
  ctx.save();
  ctx.fillStyle='rgba(250,204,21,.9)';
  for(let s=0;s<42;s++){
    vy+=g; vx+=wind*0.004; x+=vx; y+=vy;
    if(s%3===0){ ctx.beginPath(); ctx.arc(x,y,s<15?4:3,0,7); ctx.fill(); }
    if(x>=0&&x<W&&y>=groundY(x)) break;
    if(x<-20||x>W+20||y>H) break;
  }
  ctx.restore();
  // luc ban hien tai
  if(charging){
    ctx.save(); ctx.fillStyle='#000'; ctx.font='bold 15px sans-serif'; ctx.textAlign='center';
    ctx.fillText('LỰC: '+Math.round(chargeVal), p.x, p.y-72);
    ctx.restore();
  }
  // keo chuot
  if(aimDrag){
    ctx.save(); ctx.strokeStyle='#facc15'; ctx.lineWidth=3; ctx.setLineDash([7,5]);
    ctx.beginPath(); ctx.moveTo(aimDrag.x0,aimDrag.y0); ctx.lineTo(aimDrag.x1,aimDrag.y1); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }
}
function drawBullets(){
  bullets.forEach(b=>{
    ctx.save();
    b.trail.forEach((t,i)=>{ ctx.globalAlpha=i/b.trail.length*0.5; ctx.fillStyle='#fb923c'; ctx.beginPath(); ctx.arc(t.x,t.y,3,0,7); ctx.fill(); });
    ctx.globalAlpha=1;
    ctx.fillStyle='#1f2937'; ctx.beginPath(); ctx.arc(b.x,b.y,8,0,7); ctx.fill();
    ctx.fillStyle='#facc15'; ctx.beginPath(); ctx.arc(b.x-2,b.y-2,3,0,7); ctx.fill();
    ctx.restore();
  });
}
function drawParticles(){
  particles.forEach(pt=>{
    ctx.save(); ctx.globalAlpha=Math.max(0,pt.life); ctx.fillStyle=pt.color;
    ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.size*pt.life+0.5,0,7); ctx.fill(); ctx.restore();
  });
  ctx.save(); ctx.textAlign='center';
  floaters.forEach(f=>{
    ctx.globalAlpha=Math.max(0,f.life); ctx.font=`900 ${f.size}px sans-serif`;
    ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.strokeText(f.text,f.x,f.y);
    ctx.fillStyle=f.color; ctx.fillText(f.text,f.x,f.y);
  });
  ctx.restore();
}
function render(){
  ctx.save();
  if(shake>0){ ctx.translate((Math.random()-0.5)*shake,(Math.random()-0.5)*shake); shake*=0.88; if(shake<0.4)shake=0; }
  drawSky(); drawTerrain();
  players.forEach((p,i)=>drawPlayer(p,i));
  drawAim(); drawBullets(); drawParticles();
  ctx.restore();
}
// ---------- HUD / UI ----------
function updateHUD(){
  if(!players.length) return;
  document.getElementById('hp1-fill').style.width=players[0].hp+'%';
  document.getElementById('hp1-text').textContent=Math.ceil(players[0].hp);
  document.getElementById('hp2-fill').style.width=players[1].hp+'%';
  document.getElementById('hp2-text').textContent=Math.ceil(players[1].hp);
  document.getElementById('fuel1').textContent='⛽ '+Math.round(players[0].fuel);
  document.getElementById('fuel2').textContent='⛽ '+Math.round(players[1].fuel);
  document.getElementById('wind-val').textContent=Math.abs(wind).toFixed(1);
  document.getElementById('wind-arrow').textContent=wind===0?'•':(wind>0?'→':'←');
  document.getElementById('turn-label').textContent='Lượt '+turnNum+': '+players[current].name;
  document.getElementById('turn-dot-1').classList.toggle('on',current===0&&gameActive);
  const d2=document.getElementById('turn-dot-2'); if(d2) d2.classList.toggle('on',current===1&&gameActive);
  document.querySelector('.p1').classList.toggle('active-turn',current===0&&gameActive);
  document.querySelector('.p2').classList.toggle('active-turn',current===1&&gameActive);
}
function syncSliders(){
  const p=players[current]; if(!p) return;
  document.getElementById('angle-slider').value=Math.round(p.angle);
  document.getElementById('power-slider').value=Math.round(p.power);
  document.getElementById('angle-val').textContent=Math.round(p.angle)+'°';
  document.getElementById('power-val').textContent=Math.round(p.power);
}
function syncWeaponUI(){
  const p=players[current]; if(!p) return;
  document.querySelectorAll('.wpn-btn').forEach(b=>b.classList.toggle('active',b.dataset.wpn===p.weapon));
}
let toastId=null;
function toast(msg){
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastId); toastId=setTimeout(()=>t.classList.remove('show'),2200);
}
// ---------- DIEU KHIEN ----------
const keys={};
window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if(e.repeat) return;
  keys[e.code]=true;
  if(!gameActive) return;
  const p=players[current];
  if(!p||p.isBot||bulletFlying) return;
  if(e.code==='Space'){ charging=true; chargeVal=10; chargeDir=1; }
});
window.addEventListener('keyup',e=>{
  keys[e.code]=false;
  if(e.code==='Space'&&charging){
    charging=false;
    const p=players[current];
    if(p&&!p.isBot&&gameActive&&!bulletFlying){ p.power=Math.round(chargeVal); syncSliders(); updateHUD(); doFire(p); }
    document.getElementById('charge-fill').style.width='0%';
  }
});
function handleKeys(){
  if(!gameActive||bulletFlying) return;
  const p=players[current]; if(!p||p.isBot) return;
  let moved=false;
  if(keys['ArrowLeft']||keys['KeyA']){ if(p.fuel>0){ p.x=Math.max(20,p.x-2.4); p.fuel-=0.7; p.face=-1; moved=true; } }
  if(keys['ArrowRight']||keys['KeyD']){ if(p.fuel>0){ p.x=Math.min(W-20,p.x+2.4); p.fuel-=0.7; p.face=1; moved=true; } }
  if(keys['ArrowUp']||keys['KeyW']){ p.angle=Math.min(170,p.angle+1); syncSliders(); }
  if(keys['ArrowDown']||keys['KeyS']){ p.angle=Math.max(10,p.angle-1); syncSliders(); }
  if(moved){ p.y=groundY(p.x); updateHUD(); }
  if(charging){
    chargeVal+=chargeDir*1.6;
    if(chargeVal>=100){chargeVal=100;chargeDir=-1;}
    if(chargeVal<=10){chargeVal=10;chargeDir=1;}
    p.power=Math.round(chargeVal);
    document.getElementById('charge-fill').style.width=chargeVal+'%';
    document.getElementById('power-val').textContent=Math.round(chargeVal);
  }
}
// ---------- NGAM CHUOT ----------
function canvasPos(e){
  const r=canvas.getBoundingClientRect();
  const cx=(e.touches?e.touches[0].clientX:e.clientX), cy=(e.touches?e.touches[0].clientY:e.clientY);
  return {x:(cx-r.left)*W/r.width, y:(cy-r.top)*H/r.height};
}
canvas.addEventListener('mousedown',e=>{
  if(!gameActive||bulletFlying) return;
  const p=players[current]; if(!p||p.isBot) return;
  const m=canvasPos(e);
  if(Math.hypot(m.x-p.x,(m.y-20)-(p.y-22))<80){ aimDrag={x0:p.x,y0:p.y-22,x1:m.x,y1:m.y}; }
});
canvas.addEventListener('mousemove',e=>{
  if(!aimDrag) return;
  const p=players[current]; if(!p) return;
  const m=canvasPos(e); aimDrag.x1=m.x; aimDrag.y1=m.y;
  const dx=aimDrag.x0-aimDrag.x1, dy=aimDrag.y0-aimDrag.y1;
  let ang=Math.atan2(-dy,dx)*180/Math.PI;
  if(ang<0)ang+=360; if(ang>180)ang=(ang>270?5:175);
  p.angle=Math.round(Math.max(10,Math.min(170,ang)));
  const dist=Math.min(320,Math.hypot(dx,dy));
  p.power=Math.round(15+dist/320*85);
  syncSliders(); updateHUD();
});
window.addEventListener('mouseup',()=>{aimDrag=null;});
// ---------- NUT BAM / MENU ----------
document.getElementById('angle-slider').addEventListener('input',e=>{
  const p=players[current]; if(!p||p.isBot||bulletFlying)return;
  p.angle=+e.target.value;
  document.getElementById('angle-val').textContent=p.angle+'°'; updateHUD();
});
document.getElementById('power-slider').addEventListener('input',e=>{
  const p=players[current]; if(!p||p.isBot||bulletFlying)return;
  p.power=+e.target.value;
  document.getElementById('power-val').textContent=p.power; updateHUD();
});
document.querySelectorAll('.wpn-btn').forEach(b=>b.addEventListener('click',()=>{
  const p=players[current]; if(!p||bulletFlying||!gameActive)return;
  if(p.isBot)return;
  p.weapon=b.dataset.wpn; SFX.click(); syncWeaponUI(); updateHUD();
}));
document.getElementById('fire-btn').addEventListener('click',fire);
document.getElementById('restart-btn').addEventListener('click',()=>{SFX.click();startGame();});
document.getElementById('again-btn').addEventListener('click',()=>{SFX.click();startGame();});
function goHome(){
  gameActive=false; clearInterval(timerId);
  document.getElementById('over-screen').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('controls').classList.add('hidden');
  document.getElementById('hint-bar').classList.add('hidden');
  document.getElementById('menu-screen').classList.remove('hidden');
}
document.getElementById('home-btn').addEventListener('click',goHome);
document.getElementById('menu-btn').addEventListener('click',goHome);
document.getElementById('sound-btn').addEventListener('click',e=>{soundOn=!soundOn;e.target.textContent=soundOn?'🔊':'🔇';if(soundOn)SFX.click();});
document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.mode-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); mode=b.dataset.mode; SFX.click();
  document.getElementById('diff-section').style.opacity=mode==='bot'?'1':'0.35';
}));
document.querySelectorAll('.diff-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.diff-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); difficulty=b.dataset.diff; SFX.click();
}));
document.querySelectorAll('.map-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.map-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); mapKey=b.dataset.map; SFX.click();
}));
document.getElementById('start-btn').addEventListener('click',()=>{ac();SFX.click();startGame();});
// ---------- VONG LAP CHINH ----------
function loop(){
  handleKeys();
  if(gameActive) updateBullets();
  clouds.forEach(c=>{c.x+=c.v; if(c.x>W+80)c.x=-80;});
  particles.forEach(pt=>{pt.x+=pt.vx;pt.y+=pt.vy;pt.vy+=0.12;pt.life-=pt.decay;});
  particles=particles.filter(pt=>pt.life>0);
  floaters.forEach(f=>{f.y-=0.7;f.life-=0.014;});
  floaters=floaters.filter(f=>f.life>0);
  render();
  requestAnimationFrame(loop);
}
genTerrain(); initClouds(); loop();









