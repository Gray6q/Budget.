/* ===== Pagina Tranzacții ===== */

const form = getContainer('form');
let viewedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let messageTimer = null;

function getSelectedType() {
  return form.elements.type.value;
}

function fillCategories(type) {
  const select = getContainer('category');
  select.innerHTML = '';

  CATEGORIES[type].forEach(function (name) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.append(option);
  });
}

function showMessage(text, isError) {
  const message = getContainer('form-message');

  message.textContent = text;
  message.classList.toggle('form__message--error', isError);
  clearTimeout(messageTimer);

  if (text && !isError) {
    messageTimer = setTimeout(function () {
      message.textContent = '';
    }, 3000);
  }
}

function renderMonth() {
  const current = getMonthTransactions(loadTransactions(), viewedMonth.getFullYear(), viewedMonth.getMonth())
    .sort(function (a, b) {
      return b.date.localeCompare(a.date) || b.id - a.id;
    });
  const summary = getSummary(current);
  const list = getContainer('list');

  setText('month', getMonthLabel(viewedMonth));
  setText('income', '+ ' + formatMoney(summary.income) + ' MDL');
  setText('expense', '− ' + formatMoney(summary.expense) + ' MDL');
  setText('count', current.length === 1 ? '1 tranzacție' : current.length + ' tranzacții');

  list.innerHTML = '';

  if (current.length === 0) {
    list.append(createElement('p', 'workspace__empty', 'Nu există tranzacții în această lună.'));
    return;
  }

  current.forEach(function (transaction) {
    const row = createTransactionRow(transaction);
    const button = createElement('button', 'transaction__delete', '×');

    button.type = 'button';
    button.setAttribute('aria-label', 'Șterge: ' + transaction.title);
    button.addEventListener('click', function () {
      handleDelete(transaction);
    });

    row.append(button);
    list.append(row);
  });
}

function handleDelete(transaction) {
  if (window.confirm('Ștergi tranzacția "' + transaction.title + '"?')) {
    removeTransaction(transaction.id);
    renderMonth();
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const title = form.elements.title.value.trim();
  const amount = Number(form.elements.amount.value);
  const date = form.elements.date.value;

  if (!title) {
    showMessage('Scrie o descriere.', true);
    return;
  }

  if (!(amount > 0)) {
    showMessage('Suma trebuie să fie mai mare ca 0.', true);
    return;
  }

  if (!date) {
    showMessage('Alege data.', true);
    return;
  }

  addTransaction({
    type: getSelectedType(),
    title: title,
    amount: Math.round(amount * 100) / 100,
    category: form.elements.category.value,
    date: date
  });

  viewedMonth = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1);
  form.elements.title.value = '';
  form.elements.amount.value = '';
  form.elements.title.focus();

  showMessage('Tranzacția a fost adăugată.', false);
  renderMonth();
}

function changeMonth(step) {
  viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + step, 1);
  renderMonth();
}

form.addEventListener('submit', handleSubmit);

form.addEventListener('change', function (event) {
  if (event.target.name === 'type') {
    fillCategories(getSelectedType());
  }
});

getContainer('prev').addEventListener('click', function () {
  changeMonth(-1);
});

getContainer('next').addEventListener('click', function () {
  changeMonth(1);
});

form.elements.date.value = todayString();
fillCategories(getSelectedType());
renderMonth();
