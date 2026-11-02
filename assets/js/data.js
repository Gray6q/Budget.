/* ===== Date și calcule comune ===== */

const STORAGE_KEY = 'budget.transactions.v3';

const MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
];

/* ----- Salvare și citire ----- */

function saveTransactions(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadTransactions() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved);
  } catch (error) {
    return [];
  }
}

/* ----- Calcule ----- */

/* month: 0 = ianuarie ... 11 = decembrie */
function getMonthTransactions(list, year, month) {
  const prefix = year + '-' + String(month + 1).padStart(2, '0');

  return list.filter(function (transaction) {
    return transaction.date.startsWith(prefix);
  });
}

function getSummary(list) {
  let income = 0;
  let expense = 0;

  list.forEach(function (transaction) {
    if (transaction.type === 'income') {
      income += transaction.amount;
    } else {
      expense += transaction.amount;
    }
  });

  const spentRatio = income > 0 ? expense / income : 0;

  return {
    income: income,
    expense: expense,
    balance: income - expense,
    spentRatio: spentRatio,
    spentPercent: Math.round(spentRatio * 100)
  };
}

/* ----- Ajutoare de afișare ----- */

/* 4280 -> "4 280" (cu spațiu fix, ca să nu se rupă pe două rânduri) */
function formatMoney(value) {
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  const parts = text.split('.');

  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return parts.join(',');
}

function getMonthLabel(date) {
  return MONTHS[date.getMonth()] + ' ' + date.getFullYear();
}

/* Pune text în elementul marcat cu data-js="nume" */
function setText(name, text) {
  const element = document.querySelector('[data-js="' + name + '"]');

  if (element) {
    element.textContent = text;
  }
}

/* ===== Adăugiri pentru pagina Detalii ===== */

const MONTHS_SHORT = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];

/* Cheltuielile pe categorii, cele mai mari primele */
function getCategoryTotals(list) {
  const totals = {};

  list.forEach(function (transaction) {
    if (transaction.type === 'expense') {
      totals[transaction.category] = (totals[transaction.category] || 0) + transaction.amount;
    }
  });

  return Object.keys(totals)
    .map(function (name) {
      return { name: name, total: totals[name] };
    })
    .sort(function (a, b) {
      return b.total - a.total;
    });
}

/* "2026-10-28" -> "28 oct" */
function formatShortDate(dateString) {
  const parts = dateString.split('-');
  return Number(parts[2]) + ' ' + MONTHS_SHORT[Number(parts[1]) - 1].toLowerCase();
}

/* ===== Ajutoare comune pentru pagini ===== */

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function getContainer(name) {
  return document.querySelector('[data-js="' + name + '"]');
}

/* Un rând de tranzacție, folosit pe mai multe pagini */
function createTransactionRow(transaction) {
  const isIncome = transaction.type === 'income';
  const item = createElement('div', 'transaction');
  const info = createElement('div', 'transaction__info');
  const sign = isIncome ? '+ ' : '− ';
  const amountClass = isIncome ? 'transaction__amount--income' : 'transaction__amount--expense';

  info.append(
    createElement('div', 'transaction__name', transaction.title),
    createElement('div', 'transaction__date', formatShortDate(transaction.date))
  );

  item.append(
    createElement('div', 'transaction__icon'),
    info,
    createElement('span', 'transaction__tag', transaction.category),
    createElement('div', 'transaction__amount ' + amountClass, sign + formatMoney(transaction.amount) + ' MDL')
  );

  return item;
}

/* ===== Adăugare și ștergere ===== */

/* Categoriile se schimbă aici, într-un singur loc */
const CATEGORIES = {
  expense: ['Alimente', 'Facturi', 'Transport', 'Timp liber', 'Altele'],
  income: ['Venit']
};

function todayString() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

function addTransaction(data) {
  const list = loadTransactions();
  const nextId = list.reduce(function (max, transaction) {
    return Math.max(max, transaction.id);
  }, 0) + 1;

  list.push({
    id: nextId,
    date: data.date,
    title: data.title,
    category: data.category,
    type: data.type,
    amount: data.amount
  });

  saveTransactions(list);
}

function removeTransaction(id) {
  saveTransactions(loadTransactions().filter(function (transaction) {
    return transaction.id !== id;
  }));
}

/* ===== Perioada afișată ===== */

const PERIOD_KEY = 'budget.period';

const PERIOD_PRESETS = [
  { id: '1m', label: '1 lună', months: 1 },
  { id: '2m', label: '2 luni', months: 2 },
  { id: '3m', label: '3 luni', months: 3 },
  { id: '6m', label: '6 luni', months: 6 },
  { id: '12m', label: '1 an', months: 12 },
  { id: 'all', label: 'Tot', months: 0 },
  { id: 'custom', label: 'Personalizat', months: 0 }
];

function dateToString(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function stringToDate(text) {
  const parts = text.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/* "2026-10-28" -> "28 oct 2026" */
function formatFullDate(dateString) {
  return formatShortDate(dateString) + ' ' + dateString.slice(0, 4);
}

function loadPeriod() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERIOD_KEY));

    if (saved && PERIOD_PRESETS.some(function (preset) { return preset.id === saved.preset; })) {
      return saved;
    }
  } catch (error) {
    /* date stricate: folosim valoarea implicită */
  }

  return { preset: '1m', from: '', to: '' };
}

function savePeriod(period) {
  localStorage.setItem(PERIOD_KEY, JSON.stringify(period));
}

/* Transformă perioada aleasă în două date: { from, to, kind, months } */
function getPeriodRange(period, list) {
  const now = new Date();
  const endOfMonth = dateToString(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  if (period.preset === 'custom') {
    let from = period.from || todayString();
    let to = period.to || todayString();

    if (from > to) {
      const swap = from;
      from = to;
      to = swap;
    }

    return { from: from, to: to, kind: 'custom', months: 0 };
  }

  if (period.preset === 'all') {
    const dates = list.map(function (transaction) { return transaction.date; }).sort();
    const first = dates.length ? dates[0] : dateToString(new Date(now.getFullYear(), now.getMonth(), 1));
    const last = dates.length ? dates[dates.length - 1] : '';

    return { from: first, to: last > endOfMonth ? last : endOfMonth, kind: 'all', months: 0 };
  }

  const preset = PERIOD_PRESETS.find(function (item) { return item.id === period.preset; });
  const start = new Date(now.getFullYear(), now.getMonth() - (preset.months - 1), 1);

  return { from: dateToString(start), to: endOfMonth, kind: 'months', months: preset.months };
}

function filterByRange(list, range) {
  return list.filter(function (transaction) {
    return transaction.date >= range.from && transaction.date <= range.to;
  });
}

/* Perioada de dinainte, de aceeași lungime. Pentru "Tot" nu există. */
function getPreviousRange(range) {
  const from = stringToDate(range.from);

  if (range.kind === 'all') {
    return null;
  }

  if (range.kind === 'months') {
    return {
      from: dateToString(new Date(from.getFullYear(), from.getMonth() - range.months, 1)),
      to: dateToString(new Date(from.getFullYear(), from.getMonth(), 0))
    };
  }

  const days = Math.round((stringToDate(range.to) - from) / 86400000) + 1;
  const previousTo = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
  const previousFrom = new Date(previousTo.getFullYear(), previousTo.getMonth(), previousTo.getDate() - (days - 1));

  return { from: dateToString(previousFrom), to: dateToString(previousTo) };
}

function getPeriodLabel(range) {
  if (range.kind === 'months') {
    if (range.months === 1) {
      return getMonthLabel(stringToDate(range.from));
    }

    return range.months === 12 ? 'Ultimul an' : 'Ultimele ' + range.months + ' luni';
  }

  return range.kind === 'all' ? 'Toată perioada' : 'Perioadă personalizată';
}

/* Coloanele graficului: săptămâni, luni sau ani, în funcție de lungimea perioadei */
function getChartBuckets(list, range) {
  const from = stringToDate(range.from);
  const to = stringToDate(range.to);
  const days = Math.round((to - from) / 86400000) + 1;
  const monthSpan = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth() + 1;
  const buckets = [];

  if (days <= 62) {
    let start = from;

    while (start <= to) {
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      buckets.push({
        from: dateToString(start),
        to: dateToString(end),
        label: start.getDate() + ' ' + MONTHS_SHORT[start.getMonth()].toLowerCase()
      });
      start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    }
  } else if (monthSpan <= 24) {
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);

    while (cursor <= to) {
      buckets.push({
        from: dateToString(cursor),
        to: dateToString(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
        label: MONTHS_SHORT[cursor.getMonth()] + (monthSpan > 12 ? ' ' + String(cursor.getFullYear()).slice(2) : '')
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else {
    for (let year = from.getFullYear(); year <= to.getFullYear(); year++) {
      buckets.push({ from: year + '-01-01', to: year + '-12-31', label: String(year) });
    }
  }

  return buckets.map(function (bucket) {
    const summary = getSummary(list.filter(function (transaction) {
      return transaction.date >= bucket.from && transaction.date <= bucket.to;
    }));

    return { label: bucket.label, income: summary.income, expense: summary.expense };
  });
}

/* ----- Selectorul de perioadă (se construiește în containerul primit) ----- */

function createDateField(label, id) {
  const field = createElement('div', 'period__field');
  const caption = createElement('label', 'period__label', label);
  const input = createElement('input', 'period__input');

  caption.htmlFor = id;
  input.id = id;
  input.type = 'date';
  field.append(caption, input);

  return { field: field, input: input };
}

function initPeriodPicker(container, onChange) {
  const options = createElement('div', 'period__options');
  const custom = createElement('div', 'period__custom');
  const text = createElement('p', 'period__text');
  const from = createDateField('De la', 'period-from');
  const to = createDateField('Până la', 'period-to');
  const buttons = {};

  function refresh() {
    const period = loadPeriod();
    const range = getPeriodRange(period, loadTransactions());

    PERIOD_PRESETS.forEach(function (preset) {
      const active = preset.id === period.preset;

      buttons[preset.id].classList.toggle('period__option--active', active);
      buttons[preset.id].setAttribute('aria-pressed', String(active));
    });

    custom.classList.toggle('period__custom--open', period.preset === 'custom');
    from.input.value = range.from;
    to.input.value = range.to;
    text.textContent = formatFullDate(range.from) + ' – ' + formatFullDate(range.to);
  }

  function choose(id) {
    const period = loadPeriod();

    if (id === 'custom') {
      const range = getPeriodRange(period, loadTransactions());
      period.from = range.from;
      period.to = range.to;
    }

    period.preset = id;
    savePeriod(period);
    refresh();
    onChange();
  }

  function changeDates() {
    if (!from.input.value || !to.input.value) {
      return;
    }

    savePeriod({ preset: 'custom', from: from.input.value, to: to.input.value });
    refresh();
    onChange();
  }

  PERIOD_PRESETS.forEach(function (preset) {
    const button = createElement('button', 'period__option', preset.label);

    button.type = 'button';
    button.addEventListener('click', function () {
      choose(preset.id);
    });

    buttons[preset.id] = button;
    options.append(button);
  });

  from.input.addEventListener('change', changeDates);
  to.input.addEventListener('change', changeDates);

  custom.append(from.field, to.field);
  container.append(options, custom, text);
  refresh();
}

/* ===== Import și export ===== */

/* Verifică o tranzacție venită din exterior. Întoarce null dacă nu e validă. */
function cleanTransaction(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const type = raw.type === 'income' || raw.type === 'expense' ? raw.type : null;
  const amount = Math.round(Number(raw.amount) * 100) / 100;
  const date = String(raw.date || '');
  const title = String(raw.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && dateToString(stringToDate(date)) === date;

  if (!type || !(amount > 0) || !validDate || !title) {
    return null;
  }

  let category = String(raw.category || '');

  if (CATEGORIES[type].indexOf(category) === -1) {
    category = type === 'income' ? 'Venit' : 'Altele';
  }

  return { date: date, title: title, category: category, type: type, amount: amount };
}

/* Adaugă mai multe tranzacții deodată; primesc id-uri noi */
function addTransactions(items) {
  const list = loadTransactions();
  let nextId = list.reduce(function (max, transaction) {
    return Math.max(max, transaction.id);
  }, 0) + 1;

  items.forEach(function (item) {
    list.push({
      id: nextId,
      date: item.date,
      title: item.title,
      category: item.category,
      type: item.type,
      amount: item.amount
    });
    nextId += 1;
  });

  saveTransactions(list);
  return items.length;
}

function replaceTransactions(items) {
  saveTransactions([]);
  return addTransactions(items);
}

function getTransactionKey(transaction) {
  return transaction.date + '|' + transaction.type + '|' + Number(transaction.amount).toFixed(2);
}

/* Pentru fiecare tranzacție din listă: true dacă există deja una la fel (aceeași dată, tip și sumă).
   O tranzacție existentă "acoperă" un singur duplicat. */
function findDuplicates(items) {
  const counts = {};

  loadTransactions().forEach(function (transaction) {
    const key = getTransactionKey(transaction);
    counts[key] = (counts[key] || 0) + 1;
  });

  return items.map(function (item) {
    const key = getTransactionKey(item);

    if (counts[key] > 0) {
      counts[key] -= 1;
      return true;
    }

    return false;
  });
}

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type: type }));
  const link = document.createElement('a');

  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

function getBackupText() {
  return JSON.stringify({
    app: 'budget',
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: loadTransactions()
  }, null, 2);
}

/* O celulă CSV; textele care ar putea fi luate drept formulă în Excel primesc un apostrof în față */
function csvCell(value) {
  let text = String(value);

  if (/^[=+\-@\t\r]/.test(text) && isNaN(Number(text))) {
    text = "'" + text;
  }

  return /[",;\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function getCsvText() {
  const rows = [['data', 'descriere', 'categorie', 'tip', 'suma']];

  loadTransactions()
    .slice()
    .sort(function (a, b) {
      return a.date.localeCompare(b.date) || a.id - b.id;
    })
    .forEach(function (transaction) {
      rows.push([
        transaction.date,
        transaction.title,
        transaction.category,
        transaction.type === 'income' ? 'venit' : 'cheltuiala',
        transaction.type === 'income' ? transaction.amount : -transaction.amount
      ]);
    });

  return '\uFEFF' + rows.map(function (row) {
    return row.map(csvCell).join(',');
  }).join('\r\n') + '\r\n';
}
