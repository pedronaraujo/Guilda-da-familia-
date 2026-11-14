# Saque após vitória contra chefe + tamanho dos documentos de um herói "veterano"
from playwright.sync_api import sync_playwright
import datetime, json
errs=[]
mock=open('/home/claude/guilda/test/gasmock.js').read()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx=b.new_context(viewport={'width':1200,'height':900}, timezone_id='America/Sao_Paulo'); ctx.add_init_script(mock); A=ctx.new_page()
    A.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    A.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'AudioContext' not in m.text else None)
    A.clock.set_fixed_time(datetime.datetime(2026,11,10,10,0))
    A.goto('file:///home/claude/guilda/out/index.html'); A.wait_for_timeout(500)
    A.fill('#room-name','Loot'); A.press('#room-name','Enter'); A.wait_for_timeout(1300)
    for nm,cl in [('Pedro','paladino'),('Ana','curandeiro'),('Lia','fogo'),('Rui','arqueiro'),('Bia','ladino')]:
        if A.query_selector('[data-act=switchHero]'): A.click('[data-act=switchHero]'); A.wait_for_timeout(200)
        A.click('[data-act=create]'); A.fill('#hero-name',nm); A.click(f'[data-act=cls][data-v={cl}]'); A.click('[data-act=saveHero]'); A.wait_for_timeout(500)
    # herói veterano: nível 25, 40 tarefas, 40 dias de log, 12 relíquias
    st=json.loads(A.evaluate("localStorage.getItem('gasmock2')"))
    for k,v in st['docs'].items():
        if '/heroes/' in k:
            v['level']=25; v['skills']={}; v['points']=0
            v['tasks']=[{'id':'t%02d'%i,'title':'Tarefa de exemplo número %d da rotina'%i,'diff':'m','created':'2026-11-09','done':None,'gain':0,'repeat':True,'days':[1,3,5],'due':'18:00','parts':[],'partNames':[]} for i in range(40)]
            v['log']={'2026-10-%02d'%d:{'t':5,'x':180} for d in range(1,32)}; v['log'].update({'2026-11-%02d'%d:{'t':5,'x':180} for d in range(1,10)})
            v['stats']={'done':900,'xp':40000,'byDiff':{'mf':200,'f':300,'m':300,'d':100},'chests':80,'kudosGot':40}
            v['ach']={a:'2026-10-01' for a in ['first','ten','fifty','hundred','streak3','streak7','streak30','chest','chest10','lvl5','lvl10','lvl20','kudos','board','duo','hard10','early','weekend','gear','cos','relic','boss','rich','helper']}
            v['relics']=[{'id':'r%d'%i,'name':'Amuleto Sombrio do Lobo Ancestral','rarity':'epica','mod':{'atkPct':0.05,'crit':0.02},'lvl':20} for i in range(12)]
        if k.endswith('/party/main'): v['stage']=5; v['lastBattleDay']='2026-11-09'
    A.evaluate("s=>localStorage.setItem('gasmock2',s)", json.dumps(st))
    A.clock.set_fixed_time(datetime.datetime(2026,11,11,9,0)); A.reload(); A.wait_for_timeout(2000)
    st=json.loads(A.evaluate("localStorage.getItem('gasmock2')"))
    pm=[v for k,v in st['docs'].items() if k.endswith('/party/main')][0]
    inbox=[v for k,v in st['docs'].items() if '/inbox/' in k]
    print('batalha estágio', pm['last']['stage'], 'vitória' if pm['last']['win'] else 'derrota', '· saques na caixa de entrada:', sum(1 for i in inbox if i.get('kind')=='loot'))
    sizes={}
    for k,v in st['docs'].items():
        cat=k.split('/')[2] if k.count('/')>=2 else 'meta'
        sizes[cat]=sizes.get(cat,0)+len(json.dumps(v,ensure_ascii=False))
    hero1=max(len(json.dumps(v,ensure_ascii=False)) for k,v in st['docs'].items() if '/heroes/' in k)
    print('tamanho por tipo (bytes):', sizes, '· maior herói:', hero1, '· total sala:', sum(sizes.values()))
    b.close()
print('\n'.join(errs) or 'no console errors')
