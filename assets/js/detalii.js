/* ===== Pagina Detalii ===== */

const CHART_MAX_HEIGHT = 180;
const RECENT_COUNT = 5;

function renderSummary(current, summary, previousSummary) {
  const difference = summary.balance - previousSummary.balance;
  const direction = difference >= 0 ? 'mai mult' : 'mai puțin';
  const incomeCount = current.filter(function (transaction) {
    return transaction.type === 'income';
  }).length;

  setText('month', getMonthLabel(new Date()));
  setText('balance', formatMoney(summary.balance) + ' MDL');
  setText('balance-note', 'Cu ' + formatMoney(Math.abs(difference)) + ' MDL ' + direction + ' decât luna trecută');
  setText('income', '+ ' + formatMoney(summary.income) + ' MDL');
  setText('income-note', incomeCount === 1 ? '1 tranzacție de venit' : incomeCount + ' tranzacții de venit');
  setText('expense', '− ' + formatMoney(summary.expense) + ' MDL');
  setText('expense-note', summary.spentPercent + '% din venituri');
}

function renderChart(all) {
  const series = getMonthlySeries(all, 6);
  const bars = getContainer('chart-bars');
  const months = getContainer('chart-months');
  const maxValue = Math.max(1, ...series.map(function (item) {
    return Math.max(item.income, item.expense);
  }));

  bars.innerHTML = '';
  months.innerHTML = '';

  series.forEach(function (item) {
    const group = createElement('div', 'chart__group');
    const income = createElement('div', 'chart__bar chart__bar--income');
    const expense = createElement('div', 'chart__bar chart__bar--expense');

    income.style.height = Math.round(item.income / maxValue * CHART_MAX_HEIGHT) + 'px';
    expense.style.height = Math.round(item.expense / maxValue * CHART_MAX_HEIGHT) + 'px';

    group.append(income, expense);
    bars.append(group);
    months.append(createElement('span', 'chart__month', item.label));
  });
}

function renderCategories(current, summary) {
  const container = getContainer('categories');
  container.innerHTML = '';

  getCategoryTotals(current).forEach(function (category) {
    const percent = summary.expense > 0 ? Math.round(category.total / summary.expense * 100) : 0;
    const item = createElement('div', 'category');
    const row = createElement('div', 'category__row');
    const track = createElement('div', 'category__track');
    const fill = createElement('div', 'category__fill');

    fill.style.width = percent + '%';

    row.append(
      createElement('span', '', category.name),
      createElement('span', '', formatMoney(category.total) + ' MDL')
    );
    track.append(fill);
    item.append(row, track);
    container.append(item);
  });
}

function renderTransactions(current) {
  const container = getContainer('transactions');
  const latest = current
    .slice()
    .sort(function (a, b) {
      return b.date.localeCompare(a.date);
    })
    .slice(0, RECENT_COUNT);

  container.innerHTML = '';

  latest.forEach(function (transaction) {
    container.append(createTransactionRow(transaction));
  });
}

function renderDetails() {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const all = loadTransactions();
  const current = getMonthTransactions(all, now.getFullYear(), now.getMonth());
  const summary = getSummary(current);
  const previousSummary = getSummary(getMonthTransactions(all, previousMonth.getFullYear(), previousMonth.getMonth()));

  renderSummary(current, summary, previousSummary);
  renderChart(all);
  renderCategories(current, summary);
  renderTransactions(current);
}

renderDetails();
