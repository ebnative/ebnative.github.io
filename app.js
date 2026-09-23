(() => {
  'use strict';
  const typeSelect = document.querySelector('#type-filter');
  const clientSelect = document.querySelector('#client-filter');
  const resetButton = document.querySelector('#clear-filters');
  const cards = Array.from(document.querySelectorAll('.work-card'));
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#empty-state');
  const dialog = document.querySelector('#work-dialog');
  const media = document.querySelector('#dialog-media');
  const title = document.querySelector('#dialog-title');
  const client = document.querySelector('#dialog-client');
  const category = document.querySelector('#dialog-category');
  const close = document.querySelector('#dialog-close');
  const prev = document.querySelector('#dialog-prev');
  const next = document.querySelector('#dialog-next');
  let current = null;
  let lastTrigger = null;

  function visibleCards() { return cards.filter(card => !card.hidden); }
  function update() {
    let shown = 0;
    for (const card of cards) {
      const match = (!typeSelect.value || card.dataset.category === typeSelect.value) &&
        (!clientSelect.value || card.dataset.client === clientSelect.value);
      card.hidden = !match;
      if (match) shown++;
    }
    count.textContent = `${shown} ${shown === 1 ? 'work' : 'works'}`;
    empty.hidden = shown !== 0;
    resetButton.hidden = !typeSelect.value && !clientSelect.value;
  }
  typeSelect.addEventListener('change', update);
  clientSelect.addEventListener('change', update);
  resetButton.addEventListener('click', () => {
    typeSelect.value = '';
    clientSelect.value = '';
    update();
    typeSelect.focus();
  });

  function openCard(card) {
    current = card;
    const button = card.querySelector('.card-button');
    if (!dialog.open) lastTrigger = button;
    title.textContent = button.dataset.title;
    client.textContent = button.dataset.clientLabel;
    category.textContent = button.dataset.categoryLabel;
    media.replaceChildren();
    let element;
    if (button.dataset.asset.endsWith('.mp4')) {
      element = document.createElement('video');
      element.src = button.dataset.asset;
      element.poster = button.dataset.thumb;
      element.controls = true;
      element.playsInline = true;
      element.preload = 'metadata';
      element.setAttribute('aria-label', button.dataset.title);
    } else {
      element = document.createElement('img');
      element.src = button.dataset.asset;
      element.alt = `${button.dataset.title} — ${button.dataset.clientLabel}`;
    }
    media.append(element);
    if (!dialog.open) dialog.showModal();
    close.focus();
  }
  function step(offset) {
    const visible = visibleCards();
    if (!visible.length || !current) return;
    const index = visible.indexOf(current);
    openCard(visible[(index + offset + visible.length) % visible.length]);
  }
  document.querySelector('#work-grid').addEventListener('click', event => {
    const button = event.target.closest('.card-button');
    if (button) openCard(button.closest('.work-card'));
  });
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    media.replaceChildren();
    if (lastTrigger) lastTrigger.focus();
    current = null;
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  });
  update();
})();
