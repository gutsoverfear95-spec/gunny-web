/* global PIXI */
// ===== GUNNY PIXI — gameplay copy tu ban 2D, render = PixiJS WebGL =====
const W=1280,H=720;
let app=null, world=null, terrGfx=null, decoGfx=null, aimGfx=null, fxLayer=null, labelLayer=null;
let playerSprites=[], bulletSprites=[];
let fxOn=true, shakeT=0, shakeMag=0;
// ---- audio + state (giong ban 2D) ----
let soundOn=true,AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC;}
function beep(f,d,t,v,s){if(!soundOn)return;const c=ac();if(!c)return;t=t||'sine';v=v||0.2;s=s||0;const o=c.createOscillator(),g=c.createGain();o.type=t;o.frequency.setValueAtTime(f,c.currentTime);if(s)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+s),c.currentTime+d);g.gain.setValueAtTime(v,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+d);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+d);}
function noiseBurst(d,v){if(!soundOn)return;const c=ac();if(!c)return;d=d||0.5;v=v||0.35;const n=Math.floor(c.sampleRate*d),b=c.createBuffer(1,n,c.sampleRate),dd=b.getChannelData(0);for(let i=0;i<n;i++)dd[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);const s=c.createBufferSource();s.buffer=b;const g=c.createGain();g.gain.value=v;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=900;s.connect(f);f.connect(g);g.connect(c.destination);s.start();}
const SFX={shoot(){beep(300,0.35,'sawtooth',0.18,500);},boom(){noiseBurst(0.6,0.4);beep(90,0.5,'sine',0.3,-50);},hit(){beep(200,0.2,'square',0.15,-100);},turn(){beep(660,0.12,'sine',0.15);},win(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.3,'sine',0.2),i*160));},click(){beep(500,0.07,'sine',0.12);}};
const MAPS={
hill:{name:'Đồi Xanh',gravity:0.22,sky:[0x7dd3fc,0xbbf7d0],ground:0x4d7c0f,top:0x84cc16},
desert:{name:'Sa Mạc',gravity:0.22,sky:[0xfdba74,0xfde68a],ground:0xb45309,top:0xfbbf24},
moon:{name:'Mặt Trăng',gravity:0.11,sky:[0x020617,0x312e81],ground:0x64748b,top:0xcbd5e1},
beach:{name:'Bãi Biển',gravity:0.2,sky:[0x38bdf8,0xfefce8],ground:0xd4a24e,top:0xfde68a},
volcano:{name:'Núi Lửa',gravity:0.24,sky:[0x450a0a,0xf59e0b],ground:0x44403c,top:0xef4444},
ice:{name:'Băng Tuyết',gravity:0.2,sky:[0xbae6fd,0xffffff],ground:0x7dd3fc,top:0xf8fafc},
forest:{name:'Rừng Ma',gravity:0.22,sky:[0x052e16,0x4d7c0f],ground:0x3f3f46,top:0x4ade80}};
let mode='bot',difficulty='normal',mapKey='hill';
let surface=[],players=[],bullets=[],particles=[],floaters=[];
let current=0,turnNum=1,timer=30,timerId=null,wind=0;
let gameActive=false,bulletFlying=false,charging=false,chargeDir=1,chargeVal=60;
let aimDrag=null,maxDmg=0,lastWeapon='dua';
// ---- logic dat (giong het 2D) ----
function genTerrain(){surface=new Array(W);const base=H*0.62+(Math.random()*60-30);const f1=Math.random()*6.28,f2=Math.random()*6.28,f3=Math.random()*6.28;const a1=50+Math.random()*70,a2=20+Math.random()*35,a3=8+Math.random()*12;for(let x=0;x<W;x++){surface[x]=base+Math.sin(x*0.004+f1)*a1+Math.sin(x*0.009+f2)*a2+Math.sin(x*0.03+f3)*a3;surface[x]=Math.max(H*0.35,Math.min(H-70,surface[x]));}for(let x=20;x<180;x++)surface[x]=surface[x]*0.3+surface[180]*0.7;for(let x=W-180;x<W-20;x++)surface[x]=surface[x]*0.3+surface[W-180]*0.7;}
function groundY(x){x=Math.max(0,Math.min(W-1,Math.round(x)));return surface[x];}
function gunStat(key){const g=(typeof GUNS!=='undefined'&&GUNS[key])?GUNS[key]:{dmg:35,radius:70,dig:1};return{dmg:(typeof gunDmg!=='undefined')?gunDmg(key):g.dmg,radius:g.radius||70,dig:g.dig||1,count:g.count||1,bounce:g.bounce||0,heal:!!g.heal,color:g.color||'#333',icon:g.icon||''};}
function digHole(x,y,r,m){r=r*(m||1);for(let ix=Math.max(0,Math.floor(x-r));ix<=Math.min(W-1,Math.ceil(x+r));ix++){const dx=ix-x,dy=surface[ix]-y;if(dx*dx+dy*dy<r*r){const d=Math.sqrt(Math.max(0,r*r-dx*dx));surface[ix]=Math.max(surface[ix],y+d*0.9);if(surface[ix]>H-10)surface[ix]=H-10;}}drawTerrainPixi();}
function makePlayer(x,face,isBot,name,gunKey){const st=(typeof gearStats!=='undefined')?gearStats():{hp:0,fuel:0,pow:0};return{x:x,y:groundY(x),hp:100+st.hp,maxhp:100+st.hp,fuel:100+st.fuel,maxfuel:100+st.fuel,angle:face===1?35:145,power:60,ammo:'shot',gunKey:gunKey||'dua',face:face,color:face===1?'#22c55e':'#ef4444',isBot:!!isBot,name:name,powBonus:st.pow||0};}
function startGame(){genTerrain();drawTerrainPixi();bullets=[];particles=[];floaters=[];turnNum=1;maxDmg=0;const x1=90+Math.random()*60,x2=W-90-Math.random()*60;const myGun=(typeof profile!=='undefined')?profile.gun:'dua';const bg=['dua','bua','phao','tinhyeu','set'];const botGun=bg[Math.floor(Math.random()*bg.length)];players=[makePlayer(x1,1,false,'Gà 1',myGun),makePlayer(x2,-1,(mode==='bot'),mode==='bot'?'Máy':'Gà 2',(mode==='bot'?botGun:myGun))];buildPlayerSprites();current=0;bulletFlying=false;gameActive=true;document.getElementById('menu-screen').classList.add('hidden');document.getElementById('over-screen').classList.add('hidden');document.getElementById('hud').classList.remove('hidden');document.getElementById('controls').classList.remove('hidden');document.getElementById('hint-bar').classList.remove('hidden');newTurn(true);toast('Lượt của '+players[0].name+'!');}
function newWind(){wind=Math.round((Math.random()*2-1)*8*10)/10;}
function newTurn(first){if(!gameActive)return;if(!first){current=(current+1)%2;if(current===0)turnNum++;}const p=players[current];p.fuel=p.maxfuel||100;newWind();SFX.turn();syncWeaponUI();syncSliders();updateHUD();clearInterval(timerId);timer=30;updateTimerUI();timerId=setInterval(()=>{if(bulletFlying||!gameActive)return;timer--;updateTimerUI();if(timer<=0){clearInterval(timerId);toast('Hết giờ!');setTimeout(()=>nextAfterShot(),600);}},1000);if(p.isBot)setTimeout(botPlay,1200);}
function updateTimerUI(){document.getElementById('timer-val').textContent=timer;document.getElementById('timer-box').classList.toggle('danger',timer<=5);}
function angleRad(p){return p.angle*Math.PI/180;}
function fire(){if(!gameActive||bulletFlying)return;const p=players[current];if(p.isBot)return;doFire(p);}
function doFire(p){clearInterval(timerId);bulletFlying=true;document.getElementById('fire-btn').disabled=true;const gk=p.gunKey||'dua';lastWeapon=gk;const st=gunStat(gk);let dmg=st.dmg,radius=st.radius,dig=st.dig,count=st.count;if(p.ammo==='skill'&&!st.heal){dmg=Math.round(dmg*1.6);radius=Math.round(radius*1.3);if(count>1)count+=2;}if(p.powBonus)dmg=Math.round(dmg*(1+p.powBonus*0.02));const rad=angleRad(p),speed=4+p.power*0.11;const sx=p.x+Math.cos(rad)*28,sy=p.y-30-Math.sin(rad)*22;const mk=(off)=>({x:sx,y:sy,vx:Math.cos(rad)*speed+(off||0),vy:-Math.sin(rad)*speed,trail:[],w:gk,dmg:dmg,radius:radius,dig:dig,bounce:st.bounce,heal:st.heal,color:st.color,icon:st.icon,owner:players.indexOf(p)});if(count>1)for(let i=0;i<count;i++)bullets.push(mk((i-(count-1)/2)*0.9));else bullets.push(mk(0));SFX.shoot();p.x-=Math.cos(rad)*2;muzzleFlash(p);}
function updateBullets(){const g=MAPS[mapKey].gravity;for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.trail.push({x:b.x,y:b.y});if(b.trail.length>22)b.trail.shift();b.vy+=g;b.vx+=wind*0.004;b.x+=b.vx;b.y+=b.vy;if(b.x<-40||b.x>W+40||b.y>H+40){bullets.splice(i,1);continue;}if(b.y>=groundY(b.x)){if((b.bounce||0)>0){b.bounce--;b.y=groundY(b.x)-4;b.vy=-Math.abs(b.vy)*0.55;b.vx*=0.8;continue;}explode(b.x,Math.min(b.y,groundY(b.x)),b);bullets.splice(i,1);continue;}for(let pi=0;pi<players.length;pi++){const p=players[pi];const dx=b.x-p.x,dy=b.y-(p.y-20);if(dx*dx+dy*dy<22*22){explode(b.x,b.y,b);bullets.splice(i,1);break;}}}syncBulletSprites();if(bulletFlying&&bullets.length===0){setTimeout(()=>{settlePlayers();checkEnd()?null:nextAfterShot();},900);bulletFlying=false;document.getElementById('fire-btn').disabled=false;}}
function explode(x,y,b){const dmg0=(b&&typeof b.dmg==='number')?b.dmg:35;const radius=(b&&b.radius)||70,dig=(b&&b.dig)||1;const isHeal=!!(b&&b.heal),owner=(b&&typeof b.owner==='number')?b.owner:0;lastWeapon=(b&&b.w)||lastWeapon;SFX.boom();spawnBoom(x,y,radius,(b&&b.color)||'#fb923c',isHeal);shakeMag=Math.min(14,radius/6);shakeT=22;digHole(x,y,radius,dig);players.forEach((p,idx)=>{const dx=p.x-x,dy=(p.y-18)-y,d=Math.sqrt(dx*dx+dy*dy);if(d<radius+26){const fall=1-d/(radius+30);if(isHeal){let heal=Math.round((-dmg0)*(0.5+0.5*fall));if(heal<5)heal=5;p.hp=Math.min(p.maxhp||120,p.hp+heal);spawnLabel(p.x,p.y-90,'+'+heal,'#22ff88');}else{let dmg=Math.round(dmg0*(0.4+0.6*fall));if(idx===owner)dmg=Math.round(dmg*0.5);if(dmg<1)dmg=1;p.hp=Math.max(0,p.hp-dmg);spawnLabel(p.x,p.y-90,'-'+dmg,dmg>=30?'#ff5555':'#ffdd33');if(dmg>maxDmg&&idx!==owner)maxDmg=dmg;p.x+=(dx>=0?1:-1)*fall*14;p.x=Math.max(20,Math.min(W-20,p.x));if(idx!==owner)SFX.hit();}}});syncPlayerSprites();updateHUD();}
function settlePlayers(){players.forEach(p=>{p.y=groundY(p.x);});syncPlayerSprites();}
function nextAfterShot(){if(!gameActive)return;settlePlayers();newTurn(false);}
function checkEnd(){if(players[0].hp<=0||players[1].hp<=0){gameOver();return true;}return false;}
function gameOver(){gameActive=false;clearInterval(timerId);SFX.win();let title;if(players[0].hp<=0&&players[1].hp<=0)title='🤝 HÒA NHAU!';else if(players[1].hp<=0)title='🏆 '+players[0].name.toUpperCase()+' THẮNG!';else title='🏆 '+players[1].name.toUpperCase()+' THẮNG!';let reward=100+Math.floor(Math.random()*100)+turnNum*10;if(typeof profile!=='undefined'){profile.gold+=reward;saveProfile();}document.getElementById('over-title').textContent=title;document.getElementById('over-stats').textContent='Số hiệp: '+turnNum+' • Đòn đau nhất: '+maxDmg+' • +'+reward+' vàng';document.getElementById('over-screen').classList.remove('hidden');}
function simDist(sx,sy,angle,power,tx,ty){const g=MAPS[mapKey].gravity,rad=angle*Math.PI/180,speed=4+power*0.11;let x=sx,y=sy,vx=Math.cos(rad)*speed,vy=-Math.sin(rad)*speed;for(let s=0;s<250;s++){vy+=g;vx+=wind*0.004;x+=vx;y+=vy;if(x<-40||x>W+40||y>H+40)return 9999;const dx=x-tx,dy=y-(ty-20);if(dx*dx+dy*dy<24*24)return 0;if(x>=0&&x<W&&y>=groundY(x))return Math.abs(x-tx)+Math.abs(y-ty)*0.5;}return 9999;}
function botPlay(){if(!gameActive||bulletFlying)return;const me=players[current];if(!me.isBot)return;me.ammo=Math.random()<0.3?'skill':'shot';const sx=me.x,sy=me.y-30,foe=players[1-current];let best={a:me.face===1?45:135,p:60,d:1e9};for(let a=15;a<=165;a+=5)for(let p=20;p<=100;p+=5){const d=simDist(sx,sy,a,p,foe.x,foe.y);if(d<best.d){best={a:a,p:p,d:d};if(d===0)break;}}let eA=4,eP=6;if(difficulty==='easy'){eA=9;eP=13;}if(difficulty==='hard'){eA=1.6;eP=2.6;}me.angle=Math.max(10,Math.min(170,best.a+(Math.random()*2-1)*eA));me.power=Math.max(10,Math.min(100,best.p+(Math.random()*2-1)*eP));syncWeaponUI();syncSliders();updateHUD();toast('Máy đang ngắm...');setTimeout(()=>{if(gameActive&&players[current]===me)doFire(me);},900);}
function pct(v,m){return Math.max(0,Math.min(100,Math.round(v/m*100)));}
function updateHUD(){if(!players.length)return;document.getElementById('hp1-fill').style.width=pct(players[0].hp,players[0].maxhp||100)+'%';document.getElementById('hp1-text').textContent=Math.ceil(players[0].hp)+'/'+(players[0].maxhp||100);document.getElementById('hp2-fill').style.width=pct(players[1].hp,players[1].maxhp||100)+'%';document.getElementById('hp2-text').textContent=Math.ceil(players[1].hp)+'/'+(players[1].maxhp||100);document.getElementById('fuel1').textContent='⛽ '+Math.round(players[0].fuel);document.getElementById('fuel2').textContent='⛽ '+Math.round(players[1].fuel);document.getElementById('wind-val').textContent=Math.abs(wind).toFixed(1);document.getElementById('wind-arrow').textContent=wind===0?'•':(wind>0?'→':'←');const p=players[current],gk=p?(p.gunKey||'dua'):'dua';const g=(typeof GUNS!=='undefined'&&GUNS[gk])?GUNS[gk]:{name:gk,icon:''};document.getElementById('turn-label').textContent='Lượt '+turnNum+': '+p.name+' • '+(g.icon||'')+' '+g.name;document.getElementById('turn-dot-1').classList.toggle('on',current===0&&gameActive);const d2=document.getElementById('turn-dot-2');if(d2)d2.classList.toggle('on',current===1&&gameActive);}
function syncSliders(){const p=players[current];if(!p)return;document.getElementById('angle-slider').value=Math.round(p.angle);document.getElementById('angle-val').textContent=Math.round(p.angle)+'°';document.getElementById('power-val').textContent=Math.round(p.power);const nd=document.getElementById('power-needle');if(nd)nd.style.left=p.power+'%';}
function syncWeaponUI(){const p=players[current];if(!p)return;const bs=document.querySelectorAll('.wpn-btn');for(let i=0;i<bs.length;i++)bs[i].classList.toggle('active',bs[i].dataset.wpn===(p.ammo||'shot'));}
let toastId=null;function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(toastId);toastId=setTimeout(()=>t.classList.remove('show'),2200);}
// ===== PIXI RENDER =====
function css(h){return parseInt(String(h).replace('#',''),16);}
function initPixi(){
  app=new PIXI.Application({width:W,height:H,backgroundColor:0x87ceeb,antialias:true});
  document.getElementById('pixi-wrap').appendChild(app.view);
  world=new PIXI.Container();app.stage.addChild(world);
  terrGfx=new PIXI.Graphics();world.addChild(terrGfx);
  decoGfx=new PIXI.Graphics();world.addChild(decoGfx);
  aimGfx=new PIXI.Graphics();world.addChild(aimGfx);
  fxLayer=new PIXI.Container();world.addChild(fxLayer);
  labelLayer=new PIXI.Container();world.addChild(labelLayer);
  app.ticker.add(gameTick);
  // tuong tac keo ngam
  app.view.addEventListener('mousedown',e=>{if(!gameActive||bulletFlying)return;const p=players[current];if(!p||p.isBot)return;aimDrag={x0:p.x,y0:p.y-22,moved:false};});
  app.view.addEventListener('mousemove',e=>{if(!aimDrag)return;const p=players[current];if(!p)return;const r=app.view.getBoundingClientRect();const mx=(e.clientX-r.left)*W/r.width;const dx=aimDrag.x0-mx;let ang=Math.atan2(250,dx)*180/Math.PI;if(ang<0)ang+=360;if(ang>180)ang=(ang>270?5:175);p.angle=Math.round(Math.max(10,Math.min(170,ang)));const dist=Math.min(400,Math.abs(dx));p.power=Math.round(15+dist/400*85);syncSliders();updateHUD();});
  window.addEventListener('mouseup',()=>{aimDrag=null;});
  genTerrain();drawTerrainPixi();
}
function drawTerrainPixi(){
  if(!terrGfx)return;
  const m=MAPS[mapKey];
  terrGfx.clear();decoGfx.clear();
  // nen troi gradient
  const bg=new PIXI.Graphics();
  // xoa nen cu
  world.removeChildren();
  world.addChild(bg);world.addChild(terrGfx);world.addChild(decoGfx);world.addChild(aimGfx);world.addChild(fxLayer);world.addChild(labelLayer);
  const c1=css('#'+m.sky[0].toString(16).padStart(6,'0')),c2=css('#'+m.sky[1].toString(16).padStart(6,'0'));
  for(let i=0;i<24;i++){bg.beginFill(PIXI.utils.rgb2hex([lerpC(m.sky[0],m.sky[1],i/24)]));bg.drawRect(0,i*H/24,W,H/24+1);bg.endFill();}
  function lerpC(a,b,t){const ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255,br=(b>>16)&255,bg2=(b>>8)&255,bb=b&255;return [((ar+(br-ar)*t)/255),((ag+(bg2-ag)*t)/255),((ab+(bb-ab)*t)/255)];}
  // mat troi / sao
  if(mapKey==='moon'){bg.beginFill(0xffffff);for(let i=0;i<80;i++){bg.drawCircle((i*173)%W,(i*97)%260,1.5);}bg.endFill();
    bg.beginFill(0xfefce8);bg.drawCircle(1050,110,46);bg.endFill();}
  else{bg.beginFill(0xfff7cc);bg.drawCircle(1120,100,42);bg.endFill();
    bg.beginFill(0xffffff,0.35);bg.drawCircle(1120,100,60);bg.endFill();}
  // may
  bg.beginFill(0xffffff,0.9);
  for(let i=0;i<6;i++){const cx=(i*260+80)%W,cy=60+(i*37)%140;bg.drawEllipse(cx,cy,44,18);bg.drawEllipse(cx+28,cy+5,30,14);bg.drawEllipse(cx-28,cy+6,26,13);}
  bg.endFill();
  // nui xa
  bg.beginFill(0x6b8f71,0.5);
  bg.moveTo(0,520);for(let x=0;x<=W;x+=40)bg.lineTo(x,430+Math.sin(x*0.008+2)*60);bg.lineTo(W,H);bg.lineTo(0,H);bg.endFill();
  // dat
  terrGfx.beginFill(m.ground);
  terrGfx.moveTo(0,H);
  for(let x=0;x<W;x+=4)terrGfx.lineTo(x,surface[x]||H*0.6);
  terrGfx.lineTo(W,H);terrGfx.endFill();
  terrGfx.lineStyle(8,m.top);
  terrGfx.moveTo(0,surface[0]||H*0.6);
  for(let x=4;x<W;x+=4)terrGfx.lineTo(x,surface[x]);
  // cay
  for(let i=0;i<8;i++){const x=140+i*140+Math.random()*40;const y=surface[Math.round(x)]||H*0.6;
    decoGfx.beginFill(0x78350f);decoGfx.drawRect(x-4,y-26,8,26);decoGfx.endFill();
    decoGfx.beginFill(0x15803d);decoGfx.moveTo(x,y-66);decoGfx.lineTo(x-17,y-30);decoGfx.lineTo(x+17,y-30);decoGfx.endFill();}
}
// ga = container ve bang Graphics
function makeChickenPixi(p,idx){
  const c=new PIXI.Container();
  const bodyC=p.face===1?0x4ade80:0xf87171;
  const darkC=p.face===1?0x15803d:0x991b1b;
  const g=new PIXI.Graphics();
  // bong
  g.beginFill(0x000000,0.25);g.drawEllipse(0,2,20,6);g.endFill();
  // chan
  g.beginFill(0xf97316);g.drawEllipse(-7,-6,6,5);g.drawEllipse(7,-6,6,5);g.endFill();
  // than
  g.beginFill(bodyC);g.drawEllipse(0,-24,19,21);g.endFill();
  g.beginFill(0xffffff,0.75);g.drawEllipse(5,-18,9,11);g.endFill();
  // canh
  g.beginFill(darkC);g.drawEllipse(-12,-24,7,11);g.endFill();
  // mat
  g.beginFill(0xffffff);g.drawCircle(7,-28,7.5);g.endFill();
  g.beginFill(0x0f172a);g.drawCircle(9,-28,3.4);g.endFill();
  // mo
  g.beginFill(0xfb923c);g.moveTo(12,-24);g.lineTo(22,-21);g.lineTo(12,-18);g.endFill();
  // mao
  g.beginFill(0xef4444);g.drawCircle(-7,-42,5);g.drawCircle(0,-46,6);g.drawCircle(7,-42,5);g.endFill();
  c.addChild(g);
  // sung
  const gun=new PIXI.Graphics();
  const rad=p.angle*Math.PI/180;
  const bx=Math.cos(rad)*30,by=-Math.sin(rad)*30-22;
  gun.lineStyle(10,0x713f12);gun.moveTo(0,-24);gun.lineTo(bx,by);
  const gc=css((typeof GUNS!=='undefined'&&GUNS[p.gunKey])?GUNS[p.gunKey].color:'#facc15');
  gun.beginFill(gc);gun.drawCircle(bx,by,9);gun.endFill();
  gun.beginFill(0xffffff);gun.drawCircle(bx-2,by-2,3.5);gun.endFill();
  c.addChild(gun);c.userData.gun=gun;
  // nhan ten
  const label=new PIXI.Text(p.name+' '+((typeof GUNS!=='undefined'&&GUNS[p.gunKey])?GUNS[p.gunKey].icon:''),{fontSize:14,fill:0xffffff,stroke:0x000000,strokeThickness:4});
  label.anchor.set(0.5);label.position.set(0,-72);c.addChild(label);
  // hp bar
  const hpbg=new PIXI.Graphics();hpbg.beginFill(0x000000,0.6);hpbg.drawRoundedRect(-26,-58,52,8,4);hpbg.endFill();c.addChild(hpbg);
  const hpf=new PIXI.Graphics();c.addChild(hpf);c.userData.hpf=hpf;
  // vong turn
  const ring=new PIXI.Graphics();ring.lineStyle(3,0xfacc15);ring.drawCircle(0,-24,32);c.addChild(ring);c.userData.ring=ring;
  c.position.set(p.x,p.y);
  return c;
}
function buildPlayerSprites(){
  for(let i=0;i<playerSprites.length;i++)world.removeChild(playerSprites[i]);
  playerSprites=[];
  for(let i=0;i<players.length;i++){const s=makeChickenPixi(players[i],i);world.addChild(s);playerSprites.push(s);}
  syncPlayerSprites();
}
function syncPlayerSprites(){
  for(let i=0;i<players.length&&i<playerSprites.length;i++){
    const p=players[i],s=playerSprites[i];
    s.position.set(p.x,p.y);
    const gun=s.userData.gun;gun.clear();
    const rad=p.angle*Math.PI/180,bx=Math.cos(rad)*30,by=-Math.sin(rad)*30-22;
    gun.lineStyle(10,0x713f12);gun.moveTo(0,-24);gun.lineTo(bx,by);
    const gc=css((typeof GUNS!=='undefined'&&GUNS[p.gunKey])?GUNS[p.gunKey].color:'#facc15');
    gun.beginFill(gc);gun.drawCircle(bx,by,9);gun.endFill();
    s.userData.ring.visible=(i===current&&gameActive);
    const hpf=s.userData.hpf;hpf.clear();
    const pct2=Math.max(0,p.hp/(p.maxhp||100));
    hpf.beginFill(p.hp>50?0x22c55e:(p.hp>25?0xfacc15:0xef4444));hpf.drawRoundedRect(-26,-58,52*pct2,8,4);hpf.endFill();
  }
}
function syncBulletSprites(){
  for(let i=0;i<bulletSprites.length;i++)world.removeChild(bulletSprites[i]);
  bulletSprites=[];
  for(let i=0;i<bullets.length;i++){const b=bullets[i];
    const g=new PIXI.Graphics();
    for(let j=0;j<b.trail.length;j++){const k=j/b.trail.length;g.beginFill(0xfb923c,k*0.5);g.drawCircle(b.trail[j].x,b.trail[j].y,2+k*5);g.endFill();}
    g.beginFill(css(b.color||'#333333'));g.drawCircle(b.x,b.y,9);g.endFill();
    g.beginFill(0xffffff);g.drawCircle(b.x-2,b.y-2,3.2);g.endFill();
    world.addChild(g);bulletSprites.push(g);}
}
// fx: no + nhan + duong ngam
function spawnBoom(x,y,radius,color,heal){
  const n=fxOn?60:25;
  for(let i=0;i<n;i++){
    const g=new PIXI.Graphics();
    const cols=heal?[0x38bdf8,0xa5f3fc,0x22c55e]:[0xfacc15,0xfb923c,0xef4444];
    g.beginFill(cols[i%3]);const s=2+Math.random()*5;g.drawCircle(0,0,s);g.endFill();
    g.position.set(x,y);
    fxLayer.addChild(g);
    const a=Math.random()*6.28,sp=1+Math.random()*6;
    particles.push({s:g,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,life:1,decay:0.02});
  }
  const flash=new PIXI.Graphics();flash.beginFill(heal?0x38bdf8:0xffe08a,0.9);flash.drawCircle(x,y,radius*0.7);flash.endFill();
  fxLayer.addChild(flash);particles.push({s:flash,vx:0,vy:0,life:1,decay:0.1,flash:true});
  // mau sung theo mau dan
  try{const gc=css(color||'#fb923c');const ring=new PIXI.Graphics();ring.lineStyle(5,gc);ring.drawCircle(x,y,10);ring.endFill();fxLayer.addChild(ring);particles.push({s:ring,vx:0,vy:0,life:1,decay:0.05,ring:true,maxR:radius*2});}catch(e){}
}
function muzzleFlash(p){
  const g=new PIXI.Graphics();g.beginFill(0xfde047);const rad=p.angle*Math.PI/180;
  g.drawCircle(p.x+Math.cos(rad)*38,p.y-22-Math.sin(rad)*30,14);g.endFill();
  fxLayer.addChild(g);particles.push({s:g,vx:0,vy:0,life:1,decay:0.15,flash:true});
}
function spawnLabel(x,y,text,color){
  const t=new PIXI.Text(text,{fontSize:30,fontWeight:'900',fill:color,stroke:0x000000,strokeThickness:5});
  t.anchor.set(0.5);t.position.set(x,y);labelLayer.addChild(t);
  floaters.push({s:t,life:1});
}
function drawAimPixi(){
  aimGfx.clear();
  if(!gameActive||bulletFlying)return;
  const p=players[current];if(!p||p.isBot)return;
  const rad=p.angle*Math.PI/180,speed=4+p.power*0.11,g=MAPS[mapKey].gravity;
  let x=p.x+Math.cos(rad)*34,y=p.y-22-Math.sin(rad)*34;
  let vx=Math.cos(rad)*speed,vy=-Math.sin(rad)*speed;
  aimGfx.beginFill(0xfacc15);
  for(let s=0;s<60;s++){vy+=g;vx+=wind*0.004;x+=vx;y+=vy;
    if(s%2===0)aimGfx.drawCircle(x,y,s<20?4.5:3.2);
    if(x>=0&&x<W&&y>=groundY(x)){aimGfx.endFill();aimGfx.lineStyle(3,0xef4444);aimGfx.drawCircle(x,y-6,14);break;}
    if(x<-20||x>W+20||y>H)break;}
  aimGfx.endFill();
}
// dieu khien + loop
const keys={};
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.code)>=0)e.preventDefault();if(e.repeat)return;keys[e.code]=true;if(!gameActive)return;const p=players[current];if(!p||p.isBot||bulletFlying)return;if(e.code==='Space'){charging=true;chargeVal=10;chargeDir=1;}});
window.addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Space'&&charging){charging=false;const p=players[current];if(p&&!p.isBot&&gameActive&&!bulletFlying){p.power=Math.round(chargeVal);syncSliders();updateHUD();doFire(p);}const gh=document.getElementById('power-ghost');if(gh)gh.style.width='0%';}});
function handleKeys(){if(!gameActive||bulletFlying)return;const p=players[current];if(!p||p.isBot)return;let moved=false;if(keys['ArrowLeft']||keys['KeyA']){if(p.fuel>0){p.x=Math.max(20,p.x-2.4);p.fuel-=0.7;p.face=-1;moved=true;}}if(keys['ArrowRight']||keys['KeyD']){if(p.fuel>0){p.x=Math.min(W-20,p.x+2.4);p.fuel-=0.7;p.face=1;moved=true;}}if(keys['ArrowUp']||keys['KeyW']){p.angle=Math.min(170,p.angle+1);syncSliders();}if(keys['ArrowDown']||keys['KeyS']){p.angle=Math.max(10,p.angle-1);syncSliders();}if(moved){p.y=groundY(p.x);updateHUD();syncPlayerSprites();}if(charging){chargeVal+=chargeDir*1.6;if(chargeVal>=100){chargeVal=100;chargeDir=-1;}if(chargeVal<=10){chargeVal=10;chargeDir=1;}p.power=Math.round(chargeVal);const nd=document.getElementById('power-needle');if(nd)nd.style.left=chargeVal+'%';const gh=document.getElementById('power-ghost');if(gh)gh.style.width=chargeVal+'%';document.getElementById('power-val').textContent=Math.round(chargeVal);}}
function gameTick(){
  handleKeys();
  if(gameActive)updateBullets();
  for(let i=particles.length-1;i>=0;i--){const pt=particles[i];pt.life-=pt.decay;if(pt.life<=0){fxLayer.removeChild(pt.s);particles.splice(i,1);continue;}if(!pt.flash&&!pt.ring){pt.s.position.x+=pt.vx;pt.s.position.y+=pt.vy;pt.vy+=0.12;}if(pt.flash)pt.s.alpha=pt.life;if(pt.ring){const s=1+(1-pt.life)*2;pt.s.scale.set(s,s);pt.s.alpha=pt.life;}}
  for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];if(!f.s)continue;f.life-=0.014;f.s.position.y-=0.9;f.s.alpha=Math.max(0,f.life);if(f.life<=0){labelLayer.removeChild(f.s);floaters.splice(i,1);}}
  drawAimPixi();syncBulletSprites();
  if(shakeT>0){world.position.x=(Math.random()-0.5)*shakeMag;world.position.y=(Math.random()-0.5)*shakeMag;shakeT--;}else{world.position.x=0;world.position.y=0;}
  const t=Date.now()/300;
  for(let i=0;i<playerSprites.length;i++){playerSprites[i].position.y=players[i].y+Math.sin(t+i*2)*1.5;}
}
// menu
document.getElementById('angle-slider').addEventListener('input',e=>{const p=players[current];if(!p||p.isBot||bulletFlying)return;p.angle=+e.target.value;document.getElementById('angle-val').textContent=p.angle+'°';updateHUD();});
const _w=document.querySelectorAll('.wpn-btn');for(let i=0;i<_w.length;i++)_w[i].addEventListener('click',function(){const p=players[current];if(!p||bulletFlying||!gameActive||p.isBot)return;p.ammo=this.dataset.wpn;SFX.click();syncWeaponUI();updateHUD();});
document.getElementById('fire-btn').addEventListener('click',fire);
document.getElementById('again-btn').addEventListener('click',()=>{SFX.click();startGame();});
function goHome(){gameActive=false;clearInterval(timerId);document.getElementById('over-screen').classList.add('hidden');document.getElementById('hud').classList.add('hidden');document.getElementById('controls').classList.add('hidden');document.getElementById('hint-bar').classList.add('hidden');document.getElementById('menu-screen').classList.remove('hidden');}
document.getElementById('home-btn').addEventListener('click',goHome);
document.getElementById('menu-btn').addEventListener('click',goHome);
document.getElementById('sound-btn').addEventListener('click',function(){soundOn=!soundOn;this.textContent=soundOn?'🔊':'🔇';});
document.getElementById('fx-btn').addEventListener('click',function(){fxOn=!fxOn;this.textContent=fxOn?'✨ FX':'⬜ FX';toast(fxOn?'Đã bật hiệu ứng':'Đã giảm hiệu ứng');});
const _m=document.querySelectorAll('.mode-btn');for(let i=0;i<_m.length;i++)_m[i].addEventListener('click',function(){const a=document.querySelectorAll('.mode-btn');for(let j=0;j<a.length;j++)a[j].classList.remove('active');this.classList.add('active');mode=this.dataset.mode;SFX.click();});
const _d=document.querySelectorAll('.diff-btn');for(let i=0;i<_d.length;i++)_d[i].addEventListener('click',function(){const a=document.querySelectorAll('.diff-btn');for(let j=0;j<a.length;j++)a[j].classList.remove('active');this.classList.add('active');difficulty=this.dataset.diff;SFX.click();});
const _mp=document.querySelectorAll('.map-btn');for(let i=0;i<_mp.length;i++)_mp[i].addEventListener('click',function(){const a=document.querySelectorAll('.map-btn');for(let j=0;j<a.length;j++)a[j].classList.remove('active');this.classList.add('active');mapKey=this.dataset.map;SFX.click();genTerrain();drawTerrainPixi();});
document.getElementById('start-btn').addEventListener('click',()=>{ac();SFX.click();startGame();});
if(window.PIXI){initPixi();}else{document.getElementById('p-banner').innerHTML+=' <b style="color:#f87171">(Không tải được PixiJS - cần mạng!)</b>';}
