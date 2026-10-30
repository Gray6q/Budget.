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
