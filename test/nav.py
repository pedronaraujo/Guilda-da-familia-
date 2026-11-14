# Ajudantes de navegação para os testes (abas embaixo, menu da conta, detalhes da tarefa).
TABS = {'home': 'home', 'today': 'today', 'settings': 'settings', 'prizes': 'prizes', 'hero': 'hero',
        'tab:tarefas': 'today', 'tab:recompensas': 'prizes'}

def W(P, ms=600): P.wait_for_timeout(ms)

def menu(P, v, wait=700):
    """Vai para uma aba (home, today, settings, prizes, hero, tab:<aba do herói>) ou item do menu da conta."""
    if v in TABS:
        P.click(f'.tabbar [data-v={TABS[v]}]'); W(P, wait)
        if TABS[v] == 'settings': open_groups(P)
        return
    if v.startswith('tab:'):
        k = v[4:]
        P.click('.tabbar [data-v=hero]'); W(P, 400)
        if k in ('loja', 'visual'):
            P.click('.tabs [role=tab]:nth-child(2)'); W(P, 300)
            P.click(f'.subseg [data-v={k}]'); W(P, wait); return
        P.click(f'.tabs [data-v={k}]'); W(P, wait); return
    P.click('.nav-btn'); W(P, 250); P.click(f'.nav-it[data-v="{v}"]'); W(P, wait)

def more(P):
    """Abre 'Mais opções' do campo de criar tarefa, se estiver fechado."""
    if P.query_selector('.qa-more.hidden'): P.click('[data-act=moreOpts]'); W(P, 250)

def row(title):
    return f'xpath=//li[contains(@class,"task")][.//div[@class="t" and starts-with(normalize-space(.),"{title}")]]'

def row_act(P, title, act, wait=900):
    """Abre os detalhes da tarefa (toque no texto) e clica numa ação: undoTask, undoBoard, editTask, delTask, reopenBoard."""
    sel = row(title) + f'//button[@data-act="{act}"]'
    show(P, title)
    if not P.query_selector(sel):
        P.click(row(title) + '//div[contains(@class,"tbody")]'); W(P, 300)
    P.click(sel); W(P, wait)

def invite(P):
    menu(P, 'invite', 500)

def show(P, title):
    """Se a tarefa está numa lista recolhida (Feitas hoje / Agendadas), abre a lista."""
    el = P.query_selector(row(title))
    if el and not el.is_visible():
        for sm in ('toggleDone', 'toggleLater'):
            d = P.query_selector(f'summary[data-act={sm}]')
            if d and P.evaluate("(e) => !e.parentElement.open", d): d.click(); W(P, 300)
            el = P.query_selector(row(title))
            if el and el.is_visible(): return

def open_groups(P):
    """Na aba Sala, abre os quatro grupos (Pessoas, Regras, Prêmios, Sala e segurança)."""
    for _ in range(6):
        sm = P.query_selector('details.sgroup:not([open]) > summary')
        if not sm: return
        sm.click(); W(P, 250)
