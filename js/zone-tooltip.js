// Tap-for-detail tooltip for the Zones shot-chart tab. The tooltip's content is
// computed in court.js (it has the stats/baselines) and handed off here purely as
// a string on each zone path's data-tooltip attribute - this module only owns
// showing/positioning/dismissing it, so it works the same for every court on the page.
export function installZoneTooltip(panelEl, svgEl) {
  let tooltipEl = panelEl.querySelector('.zone-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'zone-tooltip hidden';
    panelEl.appendChild(tooltipEl);
  }

  function hide() {
    tooltipEl.classList.add('hidden');
  }

  svgEl.addEventListener('click', (event) => {
    const path = event.target.closest('[data-tooltip]');
    if (!path) {
      hide();
      return;
    }
    tooltipEl.textContent = path.dataset.tooltip;
    tooltipEl.classList.remove('hidden');
    const panelRect = panelEl.getBoundingClientRect();
    const x = event.clientX - panelRect.left;
    const y = event.clientY - panelRect.top;
    tooltipEl.style.left = `${Math.min(Math.max(x, 8), panelRect.width - 8)}px`;
    tooltipEl.style.top = `${Math.max(y, 8)}px`;
  });

  document.addEventListener('click', (event) => {
    if (!panelEl.contains(event.target)) hide();
  });
}
