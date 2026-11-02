/* ===== Pagina Acasă ===== */

const RING_RADIUS = 120;

function updateRing(ratio, percent) {
  const svg = getContainer('ring');
  const value = getContainer('ring-value');
  const circumference = 2 * Math.PI * RING_RADIUS;
  const filled = circumference * Math.min(ratio, 1);

  value.setAttribute('stroke-dasharray', filled + ' ' + (circumference - filled));
  svg.setAttribute('aria-label', percent + '% din venituri cheltuit');
}

function renderHome() {
  const all = loadTransactions();
  const range = getPeriodRange(loadPeriod(), all);
  const summary = getSummary(filterByRange(all, range));

  setText('label', getPeriodLabel(range));
  setText('balance', formatMoney(summary.balance));
  setText('income', '+ ' + formatMoney(summary.income) + ' MDL');
  setText('expense', '− ' + formatMoney(summary.expense) + ' MDL');
  setText('percent', summary.spentPercent + '%');

  updateRing(summary.spentRatio, summary.spentPercent);
}

initPeriodPicker(getContainer('period'), renderHome);
renderHome();
