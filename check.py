#!/usr/bin/env python3
"""Verifică proiectul: fișiere, linkuri, legături HTML-JS, clase BEM, logică, randare."""
import os, re, shutil, socket, subprocess, sys, tempfile, time, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

errors = 0
warnings = 0


def ok(message):
    print('  ✔ ' + message)


def bad(message):
    global errors
    errors += 1
    print('  ✘ ' + message)


def warn(message):
    global warnings
    warnings += 1
    print('  ! ' + message)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


PAGES = ['index.html', 'pages/detalii.html', 'pages/tranzactii.html', 'pages/date.html']
EXPECTED = PAGES + [
    'assets/css/style.css', 'assets/css/detalii.css', 'assets/css/tranzactii.css', 'assets/css/date.css',
    'assets/js/data.js', 'assets/js/script.js', 'assets/js/detalii.js', 'assets/js/tranzactii.js', 'assets/js/date.js',
]


def refs(page):
    """Toate fișierele locale la care trimite pagina (href și src)."""
    base = os.path.dirname(page)
    found = []
    for value in re.findall(r'(?:href|src)="([^"]+)"', read(page)):
        if re.match(r'(https?:|mailto:|#|data:)', value):
            continue
        path = value.split('#')[0]
        if path:
            found.append(os.path.normpath(os.path.join(base, path)))
    return found


def css_of(page):
    return [r for r in refs(page) if r.endswith('.css')]


def js_of(page):
    return [r for r in refs(page) if r.endswith('.js')]


# ---------------------------------------------------------------- 1
print('\n1. Fișiere')
for f in EXPECTED:
    if os.path.isfile(f) and os.path.getsize(f) > 0:
        ok(f)
    else:
        bad(f + ' lipsește sau este gol')
for old in ('assets/css/base.css', 'assets/css/home.css', 'assets/css/details.css',
            'assets/js/home.js', 'assets/js/details.js', 'assets/js/transactions.js'):
    if os.path.exists(old):
        warn(old + ' (fișier vechi) încă există')

# ---------------------------------------------------------------- 2
print('\n2. Linkuri între fișiere')
for page in PAGES:
    if not os.path.isfile(page):
        continue
    links = refs(page)
    missing = [r for r in links if not os.path.exists(r)]
    for r in missing:
        bad(page + ' trimite la ' + r + ', care nu există')
    if not missing:
        ok(page + ': toate cele ' + str(len(links)) + ' linkuri există')
    scripts = js_of(page)
    if scripts and not scripts[0].endswith('data.js'):
        bad(page + ': data.js trebuie încărcat înaintea scriptului paginii')
    if len(css_of(page)) != 1:
        bad(page + ': trebuie să aibă exact un fișier CSS, are ' + str(len(css_of(page))))

# ---------------------------------------------------------------- 3
print('\n3. Legătura HTML <-> JS (data-js)')
for page in PAGES:
    if not os.path.isfile(page):
        continue
    html_hooks = set(re.findall(r'data-js="([^"]+)"', read(page)))
    used = set()
    for js in js_of(page):
        if not os.path.isfile(js):
            continue
        code = read(js)
        used |= set(re.findall(r"(?:setText|getContainer|setNote)\('([^']+)'", code))
        used |= set(re.findall(r'\[data-js="([a-z-]+)"\]', code))
    lipsa = sorted(used - html_hooks)
    extra = sorted(html_hooks - used)
    for name in lipsa:
        bad(page + ': JS caută data-js="' + name + '", dar în HTML nu există')
    for name in extra:
        warn(page + ': data-js="' + name + '" e în HTML, dar JS nu îl folosește')
    if not lipsa:
        ok(page + ': toate cele ' + str(len(used)) + ' legături din JS au loc în HTML')

# ---------------------------------------------------------------- 4
print('\n4. Clase BEM (HTML și JS față de CSS)')


def css_classes(files):
    names = set()
    for f in files:
        if os.path.isfile(f):
            text = re.sub(r'/\*.*?\*/', '', read(f), flags=re.S)
            names |= set(re.findall(r'\.([a-zA-Z][\w-]*)', text))
    return names


def html_classes(page):
    names = set()
    for value in re.findall(r'class="([^"]*)"', read(page)):
        names |= set(value.split())
    return names


def js_classes(files):
    names = set()
    element = (r"\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*__[a-z0-9]+(?:-[a-z0-9]+)*"
               r"(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?\b")
    for f in files:
        if os.path.isfile(f):
            code = read(f)
            names |= set(re.findall(element, code))
            for value in re.findall(r"createElement\('[a-z0-9]+',\s*'([^']*)'", code):
                names |= set(value.split())
    return names


def has_rule(name, css):
    return name in css or any(c.startswith(name + '__') or c.startswith(name + '--') for c in css)


def page_js_code(page):
    """Codul paginii, plus funcțiile din data.js pe care le apelează."""
    own = ''.join(read(f) for f in js_of(page) if not f.endswith('data.js') and os.path.isfile(f))
    data = read('assets/js/data.js') if os.path.isfile('assets/js/data.js') else ''
    chunks = {m.group(1): m.group(0) for m in re.finditer(r'^function (\w+)\(.*?^}', data, flags=re.S | re.M)}
    code, added, changed = own, set(), True
    while changed:
        changed = False
        for name, body in chunks.items():
            if name not in added and re.search(r'\b' + name + r'\(', code):
                code += '\n' + body
                added.add(name)
                changed = True
    return code


def classes_in_code(code):
    names = set(re.findall(r"\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*__[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?\b", code))
    for value in re.findall(r"createElement\('[a-z0-9]+',\s*'([^']*)'", code):
        names |= set(value.split())
    names |= set(re.findall(r"classList\.(?:add|remove|toggle)\('([\w-]+)'", code))
    return names


used_everywhere = set()
for page in PAGES:
    if not os.path.isfile(page):
        continue
    css = css_classes(css_of(page))
    used = html_classes(page) | classes_in_code(page_js_code(page))
    used_everywhere |= used
    fara_stil = sorted(c for c in used if not has_rule(c, css))
    for name in fara_stil:
        bad(page + ': clasa .' + name + ' nu are stil în CSS-ul paginii')
    if not fara_stil:
        ok(page + ': toate cele ' + str(len(used)) + ' clase au stil')

all_css = css_classes([f for f in EXPECTED if f.endswith('.css')])
for name in sorted(all_css - used_everywhere):
    warn('.' + name + ' e în CSS, dar nu e folosită nicăieri (nu e greșeală, doar curățenie)')

# ---------------------------------------------------------------- 5
print('\n5. Sintaxa JavaScript și logica')
node = shutil.which('node')
if not node:
    warn('Node.js nu e instalat, sar peste acest pas (pe Arch/Omarchy: sudo pacman -S nodejs)')
else:
    for js in [f for f in EXPECTED if f.endswith('.js')]:
        if os.path.isfile(js):
            result = subprocess.run([node, '--check', js], capture_output=True, text=True)
            if result.returncode == 0:
                ok(js + ': sintaxă corectă')
            else:
                bad(js + ': ' + result.stderr.strip().splitlines()[-1])

    STUB = r"""
const __store = {};
const localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(__store, k) ? __store[k] : null; },
  setItem: function (k, v) { __store[k] = String(v); },
  removeItem: function (k) { delete __store[k]; }
};
let __failed = 0;
function check(name, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  console.log('  ' + (same ? '✔ ' : '✘ ') + name + (same ? '' : '  (primit: ' + JSON.stringify(actual) + ', așteptat: ' + JSON.stringify(expected) + ')'));
  if (!same) __failed++;
}
"""
    TESTS = r"""
const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();
const lastMonth = new Date(year, month - 1, 1);
check('pornește gol', loadTransactions().length, 0);
check('fără date, procentul e 0', getSummary([]).spentPercent, 0);
addTransaction({ type: 'income', title: 'Salariu', category: 'Venit', amount: 8000, date: todayString() });
addTransaction({ type: 'expense', title: 'Supermarket', category: 'Alimente', amount: 342.5, date: todayString() });
addTransaction({ type: 'expense', title: 'Benzină', category: 'Transport', amount: 400, date: todayString() });
const all = loadTransactions();
const current = getMonthTransactions(all, year, month);
const sum = getSummary(current);
check('3 tranzacții salvate', all.length, 3);
check('ID-uri unice', new Set(all.map(function (t) { return t.id; })).size, 3);
check('venituri', sum.income, 8000);
check('cheltuieli', sum.expense, 742.5);
check('sold', sum.balance, 7257.5);
check('procent cheltuit', sum.spentPercent, 9);
check('luna trecută e goală', getMonthTransactions(all, lastMonth.getFullYear(), lastMonth.getMonth()).length, 0);
check('format 4280', formatMoney(4280), '4\u00A0280');
check('format 1500.5', formatMoney(1500.5), '1\u00A0500,50');
check('format 0', formatMoney(0), '0');
const range1 = getPeriodRange({ preset: '1m' }, all);
const range6 = getPeriodRange({ preset: '6m' }, all);
const swapped = getPeriodRange({ preset: 'custom', from: '2026-12-31', to: '2026-01-01' }, all);
check('perioadă 1 lună: cele 3 tranzacții', filterByRange(all, range1).length, 3);
check('perioadă 6 luni: începe cu 5 luni în urmă', range6.from, dateToString(new Date(year, month - 5, 1)));
check('perioadă "tot": începe cu prima tranzacție', getPeriodRange({ preset: 'all' }, all).from, todayString());
check('perioadă personalizată: datele inversate se corectează', [swapped.from, swapped.to], ['2026-01-01', '2026-12-31']);
check('perioadă anterioară: se termină înainte de luna curentă', getPreviousRange(range1).to, dateToString(new Date(year, month, 0)));
check('perioadă "tot": fără perioadă anterioară', getPreviousRange(getPeriodRange({ preset: 'all' }, all)), null);
const weeks = getChartBuckets(filterByRange(all, range1), range1);
const months = getChartBuckets(filterByRange(all, range6), range6);
check('grafic 1 lună: 4-5 săptămâni', weeks.length === 4 || weeks.length === 5, true);
check('grafic 6 luni: 6 coloane', months.length, 6);
check('grafic: ultima coloană = cheltuielile curente', months[5].expense, 742.5);
check('grafic: prima coloană e goală', months[0].expense, 0);
check('suma pe săptămâni = total cheltuieli', weeks.reduce(function (a, b) { return a + b.expense; }, 0), 742.5);
const cats = getCategoryTotals(current);
check('categorii: suma = cheltuieli', cats.reduce(function (a, c) { return a + c.total; }, 0), 742.5);
check('categorii: sortate descrescător', cats.every(function (c, i) { return i === 0 || cats[i - 1].total >= c.total; }), true);
check('salvat în localStorage', JSON.parse(__store[STORAGE_KEY]).length, 3);
removeTransaction(all.find(function (t) { return t.title === 'Benzină'; }).id);
check('după ștergere: cheltuieli', getSummary(getMonthTransactions(loadTransactions(), year, month)).expense, 342.5);
check('după ștergere: 2 tranzacții', loadTransactions().length, 2);
replaceTransactions([]);
check('suma 1 234,56', parseAmount('1 234,56'), 1234.56);
check('suma 1.234,56', parseAmount('1.234,56'), 1234.56);
check('suma 1,234.56', parseAmount('1,234.56'), 1234.56);
check('suma (50,00)', parseAmount('(50,00)'), -50);
check('suma text', parseAmount('abc'), null);
check('data 15.10.2026', parseDate('15.10.2026', false), '2026-10-15');
check('data inexistentă', parseDate('31.02.2026', false), null);
check('data lună/zi/an', parseDate('10/15/2026', true), '2026-10-15');
const impRows = parseCsv('Data;Descriere;Suma\r\n15.10.2026;"Linella; Chisinau";-123,45\r\n16.10.2026;Salariu;8000,00\r\n');
check('csv: ghilimele și ;', impRows[1][1], 'Linella; Chisinau');
const impMap = guessMapping(impRows, true);
check('mapare după titluri', impMap, { date: 0, description: 1, amount: 2, credit: -1 });
const impItems = buildItems(impRows, { hasHeader: true, mapping: impMap, monthFirst: false, invert: false }).items;
check('import: tip și categorie', [impItems[0].type, impItems[0].category, impItems[1].type], ['expense', 'Alimente', 'income']);
const impCredit = parseCsv('Data;Detalii;Debit;Credit\n15.10.2026;Moldcell;250,00;\n16.10.2026;Salariu;;8000,00\n');
const impCreditMap = guessMapping(impCredit, true);
check('mapare debit/credit', impCreditMap, { date: 0, description: 1, amount: 2, credit: 3 });
check('debit/credit: tipuri', buildItems(impCredit, { hasHeader: true, mapping: impCreditMap, monthFirst: false, invert: false }).items.map(function (i) { return i.type; }), ['expense', 'income']);
check('categorie ghicită', guessCategory('Bolt ride', 'expense'), 'Transport');
check('curățare: categorie necunoscută', cleanTransaction({ date: '2026-10-15', title: 'x', amount: 5, type: 'expense', category: 'Zzz' }).category, 'Altele');
check('curățare: dată falsă', cleanTransaction({ date: '2026-02-31', title: 'x', amount: 5, type: 'expense' }), null);
addTransactions([{ date: '2026-10-15', title: 'A', category: 'Alimente', type: 'expense', amount: 10 }]);
check('duplicate: doar primul acoperit', findDuplicates([{ date: '2026-10-15', type: 'expense', amount: 10 }, { date: '2026-10-15', type: 'expense', amount: 10 }]), [true, false]);
const impBack = parseCsv(getCsvText().replace(/^\uFEFF/, ''));
const impBackItem = buildItems(impBack, { hasHeader: true, mapping: guessMapping(impBack, true), monthFirst: false, invert: false }).items[0];
check('export CSV se poate importa înapoi', [impBackItem.date, impBackItem.type, impBackItem.amount], ['2026-10-15', 'expense', 10]);
check('csv: formulele sunt neutralizate', csvCell('=SUM(A1)'), "'=SUM(A1)");
process.exit(__failed ? 1 : 0);
"""
    if os.path.isfile('assets/js/data.js'):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tmp:
            tmp.write(STUB + read('assets/js/data.js') + read('assets/js/date.js').split('/* ===== Interfața ===== */')[0] + TESTS)
        result = subprocess.run([node, tmp.name], capture_output=True, text=True, encoding='utf-8')
        os.unlink(tmp.name)
        print(result.stdout, end='')
        if result.returncode != 0:
            bad('testele de logică au eșuat' + (': ' + result.stderr.strip().splitlines()[-1] if result.stderr.strip() else ''))
        else:
            ok('testele de logică au trecut')

# ---------------------------------------------------------------- 6
print('\n6. Randare reală în Chromium (fără interfață)')
browser = next((p for p in (shutil.which(n) for n in ('chromium', 'chromium-browser', 'google-chrome-stable', 'google-chrome')) if p), None)
if not browser:
    warn('Nu am găsit Chromium în terminal, sar peste acest pas')
else:
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'],
                              cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)

    def dump(path):
        profile = tempfile.mkdtemp()
        try:
            result = subprocess.run(
                [browser, '--headless=new', '--disable-gpu', '--no-sandbox', '--user-data-dir=' + profile,
                 '--virtual-time-budget=4000', '--dump-dom', 'http://127.0.0.1:' + str(port) + '/' + path],
                capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60)
            return result.stdout.replace('&nbsp;', ' ').replace('\u00a0', ' ')
        except subprocess.TimeoutExpired:
            return ''
        finally:
            shutil.rmtree(profile, ignore_errors=True)

    def expect(label, condition):
        ok(label) if condition else bad(label)

    luni = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August',
            'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']
    azi = datetime.date.today()
    eticheta = luni[azi.month - 1] + ' ' + str(azi.year)

    try:
        dom = dump('index.html')
        if not dom.strip():
            bad('index.html nu s-a putut încărca')
        else:
            expect('Acasă: luna curentă (' + eticheta + ')', eticheta in dom)
            expect('Acasă: venituri + 0 MDL (fără date)', '+ 0 MDL' in dom)
            expect('Acasă: cheltuieli − 0 MDL', '− 0 MDL' in dom)
            expect('Acasă: procent 0%', '>0%<' in dom)

        dom = dump('pages/detalii.html')
        if not dom.strip():
            bad('pages/detalii.html nu s-a putut încărca')
        else:
            expect('Detalii: luna curentă', eticheta in dom)
            expect('Detalii: bare în grafic (4-5 săptămâni)', dom.count('chart__bar chart__bar--') in (8, 10))
            expect('Detalii: mesaj gol la categorii', 'categories__empty' in dom)
            expect('Detalii: mesaj gol la tranzacții', 'transactions__empty' in dom)

        dom = dump('pages/tranzactii.html')
        if not dom.strip():
            bad('pages/tranzactii.html nu s-a putut încărca')
        else:
            expect('Tranzacții: luna curentă', eticheta in dom)
            expect('Tranzacții: mesaj listă goală', 'workspace__empty' in dom)
            expect('Tranzacții: 5 categorii în formular', dom.count('<option') == 5)

        dom = dump('pages/date.html')
        if not dom.strip():
            bad('pages/date.html nu s-a putut încărca')
        else:
            expect('Date: butoanele de export', 'data-js="export-json"' in dom and 'data-js="export-csv"' in dom)
            expect('Date: 4 liste de coloane construite de JS', dom.count('class="mapping__select"') == 4)
            expect('Date: previzualizarea e ascunsă', bool(re.search(r'data-js="import-preview"[^>]*hidden', dom)))
    finally:
        server.terminate()

# ---------------------------------------------------------------- final
print('\n' + '=' * 48)
if errors:
    print('REZULTAT: ' + str(errors) + ' erori, ' + str(warnings) + ' avertismente')
else:
    print('REZULTAT: totul e în ordine (' + str(warnings) + ' avertismente)')
sys.exit(1 if errors else 0)
