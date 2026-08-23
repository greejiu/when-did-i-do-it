const STYLE_ID = "theme-refine-styles";

function ensureRefineStyles() {
  if (document.querySelector(`#${STYLE_ID}`)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html[data-theme="light"] {
      --comfort-bg: #f5f5f6;
      --comfort-surface: #ffffff;
      --comfort-surface-soft: #f8f8f9;
      --comfort-sage: #f0f0f1;
      --comfort-sage-strong: #e7e7e9;
      --comfort-border: #d8d8dc;
      --comfort-border-soft: #e8e8eb;
      --comfort-text: #202124;
      --comfort-muted: #6f7075;
      --comfort-accent: #66676b;
      --comfort-accent-dark: #2f3033;
      --comfort-accent-soft: #eeeeef;
      --theme-card: #ffffff;
      --theme-panel: #f8f8f9;
      --theme-input: #ffffff;
      --theme-nav: rgba(255, 255, 255, 0.98);
      --theme-hover: #eeeeef;
      --theme-shadow: rgba(20, 20, 24, 0.09);
    }

    html[data-theme="dark"] {
      --comfort-bg: #111113;
      --comfort-surface: #1a1a1d;
      --comfort-surface-soft: #151517;
      --comfort-sage: #202023;
      --comfort-sage-strong: #29292d;
      --comfort-border: #38383d;
      --comfort-border-soft: #2b2b2f;
      --comfort-text: #f2f2f3;
      --comfort-muted: #a6a6ab;
      --comfort-accent: #b8b8bc;
      --comfort-accent-dark: #e8e8ea;
      --comfort-accent-soft: #29292d;
      --theme-card: #1d1d20;
      --theme-panel: #171719;
      --theme-input: #232326;
      --theme-nav: rgba(24, 24, 27, 0.98);
      --theme-hover: #29292d;
      --theme-shadow: rgba(0, 0, 0, 0.34);
    }

    html[data-theme="light"] button.primary,
    html[data-theme="light"] .bottom-nav-button.is-active,
    html[data-theme="light"] .category-filter-button.is-active {
      background: #2f3033 !important;
      border-color: #2f3033 !important;
      color: #ffffff !important;
    }

    html[data-theme="dark"] button.primary,
    html[data-theme="dark"] .bottom-nav-button.is-active,
    html[data-theme="dark"] .category-filter-button.is-active {
      background: #ededee !important;
      border-color: #ededee !important;
      color: #171719 !important;
    }

    html[data-theme="light"] .category-filter-button.is-active small,
    html[data-theme="dark"] .category-filter-button.is-active small {
      color: inherit !important;
      opacity: 0.72;
    }

    html[data-theme="light"] .item-section-heading h4,
    html[data-theme="light"] .due-upcoming,
    html[data-theme="light"] .due-today,
    html[data-theme="light"] .subitem-history-heading h4,
    html[data-theme="light"] .subitem-history-row strong {
      color: #55565b !important;
    }

    html[data-theme="dark"] .item-section-heading h4,
    html[data-theme="dark"] .due-upcoming,
    html[data-theme="dark"] .due-today,
    html[data-theme="dark"] .subitem-history-heading h4,
    html[data-theme="dark"] .subitem-history-row strong {
      color: #c7c7cb !important;
    }

    html[data-theme="light"] .subitem-check-row,
    html[data-theme="light"] .subitem-check-row.is-checked span,
    html[data-theme="light"] .subitem-inline-count,
    html[data-theme="light"] .subitem-manager-message {
      color: #66676b !important;
    }

    html[data-theme="dark"] .subitem-check-row,
    html[data-theme="dark"] .subitem-check-row.is-checked span,
    html[data-theme="dark"] .subitem-inline-count,
    html[data-theme="dark"] .subitem-manager-message {
      color: #b4b4b8 !important;
    }

    html[data-theme="light"] .subitem-check-row input {
      accent-color: #505156 !important;
    }

    html[data-theme="dark"] .subitem-check-row input {
      accent-color: #d3d3d5 !important;
    }

    html[data-theme="light"] .history-calendar-day.has-record::before {
      background: #dddddf !important;
      border-color: #b9b9bd !important;
    }

    html[data-theme="dark"] .history-calendar-day {
      color: #d7d7da !important;
    }

    html[data-theme="dark"] .history-calendar-day.has-record {
      color: #ffffff !important;
    }

    html[data-theme="dark"] .history-calendar-day.has-record::before {
      background: #4a4a4f !important;
      border-color: #69696f !important;
    }

    html[data-theme="light"] .history-calendar-day.has-subitem-record::after {
      background: #77787d !important;
    }

    html[data-theme="dark"] .history-calendar-day.has-subitem-record::after {
      background: #c6c6ca !important;
    }

    html[data-theme="light"] .subitem-progress,
    html[data-theme="light"] .subitem-history-row {
      background: #fafafa !important;
    }

    html[data-theme="dark"] .subitem-progress,
    html[data-theme="dark"] .subitem-history-row,
    html[data-theme="dark"] .subitem-manager-row {
      background: #202023 !important;
    }

    html[data-theme="light"] .theme-choice-preview.is-light {
      background: #f4f4f5 !important;
    }

    html[data-theme="light"] .theme-choice-preview.is-light span:first-child,
    .theme-choice-preview.is-light span:first-child {
      background: #ffffff !important;
    }

    .theme-choice-preview.is-light span:last-child {
      background: #333438 !important;
    }

    .theme-choice-preview.is-dark {
      background: #111113 !important;
    }

    .theme-choice-preview.is-dark span:first-child {
      background: #1d1d20 !important;
    }

    .theme-choice-preview.is-dark span:last-child {
      background: #e5e5e7 !important;
    }
  `;

  document.head.append(style);
}

function refineThemeDescriptions(root = document) {
  for (const button of root.querySelectorAll?.("[data-theme-choice]") ?? []) {
    const description = button.querySelector("small");
    if (!(description instanceof HTMLElement)) continue;

    if (button.dataset.themeChoice === "light") {
      description.textContent = "화이트 중심의 밝고 깔끔한 화면";
    } else if (button.dataset.themeChoice === "dark") {
      description.textContent = "블랙·차콜 중심의 어두운 화면";
    }
  }
}

ensureRefineStyles();
refineThemeDescriptions();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches("[data-theme-choice]")) refineThemeDescriptions(node.parentElement ?? node);
      else refineThemeDescriptions(node);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
