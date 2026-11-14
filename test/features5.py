# Quem pode criar tarefas e recompensas + régua de dificuldade gradual.
# Rode antes: npx wrangler dev --port 8787
from playwright.sync_api import sync_playwright
import sys, datetime
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8787/'
errs = []; fails = []
def T(ok, msg):
    print(('OK   ' if ok else 'FALHA ') + msg)
    if not ok: fails.append(msg)
stamp = int(datetime.datetime.now().timestamp())
def api(P, fn, *args):
    return P.evaluate("""([f,a])=>{const t=(JSON.parse(localStorage.getItem('guilda-auth')||'null')||{}).token||'';
      return fetch('/api/'+f,{method:'POST',headers:{'content-type':'application/json','x-guilda-token':t},body:JSON.stringify(a)}).then(r=>r.json())}""", [fn, list(args)])
def docs(P, code): return api(P, 'api_get', -1, code)['docs']
def W(P, ms=600): P.wait_for_timeout(ms)
def body(P): return P.inner_text('body')
def close_modal(P):
    for _ in range(4):
        if P.query_selector('.modal-bg') and not P.query_selector('.modal.recovery'): P.keyboard.press('Escape'); W(P, 300)
def register(P, email):
    P.fill('#acct-email', email); P.fill('#acct-pass', 'senha123'); P.click('[data-act=register]'); W(P, 1800)
    if P.query_selector('[data-act=recoveryDone]'): P.click('[data-act=recoveryDone]'); W(P, 400)
def new_hero(P, name, cls):
    P.click('[data-act=create]'); W(P, 500); P.fill('#hero-name', name); P.click(f'[data-act=cls][data-v={cls}]'); P.click('[data-act=saveHero]'); W(P, 1400); close_modal(P)
def menu(P, v): P.click('.nav-btn'); W(P, 200); P.click(f'.nav-it[data-v="{v}"]'); W(P, 700)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    def ctx():
        c = b.new_context(viewport={'width': 1200, 'height': 950}); c.add_init_script("localStorage.setItem('guilda-notut','1')"); return c
    A = ctx().new_page(); A.on('pageerror', lambda e: errs.append('A: ' + str(e)))
    A.goto(URL); W(A, 1500); register(A, f'org{stamp}@exemplo.com')
    A.fill('#room-name', 'Casa'); A.press('#room-name', 'Enter'); W(A, 2500)
    code = A.evaluate("JSON.parse(localStorage.getItem('guilda-last-room'))")
    new_hero(A, 'Ana', 'paladino')
    menu(A, 'home'); A.click('.sessbar [data-act=invite]'); W(A, 400); link = A.input_value('#invite-url'); close_modal(A)
    B = ctx().new_page(); B.on('pageerror', lambda e: errs.append('B: ' + str(e)))
    B.goto(link); W(B, 1500); register(B, f'kid{stamp}@exemplo.com'); W(B, 1500)
    new_hero(B, 'Beto', 'guerreiro')
    # ---------- padrão: todos criam tarefas; só organizadores criam recompensas ----------
    menu(B, 'tab:tarefas')
    T(B.is_visible('form[data-form=task]'), 'por padrão, todos criam tarefas')
    menu(B, 'tab:recompensas')
    T(not B.query_selector('form[data-form=reward]'), 'por padrão, só organizadores criam recompensas')
    # ---------- organizador limita as tarefas ----------
    menu(A, 'settings')
    T('Quem pode criar' in body(A), 'configurações têm "Quem pode criar"')
    A.click('[data-act=setPerm][data-k=tasks][data-v=org]'); W(A, 900)
    T(docs(A, code)['party/main'].get('perms', {}).get('tasks', {}).get('mode') == 'org', 'regra salva: só organizadores criam tarefas')
    B.reload(); W(B, 2500); close_modal(B); menu(B, 'tab:tarefas')
    T(not B.is_visible('form[data-form=task]') and 'só os organizadores criam tarefas' in body(B), 'Beto não vê o formulário de tarefa e recebe o aviso')
    menu(B, 'home')
    T(not B.is_visible('form[data-form=board]'), 'Beto também não fixa missões no quadro')
    r = api(B, 'api_set', f'rooms/{code}/board/bteste', {'id': 'bteste', 'title': 'Burlar', 'diff': 'd', 'createdAt': 1})
    T('não liberou' in str(r.get('error', '')), f'servidor recusa missão criada por quem não pode: {r.get("error")}')
    A.click('[data-act=setPerm][data-k=tasks][data-v=some]'); W(A, 700)
    A.check('input[data-act=permHero][data-k=tasks]'); W(A, 900)
    B.reload(); W(B, 2500); close_modal(B); menu(B, 'tab:tarefas')
    T(B.is_visible('form[data-form=task]'), 'com "Escolher" e Beto marcado, ele volta a criar tarefas')
    r = api(B, 'api_set', f'rooms/{code}/board/bteste2', {'id': 'bteste2', 'title': 'Liberada', 'diff': 'f', 'createdAt': 1})
    T(not r.get('error'), 'servidor aceita missão de quem foi liberado')
    # ---------- recompensas liberadas ----------
    A.click('[data-act=setPerm][data-k=rewards][data-v=all]'); W(A, 900)
    B.reload(); W(B, 2500); close_modal(B); menu(B, 'tab:recompensas')
    T(B.query_selector('form[data-form=reward]') is not None, 'com recompensas liberadas, Beto vê "Cadastrar recompensa"')
    B.fill('#rw-name', 'Sorvete'); B.fill('#rw-cost', '50'); B.click('form[data-form=reward] button[type=submit]'); W(B, 1000)
    rw = [v for k, v in docs(B, code).items() if k.startswith('rewards/')]
    T(any(x['name'] == 'Sorvete' and x.get('byName') == 'Beto' for x in rw), 'recompensa do Beto cadastrada')
    pm = docs(B, code)['party/main']; pm['perms'] = {'tasks': {'mode': 'all'}, 'rewards': {'mode': 'all'}}; pm['xpCap'] = 1
    api(B, 'api_set', f'rooms/{code}/party/main', pm)
    T(docs(B, code)['party/main']['perms']['tasks']['mode'] == 'some', 'só o organizador muda as permissões (servidor)')
    # ---------- régua de dificuldade gradual ----------
    vals = {}
    for v in ('0.85', '1', '1.15'):
        A.evaluate("(v)=>{const r=document.getElementById('diff-range'); r.value=v; r.dispatchEvent(new Event('input',{bubbles:true}));}", v); W(A, 1500)
        vals[v] = int(A.inner_text('#diff-chance').replace('%', '') or 0)
    T(vals['0.85'] >= vals['1'] >= vals['1.15'] and vals['0.85'] - vals['1'] <= 35 and vals['1'] - vals['1.15'] <= 35, f'chance cai aos poucos na régua: 85%→{vals["0.85"]}%, 100%→{vals["1"]}%, 115%→{vals["1.15"]}%')
    A.screenshot(path='/tmp/f5_settings.png', full_page=True)
    b.close()
print('erros de script:', errs)
print(f'{len(fails)} FALHAS' if fails else 'TUDO OK')
