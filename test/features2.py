# Login + várias salas, agendamento, quadro com rostos e filtro, desfazer tarefa.
# Rode antes: npx wrangler dev --port 8787
from playwright.sync_api import sync_playwright
import sys, json, datetime
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8787/'
errs = []; fails = []
def T(ok, msg):
    print(('OK   ' if ok else 'FALHA ') + msg)
    if not ok: fails.append(msg)
EMAIL = 'teste%d@exemplo.com' % int(datetime.datetime.now().timestamp())
def api(P, fn, *args): return P.evaluate("([f,a])=>fetch('/api/'+f,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(a)}).then(r=>r.json())", [fn, list(args)])
def hero(P, code, name):
    d = api(P, 'api_get', -1, code)['docs']; return next((v for k, v in d.items() if k.startswith('heroes/') and v.get('name') == name), None)
def board(P, code, title):
    d = api(P, 'api_get', -1, code)['docs']; return next((v for k, v in d.items() if k.startswith('board/') and v.get('title') == title), None)
def W(P, ms=600): P.wait_for_timeout(ms)
def close_modal(P):
    for _ in range(3):
        if P.query_selector('.modal-bg'): P.keyboard.press('Escape'); W(P, 300)
def add_task(P, title, diff='m', freq='once', from_=None):
    P.fill('#task-title', title); P.click(f'[data-act=diff][data-v={diff}]'); P.click(f'[data-act=freq][data-v={freq}]'); W(P, 200)
    if from_: P.fill('#new-from', from_); P.dispatch_event('#new-from', 'change'); W(P, 200)
    P.click('form[data-form=task] button[type=submit]'); W(P, 900)
def new_hero(P, name, cls):
    P.click('[data-act=create]'); P.fill('#hero-name', name); P.click(f'[data-act=cls][data-v={cls}]'); P.click('[data-act=saveHero]'); W(P, 1200); close_modal(P)
def menu(P, v):
    P.click('.nav-btn'); P.wait_for_timeout(200); P.click(f'.nav-it[data-v={v}]'); P.wait_for_timeout(500)
def go_home(P):
    if P.query_selector('[data-act=home]'): P.click('[data-act=home]'); W(P, 600)
today = datetime.date.today()
plus = lambda n: (today + datetime.timedelta(days=n)).isoformat()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    def ctx():
        c = b.new_context(viewport={'width': 1150, 'height': 950}); c.add_init_script("localStorage.setItem('guilda-notut','1')"); return c
    A = ctx().new_page(); A.on('pageerror', lambda e: errs.append('A: ' + str(e)))
    A.goto(URL); W(A, 1500)
    # ---------- conta ----------
    T(A.query_selector('#acct-email') is not None, 'tela inicial mostra o login')
    A.fill('#acct-email', EMAIL); A.fill('#acct-pass', '123'); A.click('[data-act=register]'); W(A, 1200)
    T('pelo menos 6' in A.inner_text('body'), 'senha curta é recusada com mensagem')
    A.fill('#acct-pass', 'senha123'); A.click('[data-act=register]'); W(A, 1800)
    if A.query_selector('[data-act=recoveryDone]'): A.click('[data-act=recoveryDone]'); W(A, 300)
    W(A, 1500); bt = A.inner_text('body')
    T('MINHAS SALAS' in bt.upper() and EMAIL in bt, 'conta criada e conectada' + ('' if 'Minhas salas' in bt else ' | ' + bt[:300].replace(chr(10), ' ')))
    A.fill('#room-name', 'Casa'); A.press('#room-name', 'Enter'); W(A, 2500)
    casa = A.evaluate("(document.body.innerText.match(/Sala\\s+([A-Z0-9]{6})/)||[])[1]")
    new_hero(A, 'Ana', 'princesa')
    new_hero_btn = None
    # segunda sala
    menu(A, 'leaveRoom'); W(A, 800)
    T('Casa' in A.inner_text('.my-rooms'), 'sala Casa aparece em Minhas salas')
    A.fill('#room-name', 'Amigos'); A.press('#room-name', 'Enter'); W(A, 2500)
    amigos = A.evaluate("document.querySelector('#room-switch') ? null : (document.body.innerText.match(/Sala\\s+([A-Z0-9]{6})/)||[])[1]")
    new_hero(A, 'Lia', 'bardo'); W(A, 1500)
    me = api(A, 'auth_me', A.evaluate("JSON.parse(localStorage.getItem('guilda-auth')).token"))
    rooms = {r['name']: r for r in me['rooms']}
    T(set(rooms) >= {'Casa', 'Amigos'} and rooms['Casa'].get('heroName') == 'Ana' and rooms['Amigos'].get('heroName') == 'Lia', f'a conta guarda as duas salas com o herói de cada uma: {[(r["name"], r.get("heroName")) for r in me["rooms"]]}')
    T(A.query_selector('#room-switch') is not None, 'topo mostra a troca rápida de sala')
    A.select_option('#room-switch', casa); W(A, 2500)
    T('Jogando como Ana' in A.inner_text('body'), 'troca rápida leva para Casa já como Ana')
    # ---------- outro aparelho ----------
    B = ctx().new_page(); B.on('pageerror', lambda e: errs.append('B: ' + str(e)))
    B.goto(URL); W(B, 1500)
    if B.query_selector('.nav-btn'): menu(B, 'leaveRoom'); W(B, 600)
    B.fill('#acct-email', EMAIL); B.fill('#acct-pass', 'errada1'); B.press('#acct-pass', 'Enter'); W(B, 1200)
    T('incorretos' in B.inner_text('body'), 'senha errada é recusada')
    B.fill('#acct-pass', 'senha123'); B.press('#acct-pass', 'Enter'); W(B, 1500)
    T(B.query_selector('.my-rooms') and 'Amigos' in B.inner_text('.my-rooms') and 'Casa' in B.inner_text('.my-rooms'), 'outro aparelho vê as duas salas depois do login')
    B.click(f'[data-act=goRoom][data-code="{casa}"]'); W(B, 2500)
    T('Jogando como Ana' in B.inner_text('body'), 'no outro aparelho entra direto como Ana')
    # ---------- agendamento ----------
    A.click('.hero-cta [data-act=open]'); W(A)
    add_task(A, 'Consulta futura', 'f', 'once', plus(3))
    add_task(A, 'Treino que começa depois', 'f', 'daily', plus(2))
    body = A.inner_text('body')
    hoje = A.inner_text('.grid2 > div:first-child')
    later = A.text_content('details.later') if A.query_selector('details.later') else ''
    T('Consulta futura' in later and 'Agendada' in later, 'tarefa "uma vez" com data futura fica em Outros dias como Agendada')
    T('Treino que começa depois' in later and 'Começa' in later, 'tarefa diária com início futuro mostra quando começa')
    h = hero(A, casa, 'Ana'); fut = next(t for t in h['tasks'] if t['title'] == 'Consulta futura'); dly = next(t for t in h['tasks'] if t['title'] == 'Treino que começa depois')
    T(fut['created'] == plus(3) and dly['created'] == plus(2) and dly['repeat'], f'datas salvas: {fut["created"]}, {dly["created"]}')
    # ---------- desfazer + dívida de XP ----------
    for i in range(3): add_task(A, f'Difícil {i}', 'd', 'once')
    for i in range(3):
        A.click(f'xpath=//li[contains(@class,"task")][.//div[@class="t" and starts-with(normalize-space(.),"Difícil {i}")]]//button[@data-act="done"]'); W(A, 900); close_modal(A)
    W(A, 1200); h = hero(A, casa, 'Ana'); lvl, xp = h['level'], h['xp']
    T(lvl == 2, f'três tarefas difíceis sobem Ana para o nível 2 (nível {lvl}, xp {xp}, sequência {h["streak"]["n"]})')
    for i in range(2):
        A.click(f'xpath=//li[contains(@class,"task")][.//div[@class="t" and starts-with(normalize-space(.),"Difícil {i}")]]//button[@data-act="undoTask"]'); W(A, 1000)
    W(A, 1200); h2 = hero(A, casa, 'Ana')
    T(h2['level'] == 2 and h2['xp'] == 0 and h2.get('xpDebt') == 120 - (xp), f'desfazer tira o XP sem tirar o nível: nível {h2["level"]}, xp {h2["xp"]}, a repor {h2.get("xpDebt")}')
    T('a repor' in A.inner_text('.xpline'), 'ficha mostra o XP a repor')
    A.click('xpath=//li[contains(@class,"task")][.//div[@class="t" and starts-with(normalize-space(.),"Difícil 2")]]//button[@data-act="undoTask"]'); W(A, 1200)
    h3 = hero(A, casa, 'Ana')
    T(h3['streak']['n'] == 0 and h3['stats']['done'] == 0, f'desfazendo todas, a sequência e a contagem voltam: sequência {h3["streak"]["n"]}, feitas {h3["stats"]["done"]}')
    A.click('xpath=//li[contains(@class,"task")][.//div[@class="t" and starts-with(normalize-space(.),"Difícil 0")]]//button[@data-act="done"]'); W(A, 1200); close_modal(A)
    h4 = hero(A, casa, 'Ana'); T(h4.get('xpDebt', 0) == 0 and h4['xp'] == 60 - h2.get('xpDebt', 0) + (h3.get('xpDebt',0) - h2.get('xpDebt',0)) or h4.get('xpDebt',0) < h3.get('xpDebt',0), f'a próxima tarefa paga o XP a repor primeiro (a repor {h3.get("xpDebt")} → {h4.get("xpDebt")}, xp {h4["xp"]})')
    # ---------- quadro: rostos, filtro, desfazer ----------
    go_home(A); menu(A, 'switchHero'); W(A); new_hero(A, 'Beto', 'guardiao'); go_home(A)
    menu(A, 'switchHero'); W(A); A.click('xpath=//button[@data-act="pickMe"][.//div[@class="nm" and text()="Ana"]]'); W(A, 1200); close_modal(A)
    go_home(A)
    A.fill('#board-title', 'Tirar o lixo'); A.click('xpath=//label[contains(@class,"who-item")][.//span[text()="Beto"]]'); W(A, 300); A.click('form[data-form=board] button[type=submit]'); W(A, 1000)
    A.click('xpath=//label[contains(@class,"who-item") and contains(@class,"any")]'); W(A, 300)
    A.fill('#board-title', 'Lavar a louça'); A.click('form[data-form=board] button[type=submit]'); W(A, 1000)
    A.fill('#board-title', 'Regar plantas no sábado'); A.fill('#new-from', plus(4)); A.dispatch_event('#new-from', 'change'); W(A, 300); A.click('form[data-form=board] button[type=submit]'); W(A, 1200)
    row = lambda t: f'xpath=//section[contains(@class,"board")]//li[contains(@class,"task")][.//div[@class="t" and starts-with(normalize-space(.),"{t}")]]'
    n_lixo = len(A.query_selector_all(row('Tirar o lixo') + '//span[contains(concat(" ",@class," ")," face ")]'))
    n_louca = len(A.query_selector_all(row('Lavar a louça') + '//span[contains(concat(" ",@class," ")," face ")]'))
    T(n_lixo == 1 and n_louca == 2, f'rostos: missão do Beto mostra 1 ({n_lixo}), missão de qualquer um mostra todos ({n_louca})')
    later_b = A.text_content('section.board details.later') if A.query_selector('section.board details.later') else ''
    T('Regar plantas' in later_b, 'missão agendada fica em Agendadas no quadro')
    A.click('section.board [data-act=boardFilter][data-v]:not([data-v=""]) >> nth=0'); W(A, 500)
    fil = A.inner_text('section.board ul.tasks')
    T('Lavar a louça' in fil and 'Tirar o lixo' not in fil, 'filtro pela Ana mostra só as dela (e as de qualquer um)')
    A.click('section.board [data-act=boardFilter][data-v=""]'); W(A, 400)
    A.click(row('Lavar a louça') + '//button[@data-act="doneBoard"]'); W(A, 1500); close_modal(A)
    bd = board(A, casa, 'Lavar a louça'); ha = hero(A, casa, 'Ana')
    T(bd['done'] and bd['doneBy'] == ha['id'], 'Ana cumpre a louça')
    A.click(row('Lavar a louça') + '//button[@data-act="undoBoard"]'); W(A, 1500)
    bd2 = board(A, casa, 'Lavar a louça'); ha2 = hero(A, casa, 'Ana')
    eff = lambda h: h['xp'] - h.get('xpDebt', 0)
    T(not bd2['done'] and eff(ha2) == eff(ha) - bd['gain'], f'desfazer a missão reabre e tira o XP ({eff(ha)} → {eff(ha2)}, missão valia {bd["gain"]})')
    # sessão encerrada
    B.goto(URL); W(B, 1500)
    if B.query_selector('.nav-btn'): menu(B, 'leaveRoom'); W(B, 600)
    B.click('[data-act=logout]'); W(B, 800)
    T(B.query_selector('#acct-email') is not None, 'sair da conta volta ao login')
    A.screenshot(path='/tmp/f2_home.png', full_page=True)
    menu(A, 'leaveRoom'); W(A, 800); A.screenshot(path='/tmp/f2_rooms.png', full_page=True)
    b.close()
print(errs or 'sem erros no console'); print('FALHAS:', len(fails))
