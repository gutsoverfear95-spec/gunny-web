// ===== DATA SUNG / DO / SHOP (kieu Gunny) =====
const GUNS = {
  dua:    {name:'Dưa Hấu', icon:'🍉', dmg:34, radius:72,  dig:1,   price:0,    color:'#22c55e', desc:'Khởi đầu, cân bằng'},
  bua:    {name:'Búa Gỗ',  icon:'🔨', dmg:42, radius:60,  dig:0.6, price:800,  color:'#a16207', desc:'Dame to, nổ nhỏ'},
  phao:   {name:'Pháo',    icon:'🧨', dmg:30, radius:95,  dig:1.4, price:1200, color:'#57534e', desc:'Nổ to, đào khỏe'},
  tinhyeu:{name:'Tình Yêu',icon:'💘', dmg:16, radius:52,  dig:0.7, price:1500, color:'#ec4899', count:3, desc:'Bắn chùm 3 tim'},
  set:    {name:'Sấm Sét', icon:'⚡', dmg:48, radius:55,  dig:0.5, price:2500, color:'#eab308', desc:'Dame khủng, nổ gọn'},
  boom:   {name:'Mặt Trời',icon:'☀️', dmg:26, radius:125, dig:2.2, price:3000, color:'#f97316', desc:'Nổ siêu to'},
  luuday: {name:'Lựu Đạn', icon:'💣', dmg:38, radius:78,  dig:1.1, price:1800, color:'#1f2937', bounce:1, desc:'Nảy 1 lần trước khi nổ'},
  thuoc:  {name:'Thuốc',   icon:'💊', dmg:-25,radius:60,  dig:0,   price:2000, color:'#38bdf8', heal:true, desc:'Hồi 25 HP (bắn vào mình/đất gần mình)'},
};
const ARMORS = {
  mu_rom:   {slot:'mu',  name:'Mũ Rơm',      icon:'👒', hp:0,  fuel:20, pow:0,  price:0},
  mu_sat:   {slot:'mu',  name:'Mũ Sắt',      icon:'⛑️', hp:25, fuel:0,  pow:0,  price:600},
  mu_vang:  {slot:'mu',  name:'Mũ Vàng',     icon:'👑', hp:40, fuel:10, pow:2,  price:1800},
  ao_vai:   {slot:'ao',  name:'Áo Vải',      icon:'🎽', hp:0,  fuel:0,  pow:0,  price:0},
  ao_giap:  {slot:'ao',  name:'Áo Giáp',     icon:'🦺', hp:35, fuel:0,  pow:1,  price:900},
  ao_rong:  {slot:'ao',  name:'Áo Rồng',     icon:'🥋', hp:60, fuel:15, pow:3,  price:2400},
  giay_co:  {slot:'giay',name:'Giày Cỏ',     icon:'🩴', hp:0,  fuel:0,  pow:0,  price:0},
  giay_chay:{slot:'giay',name:'Giày Chạy',   icon:'👟', hp:10, fuel:40, pow:0,  price:700},
  giay_bay: {slot:'giay',name:'Giày Bay',    icon:'🥾', hp:20, fuel:70, pow:1,  price:2000},
};
// profile luu local
let profile = {gold:1000, guns:['dua'], gun:'dua', armor:{mu:'mu_rom',ao:'ao_vai',giay:'giay_co'}, ownedArmor:['mu_rom','ao_vai','giay_co'], enhance:{gun:0,mu:0,ao:0,giay:0}};
try{ const s=localStorage.getItem('gunny_profile'); if(s) profile=Object.assign(profile,JSON.parse(s)); }catch(e){}
function saveProfile(){ try{localStorage.setItem('gunny_profile',JSON.stringify(profile));}catch(e){} }
// chi so tong tu do + cuong hoa
function gearStats(){
  const mu=ARMORS[profile.armor.mu]||{hp:0,fuel:0,pow:0};
  const ao=ARMORS[profile.armor.ao]||{hp:0,fuel:0,pow:0};
  const gi=ARMORS[profile.armor.giay]||{hp:0,fuel:0,pow:0};
  const e=profile.enhance||{gun:0,mu:0,ao:0,giay:0};
  return {
    hp: mu.hp+ao.hp+gi.hp + (e.mu+e.ao+e.giay)*4,
    fuel: mu.fuel+ao.fuel+gi.fuel,
    pow: mu.pow+ao.pow+gi.pow + Math.floor(e.gun/2),
    gunLv: e.gun||0
  };
}
function gunDmg(key){
  const g=GUNS[key]; if(!g) return 30;
  const lv=(profile.enhance&&profile.enhance.gun)||0;
  if(g.heal) return g.dmg;
  return Math.round(g.dmg*(1+lv*0.06));
}
