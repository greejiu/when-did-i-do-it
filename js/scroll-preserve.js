let savedScrollY = null;
let scrollClearTimer = null;
let previousView = null;
let previousScrollY = null;
let contextClearTimer = null;

function rememberScroll() {
  savedScrollY = window.scrollY;
  window.clearTimeout(scrollClearTimer);
}

function restoreScroll() {
  if (savedScrollY === null) return;
  const top = savedScrollY;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top, left: 0, behavior: "auto" });
  });
}

function restoreScrollBurst() {
  restoreScroll();
  window.setTimeout(restoreScroll, 30);
  window.setTimeout(restoreScroll, 100);
  window.setTimeout(restoreScroll, 220);
}

function clearSavedScrollSoon(delay = 320) {
  window.clearTimeout(scrollClearTimer);
  scrollClearTimer = window.setTimeout(() => {
    savedScrollY = null;
  }, delay);
}

function getActiveView() {
  const active = document.querySelector(".app-view:not(.hidden)[data-app-view]");
  return active?.dataset.appView || null;
}

function rememberCurrentContext() {
  const view = getActiveView();
  if (!view) return;
  previousView = view;
  previousScrollY = window.scrollY;
  window.clearTimeout(contextClearTimer);
}

function restoreContext() {
  if (!previousView) return;

  const activeView = getActiveView();
  if (activeView !== previousView) {
    window.dispatchEvent(
      new CustomEvent("app:navigate", { detail: { view: previousView } })
    );
  }

  if (previousScrollY !== null) {
    const top = previousScrollY;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top, left: 0, behavior: "auto" });
    });
    window.setTimeout(() => window.scrollTo({ top, left: 0, behavior: "auto" }), 50);
    window.setTimeout(() => window.scrollTo({ top, left: 0, behavior: "auto" }), 160);
  }
}

function clearContextSoon(delay = 450) {
  window.clearTimeout(contextClearTimer);
  contextClearTimer = window.setTimeout(() => {
    previousView = null;
    previousScrollY = null;
  }, delay);
}

function isPopupTrigger(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "#item-add-toggle, .category-quick-add, .item-card, .edit-button, .item-action-dialog [data-item-action='edit'], #item-save-button, #item-cancel-button, .quick-add-close"
    )
  );
}

function isEditTrigger(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('.item-action-dialog [data-item-action="edit"], .edit-button')
  );
}

document.addEventListener(
  "pointerdown",
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (isPopupTrigger(target)) rememberScroll();
    if (isEditTrigger(target)) rememberCurrentContext();
  },
  true
);

document.addEventListener(
  "click",
  (event) => {
    const target = event.target instanceof Element ? event.target : null;

    if (isPopupTrigger(target) && savedScrollY === null) {
      rememberScroll();
    }

    if (!isEditTrigger(target)) return;
    if (!previousView) rememberCurrentContext();
    window.setTimeout(restoreContext, 0);
    window.setTimeout(restoreContext, 80);
  },
  true
);

const dialogObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type !== "attributes" || mutation.attributeName !== "open") continue;
    const dialog = mutation.target;
    if (!(dialog instanceof HTMLDialogElement)) continue;

    if (dialog.classList.contains("quick-add-modal")) {
      if (dialog.open) {
        window.clearTimeout(scrollClearTimer);
        restoreScrollBurst();
        if (previousView) {
          window.setTimeout(restoreContext, 0);
          window.setTimeout(restoreContext, 80);
        }
      } else {
        restoreScrollBurst();
        clearSavedScrollSoon();
        if (previousView) {
          restoreContext();
          window.setTimeout(restoreContext, 100);
          window.setTimeout(restoreContext, 260);
          clearContextSoon(500);
        }
      }
      continue;
    }

    if (dialog.classList.contains("item-action-dialog") && !dialog.open) {
      restoreScroll();
      clearSavedScrollSoon(500);
    }
  }
});

dialogObserver.observe(document.body, {
  attributes: true,
  subtree: true,
  attributeFilter: ["open"],
});

window.addEventListener("app:navigate", () => {
  if (savedScrollY !== null) restoreScrollBurst();
});
