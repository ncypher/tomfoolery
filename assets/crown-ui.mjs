import {SAVE_KEY,OWNER,SEASONS,newGame,readSave,owned,totals,seasonName,foodYield,income,defense,forecast,sources,battleForecast,orderReason,giveOrder,endSeason} from './crown-engine.mjs';
import {createMap} from './crown-map.mjs';
const $=id=>document.getElementById(id);
let raw=null,storageAvailable=true;
try{raw=localStorage.getItem(SAVE_KEY);}catch{storageAvailable=false;}
let game=readSave(raw),selected=0,sourceId=null,troopCount=1,endingShown=false;
const welcome=game?'Your chronicle resumes. The realm is exactly as you left it.':raw?'The saved campaign could not be read. A fresh realm is ready.':'Your reign begins. Select a province, spend up to three orders, then turn the season.';
game??=newGame();
const map=createMap($('world'),selectProvince);
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(game));storageAvailable=true;}catch{storageAvailable=false;}$('save-status').textContent=storageAvailable?'Campaign saved in this browser. Nothing advances while you are away.':'Browser saving is unavailable. You can play, but this campaign may not survive a reload.';}
function announce(text){$('notice').textContent=text;}
function selectProvince(id){if(!game.provinces[id])return;selected=id;sourceId=null;render();const scroll=$('map-scroll'),left=game.provinces[id].x*$('world').clientWidth/8,right=left+$('world').clientWidth/8;if(left<scroll.scrollLeft)scroll.scrollLeft=left;else if(right>scroll.scrollLeft+scroll.clientWidth)scroll.scrollLeft=right-scroll.clientWidth;}
function options(){return {source:sourceId,troops:troopCount};}
function troopControls(reset=false){
  const p=game.provinces[selected],available=sources(game,selected);
  if(reset||!available.some(p=>p.id===sourceId)){sourceId=available[0]?.id??null;troopCount=sourceId===null?1:Math.max(1,Math.floor(game.provinces[sourceId].army*.65));}
  $('source-select').replaceChildren();
  if(!available.length){const option=new Option('No adjacent troops available','');$('source-select').append(option);}
  for(const from of available)$('source-select').append(new Option(`${from.name} · ${from.army} troops`,from.id));
  $('source-select').value=sourceId===null?'':String(sourceId);
  const max=sourceId===null?1:game.provinces[sourceId].army-1;troopCount=Math.min(max,Math.max(1,troopCount));
  $('troops').max=max;$('troops').value=troopCount;
  $('troops').disabled=$('source-select').disabled=sourceId===null||!!game.result;
  $('troop-count').textContent=sourceId===null?'0 troops':`${troopCount} troops`;
  $('left-behind').textContent=sourceId===null?'None available':`${game.provinces[sourceId].army-troopCount} stay behind`;
  const mine=p.owner==='P',type=mine?'move':'attack';
  $('army-title').textContent=mine?'Move troops here':'Plan an invasion';
  $('march').textContent=mine?'Move troops · 1 order':'Invade · 1 order';$('march').className=mine?'':'danger';
  const reason=orderReason(game,type,selected,options());$('march').disabled=!!reason;$('march').title=reason;
  const preview=sourceId===null?null:battleForecast(game,selected,sourceId,troopCount);
  $('battle-preview').textContent=sourceId===null?'Select a destination beside a friendly province with at least two troops.':mine?`Move ${troopCount} troops into ${p.name}. No combat; total army size stays the same.`:`${preview.rating}: attack ${preview.low.toFixed(1)}–${preview.high.toFixed(1)} against ${preview.defense} defense. Failed assaults still cost both sides troops.`;
}
function render(){
  const p=game.provinces[selected],t=totals(game),f=forecast(game);
  for(const [key,value] of Object.entries({gold:game.gold,food:game.food,people:t.people,army:t.army,prestige:game.prestige,stability:game.stability}))$(key).textContent=Math.floor(value);
  for(const key of ['gold','food']){const trend=$(`${key}-trend`);trend.textContent=`${f[key]>=0?'+':''}${f[key]} this season`;trend.className=f[key]>=0?'positive':'negative';}
  $('season-title').textContent=seasonName(game);$('completed').textContent=`${game.turn} seasons completed · ${owned(game).length} / 9 provinces`;
  $('orders').textContent=`${'● '.repeat(game.orders)}${'○ '.repeat(3-game.orders)} ${game.orders} order${game.orders===1?'':'s'} remaining`;
  $('end-season').textContent=`End ${SEASONS[game.turn%4].toLowerCase()} →`;$('end-season').disabled=!!game.result;
  $('forecast').textContent=`Harvest ${f.harvest} grain; consume ${f.consumption}. Earn ${f.revenue} gold; pay ${f.upkeep} in upkeep. ${game.turn%4===3?'Winter yields only 55% of your base harvest. ':game.turn%4===2?'Autumn yields 150% of your base harvest. ':''}${game.food+f.food<0?'Food shortage ahead. Buy grain or build farms. ':''}${game.gold+f.gold<0?'Payroll shortage ahead. Add income or raise a levy. ':''}Events and rival conquests may change the final ledger.`;
  $('province-select').replaceChildren(...game.provinces.map(q=>new Option(`${q.name} · ${q.owner==='P'?'Your realm':OWNER[q.owner]}`,q.id)));$('province-select').value=selected;
  $('province-name').textContent=p.name;$('province-owner').textContent=p.owner==='P'?(p.capital?'Your capital · protect the crown':'Your province'):OWNER[p.owner];
  for(const [key,value] of Object.entries({pop:p.pop,army:p.army,food:foodYield(p),income:income(p),defense:defense(p),loyalty:`${Math.floor(p.loyalty)}%`}))$(`p-${key}`).textContent=value;
  $('feature').textContent=[p.capital?'Capital +6':'',p.river?'River +4':'',p.forest?'Forest +2':'',`Terrain +${p.def*2}`,p.farm?'Farm':'',p.market?'Market':'',p.fort?'Fort +10':''].filter(Boolean).join(' · ');
  $('province-hint').textContent=game.result?'This reign has ended. You can still inspect the map.':game.orders===0?'No orders left. End the season to continue.':p.owner==='P'?'Buildings last. Recruitment uses eight people and one stability.':'Building and recruitment require a friendly province.';
  document.querySelectorAll('[data-order]').forEach(button=>{const reason=orderReason(game,button.dataset.order,selected);button.disabled=!!reason;button.title=reason||'Costs one seasonal order';});
  troopControls();map.render(game,selected);
  $('log').replaceChildren(...game.log.map(entry=>{const row=document.createElement('p');row.className=entry.tone;const date=document.createElement('small');date.textContent=entry.season;row.append(date,document.createTextNode(entry.text));return row;}));
  if(game.result&&!endingShown){endingShown=true;$('ending-title').textContent=game.result.title;$('ending-reason').textContent=game.result.reason;$('ending-stats').textContent=`${owned(game).length} provinces · ${Math.floor(game.prestige)} prestige · ${Math.floor(game.stability)} stability · ${game.turn} completed seasons`;$('ending').showModal();}
}
function order(type){const result=giveOrder(game,type,selected,options());game=result.game;announce(result.message);render();save();}
document.querySelectorAll('[data-order]').forEach(button=>button.addEventListener('click',()=>order(button.dataset.order)));
$('march').addEventListener('click',()=>order(game.provinces[selected].owner==='P'?'move':'attack'));
$('source-select').addEventListener('change',()=>{sourceId=Number($('source-select').value);troopCount=Math.max(1,Math.floor(game.provinces[sourceId].army*.65));troopControls();});
$('troops').addEventListener('input',()=>{troopCount=Number($('troops').value);troopControls();});
$('province-select').addEventListener('change',()=>selectProvince(Number($('province-select').value)));
function advance(){if(game.result)return;game=endSeason(game);announce(game.result?game.result.reason:`${seasonName(game)} begins. Three new orders await. Read the chronicle for last season's consequences.`);render();save();}
$('end-season').addEventListener('click',advance);
$('new-game').addEventListener('click',()=>$('new-dialog').showModal());
$('cancel-new').addEventListener('click',()=>$('new-dialog').close());
function restart(){game=newGame();selected=0;sourceId=null;endingShown=false;$('new-dialog').close();$('ending').close();announce('A new reign begins. Three orders. Many possible futures.');render();save();}
$('confirm-new').addEventListener('click',restart);$('restart').addEventListener('click',restart);$('inspect-realm').addEventListener('click',()=>$('ending').close());
$('help-button').addEventListener('click',()=>{$('guide').open=true;$('guide').scrollIntoView({block:'start'});$('guide').querySelector('summary').focus();});
window.addEventListener('keydown',event=>{if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||document.querySelector('dialog[open]')||event.target.closest('input,select,textarea,button,summary,a')||game.result)return;const key=event.key.toLowerCase();if(key==='e'){event.preventDefault();advance();}else if(key==='f')order('farm');else if(key==='r')order('recruit');});
announce(welcome);render();save();
