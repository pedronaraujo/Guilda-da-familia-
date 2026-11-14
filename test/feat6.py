from playwright.sync_api import sync_playwright
import datetime, json
errs=[]
mock=open('/home/claude/guilda/test/gasmock.js').read()
def T(x): print('·', x, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    def page(tut=False, vw=(1200,900)):
        ctx=b.new_context(viewport={'width':vw[0],'height':vw[1]}, timezone_id='America/Sao_Paulo')
        if tut: ctx.add_init_script("window.__tutTest=1")
        ctx.add_init_script(mock); A=ctx.new_page(); A.set_default_timeout(6000)
        A.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'AudioContext' not in m.text else None)
        A.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        return A
    A=page()
    W=lambda ms=300: A.wait_for_timeout(ms)
    def docs(): return json.loads(A.evaluate("localStorage.getItem('gasmock2')"))['docs']
    def heroDoc(n): return [v for k,v in docs().items() if '/heroes/' in k and v.get('name')==n][0]
    def closeAll():
        for _ in range(6):
            W(250)
            if A.query_selector('[data-act=skip]'): A.click('[data-act=skip]'); W(400)
            if A.query_selector('.modal-bg'): A.click('.modal [data-act=closeModal] >> nth=-1'); W(300)
            else: break
    def become(n):
        if A.query_selector('[data-act=switchHero]'): A.click('[data-act=switchHero]'); W(250)
        A.click(f'[data-act=pickMe]:has-text("{n}")'); W(700); closeAll()
    def home():
        if A.query_selector('[data-act=home]'): A.click('[data-act=home]'); W(250)
    A.clock.set_fixed_time(datetime.datetime(2026,11,13,10,0))
    A.goto('file:///home/claude/guilda/out/index.html'); W(500)
    A.fill('#room-name','Seis'); A.press('#room-name','Enter'); W(1300)
    for nm,cl in [('Pedro','paladino'),('Ana','bardo'),('Lia','bruxa')]:
        if A.query_selector('[data-act=switchHero]'): A.click('[data-act=switchHero]'); W(200)
        A.click('[data-act=create]'); A.fill('#hero-name',nm); A.click(f'[data-act=cls][data-v={cl}]'); A.click('[data-act=saveHero]'); W(500)
    # ---- elogio com emoji
    home(); A.click('.slot.other:has-text("Ana") [data-act=askKudos]'); W(300)
    A.click('[data-act=kudosEmo][data-v="🎉"]'); W(200); A.screenshot(path='out/f6_kudos.png')
    A.click('.modal [data-act=sendKudos] >> nth=1'); W(500)
    T('emojis sob Ana (visto pela Lia): '+str(A.inner_text('.slot:has-text("Ana") .kudos-emo') if A.query_selector('.slot:has-text("Ana") .kudos-emo') else None))
    become('Pedro'); A.click('.slot.other:has-text("Ana") [data-act=askKudos]'); W(300); A.click('[data-act=kudosEmo][data-v="💪"]'); W(150); A.click('.modal [data-act=sendKudos] >> nth=0'); W(500)
    T('emojis sob Ana (visto pelo Pedro): '+str(A.inner_text('.slot:has-text("Ana") .kudos-emo')))
    become('Ana'); T('Ana vê no próprio herói: '+str(A.inner_text('.slot.mine .kudos-emo')))
    A.click('.slot.mine'); W(300); closeAll(); T('na página do herói: '+str(A.inner_text('.hero-head .kudos-emo')))
    # ---- missão com responsável
    home(); become('Pedro')
    A.click('.board .who-item:has-text("Ana") input', force=True); W(250)
    T('seleção: '+str(A.eval_on_selector_all('.board .who-item.on','e=>e.map(x=>x.innerText.trim())')))
    A.fill('#board-title','Lavar o carro'); A.press('#board-title','Enter'); W(500)
    A.click('.board .who-item.any input', force=True); W(250)
    A.fill('#board-title','Regar as plantas'); A.press('#board-title','Enter'); W(500)
    bs={v['title']:v.get('who') for k,v in docs().items() if '/board/' in k}
    T('missões salvas: '+str({k:(len(v) if v else 'qualquer') for k,v in bs.items()}))
    T('Pedro pode cumprir "Lavar o carro"? '+str(A.query_selector('.board .task:has-text("Lavar o carro") .done-btn:not([disabled])') is not None)+' · etiqueta: '+str(A.inner_text('.board .task:has-text("Lavar o carro") .tag.who')))
    A.screenshot(path='out/f6_board.png', full_page=False)
    become('Ana'); A.click('.board .task:has-text("Lavar o carro") .done-btn'); W(500); closeAll()
    T('Ana cumpriu: '+str([v.get('doneByName') for k,v in docs().items() if '/board/' in k and v['title']=='Lavar o carro']))
    # editar responsáveis
    A.click('.board .task:has-text("Regar") [data-act=editTask]'); W(300)
    A.click('.modal .who-item:has-text("Lia") input', force=True); W(250)
    A.click('[data-form=edit] button[type=submit]'); W(400)
    T('Regar editada para: '+str([[heroDoc('Lia')['id']==x for x in (v.get('who') or [])] for k,v in docs().items() if '/board/' in k and v['title']=='Regar as plantas']))
    # ---- zoom na loja
    st=json.loads(A.evaluate("localStorage.getItem('gasmock2')")); pm=[k for k in st['docs'] if k.endswith('/party/main')][0]
    st['docs'][pm]['earned']={heroDoc('Ana')['id']:3000}; A.evaluate("s=>localStorage.setItem('gasmock2',s)", json.dumps(st)); A.reload(); W(1500); closeAll()
    A.screenshot(path='out/f6_dbg.png'); home(); A.click('.slot.mine'); W(300); A.click('[data-act=tab][data-v=loja]'); W(300)
    A.click('[data-act=shopCat][data-v=face]'); W(200); A.click('[data-act=zoomItem][data-v=face_glasses]'); W(400)
    T('zoom aberto: '+str(A.inner_text('.zoom-modal h3'))+' · nível: '+str(A.inner_text('.zctl [aria-pressed=true]')))
    A.screenshot(path='out/f6_zoom1.png')
    A.click('[data-act=zoomLvl][data-v="2.8"]'); W(300); A.click('.zctl input[data-act=zoomCmp]', force=True); W(300)
    A.screenshot(path='out/f6_zoom2.png')
    A.click('.zoom-modal [data-act=buyCos]'); W(400)
    T('comprou pelo zoom: '+str('face_glasses' in heroDoc('Ana')['cosmetics']['owned'])+' · botão agora: '+A.inner_text('.zoom-modal .row:last-child .btn.primary'))
    A.click('.zoom-modal [aria-label="Próximo item"]'); W(300); T('próximo item: '+A.inner_text('.zoom-modal h3'))
    A.click('[data-act=shopCat][data-v=weapon]', force=True) if not A.query_selector('.modal-bg') else None
    closeAll()
    # ---- batalha e destaques
    A.clock.set_fixed_time(datetime.datetime(2026,11,14,9,0)); A.reload(); W(1800)
    pmv=[v for k,v in docs().items() if k.endswith('/party/main')][0]; T('última batalha: '+str((pmv.get('last') or {}).get('day'))+' · view: '+str(A.evaluate("document.querySelector('.tabs')?'hero':'?'")))
    A.screenshot(path='out/f6_dbg2.png')
    if A.query_selector('.battle-modal'):
        A.click('[data-act=skip]'); W(600); T('linha de destaque no resultado: '+str(A.inner_text('.mvp-line') if A.query_selector('.mvp-line') else None))
    closeAll(); home()
    T('card destaques: '+str(A.inner_text('.mvp').replace('\n',' | ')[:300] if A.query_selector('.mvp') else None))
    A.query_selector('.mvp') and A.locator('.mvp').screenshot(path='out/f6_mvp.png')
    # ---- tutorial
    B=page(tut=True)
    B.clock.set_fixed_time(datetime.datetime(2026,11,13,10,0))
    B.goto('file:///home/claude/guilda/out/index.html'); B.wait_for_timeout(500)
    B.fill('#room-name','Tut'); B.press('#room-name','Enter'); B.wait_for_timeout(1300)
    for nm in ['Rui','Bia']:
        if B.query_selector('#tut'): B.click('[data-act=tutSkip]'); B.wait_for_timeout(300)
        if B.query_selector('[data-act=switchHero]'): B.click('[data-act=switchHero]'); B.wait_for_timeout(200)
        B.click('[data-act=create]'); B.fill('#hero-name',nm); B.click('[data-act=saveHero]'); B.wait_for_timeout(1200)
    T('tutorial abriu para Bia: '+str(B.query_selector('#tut') is not None))
    titles=[]
    for i in range(14):
        if not B.query_selector('#tut'): break
        titles.append(B.inner_text('#tut-t'))
        if i in (1,4,7,8): B.screenshot(path=f'out/f6_tut{i}.png')
        B.click('[data-act=tutNext]'); B.wait_for_timeout(450)
    T('passos vistos: '+str(titles))
    bia=[v for k,v in json.loads(B.evaluate("localStorage.getItem('gasmock2')"))['docs'].items() if '/heroes/' in k and v['name']=='Bia'][0]
    T('Bia marcada como vista: '+str(bia.get('tut'))+' · tutorial fechado: '+str(B.query_selector('#tut') is None))
    B.reload(); B.wait_for_timeout(1500); T('não reabre sozinho: '+str(B.query_selector('#tut') is None))
    B.click('[data-act=tutorial]'); B.wait_for_timeout(500); T('botão Tutorial reabre: '+str(B.query_selector('#tut') is not None))
    B.keyboard.press('Escape'); B.wait_for_timeout(300); T('Esc fecha: '+str(B.query_selector('#tut') is None))
    M=page(tut=True, vw=(390,844)); M.goto('file:///home/claude/guilda/out/index.html'); M.wait_for_timeout(500)
    M.fill('#room-name','Cel'); M.press('#room-name','Enter'); M.wait_for_timeout(1300); M.click('[data-act=create]'); M.fill('#hero-name','Zé'); M.click('[data-act=saveHero]'); M.wait_for_timeout(1300)
    M.click('[data-act=tutNext]'); M.wait_for_timeout(500); M.screenshot(path='out/f6_tut_mobile.png')
    b.close()
print('\n'.join(errs) or 'no console errors')
