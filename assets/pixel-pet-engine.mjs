export const SAVE_KEY = 'pixelPetTerrariumV2';
export const LEGACY_KEY = 'pixelPetStatePro';
const clamp = (value, fallback = 75, max = 100) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
export const cleanName = value => typeof value === 'string' ? value.trim().slice(0, 20) || 'Pip' : 'Pip';
export function newPet() {
  return { version: 2, name: 'Pip', palette: 'fern', fullness: 72, joy: 68, energy: 80, cleanliness: 85, sleeping: false, bond: 0, activeSeconds: 0 };
}
export function restorePet(raw, legacy) {
  let saved;
  if (raw) {
    try { saved = JSON.parse(raw); } catch { /* Recover below. */ }
    if (saved && saved.version === 2 && !Array.isArray(saved)) {
      return { state: { ...newPet(), name: cleanName(saved.name), palette: ['fern','peach','sky'].includes(saved.palette) ? saved.palette : 'fern', fullness: clamp(saved.fullness), joy: clamp(saved.joy), energy: clamp(saved.energy), cleanliness: clamp(saved.cleanliness), sleeping: saved.sleeping === true, bond: clamp(saved.bond, 0, 1000), activeSeconds: clamp(saved.activeSeconds, 0, 1e9) }, notice: 'Welcome back. Your little world waited for you.' };
    }
  }
  if (legacy) {
    try {
      saved = JSON.parse(legacy);
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const state = newPet();
        state.fullness = Math.max(35, clamp(saved.hunger));
        state.joy = Math.max(35, clamp(saved.happiness));
        state.energy = Math.max(35, clamp(saved.energy));
        return { state, notice: 'An old friend, a fresh start. Your earlier pet has a new home.' };
      }
    } catch { /* A malformed legacy save must not stop rendering. */ }
  }
  return { state: newPet(), notice: raw || legacy ? 'That save could not be read. A fresh little friend is ready.' : 'Meet Pip. A small creature with a very big afternoon ahead.' };
}
export function tickPet(state, elapsed) {
  // Only visible, active time counts; a suspended tab never causes catch-up decay.
  const dt = clamp(elapsed, 0, 5);
  return { ...state, fullness: clamp(state.fullness - dt * (state.sleeping ? .018 : .045)), joy: clamp(state.joy - dt * .025), energy: clamp(state.energy + dt * (state.sleeping ? 1.6 : -.035)), cleanliness: clamp(state.cleanliness - dt * .018), activeSeconds: state.activeSeconds + dt };
}
export function moodOf(state) {
  if (state.sleeping) return 'sleeping';
  if (state.energy < 20) return 'sleepy';
  if (state.fullness < 30) return 'hungry';
  if (state.cleanliness < 35) return 'messy';
  if (state.joy < 35) return 'lonely';
  return state.joy > 80 ? 'delighted' : 'content';
}
export function growthOf(state) {
  return state.bond >= 100 ? 'Kindred spirit' : state.bond >= 40 ? 'Little companion' : 'New friend';
}
export function careFor(state, action) {
  const next = { ...state };
  if (action === 'sleep') {
    next.sleeping = !state.sleeping;
    return { state: next, message: next.sleeping ? 'Lights low. Dreams of very large strawberries.' : 'Good morning, world. Even if it is afternoon.', effect: next.sleeping ? 'rest' : 'wake' };
  }
  if (state.sleeping) return { state, message: 'Let your friend rest, or wake them first.' };
  let message;
  if (action === 'feed') {
    if (state.fullness > 90) return { state, message: 'Quite full, thank you. Saving room for later.' };
    next.fullness = clamp(state.fullness + 25); next.cleanliness = clamp(state.cleanliness - 7); next.joy = clamp(state.joy + 4);
    message = 'A berry feast. A few crumbs. No regrets.';
  } else if (action === 'play') {
    if (state.energy < 20) return { state, message: 'A little rest first. Adventures need energy.' };
    next.joy = clamp(state.joy + 22); next.energy = clamp(state.energy - 15); next.fullness = clamp(state.fullness - 6); next.cleanliness = clamp(state.cleanliness - 4);
    message = 'A spectacular bounce. The ball is impressed.';
  } else if (action === 'clean') {
    if (state.cleanliness > 95) return { state, message: 'Already sparkling. Not a crumb in sight.' };
    next.cleanliness = 100; next.joy = clamp(state.joy + 6);
    message = 'Fresh moss, clean paws. A tiny reset for the day.';
  } else if (action === 'pet') {
    if (state.joy > 95) return { state, message: 'You are already the favorite person in this terrarium.' };
    next.joy = clamp(state.joy + 7);
    message = 'A gentle pat. A small moment that counts.';
  } else return { state, message: 'Your friend tilts their head.' };
  next.bond = clamp(state.bond + (action === 'pet' ? 1 : 5), 0, 1000);
  return { state: next, message, effect: action };
}
