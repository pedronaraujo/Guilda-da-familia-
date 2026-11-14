from playwright.sync_api import sync_playwright
import datetime, json
errs=[]
mock=open('/home/claude/guilda/test/gasmock.js').read()
def T(x): print('·', x, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx=b.new_context(viewport={'width':1200,'height':900}, timezone_id='America/Sao_Paulo'); ctx.add_init_script(mock); A=ctx.new_page()
    A.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'AudioContext' not in m.text else None)
    A.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    A.set_default_timeout(6000)
    W=lambda ms=300: A.wait_for_timeout(ms)
    def docs(): return json.loads(A.evaluate("localStorage.getItem('gasmock2')"))['docs']
    def heroDoc(n): return [v for k,v in docs().items() if '/heroes/' in k and v.get('name')==n][0]
    A.clock.set_fixed_time(datetime.datetime(2026,11,13,10,0))
    A.goto('file:///home/claude/guilda/out/index.html'); W(500)
    A.fill('#room-name','Novas'); A.press('#room-name','Enter'); W(1300)
    A.click('[data-act=create]'); W(200)
    T('classes na criação: '+str(len(A.query_selector_all('[data-act=cls]'))))
    A.screenshot(path='out/n0_create.png', full_page=True)
    names={'bruxa':'Morgana','bardo':'Lino','xama':'Tupã','monge':'Kai','inventor':'Edu','princesa':'Bela'}
    first=True
    for cl,nm in names.items():
        if not first: A.click('[data-act=switchHero]'); W(200); A.click('[data-act=create]'); W(200)
        A.fill('#hero-name',nm); A.click(f'[data-act=cls][data-v={cl}]'); A.click('[data-act=saveHero]'); W(500); first=False
        if len(heroDocs:=[v for k,v in docs().items() if '/heroes/' in k])>=5: break
    T('heróis criados: '+str([(v['name'],v['cls']) for k,v in docs().items() if '/heroes/' in k]))
    # Bela (princesa) nível 50 com ouro para testar árvore e loja
    st=json.loads(A.evaluate("localStorage.getItem('gasmock2')"))
    pm=[k for k in st['docs'] if k.endswith('/party/main')][0]
    for k,v in st['docs'].items():
        if '/heroes/' in k and v['name']=='Kai': v['level']=50; v['points']=50; kid=v['id']
    st['docs'][pm]['earned']={kid:60000}
    A.evaluate("s=>localStorage.setItem('gasmock2',s)", json.dumps(st)); A.reload(); W(1500)
    if A.query_selector('[data-act=switchHero]'): A.click('[data-act=switchHero]'); W(200)
    A.click('[data-act=pickMe]:has-text("Kai")'); W(600); A.click('.slot.mine'); W(300)
    A.click('[data-act=tab][data-v=habilidades]'); W(400)
    T('nós na árvore do monge: '+str(len(A.query_selector_all('.node'))))
    A.screenshot(path='out/n1_tree.png', full_page=True)
    # aprender a árvore toda pela interface (clicando nós disponíveis)
    for _ in range(60):
        av=[n for n in A.query_selector_all('.node.avail')]
        if not av: break
        A.click('#'+av[-1].get_attribute('id')); W(150); btn=A.query_selector('[data-act=learn]:not([disabled])')
        if not btn: break
        A.click('[data-act=learn]:not([disabled])'); W(150)
    h=heroDoc('Kai'); c=sum(h['skills'].values())
    T(f"monge nível 50: {len(h['skills'])} habilidades, {c} pontos gastos, sobra {h['points']}")
    A.screenshot(path='out/n2_tree_full.png', full_page=True)
    T('conquista Grão-mestre: '+str('tree2' in (h.get('ach') or {})))
    # loja
    A.click('[data-act=tab][data-v=loja]'); W(400)
    T('categorias da loja: '+str(A.eval_on_selector_all('.shop-cats .opt','e=>e.map(x=>x.innerText)')))
    for cat,item in [('weapon','wpn_flame'),('armor','arm_gold'),('face','face_glasses'),('neck','neck_scarf'),('offhand','off_shield'),('hat','hat_witch'),('cape','cape_stars'),('pet','pet_unicorn'),('aura','aura_storm')]:
        A.click(f'[data-act=shopCat][data-v={cat}]'); W(250); A.click(f'[data-act=buyCos][data-v={item}]'); W(300)
    h=heroDoc('Kai'); T('equipado: '+str({k:v for k,v in h['cosmetics'].items() if k!='owned'}))
    A.click('[data-act=buyGear][data-v=weapon]'); W(200)
    for _ in range(12):
        bb=A.query_selector('[data-act=buyGear]:not([disabled])')
        if not bb: break
        bb.click(); W(200)
    T('equipamento: '+str(heroDoc('Kai').get('gear')))
    A.click('[data-act=buyPotion][data-v=pot_str]'); W(300)
    T('poção: '+str(heroDoc('Kai').get('potion'))+' · outras bloqueadas: '+str(A.query_selector('[data-act=buyPotion]') is None))
    A.screenshot(path='out/n3_shop.png', full_page=True)
    A.click('[data-act=tab][data-v=visual]'); W(300)
    T('itens de estilo no Visual: '+str(A.eval_on_selector_all('.card:has-text("Itens de estilo") .lbl','e=>e.map(x=>x.innerText)')))
    A.click('[data-act=home]'); W(300); A.screenshot(path='out/n4_home.png')
    # batalha da noite usa a poção
    A.clock.set_fixed_time(datetime.datetime(2026,11,14,9,0)); A.reload(); W(1800)
    pmv=[v for k,v in docs().items() if k.endswith('/party/main')][0]
    T('roster com poção: '+str([(r['name'],r.get('potion')) for r in pmv['last']['roster']]))
    if A.query_selector('.battle-modal'):
        A.wait_for_timeout(3500); A.screenshot(path='out/n5_replay.png')
        A.click('[data-act=skip]'); W(500)
        T('resultado: '+A.inner_text('#result').split('\n')[0])
    b.close()
print('\n'.join(errs) or 'no console errors')
