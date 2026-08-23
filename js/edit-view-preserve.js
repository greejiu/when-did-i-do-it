let previousView = null;
let previousScrollY = null;
let restoreTimer = null;

function getActiveView() {
  const active = document.querySelector('.app-view:not(.hidden)[data-app-view]');
  return active?.dataset.appView || null;
}

function rememberCurrentContext() {
  const view = getActiveView();
  if (!view) return;
  previousView = view;
  previousScrollY = window.scrollY;
  window.clearTimeout(restoreTimer);
}

function restoreContext() {
  if (!previousView) return;

  const activeView = getActiveView();
  if (activeView !== previousView) {
    window.dispatchEvent(
      new CustomEvent('app:navigate', { detail: { view: previousView } })
    );
  }

  if (previousScrollY !== null) {
    const top = previousScrollY;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top, left: 0, behavior: 'auto' });
    });
    window.setTimeout(() => window.scrollTo({ top, left: 0, behavior: 'auto' }), 50);
    window.setTimeout(() => window.scrollTo({ top, left: 0, behavior: 'auto' }), 160);
  }
}

function clearContextSoon(delay = 450) {
  window.clearTimeout(restoreTimer);
  restoreTimer = window.setTimeout(() => {
    previousView = null;
    previousScrollY = null;
  }, delay);
}

document.addEventListener(
  'pointerdown',
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (
      target.closest('.item-action-dialog [data-item-action="edit"]') ||
      target.closest('.edit-button')
    ) {
      rememberCurrentContext();
    }
  },
  true
);

document.addEventListener(
  'click',
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const isEditTrigger = Boolean(
      target.closest('.item-action-dialog [data-item-action="edit"]') ||
      target.closest('.edit-button')
    );

    if (!isEditTrigger) return;
    if (!previousView) rememberCurrentContext();

    window.setTimeout(restoreContext, 0);
    window.setTimeout(restoreContext, 80);
  },
  true
);

const dialogObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type !== 'attributes' || mutation.attributeName !== 'open') continue;
    const dialog = mutation.target;
    if (!(dialog instanceof HTMLDialogElement)) continue;
    if (!dialog.classList.contains('quick-add-modal')) continue;

    if (dialog.open) {
      window.setTimeout(restoreContext, 0);
      window.setTimeout(restoreContext, 80);
    } else if (previousView) {
      restoreContext();
      window.setTimeout(restoreContext, 100);
      window.setTimeout(restoreContext, 260);
      clearContextSoon(500);
    }
  }
});

dialogObserver.observe(document.body, {
  attributes: true,
  subtree: true,
  attributeFilter: ['open'],
});
