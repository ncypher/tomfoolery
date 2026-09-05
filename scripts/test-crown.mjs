import assert from 'node:assert/strict';
import {newGame,readSave,owned,totals,neighbors,forecast,defense,battleForecast,orderReason,giveOrder,endSeason} from '../assets/crown-engine.mjs';
const initial=newGame();
assert.deepEqual(newGame(),initial,'The starting map is reproducible');
assert.equal(owned(initial).length,5);
assert.equal(neighbors(7).includes(8),false,'Rows must not wrap');
let g=giveOrder(initial,'tax',0).game;
assert.equal(g.orders,2);assert.equal(g.gold,103);
const duplicate=giveOrder(g,'tax',0);assert.equal(duplicate.ok,false);assert.equal(duplicate.game,g);
g=giveOrder(g,'festival',0).game;g=giveOrder(g,'trade',0).game;
assert.equal(g.orders,0);assert.equal(g.result,null,'Tax/festival cannot win in the opening spring');
assert.equal(giveOrder(g,'farm',0).game,g,'An exhausted budget cannot spend resources');
assert.equal(endSeason(g).orders,3);assert.equal(initial.orders,3,'Orders do not mutate prior states');
assert.equal(orderReason(initial,'toString',0),'Unknown order.');
const before=totals(initial).army,moved=giveOrder(initial,'move',1,{source:0,troops:10});
assert.ok(moved.ok);assert.equal(totals(moved.game).army,before);assert.equal(moved.game.provinces[0].army,14);
assert.equal(giveOrder(initial,'move',16,{source:0,troops:10}).ok,false,'Transfers must be adjacent');
assert.equal(giveOrder(initial,'move',1,{source:0,troops:24}).ok,false,'Source must retain a guard');
const recruit=giveOrder(initial,'recruit',0).game;
assert.equal(totals(recruit).army,totals(initial).army+8);assert.equal(totals(recruit).people,totals(initial).people-8);
const scenario=structuredClone(initial);scenario.provinces[1].army=80;scenario.provinces[2].army=3;
const f=battleForecast(scenario,2,1,60);assert.equal(f.rating,'Favored');
const conquered=giveOrder(scenario,'attack',2,{source:1,troops:60}).game;
assert.equal(conquered.provinces[2].owner,'P');assert.ok(conquered.provinces[2].army<=60);assert.equal(conquered.provinces[1].army,20);
scenario.provinces[2].army=50;
const lost=giveOrder(scenario,'attack',2,{source:1,troops:10}).game;
assert.equal(lost.provinces[2].owner,'N');assert.ok(lost.provinces[2].army<50,'Defenders also take losses on a failed attack');
const p={...initial.provinces[0],army:10,def:2,fort:true,river:true,forest:true,capital:true};
assert.equal(defense(p),36);
const spring=forecast(initial),autumn=forecast({...initial,turn:2}),winter=forecast({...initial,turn:3});
assert.equal(autumn.harvest,Math.floor(spring.harvest*1.5));assert.equal(winter.harvest,Math.floor(spring.harvest*.55));
for(const raw of ['{','null','[]','{"version":2}','123'])assert.equal(readSave(raw),null);
const resume=readSave(JSON.stringify(conquered));assert.deepEqual(endSeason(resume),endSeason(conquered),'Reload preserves random sequence and campaign state');
assert.equal(readSave(JSON.stringify({...initial,orders:2})),null,'Reject inconsistent order budget');
const ending=structuredClone(initial);ending.turn=44;ending.prestige=0;ending.stability=60;
assert.equal(readSave(JSON.stringify(ending)).result,null,'Entering Year 12 is not surviving through Year 12');
ending.turn=48;ending.stability=55;assert.equal(readSave(JSON.stringify(ending)).result,null,'Survival requires stability above 55');
ending.stability=56;assert.equal(readSave(JSON.stringify(ending)).result.won,true);
ending.provinces[0].owner='R';assert.equal(readSave(JSON.stringify(ending)).result.won,false,'Capital loss outranks simultaneous victory');
assert.deepEqual(endSeason(readSave(JSON.stringify(ending))),readSave(JSON.stringify(ending)),'Finished campaigns do not advance');
const renowned=giveOrder({...newGame(),prestige:78},'farm',0).game;
assert.equal(renowned.result.won,true,'The prestige path remains reachable');
const expansion=newGame();for(const id of [2,10,17])expansion.provinces[id].owner='P';
expansion.provinces[17].army=100;expansion.provinces[18].army=0;
assert.equal(giveOrder(expansion,'attack',18,{source:17,troops:80}).game.result.won,true,'The nine-province path remains reachable');
const collapsed={...initial,stability:1,food:0,turn:3};const collapse=endSeason(collapsed);assert.equal(collapse.result.won,false);assert.ok(collapse.log.some(e=>e.text.includes('Granaries')));
let seasons=0;
for(let seed=1;seed<=12;seed++){
  let world=newGame(seed);
  for(let turn=0;turn<60&&!world.result;turn++){
    for(let action=0;action<3&&!world.result;action++){
      const land=owned(world),farm=land.find(p=>!p.farm),market=land.find(p=>!p.market);
      const type=world.stability<65?'festival':world.food<60?'trade':farm?'farm':market?'market':'recruit';
      const id=(type==='farm'?farm:type==='market'?market:land[0])?.id;
      const result=giveOrder(world,type,id);if(!result.ok)break;world=result.game;
    }
    world=endSeason(world);seasons++;
    assert.ok(world.gold>=0&&world.food>=0&&world.stability>=0&&world.stability<=100);
    assert.ok(world.provinces.every(p=>Number.isInteger(p.army)&&p.army>=0&&p.loyalty>=0&&p.loyalty<=100));
    assert.ok(readSave(JSON.stringify(world)),'Every reachable state must round-trip');
  }
}
console.log(`Crown & Cinder: orders, recruitment, transfers, combat, forecasts, save recovery, endings, and ${seasons} simulated seasons passed.`);
