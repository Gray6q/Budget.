/* ===== Date și calcule comune ===== */

const STORAGE_KEY = 'budget.transactions.v2';

const MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
];

/* Tranzacții de test, în luna curentă. Le înlocuim cu cele reale mai târziu. */
function createSeedTransactions() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  function day(number) {
    return year + '-' + month + '-' + String(number).padStart(2, '0');
  }

  return [
    { id: 1, date: day(28), title: 'Salariu', category: 'Venit', type: 'income', amount: 8000 },
    { id: 2, date: day(27), title: 'Supermarket', category: 'Alimente', type: 'expense', amount: 342 },
    { id: 3, date: day(25), title: 'Energie electrică', category: 'Facturi', type: 'expense', amount: 480 },
    { id: 4, date: day(23), title: 'Benzină', category: 'Transport', type: 'expense', amount: 400 },
    { id: 5, date: day(21), title: 'Cinema și cină', category: 'Timp liber', type: 'expense', amount: 400 },
    { id: 6, date: day(20), title: 'Proiect client', category: 'Venit', type: 'income', amount: 1500 },
    { id: 7, date: day(18), title: 'Piață', category: 'Alimente', type: 'expense', amount: 508 },
    { id: 8, date: day(15), title: 'Internet și telefon', category: 'Facturi', type: 'expense', amount: 520 },
    { id: 9, date: day(14), title: 'Cadouri', category: 'Altele', type: 'expense', amount: 430 },
    { id: 10, date: day(12), title: 'Taxi', category: 'Transport', type: 'expense', amount: 250 },
    { id: 11, date: day(10), title: 'Reparații', category: 'Altele', type: 'expense', amount: 500 },
    { id: 12, date: day(9), title: 'Concert', category: 'Timp liber', type: 'expense', amount: 240 },
    { id: 13, date: day(6), title: 'Supermarket', category: 'Alimente', type: 'expense', amount: 600 },
    { id: 14, date: day(5), title: 'Abonament transport', category: 'Transport', type: 'expense', amount: 170 },
    { id: 15, date: day(3), title: 'Apă și gaz', category: 'Facturi', type: 'expense', amount: 380 }
  ];
}

/* ----- Salvare și citire ----- */

function saveTransactions(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadTransactions() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    return JSON.parse(saved);
  }

  const seed = createSeedTransactions().concat(createHistorySeed());
  saveTransactions(seed);
  return seed;
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

/* Istoric de test: ultimele 5 luni, ca să existe ce arăta în grafic. */
function createHistorySeed() {
  const now = new Date();
  const incomes = [9200, 9500, 9000, 9700, 9400];
  const expenses = [5600, 6100, 5200, 6400, 5700];
  const list = [];

  for (let offset = 1; offset <= 5; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const prefix = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    const total = expenses[offset - 1];
    const base = 100 + offset * 10;

    list.push({ id: base + 1, date: prefix + '-05', title: 'Salariu', category: 'Venit', type: 'income', amount: incomes[offset - 1] });
    list.push({ id: base + 2, date: prefix + '-12', title: 'Cheltuieli lunare', category: 'Alimente', type: 'expense', amount: Math.round(total * 0.45) });
    list.push({ id: base + 3, date: prefix + '-18', title: 'Cheltuieli lunare', category: 'Facturi', type: 'expense', amount: Math.round(total * 0.35) });
    list.push({ id: base + 4, date: prefix + '-24', title: 'Cheltuieli lunare', category: 'Transport', type: 'expense', amount: Math.round(total * 0.2) });
  }

  return list;
}

/* Ultimele "count" luni, de la cea mai veche la cea curentă */
function getMonthlySeries(list, count) {
  const now = new Date();
  const series = [];

  for (let offset = count - 1; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const summary = getSummary(getMonthTransactions(list, date.getFullYear(), date.getMonth()));

    series.push({
      label: MONTHS_SHORT[date.getMonth()],
      income: summary.income,
      expense: summary.expense
    });
  }

  return series;
}

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
