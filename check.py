#!/usr/bin/env python3
"""Verifică proiectul: fișiere, linkuri, legături HTML-JS, clase BEM, logică, randare."""
import os, re, shutil, socket, subprocess, sys, tempfile, time

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


PAGES = ['index.html', 'pages/detalii.html', 'pages/tranzactii.html']
EXPECTED = PAGES + [
    'assets/css/style.css', 'assets/css/detalii.css', 'assets/css/tranzactii.css',
    'assets/js/data.js', 'assets/js/script.js', 'assets/js/detalii.js', 'assets/js/tranzactii.js',
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
        used |= set(re.findall(r"(?:setText|getContainer)\('([^']+)'", code))
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


def page_js(page):
    files = js_of(page)
    own = [f for f in files if not f.endswith('data.js')]
    code = ''.join(read(f) for f in own if os.path.isfile(f))
    return files if 'createTransactionRow' in code else own


used_everywhere = set()
for page in PAGES:
    if not os.path.isfile(page):
        continue
    css = css_classes(css_of(page))
    used = html_classes(page) | js_classes(page_js(page))
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
const all = loadTransactions();
const current = getMonthTransactions(all, year, month);
const sum = getSummary(current);
check('venituri luna curentă', sum.income, 9500);
check('cheltuieli luna curentă', sum.expense, 5220);
check('sold', sum.balance, 4280);
check('procent cheltuit', sum.spentPercent, 55);
check('ID-uri unice', new Set(all.map(function (t) { return t.id; })).size, all.length);
check('format 4280', formatMoney(4280), '4\u00A0280');
check('format 1500.5', formatMoney(1500.5), '1\u00A0500,50');
check('format 0', formatMoney(0), '0');
check('fără venituri, procentul e 0', getSummary([]).spentPercent, 0);
const series = getMonthlySeries(all, 6);
check('grafic: 6 luni', series.length, 6);
check('grafic: ultima lună = cheltuielile curente', series[5].expense, 5220);
const cats = getCategoryTotals(current);
check('categorii: suma = cheltuieli', cats.reduce(function (a, c) { return a + c.total; }, 0), 5220);
check('categorii: sortate descrescător', cats.every(function (c, i) { return i === 0 || cats[i - 1].total >= c.total; }), true);
addTransaction({ type: 'expense', title: 'Test', category: 'Alimente', amount: 100.5, date: todayString() });
check('după adăugare: cheltuieli', getSummary(getMonthTransactions(loadTransactions(), year, month)).expense, 5320.5);
const added = loadTransactions().find(function (t) { return t.title === 'Test'; });
removeTransaction(added.id);
check('după ștergere: cheltuieli', getSummary(getMonthTransactions(loadTransactions(), year, month)).expense, 5220);
check('salvat în localStorage', JSON.parse(__store[STORAGE_KEY]).length, all.length);
process.exit(__failed ? 1 : 0);
"""
    if os.path.isfile('assets/js/data.js'):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tmp:
            tmp.write(STUB + read('assets/js/data.js') + TESTS)
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

    try:
        dom = dump('index.html')
        if not dom.strip():
            bad('index.html nu s-a putut încărca')
        else:
            expect('Acasă: sold 4 280', '4 280' in dom)
            expect('Acasă: venituri + 9 500 MDL', '+ 9 500 MDL' in dom)
            expect('Acasă: cheltuieli − 5 220 MDL', '− 5 220 MDL' in dom)
            expect('Acasă: 55%', '55%' in dom)
            expect('Acasă: inelul a fost calculat de JS', '414.7 339.3' not in dom)

        dom = dump('pages/detalii.html')
        if not dom.strip():
            bad('pages/detalii.html nu s-a putut încărca')
        else:
            expect('Detalii: 12 bare în grafic', dom.count('chart__bar chart__bar--') == 12)
            expect('Detalii: 5 categorii', dom.count('class="category__row"') == 5)
            expect('Detalii: 5 tranzacții recente', dom.count('class="transaction"') == 5)
            expect('Detalii: nota cu luna trecută', bool(re.search(r'mai (mult|puțin) decât luna trecută', dom)))

        dom = dump('pages/tranzactii.html')
        if not dom.strip():
            bad('pages/tranzactii.html nu s-a putut încărca')
        else:
            expect('Tranzacții: 15 rânduri în listă', dom.count('class="transaction"') == 15)
            expect('Tranzacții: 15 butoane de ștergere', dom.count('class="transaction__delete"') == 15)
            expect('Tranzacții: 5 categorii în formular', dom.count('<option') == 5)
    finally:
        server.terminate()

# ---------------------------------------------------------------- final
print('\n' + '=' * 48)
if errors:
    print('REZULTAT: ' + str(errors) + ' erori, ' + str(warnings) + ' avertismente')
else:
    print('REZULTAT: totul e în ordine (' + str(warnings) + ' avertismente)')
sys.exit(1 if errors else 0)
