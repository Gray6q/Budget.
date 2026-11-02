/* ===== Pagina Date (import și export) ===== */

const MAX_IMPORT_ROWS = 3000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/* Cuvinte din titlurile coloanelor, ca să ghicim ce coloană ce conține */
const HEADER_HINTS = {
  date: /data|date|дата/i,
  description: /descri|detal|benefic|comerc|merchant|destina|explica|payee|memo|назнач|описан/i,
  amount: /sum[aă]|amount|valoare|debit|retrag|cheltu|сумма/i,
  credit: /credit|incas|alimen|venit|depun|приход/i
};

/* Cuvinte-cheie din descrierea plății. Le poți schimba liber. */
const CATEGORY_RULES = [
  { category: 'Alimente', words: ['linella', 'kaufland', 'nr1', 'nr.1', 'fidesco', 'green hills', 'supermarket', 'piata', 'brutarie', 'mcdonald', 'kfc', 'pizza', 'restaurant', 'cafe', 'coffee', 'glovo', 'wolt'] },
  { category: 'Transport', words: ['benzin', 'petrom', 'rompetrol', 'lukoil', 'socar', 'carburant', 'taxi', 'yandex', 'bolt', 'uber', 'autobuz', 'troleibuz', 'parcare'] },
  { category: 'Facturi', words: ['moldtelecom', 'orange', 'moldcell', 'unite', 'premier energy', 'apa canal', 'apa-canal', 'termoelectrica', 'moldovagaz', 'starnet', 'sun communications', 'internet', 'comunale', 'chirie'] },
  { category: 'Timp liber', words: ['cinema', 'netflix', 'spotify', 'steam', 'youtube', 'iticket', 'bilete', 'teatru', 'concert', 'club', 'fitness'] }
];

/* ----- Citirea fișierelor ----- */

async function readFileText(file) {
  const buffer = await file.arrayBuffer();
  let text;

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (error) {
    text = new TextDecoder('windows-1250').decode(buffer);
  }

  return text.replace(/^\uFEFF/, '');
}

function cleanRows(rows) {
  const filled = rows
    .map(function (row) {
      return row.map(function (cell) {
        return String(cell).replace(/\s+/g, ' ').trim();
      });
    })
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== '';
      });
    });
  const width = filled.reduce(function (max, row) {
    return Math.max(max, row.length);
  }, 0);

  return filled.map(function (row) {
    while (row.length < width) {
      row.push('');
    }

    return row;
  });
}

function detectDelimiter(text) {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n').replace(/"[^"]*"/g, '');
  let best = ',';
  let bestCount = -1;

  [';', '\t', ','].forEach(function (delimiter) {
    const count = sample.split(delimiter).length - 1;

    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  });

  return best;
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return cleanRows(rows);
}

/* Citește cel mai mare tabel dintr-un fișier HTML (de exemplu extrasul primit pe e-mail) */
function parseHtmlTable(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  let best = [];

  doc.querySelectorAll('table').forEach(function (table) {
    const rows = Array.from(table.querySelectorAll('tr'))
      .map(function (tr) {
        return Array.from(tr.children)
          .filter(function (cell) {
            return cell.tagName === 'TD' || cell.tagName === 'TH';
          })
          .map(function (cell) {
            return cell.textContent;
          });
      })
      .filter(function (row) {
        return row.length > 0;
      });

    if (rows.length > best.length) {
      best = rows;
    }
  });

  return cleanRows(best);
}

/* ----- Numere și date ----- */

/* "1 234,56" / "1.234,56" / "1,234.56" / "-50" / "(50,00)" / "50-" -> număr cu semn */
function parseAmount(value) {
  let text = String(value).replace(/[\s\u00A0]/g, '');

  if (!text) {
    return null;
  }

  const negative = /^\(.*\)$/.test(text) || /^[-−–]/.test(text) || /[-−–]$/.test(text);

  text = text.replace(/[^0-9.,]/g, '');

  if (!/\d/.test(text)) {
    return null;
  }

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    text = text.split(',').length === 2 ? text.replace(',', '.') : text.replace(/,/g, '');
  } else if (text.split('.').length > 2) {
    text = text.replace(/\./g, '');
  }

  const number = Number(text);

  if (!isFinite(number)) {
    return null;
  }

  return negative ? -number : number;
}

/* O celulă care arată ca o sumă (nu ca un text cu cifre în el) */
function isNumeric(value) {
  return /^[-−–+(]?\s*\d[\d\s\u00A0.,]*\s*[-−–)]?\s*(?:[A-Za-z]{3})?$/.test(String(value).trim());
}

/* "15.10.2026", "15/10/26", "2026-10-15 12:30" -> "2026-10-15". Implicit: zi înaintea lunii. */
function parseDate(value, monthFirst) {
  const text = String(value).trim();
  let year;
  let month;
  let day;
  let match = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);

  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4}|\d{2})(?!\d)/);

    if (!match) {
      return null;
    }

    day = Number(monthFirst ? match[2] : match[1]);
    month = Number(monthFirst ? match[1] : match[2]);
    year = Number(match[3]);

    if (year < 100) {
      year += 2000;
    }
  }

  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return dateToString(date);
}

/* ----- Ghicirea coloanelor ----- */

function looksLikeHeader(row) {
  return !row.some(function (cell) {
    return parseDate(cell, false) !== null || isNumeric(cell);
  });
}

function guessMapping(rows, hasHeader) {
  const width = rows[0].length;
  const body = rows.slice(hasHeader ? 1 : 0, 80);
  const mapping = { date: -1, description: -1, amount: -1, credit: -1 };
  const used = [];

  function take(field, test) {
    for (let c = 0; c < width; c++) {
      if (used.indexOf(c) === -1 && test(rows[0][c])) {
        mapping[field] = c;
        used.push(c);
        return;
      }
    }
  }

  function pickBest(score) {
    let bestColumn = -1;
    let bestScore = 0;

    for (let c = 0; c < width; c++) {
      const value = used.indexOf(c) === -1 ? score(c) : 0;

      if (value > bestScore) {
        bestScore = value;
        bestColumn = c;
      }
    }

    if (bestColumn > -1) {
      used.push(bestColumn);
    }

    return bestColumn;
  }

  if (hasHeader) {
    take('date', function (header) {
      return HEADER_HINTS.date.test(header);
    });
    take('description', function (header) {
      return HEADER_HINTS.description.test(header);
    });
    take('amount', function (header) {
      return HEADER_HINTS.amount.test(header) && !HEADER_HINTS.credit.test(header);
    });
    take('credit', function (header) {
      return HEADER_HINTS.credit.test(header);
    });
  }

  if (mapping.date === -1) {
    mapping.date = pickBest(function (c) {
      return body.filter(function (row) {
        return parseDate(row[c], false) !== null;
      }).length;
    });
  }

  if (mapping.amount === -1) {
    mapping.amount = pickBest(function (c) {
      return body.filter(function (row) {
        return isNumeric(row[c]) && parseDate(row[c], false) === null;
      }).length;
    });
  }

  if (mapping.description === -1) {
    mapping.description = pickBest(function (c) {
      return body.reduce(function (sum, row) {
        return sum + (isNumeric(row[c]) || parseDate(row[c], false) ? 0 : row[c].length);
      }, 0);
    });
  }

  return mapping;
}

/* ----- Din rânduri în tranzacții ----- */

function guessCategory(title, type) {
  if (type === 'income') {
    return 'Venit';
  }

  const text = title.toLowerCase();

  for (let i = 0; i < CATEGORY_RULES.length; i++) {
    const found = CATEGORY_RULES[i].words.some(function (word) {
      return text.indexOf(word) !== -1;
    });

    if (found) {
      return CATEGORY_RULES[i].category;
    }
  }

  return 'Altele';
}

/* options: { hasHeader, mapping, monthFirst, invert } -> { items, skipped } */
function buildItems(rows, options) {
  const mapping = options.mapping;
  const items = [];
  let skipped = 0;

  rows.slice(options.hasHeader ? 1 : 0).forEach(function (row) {
    const date = parseDate(row[mapping.date], options.monthFirst);
    let type = null;
    let amount = 0;

    if (mapping.credit > -1) {
      const debit = parseAmount(row[mapping.amount]);
      const credit = parseAmount(row[mapping.credit]);

      if (credit) {
        type = 'income';
        amount = Math.abs(credit);
      } else if (debit) {
        type = 'expense';
        amount = Math.abs(debit);
      }
    } else {
      const value = parseAmount(row[mapping.amount]);

      if (value) {
        const signed = options.invert ? -value : value;
        type = signed < 0 ? 'expense' : 'income';
        amount = Math.abs(signed);
      }
    }

    if (!date || !type) {
      skipped += 1;
      return;
    }

    const title = (mapping.description > -1 ? row[mapping.description] : '') || 'Tranzacție importată';

    items.push({
      date: date,
      title: title.slice(0, 80),
      type: type,
      amount: Math.round(amount * 100) / 100,
      category: guessCategory(title, type)
    });
  });

  return { items: items, skipped: skipped };
}

/* ===== Interfața ===== */

const state = {
  rows: [],
  hasHeader: true,
  items: [],
  skipped: 0,
  restore: []
};

const mappingFields = [
  { key: 'date', label: 'Data', optional: false },
  { key: 'description', label: 'Descriere', optional: true },
  { key: 'amount', label: 'Sumă (sau cheltuieli)', optional: false },
  { key: 'credit', label: 'Venituri (dacă sunt în altă coloană)', optional: true }
];

const mappingSelects = {};

function setNote(name, text, isError) {
  const element = getContainer(name);

  element.textContent = text;
  element.classList.toggle('note--error', Boolean(isError));
}

function plural(count, one, many) {
  return count === 1 ? '1 ' + one : count + ' ' + many;
}

/* ----- Export ----- */

function handleExportJson() {
  const count = loadTransactions().length;

  if (count === 0) {
    setNote('export-note', 'Nu ai tranzacții de exportat.', true);
    return;
  }

  downloadFile('buget-copie-' + todayString() + '.json', getBackupText(), 'application/json');
  setNote('export-note', 'Am exportat ' + plural(count, 'tranzacție', 'tranzacții') + '.', false);
}

function handleExportCsv() {
  const count = loadTransactions().length;

  if (count === 0) {
    setNote('export-note', 'Nu ai tranzacții de exportat.', true);
    return;
  }

  downloadFile('buget-' + todayString() + '.csv', getCsvText(), 'text/csv;charset=utf-8');
  setNote('export-note', 'Am exportat ' + plural(count, 'tranzacție', 'tranzacții') + '.', false);
}

/* ----- Restaurare din copie (JSON) ----- */

function resetRestore() {
  state.restore = [];
  getContainer('restore-actions').hidden = true;
  setNote('restore-info', '', false);
}

async function handleRestoreFile(event) {
  const input = event.target;
  const file = input.files[0];

  resetRestore();

  if (!file) {
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    setNote('restore-info', 'Fișierul e prea mare.', true);
    return;
  }

  try {
    const data = JSON.parse(await readFileText(file));
    const source = Array.isArray(data) ? data : data.transactions;

    if (!Array.isArray(source)) {
      throw new Error('format');
    }

    const valid = source.map(cleanTransaction).filter(Boolean);

    if (valid.length === 0) {
      setNote('restore-info', 'Nu am găsit tranzacții valide în fișier.', true);
      return;
    }

    state.restore = valid;
    getContainer('restore-actions').hidden = false;
    setNote('restore-info', 'Fișierul conține ' + plural(valid.length, 'tranzacție validă', 'tranzacții valide')
      + (valid.length < source.length ? ' (' + (source.length - valid.length) + ' ignorate)' : '') + '.', false);
  } catch (error) {
    setNote('restore-info', 'Fișierul nu este o copie de siguranță validă.', true);
  }

  input.value = '';
}

function handleRestoreMerge() {
  const duplicates = findDuplicates(state.restore);
  const fresh = state.restore.filter(function (item, index) {
    return !duplicates[index];
  });

  addTransactions(fresh);
  setNote('restore-info', 'Am adăugat ' + plural(fresh.length, 'tranzacție', 'tranzacții')
    + (fresh.length < state.restore.length ? ' (' + (state.restore.length - fresh.length) + ' existau deja)' : '') + '.', false);
  getContainer('restore-actions').hidden = true;
  state.restore = [];
}

function handleRestoreReplace() {
  const current = loadTransactions().length;

  if (!window.confirm('Ștergi cele ' + current + ' tranzacții de acum și le înlocuiești cu cele din fișier?')) {
    return;
  }

  replaceTransactions(state.restore);
  setNote('restore-info', 'Datele au fost înlocuite cu ' + plural(state.restore.length, 'tranzacție', 'tranzacții') + '.', false);
  getContainer('restore-actions').hidden = true;
  state.restore = [];
}

/* ----- Import din extras bancar ----- */

function buildMappingControls() {
  const container = getContainer('mapping');

  mappingFields.forEach(function (field) {
    const wrapper = createElement('div', 'mapping__field');
    const label = createElement('label', 'mapping__label', field.label);
    const select = createElement('select', 'mapping__select');

    select.id = 'mapping-' + field.key;
    label.htmlFor = select.id;
    select.addEventListener('change', rebuildPreview);

    mappingSelects[field.key] = select;
    wrapper.append(label, select);
    container.append(wrapper);
  });
}

function fillMappingOptions(mapping) {
  mappingFields.forEach(function (field) {
    const select = mappingSelects[field.key];

    select.innerHTML = '';

    if (field.optional) {
      select.append(new Option('— nu folosi —', '-1'));
    }

    state.rows[0].forEach(function (cell, column) {
      select.append(new Option((column + 1) + ' · ' + (cell || '(gol)').slice(0, 26), String(column)));
    });

    select.value = String(mapping[field.key]);
  });
}

function readMapping() {
  const mapping = {};

  mappingFields.forEach(function (field) {
    mapping[field.key] = Number(mappingSelects[field.key].value);
  });

  return mapping;
}

function resetImport() {
  state.rows = [];
  state.items = [];
  getContainer('import-setup').hidden = true;
  getContainer('import-preview').hidden = true;
  setNote('import-message', '', false);
}

function updateRunButton() {
  const count = state.items.filter(function (item) {
    return item.include;
  }).length;
  const button = getContainer('import-run');

  button.textContent = 'Importă ' + plural(count, 'tranzacție', 'tranzacții');
  button.disabled = count === 0;
}

function renderPreview() {
  const body = getContainer('preview-body');
  const duplicates = state.items.filter(function (item) {
    return item.duplicate;
  }).length;

  body.innerHTML = '';

  state.items.forEach(function (item) {
    const row = createElement('tr', item.duplicate ? 'preview__row preview__row--duplicate' : 'preview__row');
    const check = createElement('td', 'preview__cell');
    const box = createElement('input', 'preview__check');
    const select = createElement('select', 'preview__select');
    const sign = item.type === 'income' ? '+ ' : '− ';
    const amountClass = item.type === 'income' ? 'preview__cell--income' : 'preview__cell--expense';
    const description = createElement('td', 'preview__cell', item.title);

    box.type = 'checkbox';
    box.checked = item.include;
    box.setAttribute('aria-label', 'Importă: ' + item.title);
    box.addEventListener('change', function () {
      item.include = box.checked;
      updateRunButton();
    });
    check.append(box);

    CATEGORIES[item.type].forEach(function (name) {
      select.append(new Option(name, name));
    });
    select.value = item.category;
    select.addEventListener('change', function () {
      item.category = select.value;
    });

    if (item.duplicate) {
      description.append(createElement('span', 'preview__tag', 'există deja'));
    }

    row.append(
      check,
      createElement('td', 'preview__cell', formatShortDate(item.date) + ' ' + item.date.slice(0, 4)),
      description,
      createElement('td', 'preview__cell', ''),
      createElement('td', 'preview__cell preview__cell--amount ' + amountClass, sign + formatMoney(item.amount) + ' MDL')
    );
    row.children[3].append(select);
    body.append(row);
  });

  getContainer('import-summary').textContent = plural(state.items.length, 'tranzacție citită', 'tranzacții citite')
    + (duplicates ? ' · ' + duplicates + ' există deja (debifate)' : '')
    + (state.skipped ? ' · ' + state.skipped + ' rânduri ignorate (fără dată sau sumă)' : '');

  getContainer('import-preview').hidden = false;
  updateRunButton();
}

function rebuildPreview() {
  const mapping = readMapping();

  if (mapping.date < 0 || mapping.amount < 0) {
    state.items = [];
    getContainer('import-preview').hidden = true;
    setNote('import-message', 'Alege coloanele pentru dată și pentru sumă.', true);
    return;
  }

  const result = buildItems(state.rows, {
    hasHeader: state.hasHeader,
    mapping: mapping,
    monthFirst: getContainer('opt-month-first').checked,
    invert: getContainer('opt-invert').checked
  });
  const items = result.items.slice(0, MAX_IMPORT_ROWS);
  const duplicates = findDuplicates(items);

  items.forEach(function (item, index) {
    item.duplicate = duplicates[index];
    item.include = !duplicates[index];
  });

  state.items = items;
  state.skipped = result.skipped;

  if (items.length === 0) {
    getContainer('import-preview').hidden = true;
    setNote('import-message', 'Nu am găsit nicio tranzacție cu aceste coloane. Încearcă altă alegere.', true);
    return;
  }

  setNote('import-message', result.items.length > MAX_IMPORT_ROWS ? 'Fișierul are multe rânduri, citesc primele ' + MAX_IMPORT_ROWS + '.' : '', false);
  renderPreview();
}

async function handleImportFile(event) {
  const input = event.target;
  const file = input.files[0];

  resetImport();

  if (!file) {
    return;
  }

  if (/\.(xlsx|xls|pdf|zip|rar|7z)$/i.test(file.name)) {
    setNote('import-message', 'Fișierele Excel, PDF și arhivele nu se pot citi direct. Salvează extrasul ca CSV sau alege fișierul .html din arhivă.', true);
    input.value = '';
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    setNote('import-message', 'Fișierul e prea mare (maximum 5 MB).', true);
    input.value = '';
    return;
  }

  try {
    const text = await readFileText(file);
    const isHtml = /\.html?$/i.test(file.name) || /<table/i.test(text.slice(0, 50000));
    const rows = isHtml ? parseHtmlTable(text) : parseCsv(text);

    if (rows.length < 2 || rows[0].length < 2) {
      setNote('import-message', 'Nu am găsit un tabel cu date în fișier.', true);
    } else {
      state.rows = rows;
      state.hasHeader = looksLikeHeader(rows[0]);
      getContainer('opt-header').checked = state.hasHeader;
      fillMappingOptions(guessMapping(rows, state.hasHeader));
      getContainer('import-setup').hidden = false;
      rebuildPreview();
    }
  } catch (error) {
    setNote('import-message', 'Nu am putut citi fișierul.', true);
  }

  input.value = '';
}

function handleHeaderChange() {
  state.hasHeader = getContainer('opt-header').checked;
  fillMappingOptions(guessMapping(state.rows, state.hasHeader));
  rebuildPreview();
}

function handleImportRun() {
  const chosen = state.items
    .filter(function (item) {
      return item.include;
    })
    .map(cleanTransaction)
    .filter(Boolean);

  addTransactions(chosen);
  resetImport();
  setNote('import-message', 'Am importat ' + plural(chosen.length, 'tranzacție', 'tranzacții') + '. Le vezi în pagina Tranzacții.', false);
}

getContainer('export-json').addEventListener('click', handleExportJson);
getContainer('export-csv').addEventListener('click', handleExportCsv);
getContainer('restore-file').addEventListener('change', handleRestoreFile);
getContainer('restore-merge').addEventListener('click', handleRestoreMerge);
getContainer('restore-replace').addEventListener('click', handleRestoreReplace);
getContainer('import-file').addEventListener('change', handleImportFile);
getContainer('import-run').addEventListener('click', handleImportRun);
getContainer('opt-header').addEventListener('change', handleHeaderChange);
getContainer('opt-invert').addEventListener('change', rebuildPreview);
getContainer('opt-month-first').addEventListener('change', rebuildPreview);

buildMappingControls();
