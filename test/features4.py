# Contas obrigatórias, recuperação de senha, dono do herói, sala (nome, vagas, expulsar, importar),
# elogios (2/dia, alinhamento, resumo), aniversário travado, menu, reabrir tarefas, roupas temáticas.
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
EA, EB = f'ana{stamp}@exemplo.com', f'beto{stamp}@exemplo.com'
def api(P, fn, *args):
    return P.evaluate("""([f,a])=>{const t=(JSON.parse(localStorage.getItem('guilda-auth')||'null')||{}).token||'';
      return fetch('/api/'+f,{method:'POST',headers:{'content-type':'application/json','x-guilda-token':t},body:JSON.stringify(a)}).then(r=>r.json())}""", [fn, list(args)])
def docs(P, code): return api(P, 'api_get', -1, code)['docs']
def hero(P, code, name): return next((v for k, v in docs(P, code).items() if k.startswith('heroes/') and v.get('name') == name), None)
def W(P, ms=600): P.wait_for_timeout(ms)
def body(P): return P.inner_text('body')
def close_modal(P):
    for _ in range(4):
        if P.query_selector('.modal-bg') and not P.query_selector('.modal.recovery'): P.keyboard.press('Escape'); W(P, 300)
def register(P, email, pw='senha123'):
    P.fill('#acct-email', email); P.fill('#acct-pass', pw); P.click('[data-act=register]'); W(P, 1800)
    rc = P.inner_text('#rc-code') if P.query_selector('#rc-code') else None
    if rc: P.click('[data-act=recoveryDone]'); W(P, 400)
    return rc
def new_hero(P, name, cls, outfit=None):
    P.click('[data-act=create]'); W(P, 500); P.fill('#hero-name', name); P.click(f'[data-act=cls][data-v={cls}]')
    if outfit: P.click(f'[data-act=look][data-k=outfit][data-v={outfit}]')
    P.click('[data-act=saveHero]'); W(P, 1400); close_modal(P)
def go_home(P):
    nav.menu(P, 'home')
def settings(P):
    nav.menu(P, 'settings')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    def ctx():
        c = b.new_context(viewport={'width': 1200, 'height': 950}); c.add_init_script("localStorage.setItem('guilda-notut','1')"); return c
    A = ctx().new_page(); A.on('pageerror', lambda e: errs.append('A: ' + str(e)))
    A.goto(URL); W(A, 1500)
    # ---------- conta obrigatória + código de recuperação ----------
    T(A.query_selector('#acct-email') is not None and A.query_selector('#room-code') is None and A.query_selector('#room-name') is None, 'sem conta só aparece o login (não dá para entrar como convidado)')
    T(A.query_selector('[data-act=authMode][data-v=forgot]') is not None, 'tela de login tem "Esqueci minha senha"')
    rcA = register(A, EA)
    T(bool(rcA) and len(rcA.replace('-', '')) == 16, f'ao criar a conta aparece o código de recuperação: {rcA}')
    T(A.query_selector('#room-name') is not None, 'depois de entrar, aparece criar/entrar em sala')
    A.fill('#room-name', 'Casa'); A.select_option('#room-slots', '3'); A.press('#room-name', 'Enter'); W(A, 2500)
    code = A.evaluate("JSON.parse(localStorage.getItem('guilda-last-room'))")
    meta = api(A, 'api_room', code)['meta']
    T(meta.get('slots') == 3, f'sala criada com 3 vagas: {meta.get("slots")}')
    new_hero(A, 'Ana', 'princesa', 'natal')
    T('Jogando como Ana' in body(A), 'Ana criada')
    ana = hero(A, code, 'Ana'); me = api(A, 'auth_me', A.evaluate("JSON.parse(localStorage.getItem('guilda-auth')).token"))
    T(ana.get('owner') == me.get('id') and ana['look']['outfit'] == 'natal', 'herói ligado à conta e com roupa temática')
    # ---------- menu suspenso ----------
    A.click('.nav-btn'); W(A, 300)
    items = A.inner_text('.nav-pop') if A.query_selector('.nav-pop') else ''
    T(all(x in items for x in ('Trocar de herói', 'Trocar de sala', 'Tutorial', 'Som', 'Sair da conta')), 'menu da conta tem trocar herói/sala, tutorial, som e sair')
    A.keyboard.press('Escape'); W(A, 200); nav.menu(A, 'tab:loja')
    T(A.query_selector('.shop-cats') is not None, 'aba Herói > Equipar > Loja abre a loja')
    go_home(A)
    T(all(A.query_selector(f'.tabbar [data-v={v}]') for v in ('today', 'home', 'hero', 'prizes', 'settings')), 'barra de abas com Hoje, Guilda, Herói, Prêmios e Sala')
    # ---------- configurações: nome, vagas, importados ----------
    settings(A)
    A.fill('#room-rename', 'Casa Nova'); A.select_option('#room-slots-cfg', '4'); A.click('form[data-form=roomcfg] button[type=submit]'); W(A, 1200)
    meta = api(A, 'api_room', code)['meta']
    T(meta.get('name') == 'Casa Nova' and meta.get('slots') == 4, f'nome e vagas salvos: {meta.get("name")}, {meta.get("slots")}')
    T('Casa Nova' in A.inner_text('.topbar'), 'topo mostra o nome novo')
    A.check('[data-act=toggleImport]'); W(A, 800)
    T(docs(A, code)['party/main'].get('allowImport') is True, 'organizador permite personagens importados')
    go_home(A)
    # organizador cria um herói para criança sem conta
    nav.menu(A, 'switchHero', 600)
    new_hero(A, 'Kid', 'bardo', 'pijama')
    T('Jogando como Kid' in body(A), 'organizador pode criar um segundo herói (para quem não tem conta)')
    nav.menu(A, 'switchHero', 600)
    A.click(f'xpath=//button[contains(@class,"pickme")][.//div[@class="nm" and text()="Ana"]]'); W(A, 800)
    # missão no quadro para qualquer um
    nav.menu(A, 'today', 600)
    A.fill('#task-title', 'Lavar a louça'); nav.more(A); A.click('[data-act=target][data-v=guild]'); A.click('[data-act=diff][data-v=m]'); A.click('[data-act=freq][data-v=once]'); A.click('form[data-form=task] button[type=submit]'); W(A, 900)
    go_home(A)
    # ---------- convite com conta obrigatória ----------
    nav.invite(A); link = A.input_value('#invite-url'); close_modal(A)
    B = ctx().new_page(); B.on('pageerror', lambda e: errs.append('B: ' + str(e)))
    B.goto(link); W(B, 2000)
    T('convite' in body(B) and B.query_selector('#acct-email') is not None, 'convite sem conta pede login e lembra do convite')
    rcB = register(B, EB); W(B, 1500)
    T('Quem está jogando' in body(B) and 'Casa Nova' in body(B), 'depois de criar a conta, o convidado vai direto para a sala')
    tags = B.inner_text('.picklist')
    T('De outra pessoa' in tags, 'heróis dos outros aparecem como "De outra pessoa"')
    B.click(f'xpath=//button[contains(@class,"pickme")][.//div[@class="nm" and text()="Ana"]]', force=True); W(B, 600)
    T('Quem está jogando' in body(B), 'convidado não consegue jogar com a Ana')
    new_hero(B, 'Beto', 'guerreiro', 'cyberpunk')
    T('Jogando como Beto' in body(B), 'convidado cria o próprio herói')
    nav.menu(B, 'switchHero', 600)
    T(B.query_selector('[data-act=create]') is None, 'convidado não cria um segundo herói')
    B.click(f'xpath=//button[contains(@class,"pickme")][.//div[@class="nm" and text()="Beto"]]'); W(B, 800)
    ana = hero(B, code, 'Ana'); ana['name'] = 'Hackeada'
    r = api(B, 'api_set', f'rooms/{code}/heroes/{ana["id"]}', ana)
    T('outra pessoa' in str(r.get('error', '')), f'servidor recusa mexer no herói de outra pessoa: {r.get("error")}')
    pm = docs(B, code)['party/main']; pm['xpCap'] = 5; api(B, 'api_set', f'rooms/{code}/party/main', pm)
    T(docs(B, code)['party/main'].get('xpCap') != 5, 'servidor não deixa quem não é organizador mudar as regras')
    r = api(B, 'api_meta', code, {'name': 'Invadida'})
    T('organizador' in str(r.get('error', '')), 'só o organizador renomeia a sala')
    # ---------- elogios: 2 por dia, alinhamento ----------
    B.goto(URL); W(B, 2500); close_modal(B); nav.menu(B, 'home')
    for name in ('Ana', 'Kid'):
        B.click(f'xpath=//div[contains(@class,"slot")][.//div[@class="nm" and text()="{name}"]]//button[@data-act="askKudos"]'); W(B, 400)
        B.click('.modal [data-act=kudosEmo] >> nth=1'); W(B, 200)
        B.click('.modal [data-act=sendKudos] >> nth=0'); W(B, 900)
    left = B.evaluate("[...document.querySelectorAll('.kudos-btn')].map(b=>b.textContent+':'+b.disabled)")
    T(all('true' in x for x in left), f'depois de 2 elogios, os botões ficam bloqueados até amanhã: {left}')
    tops = B.evaluate("[...document.querySelectorAll('.lineup .slot')].map(s=>Math.round((s.querySelector('.fig')||s).getBoundingClientRect().bottom))")
    T(len(set(tops)) == 1, f'personagens alinhados no salão, com ou sem elogio: {tops}')
    T(len(B.query_selector_all('.lineup .slot')) == 4, 'salão mostra as 4 vagas da sala')
    A.reload(); W(A, 3000); close_modal(A)
    nav.menu(A, 'tab:conquistas', 800)
    ks = A.inner_text('.kudos-sum') if A.query_selector('.kudos-sum') else ''
    T('1 no total' in ks, f'página do herói tem o resumo de elogios: {ks[:80]}')
    # ---------- aniversário travado ----------
    nav.menu(A, 'tab:visual', 500)
    T('não pode ser alterado' in body(A), 'aviso de que o aniversário não pode ser alterado')
    A.fill('#birth-edit', '2015-03-09'); A.dispatch_event('#birth-edit', 'change'); W(A, 500)
    T(A.query_selector('[data-act=bdaySave]') is not None, 'pede confirmação antes de salvar o aniversário')
    A.click('[data-act=bdaySave]'); W(A, 800)
    T(A.query_selector('#birth-edit') is None and '09/03/2015' in body(A), 'depois de salvo, o aniversário fica fixo')
    T(hero(A, code, 'Ana').get('birth') == '2015-03-09', 'aniversário gravado')
    # ---------- reabrir tarefa cumprida por outra pessoa ----------
    nav.menu(B, 'today', 600)
    B.click(f'xpath=//li[contains(@class,"task")][.//div[@class="t" and text()="Lavar a louça"]]//button[contains(@class,"done-btn")]'); W(B, 1200)
    if B.query_selector('.modal [data-act=doneBoardAs]'): B.click('.modal [data-act=doneBoardAs]'); W(B, 1200)
    xb = hero(B, code, 'Beto')['stats']['xp']
    T(xb > 0, f'Beto cumpriu a missão (+{xb} XP)')
    A.reload(); W(A, 2500); close_modal(A); settings(A)
    A.click(f'xpath=//section[.//h3[text()="Feitas hoje"]]//li[contains(.,"Lavar a louça")]//button[@data-act="reopenBoard"]'); W(A, 400)
    A.click('[data-act=reopenOk]'); W(A, 1200)
    bd = next(v for k, v in docs(A, code).items() if k.startswith('board/'))
    T(not bd.get('done'), 'missão volta a ficar pendente')
    B.reload(); W(B, 3500); close_modal(B)
    T(hero(B, code, 'Beto')['stats']['xp'] == 0, 'o XP sai de quem cumpriu')
    # ---------- expulsar ----------
    A.click(f'xpath=//ul[contains(@class,"kick-list")]//li[contains(.,"Beto")]//button[@data-act="askKick"]'); W(A, 400)
    A.fill('#kick-in', 'expulsar'); A.click('form[data-form=kick] button[type=submit]'); W(A, 400)
    T('EXPULSAR' in A.inner_text('.modal'), 'precisa escrever EXPULSAR em maiúsculas')
    T('será retirado da sala' in A.inner_text('.modal'), 'aviso de que o personagem será retirado')
    A.fill('#kick-in', 'EXPULSAR'); A.click('form[data-form=kick] button[type=submit]'); W(A, 1200)
    T(hero(A, code, 'Beto') is None, 'Beto foi expulso')
    B.wait_for_timeout(6500)
    T('Quem está jogando' in body(B), 'quem foi expulso volta para a escolha de personagem')
    # ---------- importar personagem ----------
    nav.menu(B, 'leaveRoom', 800)
    B.fill('#room-name', 'Sala do Beto'); B.press('#room-name', 'Enter'); W(B, 2500)
    new_hero(B, 'Bia', 'gelo', 'astronauta')
    bia = hero(B, B.evaluate("JSON.parse(localStorage.getItem('guilda-last-room'))"), 'Bia')
    B.goto(link); W(B, 3000); close_modal(B)
    T(B.query_selector('[data-act=importHero]') is not None, 'na sala que permite, aparece "Trazer um personagem de outra sala"')
    B.click('[data-act=importHero]'); W(B, 2000)
    bi = hero(B, code, 'Bia')
    T(bi is not None and bi.get('owner') == bia.get('owner') and bi['look']['outfit'] == 'astronauta' and bi['id'] != bia['id'], 'personagem importado chega ligado à conta, com o mesmo visual')
    # ---------- esqueci minha senha ----------
    C = ctx().new_page(); C.on('pageerror', lambda e: errs.append('C: ' + str(e)))
    C.goto(URL); W(C, 1500)
    C.click('[data-act=authMode][data-v=forgot]'); W(C, 300)
    C.fill('#acct-email', EB); C.fill('#acct-rc', 'AAAA-BBBB-CCCC-DDDD'); C.fill('#acct-pass', 'novasenha1'); C.press('#acct-pass', 'Enter'); W(C, 1500)
    T('incorretos' in body(C), 'código de recuperação errado é recusado')
    C.fill('#acct-rc', rcB.lower()); C.fill('#acct-pass', 'novasenha1'); C.press('#acct-pass', 'Enter'); W(C, 2000)
    rc2 = C.inner_text('#rc-code') if C.query_selector('#rc-code') else ''
    T(bool(rc2) and rc2 != rcB, 'com o código certo cria a senha nova e mostra um código novo')
    if rc2: C.click('[data-act=recoveryDone]'); W(C, 300)
    T(EB in body(C) or 'Sala' in body(C), 'entrou na conta depois de recuperar')
    r = C.evaluate("([e])=>fetch('/api/auth_login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify([e,'senha123'])}).then(r=>r.json())", [EB])
    T('incorretos' in str(r.get('error', '')), 'a senha antiga deixou de valer')
    r = C.evaluate("([e,c])=>fetch('/api/auth_reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify([e,c,'outra123'])}).then(r=>r.json())", [EB, rcB])
    T('incorretos' in str(r.get('error', '')), 'o código usado não serve de novo')
    # ---------- roupas temáticas no editor ----------
    nav.menu(A, 'tab:visual', 600)
    th = A.evaluate("[...document.querySelectorAll('[data-k=outfit]')].map(b=>b.dataset.v)")
    T(all(x in th for x in ('natal', 'cyberpunk', 'praia', 'pesada', 'kimono', 'pirata', 'astronauta', 'ninja', 'caipira', 'pijama', 'heroi', 'gala', 'explorador', 'viking')), f'{len(th)} roupas no editor, com as temáticas')
    go_home(A); A.screenshot(path='/tmp/f4_home.png', full_page=True)
    A.click('.nav-btn'); W(A, 300); A.screenshot(path='/tmp/f4_menu.png')
    A.keyboard.press('Escape'); W(A, 200); settings(A); A.screenshot(path='/tmp/f4_settings.png', full_page=True)
    D = ctx().new_page(); D.goto(URL); W(D, 1500); D.screenshot(path='/tmp/f4_login.png')
    B.goto(URL); W(B, 2000)
    T(B.query_selector('#acct-email') is not None, 'depois da troca de senha, os outros aparelhos pedem login de novo')
    nav.menu(A, 'switchHero', 600); A.screenshot(path='/tmp/f4_select.png')
    b.close()
print('erros de script:', errs)
print(f'{len(fails)} FALHAS' if fails else 'TUDO OK')
