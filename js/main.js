// Single application entry point.
// Keep the current execution order while the remaining patch-style modules are cleaned up.
await import("./auth.js?v=21");
await import("./card-menu.js?v=2");
await import("./duplicate-guard.js?v=1");
await import("./delete-dialog-guard.js?v=1");
await import("./category-quick-add.js?v=6");
await import("./item-taxonomy-quick.js?v=4");
await import("./sorting.js?v=1");
await import("./anytime.js?v=3");
await import("./theme-settings.js?v=2");
await import("./scroll-preserve.js?v=2");
await import("./subitems.js?v=3");
