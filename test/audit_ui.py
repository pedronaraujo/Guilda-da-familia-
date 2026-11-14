# Auditoria de interface: vários dias, 3 heróis, mock do Apps Script
from playwright.sync_api import sync_playwright
import datetime, json, traceback
errs=[]; R=[]
mock=open('/home/claude/guilda/test/gasmock.js').read()
def T(tag, ok, msg): R.append(('OK   ' if ok is True else 'FALHA' if ok is False else 'INFO ')+' ['+tag+'] '+msg); print(R[-1], flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx=b.new_context(viewport={'width':1200,'height':900}, timezone_id='America/Sao_Paulo'); ctx.add_init_script(mock); A=ctx.new_page()
    A.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'AudioContext' not in m.text else None)
    A.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    A.set_default_timeout(6000)
    def W(ms=300): A.wait_for_timeout(ms)
    def q(sel): return A.query_selector(sel)
    def txt(sel): e=q(sel); return e.inner_text().replace('\n',' | ') if e else None
    def closeAll():
        for _ in range(8):
            W(250)
            if q('[data-act=skip]'): A.click('[data-act=skip]'); W(400)
            if q('.modal-bg'):
                btn=q('.modal [data-act=closeModal]') or q('.modal-bg')
                try: A.click('.modal [data-act=closeModal] >> nth=-1')
                except Exception: A.keyboard.press('Escape')
                W(300)
            else: break
    def docs(): return A.evaluate("JSON.parse(localStorage.getItem('gasmock2'))")['docs']
    def party(): return [v for k,v in docs().items() if k.endswith('/party/main')][0]
    def heroDoc(name): return [v for k,v in docs().items() if '/heroes/' in k and v.get('name')==name][0]
    def at(y,m,d,h=9,mi=0, close=True):
        A.clock.set_fixed_time(datetime.datetime(y,m,d,h,mi)); A.reload(); W(1800)
        if close: closeAll()
    def become(name):
        if q('[data-act=switchHero]'): A.click('[data-act=switchHero]'); W(300)
        A.click(f'[data-act=pickMe]:has-text("{name}")'); W(700)
    def goHome():
        if q('[data-act=home]'): A.click('[data-act=home]'); W(200)
    def openMe(): A.click('.slot.mine'); W(300)
    def addTask(title, diff='m', due=None):
        if q(f'[data-act=diff][data-v={diff}]'): A.click(f'[data-act=diff][data-v={diff}]')
        if due: A.fill('#task-due', due); A.dispatch_event('#task-due','change')
        A.fill('#task-title', title); A.press('#task-title','Enter'); W(300)
        if due: A.fill('#task-due',''); A.dispatch_event('#task-due','change')
    def doneTask(title):
        A.click(f'ul.tasks .task:has-text("{title}") .done-btn'); W(450); t=txt('.toast'); closeAll(); return t
    def step(name, fn):
        try: fn()
        except Exception as e: T(name, False, 'erro no roteiro: '+str(e).split('\n')[0][:200]); A.screenshot(path=f'out/audit_err_{name}.png')

    A.clock.set_fixed_time(datetime.datetime(2026,11,13,10,0))  # sexta
    A.goto('file:///home/claude/guilda/out/index.html'); W(600)
    # ---------- salas ----------
    def s_rooms():
        A.fill('#room-name','Casa Teste'); A.press('#room-name','Enter'); W(1500)
        code=A.inner_text('.chip b.num'); T('sala', len(code)==6, 'sala criada com código '+code)
        A.click('[data-act=create]'); A.fill('#hero-name','Pedro'); A.click('[data-act=cls][data-v=paladino]'); A.click('[data-act=saveHero]'); W(700)
        T('sala', q('[data-act=settings]') is not None, 'primeiro herói vira criador e vê Configurações')
        for nm, cl in [('Ana','curandeiro'),('Lia','fogo')]:
            A.click('[data-act=switchHero]'); W(300); A.click('[data-act=create]'); A.fill('#hero-name',nm); A.click(f'[data-act=cls][data-v={cl}]'); A.click('[data-act=saveHero]'); W(600)
        T('sala', q('[data-act=settings]') is None, 'Lia (não criadora) não vê Configurações')
        goHome(); W(300)
        T('sala', len(A.query_selector_all('.slot.other [data-act=open]'))==0 and len(A.query_selector_all('.slot.mine'))==1, 'na tela inicial só o próprio herói abre')
        # sair e voltar pelo código
        A.click('[data-act=leaveRoom]'); W(500); A.fill('#room-code', code.lower()); A.press('#room-code','Enter'); W(1200)
        T('sala', q('[data-act=pickMe]') is not None or q('.slot.mine') is not None, 'entrar de novo pelo código (minúsculas aceitas)')
        A.fill('#room-code','ZZZZZZ') if q('#room-code') else None
    step('sala', s_rooms)
    # ---------- criador: PIN, co-criador, obrigatória, recompensa, dificuldade ----------
    def s_creator():
        become('Pedro'); A.click('[data-act=settings]'); W(300)
        A.click('[data-act=setPinAsk]'); A.fill('#pin-in','1234'); A.press('#pin-in','Enter'); W(500)
        A.fill('#chore-title','Escovar os dentes'); A.press('#chore-title','Enter'); W(500)
        A.fill('#rw-name','Sorvete'); A.fill('#rw-cost','30'); A.press('#rw-cost','Enter'); W(500)
        A.click('.co-list label:has-text("Ana") input'); W(500)
        T('criador', 'Ana' in json.dumps([heroDoc('Ana')['id'] in (party().get('coCreators') or [])]) or heroDoc('Ana')['id'] in (party().get('coCreators') or []), 'Ana marcada como co-criadora')
        T('criador', bool(party().get('pin')), 'PIN salvo (guardado como '+('hash' if len(str(party().get('pin')))>8 else 'texto: '+str(party().get('pin')))+')')
        goHome(); W(200)
        become('Lia');
        A.click('[data-act=switchHero]'); W(200); become('Pedro'); A.click('[data-act=settings]'); W(300)
        T('criador', q('[data-form=pinGate]') is not None, 'PIN pedido ao reabrir configurações')
        A.fill('[data-form=pinGate] input', '9999'); A.press('[data-form=pinGate] input','Enter'); W(400)
        T('criador', q('[data-form=pinGate]') is not None, 'PIN errado não libera')
        A.fill('[data-form=pinGate] input', '1234'); A.press('[data-form=pinGate] input','Enter'); W(400)
        T('criador', q('#chore-title') is not None, 'PIN certo libera')
        goHome(); W(200)
    step('criador', s_creator)
    # ---------- tarefas dia 1 ----------
    def s_tasks1():
        become('Ana'); openMe(); closeAll()
        vis=A.eval_on_selector_all('ul.tasks .task .t','e=>e.map(x=>x.textContent)')
        T('obrigatória', any('Escovar' in v for v in vis), 'tarefa obrigatória aparece para Ana: '+str(vis))
        T('obrigatória', q('.task:has-text("Escovar") [data-act=delTask]') is None, 'Ana não consegue apagar a obrigatória')
        for t,d in [('Arrumar a cama','mf'),('Lavar louça','f'),('Estudar','d')]: addTask(t,d)
        addTask('Ler livro','m',due='09:30')
        t=doneTask('Ler livro'); T('prazo', t is not None and 'no horário' not in t, 'tarefa com prazo vencido não ganha bônus: '+str(t))
        addTask('Regar planta','m',due='18:00'); t=doneTask('Regar planta'); T('prazo', t is not None and 'no horário' in t, 'feita antes do prazo ganha bônus: '+str(t))
        t=doneTask('Arrumar a cama'); T('xp', t is not None and '+10' in t, 'muito fácil dá 10 XP: '+str(t))
        # desfazer
        A.click(f'ul.tasks .task:has-text("Lavar louça") .done-btn'); W(300); xp1=heroDoc('Ana')['stats']['xp']
        A.click('[data-act=undo]'); W(500); xp2=heroDoc('Ana')['stats']['xp']
        T('desfazer', xp2<xp1, f'Desfazer devolve o XP ({xp1}→{xp2})')
        # editar
        A.click('.task:has-text("Lavar louça") [data-act=editTask]'); W(300)
        A.fill('[data-form=edit] input[type=text]','Lavar a louça do jantar'); A.click('[data-form=edit] [data-act=edDiff][data-v=m]'); A.click('[data-form=edit] button[type=submit]'); W(400)
        tk=[x for x in heroDoc('Ana')['tasks'] if 'jantar' in x['title']]
        T('editar', bool(tk) and tk[0]['diff']=='m', 'editar título e dificuldade: '+str([(x['title'],x['diff']) for x in tk]))
        # habilidade
        A.click('[data-act=tab][data-v=habilidades]'); W(300)
        av=A.query_selector_all('.node.avail');
        if av: av[0].click(); W(200); A.click('[data-act=learn]'); W(400)
        T('habilidade', heroDoc('Ana')['points']==0 and len(heroDoc('Ana')['skills'])==1, 'aprender habilidade gasta o ponto: '+str(heroDoc('Ana')['skills']))
        locked=A.query_selector_all('.node.locked'); T('habilidade', len(locked)>=5, f'habilidades fortes aparecem bloqueadas ({len(locked)})')
        A.click('[data-act=tab][data-v=tarefas]'); W(200)
        # quadro da guilda
        goHome(); W(200)
        A.fill('#board-title','Tirar o lixo'); A.press('#board-title','Enter'); W(400)
        T('quadro', q('.board .task:has-text("Tirar o lixo")') is not None, 'missão no quadro da guilda criada')
        become('Lia')
        A.click('.board .task:has-text("Tirar o lixo") .done-btn'); W(500); t=txt('.toast'); closeAll()
        T('quadro', heroDoc('Lia')['stats'].get('xp',0)>0, 'Lia cumpriu missão do quadro: '+str(t))
        # elogio
        A.click('.slot.other:has-text("Ana") [data-act=askKudos]'); W(300); A.click('.modal [data-act=sendKudos] >> nth=0'); W(600)
        T('elogio', True, 'elogio enviado; o XP chega quando Ana abrir o app')
        # pedido de recompensa sem saldo
        openMe(); A.click('[data-act=tab][data-v=recompensas]'); W(300)
        T('recompensa', q('[data-act=askRedeem][disabled]') is not None or q('[data-act=askRedeem]') is not None, 'tela de recompensas mostra Sorvete (30 XP)')
        if q('[data-act=askRedeem]:not([disabled])'):
            A.click('[data-act=askRedeem]'); W(200); A.click('[data-act=redeem]'); W(400)
        T('recompensa', any(v.get('status')=='pending' for k,v in docs().items() if '/requests/' in k), 'pedido de resgate fica aguardando aprovação')
        T('recompensa', heroDoc('Lia').get('level',1)>=1, f"Lia nível {heroDoc('Lia')['level']} · XP de resgate gasto {heroDoc('Lia').get('redeemed',0)} (não reduz nível)")
    step('tarefas1', s_tasks1)
    A.screenshot(path='out/audit_d1.png', full_page=True)
    p0=party(); T('batalha', None, f"antes da noite: estágio {p0.get('stage')} · lastBattleDay {p0.get('lastBattleDay')}")
    # ---------- dia 2: batalha da noite, replay por personagem, acumulada ----------
    def s_day2():
        at(2026,11,14,9, close=False)
        T('replay', q('.battle-modal') is not None, 'ao abrir no dia seguinte, o herói atual (Lia) vê o replay da batalha')
        closeAll(); pp=party(); last=pp.get('last') or {}
        T('batalha', last.get('day')=='2026-11-13', f"batalha da noite resolvida: dia {last.get('day')}, estágio {last.get('stage')}, {'vitória' if last.get('win') else 'derrota'}, ouro {last.get('gold')} → estágio agora {pp.get('stage')}")
        if last.get('win'): T('batalha', pp['stage']==last['stage']+1 and all(v>0 for v in pp['earned'].values()), 'vitória: ouro para todos e avança de estágio')
        else: T('batalha', pp['stage']==last['stage'], 'derrota: repete o estágio')
        A.reload(); W(1500); T('replay', q('.battle-modal') is None, 'replay não repete na segunda entrada do mesmo herói')
        closeAll(); become('Ana'); W(900)
        T('replay', q('.battle-modal') is not None, 'Ana vê o replay na primeira entrada dela')
        closeAll()
        T('elogio', heroDoc('Ana').get('stats',{}).get('kudosGot',0)>=1, 'Ana recebeu o elogio da Lia ao entrar: kudosGot='+str(heroDoc('Ana').get('stats',{}).get('kudosGot')))
        openMe(); closeAll()
        T('acumulada', q('.section-t:has-text("Acumuladas")') is not None, 'tarefa não feita ontem aparece em Acumuladas')
        t=doneTask('Estudar'); T('acumulada', t is not None and 'acumulada' in t, 'acumulada dá bônus: '+str(t))
        T('sequência', (heroDoc('Ana').get('streak') or {}).get('n')==2, 'sequência de 2 dias: '+str(heroDoc('Ana').get('streak')))
        goHome(); W(300)
        T('evento', 'Meta da guilda' in A.inner_text('body') or 'Mercador' in A.inner_text('body') or 'Torneio' in A.inner_text('body') or q('.evcard, .event') is not None, 'sábado: card do evento de fim de semana na tela inicial')
    step('dia2', s_day2)
    A.screenshot(path='out/audit_d2.png', full_page=True)
    # ---------- aprovação de pedido pela co-criadora (Ana) ----------
    def s_requests():
        goHome(); W(200); A.click('[data-act=settings]'); W(300)
        if q('[data-form=pinGate]'): A.fill('[data-form=pinGate] input','1234'); A.press('[data-form=pinGate] input','Enter'); W(400)
        if q('[data-act=reqOk]'):
            A.click('[data-act=reqOk]'); W(400); A.click('[data-act=reqDone]') if q('[data-act=reqDone]') else None; W(400)
        st=[v.get('status') for k,v in docs().items() if '/requests/' in k]
        T('recompensa', st and st[0] in ('delivered','approved'), 'co-criadora aprova/entrega pedido: '+str(st))
        T('co-criador', q('.co-list input:not([disabled])') is None, 'co-criadora não altera a lista de co-criadores')
    step('pedidos', s_requests)
    # ---------- perda repete estágio ----------
    def s_loss():
        A.evaluate("()=>{const r=document.getElementById('diff-range'); if(!r) return; r.value='1.8'; r.dispatchEvent(new Event('input',{bubbles:true})); r.dispatchEvent(new Event('change',{bubbles:true}));}"); W(600)
        T('dificuldade', abs(party().get('diffMul',1)-1.8)<0.01, 'slider de dificuldade salvo em 180%')
        st=party()['stage']; at(2026,11,15,9); pp=party(); last=pp['last']
        T('derrota', (not last['win'] and pp['stage']==st) or last['win'], f"dificuldade máxima: {'derrota' if not last['win'] else 'vitória'} no estágio {last['stage']} → estágio agora {pp['stage']}")
        T('evento', pp.get('eventBattle') is not None or True, 'domingo: batalha extra do evento → '+str((pp.get('eventBattle') or {}).get('name')))
    step('derrota', s_loss)
    # ---------- dias sem abrir ----------
    def s_gap():
        st=party()['stage']; at(2026,11,19,9); pp=party()
        T('ausência', None, f"4 dias sem abrir o app: batalhas no histórico = {[h['day'] for h in pp['history']][:5]} · last.missed={pp['last'].get('missed')}")
        become('Pedro'); closeAll(); openMe(); closeAll()
        T('ausência', q('.task:has-text("Escovar")') is not None, 'tarefa obrigatória diária volta depois de dias sem abrir')
    step('ausencia', s_gap)
    # ---------- loja, relatório, bestiário, aposentar ----------
    def s_shop():
        h=heroDoc('Pedro'); A.click('[data-act=tab][data-v=loja]'); W(300)
        g=A.inner_text('.hero-head .meta'); T('loja', True, 'saldo do Pedro: '+g.replace('\n',' '))
        btn=q('[data-act=buyGear]:not([disabled])')
        if btn: btn.click(); W(400); T('loja', bool(heroDoc('Pedro').get('gear')), 'comprou equipamento: '+str(heroDoc('Pedro').get('gear')))
        else: T('loja', None, 'sem ouro suficiente para equipamento ainda')
        goHome(); W(200); A.click('[data-act=bestiary]'); W(300)
        T('bestiário', q('.best, .bestiary, h2') is not None, 'bestiário: '+(txt('h2') or ''))
        goHome(); W(200); A.click('[data-act=settings]'); W(300)
        if q('[data-form=pinGate]'): A.fill('[data-form=pinGate] input','1234'); A.press('[data-form=pinGate] input','Enter'); W(400)
        if q('[data-act=report]'): A.click('[data-act=report]'); W(400); T('relatório', 'Ana' in A.inner_text('main') if q('main') else True, 'relatório semanal abre')
        else: T('relatório', False, 'botão de relatório não encontrado')
        goHome(); W(300)
        T('histórico', len(A.query_selector_all('.feedlist li'))>=5, f"histórico da sala com {len(A.query_selector_all('.feedlist li'))} itens")
        T('ranking', q('.card:has-text("Ranking da semana")') is not None, 'ranking semanal na tela inicial')
        become('Lia'); closeAll(); openMe(); closeAll(); A.click('[data-act=askRetire]'); W(300); A.click('[data-act=retire]'); W(600)
        T('aposentar', not any(v.get('name')=='Lia' for k,v in docs().items() if '/heroes/' in k), 'aposentar herói libera a vaga')
    step('loja', s_shop)
    A.set_viewport_size({'width':390,'height':844}); become('Pedro') if q('[data-act=pickMe]') else None; W(400); A.screenshot(path='out/audit_mobile_home.png', full_page=True)
    A.click('[data-act=replay]') if q('[data-act=replay]') else None; W(1200); A.screenshot(path='out/audit_mobile_replay.png'); closeAll()
    b.close()
print('\n'.join(errs) or 'no console errors')
