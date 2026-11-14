# Tarefas dos outros visíveis (só o responsável conclui), botões de ação visíveis, evento abaixo da batalha,
# convite em Pessoas, seletor de responsável e tema de fundo por classe.
# Rode antes: npx wrangler dev --port 8787
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
def hero(P, code, name): return next((v for k, v in docs(P, code).items() if k.startswith('heroes/') and v.get('name') == name), None)
def board(P, code): return [v for k, v in docs(P, code).items() if k.startswith('board/')]
def W(P, ms=600): P.wait_for_timeout(ms)
def close_modal(P):
    for _ in range(4):
        if P.query_selector('.modal-bg') and not P.query_selector('.modal.recovery'): P.keyboard.press('Escape'); W(P, 300)
def register(P, email):
    P.fill('#acct-email', email); P.fill('#acct-pass', 'senha123'); P.click('[data-act=register]'); W(P, 1800)
    if P.query_selector('#rc-code'): P.click('[data-act=recoveryDone]'); W(P, 400)
def new_hero(P, name, cls):
    P.click('[data-act=create]'); W(P, 500); P.fill('#hero-name', name); P.click(f'[data-act=cls][data-v={cls}]')
    T(P.evaluate("document.documentElement.dataset.cls") == cls, f'tema muda ao escolher a classe na criação ({cls})')
    P.click('[data-act=saveHero]'); W(P, 1400); close_modal(P)
def add_task(P, title, resp=None):
    nav.menu(P, 'today', 400)
    P.fill('#task-title', title)
    if resp:
        for r in resp: P.click(f'.resp [data-act=resp][data-v="{r}"]'); W(P, 200)
    P.click('form[data-form=task] button[type=submit]'); W(P, 900)
def ids(P, code):
    return {v['name']: v['id'] for k, v in docs(P, code).items() if k.startswith('heroes/')}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ca = b.new_context(viewport={'width': 390, 'height': 844}); ca.add_init_script("localStorage.setItem('guilda-notut','1')")
    cb = b.new_context(viewport={'width': 1280, 'height': 900}); cb.add_init_script("localStorage.setItem('guilda-notut','1')")
    A, B = ca.new_page(), cb.new_page()
    for P in (A, B): P.on('pageerror', lambda e: errs.append(str(e)))
    A.goto(URL); W(A, 1500); register(A, f'ana{stamp}@ex.com')
    A.fill('#room-name', 'Casa'); A.press('#room-name', 'Enter'); W(A, 2500)
    code = A.evaluate("JSON.parse(localStorage.getItem('guilda-last-room'))")
    new_hero(A, 'Ana', 'gelo')
    T(A.evaluate("document.documentElement.dataset.cls") == 'gelo', 'tema de Ana (Mago de Gelo) aplicado na sala')
    T('--motif' in (A.evaluate("document.documentElement.getAttribute('style')") or ''), 'fundo com símbolo da classe')

    # convite em Pessoas
    nav.menu(A, 'settings')
    grp = A.evaluate("(()=>{const h=[...document.querySelectorAll('details.sgroup')].find(d=>d.querySelector('h3') && [...d.querySelectorAll('h3')].some(x=>x.textContent.trim()==='Convidar pessoas'));return h?h.querySelector('summary b').textContent:null})()")
    T(grp == 'Pessoas', f'"Convidar pessoas" fica no grupo Pessoas ({grp})')

    # Guilda: batalha antes do evento
    nav.menu(A, 'home', 600)
    order = A.evaluate("(()=>{const f=document.querySelector('.nightfight'), e=document.querySelector('.evcard'); if(!f) return 'sem batalha'; if(!e) return 'sem evento'; return (f.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'batalha primeiro' : 'evento primeiro'})()")
    T(order in ('batalha primeiro', 'sem evento'), f'cena de batalha no topo ({order})')

    # Beto entra
    B.goto(URL); W(B, 1500); register(B, f'beto{stamp}@ex.com')
    B.fill('#room-code', code); B.press('#room-code', 'Enter'); W(B, 2500)
    new_hero(B, 'Beto', 'bardo')
    T(B.evaluate("document.documentElement.dataset.cls") == 'bardo', 'cada um vê o tema da própria classe (Beto, Bardo)')
    add_task(B, 'Tarefa do Beto')
    W(A, 5600)  # sincroniza
    hid = ids(A, code)

    # Ana cria: para mim, para o Beto e para qualquer pessoa
    add_task(A, 'Minha tarefa')
    T(any(t['title'] == 'Minha tarefa' for t in hero(A, code, 'Ana')['tasks']), 'responsável "Eu" cria tarefa pessoal')
    add_task(A, 'Para o Beto', [hid['Beto'], hid['Ana']])  # marca Beto, desmarca Ana
    bd = {t['title']: t for t in board(A, code)}
    T('Para o Beto' in bd and bd['Para o Beto'].get('who') == [hid['Beto']], f'responsável Beto cria missão só dele: {bd.get("Para o Beto", {}).get("who")}')
    add_task(A, 'Qualquer um', ['*'])
    bd = {t['title']: t for t in board(A, code)}
    T('Qualquer um' in bd and not bd['Qualquer um'].get('who'), 'responsável "Qualquer pessoa" cria missão aberta')
    T(not A.query_selector('.resp [data-act=target]') and 'Para a guilda' not in A.inner_text('form[data-form=task]'), 'sem "Para mim / Para a guilda"')

    # tarefas dos outros visíveis e bloqueadas
    nav.menu(A, 'today', 600)
    txt = A.inner_text('body')
    T('Tarefas dos outros' in txt and 'Tarefa do Beto' in txt, 'Ana vê a tarefa pessoal do Beto')
    btn = A.query_selector('xpath=//li[contains(@class,"task")][.//div[@class="t" and normalize-space(.)="Tarefa do Beto"]]//button[contains(@class,"done-btn")]')
    T(btn is not None and btn.is_disabled(), 'Ana não consegue concluir a tarefa do Beto')
    btn2 = A.query_selector('xpath=//li[contains(@class,"task")][.//div[@class="t" and normalize-space(.)="Para o Beto"]]//button[contains(@class,"done-btn")]')
    T(btn2 is not None and btn2.is_disabled(), 'Ana não consegue cumprir a missão do Beto')

    # botões visíveis
    row = 'xpath=//li[contains(@class,"task")][.//div[@class="t" and normalize-space(.)="Minha tarefa"]]'
    T(A.query_selector(row + '//button[@data-act="editTask"]') is not None and A.query_selector(row + '//button[@data-act="delTask"]') is not None, 'editar e apagar visíveis sem tocar na linha')
    A.click(row + '//button[@data-act="done"]'); W(A, 900); close_modal(A); nav.show(A, 'Minha tarefa')
    T(A.query_selector(row + '//button[@data-act="undoTask"]') is not None, 'desfazer visível na tarefa feita')
    A.click(row + '//button[@data-act="undoTask"]'); W(A, 900)
    T(not any(t['title'] == 'Minha tarefa' and t.get('done') for t in hero(A, code, 'Ana')['tasks']), 'desfazer reabre a tarefa')
    A.click(row + '//button[@data-act="editTask"]'); W(A, 500)
    T(A.query_selector('.modal') is not None, 'editar abre a janela de edição'); close_modal(A)
    A.click(row + '//button[@data-act="delTask"]'); W(A, 700)
    if A.query_selector('.modal [data-act=confirmDel], .modal .btn.danger'): A.click('.modal .btn.danger'); W(A, 700)
    T(not any(t['title'] == 'Minha tarefa' for t in hero(A, code, 'Ana')['tasks']), 'apagar remove a tarefa')

    # Beto vê e conclui a missão dele
    W(B, 5600); nav.menu(B, 'today', 600)
    rb = 'xpath=//li[contains(@class,"task")][.//div[@class="t" and starts-with(normalize-space(.),"Para o Beto")]]//button[contains(@class,"done-btn")]'
    T(B.query_selector(rb) is not None and not B.query_selector(rb).is_disabled(), 'Beto pode cumprir a missão dele')

    A.screenshot(path='/tmp/f8_today_mob.png', full_page=True)
    B.screenshot(path='/tmp/f8_today_desk.png', full_page=True)
    nav.menu(B, 'home', 700); B.screenshot(path='/tmp/f8_home_desk.png')
    b.close()

if errs: print('ERROS JS:', errs)
print('TUDO OK' if not fails and not errs else f'FALHAS: {len(fails)}')
