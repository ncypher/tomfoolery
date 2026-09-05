export const COLS = 8, ROWS = 6, SAVE_KEY = 'crownAndCinderV2';
export const OWNER = {P:'The River Crown',R:'The Red March',V:'The Violet Court',S:'The Sun League',N:'Free March'};
export const COLOR = {P:'#2aa889',R:'#c75a64',V:'#a786d6',S:'#d59f47',N:'#63727d'};
export const SEASONS = ['Spring','Summer','Autumn','Winter'];
export const COSTS = {farm:[18,0],market:[22,0],fort:[26,0],recruit:[12,8],festival:[20,10],trade:[12,0],tax:[0,0],attack:[0,0],move:[0,0]};
const NAMES = 'Riverhold,Greenbarrow,Oakwatch,Fenmere,Dawnford,Highbank,Mossfield,Stonecross,Ashvale,Thornwall,Mistfen,Goldmead,Foxrun,Blackwood,Redwater,Brightmoor,Ironhill,Westmere,Eastgate,Grayfen,Pineward,Sunfield,Cinderfall,Ravenstep,Longmere,Wolfpine,Amberford,Coldharbor,Maplewatch,Crowford,Starfall,Rosefen,Hollowmere,Stormbarrow,Kingswood,Millcross,Dragonmere,Silverbank,Hillwatch,Marshgate,Emberfield,Moonford,Briarstead,Northbank,Southmere,Clearwater,Windfall,Oldstone'.split(',');
const PATTERN = ['P','P','N','V','V','V','S','S','P','P','N','N','V','V','S','S','P','N','N','R','R','N','S','S','N','N','R','R','R','N','N','S','N','N','R','R','R','N','N','N','N','N','N','R','N','N','N','N'];
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
function random(g) { g.rng = (Math.imul(g.rng,1664525)+1013904223)>>>0; return g.rng/4294967296; }
export function neighbors(id) {const x=id%COLS,y=Math.floor(id/COLS);return [x>0?id-1:null,x<COLS-1?id+1:null,y>0?id-COLS:null,y<ROWS-1?id+COLS:null].filter(n=>n!==null);}
export const owned = (g,owner='P') => g.provinces.filter(p=>p.owner===owner);
export const seasonName = g => `Year ${Math.floor(g.turn/4)+1} · ${SEASONS[g.turn%4]}`;
export function totals(g) { return owned(g).reduce((t,p)=>({people:t.people+p.pop,army:t.army+p.army}),{people:0,army:0}); }
export const foodYield = p => p.food+(p.farm?5:0);
export const income = p => p.income+(p.market?4:0);
export const defense = p => p.army+p.def*2+(p.fort?10:0)+(p.river?4:0)+(p.forest?2:0)+(p.capital?6:0);
function log(g,text,tone='') { g.log.unshift({text,tone,season:seasonName(g)});g.log=g.log.slice(0,60); }
export function newGame(seed=712367) {
  const g={version:2,rng:seed>>>0,turn:0,gold:75,food:100,prestige:12,stability:74,orders:3,used:[],result:null,provinces:[],log:[]};
  for(let id=0;id<COLS*ROWS;id++) { const terrain=random(g),owner=PATTERN[id],x=id%COLS,y=Math.floor(id/COLS);g.provinces.push({id,name:NAMES[id],x,y,owner,pop:65+Math.floor(random(g)*70),food:4+Math.floor(random(g)*5)+(terrain>.62?2:0),income:3+Math.floor(random(g)*5),army:owner==='N'?3+Math.floor(random(g)*7):8+Math.floor(random(g)*12),def:1+Math.floor(random(g)*4),loyalty:55+Math.floor(random(g)*30),forest:terrain<.34,farm:false,market:false,fort:false,capital:id===0,river:((x===2||x===3)&&y<5)||(y===3&&x>2&&x<7)}); }
  g.provinces[0].army=24;g.provinces[0].loyalty=92;
  log(g,'The River Crown is yours. Three orders each season; every choice leaves a trace.','gold');
  return g;
}
export function forecast(g) {
  const t=totals(g),land=owned(g),factor=[1,1,1.5,.55][g.turn%4];
  const harvest=Math.floor(land.reduce((n,p)=>n+foodYield(p),0)*factor);
  const consumption=Math.ceil(t.people*.04)+Math.ceil(t.army*.10);
  const revenue=land.reduce((n,p)=>n+income(p),0),upkeep=Math.ceil(t.army*.22);
  return {harvest,consumption,revenue,upkeep,food:harvest-consumption,gold:revenue-upkeep,factor};
}
export function sources(g,targetId,owner='P') {return neighbors(targetId).map(id=>g.provinces[id]).filter(p=>p.owner===owner&&p.army>=2).sort((a,b)=>b.army-a.army);}
export function battleForecast(g,targetId,sourceId,troops) {
  const target=g.provinces[targetId],from=g.provinces[sourceId];
  if(!target||!from||!neighbors(targetId).includes(sourceId)||!Number.isInteger(troops)||troops<1||troops>=from.army)return null;
  const guard=defense(target),low=troops*.9,high=troops*1.15;
  return {defense:guard,low,high,rating:low>guard?'Favored':high<=guard?'Outmatched':'Uncertain'};
}
export function orderReason(g,type,id,options={}) {
  if(g.result)return 'This chronicle is complete. Start a new realm to play again.';
  if(!Object.hasOwn(COSTS,type))return 'Unknown order.';
  if(g.orders<=0)return 'All three orders are spent. End the season to continue.';
  const p=g.provinces[id];if(!p)return 'Select a province.';
  if(['farm','market','fort','recruit','move'].includes(type)&&p.owner!=='P')return 'Select one of your provinces.';
  if(['farm','market','fort'].includes(type)&&p[type])return 'Already built in this province.';
  if(['tax','festival'].includes(type)&&g.used.includes(type))return 'Available once per season.';
  const [gold,food]=COSTS[type];if(g.gold<gold||g.food<food)return `Requires ${gold} gold${food?` and ${food} food`:''}.`;
  if(type==='recruit'&&p.pop<38)return 'Not enough people to recruit eight soldiers.';
  if(type==='attack'||type==='move') {
    const from=g.provinces[options.source];
    if(!from||from.owner!=='P'||!neighbors(id).includes(from.id))return 'Choose an adjacent friendly source army.';
    if(!Number.isInteger(options.troops)||options.troops<1||options.troops>=from.army)return 'Send at least one soldier and leave one to guard the source.';
    if(type==='attack'&&p.owner==='P')return 'Choose a neighboring rival or free province to invade.';
  }
  return '';
}
function checkResult(g) {
  if(g.stability<=0||g.provinces[0].owner!=='P')g.result={won:false,title:'The Crown Breaks',reason:g.stability<=0?'Stability fell to zero.':'Riverhold, your capital, has fallen.'};
  else if(owned(g).length>=9)g.result={won:true,title:'A Crown of Nine Provinces',reason:'Your realm united nine provinces.'};
  else if(g.prestige>=80)g.result={won:true,title:'A Realm Remembered',reason:'Your court reached 80 prestige.'};
  else if(g.turn>=48&&g.stability>55)g.result={won:true,title:'The Patient Crown',reason:'You completed twelve years with stability above 55.'};
  return g;
}
function battle(g,from,target,troops) {
  const previous=target.owner,guard=defense(target),power=troops*(.9+random(g)*.25);
  from.army-=troops;
  if(power>guard) {
    target.owner=from.owner;target.army=Math.max(1,troops-Math.ceil(guard*.55));target.loyalty=42;
    log(g,`${OWNER[from.owner]} takes ${target.name}: ${target.army} of ${troops} troops hold the new ground.`,from.owner==='P'?'good':previous==='P'?'bad':'');
    return true;
  }
  const returners=Math.floor(troops*.4),loss=Math.min(target.army,Math.floor(troops*.45));
  from.army+=returners;target.army-=loss;
  log(g,`${from.name}'s assault on ${target.name} fails. ${troops-returners} attackers and ${loss} defenders are lost.`,from.owner==='P'?'bad':'');
  return false;
}
export function giveOrder(game,type,id,options={}) {
  const reason=orderReason(game,type,id,options);if(reason)return {game,ok:false,message:reason};
  const g=structuredClone(game),p=g.provinces[id],[gold,food]=COSTS[type];g.gold-=gold;g.food-=food;g.orders--;g.used.push(type);
  if(['farm','market','fort'].includes(type)) {p[type]=true;g.prestige+=type==='market'?3:2;log(g,`${p.name}: ${type} completed.`, 'good');}
  if(type==='recruit'){p.army+=8;p.pop-=8;g.stability-=1;log(g,`Eight people in ${p.name} join the garrison.`);}
  if(type==='tax'){g.gold+=28;g.stability-=8;owned(g).forEach(q=>q.loyalty=clamp(q.loyalty-5,0,100));log(g,'An extraordinary levy raises 28 gold; stability falls by 8.','bad');}
  if(type==='festival'){g.stability+=9;g.prestige+=4;owned(g).forEach(q=>q.loyalty=clamp(q.loyalty+4,0,100));log(g,'A festival restores 9 stability and earns 4 prestige.','good');}
  if(type==='trade'){g.food+=28;log(g,'River merchants exchange 12 gold for 28 grain.','gold');}
  if(type==='move'){const from=g.provinces[options.source];from.army-=options.troops;p.army+=options.troops;log(g,`${options.troops} troops march from ${from.name} to ${p.name}.`);}
  if(type==='attack'){const won=battle(g,g.provinces[options.source],p,options.troops);g.prestige=Math.max(0,g.prestige+(won?8:-2));g.stability-=won?2:4;}
  g.stability=clamp(g.stability,0,100);checkResult(g);
  return {game:g,ok:true,message:g.log[0].text};
}
function rivalTurn(g,owner,chance) {
  const land=owned(g,owner);for(const p of land)p.army+=Math.floor(random(g)*2)+(owner==='R'?1:0);
  if(!land.length||random(g)>chance)return;
  const candidates=[];
  for(const from of land)for(const id of neighbors(from.id)) {const target=g.provinces[id],troops=Math.floor(from.army*.7);if(target.owner!==owner&&troops>=2&&troops*1.15>defense(target))candidates.push({from,target,troops,margin:troops-defense(target)});}
  candidates.sort((a,b)=>b.margin-a.margin);if(candidates.length){const {from,target,troops}=candidates[0];battle(g,from,target,troops);}
}
export function endSeason(game) {
  if(game.result)return game;
  const g=structuredClone(game),f=forecast(g);
  g.gold+=f.gold;g.food+=f.food;
  log(g,`${SEASONS[g.turn%4]} ledger: ${f.food>=0?'+':''}${f.food} grain, ${f.gold>=0?'+':''}${f.gold} gold before events.`);
  for(const p of owned(g)){p.pop+=Math.max(0,Math.floor((p.loyalty-45)/18));p.loyalty=clamp(p.loyalty+(g.stability>60?1:-1),0,100);}
  if(g.food<0){g.stability+=g.food*.35;g.food=0;owned(g).forEach(p=>{p.pop=Math.max(30,p.pop-Math.ceil(p.pop*.04));p.loyalty=clamp(p.loyalty-6,0,100);});log(g,'Granaries run bare. Hunger costs people, loyalty, and stability.','bad');}
  if(g.gold<0){g.stability+=g.gold*.25;g.gold=0;log(g,'The treasury cannot meet payroll. Stability suffers.','bad');}
  g.stability=clamp(g.stability,0,100);checkResult(g);if(g.result)return g;
  for(const [owner,chance] of [['R',.55],['V',.35],['S',.25]]){rivalTurn(g,owner,chance);checkResult(g);if(g.result)return g;}
  const event=random(g);
  if(event<.10){g.food+=18;log(g,'A generous harvest adds 18 grain.','good');}
  else if(event<.17){g.food=Math.max(0,g.food-18);g.stability-=3;log(g,'Blight consumes 18 grain and shakes confidence.','bad');}
  else if(event<.25){g.gold+=16;log(g,'A caravan pays 16 gold in tolls.','gold');}
  else if(event>.94){g.prestige+=3;g.stability+=2;log(g,'A chronicler praises your court: +3 prestige, +2 stability.','good');}
  g.turn++;g.orders=3;g.used=[];if(g.turn%4===0){g.prestige+=Math.max(0,owned(g).length-3);log(g,'A new year begins. Your realm earns its annual renown.','gold');}
  g.stability=clamp(g.stability,0,100);return checkResult(g);
}
export function readSave(raw) {
  if(!raw)return null;
  try {
    const g=JSON.parse(raw),number=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
    if(g?.version!==2||!Number.isInteger(g.turn)||!number(g.turn,0,10000)||!Number.isInteger(g.rng)||!number(g.rng,0,4294967295)||!Number.isInteger(g.orders)||!number(g.orders,0,3)||!number(g.gold,0,1e9)||!number(g.food,0,1e9)||!number(g.prestige,0,1e6)||!number(g.stability,0,100)||!Array.isArray(g.provinces)||g.provinces.length!==48||!Array.isArray(g.used)||g.used.length>3||!g.used.every(x=>Object.hasOwn(COSTS,x))||!Array.isArray(g.log))return null;
    if(!g.provinces.every((p,i)=>p&&p.id===i&&p.x===i%8&&p.y===Math.floor(i/8)&&Object.hasOwn(OWNER,p.owner)&&['pop','food','income','army','def','loyalty'].every(k=>number(p[k],0,k==='loyalty'?100:1e6))&&['forest','farm','market','fort','capital','river'].every(k=>typeof p[k]==='boolean')&&p.capital===(i===0)))return null;
    if(g.orders!==3-g.used.length)return null;
    // Recompute endings and canonical names; saved strings never become markup.
    g.provinces.forEach((p,i)=>p.name=NAMES[i]);g.result=null;
    g.log=g.log.slice(0,60).filter(e=>e&&typeof e.text==='string'&&typeof e.season==='string').map(e=>({text:e.text.slice(0,500),season:e.season.slice(0,50),tone:['good','bad','gold'].includes(e.tone)?e.tone:''}));
    return checkResult(g);
  } catch {return null;}
}
