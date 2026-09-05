import { SAVE_KEY, LEGACY_KEY, restorePet, tickPet, careFor, cleanName, moodOf, growthOf } from './pixel-pet-engine.mjs';
const $ = id => document.getElementById(id);
let canSave = true;
let raw = null, legacy = null;
try { raw = localStorage.getItem(SAVE_KEY); legacy = localStorage.getItem(LEGACY_KEY); } catch { canSave = false; }
const restored = restorePet(raw, legacy);
let state = restored.state;
let lastTick = performance.now();
let lastSave = 0;
let effectTimer;
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); canSave = true; }
  catch { canSave = false; }
  $('save-note').textContent = canSave ? 'Saved on this browser. Away time is quiet time.' : 'Saving is unavailable. You can still play; this visit may not be remembered.';
}
const palette = { fern: ['#b9d886','#e1edb7','#739854'], peach: ['#efbd9d','#fae0bd','#c38975'], sky: ['#a9cddc','#d6eaf0','#749ba9'] };
function render() {
  const mood = moodOf(state);
  $('pet-name').textContent = state.name;
  $('pet-button').setAttribute('aria-label', `Give ${state.name} a gentle pat`);
  $('mood').textContent = mood;
  $('growth').textContent = `${growthOf(state)} · ${Math.floor(state.activeSeconds / 60)} cozy minutes together`;
  for (const key of ['fullness','joy','energy','cleanliness']) {
    const value = Math.round(state[key]);
    $(key).value = value;
    $(key).textContent = `${value}%`;
    $(`${key}-value`).textContent = `${value} / 100`;
  }
  $('room').dataset.sleeping = state.sleeping;
  $('room').dataset.mood = mood;
  $('room').dataset.messy = state.cleanliness < 60;
  $('room').dataset.growth = state.bond >= 100 ? 'kindred' : state.bond >= 40 ? 'friend' : 'new';
  $('scene-label').textContent = state.sleeping ? 'The world can wait' : 'A quiet afternoon';
  $('room-status').textContent = state.sleeping ? 'Dreaming' : 'At home';
  $('sleep-label').textContent = state.sleeping ? 'Wake' : 'Sleep';
  for (const action of ['feed','play','clean','pet']) $(`${action}-button`).disabled = state.sleeping;
  $('sleep-button').disabled = false;
  const closedEyes = ['sleeping','sleepy','delighted'].includes(mood);
  const eyePath = closedEyes ? '<path d="M51 96H64M96 96H109" stroke="#293e33" stroke-width="5" fill="none"/>' : '<path d="M52 87H64V103H52ZM96 87H108V103H96Z"/><path d="M54 88H58V92H54ZM98 88H102V92H98Z" fill="#f7f8dc"/>';
  if ($('eyes').dataset.face !== String(closedEyes)) { $('eyes').innerHTML = eyePath; $('eyes').dataset.face = closedEyes; }
  $('mouth').setAttribute('d', mood === 'hungry' ? 'M75 110H85V121H75Z' : ['sleeping','sleepy'].includes(mood) ? 'M73 117H87' : mood === 'lonely' ? 'M70 119V114H90V119' : 'M70 111V117H90V111');
  const hints = { sleeping: state.energy >= 99 ? 'Fully rested. Wake your friend whenever you like.' : 'Rest is doing its work. Energy is coming back.', sleepy: 'A nap would feel wonderful right now.', hungry: 'A berry or two would be very welcome.', messy: 'A few crumbs have become a small ecosystem. Time to clean.', lonely: 'A game or a gentle pat would brighten the afternoon.', delighted: 'A very good day to be a very small creature.', content: 'Everything is quiet. There is room for a little adventure.' };
  $('hint').textContent = hints[mood];
  const target = state.bond < 40 ? 40 : 100;
  $('bond').max = target;
  $('bond').value = Math.min(state.bond, target);
  $('bond-value').textContent = state.bond >= 100 ? 'Kindred spirit' : `${state.bond} / ${target}`;
  $('bond-hint').textContent = state.bond >= 100 ? 'At home together. Care is its own reward now.' : state.bond >= 40 ? 'A little companion. Something new is blooming.' : 'Small acts of care help a new friend feel at home.';
  palette[state.palette].forEach((color,i) => document.documentElement.style.setProperty(['--pet','--pet-light','--pet-dark'][i], color));
  document.querySelectorAll('[data-palette]').forEach(button => button.setAttribute('aria-pressed', button.dataset.palette === state.palette));
}
function updateClock() {
  const now = performance.now();
  if (!document.hidden) state = tickPet(state, (now - lastTick) / 1000);
  lastTick = now;
}
function act(action) {
  updateClock();
  const previousGrowth = growthOf(state);
  const result = careFor(state, action);
  state = result.state;
  $('message').textContent = result.message + (growthOf(state) !== previousGrowth ? ' Your friendship is growing. Look at the garden!' : '');
  clearTimeout(effectTimer);
  delete $('room').dataset.action;
  if (result.effect) {
    // Restart the short CSS response even when the same action repeats.
    void $('room').offsetWidth;
    $('spark').textContent = action === 'clean' ? '✧' : action === 'feed' ? '♧' : '♡';
    $('room').dataset.action = result.effect;
    effectTimer = setTimeout(() => delete $('room').dataset.action, 2000);
  }
  render(); save();
}
for (const action of ['feed','play','clean','sleep','pet']) $(`${action}-button`).addEventListener('click', () => act(action));
$('name-input').value = state.name;
$('name-form').addEventListener('submit', event => {
  event.preventDefault(); state.name = cleanName($('name-input').value); $('name-input').value = state.name;
  $('message').textContent = `${state.name}. That has a nice ring to it.`; render(); save();
});
document.querySelectorAll('[data-palette]').forEach(button => button.addEventListener('click', () => { state.palette = button.dataset.palette; render(); save(); }));
document.addEventListener('visibilitychange', () => { lastTick = performance.now(); save(); });
window.addEventListener('pagehide', save);
window.addEventListener('pageshow', () => { lastTick = performance.now(); });
setInterval(() => { updateClock(); if (document.hidden) return; render(); if (performance.now() - lastSave > 5000) { save(); lastSave = performance.now(); } }, 1000);
$('message').textContent = restored.notice;
render(); save();
