(() => {
  'use strict';
  // Keep navigation available in the hero and out of the two image walls.
  const header = document.querySelector('.header');
  const heroSection = document.querySelector('#top');
  let headerFrame = 0;
  function updateHeader() {
    headerFrame = 0;
    const hidden = heroSection.getBoundingClientRect().bottom <= header.offsetHeight;
    header.classList.toggle('is-hidden', hidden);
    header.inert = hidden;
    header.setAttribute('aria-hidden', String(hidden));
    if (hidden && header.contains(document.activeElement)) document.activeElement.blur();
  }
  function scheduleHeader() {
    if (!headerFrame) headerFrame = requestAnimationFrame(updateHeader);
  }
  window.addEventListener('scroll', scheduleHeader, {passive:true});
  window.addEventListener('resize', scheduleHeader);
  window.addEventListener('pageshow', scheduleHeader);
  updateHeader();

  const typeSelect = document.querySelector('#type-filter');
  const clientSelect = document.querySelector('#client-filter');
  const resetButton = document.querySelector('#clear-filters');
  const cards = Array.from(document.querySelectorAll('#work-grid .work-card'));
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
  let dialogCards = [];

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

  function openCard(card, contextCards, trigger) {
    current = card;
    const button = card.querySelector('.card-button');
    if (!dialog.open) {
      lastTrigger = trigger || button;
      dialogCards = contextCards || visibleCards();
    }
    prev.disabled = next.disabled = dialogCards.length < 2;
    title.textContent = button.dataset.title;
    client.textContent = button.dataset.clientLabel;
    category.textContent = button.dataset.categoryLabel;
    document.querySelector('.dialog-note').textContent = card.querySelector('.card-description').textContent;
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
    const visible = dialogCards;
    if (!visible.length || !current) return;
    const index = visible.indexOf(current);
    openCard(visible[(index + offset + visible.length) % visible.length]);
  }
  const archiveGrid = document.querySelector('#work-grid');
  let archivePreview = null;
  let archivePointer = 'mouse';
  function clearArchivePreview() {
    archivePreview?.classList.remove('is-preview');
    archivePreview?.querySelector('.card-button').removeAttribute('aria-expanded');
    archivePreview = null;
  }
  archiveGrid.addEventListener('pointerdown', event => {archivePointer=event.pointerType;});
  archiveGrid.addEventListener('click', event => {
    const button = event.target.closest('.card-button');
    if (!button) return;
    const card=button.closest('.work-card');
    if (innerWidth>=701 && event.detail>0 && archivePointer!=='mouse' && archivePreview!==card) {
      clearArchivePreview();archivePreview=card;card.classList.add('is-preview');button.setAttribute('aria-expanded','true');return;
    }
    clearArchivePreview();openCard(card);
  });
  document.addEventListener('pointerdown',event=>{if(archivePreview&&!archivePreview.contains(event.target))clearArchivePreview();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')clearArchivePreview();});
  window.addEventListener('resize',clearArchivePreview);
  typeSelect.addEventListener('change',clearArchivePreview);
  clientSelect.addEventListener('change',clearArchivePreview);
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

  // The viewport gallery and the archive share records, but keep independent state.
  const showcase = document.querySelector('#work');
  const selectedGrid = document.querySelector('#selected-grid');
  const selectedPage = document.querySelector('#selected-page');
  const pauseRotation = document.querySelector('#selected-pause');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cardById = new Map(cards.map(card => [card.dataset.id, card]));
  const rotation = showcase.dataset.order.split(',').map(id => cardById.get(id));
  const selectionSize = Number(selectedGrid.dataset.pageSize);
  const pageCount = Math.ceil(rotation.length / selectionSize);
  let selectionPage = 0;
  let selectionCards = rotation.slice(0, selectionSize);
  let rotationPaused = reducedMotion.matches;
  let showcaseVisible = false;
  let gridHovered = false;
  let rotating = false;
  let rotationTimer;
  let selectedSwipe = null;
  let selectedSuppressClickUntil = 0;
  let touchPreview = null;
  let lastSelectionPointer = 'mouse';
  function clearTouchPreview() {
    if (!touchPreview) return;
    touchPreview.classList.remove('is-preview');
    touchPreview.querySelector('.card-button').removeAttribute('aria-expanded');
    touchPreview.querySelector('.preview-close')?.remove();
    touchPreview = null;
    selectedGrid.dispatchEvent(new CustomEvent('showcasepreview', {detail:null}));
    scheduleRotation();
  }
  function showTouchPreview(tile, event) {
    clearTouchPreview();
    touchPreview = tile;
    tile.classList.add('is-preview');
    tile.querySelector('.card-button').setAttribute('aria-expanded','true');
    const dismiss = document.createElement('button');
    dismiss.type='button';dismiss.className='preview-close';dismiss.textContent='×';
    dismiss.setAttribute('aria-label','Close preview');
    dismiss.addEventListener('click', e => {e.stopPropagation();clearTouchPreview();});
    tile.append(dismiss);
    positionShowcasePanel({target:tile});
    selectedGrid.dispatchEvent(new CustomEvent('showcasepreview', {detail:{tile,clientX:event.clientX,clientY:event.clientY}}));
    scheduleRotation();
  }
  document.addEventListener('pointerdown', event => {
    if (touchPreview && !touchPreview.contains(event.target)) clearTouchPreview();
  });
  document.addEventListener('keydown', event => {if(event.key==='Escape')clearTouchPreview();});
  window.addEventListener('resize',clearTouchPreview);
  dialog.addEventListener('close',clearTouchPreview);

  function canRotate() {
    return showcaseVisible && !rotationPaused && !document.hidden && !dialog.open &&
      !touchPreview && !gridHovered && !selectedGrid.contains(document.activeElement);
  }
  function scheduleRotation() {
    clearTimeout(rotationTimer);
    if (canRotate() && !rotating) rotationTimer = setTimeout(() => changeSelection(1, true), 6500);
  }
  function updateRotationControl() {
    pauseRotation.setAttribute('aria-pressed', String(rotationPaused));
    pauseRotation.textContent = rotationPaused ? 'Play rotation' : 'Pause rotation';
  }
  async function changeSelection(offset, automatic = false) {
    if (rotating || (automatic && !canRotate())) return;
    rotating = true;
    clearTimeout(rotationTimer);
    const targetPage = (selectionPage + offset + pageCount) % pageCount;
    const nextCards = Array.from({length: Math.min(selectionSize, rotation.length)}, (_, index) =>
      rotation[(targetPage * selectionSize + index) % rotation.length]);
    const tiles = nextCards.map(card => {
      const tile = card.cloneNode(true);
      tile.className = 'showcase-tile';
      tile.hidden = false;
      tile.querySelector('img').loading = 'eager';
      return tile;
    });
    await Promise.allSettled(tiles.map(tile => tile.querySelector('img').decode()));
    if (!automatic || canRotate()) {
      selectionPage = targetPage;
      selectionCards = nextCards;
      clearTouchPreview();
      selectedGrid.replaceChildren(...tiles);
      selectedPage.textContent = `${String(selectionPage + 1).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}`;
    }
    rotating = false;
    scheduleRotation();
  }
  document.querySelector('#selected-prev').addEventListener('click', () => changeSelection(-1));
  document.querySelector('#selected-next').addEventListener('click', () => changeSelection(1));
  pauseRotation.addEventListener('click', () => {
    rotationPaused = !rotationPaused;
    updateRotationControl();
    scheduleRotation();
  });
  selectedGrid.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') { gridHovered = true; scheduleRotation(); }
  });
  selectedGrid.addEventListener('pointerleave', () => { gridHovered = false; scheduleRotation(); });
  function positionShowcasePanel(event) {
    const tile = event.target.closest('.showcase-tile');
    if (!tile) return;
    const rect = tile.getBoundingClientRect();
    // Keep the extended panel inside the viewport, including the final grid row.
    const headerBottom = header.inert ? 0 : header.getBoundingClientRect().bottom;
    const style = getComputedStyle(tile);
    const head = parseFloat(style.getPropertyValue('--panel-head')) || 44;
    const tail = parseFloat(style.getPropertyValue('--panel-tail')) || 180;
    const button = tile.querySelector('.card-button');
    const cardHeight = tile.classList.contains('is-preview') ? button.offsetHeight : rect.height;
    const cardWidth = tile.classList.contains('is-preview') ? button.offsetWidth : rect.width;
    const desiredX = (rect.width-cardWidth)/2;
    const shiftX = Math.max(24-rect.left, Math.min(desiredX, document.documentElement.clientWidth-24-rect.left-cardWidth));
    tile.style.setProperty('--panel-shift-x', `${shiftX}px`);
    const lift = Math.min(0, document.documentElement.clientHeight - 8 - (rect.top + cardHeight + tail));
    const shift = Math.max(headerBottom + 8 - (rect.top - head), lift);
    tile.style.setProperty('--panel-shift-y', `${shift}px`);
  }
  selectedGrid.addEventListener('pointerover', positionShowcasePanel);
  selectedGrid.addEventListener('focusin', event => {
    positionShowcasePanel(event);
    scheduleRotation();
  });
  selectedGrid.addEventListener('focusout', () => setTimeout(scheduleRotation, 0));
  selectedGrid.addEventListener('click', event => {
    if (performance.now() < selectedSuppressClickUntil) return;
    const button = event.target.closest('.card-button');
    if (!button) return;
    const tile = button.closest('.showcase-tile');
    const touch = event.pointerType === 'touch' || event.pointerType === 'pen' || (event.detail > 0 && lastSelectionPointer !== 'mouse');
    if (touch && innerWidth >= 701 && touchPreview !== tile) {
      showTouchPreview(tile,event);
      return;
    }
    clearTouchPreview();
    openCard(cardById.get(tile.dataset.id), selectionCards, button);
    scheduleRotation();
  });
  selectedGrid.addEventListener('pointerdown', event => {
    lastSelectionPointer = event.pointerType;
    if (event.isPrimary && event.pointerType !== 'mouse') selectedSwipe = {id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  window.addEventListener('pointerup', event => {
    if (!selectedSwipe || event.pointerId !== selectedSwipe.id) return;
    const dx = event.clientX - selectedSwipe.x;
    const dy = event.clientY - selectedSwipe.y;
    selectedSwipe = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      selectedSuppressClickUntil = performance.now() + 500;
      changeSelection(dx < 0 ? 1 : -1);
    }
  });
  window.addEventListener('pointercancel', () => { selectedSwipe = null; });
  new IntersectionObserver(entries => {
    showcaseVisible = entries[0].isIntersecting && entries[0].intersectionRatio >= .1;
    if (!showcaseVisible) clearTouchPreview();
    scheduleRotation();
  }, {threshold: [0, .1]}).observe(selectedGrid);
  document.addEventListener('visibilitychange', scheduleRotation);
  dialog.addEventListener('close', scheduleRotation);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) rotationPaused = true;
    updateRotationControl();
    scheduleRotation();
  });
  updateRotationControl();

  const coverflow = document.querySelector('.coverflow');
  const track = coverflow.querySelector('.coverflow-track');
  const slides = Array.from(track.querySelectorAll('.coverflow-slide'));
  const coverflowIndex = document.querySelector('#coverflow-index');
  const coverflowTitle = document.querySelector('#coverflow-title');
  const coverflowDescription = document.querySelector('#coverflow-description');
  const dots = document.querySelector('.coverflow-dots');
  const collectionButtons = Array.from(document.querySelectorAll('.collection-filter'));
  const heroPrev = document.querySelector('#coverflow-prev');
  const heroNext = document.querySelector('#coverflow-next');
  let collection = coverflow.dataset.collection;
  let activeSlides = [];
  let selected = 0;
  let pointerStart = null;
  let suppressClickUntil = 0;
  let dragProgress = 0;
  let dragFrame = 0;

  function renderCoverflow(preview = false) {
    const tabletGallery = innerWidth >= 701 && (innerWidth <= 1100 || (navigator.maxTouchPoints > 0 && innerWidth <= 1400));
    const cardSize = Math.max(100, Math.min(track.clientHeight - (tabletGallery ? 16 : 40), innerWidth * (innerWidth <= 700 ? .54 : tabletGallery ? .64 : .29), tabletGallery ? 680 : 410));
    track.style.setProperty('--hero-card-size', `${cardSize}px`);
    // Each successive pair tucks farther behind the pair in front of it.
    const spread = window.innerWidth <= 700 ? [0,.32,.51,.65] : tabletGallery ? [0,.25,.43,.57] : [0,.66,1.14,1.48];
    const interpolate = (values, depth) => {
      const lo = Math.min(3, Math.floor(depth));
      return values[lo] + (values[Math.min(lo + 1,3)] - values[lo]) * (depth - lo);
    };
    slides.forEach(slide => {
      const index = activeSlides.indexOf(slide);
      slide.hidden = index === -1;
      if (index === -1) {
        slide.classList.remove('is-active', 'is-visible');
        slide.setAttribute('aria-hidden', 'true');
        slide.querySelector('button').tabIndex = -1;
        return;
      }
      let distance = (index - selected + activeSlides.length) % activeSlides.length;
      if (distance > activeSlides.length / 2) distance -= activeSlides.length;
      distance -= dragProgress;
      const depth = Math.abs(distance);
      const visible = depth <= (dragProgress ? 3.7 : 3);
      slide.style.setProperty('--x', `${Math.sign(distance) * cardSize * (interpolate(spread,depth) + Math.max(0,depth-3)*.2)}px`);
      slide.style.setProperty('--rot', `${Math.sign(distance) * -Math.min(depth * 17,38)}deg`);
      slide.style.setProperty('--scale', String(interpolate([1,.88,.75,.63],depth)));
      slide.style.setProperty('--opacity', visible ? '1' : '0');
      slide.style.setProperty('--brightness', String(interpolate([1,.96,.9,.82],depth)));
      slide.style.zIndex = String(Math.round((slides.length - depth) * 10));
      slide.classList.toggle('is-visible', visible);
      slide.classList.toggle('is-active', distance === 0);
      slide.setAttribute('aria-hidden', String(!visible));
      const button = slide.querySelector('button');
      button.tabIndex = distance === 0 ? 0 : -1;
      button.setAttribute('aria-label', `${distance === 0 ? 'Open' : 'Show'} ${slide.dataset.title}`);
      const img = slide.querySelector('img');
      if (visible && !img.getAttribute('src')) img.src = img.dataset.src;
    });
    if (preview) return;
    const total = activeSlides.length;
    coverflowIndex.textContent = `${String(total ? selected + 1 : 0).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    coverflowTitle.textContent = total ? activeSlides[selected].dataset.title : '';
    coverflowDescription.textContent = total ? activeSlides[selected].dataset.description : '';
    const restoreDotFocus = dots.contains(document.activeElement);
    const firstDot = Math.max(0, Math.min(selected - 3, total - 7));
    dots.replaceChildren(...activeSlides.slice(firstDot, firstDot + 7).map((slide, offset) => {
      const button = document.createElement('button');
      const index = firstDot + offset;
      button.type = 'button';
      button.dataset.index = index;
      button.setAttribute('aria-label', `Image ${index + 1}: ${slide.dataset.title}`);
      button.setAttribute('aria-pressed', String(index === selected));
      button.tabIndex = index === selected ? 0 : -1;
      if ((offset === 0 && firstDot > 0) || (offset === 6 && firstDot + 7 < total)) button.className = 'dot-edge';
      return button;
    }));
    if (restoreDotFocus) dots.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    dots.hidden = total < 2;
    heroPrev.disabled = heroNext.disabled = total < 2;
    coverflow.querySelector('.hero-empty').hidden = total !== 0;
    track.hidden = total === 0;
  }

  function filterHero() {
    activeSlides = slides.filter(slide =>
      collection === 'all' || (collection === 'ai' && slide.dataset.category === 'ai-image') ||
        (collection === 'illustrator' && slide.dataset.illustrator === 'true') ||
        slide.dataset.category === collection);
    selected = 0;
    document.querySelector('#hero-result-count').textContent = `${activeSlides.length} ${activeSlides.length === 1 ? 'work' : 'works'}`;
    collectionButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.collection === collection)));
    renderCoverflow();
  }
  collectionButtons.forEach(button => button.addEventListener('click', () => {
    collection = button.dataset.collection;
    filterHero();
  }));
  document.querySelector('#hero-reset').addEventListener('click', () => {
    collection = 'all'; filterHero();
    collectionButtons.find(button => button.dataset.collection === 'all').focus();
  });

  function moveCoverflow(offset) {
    if (activeSlides.length < 2) return;
    selected = (selected + offset + activeSlides.length) % activeSlides.length;
    renderCoverflow();
  }
  heroPrev.addEventListener('click', () => moveCoverflow(-1));
  heroNext.addEventListener('click', () => moveCoverflow(1));
  dots.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    selected = Number(button.dataset.index);
    renderCoverflow();
  });
  coverflow.addEventListener('keydown', event => {
    if (event.target.closest('select, .hero-filters')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); moveCoverflow(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); moveCoverflow(1); }
  });
  track.addEventListener('dragstart', event => event.preventDefault());
  track.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerStart = {x:event.clientX,y:event.clientY,id:event.pointerId,time:event.timeStamp,horizontal:false};
  });
  window.addEventListener('pointermove', event => {
    if (!pointerStart || pointerStart.id !== event.pointerId || activeSlides.length < 2) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (!pointerStart.horizontal) {
      if (Math.max(Math.abs(dx),Math.abs(dy)) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { pointerStart = null; return; }
      pointerStart.horizontal = true;
      track.setPointerCapture(event.pointerId);
      track.classList.add('is-dragging');
    }
    event.preventDefault();
    const size = parseFloat(track.style.getPropertyValue('--hero-card-size'));
    dragProgress = Math.max(-1,Math.min(1,-dx / (size * .6)));
    if (!dragFrame) dragFrame = requestAnimationFrame(() => { dragFrame = 0; renderCoverflow(true); });
  }, {passive:false});
  function finishDrag() {
    cancelAnimationFrame(dragFrame); dragFrame = 0; dragProgress = 0;
    track.classList.remove('is-dragging');
    pointerStart = null;
  }
  window.addEventListener('pointerup', event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    const elapsed = Math.max(1,event.timeStamp - pointerStart.time);
    const horizontal = pointerStart.horizontal;
    finishDrag();
    if (horizontal) suppressClickUntil = performance.now() + 500;
    if (horizontal && Math.abs(dx) > Math.abs(dy) && (Math.abs(dx) > 40 || (Math.abs(dx) > 16 && Math.abs(dx) / elapsed > .35))) {
      moveCoverflow(dx < 0 ? 1 : -1);
    } else renderCoverflow();
  });
  window.addEventListener('pointercancel', () => { finishDrag(); renderCoverflow(); });
  slides.forEach(slide => slide.querySelector('button').addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) return;
    const index = activeSlides.indexOf(slide);
    if (index === -1) return;
    if (index !== selected) { selected = index; renderCoverflow(); return; }
    const heroCards = activeSlides.map(item => cards.find(card => card.dataset.id === item.dataset.id));
    openCard(heroCards[selected], heroCards, event.currentTarget);
  }));
  new ResizeObserver(() => renderCoverflow()).observe(track);
  const motionToggle = document.querySelector('#motion-toggle');
  motionToggle.addEventListener('click', () => {
    const paused = document.body.classList.toggle('motion-paused');
    motionToggle.setAttribute('aria-pressed', String(paused));
    motionToggle.textContent = paused ? 'Play background' : 'Pause background';
  });
  filterHero();
  update();
})();
