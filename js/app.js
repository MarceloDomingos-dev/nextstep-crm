/* Next Step CRM · app (JavaScript puro + Supabase) */
(() => {
'use strict';

/* ---------- Constantes do negócio ---------- */
const ETAPAS = [
  { id:'novo',       nome:'Novo lead',             cor:'#B5ACA2' },
  { id:'contato',    nome:'Primeiro contato',      cor:'#F7B27F' },
  { id:'reuniao',    nome:'Reunião / diagnóstico', cor:'#F28C45' },
  { id:'proposta',   nome:'Proposta enviada',      cor:'#EF6C22' },
  { id:'negociacao', nome:'Negociação',            cor:'#A9440B' },
  { id:'ganho',      nome:'Fechado',               cor:'#1E7A46' },
  { id:'perdido',    nome:'Perdido',               cor:'#141210' }
];
const ETAPA = Object.fromEntries(ETAPAS.map(e => [e.id, e]));
const ATIVAS = ['novo','contato','reuniao','proposta','negociacao'];
const SERVICOS = ['Tráfego pago','Redes sociais e branding','Formação de líderes','Treinamento de equipes','Mapeamento de processos','Consultoria / outro'];
const ORIGENS = ['Site (diagnóstico)','Instagram','WhatsApp','Indicação','LinkedIn','Evento','Prospecção ativa','Outro'];
const VIEWS = ['funil','follow','contatos','relatorios','equipe'];
const CAMPOS = ['nome','empresa','cargo','telefone','email','instagram','cidade','origem','servico','valor','etapa','proximo_contato','proxima_acao','motivo_perda','responsavel'];

/* ---------- Utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => Number(v) || 0;
const brl = n => num(n).toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits: num(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const brlShort = n => { n = num(n); if (n >= 1e6) return 'R$ ' + (n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1}) + ' mi'; if (n >= 1e4) return 'R$ ' + (n/1e3).toLocaleString('pt-BR',{maximumFractionDigits:1}) + ' mil'; return brl(n); };
const pad = n => String(n).padStart(2,'0');
const isoDay = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
const today = () => isoDay(new Date());
const addDays = (iso, n) => { const [y,m,d] = (iso || today()).split('-').map(Number); return isoDay(new Date(y, m-1, d+n)); };
const diffDays = iso => { const [y,m,d] = iso.split('-').map(Number); const t = new Date(); return Math.round((new Date(y,m-1,d) - new Date(t.getFullYear(),t.getMonth(),t.getDate()))/864e5); };
const fmtDay = iso => { if (!iso) return ''; const [y,m,d] = iso.slice(0,10).split('-'); return d + '/' + m + '/' + y; };
const fmtDayShort = iso => { if (!iso) return ''; const [y,m,d] = iso.slice(0,10).split('-'); return d + '/' + m + (Number(y) !== new Date().getFullYear() ? '/' + y.slice(2) : ''); };
const fmtStamp = ts => { const d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const parseMoney = s => { s = String(s ?? '').replace(/[^\d,.-]/g,''); if (!s) return 0; if (s.includes(',')) s = s.replace(/\./g,'').replace(',', '.'); else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g,''); const n = parseFloat(s); return isFinite(n) ? Math.max(0, Math.round(n*100)/100) : 0; };
const digits = s => String(s || '').replace(/\D/g,'');
const waLink = tel => { let d = digits(tel); if (!d) return ''; if (d.length <= 11) d = '55' + d; return 'https://wa.me/' + d; };
const initials = s => String(s || '?').trim().split(/\s+/).slice(0,2).map(p => p[0]).join('').toUpperCase() || '?';
const dueClass = iso => { if (!iso) return ''; const d = diffDays(iso); return d < 0 ? 'late' : d === 0 ? 'today' : ''; };
const dueLabel = iso => { if (!iso) return ''; const d = diffDays(iso); if (d < 0) return d === -1 ? 'Ontem' : 'Atrasado ' + (-d) + 'd'; if (d === 0) return 'Hoje'; if (d === 1) return 'Amanhã'; return fmtDayShort(iso); };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

function errMsg(error){
  const m = String((error && (error.message || error.error_description)) || error || '');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Sem conexão com a internet. Nada foi perdido do que você digitou; tente de novo.';
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/User already registered/i.test(m)) return 'Já existe uma conta com este e-mail. Use "Entrar" ou "Esqueci minha senha".';
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (/row-level security|permission denied/i.test(m)) return 'Você não tem permissão para fazer isso.';
  if (/JWT expired|invalid JWT/i.test(m)) return 'Sua sessão expirou. Entre de novo.';
  if (/pelo menos um admin/i.test(m)) return 'A equipe precisa de pelo menos um admin ativo.';
  return m || 'Algo deu errado. Tente de novo.';
}

let toastTimer;
function toast(msg, isErr){ const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (isErr ? ' err' : ''); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, isErr ? 6000 : 3200); }

/* ---------- Estado ---------- */
const S = {
  session:null, me:null, perfis:new Map(), leads:new Map(), loaded:false, loadError:'',
  view: VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : (VIEWS.includes(lsGet('crm-view')) ? lsGet('crm-view') : 'funil'),
  meus: lsGet('crm-meus') === '1', q:'', etapaFiltro:'', respFiltro:'', contatosModo:'pessoas',
  openId:null, draftNew:false, draft:null, notas:[], notasLoading:false, callout:'', focusField:'',
  importRows:null, online:true, menuOpen:false,
  authMode:'login', authMsg:null, authBusy:false
};

/* ---------- Supabase ---------- */
const CFG = window.CRM_CONFIG || {};
let sb = null, channel = null;
if (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase) {
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
}

async function loadPerfil(uid){
  for (let i = 0; i < 3; i++) {
    const { data, error } = await sb.from('perfis').select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    if (data) return data;
    await new Promise(r => setTimeout(r, 600));
  }
  return null;
}

async function fetchAllLeads(){
  const out = []; const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from('leads').select('*').order('criado_em', { ascending:true }).range(from, from + page - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}

async function loadAll(){
  try {
    const [{ data: perfis, error: e1 }, leads] = await Promise.all([ sb.from('perfis').select('*').order('nome'), fetchAllLeads() ]);
    if (e1) throw e1;
    S.perfis = new Map(perfis.map(p => [p.id, p]));
    S.leads = new Map(leads.map(l => [l.id, l]));
    S.loaded = true; S.loadError = '';
  } catch (e) { S.loadError = errMsg(e); S.loaded = true; }
  render();
}

function subscribe(){
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('crm-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event:'*', schema:'public', table:'leads' }, p => {
      if (p.eventType === 'DELETE') { S.leads.delete(p.old.id); if (S.openId === p.old.id && !S.draftNew) { closeDrawer(); toast('Este lead foi excluído por outra pessoa da equipe.'); } }
      else S.leads.set(p.new.id, p.new);
      render();
    })
    .on('postgres_changes', { event:'*', schema:'public', table:'notas' }, p => {
      const lid = (p.new && p.new.lead_id) || (p.old && p.old.lead_id);
      if (S.openId && lid === S.openId) loadNotas(S.openId);
    })
    .subscribe(status => { S.online = status === 'SUBSCRIBED'; renderConn(); });
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.me && S.me.ativo) loadAll(); });
window.addEventListener('online', () => { if (S.me && S.me.ativo) { loadAll(); subscribe(); } });

async function handleSession(session){
  S.session = session;
  if (!session) { S.me = null; S.loaded = false; if (channel) { sb.removeChannel(channel); channel = null; } closeDrawer(); render(); return; }
  if (S.authMode === 'reset') { render(); return; }
  try { S.me = await loadPerfil(session.user.id); }
  catch (e) { S.me = null; S.loadError = errMsg(e); }
  if (S.me && S.me.ativo) { S.loaded = false; render(); await loadAll(); subscribe(); }
  else render();
}

/* ---------- Gravação ---------- */
function onlyCampos(obj){ const o = {}; CAMPOS.forEach(k => { if (k in obj) o[k] = obj[k]; }); return o; }

async function patchLead(id, fields){
  const prev = S.leads.get(id);
  if (prev) { S.leads.set(id, { ...prev, ...fields }); render(); }
  const { data, error } = await sb.from('leads').update(fields).eq('id', id).select().maybeSingle();
  if (error || !data) {
    if (prev) S.leads.set(id, prev);
    render();
    toast(error ? 'Não foi salvo. ' + errMsg(error) : 'Não foi salvo: este lead não existe mais.', true);
    return null;
  }
  S.leads.set(id, data); render();
  return data;
}
async function createLead(fields){
  const { data, error } = await sb.from('leads').insert(fields).select().single();
  if (error) { toast('Não foi criado. ' + errMsg(error), true); return null; }
  S.leads.set(data.id, data); render();
  return data;
}
async function addNota(leadId, texto){
  const { error } = await sb.from('notas').insert({ lead_id: leadId, autor: S.me.id, texto });
  if (error) { toast('A anotação não foi salva. ' + errMsg(error), true); return false; }
  return true;
}
async function loadNotas(leadId){
  S.notasLoading = true;
  const { data, error } = await sb.from('notas').select('*').eq('lead_id', leadId).order('criado_em', { ascending:false });
  if (S.openId !== leadId) return;
  S.notasLoading = false;
  S.notas = error ? [] : data;
  if (error) toast('Não consegui carregar o histórico. ' + errMsg(error), true);
  renderNotas();
}

async function moveStage(id, etapa){
  const l = S.leads.get(id);
  if (!l || l.etapa === etapa) return;
  const saved = await patchLead(id, { etapa });
  if (!saved) return;
  if (etapa === 'perdido') { openLead(id, { callout:'Lead marcado como perdido. Conte o motivo da perda e salve.', focus:'f-perda' }); return; }
  if (etapa === 'ganho') toast('Fechado!' + (saved.valor ? ' ' + brl(saved.valor) + ' entrou no mês.' : ''));
  if (S.openId === id) loadNotas(id);
}

/* ---------- Seleções ---------- */
const nomeResp = id => (S.perfis.get(id) || {}).nome || '';
const visiveis = () => [...S.leads.values()].filter(l => !S.meus || l.responsavel === S.me.id);
const ativos = () => visiveis().filter(l => ATIVAS.includes(l.etapa));
const membrosAtivos = () => [...S.perfis.values()].filter(p => p.ativo).sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'));

/* ---------- Render: estrutura ---------- */
function render(){
  const app = $('#app');
  if (!sb) { app.innerHTML = viewSetup(); return; }
  if (!S.session || S.authMode === 'reset') { app.innerHTML = viewAuth(); return; }
  if (!S.me) { app.innerHTML = viewProblema(S.loadError || 'Não encontrei seu perfil na equipe.'); return; }
  if (!S.me.ativo) { app.innerHTML = viewPendente(); return; }
  if (S.view === 'equipe' && S.me.papel !== 'admin') S.view = 'funil';
  if (!app.querySelector('.top')) app.innerHTML = shell();
  const pend = ativos().filter(l => l.proximo_contato && diffDays(l.proximo_contato) <= 0).length;
  app.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === S.view)));
  const badge = $('#fu-badge'); badge.hidden = !pend; badge.textContent = pend;
  $('#tab-equipe').hidden = S.me.papel !== 'admin';
  $('#me-btn').innerHTML = `<span class="avatar">${esc(initials(S.me.nome))}</span><span class="nm">${esc(S.me.nome)}</span><span class="conn ${S.online ? '' : 'off'}" id="conn" title="${S.online ? 'Conectado: atualiza em tempo real' : 'Sem tempo real: atualize a página para ver mudanças da equipe'}"></span>`;
  $('#menu').hidden = !S.menuOpen;
  $('#menu').innerHTML = `<div class="who"><b>${esc(S.me.nome)}</b><span>${esc(S.me.email)} · ${S.me.papel === 'admin' ? 'Admin' : 'Vendedor'}</span></div>
    <button data-act="senha">Alterar minha senha</button><button data-act="sair">Sair</button>`;
  renderNotice(); renderKpis();
  const v = $('#view');
  const focusId = document.activeElement && v.contains(document.activeElement) ? document.activeElement.id : '';
  const selStart = focusId && document.activeElement.selectionStart;
  if (!S.loaded) v.innerHTML = '<div class="panel empty"><h2>Carregando seus leads…</h2></div>';
  else if (S.loadError) v.innerHTML = `<div class="panel empty"><h2>Não consegui carregar os dados</h2><p>${esc(S.loadError)}</p><button class="btn btn-primary" data-act="recarregar">Tentar de novo</button></div>`;
  else v.innerHTML = { funil:viewFunil, follow:viewFollow, contatos:viewContatos, relatorios:viewRelatorios, equipe:viewEquipe }[S.view]();
  if (focusId && $('#' + focusId)) { const el = $('#' + focusId); el.focus(); try { if (selStart != null) el.setSelectionRange(selStart, selStart); } catch (e) {} }
}
function renderConn(){ const c = $('#conn'); if (c) { c.className = 'conn' + (S.online ? '' : ' off'); c.title = S.online ? 'Conectado: atualiza em tempo real' : 'Sem tempo real: atualize a página para ver mudanças da equipe'; } }

function shell(){
  return `<header class="top"><div class="top-in" style="position:relative">
    <div class="brand"><span class="mark" aria-hidden="true">N</span>Next Step <small>CRM</small></div>
    <nav class="tabs" role="tablist" aria-label="Telas">
      <button class="tab" role="tab" data-view="funil">Funil</button>
      <button class="tab" role="tab" data-view="follow">Follow-ups<span class="badge" id="fu-badge" hidden></span></button>
      <button class="tab" role="tab" data-view="contatos">Contatos e empresas</button>
      <button class="tab" role="tab" data-view="relatorios">Relatórios</button>
      <button class="tab" role="tab" data-view="equipe" id="tab-equipe">Equipe</button>
    </nav>
    <div class="top-actions">
      <button class="btn btn-primary" data-act="novo">+ Novo lead</button>
      <button class="me" id="me-btn" data-act="menu" aria-haspopup="true"></button>
    </div>
    <div class="menu" id="menu" role="menu" hidden></div>
  </div></header>
  <main class="wrap"><div id="notice-slot"></div><section class="kpis" id="kpis" aria-label="Resumo"></section><section id="view"></section></main>`;
}

function renderNotice(){
  let h = '';
  if (S.importRows) h += `<div class="notice"><p>Encontrei <b>${S.importRows.length} ${S.importRows.length === 1 ? 'lead' : 'leads'}</b> no arquivo, por exemplo: ${esc(S.importRows.slice(0,3).map(r => r.nome).join(', '))}. Eles entram como “Novo lead”.</p><button class="btn btn-sm btn-primary" data-act="import-ok">Importar ${S.importRows.length}</button><button class="btn btn-sm btn-ghost" data-act="import-cancel">Cancelar</button></div>`;
  if (S.me.papel === 'admin') {
    const aguardando = [...S.perfis.values()].filter(p => !p.ativo).length;
    if (aguardando) h += `<div class="notice"><p><b>${aguardando} ${aguardando === 1 ? 'pessoa aguarda' : 'pessoas aguardam'} liberação</b> para entrar no CRM.</p><button class="btn btn-sm" data-goto="equipe">Ver equipe</button></div>`;
  }
  $('#notice-slot').innerHTML = h;
}

function renderKpis(){
  const all = visiveis(), at = ativos();
  const aberto = at.reduce((s,l) => s + num(l.valor), 0);
  const mes = today().slice(0,7);
  const ganhosMes = all.filter(l => l.etapa === 'ganho' && String(l.fechado_em || '').startsWith(mes));
  const fech = all.filter(l => l.etapa === 'ganho').length, perd = all.filter(l => l.etapa === 'perdido').length;
  const atras = at.filter(l => l.proximo_contato && diffDays(l.proximo_contato) < 0).length;
  const hoje = at.filter(l => l.proximo_contato && diffDays(l.proximo_contato) === 0).length;
  $('#kpis').innerHTML = `
    <div class="kpi"><span class="lbl">Leads em andamento</span><span class="val num">${at.length}</span><span class="sub">${all.length} no total${S.meus ? ' (só os meus)' : ''}</span></div>
    <div class="kpi"><span class="lbl">Valor em aberto</span><span class="val num" title="${esc(brl(aberto))}">${brlShort(aberto)}</span><span class="sub">oportunidades ativas</span></div>
    <div class="kpi"><span class="lbl">Fechado este mês</span><span class="val num">${brlShort(ganhosMes.reduce((s,l) => s + num(l.valor), 0))}</span><span class="sub">${ganhosMes.length} ${ganhosMes.length === 1 ? 'contrato' : 'contratos'}</span></div>
    <div class="kpi"><span class="lbl">Conversão</span><span class="val num">${fech + perd ? Math.round(fech/(fech+perd)*100) + '%' : '—'}</span><span class="sub">${fech} fechados · ${perd} perdidos</span></div>
    <button class="kpi" data-goto="follow"><span class="lbl">Follow-ups pendentes</span><span class="val num ${atras ? 'alert' : ''}">${atras + hoje}</span><span class="sub">${atras} atrasados · ${hoje} para hoje</span></button>`;
}

/* ---------- Telas sem login ---------- */
function viewSetup(){
  return `<div class="boot"><span class="mark mark-lg" aria-hidden="true">N</span>
    <div class="panel empty" style="max-width:520px"><h2>Falta conectar o banco de dados</h2>
    <p>Abra o arquivo <b>js/config.js</b> e cole a URL e a chave “anon public” do seu projeto no Supabase. O passo a passo está no LEIA-ME.</p></div></div>`;
}
function authSide(){
  return `<aside class="auth-side"><div class="brand"><span class="mark" aria-hidden="true">N</span>Next Step <small>CRM</small></div>
    <div><h1>Do primeiro contato ao <em>contrato fechado.</em></h1><p>Funil, follow-ups e histórico de cada cliente da Next Step num lugar só, para você e sua equipe.</p></div>
    <div class="auth-steps">${ETAPAS.slice(0,6).map(e => `<span>${esc(e.nome)}</span>`).join('')}</div></aside>`;
}
function viewAuth(){
  const m = S.authMode, msg = S.authMsg ? `<div class="msg ${S.authMsg.ok ? 'ok' : 'err'}" role="alert">${esc(S.authMsg.text)}</div>` : '';
  const busy = S.authBusy ? 'disabled' : '';
  let form;
  if (m === 'signup') form = `<h2>Criar conta</h2><p class="hint" style="margin:0">Use o e-mail que o administrador cadastrou para você. A primeira conta criada vira admin.</p>${msg}
      <form id="f-auth" data-mode="signup" class="auth-card" style="gap:12px">
      <div class="fl"><label for="a-nome">Seu nome</label><input class="field" id="a-nome" autocomplete="name" required></div>
      <div class="fl"><label for="a-email">E-mail</label><input class="field" id="a-email" type="email" autocomplete="email" required></div>
      <div class="fl"><label for="a-senha">Senha (mínimo 6 caracteres)</label><input class="field" id="a-senha" type="password" autocomplete="new-password" minlength="6" required></div>
      <button class="btn btn-primary" ${busy}>Criar conta</button></form>
      <div class="auth-links"><button class="linkbtn" data-auth="login">Já tenho conta</button></div>`;
  else if (m === 'forgot') form = `<h2>Recuperar senha</h2><p class="hint" style="margin:0">Enviamos um link para você criar uma senha nova.</p>${msg}
      <form id="f-auth" data-mode="forgot" class="auth-card" style="gap:12px">
      <div class="fl"><label for="a-email">E-mail</label><input class="field" id="a-email" type="email" autocomplete="email" required></div>
      <button class="btn btn-primary" ${busy}>Enviar link</button></form>
      <div class="auth-links"><button class="linkbtn" data-auth="login">Voltar para entrar</button></div>`;
  else if (m === 'reset') form = `<h2>Criar senha nova</h2>${msg}
      <form id="f-auth" data-mode="reset" class="auth-card" style="gap:12px">
      <div class="fl"><label for="a-senha">Nova senha (mínimo 6 caracteres)</label><input class="field" id="a-senha" type="password" autocomplete="new-password" minlength="6" required></div>
      <button class="btn btn-primary" ${busy}>Salvar senha</button></form>`;
  else form = `<h2>Entrar</h2>${msg}
      <form id="f-auth" data-mode="login" class="auth-card" style="gap:12px">
      <div class="fl"><label for="a-email">E-mail</label><input class="field" id="a-email" type="email" autocomplete="email" required></div>
      <div class="fl"><label for="a-senha">Senha</label><input class="field" id="a-senha" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-primary" ${busy}>Entrar</button></form>
      <div class="auth-links"><button class="linkbtn" data-auth="forgot">Esqueci minha senha</button><button class="linkbtn" data-auth="signup">Criar conta</button></div>`;
  return `<div class="auth">${authSide()}<div class="auth-main"><div class="auth-card">${form}</div></div></div>`;
}
function viewPendente(){
  return `<div class="auth">${authSide()}<div class="auth-main"><div class="auth-card">
    <h2>Conta aguardando liberação</h2>
    <p>Olá, ${esc(S.me.nome)}. Sua conta (${esc(S.me.email)}) foi criada, mas ainda não tem acesso aos leads.</p>
    <p class="hint">Peça ao administrador para liberar seu acesso na tela Equipe do CRM. Depois, clique em “Verificar de novo”.</p>
    <button class="btn btn-primary" data-act="verificar" style="justify-content:center">Verificar de novo</button>
    <button class="btn" data-act="sair" style="justify-content:center">Sair</button></div></div></div>`;
}
function viewProblema(text){
  return `<div class="boot"><span class="mark mark-lg" aria-hidden="true">N</span><div class="panel empty" style="max-width:520px"><h2>Não foi possível abrir o CRM</h2><p>${esc(text)}</p>
    <div class="quick"><button class="btn btn-primary" data-act="verificar">Tentar de novo</button><button class="btn" data-act="sair">Sair</button></div></div></div>`;
}

/* ---------- Tela: Funil ---------- */
function filtroBar(){
  return `<label class="toggle"><input type="checkbox" id="f-meus" ${S.meus ? 'checked' : ''}> Só os meus leads</label>`;
}
function chipDue(l){ return l.proximo_contato && ATIVAS.includes(l.etapa) ? `<span class="chip ${dueClass(l.proximo_contato)}" title="Próximo contato: ${esc(fmtDay(l.proximo_contato))}">${esc(dueLabel(l.proximo_contato))}</span>` : ''; }
function sortFunil(a,b){
  const da = a.proximo_contato || '9999', dbb = b.proximo_contato || '9999';
  if (ATIVAS.includes(a.etapa) && da !== dbb) return da < dbb ? -1 : 1;
  return String(b.atualizado_em).localeCompare(String(a.atualizado_em));
}
function emptyState(){
  return `<div class="panel empty"><h2>${S.meus ? 'Nenhum lead seu ainda' : 'Nenhum lead ainda'}</h2>
    <p>${S.meus ? 'Desmarque “Só os meus leads” para ver os da equipe, ou cadastre um novo.' : 'Cadastre o primeiro lead, importe um CSV ou conecte o formulário do site. Cada lead entra no funil como “Novo lead”.'}</p>
    <div class="quick" style="justify-content:center"><button class="btn btn-primary" data-act="novo">+ Novo lead</button><button class="btn" data-act="import">Importar CSV</button></div></div>`;
}
function viewFunil(){
  const all = visiveis();
  const head = `<div class="bar"><h1>Funil de vendas</h1>${filtroBar()}<span class="hint">Arraste os cards entre as etapas ou use a seta →</span></div>`;
  if (!all.length) return head + '<div style="margin-top:12px">' + emptyState() + '</div>';
  const cols = ETAPAS.map((e, i) => {
    const items = all.filter(l => l.etapa === e.id).sort(sortFunil);
    const soma = items.reduce((s,l) => s + num(l.valor), 0);
    const next = i < 5 ? ETAPAS[i+1] : null;
    const cards = items.map(l => `
      <div class="card" draggable="true" data-id="${esc(l.id)}" role="button" tabindex="0" aria-label="Abrir ${esc(l.nome)}">
        <span class="nm">${esc(l.nome)}</span>
        ${l.empresa ? `<span class="co">${esc(l.empresa)}</span>` : ''}
        ${l.servico || l.responsavel ? `<div class="row">${l.servico ? `<span class="chip">${esc(l.servico)}</span>` : ''}${l.responsavel && !S.meus ? `<span class="chip owner" title="Responsável">${esc(initials(nomeResp(l.responsavel)))}</span>` : ''}</div>` : ''}
        <div class="row">${chipDue(l)}${e.id === 'perdido' && l.motivo_perda ? `<span class="chip">${esc(l.motivo_perda)}</span>` : ''}${l.valor ? `<span class="val num">${brlShort(l.valor)}</span>` : ''}
          ${next ? `<button class="adv" data-adv="${esc(l.id)}" data-to="${next.id}" title="Mover para ${esc(next.nome)}" aria-label="Mover ${esc(l.nome)} para ${esc(next.nome)}">→</button>` : ''}</div>
      </div>`).join('');
    return `<div class="col" data-col="${e.id}">
      <div class="col-h"><span class="t"><span class="dot" style="background:${e.cor}"></span>${esc(e.nome)}<span class="n num">${items.length}</span></span>
      <span class="sum num">${soma ? brl(soma) : '&nbsp;'}</span></div>
      <div class="cards">${cards || `<div class="col-empty">${e.id === 'novo' ? 'Leads novos aparecem aqui' : 'Arraste um card para cá'}</div>`}</div></div>`;
  }).join('');
  return head + `<div class="board-scroll" style="margin-top:12px"><div class="board">${cols}</div></div>`;
}

/* ---------- Tela: Follow-ups ---------- */
function viewFollow(){
  const at = ativos();
  const comData = at.filter(l => l.proximo_contato).sort((a,b) => a.proximo_contato < b.proximo_contato ? -1 : a.proximo_contato > b.proximo_contato ? 1 : 0);
  const grupos = [
    { t:'Atrasados', cls:'late', items: comData.filter(l => diffDays(l.proximo_contato) < 0) },
    { t:'Hoje', items: comData.filter(l => diffDays(l.proximo_contato) === 0) },
    { t:'Próximos 7 dias', items: comData.filter(l => { const d = diffDays(l.proximo_contato); return d > 0 && d <= 7; }) },
    { t:'Mais adiante', items: comData.filter(l => diffDays(l.proximo_contato) > 7) },
    { t:'Sem data marcada', items: at.filter(l => !l.proximo_contato) }
  ].filter(g => g.items.length);
  const row = l => {
    const late = l.proximo_contato && diffDays(l.proximo_contato) < 0;
    return `<div class="fu">
      <span class="when ${late ? 'late' : ''}">${l.proximo_contato ? esc(dueLabel(l.proximo_contato)) + '<br><span class="hint num">' + fmtDay(l.proximo_contato) + '</span>' : '—'}</span>
      <div class="who"><button class="link" data-open="${esc(l.id)}">${esc(l.nome)}${l.empresa ? ' · ' + esc(l.empresa) : ''}</button>
        <span>${esc(l.proxima_acao || 'Sem ação definida')} · ${esc(ETAPA[l.etapa].nome)}${l.responsavel && !S.meus ? ' · ' + esc(nomeResp(l.responsavel)) : ''}${l.telefone ? ' · ' + esc(l.telefone) : ''}</span></div>
      <div class="acts">
        ${l.telefone ? `<a class="btn btn-sm" href="${esc(waLink(l.telefone))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        <button class="btn btn-sm" data-snooze="${esc(l.id)}" data-days="1">+1 dia</button>
        <button class="btn btn-sm" data-snooze="${esc(l.id)}" data-days="3">+3 dias</button>
        <button class="btn btn-sm btn-dark" data-done="${esc(l.id)}">Feito</button>
      </div></div>`;
  };
  return `<div class="bar"><h1>Follow-ups</h1>${filtroBar()}<span class="hint">“Feito” registra o contato no histórico e pede a próxima data.</span></div>
    <div class="stack" style="margin-top:12px">${grupos.length ? grupos.map(g => `<div class="panel"><div class="group-h ${g.cls || ''}">${g.t}<span class="n num">${g.items.length}</span></div>${g.items.map(row).join('')}</div>`).join('')
      : '<div class="panel empty"><h2>Nenhum lead em andamento</h2><p>Quando um lead estiver em negociação, marque a data do próximo contato e ele aparece aqui.</p></div>'}</div>`;
}

/* ---------- Tela: Contatos e empresas ---------- */
function matchQ(l){
  if (S.etapaFiltro && l.etapa !== S.etapaFiltro) return false;
  if (S.respFiltro && (S.respFiltro === '-' ? l.responsavel : l.responsavel !== S.respFiltro)) return false;
  if (!S.q) return true;
  const q = S.q.toLowerCase(), qd = digits(S.q);
  return [l.nome,l.empresa,l.email,l.instagram,l.cidade,l.servico,l.origem].some(v => String(v || '').toLowerCase().includes(q)) || (qd.length >= 3 && digits(l.telefone).includes(qd));
}
function viewContatos(){
  const all = visiveis(), lista = all.filter(matchQ);
  const head = `<div class="bar"><h1>Contatos e empresas</h1>
    <div class="seg" role="group" aria-label="Agrupar"><button data-modo="pessoas" aria-pressed="${S.contatosModo === 'pessoas'}">Pessoas</button><button data-modo="empresas" aria-pressed="${S.contatosModo === 'empresas'}">Empresas</button></div>
    <input class="field search" id="q" type="search" placeholder="Buscar nome, empresa, telefone, e-mail" value="${esc(S.q)}" aria-label="Buscar">
    <select class="field" id="flt-etapa" aria-label="Filtrar por etapa"><option value="">Todas as etapas</option>${ETAPAS.map(e => `<option value="${e.id}" ${S.etapaFiltro === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</select>
    <select class="field" id="flt-resp" aria-label="Filtrar por responsável"><option value="">Todos os responsáveis</option><option value="-" ${S.respFiltro === '-' ? 'selected' : ''}>Sem responsável</option>${membrosAtivos().map(p => `<option value="${esc(p.id)}" ${S.respFiltro === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
    ${filtroBar()}
    <button class="btn" data-act="import">Importar CSV</button><button class="btn" data-act="export">Exportar CSV</button></div>`;
  if (!all.length) return head + '<div style="margin-top:12px">' + emptyState() + '</div>';
  let body;
  if (S.contatosModo === 'pessoas') {
    const rows = lista.sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR')).map(l => `<tr>
      <td><button class="link" data-open="${esc(l.id)}">${esc(l.nome)}</button>${l.cargo ? `<div class="hint">${esc(l.cargo)}</div>` : ''}</td>
      <td>${esc(l.empresa)}</td>
      <td class="num">${esc(l.telefone)}${l.email ? `<div class="hint">${esc(l.email)}</div>` : ''}</td>
      <td>${esc(l.servico)}</td>
      <td><span class="chip"><span class="dot" style="background:${ETAPA[l.etapa].cor}"></span>${esc(ETAPA[l.etapa].nome)}</span></td>
      <td class="r num">${l.valor ? brl(l.valor) : '—'}</td>
      <td class="num">${l.proximo_contato && ATIVAS.includes(l.etapa) ? `<span class="chip ${dueClass(l.proximo_contato)}">${esc(dueLabel(l.proximo_contato))}</span>` : '—'}</td>
      <td>${esc(nomeResp(l.responsavel)) || '—'}</td>
      <td>${esc(l.origem)}</td></tr>`).join('');
    body = `<div class="panel table-scroll"><table><thead><tr><th>Nome</th><th>Empresa</th><th>Contato</th><th>Serviço</th><th>Etapa</th><th class="r">Valor</th><th>Próx. contato</th><th>Responsável</th><th>Origem</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9" class="hint">Nada encontrado com esses filtros.</td></tr>'}</tbody></table></div>`;
  } else {
    const emp = new Map();
    lista.forEach(l => { const k = l.empresa.trim() || '(sem empresa)'; if (!emp.has(k)) emp.set(k, []); emp.get(k).push(l); });
    const rows = [...emp.entries()].sort((a,b) => a[0].localeCompare(b[0],'pt-BR')).map(([nome, ls]) => {
      const aberto = ls.filter(l => ATIVAS.includes(l.etapa)).reduce((s,l) => s + num(l.valor), 0);
      const ganho = ls.filter(l => l.etapa === 'ganho').reduce((s,l) => s + num(l.valor), 0);
      const bar = ETAPAS.map(e => { const n = ls.filter(l => l.etapa === e.id).length; return n ? `<span style="width:${n/ls.length*100}%;background:${e.cor}" title="${esc(e.nome)}: ${n}"></span>` : ''; }).join('');
      return `<tr><td><b>${esc(nome)}</b><div class="hint">${ls.map(l => `<button class="link" style="font-weight:500" data-open="${esc(l.id)}">${esc(l.nome)}</button>`).join(', ')}</div></td>
        <td class="num">${ls.length}</td><td><span class="stagebar">${bar}</span></td>
        <td class="r num">${aberto ? brl(aberto) : '—'}</td><td class="r num">${ganho ? brl(ganho) : '—'}</td>
        <td>${esc([...new Set(ls.map(l => l.cidade).filter(Boolean))].join(', '))}</td></tr>`;
    }).join('');
    body = `<div class="panel table-scroll"><table><thead><tr><th>Empresa e contatos</th><th>Leads</th><th>Etapas</th><th class="r">Em aberto</th><th class="r">Fechado</th><th>Cidade</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="hint">Nada encontrado com esses filtros.</td></tr>'}</tbody></table></div>`;
  }
  return head + `<div style="margin-top:12px">${body}</div><p class="hint" style="margin-top:8px">${lista.length} de ${all.length} leads.</p>`;
}

/* ---------- Tela: Relatórios ---------- */
function hbars(rows, fmt){
  const max = Math.max(1, ...rows.map(r => r.v));
  return `<div class="hbars">${rows.map(r => `<div class="hbar"><span class="lab" title="${esc(r.k)}">${esc(r.k)}</span><span class="track"><span class="fill" style="width:${r.v/max*100}%;${r.cor ? 'background:' + r.cor : ''}"></span></span><span class="v num">${fmt ? fmt(r) : r.v}</span></div>`).join('') || '<p class="hint">Sem dados ainda.</p>'}</div>`;
}
function viewRelatorios(){
  const all = visiveis();
  const origens = new Map();
  all.forEach(l => { const k = l.origem || 'Não informada'; const o = origens.get(k) || { k, v:0, g:0, p:0 }; o.v++; if (l.etapa === 'ganho') o.g++; if (l.etapa === 'perdido') o.p++; origens.set(k, o); });
  const porOrigem = [...origens.values()].sort((a,b) => b.v - a.v);
  const porEtapa = ETAPAS.map(e => ({ k:e.nome, v: all.filter(l => l.etapa === e.id).length, cor:e.cor }));
  const meses = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push({ key: d.getFullYear() + '-' + pad(d.getMonth()+1), lab: d.toLocaleDateString('pt-BR', { month:'short' }).replace('.', ''), v:0, n:0 }); }
  all.filter(l => l.etapa === 'ganho' && l.fechado_em).forEach(l => { const m = meses.find(x => x.key === String(l.fechado_em).slice(0,7)); if (m) { m.v += num(l.valor); m.n++; } });
  const maxM = Math.max(1, ...meses.map(m => m.v));
  const motivos = new Map();
  all.filter(l => l.etapa === 'perdido').forEach(l => { const k = (l.motivo_perda || 'Sem motivo informado').trim(); motivos.set(k, (motivos.get(k) || 0) + 1); });
  const total = all.length || 1;
  const servicos = new Map();
  all.filter(l => l.etapa === 'ganho').forEach(l => { const k = l.servico || 'Não informado'; servicos.set(k, (servicos.get(k) || 0) + num(l.valor)); });
  return `<div class="bar"><h1>Relatórios</h1>${filtroBar()}</div>
  <div class="reports" style="margin-top:12px">
    <div class="panel rep" style="grid-column:1/-1"><h2>Valor fechado por mês</h2><p class="sub">Últimos 6 meses, pela data de fechamento.</p>
      <div class="vbars">${meses.map((m,i) => `<div class="vbar ${i === 5 ? 'cur' : ''}"><span class="v num">${m.v ? brlShort(m.v) : ''}</span><span class="col-fill" style="height:${m.v ? Math.max(2, m.v/maxM*80) : 0}%" title="${esc(brl(m.v))} · ${m.n} contratos"></span></div>`).join('')}</div>
      <div class="vlabels">${meses.map(m => `<span>${esc(m.lab)}<br><span class="num">${m.n} ${m.n === 1 ? 'contrato' : 'contratos'}</span></span>`).join('')}</div></div>
    <div class="panel rep"><h2>Leads por origem</h2><p class="sub">Quantidade de leads e conversão (fechados ÷ fechados + perdidos).</p>
      ${hbars(porOrigem, r => r.v + (r.g + r.p ? ' · ' + Math.round(r.g/(r.g+r.p)*100) + '%' : ''))}</div>
    <div class="panel rep"><h2>Leads por etapa</h2><p class="sub">Onde estão os leads agora e a fatia de cada etapa no total.</p>
      ${hbars(porEtapa, r => r.v + ' · ' + Math.round(r.v/total*100) + '%')}</div>
    <div class="panel rep"><h2>Faturamento por serviço</h2><p class="sub">Soma dos contratos fechados.</p>
      ${hbars([...servicos].map(([k,v]) => ({k,v})).sort((a,b) => b.v - a.v), r => brlShort(r.v))}</div>
    <div class="panel rep"><h2>Motivos de perda</h2><p class="sub">Para saber o que ajustar na proposta.</p>
      ${hbars([...motivos].map(([k,v]) => ({k,v})).sort((a,b) => b.v - a.v).slice(0,8))}</div>
  </div>`;
}

/* ---------- Tela: Equipe (admin) ---------- */
let convites = null;
async function loadConvites(){ const { data, error } = await sb.from('convites').select('*').order('criado_em', { ascending:false }); convites = error ? [] : data; if (S.view === 'equipe') render(); }
function viewEquipe(){
  if (convites === null) loadConvites();
  const pessoas = [...S.perfis.values()].sort((a,b) => (a.ativo === b.ativo ? a.nome.localeCompare(b.nome,'pt-BR') : a.ativo ? 1 : -1));
  const rows = pessoas.map(p => {
    const n = [...S.leads.values()].filter(l => l.responsavel === p.id && ATIVAS.includes(l.etapa)).length;
    return `<tr><td><b>${esc(p.nome)}</b>${p.id === S.me.id ? ' <span class="chip">você</span>' : ''}<div class="hint">${esc(p.email)}</div></td>
      <td><select class="field" data-papel="${esc(p.id)}" aria-label="Papel de ${esc(p.nome)}"><option value="vendedor" ${p.papel === 'vendedor' ? 'selected' : ''}>Vendedor</option><option value="admin" ${p.papel === 'admin' ? 'selected' : ''}>Admin</option></select></td>
      <td>${p.ativo ? '<span class="chip ok">Ativo</span>' : '<span class="chip today">Aguardando liberação</span>'}</td>
      <td class="num">${n}</td>
      <td class="r">${p.ativo ? (p.id === S.me.id ? '' : `<button class="btn btn-sm btn-ghost" data-ativo="${esc(p.id)}" data-v="0">Bloquear acesso</button>`) : `<button class="btn btn-sm btn-primary" data-ativo="${esc(p.id)}" data-v="1">Liberar acesso</button>`}</td></tr>`;
  }).join('');
  return `<div class="bar"><h1>Equipe</h1><span class="hint">Admin vê e edita tudo, exclui leads e gerencia a equipe. Vendedor vê e edita todos os leads.</span></div>
  <div class="team-grid" style="margin-top:12px">
    <div class="panel table-scroll"><table style="min-width:640px"><thead><tr><th>Pessoa</th><th>Papel</th><th>Acesso</th><th>Leads ativos</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="panel inv"><h2>Convidar pessoa</h2>
      <p class="hint" style="margin:0">Cadastre o e-mail aqui. Depois a pessoa abre o CRM, clica em “Criar conta” e usa esse mesmo e-mail. O acesso é liberado na hora.</p>
      <form id="f-convite" class="stack" style="gap:8px">
        <div class="fl"><label for="c-email">E-mail</label><input class="field" id="c-email" type="email" required placeholder="nome@empresa.com"></div>
        <div class="fl"><label for="c-papel">Papel</label><select class="field" id="c-papel"><option value="vendedor">Vendedor</option><option value="admin">Admin</option></select></div>
        <button class="btn btn-primary" style="justify-content:center">Adicionar convite</button></form>
      <p class="sec-t" style="margin-top:6px">Convites pendentes</p>
      ${convites === null ? '<p class="hint">Carregando…</p>' : convites.length ? `<ul>${convites.map(c => `<li><span>${esc(c.email)} · ${c.papel === 'admin' ? 'Admin' : 'Vendedor'}</span><button class="btn btn-sm btn-ghost" data-desconvidar="${esc(c.email)}">Remover</button></li>`).join('')}</ul>` : '<p class="hint" style="margin:0">Nenhum convite pendente.</p>'}
    </div></div>`;
}

/* ---------- Painel do lead ---------- */
function blankLead(){ return { nome:'', empresa:'', cargo:'', telefone:'', email:'', instagram:'', cidade:'Belo Horizonte', origem:'', servico:'', valor:0, etapa:'novo', proximo_contato: addDays(today(),1), proxima_acao:'Primeiro contato por WhatsApp', motivo_perda:'', responsavel: S.me.id }; }

function openLead(id, opts){
  S.openId = id; S.draftNew = false; S._armDel = false; S.notas = []; S.notasLoading = true;
  S.callout = (opts && opts.callout) || ''; S.focusField = (opts && opts.focus) || '';
  renderDrawer(); loadNotas(id);
}
function newLead(){ S.draft = blankLead(); S.openId = 'novo'; S.draftNew = true; S.callout = ''; S.focusField = 'f-nome'; renderDrawer(); }
function closeDrawer(){ S.openId = null; S.draftNew = false; S._armDel = false; $('#drawer-slot').innerHTML = ''; }

function renderDrawer(){
  const slot = $('#drawer-slot');
  if (!S.openId) { slot.innerHTML = ''; return; }
  const l = S.draftNew ? S.draft : S.leads.get(S.openId);
  if (!l) { closeDrawer(); return; }
  const opt = (arr, v) => `<option value="">Selecione…</option>` + arr.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('') + (v && !arr.includes(v) ? `<option selected>${esc(v)}</option>` : '');
  const resp = `<option value="">Ninguém</option>` + membrosAtivos().map(p => `<option value="${esc(p.id)}" ${l.responsavel === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');
  const insta = String(l.instagram || '').replace(/^@|.*instagram\.com\//i,'').replace(/[/?].*/,'');
  slot.innerHTML = `<div class="scrim" data-close></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="d-title">
    <div class="d-h"><h2 id="d-title">${S.draftNew ? 'Novo lead' : esc(l.nome)}</h2><button class="x" data-close aria-label="Fechar">×</button></div>
    <div class="d-b">
      ${S.callout ? `<div class="callout" role="status">${esc(S.callout)}</div>` : ''}
      ${S.draftNew ? '' : `<div class="quick">
        ${l.telefone ? `<a class="btn btn-sm" href="${esc(waLink(l.telefone))}" target="_blank" rel="noopener">Abrir WhatsApp</a><button class="btn btn-sm" data-copy="${esc(l.telefone)}">Copiar telefone</button>` : ''}
        ${l.email ? `<button class="btn btn-sm" data-copy="${esc(l.email)}">Copiar e-mail</button>` : ''}
        ${insta ? `<a class="btn btn-sm" href="https://www.instagram.com/${esc(encodeURIComponent(insta))}/" target="_blank" rel="noopener">Instagram</a>` : ''}
        <span class="hint">Criado em ${fmtStamp(l.criado_em)}${l.criado_por && nomeResp(l.criado_por) ? ' por ' + esc(nomeResp(l.criado_por)) : ''}</span></div>`}
      <div><p class="sec-t">Etapa</p><div class="stages">${ETAPAS.map(e => `<button type="button" data-stage="${e.id}" aria-pressed="${l.etapa === e.id}"><span class="dot" style="background:${e.cor}"></span>${esc(e.nome)}</button>`).join('')}</div></div>
      <form id="lead-form" class="grid2" autocomplete="off" novalidate>
        <p class="sec-t fl full">Contato</p>
        <div class="fl"><label for="f-nome">Nome *</label><input class="field" id="f-nome" maxlength="200" value="${esc(l.nome)}"></div>
        <div class="fl"><label for="f-empresa">Empresa</label><input class="field" id="f-empresa" maxlength="200" list="empresas-list" value="${esc(l.empresa)}"></div>
        <div class="fl"><label for="f-cargo">Cargo</label><input class="field" id="f-cargo" maxlength="120" value="${esc(l.cargo)}"></div>
        <div class="fl"><label for="f-telefone">WhatsApp / telefone</label><input class="field" id="f-telefone" maxlength="40" inputmode="tel" placeholder="(31) 9…" value="${esc(l.telefone)}"></div>
        <div class="fl"><label for="f-email">E-mail</label><input class="field" id="f-email" maxlength="200" type="email" value="${esc(l.email)}"></div>
        <div class="fl"><label for="f-instagram">Instagram</label><input class="field" id="f-instagram" maxlength="120" placeholder="@perfil" value="${esc(l.instagram)}"></div>
        <div class="fl"><label for="f-cidade">Cidade</label><input class="field" id="f-cidade" maxlength="120" value="${esc(l.cidade)}"></div>
        <div class="fl"><label for="f-origem">Como chegou</label><select class="field" id="f-origem">${opt(ORIGENS, l.origem)}</select></div>
        <p class="sec-t fl full" style="margin-top:8px">Oportunidade</p>
        <div class="fl"><label for="f-servico">Serviço de interesse</label><select class="field" id="f-servico">${opt(SERVICOS, l.servico)}</select></div>
        <div class="fl"><label for="f-valor">Valor estimado (R$)</label><input class="field num" id="f-valor" inputmode="decimal" placeholder="0,00" value="${l.valor ? esc(num(l.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})) : ''}"></div>
        <div class="fl"><label for="f-data">Próximo contato</label><input class="field" id="f-data" type="date" value="${esc(l.proximo_contato || '')}"></div>
        <div class="fl"><label for="f-acao">Próxima ação</label><input class="field" id="f-acao" maxlength="300" placeholder="Ex.: enviar proposta" value="${esc(l.proxima_acao)}"></div>
        <div class="fl"><label for="f-resp">Responsável</label><select class="field" id="f-resp">${resp}</select></div>
        <div class="fl">${l.etapa === 'ganho' && l.fechado_em ? `<label>Fechado em</label><span class="field" style="border-style:dashed">${fmtDay(l.fechado_em)}</span>` : ''}</div>
        <div class="fl full" ${l.etapa === 'perdido' ? '' : 'hidden'}><label for="f-perda">Motivo da perda</label><input class="field" id="f-perda" maxlength="300" list="motivos-list" placeholder="Ex.: preço, momento, foi com concorrente" value="${esc(l.motivo_perda)}"></div>
        <datalist id="empresas-list">${[...new Set([...S.leads.values()].map(x => x.empresa).filter(Boolean))].map(e => `<option value="${esc(e)}">`).join('')}</datalist>
        <datalist id="motivos-list">${['Preço','Momento / sem urgência','Foi com concorrente','Sem resposta','Sem orçamento','Escopo não atende'].map(e => `<option value="${esc(e)}">`).join('')}</datalist>
      </form>
      ${S.draftNew ? `<div class="fl"><label for="f-nota">Primeira anotação (opcional)</label><textarea class="field" id="f-nota" maxlength="5000" placeholder="O que a pessoa precisa, contexto da conversa…"></textarea></div>` : `
      <div class="stack" style="gap:10px">
        <p class="sec-t">Histórico e anotações</p>
        <div class="fl"><label for="f-nota">Nova anotação</label><textarea class="field" id="f-nota" maxlength="5000" placeholder="Resumo da ligação, objeções, combinados…"></textarea></div>
        <div><button class="btn btn-sm btn-dark" data-act="nota">Adicionar anotação</button></div>
        <div class="notes" id="notes-list"></div>
      </div>`}
    </div>
    <div class="d-f">
      ${!S.draftNew && S.me.papel === 'admin' ? `<button class="btn btn-danger ${S._armDel ? 'armed' : ''}" data-act="excluir">${S._armDel ? 'Confirmar exclusão' : 'Excluir lead'}</button>` : ''}
      <span class="sp"></span>
      <button class="btn btn-ghost" data-close>Cancelar</button>
      <button class="btn btn-primary" data-act="salvar" id="btn-salvar">${S.draftNew ? 'Criar lead' : 'Salvar'}</button>
    </div>
  </aside>`;
  renderNotas();
  const f = S.focusField && $('#' + S.focusField);
  if (f) setTimeout(() => f.focus(), 30); else setTimeout(() => $('.drawer .x') && $('.drawer .x').focus(), 30);
  S.focusField = '';
}
function renderNotas(){
  const box = $('#notes-list'); if (!box) return;
  if (S.notasLoading && !S.notas.length) { box.innerHTML = '<p class="hint" style="padding-left:14px">Carregando histórico…</p>'; return; }
  box.innerHTML = S.notas.map(n => `<div class="note ${n.sistema ? 'sys' : ''}"><span class="meta">${fmtStamp(n.criado_em)}${n.autor && nomeResp(n.autor) ? ' · ' + esc(nomeResp(n.autor)) : ''}</span><p>${esc(n.texto)}</p></div>`).join('') || '<p class="hint" style="padding-left:14px">Ainda sem anotações.</p>';
}
function readForm(){
  const v = id => ($('#' + id) ? $('#' + id).value : '').trim();
  return { nome:v('f-nome'), empresa:v('f-empresa'), cargo:v('f-cargo'), telefone:v('f-telefone'), email:v('f-email').toLowerCase(), instagram:v('f-instagram'), cidade:v('f-cidade'),
    origem:v('f-origem'), servico:v('f-servico'), valor:parseMoney(v('f-valor')), proximo_contato:v('f-data') || null, proxima_acao:v('f-acao'), motivo_perda:v('f-perda'), responsavel:v('f-resp') || null };
}
let saving = false;
async function saveDrawer(extra){
  if (saving) return;
  const form = readForm();
  if (!form.nome) { toast('Preencha o nome do lead.', true); $('#f-nome').focus(); return; }
  const nota = ($('#f-nota') ? $('#f-nota').value : '').trim();
  saving = true; const btn = $('#btn-salvar'); if (btn) btn.disabled = true;
  try {
    if (S.draftNew) {
      const created = await createLead({ ...form, etapa: S.draft.etapa, ...(extra || {}) });
      if (!created) return;
      if (nota) await addNota(created.id, nota);
      toast('Lead criado.'); closeDrawer();
    } else {
      const id = S.openId;
      const saved = await patchLead(id, { ...form, ...(extra || {}) });
      if (!saved) return;
      if (nota) await addNota(id, nota);
      if (extra && extra.etapa) {
        if (extra.etapa === 'perdido' && !form.motivo_perda) { S.callout = 'Lead marcado como perdido. Conte o motivo da perda e salve.'; S.focusField = 'f-perda'; renderDrawer(); loadNotas(id); return; }
        S.callout = ''; renderDrawer(); loadNotas(id); toast('Etapa: ' + ETAPA[extra.etapa].nome + '.'); return;
      }
      toast('Salvo.'); closeDrawer();
    }
  } finally { saving = false; const b = $('#btn-salvar'); if (b) b.disabled = false; }
}

/* ---------- CSV ---------- */
function parseCSV(text){
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ((first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
const normH = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z]/g,'');
function csvToLeads(text){
  const rows = parseCSV(text.replace(/^﻿/, ''));
  if (rows.length < 2) return [];
  const h = rows[0].map(normH);
  const find = (...keys) => h.findIndex(x => keys.some(k => x === k || x.includes(k)));
  const idx = { nome:find('nome','name'), empresa:find('empresa','company'), cargo:find('cargo'), email:find('email'), telefone:find('whatsapp','telefone','celular','fone','phone'),
    servico:find('servicorecomendado','servico','interesse','desafio'), cidade:find('cidade'), origem:find('origem'), instagram:find('instagram'), valor:find('valor'), obs:find('obs','mensagem','diagnostico','resumo','anotac') };
  if (idx.nome < 0) idx.nome = 0;
  const cut = (s, n) => String(s || '').trim().slice(0, n);
  return rows.slice(1).map(r => {
    const g = k => idx[k] >= 0 ? (r[idx[k]] || '').trim() : '';
    if (!g('nome') && !g('email') && !g('telefone')) return null;
    return { lead: { nome:cut(g('nome') || g('email') || g('telefone'), 200), empresa:cut(g('empresa'),200), cargo:cut(g('cargo'),120), email:cut(g('email').toLowerCase(),200), telefone:cut(g('telefone'),40),
      servico:cut(g('servico'),120), cidade:cut(g('cidade') || 'Belo Horizonte',120), origem:cut(g('origem') || 'Site (diagnóstico)',60), instagram:cut(g('instagram'),120), valor:parseMoney(g('valor')),
      etapa:'novo', proximo_contato: today(), proxima_acao:'Primeiro contato' }, obs: g('obs') };
  }).filter(Boolean);
}
async function importar(rows){
  let ok = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    const { data, error } = await sb.from('leads').insert(part.map(r => r.lead)).select('id');
    if (error) { toast(`Importei ${ok} de ${rows.length}. Parou por causa de: ${errMsg(error)}`, true); await loadAll(); return; }
    ok += data.length;
    const notas = [];
    data.forEach((d, j) => { notas.push({ lead_id:d.id, autor:S.me.id, texto:'Importado de CSV' + (part[j].obs ? ': ' + part[j].obs : '') }); });
    if (notas.length) await sb.from('notas').insert(notas);
  }
  await loadAll();
  toast(ok + ' leads importados.');
}
function exportar(){
  const cols = [['nome','Nome'],['empresa','Empresa'],['cargo','Cargo'],['telefone','Telefone'],['email','E-mail'],['instagram','Instagram'],['cidade','Cidade'],['origem','Origem'],['servico','Serviço'],['etapa','Etapa'],['valor','Valor'],['proximo_contato','Próximo contato'],['proxima_acao','Próxima ação'],['motivo_perda','Motivo da perda'],['fechado_em','Fechado em'],['responsavel','Responsável'],['criado_em','Criado em']];
  const q = v => '"' + String(v ?? '').replace(/"/g,'""') + '"';
  const val = (l, k) => k === 'etapa' ? ETAPA[l.etapa].nome : k === 'valor' ? String(num(l.valor)).replace('.', ',') : k === 'responsavel' ? nomeResp(l.responsavel) : (k === 'proximo_contato' || k === 'fechado_em') ? fmtDay(l[k]) : k === 'criado_em' ? fmtStamp(l.criado_em) : l[k];
  const lines = [cols.map(c => q(c[1])).join(';')].concat(visiveis().map(l => cols.map(([k]) => q(val(l, k))).join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'leads-next-step-' + today() + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- Senha (logado) ---------- */
function openSenha(){
  S.openId = null;
  $('#drawer-slot').innerHTML = `<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="s-title" style="width:min(420px,100%)">
    <div class="d-h"><h2 id="s-title">Alterar minha senha</h2><button class="x" data-close aria-label="Fechar">×</button></div>
    <form class="d-b" id="f-senha"><div class="fl"><label for="s-nova">Nova senha (mínimo 6 caracteres)</label><input class="field" id="s-nova" type="password" minlength="6" autocomplete="new-password" required></div>
    <div><button class="btn btn-primary">Salvar senha</button></div></form></aside>`;
  setTimeout(() => $('#s-nova').focus(), 30);
}

/* ---------- Eventos ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button, a, .card, [data-close]');
  if (S.menuOpen && !(t && (t.id === 'me-btn' || t.closest('#menu')))) { S.menuOpen = false; render(); }
  if (!t) return;
  if (t.dataset.auth) { S.authMode = t.dataset.auth; S.authMsg = null; render(); return; }
  if (t.matches('.tab')) { S.view = t.dataset.view; lsSet('crm-view', S.view); history.replaceState(null, '', '#' + S.view); render(); return; }
  if (t.dataset.goto) { S.view = t.dataset.goto; history.replaceState(null, '', '#' + S.view); render(); return; }
  if (t.dataset.adv) { e.stopPropagation(); moveStage(t.dataset.adv, t.dataset.to); return; }
  if (t.classList.contains('card')) { openLead(t.dataset.id); return; }
  if (t.dataset.open) { openLead(t.dataset.open); return; }
  if (t.hasAttribute('data-close')) { closeDrawer(); return; }
  if (t.dataset.modo) { S.contatosModo = t.dataset.modo; render(); return; }
  if (t.dataset.snooze) {
    const l = S.leads.get(t.dataset.snooze);
    const base = l.proximo_contato && diffDays(l.proximo_contato) > 0 ? l.proximo_contato : today();
    const nova = addDays(base, Number(t.dataset.days));
    if (await patchLead(l.id, { proximo_contato: nova })) toast('Adiado para ' + fmtDay(nova) + '.');
    return;
  }
  if (t.dataset.done) {
    const l = S.leads.get(t.dataset.done);
    t.disabled = true;
    if (!(await addNota(l.id, 'Follow-up feito' + (l.proxima_acao ? ': ' + l.proxima_acao : '')))) { t.disabled = false; return; }
    await patchLead(l.id, { proximo_contato: null, proxima_acao: '' });
    openLead(l.id, { callout:'Contato registrado. Marque a data e a ação do próximo contato e salve.', focus:'f-data' });
    return;
  }
  if (t.dataset.copy) { const v = t.dataset.copy; try { await navigator.clipboard.writeText(v); toast('Copiado: ' + v); } catch (_) { toast(v); } return; }
  if (t.dataset.stage) {
    if (S.draftNew) { const nota = $('#f-nota') ? $('#f-nota').value : ''; S.draft = { ...S.draft, ...readForm(), etapa: t.dataset.stage }; renderDrawer(); if ($('#f-nota')) $('#f-nota').value = nota; return; }
    saveDrawer({ etapa: t.dataset.stage }); return;
  }
  if (t.dataset.ativo) {
    const { data, error } = await sb.from('perfis').update({ ativo: t.dataset.v === '1' }).eq('id', t.dataset.ativo).select().maybeSingle();
    if (error || !data) toast('Não foi possível alterar. ' + errMsg(error || ''), true); else { S.perfis.set(data.id, data); toast(data.ativo ? 'Acesso liberado para ' + data.nome + '.' : 'Acesso bloqueado.'); render(); }
    return;
  }
  if (t.dataset.desconvidar) { const { error } = await sb.from('convites').delete().eq('email', t.dataset.desconvidar); if (error) toast(errMsg(error), true); loadConvites(); return; }
  const act = t.dataset.act;
  if (act === 'novo') { newLead(); return; }
  if (act === 'menu') { S.menuOpen = !S.menuOpen; render(); return; }
  if (act === 'sair') { S.menuOpen = false; await sb.auth.signOut(); return; }
  if (act === 'senha') { S.menuOpen = false; render(); openSenha(); return; }
  if (act === 'verificar') { handleSession(S.session); return; }
  if (act === 'recarregar') { S.loaded = false; render(); loadAll(); return; }
  if (act === 'salvar') { saveDrawer(); return; }
  if (act === 'nota') {
    const txt = ($('#f-nota').value || '').trim(); if (!txt) { $('#f-nota').focus(); return; }
    t.disabled = true;
    if (await addNota(S.openId, txt)) { $('#f-nota').value = ''; loadNotas(S.openId); }
    t.disabled = false; return;
  }
  if (act === 'excluir') {
    if (!S._armDel) { S._armDel = true; t.classList.add('armed'); t.textContent = 'Confirmar exclusão'; setTimeout(() => { S._armDel = false; if (t.isConnected) { t.classList.remove('armed'); t.textContent = 'Excluir lead'; } }, 4000); return; }
    const id = S.openId;
    const { data, error } = await sb.from('leads').delete().eq('id', id).select('id');
    if (error || !data.length) { toast(error ? 'Não foi excluído. ' + errMsg(error) : 'Só o admin pode excluir leads.', true); return; }
    S.leads.delete(id); closeDrawer(); render(); toast('Lead excluído.'); return;
  }
  if (act === 'import') { $('#csv-file').click(); return; }
  if (act === 'import-cancel') { S.importRows = null; render(); return; }
  if (act === 'import-ok') { const rows = S.importRows; S.importRows = null; render(); toast('Importando ' + rows.length + ' leads…'); await importar(rows); S.view = 'funil'; render(); return; }
  if (act === 'export') { exportar(); return; }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.menuOpen) { S.menuOpen = false; render(); } else if ($('#drawer-slot').innerHTML) closeDrawer(); }
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.closest('#lead-form')) { e.preventDefault(); saveDrawer(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('card')) { e.preventDefault(); openLead(e.target.dataset.id); }
});
document.addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; render(); } });
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'flt-etapa') { S.etapaFiltro = t.value; render(); }
  if (t.id === 'flt-resp') { S.respFiltro = t.value; render(); }
  if (t.id === 'f-meus') { S.meus = t.checked; lsSet('crm-meus', S.meus ? '1' : '0'); render(); }
  if (t.dataset.papel) {
    const { data, error } = await sb.from('perfis').update({ papel: t.value }).eq('id', t.dataset.papel).select().maybeSingle();
    if (error || !data) { toast('Não foi possível alterar. ' + errMsg(error || ''), true); render(); }
    else { S.perfis.set(data.id, data); if (data.id === S.me.id) S.me = data; toast('Papel atualizado.'); render(); }
  }
  if (t.id === 'csv-file') {
    const f = t.files[0]; t.value = ''; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let text = String(r.result);
      if (text.includes('�')) { const r2 = new FileReader(); r2.onload = () => prep(String(r2.result)); r2.readAsText(f, 'windows-1252'); return; }
      prep(text);
    };
    const prep = text => { const rows = csvToLeads(text); if (!rows.length) { toast('Não encontrei leads nesse arquivo. Confira se a primeira linha tem os nomes das colunas (nome, empresa, email, whatsapp…).', true); return; } S.importRows = rows; render(); window.scrollTo({ top:0, behavior:'smooth' }); };
    r.readAsText(f, 'utf-8');
  }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'lead-form') { saveDrawer(); return; }
  if (f.id === 'f-convite') {
    const email = $('#c-email').value.trim().toLowerCase();
    if (!email) return;
    const { error } = await sb.from('convites').upsert({ email, papel: $('#c-papel').value });
    if (error) { toast(errMsg(error), true); return; }
    toast('Convite salvo. Peça para ' + email + ' criar a conta no CRM.'); loadConvites(); return;
  }
  if (f.id === 'f-senha') {
    const { error } = await sb.auth.updateUser({ password: $('#s-nova').value });
    if (error) { toast(errMsg(error), true); return; }
    closeDrawer(); toast('Senha alterada.'); return;
  }
  if (f.id === 'f-auth') {
    const mode = f.dataset.mode, email = ($('#a-email') ? $('#a-email').value : '').trim().toLowerCase(), senha = $('#a-senha') ? $('#a-senha').value : '';
    const nome = $('#a-nome') ? $('#a-nome').value.trim() : '';
    if (mode === 'signup' && !nome) { S.authMsg = { ok:false, text:'Preencha seu nome.' }; render(); $('#a-email').value = email; return; }
    S.authBusy = true; S.authMsg = null;
    f.querySelectorAll('button').forEach(b => b.disabled = true);
    let res;
    try {
      if (mode === 'login') res = await sb.auth.signInWithPassword({ email, password: senha });
      else if (mode === 'signup') {
        res = await sb.auth.signUp({ email, password: senha, options: { data: { nome }, emailRedirectTo: location.origin + location.pathname } });
        if (!res.error && !res.data.session) S.authMsg = { ok:true, text:'Conta criada. Enviamos um link de confirmação para ' + email + '. Clique nele e depois entre aqui.' };
      }
      else if (mode === 'forgot') {
        res = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (!res.error) S.authMsg = { ok:true, text:'Se esse e-mail tiver conta, você vai receber um link para criar a senha nova.' };
      }
      else if (mode === 'reset') {
        res = await sb.auth.updateUser({ password: senha });
        if (!res.error) { S.authMode = 'login'; S.authBusy = false; toast('Senha alterada.'); const { data } = await sb.auth.getSession(); handleSession(data.session); return; }
      }
      if (res && res.error) S.authMsg = { ok:false, text: errMsg(res.error) };
    } catch (err) { S.authMsg = { ok:false, text: errMsg(err) }; }
    S.authBusy = false;
    if (!S.session || S.authMode === 'reset') {
      render();
      const em = $('#a-email'); if (em && email) em.value = email;
      const nm = $('#a-nome'); if (nm && nome) nm.value = nome;
    }
  }
});

/* Arrastar e soltar */
let dragId = null;
document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.card'); if (!c) return; dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (_) {} });
document.addEventListener('dragend', e => { const c = e.target.closest && e.target.closest('.card'); if (c) c.classList.remove('dragging'); document.querySelectorAll('.col.over').forEach(x => x.classList.remove('over')); dragId = null; });
document.addEventListener('dragover', e => {
  const sc = dragId && document.querySelector('.board-scroll');
  if (sc) { const r = sc.getBoundingClientRect(); if (e.clientX > r.right - 70) sc.scrollLeft += 18; else if (e.clientX < r.left + 70) sc.scrollLeft -= 18; }
  const col = e.target.closest && e.target.closest('.col'); if (!col || !dragId) return; e.preventDefault(); document.querySelectorAll('.col.over').forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over'); });
document.addEventListener('drop', e => { const col = e.target.closest && e.target.closest('.col'); if (!col || !dragId) return; e.preventDefault(); col.classList.remove('over'); const id = dragId; dragId = null; moveStage(id, col.dataset.col); });

/* ---------- Início ---------- */
if (!sb) { render(); return; }
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') { S.authMode = 'reset'; S.session = session; render(); return; }
  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') { S.session = session; return; }
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
    if (event === 'SIGNED_IN' && S.session && session && S.session.user.id === session.user.id && S.me) { S.session = session; return; }
    setTimeout(() => handleSession(session), 0);
  }
});
})();
