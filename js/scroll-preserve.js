let savedScrollY = null;
let clearTimer = null;

function rememberScroll() {
  savedScrollY = window.scrollY;
  window.clearTimeout(clearTimer);
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
  window.clearTimeout(clearTimer);
  clearTimer = window.setTimeout(() => {
    savedScrollY = null;
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

document.addEventListener(
  "pointerdown",
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!isPopupTrigger(target)) return;
    rememberScroll();
  },
  true
);

document.addEventListener(
  "click",
  (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!isPopupTrigger(target)) return;
    if (savedScrollY === null) rememberScroll();
  },
  true
);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type !== "attributes" || mutation.attributeName !== "open") continue;
    const dialog = mutation.target;
    if (!(dialog instanceof HTMLDialogElement)) continue;

    if (dialog.classList.contains("quick-add-modal")) {
      if (dialog.open) {
        window.clearTimeout(clearTimer);
        restoreScrollBurst();
      } else {
        restoreScrollBurst();
        clearSavedScrollSoon();
      }
      continue;
    }

    if (dialog.classList.contains("item-action-dialog") && !dialog.open) {
      restoreScroll();
      clearSavedScrollSoon(500);
    }
  }
});

observer.observe(document.body, {
  attributes: true,
  subtree: true,
  attributeFilter: ["open"],
});

window.addEventListener("app:navigate", () => {
  if (savedScrollY !== null) restoreScrollBurst();
});
