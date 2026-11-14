// Simula google.script.run com a mesma lógica do Code.gs (salas), compartilhada entre abas via localStorage
(function(){
  if (!window.__tutTest) { try { localStorage.setItem('guilda-notut', '1'); } catch (e) { /* sem armazenamento */ } }
  const KEY='gasmock2';
  const st=()=>JSON.parse(localStorage.getItem(KEY)||'{"rev":{},"docs":{}}');
  const save=s=>localStorage.setItem(KEY,JSON.stringify(s));
  const RE=/^rooms\/([A-Z0-9]{6})(\/(heroes|board|rewards|chores|inbox|activity|requests)\/[A-Za-z0-9_-]{1,40}|\/party\/main)?$/;
  const roomOf=p=>{const m=RE.exec(p); if(!m) throw new Error('caminho inválido '+p); return m[1];};
  const docsOf=(s,room)=>{const o={},pre='rooms/'+room+'/';for(const k in s.docs) if(k.startsWith(pre)) o[k.slice(pre.length)]=s.docs[k];return o;};
  const out=(s,room,x)=>Object.assign({room,rev:s.rev[room]||0,docs:docsOf(s,room)},x||{});
  const api={
    api_room(c){const s=st();return {meta:s.docs['rooms/'+c]||null};},
    api_create_room(c,meta,party){const s=st();if(s.docs['rooms/'+c])return{ok:false};s.docs['rooms/'+c]=meta;s.docs['rooms/'+c+'/party/main']=party;s.rev[c]=(s.rev[c]||0)+1;save(s);return{ok:true};},
    api_get(cr,room){const s=st();const r=s.rev[room]||0;if(cr===r&&r>0)return{room,rev:r};return out(s,room);},
    api_set(p,d){const room=roomOf(p);const s=st();if(JSON.stringify(d).length>60000)throw new Error('too_large');s.docs[p]=d;s.rev[room]=(s.rev[room]||0)+1;save(s);return out(s,room);},
    api_delete(p){const room=roomOf(p);const s=st();delete s.docs[p];s.rev[room]=(s.rev[room]||0)+1;save(s);return out(s,room);},
    api_claim(p,patch){const room=roomOf(p);const s=st();const d=s.docs[p];if(!d||d.done)return out(s,room,{ok:false});Object.assign(d,patch);s.rev[room]=(s.rev[room]||0)+1;save(s);return out(s,room,{ok:true});},
    api_lock(){return true;},
  };
  window.__gascalls=0;
  const mk=(ok,fail)=>new Proxy({}, {get(_,name){
    if(name==='withSuccessHandler') return f=>mk(f,fail);
    if(name==='withFailureHandler') return f=>mk(ok,f);
    return (...a)=>setTimeout(()=>{window.__gascalls++; try{const r=JSON.parse(JSON.stringify(api[name](...JSON.parse(JSON.stringify(a))))); ok&&ok(r);}catch(e){fail&&fail(e);}},100);
  }});
  window.google={script:{get run(){return mk(null,null);}}};
})();
