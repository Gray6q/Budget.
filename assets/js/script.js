/* ===== Pagina Acasă ===== */

const RING_RADIUS = 120;

function updateRing(ratio, percent) {
  const svg = document.querySelector('[data-js="ring"]');
  const value = document.querySelector('[data-js="ring-value"]');
  const circumference = 2 * Math.PI * RING_RADIUS;
  const filled = circumference * Math.min(ratio, 1);

  value.setAttribute('stroke-dasharray', filled + ' ' + (circumference - filled));
  svg.setAttribute('aria-label', percent + '% din venituri cheltuit');
}

function renderHome() {
  const now = new Date();
  const transactions = getMonthTransactions(loadTransactions(), now.getFullYear(), now.getMonth());
  const summary = getSummary(transactions);

  setText('month', getMonthLabel(now));
  setText('balance', formatMoney(summary.balance));
  setText('income', '+ ' + formatMoney(summary.income) + ' MDL');
  setText('expense', '− ' + formatMoney(summary.expense) + ' MDL');
  setText('percent', summary.spentPercent + '%');

  updateRing(summary.spentRatio, summary.spentPercent);
}

renderHome();
