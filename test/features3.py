# Convite por link, limite diário de XP e bônus do destaque do dia.
# Rode antes: npx wrangler dev --port 8787
from playwright.sync_api import sync_playwright
import sys, datetime
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8787/'
errs = []; fails = []
def T(ok, msg):
    print(('OK   ' if ok else 'FALHA ') + msg)
    if not ok: fails.append(msg)
def api(P, fn, *args):
    return P.evaluate("""([f,a])=>{const t=(JSON.parse(localStorage.getItem('guilda-auth')||'null')||{}).token||'';
      return fetch('/api/'+f,{method:'POST',headers:{'content-type':'application/json','x-guilda-token':t},body:JSON.stringify(a)}).then(r=>r.json())}""", [fn, list(args)])
import time
def register(P, tag):
    P.fill('#acct-email', f'{tag}{int(time.time()*1000)}@exemplo.com'); P.fill('#acct-pass', 'senha123'); P.click('[data-act=register]'); P.wait_for_timeout(1800)
    if P.query_selector('[data-act=recoveryDone]'): P.click('[data-act=recoveryDone]'); P.wait_for_timeout(300)
def docs(P, code): return api(P, 'api_get', -1, code)['docs']
def hero(P, code, name): return next((v for k, v in docs(P, code).items() if k.startswith('heroes/') and v.get('name') == name), None)
def W(P, ms=600): P.wait_for_timeout(ms)
def close_modal(P):
    for _ in range(4):
        if P.query_selector('.modal-bg'): P.keyboard.press('Escape'); W(P, 300)
def add_task(P, title, diff='d'):
    P.fill('#task-title', title); P.click(f'[data-act=diff][data-v={diff}]'); P.click('[data-act=freq][data-v=once]'); W(P, 150)
    P.click('form[data-form=task] button[type=submit]'); W(P, 700)
def done(P, title):
    P.click(f'xpath=//li[contains(@class,"task")][.//div[@class="t" and text()="{title}"]]//button[@data-act="done"]'); W(P, 900)
def undo(P, title):
    P.click(f'xpath=//li[contains(@class,"task")][.//div[@class="t" and text()="{title}"]]//button[@data-act="undoTask"]'); W(P, 900)
def new_hero(P, name, cls):
    P.click('[data-act=create]'); P.fill('#hero-name', name); P.click(f'[data-act=cls][data-v={cls}]'); P.click('[data-act=saveHero]'); W(P, 1200); close_modal(P)
today = datetime.date.today(); yday = (today - datetime.timedelta(days=1)).isoformat(); tday = today.isoformat()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    def ctx():
        c = b.new_context(viewport={'width': 1150, 'height': 950}); c.add_init_script("localStorage.setItem('guilda-notut','1')"); return c
    A = ctx().new_page(); A.on('pageerror', lambda e: errs.append('A: ' + str(e)))
    A.goto(URL); W(A, 1500); register(A, 'a')
    A.fill('#room-name', 'Casa'); A.press('#room-name', 'Enter'); W(A, 2500)
    code = A.evaluate("(document.body.innerText.match(/Sala\\s+([A-Z0-9]{6})/)||[])[1]")
    new_hero(A, 'Ana', 'princesa')
    # ---------- configurações ----------
    A.click('.nav-btn'); W(A, 200); A.click('.nav-it[data-v=settings]'); W(A)
    T(A.query_selector('#cap-in') is not None and A.query_selector('#mvp-in') is not None, 'configurações mostram limite diário e bônus do destaque')
    A.fill('#cap-in', '100'); A.fill('#mvp-in', '50'); A.click('form[data-form=xpcfg] button[type=submit]'); W(A, 900)
    pm = docs(A, code)['party/main']
    T(pm.get('xpCap') == 100 and pm.get('mvpGold') == 50, f'limite e bônus salvos na sala: {pm.get("xpCap")}, {pm.get("mvpGold")}')
    A.click('[data-act=home]'); W(A)
    # ---------- limite diário ----------
    A.click('.hero-cta [data-act=open]'); W(A)
    for t in ('Dif 1', 'Dif 2', 'Dif 3'): add_task(A, t, 'd')
    done(A, 'Dif 1'); W(A, 4000)
    A.click('xpath=//li[contains(@class,"task")][.//div[@class="t" and text()="Dif 2"]]//button[@data-act="done"]'); W(A, 250)
    tt = A.inner_text('#toast-root'); W(A, 700)
    T('limite diário' in tt, 'aviso de limite aparece quando a tarefa passa do limite: ' + tt.replace(chr(10), ' '))
    done(A, 'Dif 3'); h = hero(A, code, 'Ana'); lg = h['log'][tday]
    gains = [next(t for t in h['tasks'] if t['title'] == n)['gain'] for n in ('Dif 1', 'Dif 2', 'Dif 3')]
    T(gains[0] > 0 and sum(gains) == 100 and gains[2] == 0, f'XP das tarefas respeita o limite de 100: {gains}')
    T(lg.get('tx') == 100 and lg.get('tr', 0) > 100, f'registro do dia: entrou {lg.get("tx")}, tarefas valiam {lg.get("tr")}')
    T(h['stats']['xp'] == 100, f'XP total do herói subiu só 100: {h["stats"]["xp"]}')
    cap = A.inner_text('.cap-card') if A.query_selector('.cap-card') else ''
    T('100 / 100' in cap, 'cartão mostra o limite atingido')
    undo(A, 'Dif 2'); h = hero(A, code, 'Ana'); lg = h['log'][tday]
    T(lg.get('tx') == 100 - gains[1] and h['stats']['xp'] == 100 - gains[1], f'desfazer devolve só o XP que entrou: tx={lg.get("tx")}')
    done(A, 'Dif 2'); h = hero(A, code, 'Ana')
    T(h['log'][tday].get('tx') == 100, 'refazer volta a encher o limite')
    rank = A.inner_text('.rank').strip() if A.query_selector('.rank') else ''
    # ---------- convite por link ----------
    A.click('[data-act=home]'); W(A)
    T('Destaque de hoje até agora' in A.inner_text('body') and '+50' in A.inner_text('body'), 'ranking mostra o destaque de hoje e o bônus')
    A.click('.sessbar [data-act=invite]'); W(A)
    link = A.input_value('#invite-url')
    T(link.endswith('?sala=' + code), f'link de convite: {link}')
    T(A.query_selector('.modal.invite a[href^="https://wa.me/"]') is not None, 'convite tem botão do WhatsApp')
    A.click('[data-act=copyInvite]'); W(A, 500)
    close_modal(A)
    B = ctx().new_page(); B.on('pageerror', lambda e: errs.append('B: ' + str(e)))
    B.goto(link); W(B, 1500); register(B, 'b'); W(B, 1500)
    T('foi convidado' in B.inner_text('body') and 'Casa' in B.inner_text('.invite-hi'), 'quem abre o link entra direto na sala, com boas-vindas')
    T('sala=' not in B.url, f'o endereço é limpo depois de entrar: {B.url}')
    new_hero(B, 'Beto', 'bardo')
    T('Jogando como Beto' in B.inner_text('body'), 'convidado cria o herói na sala')
    B.goto(URL + '?sala=ZZZZZ9'); W(B, 2000)
    T('Não encontramos a sala' in B.inner_text('body'), 'link com sala inexistente mostra aviso')
    # ---------- destaque do dia na batalha ----------
    d = docs(A, code)
    ana = next(v for k, v in d.items() if k.startswith('heroes/') and v['name'] == 'Ana')
    beto = next(v for k, v in d.items() if k.startswith('heroes/') and v['name'] == 'Beto')
    ana['log'][yday] = {'t': 3, 'x': 100, 'tx': 100, 'tr': 180}; beto.setdefault('log', {})[yday] = {'t': 2, 'x': 80, 'tx': 80, 'tr': 80}
    pm = d['party/main']; pm['lastBattleDay'] = yday
    api(A, 'api_set', f'rooms/{code}/heroes/{ana["id"]}', ana); api(A, 'api_set', f'rooms/{code}/heroes/{beto["id"]}', beto); api(A, 'api_set', f'rooms/{code}/party/main', pm)
    e0 = dict(pm.get('earned') or {})
    A.reload(); W(A, 3500); close_modal(A); W(A, 500)
    pm = docs(A, code)['party/main']; last = pm.get('last') or {}
    mvp = last.get('mvp') or {}
    T(mvp.get('names') == ['Ana'] and mvp.get('gold') == 50 and mvp.get('xp') == 180, f'destaque do dia = quem mais somou XP em tarefas (mesmo acima do limite): {mvp}')
    ea = pm['earned'].get(ana['id'], 0) - e0.get(ana['id'], 0); eb = pm['earned'].get(beto['id'], 0) - e0.get(beto['id'], 0)
    T(ea - eb == 50, f'Ana ganhou +50 moedas além do resultado da batalha ({"vitória" if last.get("win") else "derrota"}): Ana +{ea}, Beto +{eb}')
    T('Destaque do dia' in A.inner_text('body'), 'diário de batalhas mostra o destaque do dia')
    T(any('Destaque do dia' in (v.get('text') or '') for k, v in docs(A, code).items() if k.startswith('activity/')), 'histórico registra o destaque')
    A.screenshot(path='/tmp/f3_home.png', full_page=True)
    A.click('.hero-cta [data-act=open]'); W(A); A.screenshot(path='/tmp/f3_tasks.png')
    A.click('[data-act=home]'); W(A); A.click('.sessbar [data-act=invite]'); W(A); A.screenshot(path='/tmp/f3_invite.png'); close_modal(A)
    A.click('.nav-btn'); W(A, 200); A.click('.nav-it[data-v=settings]'); W(A); A.screenshot(path='/tmp/f3_settings.png', full_page=True)
    b.close()
print('erros de script:', errs)
print(f'{len(fails)} FALHAS' if fails else 'TUDO OK')
