// Original educational simulation; no radio, storage, or Chime application code.
const scenarios = {
  heat: {title:'No heat upstairs',note:'Heating has stopped in the upstairs units.',category:'HEAT',severity:'URGENT'},
  plumbing: {title:'Water leak in the hallway',note:'Water is collecting below a pipe near the stairs.',category:'PLUMBING',severity:'URGENT'},
  electric: {title:'Hallway lights are out',note:'The shared hallway lights are not turning on.',category:'ELECTRIC',severity:'INFO'}
};
const layers = {
  chime:['01','The tenant-facing proof of concept','A shared place to say, “This is happening.”','Reports, neighbor co-signatures, status changes, chat, and local photo fingerprints. Chime is one app on REOWren, focused on a neighborhood’s tenant experience.'],
  mesh:['02','The neighborhood connection','Neighbors own the means of communication.','REOWren explores a local LoRa radio mesh using Meshtastic. Nearby radios can relay small messages. Real reach depends on terrain, placement, configuration, and available airtime; delivery is never implied by this drawing.'],
  memory:['03','The community’s memory','A signal becomes something we can return to.','The broader project includes local message journals and experiments in longer-form writing over radio. Chime keeps its own local report history. Local storage needs care: it is not an automatic backup or a universally synchronized archive.'],
  senses:['04','Ideas for a sensing neighborhood','What else could a neighborhood notice?','Weather, water levels, air conditions, garden moisture, and mesh health are possibilities in REOWren’s sensor field notes. These are directions for exploration, not a claim that a neighborhood-wide sensor system is deployed.']
};
const $ = id => document.getElementById(id);
let current='heat', shared=false, witnesses=new Set(), state='Draft';
function announce(text){$('feedback').textContent=text;}
function addEvent(text){const li=document.createElement('li');li.textContent=text;$('event-log').append(li);li.parentElement.scrollTop=li.parentElement.scrollHeight;}
function reset(){
 shared=false;witnesses.clear();state='Draft';const s=scenarios[current];
 $('report-title').textContent=s.title;$('report-note').textContent=s.note;$('category').textContent=s.category;$('severity').textContent=s.severity;
 $('status').textContent=state;$('count').textContent='0';$('send').disabled=false;$('send').textContent='Share sample report';
 ['sam','jo'].forEach(n=>{$('witness-'+n).disabled=true;$('witness-'+n).textContent=(n==='sam'?'Sam':'Jo')+': “Me too”';});
 document.querySelectorAll('[data-state]').forEach(b=>b.disabled=true);
 document.querySelectorAll('.mesh-node,.links').forEach(n=>n.classList.remove('active'));
 $('event-log').replaceChildren();addEvent('The example is ready. Nothing has been sent.');
 $('signal-caption').textContent='A neighbor has noticed a problem. Start with one small report.';
 announce('Choose a situation, then share the sample report.');
}
document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>{current=b.dataset.scenario;document.querySelectorAll('[data-scenario]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));reset();}));
$('reset').addEventListener('click',reset);
$('send').addEventListener('click',()=>{if(shared)return;shared=true;state='Open';$('status').textContent=state;$('send').disabled=true;$('send').textContent='Report shared in demo';['sam','jo'].forEach(n=>$('witness-'+n).disabled=false);document.querySelectorAll('[data-state]').forEach(b=>b.disabled=false);['alex','relay','journal'].forEach(n=>$('node-'+n).classList.add('active'));document.querySelector('.links').classList.add('active');$('event-log').replaceChildren();addEvent('Alex shared: '+scenarios[current].title+'.');$('signal-caption').textContent='The simulated report is now in the shared record. Let another neighbor co-sign.';announce('Sample report is open. Sam and Jo can each add one co-signature.');});
['sam','jo'].forEach(n=>$('witness-'+n).addEventListener('click',()=>{if(!shared||witnesses.has(n))return;witnesses.add(n);const name=n==='sam'?'Sam':'Jo';$('count').textContent=String(witnesses.size);$('witness-'+n).disabled=true;$('witness-'+n).textContent=name+' co-signed';$('node-'+n).classList.add('active');addEvent(name+' co-signed the report.');$('signal-caption').textContent='Separate voices are now attached to the same report, rather than scattered across conversations.';announce(name+' co-signed. '+witnesses.size+' neighbor co-signature'+(witnesses.size===1?'':'s')+'. Each fictional node counts once.');}));
document.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>{if(!shared)return;const next=b.dataset.state.toLowerCase();if(state.toLowerCase()===next){announce('The sample report is already '+next+'.');return;}state=next[0].toUpperCase()+next.slice(1);$('status').textContent=state;addEvent('Demo participant marked the report '+next+'.');announce('Status changed to '+next+'. The earlier events remain in the record.');}));
document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-layer]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const v=layers[b.dataset.layer];['layer-number','layer-kicker','layer-title','layer-copy'].forEach((id,i)=>$(id).textContent=v[i]);}));
let hashRevision=0;
async function hashSample(){const revision=++hashRevision;try{if(!globalThis.crypto?.subtle)throw new Error('Unavailable');const bytes=new TextEncoder().encode($('sample').value);const digest=await crypto.subtle.digest('SHA-256',bytes);if(revision!==hashRevision)return;$('hash').textContent=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}catch{if(revision===hashRevision)$('hash').textContent='Live hashing is unavailable in this browser. The explanation still applies.';}}
$('sample').addEventListener('input',hashSample);hashSample();
