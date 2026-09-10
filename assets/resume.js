const notes = {
  all: 'From interpreting traces of the past to building the systems people use today.',
  observe: 'Observation: read the context, follow the evidence, and notice what others pass over.',
  systems: 'Systems: understand how the parts depend on each other, then make the whole work better.',
  people: 'People: listen closely, translate complexity, and build around the person doing the work.'
};
const chapters = [...document.querySelectorAll('.chapter')];
document.querySelectorAll('[data-lens]').forEach(button => {
  button.addEventListener('click', () => {
    const lens = button.dataset.lens;
    document.querySelectorAll('[data-lens]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    chapters.forEach(chapter => chapter.dataset.match = String(lens === 'all' || chapter.dataset.threads.split(' ').includes(lens)));
    document.getElementById('lens-note').textContent = notes[lens];
  });
});
// Expand the full history for printing, then restore the reader’s exact view.
let beforePrint = null;
window.addEventListener('beforeprint', () => {
  if (beforePrint) return;
  beforePrint = [...document.querySelectorAll('details')].map(node => ({node, open:node.open}));
  beforePrint.forEach(({node}) => node.open = true);
});
window.addEventListener('afterprint', () => {
  beforePrint?.forEach(({node, open}) => node.open = open);
  beforePrint = null;
});
document.getElementById('print-resume').addEventListener('click', () => window.print());
const progress = document.querySelector('.reading-progress');
let scheduled = false;
function updateProgress() {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0})`;
  scheduled = false;
}
window.addEventListener('scroll', () => {
  if (!scheduled) { scheduled = true; requestAnimationFrame(updateProgress); }
}, {passive:true});
window.addEventListener('resize', updateProgress);
new ResizeObserver(updateProgress).observe(document.body);
updateProgress();
