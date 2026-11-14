# Testa a sincronização pelo servidor da Cloudflare (rode antes: npx wrangler dev --port 8787)
from playwright.sync_api import sync_playwright
import sys
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8787/'
errs = []
def T(ok, msg): print(('OK   ' if ok else 'FALHA ') + msg)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    mk = lambda: b.new_context(viewport={'width': 1100, 'height': 900})
    ca, cb = mk(), mk()
    for c in (ca, cb): c.add_init_script("localStorage.setItem('guilda-notut','1')")
    A, B = ca.new_page(), cb.new_page()
    for P in (A, B): P.on('pageerror', lambda e: errs.append(str(e)))
    A.goto(URL); A.wait_for_timeout(1500)
    T('Modo local' not in A.inner_text('body'), 'site usa o servidor (sem aviso de modo local)')
    A.fill('#room-name', 'Teste Sync'); A.press('#room-name', 'Enter'); A.wait_for_timeout(2500)
    code = A.evaluate("(document.body.innerText.match(/Sala\\s+([A-Z0-9]{6})/)||[])[1]")
    T(bool(code), f'sala criada no servidor: {code}')
    A.click('[data-act=create]'); A.fill('#hero-name', 'Ana'); A.click('[data-act=cls][data-v=princesa]'); A.click('[data-act=saveHero]'); A.wait_for_timeout(2000)
    B.goto(URL); B.wait_for_timeout(1500)
    B.fill('input[placeholder="ABC123"]', code); B.keyboard.press('Enter'); B.wait_for_timeout(3000)
    T('Ana' in B.inner_text('body'), 'outro aparelho entra na sala e vê a heroína Ana')
    if B.query_selector('[data-act=create]'):
        B.click('[data-act=create]'); B.fill('#hero-name', 'Beto'); B.click('[data-act=cls][data-v=guardiao]'); B.click('[data-act=saveHero]'); B.wait_for_timeout(1000)
    if A.query_selector('[data-act=home]'): A.click('[data-act=home]')
    A.wait_for_timeout(7000)
    T('Beto' in A.inner_text('body'), 'o primeiro aparelho recebe o herói Beto sozinho em poucos segundos')
    # dois aparelhos tentando a mesma trava de batalha
    r = A.evaluate("""async (c) => { const f=(h)=>fetch('/api/api_lock',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify([c,h,20])}).then(r=>r.json()); const [x,y]=await Promise.all([f('a'),f('b')]); return [x,y]; }""", code)
    T(sorted(r) == [False, True], f'trava da batalha só para um aparelho: {r}')
    big = A.evaluate("""async (c) => { const r = await fetch('/api/api_set',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(['rooms/'+c+'/board/x', {t:'x'.repeat(70000)}])}); return [r.status, (await r.json()).error]; }""", code)
    T(big[0] == 400 and 'too_large' in big[1], f'documento grande demais é recusado: {big}')
    bad = A.evaluate("""async () => { const r = await fetch('/api/api_set',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(['rooms/../../x', {}])}); return r.status; }""")
    T(bad == 400, 'caminho inválido é recusado')
    b.close()
print(errs or 'sem erros no console')
