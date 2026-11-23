// Ficha SOMENTE LEITURA aberta pelo QR do PDF (mulher.html?t=TOKEN): dados da mulher + todas as ocorrências.
// Nada é editável aqui. O banco só devolve a ficha DAQUELE token (função pms_mulher_publica).
import {rpc} from './public-client.js?v=4b46995c';

const app = document.getElementById('app');
const t = new URLSearchParams(location.search).get('t') || '';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dBR = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || ''); };
const fmt = v => Array.isArray(v) ? v.join(', ') : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dBR(v) : String(v);
const ORDEM = ['Nome social', 'Data de nascimento', 'CPF', 'RG', 'NIS', 'Raça / cor', 'Estado civil', 'Escolaridade', 'Pessoa com deficiência', 'Qual deficiência', 'Telefone', 'Contato de confiança', 'Endereço', 'Bairro / localidade', 'Zona', 'Ponto de referência', 'Ocupação / trabalho', 'Renda familiar', 'Benefícios', 'Número de filhos', 'Filhos menores de 18', 'Mora com', 'Situação do acompanhamento', 'Tipos de violência', 'Medida protetiva', 'Relação com o autor', 'Encaminhamentos', 'Técnica de referência'];
const ICO = {Atendimento: '🗣️', Acolhimento: '🤝', 'Visita domiciliar': '🏠', Encaminhamento: '➡️', 'Medida protetiva': '🛡️', 'Boletim de ocorrência': '📋', Retorno: '🔁'};
const idade = n => { const m = String(n || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return null; const h = new Date(), d = new Date(+m[1], +m[2] - 1, +m[3]); let a = h.getFullYear() - d.getFullYear(); if (h < new Date(h.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };

function pedirPin(errado) {
  return new Promise(resolve => {
    app.innerHTML = `<section class="mp-end mp-pin"><span aria-hidden="true">🔒</span><h1>Digite o PIN</h1><p>Esta ficha é protegida. A equipe da Secretaria da Mulher informou um PIN de 4 números.</p>
      <form id="mp-pin-form" autocomplete="off"><input id="mp-pin" inputmode="numeric" maxlength="4" placeholder="••••" aria-label="PIN de 4 números" class="${errado ? 'is-bad' : ''}"><button type="submit">Abrir</button></form>
      ${errado ? '<p class="mp-pin-bad" role="alert">PIN incorreto. Confira e tente de novo.</p>' : ''}</section>`;
    const inp = document.getElementById('mp-pin'); inp.focus();
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 4); });
    document.getElementById('mp-pin-form').addEventListener('submit', e => { e.preventDefault(); if (inp.value.length === 4) resolve(inp.value); });
  });
}

function end(ico, title, text) { app.innerHTML = `<section class="mp-end"><span aria-hidden="true">${ico}</span><h1>${title}</h1><p>${text}</p><img src="img/logo_sertania.png" alt="Prefeitura de Sertânia" class="mp-logo"></section>`; }

(async () => {
  if (!t) return end('🔎', 'Ficha não encontrada', 'O endereço está incompleto. Escaneie o QR do documento novamente.');
  let d, pin = '';
  const abrir = async () => { try { d = await rpc('pms_mulher_publica', {p_token: t, p_pin: pin || null}); } catch { d = {ok: false, motivo: 'rede'}; } };
  await abrir();
  while (d && !d.ok && (d.motivo === 'pin' || d.motivo === 'pin_errado')) {
    pin = await pedirPin(d.motivo === 'pin_errado'); await abrir();
  }
  if (d?.motivo === 'rede') return end('📶', 'Sem conexão', 'Não foi possível abrir agora. Verifique a internet e tente de novo.');
  if (d?.motivo === 'expirado') return end('⏳', 'Este link expirou', 'O prazo deste link terminou. Peça um novo link à Secretaria da Mulher.');
  if (d?.motivo === 'bloqueado') return end('🔒', 'Link bloqueado', 'O PIN foi digitado errado muitas vezes e o link foi bloqueado por segurança.');
  if (d?.motivo === 'revogado') return end('⛔', 'Link encerrado', 'Este link foi encerrado pela Secretaria da Mulher.');
  if (!d?.ok) return end('🔎', 'Ficha não encontrada', 'Este QR não corresponde a nenhuma ficha ativa. Ele pode ter sido substituído por um documento mais novo.');
  const f = d.ficha, c = f.campos || {}, a = idade(c['Data de nascimento']), oc = d.ocorrencias || [];
  const keys = [...ORDEM.filter(k => c[k] != null && String(c[k]).trim() && !(Array.isArray(c[k]) && !c[k].length)), ...Object.keys(c).filter(k => !ORDEM.includes(k) && String(c[k]).trim())];
  const ini = String(f.nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  app.innerHTML = `
    <header class="mp-top"><img src="img/logo_sertania.png" alt="" class="mp-logo"><div><small>Prefeitura Municipal de Sertânia</small><b>Secretaria da Mulher</b></div><span class="mp-ro">👁 Somente leitura</span></header>${d.expira ? `<p class="mp-exp">⏳ Link válido até ${new Date(d.expira).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</p>` : ''}
    <section class="mp-hero"><span class="mp-av" aria-hidden="true">${esc(ini)}</span><div><h1>${esc(f.nome)}</h1><p>${[a != null ? a + ' anos' : '', c['Bairro / localidade'], c['Situação do acompanhamento']].filter(Boolean).map(esc).join(' · ')}</p></div></section>
    ${keys.length ? `<section class="mp-card"><h2>Dados da ficha</h2><dl>${keys.map(k => `<div><dt>${esc(k)}</dt><dd>${esc(fmt(c[k]))}${k === 'Data de nascimento' && a != null ? ` (${a} anos)` : ''}</dd></div>`).join('')}</dl></section>` : ''}
    ${f.observacao ? `<section class="mp-card"><h2>Observações</h2><p>${esc(f.observacao)}</p></section>` : ''}
    <section class="mp-card"><h2>Ocorrências <em>${oc.length}</em></h2>${oc.length ? `<ol class="mp-tl">${oc.map(o => { const k = o.campos || {}; return `<li><span aria-hidden="true">${ICO[k.Tipo] || '📝'}</span><div><header><b>${esc(o.titulo || k.Tipo || 'Registro')}</b><small>${dBR(k.Data || o.criado_em)}${k.Profissional ? ' · ' + esc(k.Profissional) : ''}</small></header>${o.relato ? `<p>${esc(o.relato)}</p>` : ''}<small class="mp-meta">${[k.Tipo ? '🏷️ ' + esc(k.Tipo) : '', k['Encaminhado para'] ? '➡️ ' + esc(k['Encaminhado para']) : '', k['Próximo retorno'] ? '🔁 retorno ' + dBR(k['Próximo retorno']) : ''].filter(Boolean).join(' · ')}</small></div></li>`; }).join('')}</ol>` : '<p class="mp-empty">Nenhuma ocorrência registrada.</p>'}</section>
    <footer class="mp-foot">Consulta em ${new Date().toLocaleDateString('pt-BR')} · dados pessoais protegidos pela LGPD — não compartilhe este endereço.</footer>`;
})();
