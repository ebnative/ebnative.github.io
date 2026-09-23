(() => {
  document.querySelector('#resume-print').addEventListener('click', () => window.print());
  const toggle = document.querySelector('#motion-toggle');
  toggle.addEventListener('click', () => {
    const paused = document.body.classList.toggle('motion-paused');
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Hintergrund abspielen' : 'Hintergrund pausieren';
  });
})();
