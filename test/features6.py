# Aviso falso de "retirado da sala" ao trocar de sala/personagem; refazer habilidades; trocar de classe.
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
def hero(P, code, name): return next((v for k, v in docs(P, code).items() if k.startswith('heroes/') and v.get('name') == name), None)
def W(P, ms=600): P.wait_for_timeout(ms)
def body(P): return P.inner_text('body')
def toast(P): return P.inner_text('#toast-root') if P.query_selector('#toast-root') else ''
def close_modal(P):
    for _ in range(4):
        if P.query_selector('.modal-bg') and not P.query_selector('.modal.recovery'): P.keyboard.press('Escape'); W(P, 300)
def new_hero(P, name, cls):
    P.click('[data-act=create]'); W(P, 500); P.fill('#hero-name', name); P.click(f'[data-act=cls][data-v={cls}]'); P.click('[data-act=saveHero]'); W(P, 1400); close_modal(P)
def menu(P, v): P.click('.nav-btn'); W(P, 200); P.click(f'.nav-it[data-v="{v}"]'); W(P, 700)
def new_room(P, name):
    P.fill('#room-name', name); P.press('#room-name', 'Enter'); W(P, 2500)
    return P.evaluate("JSON.parse(localStorage.getItem('guilda-last-room'))")
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    A = b.new_context(viewport={'width': 1200, 'height': 950}); A.add_init_script("localStorage.setItem('guilda-notut','1')"); A = A.new_page()
    A.on('pageerror', lambda e: errs.append(str(e)))
    A.goto(URL); W(A, 1500)
    A.fill('#acct-email', f'pedro{stamp}@exemplo.com'); A.fill('#acct-pass', 'senha123'); A.click('[data-act=register]'); W(A, 1800); A.click('[data-act=recoveryDone]'); W(A, 300)
    c1 = new_room(A, 'ANAMA'); new_hero(A, 'Pedro', 'druida')
    menu(A, 'switchHero'); new_hero(A, 'Tartaruga', 'bardo')
    # ---------- trocar de personagem e de sala: sem aviso falso ----------
    menu(A, 'switchHero'); A.click('xpath=//button[contains(@class,"pickme")][.//div[@class="nm" and text()="Pedro"]]'); W(A, 600)
    T('retirado' not in toast(A), 'trocar de personagem não mostra "retirado da sala"')
    menu(A, 'leaveRoom'); c2 = new_room(A, 'Casa'); new_hero(A, 'Outro', 'guerreiro')
    hits = []
    for code in (c1, c2, c1):
        A.select_option('#room-switch', code)
        for _ in range(8): W(A, 250); t = toast(A); hits.append(t) if 'retirado' in t else None
    T(not hits, f'trocar de sala pelo topo não mostra "retirado da sala" ({len(hits)} vezes)')
    T('Jogando como Pedro' in body(A), 'voltou para ANAMA jogando como Pedro')
    # ---------- refazer habilidades ----------
    h = hero(A, c1, 'Pedro'); h['level'] = 6; h['points'] = 6; api(A, 'api_set', f'rooms/{c1}/heroes/{h["id"]}', h)
    A.reload(); W(A, 2500); close_modal(A); menu(A, 'tab:habilidades')
    for _ in range(4):
        av = A.query_selector('.node.avail')
        if not av: break
        av.click(); W(A, 250); lb = A.query_selector('[data-act=learn]:not([disabled])')
        if lb: lb.click(); W(A, 500)
    A.click('[data-act=mastery]'); W(A, 600)
    h = hero(A, c1, 'Pedro'); spent = sum(h['skills'].values()) + h.get('mastery', 0)
    T(spent >= 2, f'aprendeu habilidades e treinou ({spent} pontos gastos)')
    A.click('[data-act=respecAsk]'); W(A, 400)
    T('voltam para você' in A.inner_text('.modal'), 'confirmação explica que os pontos voltam')
    A.click('[data-act=respecOk]'); W(A, 900)
    h = hero(A, c1, 'Pedro')
    T(not h['skills'] and not h.get('mastery') and h['points'] == 6, f'refazer devolve todos os pontos, de graça: {h["points"]} pontos, ouro gasto {h.get("spent", 0)}')
    # ---------- trocar de classe ----------
    A.click('.node.avail'); W(A, 250); A.click('[data-act=learn]'); W(A, 500)
    A.click('[data-act=clsAsk]'); W(A, 400)
    T(A.query_selector('[data-act=clsOk][disabled]') is not None, 'botão de confirmar só libera escolhendo outra classe')
    A.click('[data-act=clsPick][data-v=paladino]'); W(A, 300)
    T('Paladino' in A.inner_text('.cls-pv') and 'nível 6' in A.inner_text('.modal'), 'mostra a prévia da nova classe e que o nível continua')
    A.click('[data-act=clsOk]'); W(A, 1000)
    h = hero(A, c1, 'Pedro')
    T(h['cls'] == 'paladino' and h['level'] == 6 and not h['skills'] and h['points'] == 6, f'virou Paladino no mesmo nível com todos os pontos: {h["cls"]}, nv {h["level"]}, {h["points"]} pontos')
    T('Árvore do Paladino' in body(A), 'aba de habilidades mostra a árvore nova')
    T(any('trocou de classe' in (v.get('text') or '') for k, v in docs(A, c1).items() if k.startswith('activity/')), 'histórico registra a troca de classe')
    A.screenshot(path='/tmp/f6_skills.png')
    A.click('[data-act=clsAsk]'); W(A, 400); A.screenshot(path='/tmp/f6_cls.png'); close_modal(A)
    b.close()
print('erros de script:', errs)
print(f'{len(fails)} FALHAS' if fails else 'TUDO OK')
