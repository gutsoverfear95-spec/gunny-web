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
let decorSpots=[];
let muzzle=0;

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
  decorSpots=[];
  for(let i=0;i<6;i++) decorSpots.push({x:220+Math.random()*(W-440),map:Math.random()<0.6?'hill':'desert'});
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
  muzzle=6;
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
function drawBackground(){
  const m=MAPS[mapKey];
  const gr=ctx.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,m.sky[0]); gr.addColorStop(0.55,m.sky[1]); gr.addColorStop(1,m.sky[2]);
  ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
  // nui xa (parallax)
  ctx.save(); ctx.globalAlpha=0.45;
  ctx.fillStyle=mapKey==='moon'?'#334155':(mapKey==='desert'?'#d6a05c':'#86c98a');
  ctx.beginPath(); ctx.moveTo(0,520);
  for(let x=0;x<=W;x+=40){ ctx.lineTo(x, 430+Math.sin(x*0.008+2)*60+Math.sin(x*0.02)*18); }
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.fill();
  ctx.globalAlpha=0.7;
  ctx.fillStyle=mapKey==='moon'?'#475569':(mapKey==='desert'?'#c98a3b':'#5da85f');
  ctx.beginPath(); ctx.moveTo(0,560);
  for(let x=0;x<=W;x+=40){ ctx.lineTo(x, 490+Math.sin(x*0.01+5)*45+Math.sin(x*0.025+1)*12); }
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.fill();
  ctx.restore();
  if(mapKey==='moon'){
    ctx.fillStyle='#fff';
    for(let i=0;i<90;i++){ const x=(i*173)%W,y=(i*97)%260; ctx.globalAlpha=0.3+((i*13)%60)/100; const s=(i%3)+1; ctx.fillRect(x,y,s,s); }
    ctx.globalAlpha=1;
    ctx.save(); ctx.shadowColor='#fef9c3'; ctx.shadowBlur=40;
    ctx.fillStyle='#fefce8'; ctx.beginPath(); ctx.arc(1050,110,46,0,7); ctx.fill(); ctx.restore();
    ctx.fillStyle='#e2e8f0'; ctx.beginPath(); ctx.arc(1036,100,10,0,7); ctx.arc(1062,120,7,0,7); ctx.arc(1050,128,5,0,7); ctx.fill();
    // trai dat
    ctx.fillStyle='#38bdf8'; ctx.beginPath(); ctx.arc(170,110,30,0,7); ctx.fill();
    ctx.fillStyle='#22c55e'; ctx.beginPath(); ctx.arc(162,104,9,0,7); ctx.arc(178,116,6,0,7); ctx.fill();
  } else {
    // mat troi co tia
    ctx.save(); ctx.translate(1120,100);
    ctx.fillStyle='rgba(253,224,71,.35)';
    for(let i=0;i<12;i++){ ctx.rotate(Math.PI/6); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(14,-90); ctx.lineTo(-14,-90); ctx.closePath(); ctx.fill(); }
    ctx.shadowColor='#fde047'; ctx.shadowBlur=50;
    ctx.fillStyle='#fefce8'; ctx.beginPath(); ctx.arc(0,0,42,0,7); ctx.fill(); ctx.restore();
  }
  // may dep
  clouds.forEach(c=>{
    ctx.save(); ctx.translate(c.x,c.y); ctx.scale(c.s,c.s);
    ctx.fillStyle=mapKey==='moon'?'rgba(100,116,139,.55)':'rgba(255,255,255,.92)';
    ctx.shadowColor='rgba(0,0,0,.12)'; ctx.shadowBlur=10; ctx.shadowOffsetY=4;
    ctx.beginPath();
    ctx.arc(0,0,22,0,7); ctx.arc(24,4,17,0,7); ctx.arc(-24,5,15,0,7); ctx.arc(8,-10,16,0,7);
    ctx.fill(); ctx.restore();
  });
  // chim bay
  if(mapKey!=='moon'){
    ctx.save(); ctx.strokeStyle='rgba(30,41,59,.6)'; ctx.lineWidth=2;
    const t=Date.now()/600;
    for(let i=0;i<4;i++){ const bx=((t*30+i*320)%(W+100))-50, by=90+i*38+Math.sin(t+i)*8;
      const w=Math.sin(t*3+i)*5;
      ctx.beginPath(); ctx.moveTo(bx-10,by-w); ctx.quadraticCurveTo(bx,by+3,bx,by); ctx.quadraticCurveTo(bx,by+3,bx+10,by-w); ctx.stroke(); }
    ctx.restore();
  }
}
//__DRAWSKY_OLD__
function drawSky(){ drawBackground(); }

function drawTerrain(){
  const m=MAPS[mapKey];
  // than dat gradient
  const gr=ctx.createLinearGradient(0,H*0.35,0,H);
  if(mapKey==='hill'){ gr.addColorStop(0,'#65a30d'); gr.addColorStop(0.15,'#4d7c0f'); gr.addColorStop(1,'#292524'); }
  else if(mapKey==='desert'){ gr.addColorStop(0,'#f59e0b'); gr.addColorStop(0.15,'#b45309'); gr.addColorStop(1,'#44403c'); }
  else { gr.addColorStop(0,'#94a3b8'); gr.addColorStop(0.15,'#64748b'); gr.addColorStop(1,'#1e293b'); }
  ctx.beginPath(); ctx.moveTo(0,H);
  for(let x=0;x<W;x+=2) ctx.lineTo(x,surface[x]);
  ctx.lineTo(W,H); ctx.closePath();
  ctx.fillStyle=gr; ctx.fill();
  // vien co tren mat
  ctx.save(); ctx.lineWidth=9; ctx.lineCap='round';
  ctx.strokeStyle=mapKey==='hill'?'#84cc16':(mapKey==='desert'?'#fbbf24':'#cbd5e1');
  ctx.shadowColor='rgba(0,0,0,.3)'; ctx.shadowBlur=4; ctx.shadowOffsetY=3;
  ctx.beginPath();
  for(let x=0;x<W;x+=2){ if(x===0)ctx.moveTo(x,surface[x]-2); else ctx.lineTo(x,surface[x]-2); }
  ctx.stroke(); ctx.restore();
  // van da / cat
  ctx.save();
  if(mapKey==='hill'){
    ctx.strokeStyle='rgba(0,0,0,.14)'; ctx.lineWidth=5;
    for(let x=20;x<W;x+=90){ ctx.beginPath(); ctx.moveTo(x,surface[x]+16); ctx.lineTo(x+30,surface[x+30]+16); ctx.stroke(); }
    // hoa co
    for(let i=0;i<28;i++){ const x=(i*167+40)%W, y=surface[Math.round(x)]-4;
      ctx.fillStyle=i%3?'#f472b6':'#facc15'; ctx.beginPath(); ctx.arc(x,y,2.6,0,7); ctx.fill();
      ctx.strokeStyle='#16a34a'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+7); ctx.stroke(); }
  } else if(mapKey==='desert'){
    ctx.fillStyle='rgba(0,0,0,.12)';
    for(let x=10;x<W;x+=60){ ctx.beginPath(); ctx.ellipse(x,surface[x]+20,16,5,0.15,0,7); ctx.fill(); }
    // xuong rong vai cay
    decorSpots.forEach(d=>{ if(d.map!=='desert')return;
      ctx.fillStyle='#15803d'; ctx.fillRect(d.x-5,surface[d.x]-34,10,34);
      ctx.fillRect(d.x-14,surface[d.x]-28,7,14); ctx.fillRect(d.x+7,surface[d.x]-24,7,12);
      ctx.fillStyle='#f472b6'; ctx.beginPath(); ctx.arc(d.x,surface[d.x]-36,3.5,0,7); ctx.fill(); });
  } else {
    ctx.fillStyle='rgba(0,0,0,.25)';
    for(let i=0;i<22;i++){ const x=(i*211+60)%W; ctx.beginPath(); ctx.arc(x,surface[x]+18,4+(i%4)*2,0,7); ctx.fill(); }
  }
  // cay thong / co map doi
  if(mapKey==='hill'){
    decorSpots.forEach(d=>{ if(d.map!=='hill')return;
      const y=surface[d.x];
      ctx.fillStyle='#78350f'; ctx.fillRect(d.x-4,y-26,8,26);
      ctx.fillStyle='#15803d';
      ctx.beginPath(); ctx.moveTo(d.x,y-66); ctx.lineTo(d.x-17,y-30); ctx.lineTo(d.x+17,y-30); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#16a34a';
      ctx.beginPath(); ctx.moveTo(d.x,y-56); ctx.lineTo(d.x-12,y-30); ctx.lineTo(d.x+12,y-30); ctx.closePath(); ctx.fill(); });
  }
  ctx.restore();
}
function drawPlayer(p,idx){
  const isTurn=(idx===current&&gameActive);
  const t=Date.now()/300;
  const breathe=Math.sin(t+idx*2)*1.5;
  ctx.save(); ctx.translate(p.x,p.y);
  // bong do
  ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0,3,22,7,0,0,7); ctx.fill();
  // vong sang luot di
  if(isTurn){
    ctx.strokeStyle='#facc15'; ctx.lineWidth=3; ctx.setLineDash([8,5]); ctx.lineDashOffset=-t*4;
    ctx.shadowColor='#facc15'; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.arc(0,-24,32+Math.sin(t)*2,0,7); ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur=0;
    // mui ten nhay
    ctx.fillStyle='#facc15';
    const ay=-66+Math.sin(t*2)*5;
    ctx.beginPath(); ctx.moveTo(0,ay+12); ctx.lineTo(-9,ay); ctx.lineTo(9,ay); ctx.closePath(); ctx.fill();
  }
  const f=p.face;
  // chan
  ctx.fillStyle='#f97316';
  const step=(gameActive&&idx===current&&(keys['ArrowLeft']||keys['ArrowRight']||keys['KeyA']||keys['KeyD']))?Math.sin(t*4)*4:0;
  ctx.beginPath(); ctx.ellipse(-7,-6+Math.max(0,step),6,5,0,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7,-6+Math.max(0,-step),6,5,0,0,7); ctx.fill();
  // than (ga map ú)
  ctx.save(); ctx.shadowColor='rgba(0,0,0,.3)'; ctx.shadowBlur=8; ctx.shadowOffsetY=4;
  const bodyG=ctx.createLinearGradient(-18,0,18,0);
  if(idx===0){ bodyG.addColorStop(0,'#16a34a'); bodyG.addColorStop(0.5,'#4ade80'); bodyG.addColorStop(1,'#15803d'); }
  else { bodyG.addColorStop(0,'#dc2626'); bodyG.addColorStop(0.5,'#f87171'); bodyG.addColorStop(1,'#991b1b'); }
  ctx.fillStyle=bodyG;
  ctx.beginPath(); ctx.ellipse(0,-24+breathe*0.4,19,21+breathe,0,0,7); ctx.fill();
  ctx.restore();
  // bung trang
  ctx.fillStyle='rgba(255,255,255,.75)';
  ctx.beginPath(); ctx.ellipse(4*f,-18,9,11,0,0,7); ctx.fill();
  // canh
  ctx.fillStyle=idx===0?'#15803d':'#991b1b';
  const flap=Math.sin(t*1.5)*2;
  ctx.beginPath(); ctx.ellipse(-12*f,-24+flap,7,11,-0.5*f,0,7); ctx.fill();
  // mat to long lanh
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(7*f,-28,7.5,0,7); ctx.fill();
  ctx.fillStyle='#0f172a'; ctx.beginPath(); ctx.arc(9*f,-28,3.4,0,7); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(10*f,-29.5,1.2,0,7); ctx.fill();
  // mo
  ctx.fillStyle='#fb923c'; ctx.strokeStyle='#c2410c'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(12*f,-24); ctx.lineTo(22*f,-21); ctx.lineTo(12*f,-18); ctx.closePath(); ctx.fill(); ctx.stroke();
  // mao do 3 chop
  ctx.fillStyle='#ef4444'; ctx.strokeStyle='#991b1b'; ctx.lineWidth=1.5;
  [[-7,-42,5],[0,-46,6],[7,-42,5]].forEach(c=>{
    ctx.beginPath(); ctx.arc(c[0],c[1]+breathe*0.4,c[2],0,7); ctx.fill(); ctx.stroke(); });
  // sung xịn: than + dai vang + dau
  const rad=p.angle*Math.PI/180;
  const bx=Math.cos(rad)*30, by=-Math.sin(rad)*30-22;
  ctx.save(); ctx.lineCap='round';
  ctx.shadowColor='rgba(0,0,0,.4)'; ctx.shadowBlur=4;
  ctx.strokeStyle='#713f12'; ctx.lineWidth=10;
  ctx.beginPath(); ctx.moveTo(-2*f,-24); ctx.lineTo(bx,by); ctx.stroke();
  ctx.strokeStyle='#facc15'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-2*f,-24); ctx.lineTo(bx,by); ctx.stroke();
  ctx.shadowBlur=0;
  ctx.fillStyle='#1f2937'; ctx.beginPath(); ctx.arc(bx,by,7,0,7); ctx.fill();
  ctx.fillStyle='#374151'; ctx.beginPath(); ctx.arc(bx,by,3.5,0,7); ctx.fill();
  ctx.restore();
  ctx.restore();
  // bang ten dep
  ctx.save(); ctx.textAlign='center';
  const label=p.name+(p.isBot?' 🤖':'');
  ctx.font='bold 13px sans-serif';
  const wpx=ctx.measureText(label).width+16;
  ctx.fillStyle='rgba(2,6,23,.72)';
  ctx.beginPath(); ctx.roundRect(p.x-wpx/2,p.y-78,wpx,20,10); ctx.fill();
  if(isTurn){ ctx.strokeStyle='#facc15'; ctx.lineWidth=2; ctx.stroke(); }
  ctx.fillStyle='#fff'; ctx.fillText(label,p.x,p.y-64);
  // cay hp mini gradient
  ctx.fillStyle='rgba(0,0,0,.55)';
  ctx.beginPath(); ctx.roundRect(p.x-26,p.y-56,52,7,4); ctx.fill();
  const hpg=ctx.createLinearGradient(p.x-26,0,p.x+26,0);
  if(p.hp>50){hpg.addColorStop(0,'#16a34a');hpg.addColorStop(1,'#a3e635');}
  else if(p.hp>25){hpg.addColorStop(0,'#d97706');hpg.addColorStop(1,'#facc15');}
  else {hpg.addColorStop(0,'#991b1b');hpg.addColorStop(1,'#ef4444');}
  ctx.fillStyle=hpg;
  if(p.hp>0){ ctx.beginPath(); ctx.roundRect(p.x-26,p.y-56,52*(p.hp/100),7,4); ctx.fill(); }
  ctx.restore();
}
function drawAim(){
  if(!gameActive||bulletFlying) return;
  const p=players[current]; if(!p||p.isBot) return;
  const rad=p.angle*Math.PI/180, speed=4+p.power*0.11, g=MAPS[mapKey].gravity;
  let x=p.x+Math.cos(rad)*34, y=p.y-22-Math.sin(rad)*34;
  let vx=Math.cos(rad)*speed, vy=-Math.sin(rad)*speed;
  ctx.save();
  for(let s=0;s<60;s++){
    vy+=g; vx+=wind*0.004; x+=vx; y+=vy;
    if(s%2===0){
      ctx.globalAlpha=s<20?0.95:0.55;
      ctx.fillStyle=s<20?'#facc15':'#fb923c';
      ctx.beginPath(); ctx.arc(x,y,s<20?4.5:3.2,0,7); ctx.fill();
    }
    if(x>=0&&x<W&&y>=groundY(x)){
      // vong tron dich den
      ctx.globalAlpha=1; ctx.strokeStyle='#ef4444'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(x,y-6,14+Math.sin(Date.now()/150)*2,0,7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-20,y-6); ctx.lineTo(x+20,y-6); ctx.moveTo(x,y-26); ctx.lineTo(x,y+14); ctx.stroke();
      break;
    }
    if(x<-20||x>W+20||y>H) break;
  }
  ctx.restore();
  if(charging){
    ctx.save(); ctx.textAlign='center';
    ctx.font='900 16px sans-serif';
    ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.7)';
    ctx.strokeText('LỰC: '+Math.round(chargeVal), p.x, p.y-92);
    ctx.fillStyle=chargeVal>80?'#ef4444':(chargeVal>50?'#facc15':'#22c55e');
    ctx.fillText('LỰC: '+Math.round(chargeVal), p.x, p.y-92);
    ctx.restore();
  }
  if(aimDrag){
    ctx.save(); ctx.strokeStyle='#facc15'; ctx.lineWidth=3; ctx.setLineDash([7,5]);
    ctx.beginPath(); ctx.moveTo(aimDrag.x0,aimDrag.y0); ctx.lineTo(aimDrag.x1,aimDrag.y1); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }
}
function drawBullets(){
  // lua dau nong
  if(muzzle>0){
    const p=players[current];
    if(p){ const rad=p.angle*Math.PI/180;
      const mx=p.x+Math.cos(rad)*38, my=p.y-22-Math.sin(rad)*38;
      ctx.save(); ctx.globalAlpha=muzzle/6;
      ctx.fillStyle='#fde047'; ctx.beginPath(); ctx.arc(mx,my,10+muzzle*3,0,7); ctx.fill();
      ctx.fillStyle='#fb923c'; ctx.beginPath(); ctx.arc(mx,my,6+muzzle*2,0,7); ctx.fill();
      ctx.restore(); }
  }
  bullets.forEach(b=>{
    ctx.save();
    // duoi lua dep
    b.trail.forEach((t,i)=>{
      const k=i/b.trail.length;
      ctx.globalAlpha=k*0.6;
      ctx.fillStyle=k>0.6?'#fef08a':(k>0.3?'#fb923c':'#ef4444');
      ctx.beginPath(); ctx.arc(t.x,t.y,2+k*5,0,7); ctx.fill();
    });
    ctx.globalAlpha=1;
    ctx.shadowColor='#fb923c'; ctx.shadowBlur=14;
    const wb=b.w==='digger'?'#a855f7':(b.w==='triple'?'#22d3ee':'#1f2937');
    ctx.fillStyle=wb; ctx.beginPath(); ctx.arc(b.x,b.y,9,0,7); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='#fefce8'; ctx.beginPath(); ctx.arc(b.x-2.5,b.y-2.5,3.2,0,7); ctx.fill();
    // tia lua xoay
    ctx.strokeStyle='#fde047'; ctx.lineWidth=2;
    const ta=Date.now()/80;
    for(let i=0;i<3;i++){ const a=ta+i*2.1;
      ctx.beginPath(); ctx.moveTo(b.x+Math.cos(a)*10,b.y+Math.sin(a)*10);
      ctx.lineTo(b.x+Math.cos(a)*15,b.y+Math.sin(a)*15); ctx.stroke(); }
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
  drawBackground(); drawTerrain();
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
  if(muzzle>0) muzzle--;
  clouds.forEach(c=>{c.x+=c.v; if(c.x>W+80)c.x=-80;});
  particles.forEach(pt=>{pt.x+=pt.vx;pt.y+=pt.vy;pt.vy+=0.12;pt.life-=pt.decay;});
  particles=particles.filter(pt=>pt.life>0);
  floaters.forEach(f=>{f.y-=0.7;f.life-=0.014;});
  floaters=floaters.filter(f=>f.life>0);
  render();
  requestAnimationFrame(loop);
}
genTerrain(); initClouds(); loop();









