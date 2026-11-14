# Cópias de segurança dos dados da sala: automáticas, manual, baixar e restaurar.
from playwright.sync_api import sync_playwright
import os as _os, sys as _sys; _sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import nav
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
def close_modal(P):
    for _ in range(4):
        if P.query_selector('.modal-bg') and not P.query_selector('.modal.recovery'): P.keyboard.press('Escape'); W(P, 300)
def register(P, email):
    P.fill('#acct-email', email); P.fill('#acct-pass', 'senha123'); P.click('[data-act=register]'); W(P, 1800)
    if P.query_selector('[data-act=recoveryDone]'): P.click('[data-act=recoveryDone]'); W(P, 400)
def menu(P, v): nav.menu(P, v, 900)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    def ctx():
        c = b.new_context(viewport={'width': 1200, 'height': 950}, accept_downloads=True); c.add_init_script("localStorage.setItem('guilda-notut','1')"); return c
    A = ctx().new_page(); A.on('pageerror', lambda e: errs.append('A: ' + str(e)))
    A.goto(URL); W(A, 1500); register(A, f'bk{stamp}@exemplo.com')
    A.fill('#room-name', 'Casa'); A.press('#room-name', 'Enter'); W(A, 2500)
    code = A.evaluate("JSON.parse(localStorage.getItem('guilda-last-room'))")
    A.click('[data-act=create]'); W(A, 400); A.fill('#hero-name', 'Ana'); A.click('[data-act=saveHero]'); W(A, 1400); close_modal(A)
    s = api(A, 'api_snaps', code).get('snaps', [])
    T(len(s) >= 1 and s[-1]['label'] == 'Primeira cópia', f'primeira gravação na sala cria uma cópia automática: {[x["label"] for x in s]}')
    menu(A, 'settings')
    T('Cópias de segurança' in A.inner_text('body'), 'configurações mostram "Cópias de segurança"')
    A.click('[data-act=snapNow]'); W(A, 1200)
    s = api(A, 'api_snaps', code)['snaps']
    T(s[0]['label'] == 'Cópia feita pelo organizador' and s[0]['heroes'] == 1, 'organizador cria cópia na hora')
    keep = s[0]['id']
    with A.expect_download() as dl: A.click(f'[data-act=snapDl][data-id="{keep}"]')
    path = dl.value.path(); import json; data = json.load(open(path)); inner = json.loads(data) if isinstance(data, str) else data
    T('docs' in inner and any(k.startswith('heroes/') for k in inner['docs']), f'baixar gera um arquivo com os dados da sala ({dl.value.suggested_filename})')
    # muda algo depois da cópia
    h = next(v for k, v in docs(A, code).items() if k.startswith('heroes/')); h['name'] = 'Ana Modificada'; h['level'] = 9
    api(A, 'api_set', f'rooms/{code}/heroes/{h["id"]}', h)
    A.reload(); W(A, 2500); close_modal(A); menu(A, 'settings')
    A.click(f'[data-act=snapAsk][data-id="{keep}"]'); W(A, 400)
    A.fill('#restore-in', 'restaurar'); A.click('form[data-form=restore] button[type=submit]'); W(A, 500)
    T('RESTAURAR' in A.inner_text('.modal'), 'precisa escrever RESTAURAR em maiúsculas')
    A.fill('#restore-in', 'RESTAURAR'); A.click('form[data-form=restore] button[type=submit]'); W(A, 2000)
    h = next(v for k, v in docs(A, code).items() if k.startswith('heroes/'))
    T(h['name'] == 'Ana' and h['level'] == 1, f'sala volta ao estado da cópia: {h["name"]}, nível {h["level"]}')
    s = api(A, 'api_snaps', code)['snaps']
    T(s[0]['label'] == 'Antes de restaurar uma cópia', 'o estado de antes vira uma cópia (dá para desfazer)')
    T('Jogando como Ana' in A.inner_text('body'), 'app continua funcionando depois de restaurar')
    B = ctx().new_page(); B.goto(URL); W(B, 1200); register(B, f'bk2{stamp}@exemplo.com')
    r = api(B, 'api_snaps', code); r2 = api(B, 'api_restore', code, keep)
    T('organizador' in str(r.get('error', '')) and 'organizador' in str(r2.get('error', '')), 'quem não é organizador não vê nem restaura cópias')
    A.screenshot(path='/tmp/f7.png', full_page=True)
    b.close()
print('erros de script:', errs)
print(f'{len(fails)} FALHAS' if fails else 'TUDO OK')
