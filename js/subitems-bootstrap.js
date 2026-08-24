import "./theme-settings.js?v=1";
import "./theme-refine.js?v=1";
import "./scroll-preserve.js?v=1";
import "./edit-view-preserve.js?v=1";

// item cards already receive data-item-id when items.js renders them.
// Keep this bootstrap focused on loading the subitem module only.
await import("./subitems.js?v=3");
