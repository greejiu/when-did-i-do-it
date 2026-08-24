const repeatTypeSelect = document.querySelector("#repeat-type");
const nextDueInput = document.querySelector("#next-due-override");
const itemForm = document.querySelector("#item-form");
const itemLists = [...document.querySelectorAll("#item-list, #category-item-list")];

function ensureAnytimeOption() {
  if (!(repeatTypeSelect instanceof HTMLSelectElement)) return;
  if (repeatTypeSelect.querySelector('option[value="anytime"]')) return;

  const currentValue = repeatTypeSelect.value;
  const option = document.createElement("option");
  option.value = "anytime";
  option.textContent = "아무때나";
  repeatTypeSelect.prepend(option);

  if (currentValue) repeatTypeSelect.value = currentValue;
}

function getNextDueLabel() {
  if (!(nextDueInput instanceof HTMLInputElement)) return null;
  const label = nextDueInput.closest("label");
  return label instanceof HTMLElement ? label : null;
}

function syncAnytimeFields() {
  if (!(repeatTypeSelect instanceof HTMLSelectElement)) return;
  if (!(nextDueInput instanceof HTMLInputElement)) return;

  const isAnytime = repeatTypeSelect.value === "anytime";
  const nextDueLabel = getNextDueLabel();

  nextDueLabel?.classList.toggle("hidden", isAnytime);
  nextDueInput.disabled = isAnytime;

  if (isAnytime) nextDueInput.value = "";
}

function showAnytimeOnCards(root = document) {
  const spans = [];

  if (root instanceof HTMLSpanElement && root.matches(".item-meta span")) {
    spans.push(root);
  }

  for (const span of root.querySelectorAll?.(".item-meta span") || []) {
    spans.push(span);
  }

  for (const span of spans) {
    if (span.textContent?.trim() === "반복 없음") {
      span.textContent = "아무때나";
    }
  }
}

ensureAnytimeOption();
syncAnytimeFields();
showAnytimeOnCards();

repeatTypeSelect?.addEventListener("change", syncAnytimeFields);

itemForm?.addEventListener(
  "submit",
  () => {
    if (repeatTypeSelect?.value === "anytime" && nextDueInput instanceof HTMLInputElement) {
      nextDueInput.value = "";
    }
  },
  true
);

/* 반복과 예정일이 모두 없는 기존 항목을 편집하면 '아무때나'로 표시한다. */
document.addEventListener("click", (event) => {
  const editButton = event.target instanceof Element ? event.target.closest(".edit-button") : null;
  if (!(editButton instanceof HTMLButtonElement)) return;

  window.setTimeout(() => {
    if (!(repeatTypeSelect instanceof HTMLSelectElement)) return;
    if (!(nextDueInput instanceof HTMLInputElement)) return;

    if (repeatTypeSelect.value === "date_only" && !nextDueInput.value) {
      repeatTypeSelect.value = "anytime";
      repeatTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, 0);
});

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) showAnytimeOnCards(node);
    }
  }
});

for (const itemList of itemLists) {
  observer.observe(itemList, { childList: true, subtree: true });
}
