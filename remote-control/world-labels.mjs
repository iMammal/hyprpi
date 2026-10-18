// Friendly display only: stable single-letter world IDs still route every request.
export function worldLabel(id, labels = {}) {
  const value = labels && typeof labels === "object" && !Array.isArray(labels) && Object.hasOwn(labels, id) ? labels[id] : null;
  return typeof value === "string" && value.trim() ? value.trim().replace(/[\x00-\x1f\x7f]/g, "").slice(0, 80) || id : id;
}
export const displayWorld = (world) => worldLabel(world?.id || "", { [world?.id]: world?.label });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function worldChips(worlds, current) {
  return worlds.filter((w) => w.shown || w.id === current).map((w) => {
    const label = displayWorld(w), named = label !== w.id;
    const title = `${label}${named ? ` (${w.id})` : ""}${w.sandboxed ? " " + w.sandboxed + " (sandboxed/remote)" : ""} · ${Number(w.agents) || 0} agents${w.working ? ` · ${Number(w.working) || 0} working` : ""}${w.needsYou ? ` · ${Number(w.needsYou) || 0} need you` : ""}`;
    return `<button class="chip${named ? " named" : ""}${w.id === current ? " cur" : ""}${w.sandboxed ? " sbx" : ""}${w.needsYou ? " needs" : w.working || w.thoughtsBusy ? " working" : ""}" style="--c:${esc(w.color)}" data-w="${esc(w.id)}" title="${esc(title)}" aria-label="${esc(title)}" aria-current="${w.id === current ? "true" : "false"}"><span class="world-name">${esc(label)}</span></button>`;
  }).join("");
}
