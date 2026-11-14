from playwright.sync_api import sync_playwright
import json, sys
mock=open('/home/claude/guilda/test/gasmock.js').read()
errs=[]
party=sys.argv[1].split(',') if len(sys.argv)>1 else ['bruxa','xama','princesa','bardo','fogo']
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome'); ctx=b.new_context(viewport={'width':1200,'height':900}); ctx.add_init_script(mock); A=ctx.new_page()
    A.on('pageerror', lambda e: errs.append(str(e))); A.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    A.goto('file:///home/claude/guilda/out/index.html'); A.wait_for_timeout(500)
    A.fill('#room-name','V'); A.press('#room-name','Enter'); A.wait_for_timeout(1300)
    for i,c in enumerate(party):
        if A.query_selector('[data-act=switchHero]'): A.click('[data-act=switchHero]'); A.wait_for_timeout(200)
        A.click('[data-act=create]'); A.fill('#hero-name',c.capitalize()); A.click(f'[data-act=cls][data-v={c}]'); A.click('[data-act=saveHero]'); A.wait_for_timeout(400)
    st=json.loads(A.evaluate("localStorage.getItem('gasmock2')"))
    sk=json.loads(A.evaluate("JSON.stringify(Object.fromEntries(Object.entries(DATA.CLASSES).map(([k,c])=>[k,c.skills.map(s=>[s.id,s.max])])))"))
    for k,v in st['docs'].items():
        if '/heroes/' in k: v['level']=30; v['skills']={i:m for i,m in sk[v['cls']] if True}
        if k.endswith('/party/main'): v['stage']=12
    A.evaluate("s=>localStorage.setItem('gasmock2',s)", json.dumps(st)); A.reload(); A.wait_for_timeout(1500)
    if A.query_selector('[data-act=home]'): A.click('[data-act=home]'); A.wait_for_timeout(300)
    A.click('[data-act=practice]'); A.wait_for_timeout(700)
    shots=[]
    for i in range(36):
        A.wait_for_timeout(230); f=f'/tmp/vf{i:02d}.png'; A.locator('#scene').screenshot(path=f); shots.append(f)
    b.close()
from PIL import Image
ims=[Image.open(f) for f in shots]; w,h=ims[0].size; sc=0.4; tw,th=int(w*sc),int(h*sc)
sheet=Image.new('RGB',(tw*6,th*6))
for i,im in enumerate(ims): sheet.paste(im.resize((tw,th)),((i%6)*tw,(i//6)*th))
sheet.save('/home/claude/guilda/out/vfx_sheet.png'); print(sheet.size, errs or 'ok')
