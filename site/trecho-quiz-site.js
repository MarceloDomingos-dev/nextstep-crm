/*
 * Next Step · envio dos leads do quiz do site direto para o CRM
 * ---------------------------------------------------------------
 * Onde colar: no index.html do site (repositório NextStep), dentro do <script> principal.
 *
 * 1) No objeto CONFIG do site, junto de LEAD_WEBHOOK_URL, adicione as duas linhas:
 *
 *      CRM_SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
 *      CRM_SUPABASE_ANON_KEY: 'SUA-CHAVE-ANON-PUBLIC',
 *
 *    (são os mesmos valores do arquivo js/config.js do CRM)
 *
 * 2) Cole a função sendLeadCRM abaixo logo ANTES da linha "const PENDING_KEY = 'ns_leads_pendentes';"
 *
 * 3) Substitua a função sendLead inteira do site por esta versão, que manda para o CRM
 *    e também para a planilha (se a planilha estiver configurada):
 *
 *      async function sendLead(payload) {
 *        const [crm, planilha] = await Promise.all([sendLeadCRM(payload), sendLeadPlanilha(payload)]);
 *        return crm || planilha;
 *      }
 *
 *    e renomeie a função sendLead antiga para sendLeadPlanilha.
 *
 * 4) Em submitLead e retryPendingLeads, troque as verificações "!CONFIG.LEAD_WEBHOOK_URL" por
 *    "!CONFIG.LEAD_WEBHOOK_URL && !CONFIG.CRM_SUPABASE_URL", para o envio funcionar mesmo sem a planilha.
 */

async function sendLeadCRM(payload) {
  if (!CONFIG.CRM_SUPABASE_URL || !CONFIG.CRM_SUPABASE_ANON_KEY) return false;
  const linhas = [
    ['Desafio', payload.desafio], ['Situação', payload.situacao], ['Há quanto tempo', payload.tempo_problema],
    ['Porte', payload.porte], ['Faturamento', payload.faturamento], ['Já tentou', payload.tentativas], ['Prazo', payload.prazo],
    ['Serviço recomendado', payload.servico_recomendado], ['Interesse', payload.interesse],
    ['Classificação', payload.classificacao ? payload.classificacao + ' (' + payload.pontuacao + ' pts)' : ''],
    ['Ganho estimado', payload.ganho_estimado_rs ? 'R$ ' + Number(payload.ganho_estimado_rs).toLocaleString('pt-BR') + ' (' + payload.ganho_estimado_pct + '%)' : ''],
    ['Cargo', payload.cargo], ['Site/Instagram', payload.site_instagram], ['Botão', payload.botao_origem],
    ['Campanha', [payload.utm_source, payload.utm_medium, payload.utm_campaign].filter(Boolean).join(' / ')],
    ['Dispositivo', payload.dispositivo], ['Enviado em', payload.data_hora]
  ].filter(([, v]) => v);
  const corpo = {
    p_nome: payload.nome,
    p_empresa: payload.empresa || '',
    p_telefone: payload.whatsapp || '',
    p_email: payload.email || '',
    p_servico: payload.servico_recomendado || '',
    p_cidade: payload.cidade_uf || '',
    p_respostas: 'Respostas do diagnóstico do site\n' + linhas.map(([k, v]) => k + ': ' + v).join('\n'),
    p_site: payload.honeypot || ''   // campo invisível anti-robô (deixe vazio)
  };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(CONFIG.CRM_SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/registrar_lead_site', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.CRM_SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + CONFIG.CRM_SUPABASE_ANON_KEY
      },
      body: JSON.stringify(corpo),
      signal: ctrl.signal
    });
    return res.ok;
  } catch (e) { return false; } finally { clearTimeout(t); }
}
