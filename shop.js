// ===== SHOP PART 1 =====
let shopTab='guns';
function openShop(){ document.getElementById('shop-screen').classList.remove('hidden'); renderShop(); }
function closeShop(){ document.getElementById('shop-screen').classList.add('hidden'); refreshMenuGear(); }
function enhanceCost(type,lv){ const b={gun:200,mu:120,ao:120,giay:120}[type]||150; return Math.round(b*(1+lv*0.9)); }
function enhanceRate(lv){ if(lv<3)return 100; if(lv<6)return 85; if(lv<9)return 65; if(lv<12)return 45; return 30; }
function renderShop(){
  document.getElementById('shop-gold').textContent=profile.gold;
  const tabs=document.querySelectorAll('.shop-tab');
  for(let i=0;i<tabs.length;i++) tabs[i].classList.toggle('active',tabs[i].dataset.tab===shopTab);
  const list=document.getElementById('shop-list');
  let html='';
  if(shopTab==='guns'){
    const keys=Object.keys(GUNS);
    for(let i=0;i<keys.length;i++){
      const k=keys[i], g=GUNS[k];
      const owned=profile.guns.indexOf(k)>=0, eq=profile.gun===k;
      let btn;
      if(owned) btn = eq ? '<button class="mini-btn done" disabled>Đang dùng</button>' : '<button class="mini-btn use" data-act="equip-gun" data-k="'+k+'">Dùng</button>';
      else btn = '<button class="mini-btn buy" data-act="buy-gun" data-k="'+k+'">Mua '+g.price+'</button>';
      const stat = g.heal ? ('Hồi '+(-g.dmg)+' HP') : ('Dmg '+g.dmg+' - Nổ '+g.radius);
      html+='<div class="shop-item"><div class="shop-icon">'+g.icon+'</div><div class="shop-info"><b>'+g.name+'</b><span>'+stat+'</span><i>'+g.desc+'</i></div>'+btn+'</div>';
    }
  } else if(shopTab==='armor'){
    const keys=Object.keys(ARMORS);
    for(let i=0;i<keys.length;i++){
      const k=keys[i], a=ARMORS[k];
      const owned=profile.ownedArmor.indexOf(k)>=0, eq=profile.armor[a.slot]===k;
      let btn;
      if(owned) btn = eq ? '<button class="mini-btn done" disabled>Đang mặc</button>' : '<button class="mini-btn use" data-act="equip-armor" data-k="'+k+'">Mặc</button>';
      else btn = '<button class="mini-btn buy" data-act="buy-armor" data-k="'+k+'">Mua '+a.price+'</button>';
      html+='<div class="shop-item"><div class="shop-icon">'+a.icon+'</div><div class="shop-info"><b>'+a.name+'</b><span>+'+a.hp+' HP +'+a.fuel+' xang</span><i>O: '+a.slot+'</i></div>'+btn+'</div>';
    }
  } else if(shopTab==='enhance'){
    const items=[['gun','Súng'],['mu','Mũ'],['ao','Áo'],['giay','Giày']];
    for(let i=0;i<items.length;i++){
      const type=items[i][0], lv=(profile.enhance||{})[type]||0;
      html+='<div class="shop-item"><div class="shop-icon">🔨</div><div class="shop-info"><b>'+items[i][1]+' +'+lv+'</b><span>Ti le '+enhanceRate(lv)+'% - Phi '+enhanceCost(type,lv)+' vang</span></div><button class="mini-btn forge" data-act="forge" data-k="'+type+'">Đập +'+(lv+1)+'</button></div>';
    }
  } else {
    const st=gearStats();
    html='<div class="my-box">Súng: '+GUNS[profile.gun].name+' +'+profile.enhance.gun+' | HP +'+st.hp+' Xăng +'+st.fuel+' | Vàng: '+profile.gold+'</div>';
    for(let i=0;i<profile.guns.length;i++) html+='<span class="owned-tag">'+GUNS[profile.guns[i]].icon+' '+GUNS[profile.guns[i]].name+'</span> ';
  }
  list.innerHTML=html;
  const btns=list.querySelectorAll('button[data-act]');
  for(let i=0;i<btns.length;i++) btns[i].addEventListener('click',function(){ shopAction(this.dataset.act,this.dataset.k); });
}
function refreshMenuGear(){
  const g=GUNS[profile.gun];
  const mg=document.getElementById('menu-gun');
  if(mg) mg.textContent=g.icon+' '+g.name+' +'+profile.enhance.gun;
  const el=document.getElementById('menu-gear');
  if(el) el.textContent=ARMORS[profile.armor.mu].name+' - '+ARMORS[profile.armor.ao].name+' - '+ARMORS[profile.armor.giay].name+' - HP +'+gearStats().hp;
}
function shopAction(act,k){
  if(act==='buy-gun'){
    const g=GUNS[k];
    if(profile.gold<g.price){ toast('Không đủ vàng!'); return; }
    profile.gold-=g.price; profile.guns.push(k); profile.gun=k;
    saveProfile(); toast('Đã mua '+g.name+'!');
  } else if(act==='equip-gun'){
    profile.gun=k; saveProfile(); toast('Đã trang bị '+GUNS[k].name);
  } else if(act==='buy-armor'){
    const a=ARMORS[k];
    if(profile.gold<a.price){ toast('Không đủ vàng!'); return; }
    profile.gold-=a.price; profile.ownedArmor.push(k); profile.armor[a.slot]=k;
    saveProfile(); toast('Đã mua '+a.name+'!');
  } else if(act==='equip-armor'){
    profile.armor[ARMORS[k].slot]=k; saveProfile(); toast('Đã mặc '+ARMORS[k].name);
  } else if(act==='forge'){
    const lv=profile.enhance[k]||0, cost=enhanceCost(k,lv), rate=enhanceRate(lv);
    if(profile.gold<cost){ toast('Không đủ vàng đập đồ!'); return; }
    profile.gold-=cost;
    if(Math.random()*100<rate){ profile.enhance[k]=lv+1; saveProfile(); toast('Đập thành công +'+(lv+1)+'!'); }
    else { saveProfile(); toast('Xịt rồi! Vẫn +'+lv); }
  }
  renderShop();
}
function initShopUI(){
  refreshMenuGear();
  const tabs=document.querySelectorAll('.shop-tab');
  for(let i=0;i<tabs.length;i++) tabs[i].addEventListener('click',function(){ shopTab=this.dataset.tab; renderShop(); });
  document.getElementById('shop-close').addEventListener('click',closeShop);
  document.getElementById('open-shop').addEventListener('click',openShop);
  document.getElementById('shop-btn').addEventListener('click',openShop);
  document.getElementById('gold-free').addEventListener('click',function(){ profile.gold+=500; saveProfile(); renderShop(); });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initShopUI);
else initShopUI();
