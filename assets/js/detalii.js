/* ===== Pagina Detalii ===== */

const CHART_MAX_HEIGHT = 180;
const CHART_MAX_LABELS = 12;
const RECENT_COUNT = 5;

function renderSummary(range, current, summary, all) {
  const previousRange = getPreviousRange(range);
  const incomeCount = current.filter(function (transaction) {
    return transaction.type === 'income';
  }).length;
  let note = 'Din prima tranzacție până azi';

  if (previousRange) {
    const previous = filterByRange(all, previousRange);
    const name = range.kind === 'months' && range.months === 1 ? 'luna trecută' : 'perioada anterioară';

    if (previous.length === 0) {
      note = 'Nu există date pentru ' + name;
    } else {
      const difference = summary.balance - getSummary(previous).balance;
      note = 'Cu ' + formatMoney(Math.abs(difference)) + ' MDL ' + (difference >= 0 ? 'mai mult' : 'mai puțin') + ' decât ' + name;
    }
  }

  setText('label', getPeriodLabel(range));
  setText('balance', formatMoney(summary.balance) + ' MDL');
  setText('balance-note', note);
  setText('income', '+ ' + formatMoney(summary.income) + ' MDL');
  setText('income-note', incomeCount === 1 ? '1 tranzacție de venit' : incomeCount + ' tranzacții de venit');
  setText('expense', '− ' + formatMoney(summary.expense) + ' MDL');
  setText('expense-note', summary.spentPercent + '% din venituri');
}

function renderChart(current, range) {
  const buckets = getChartBuckets(current, range);
  const bars = getContainer('chart-bars');
  const months = getContainer('chart-months');
  const step = Math.ceil(buckets.length / CHART_MAX_LABELS);
  const maxValue = Math.max(1, ...buckets.map(function (item) {
    return Math.max(item.income, item.expense);
  }));

  bars.innerHTML = '';
  months.innerHTML = '';

  buckets.forEach(function (item, index) {
    const group = createElement('div', 'chart__group');
    const income = createElement('div', 'chart__bar chart__bar--income');
    const expense = createElement('div', 'chart__bar chart__bar--expense');

    income.style.height = Math.round(item.income / maxValue * CHART_MAX_HEIGHT) + 'px';
    expense.style.height = Math.round(item.expense / maxValue * CHART_MAX_HEIGHT) + 'px';

    group.append(income, expense);
    bars.append(group);
    months.append(createElement('span', 'chart__month', index % step === 0 ? item.label : ''));
  });
}

function renderCategories(current, summary) {
  const container = getContainer('categories');
  const totals = getCategoryTotals(current);

  container.innerHTML = '';

  if (totals.length === 0) {
    container.append(createElement('p', 'categories__empty', 'Nu ai cheltuieli în această perioadă.'));
  }

  totals.forEach(function (category) {
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
      return b.date.localeCompare(a.date) || b.id - a.id;
    })
    .slice(0, RECENT_COUNT);

  container.innerHTML = '';

  if (latest.length === 0) {
    container.append(createElement('p', 'transactions__empty', 'Nu ai tranzacții în această perioadă.'));
  }

  latest.forEach(function (transaction) {
    container.append(createTransactionRow(transaction));
  });
}

function renderDetails() {
  const all = loadTransactions();
  const range = getPeriodRange(loadPeriod(), all);
  const current = filterByRange(all, range);
  const summary = getSummary(current);

  renderSummary(range, current, summary, all);
  renderChart(current, range);
  renderCategories(current, summary);
  renderTransactions(current);
}

initPeriodPicker(getContainer('period'), renderDetails);
renderDetails();
