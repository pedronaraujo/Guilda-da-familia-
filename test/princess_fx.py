from playwright.sync_api import sync_playwright
import json
mock=open('/home/claude/guilda/test/gasmock.js').read()
errs=[]
party=['princesa','guerreiro','curandeiro']
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome'); ctx=b.new_context(viewport={'width':1200,'height':900}); ctx.add_init_script(mock); A=ctx.new_page()
    A.on('pageerror', lambda e: errs.append(str(e))); A.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    A.goto('file:///home/claude/guilda/out/index.html'); A.wait_for_timeout(500)
    A.fill('#room-name','P'); A.press('#room-name','Enter'); A.wait_for_timeout(1300)
    for c in party:
        if A.query_selector('[data-act=switchHero]'): A.click('[data-act=switchHero]'); A.wait_for_timeout(200)
        A.click('[data-act=create]'); A.fill('#hero-name',c.capitalize()); A.click(f'[data-act=cls][data-v={c}]'); A.click('[data-act=saveHero]'); A.wait_for_timeout(400)
    if A.query_selector('[data-act=home]'): A.click('[data-act=home]'); A.wait_for_timeout(300)
    A.click('[data-act=practice]'); A.wait_for_timeout(900)
    info=A.evaluate("""()=>{const b=__guildaDebug.battle(); const pr=b.units.find(u=>u.cls==='princesa'); return {pr:pr.id, heroes:b.units.filter(u=>u.side==='h').map(u=>[u.id,u.hp||u.maxHp]), foes:b.units.filter(u=>u.side==='e').map(u=>[u.id,u.maxHp])}}""")
    pr=info['pr']; H=info['heroes']; F=info['foes']
    def dmg(n,fl=None): return [[f[0],-50,max(1,f[1]-50)]+([fl] if fl else []) for f in F[:n]]
    evs=[
      ('Raio de Estrela',[[F[0][0],-60,F[0][1]-60]]),
      ('Chuva de Estrelas',dmg(len(F))),
      ('Arco-Íris da Coragem',[[h[0],0,h[1],'colorido'] for h in H]),
      ('Olhar do Unicórnio',[[F[0][0],-30,F[0][1]-30],[F[0][0],0,F[0][1]-30,'encantado']]),
      ('Lágrima de Unicórnio',[[H[1][0],80,H[1][1],'cura']]),
      ('Escudo Arco-Íris',[[h[0],0,h[1],'escudo'] for h in H]),
      ('Desfile dos Unicórnios',[[h[0],40,h[1],'cura'] for h in H]+[[h[0],0,h[1],'radiante'] for h in H]),
      ('Estrela Cadente',[[F[0][0],-120,F[0][1]-120,'crit']]),
      ('Arco-Íris Ofuscante',dmg(len(F))+[[f[0],0,f[1]-50,'encantado'] for f in F]),
      ('Manada de Unicórnios',[[F[i%len(F)][0],-30,F[i%len(F)][1]-30] for i in range(6)]),
      ('Garoa de Arco-Íris',[[h[0],60,h[1],'cura'] for h in H]),
      ('Reino do Arco-Íris',[[h[0],60,h[1],'cura'] for h in H]+[[h[0],0,h[1],'radiante'] for h in H]),
    ]
    shots=[]
    for i,(name,fx) in enumerate(evs):
        A.evaluate("ev=>__guildaDebug.playFx(ev)", {'r':1,'a':pr,'s':name,'fx':fx})
        for k,t in enumerate([180,250,350]):
            A.wait_for_timeout(t); f=f'/tmp/pf{i:02d}{k}.png'; A.locator('#scene').screenshot(path=f); shots.append((f,name))
        A.wait_for_timeout(900)
    b.close()
from PIL import Image, ImageDraw
ims=[Image.open(f) for f,_ in shots]; w,h=ims[0].size; sc=0.34; tw,th=int(w*sc),int(h*sc)
cols=6; rows=(len(ims)+cols-1)//cols
sheet=Image.new('RGB',(tw*cols,th*rows))
for i,im in enumerate(ims):
    x,y=(i%cols)*tw,(i//cols)*th; sheet.paste(im.resize((tw,th)),(x,y)); ImageDraw.Draw(sheet).text((x+4,y+4),shots[i][1],fill='white')
sheet.save('/home/claude/guilda/out/princess_fx.png'); print(sheet.size, errs or 'ok')
