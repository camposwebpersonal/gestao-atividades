/* ── UNIVERSO SERTÂNIA · neuroarquitetura em TODO o site (pedido do usuário, 23/11/2026, 22h) ──
 * "Quero me sentir bem e maravilhado no site todo, como na Secretaria da Mulher; cada parte com identidade própria,
 *  nada de cards genéricos repetitivos." Padrão-ouro: Casa Lilás (js/mulher-home.js).
 * Cada secretaria vira um MUNDO com nome, paleta, ilustração viva (SVG animado), frase e ícones próprios:
 *  • Página da secretaria (Controle de Demandas de UMA secretaria): hero com saudação + frase calculada dos dados,
 *    gestos grandes, busca instantânea, pulso, "Precisa de atenção" (prazos), últimos lançamentos e o MOSAICO de
 *    espaços (grupos) com ícone/frase/contagem próprios. Modo clássico (grade com editar/transferir) a um toque.
 *  • Visão geral = "Praça de Sertânia": céu que acompanha a hora do dia (manhã, tarde, pôr do sol, noite estrelada),
 *    saudação e o pulso da cidade; cada secretaria aparece com as cores, o emoji e a frase do seu mundo.
 *  • Tela do grupo, escolha de áreas da secretaria e módulos: aurora suave + selo do mundo + ícone do espaço.
 *  • Menu lateral: cada secretaria com o seu emoji e cor.
 * Contraste AA (texto sempre na cor profunda do mundo sobre fundo claro); movimento só com prefers-reduced-motion off. */
(function () {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const low = s => norm(s).toLowerCase();
  const arg = s => esc(JSON.stringify(String(s ?? '')));
  const S = () => window.S || {};
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hojeIso = () => iso(new Date());
  const dBR = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}` : ''; };
  const dias = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return null; const a = new Date(+m[1], +m[2] - 1, +m[3]), h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((a - h) / 864e5); };
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

  /* ── ilustrações vivas (originais, SVG) ── */
  const G = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const ART = {
    broto: `<defs>${G('uvb1', '#fde68a', '#f59e0b')}${G('uvb2', '#86efac', '#16a34a')}</defs><g class="uv-spin-slow" style="transform-origin:160px 60px"><circle cx="160" cy="60" r="30" fill="url(#uvb1)"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<rect x="157" y="14" width="6" height="14" rx="3" fill="#fbbf24" transform="rotate(${a} 160 60)"/>`).join('')}</g><path d="M20 190 Q110 160 200 190 L200 220 L20 220Z" fill="#a16207" opacity=".35"/><path d="M10 200 Q110 175 210 200 L210 220 L10 220Z" fill="#854d0e" opacity=".45"/><g class="uv-sway" style="transform-origin:100px 195px"><path d="M100 195 C100 160 98 140 100 110" stroke="#15803d" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M100 140 C70 135 55 115 58 95 C82 98 98 115 100 140Z" fill="url(#uvb2)"/><path d="M100 125 C128 118 142 98 138 78 C114 84 100 102 100 125Z" fill="url(#uvb2)"/><circle cx="100" cy="106" r="7" fill="#bbf7d0"/></g>`,
    coracao: `<defs>${G('uvc1', '#fda4af', '#e11d48')}</defs><circle cx="110" cy="110" r="92" fill="#ecfeff" opacity=".7"/><g class="uv-pulse" style="transform-origin:110px 112px"><path d="M110 168 C40 120 52 62 88 60 C100 59 108 68 110 76 C112 68 120 59 132 60 C168 62 180 120 110 168Z" fill="url(#uvc1)"/><path d="M84 78 C76 84 74 96 78 104" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".6"/></g><path class="uv-ecg" d="M16 190 H70 L80 172 L92 206 L104 160 L116 198 L124 190 H204" stroke="#0e7490" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    livro: `<defs>${G('uvl1', '#bfdbfe', '#3b82f6')}${G('uvl2', '#fef08a', '#facc15')}</defs><g class="uv-float"><path d="M110 70 C85 56 50 54 26 62 V170 C50 162 85 164 110 178Z" fill="url(#uvl1)"/><path d="M110 70 C135 56 170 54 194 62 V170 C170 162 135 164 110 178Z" fill="#dbeafe"/><path d="M110 70 V178" stroke="#1d4ed8" stroke-width="4"/>${[90, 106, 122, 138].map(y => `<path d="M128 ${y} H178" stroke="#93c5fd" stroke-width="4" stroke-linecap="round"/>`).join('')}</g>${[[60, 30, 10], [160, 22, 8], [190, 100, 6], [30, 110, 7]].map(([x, y, r], i) => `<path class="uv-twinkle" style="animation-delay:${i * .6}s;transform-origin:${x}px ${y}px" d="M${x} ${y - r}L${x + r * .35} ${y - r * .35}L${x + r} ${y}L${x + r * .35} ${y + r * .35}L${x} ${y + r}L${x - r * .35} ${y + r * .35}L${x - r} ${y}L${x - r * .35} ${y - r * .35}Z" fill="url(#uvl2)"/>`).join('')}`,
    guindaste: `<defs>${G('uvg1', '#fdba74', '#ea580c')}</defs><path d="M40 205 V40 M40 50 H190 M40 80 L70 50" stroke="#9a3412" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M28 205 H90" stroke="#7c2d12" stroke-width="8" stroke-linecap="round"/><g class="uv-swing" style="transform-origin:160px 50px"><path d="M160 50 V110" stroke="#78350f" stroke-width="3"/><rect x="140" y="110" width="40" height="26" rx="4" fill="url(#uvg1)"/></g>${[[110, 175], [140, 175], [110, 150]].map(([x, y], i) => `<rect class="uv-rise" style="animation-delay:${i * .35}s" x="${x}" y="${y}" width="28" height="24" rx="3" fill="${['#fb923c', '#fdba74', '#f97316'][i]}"/>`).join('')}<path d="M96 205 H190" stroke="#7c2d12" stroke-width="6" stroke-linecap="round"/>`,
    lampada: `<defs><radialGradient id="uvp1"><stop offset="0" stop-color="#fef9c3"/><stop offset="1" stop-color="#fde047" stop-opacity="0"/></radialGradient>${G('uvp2', '#fde68a', '#f59e0b')}</defs><circle class="uv-glow" cx="130" cy="70" r="70" fill="url(#uvp1)"/><path d="M60 205 V60 Q60 40 85 40 H120" stroke="#475569" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M110 36 H150 L140 56 H120Z" fill="#334155"/><circle cx="130" cy="66" r="13" fill="url(#uvp2)"/><path d="M40 205 H160" stroke="#334155" stroke-width="8" stroke-linecap="round"/><g class="uv-sway" style="transform-origin:180px 205px"><path d="M180 205 V160" stroke="#15803d" stroke-width="5"/><circle cx="180" cy="150" r="16" fill="#4ade80"/></g>`,
    radar: `<defs>${G('uvr1', '#fed7aa', '#f97316')}</defs><circle cx="110" cy="110" r="88" fill="#eff6ff" stroke="#bfdbfe" stroke-width="3"/><circle cx="110" cy="110" r="60" fill="none" stroke="#bfdbfe" stroke-width="3"/><circle cx="110" cy="110" r="32" fill="none" stroke="#bfdbfe" stroke-width="3"/><g class="uv-spin" style="transform-origin:110px 110px"><path d="M110 110 L110 22 A88 88 0 0 1 186 66Z" fill="#60a5fa" opacity=".35"/></g><path d="M110 62 L146 76 V104 C146 128 130 144 110 152 C90 144 74 128 74 104 V76Z" fill="url(#uvr1)"/><path d="M96 106 L106 116 L126 94" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    maos: `<defs>${G('uvm1', '#fecdd3', '#fb7185')}${G('uvm2', '#fed7aa', '#fdba74')}</defs><circle cx="110" cy="110" r="90" fill="#fff1f2" opacity=".8"/><path d="M30 150 C60 130 80 150 110 150 C140 150 160 130 190 150 L180 185 C150 172 130 190 110 190 C90 190 70 172 40 185Z" fill="url(#uvm2)"/><g class="uv-pulse" style="transform-origin:110px 100px"><path d="M110 140 C66 110 72 66 96 66 C104 66 108 72 110 78 C112 72 116 66 124 66 C148 66 154 110 110 140Z" fill="url(#uvm1)"/></g>`,
    notas: `<defs>${G('uvn1', '#f0abfc', '#c026d3')}${G('uvn2', '#fde68a', '#f59e0b')}</defs><path d="M30 200 Q110 150 190 200" stroke="#e9d5ff" stroke-width="10" fill="none" stroke-linecap="round"/>${[[60, 120, 0], [120, 90, .8], [170, 130, 1.6]].map(([x, y, d]) => `<g class="uv-float" style="animation-delay:${d}s"><path d="M${x} ${y} V${y - 52} L${x + 30} ${y - 60} V${y - 8}" stroke="#7e22ce" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="${x - 8}" cy="${y}" rx="12" ry="9" fill="url(#uvn1)"/><ellipse cx="${x + 22}" cy="${y - 8}" rx="12" ry="9" fill="url(#uvn1)"/></g>`).join('')}<path class="uv-twinkle" style="transform-origin:110px 30px" d="M110 14 L116 26 L130 28 L120 38 L122 52 L110 45 L98 52 L100 38 L90 28 L104 26Z" fill="url(#uvn2)"/>`,
    arvore: `<defs>${G('uva1', '#6ee7b7', '#059669')}${G('uva2', '#a7f3d0', '#10b981')}</defs><path d="M20 200 Q110 180 200 200 V220 H20Z" fill="#bbf7d0"/><path d="M110 205 V130" stroke="#78350f" stroke-width="12" stroke-linecap="round"/><path d="M110 160 L86 140 M110 150 L134 132" stroke="#78350f" stroke-width="6" stroke-linecap="round"/><g class="uv-sway" style="transform-origin:110px 140px"><circle cx="110" cy="92" r="50" fill="url(#uva1)"/><circle cx="74" cy="118" r="30" fill="url(#uva2)"/><circle cx="148" cy="116" r="32" fill="url(#uva2)"/></g>${[[50, 40], [170, 60], [190, 140]].map(([x, y], i) => `<ellipse class="uv-fall" style="animation-delay:${i * 1.3}s" cx="${x}" cy="${y}" rx="7" ry="4" fill="#34d399"/>`).join('')}`,
    moedas: `<defs>${G('uvo1', '#fde68a', '#d97706')}</defs><path d="M30 190 L80 150 L120 165 L190 90" stroke="#0f766e" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M170 86 L192 88 L190 110" stroke="#0f766e" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${[0, 1, 2, 3].map(i => `<ellipse class="uv-rise" style="animation-delay:${i * .3}s" cx="70" cy="${196 - i * 14}" rx="30" ry="9" fill="url(#uvo1)" stroke="#b45309" stroke-width="2"/>`).join('')}<g class="uv-float"><circle cx="150" cy="44" r="22" fill="url(#uvo1)" stroke="#b45309" stroke-width="3"/><text x="150" y="52" text-anchor="middle" font-size="22" font-weight="900" fill="#78350f">$</text></g>`,
    engrenagem: `<defs>${G('uve1', '#a5f3fc', '#0891b2')}${G('uve2', '#bae6fd', '#0284c7')}</defs><path d="M40 200 V100 L110 60 L180 100 V200Z" fill="#e0f2fe" stroke="#0c4a6e" stroke-width="5" stroke-linejoin="round"/><path d="M40 200 H180" stroke="#0c4a6e" stroke-width="6"/>${[70, 100, 130].map(x => `<rect x="${x}" y="120" width="18" height="60" rx="3" fill="#7dd3fc"/>`).join('')}<g class="uv-spin" style="transform-origin:160px 56px">${[0, 45, 90, 135].map(a => `<rect x="153" y="24" width="14" height="64" rx="4" fill="url(#uve1)" transform="rotate(${a} 160 56)"/>`).join('')}<circle cx="160" cy="56" r="22" fill="url(#uve2)"/><circle cx="160" cy="56" r="8" fill="#fff"/></g>`,
    estrela: `<defs>${G('uvs1', '#fde68a', '#f59e0b')}${G('uvs2', '#bfdbfe', '#2563eb')}</defs><circle cx="110" cy="110" r="86" fill="url(#uvs2)" opacity=".25"/><g class="uv-pulse" style="transform-origin:110px 110px"><path d="M110 36 L130 88 L186 90 L142 124 L158 178 L110 146 L62 178 L78 124 L34 90 L90 88Z" fill="url(#uvs1)" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/></g>${[[40, 40], [180, 50], [190, 170]].map(([x, y], i) => `<circle class="uv-twinkle" style="animation-delay:${i * .7}s;transform-origin:${x}px ${y}px" cx="${x}" cy="${y}" r="5" fill="#fbbf24"/>`).join('')}`,
    estrada: `<defs>${G('uvt1', '#93c5fd', '#2563eb')}</defs><path d="M80 220 L100 90 H120 L140 220Z" fill="#475569"/><path d="M110 100 V120 M110 140 V165 M110 185 V215" stroke="#fde047" stroke-width="5" stroke-linecap="round"/><path d="M20 90 H200" stroke="#bbf7d0" stroke-width="6"/><g class="uv-drive"><rect x="20" y="40" width="74" height="34" rx="8" fill="url(#uvt1)"/><rect x="28" y="46" width="16" height="12" rx="2" fill="#e0f2fe"/><rect x="48" y="46" width="16" height="12" rx="2" fill="#e0f2fe"/><rect x="68" y="46" width="16" height="12" rx="2" fill="#e0f2fe"/><circle cx="36" cy="76" r="7" fill="#1e293b"/><circle cx="78" cy="76" r="7" fill="#1e293b"/></g>`,
    ondas: `<defs>${G('uvw1', '#c4b5fd', '#7c3aed')}</defs><path d="M40 90 L100 70 V150 L40 130Z" fill="url(#uvw1)"/><rect x="26" y="92" width="18" height="36" rx="5" fill="#6d28d9"/><path d="M58 132 L66 170 H82 L76 136" fill="#8b5cf6"/>${[0, 1, 2].map(i => `<path class="uv-wave" style="animation-delay:${i * .45}s" d="M${120 + i * 22} ${78 - i * 12} Q${140 + i * 30} 110 ${120 + i * 22} ${142 + i * 12}" stroke="#06b6d4" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('')}`,
    escudo: `<defs>${G('uvd1', '#bfdbfe', '#1d4ed8')}</defs><g class="uv-pulse" style="transform-origin:110px 110px"><path d="M110 28 L178 54 V106 C178 150 148 180 110 196 C72 180 42 150 42 106 V54Z" fill="url(#uvd1)"/><path d="M110 70 L120 96 L148 97 L126 114 L134 141 L110 125 L86 141 L94 114 L72 97 L100 96Z" fill="#fde68a"/></g>`,
    baloes: `${[[70, 90, '#f9a8d4', 0], [115, 70, '#93c5fd', .6], [158, 96, '#fde68a', 1.2]].map(([x, y, c, d]) => `<g class="uv-float" style="animation-delay:${d}s"><ellipse cx="${x}" cy="${y}" rx="26" ry="32" fill="${c}"/><path d="M${x} ${y + 32} Q${x + 8} ${y + 70} ${110} 200" stroke="#94a3b8" stroke-width="2" fill="none"/><ellipse cx="${x - 9}" cy="${y - 10}" rx="6" ry="9" fill="#fff" opacity=".6"/></g>`).join('')}`,
    grafico: `<defs>${G('uvx1', '#99f6e4', '#0d9488')}</defs>${[[40, 150], [80, 120], [120, 90], [160, 55]].map(([x, y], i) => `<rect class="uv-rise" style="animation-delay:${i * .25}s" x="${x}" y="${y}" width="30" height="${200 - y}" rx="6" fill="url(#uvx1)"/>`).join('')}<path d="M36 140 L92 106 L130 80 L186 36" stroke="#ca8a04" stroke-width="6" fill="none" stroke-linecap="round"/><circle class="uv-pulse" style="transform-origin:186px 36px" cx="186" cy="36" r="9" fill="#facc15"/>`,
    bola: `<g class="uv-bounce"><circle cx="110" cy="90" r="46" fill="#fff" stroke="#0f172a" stroke-width="4"/><path d="M110 68 L130 82 L122 106 H98 L90 82Z" fill="#0f172a"/></g><ellipse class="uv-shadow" cx="110" cy="190" rx="44" ry="8" fill="#94a3b8" opacity=".5"/><path d="M20 196 H200" stroke="#86efac" stroke-width="8" stroke-linecap="round"/>`,
    cidade: `<defs>${G('uvy1', '#a5f3fc', '#0e7490')}</defs>${[[24, 120, 36], [64, 90, 40], [108, 60, 44], [156, 100, 40]].map(([x, y, w], i) => `<rect class="uv-rise" style="animation-delay:${i * .2}s" x="${x}" y="${y}" width="${w}" height="${200 - y}" rx="5" fill="url(#uvy1)"/>`).join('')}<path d="M14 200 H206" stroke="#155e75" stroke-width="6" stroke-linecap="round"/>`,
  };
  const art = (key, cls = '') => `<svg class="uv-art ${cls}" viewBox="0 0 220 220" aria-hidden="true" focusable="false">${ART[key] || ART.cidade}</svg>`;

  /* ── mundos: identidade de cada secretaria ── */
  const M = (key, re, nome, emoji, artKey, a, b, aur, bg, tiles, lema) => ({key, re, nome, emoji, art: artKey, a, b, aur, bg, tiles, lema});
  const MUNDOS = [
    M('agricultura', /AGRICULTURA|AGROPEC|RURAL/, 'Roça Viva', '🌾', 'broto', '#14532d', '#15803d', ['rgba(250,204,21,.38)', 'rgba(134,239,172,.48)', 'rgba(253,186,116,.3)'], ['#fbfdf3', '#fffbeb'], ['#ecfccb', '#fef9c3', '#dcfce7', '#ffedd5'], 'Da terra vem o sustento. Cada pedido atendido é colheita boa para a cidade.'),
    M('saude', /SAUDE|HOSPITAL/, 'Casa do Cuidado', '🩺', 'coracao', '#0c4a6e', '#0e7490', ['rgba(103,232,249,.4)', 'rgba(167,243,208,.45)', 'rgba(253,164,175,.3)'], ['#f2fcfd', '#fff8f8'], ['#cffafe', '#dcfce7', '#ffe4e6', '#e0f2fe'], 'Cuidar de quem cuida da cidade. Cada registro aqui é saúde chegando mais perto.'),
    M('educacao', /EDUCACAO|ENSINO|ESCOLA/, 'Jardim do Saber', '📚', 'livro', '#1e3a8a', '#1d4ed8', ['rgba(253,224,71,.38)', 'rgba(147,197,253,.45)', 'rgba(253,186,116,.28)'], ['#f8fbff', '#fffdf2'], ['#dbeafe', '#fef9c3', '#e0e7ff', '#ffedd5'], 'Aqui se plantam futuros. Cada demanda resolvida é uma escola mais viva.'),
    M('servicos', /SERVICOS PUBLICOS|ILUMINACAO|LIMPEZA URBANA/, 'Cidade Cuidada', '💡', 'lampada', '#713f12', '#a16207', ['rgba(253,224,71,.42)', 'rgba(187,247,208,.4)', 'rgba(191,219,254,.35)'], ['#fffdf3', '#f6fbff'], ['#fef9c3', '#dcfce7', '#e0f2fe', '#ffedd5'], 'Luz, limpeza e cuidado em cada esquina da nossa cidade.'),
    M('infra', /INFRAESTRUTURA|OBRAS|HABITACAO/, 'Canteiro da Cidade', '🏗️', 'guindaste', '#7c2d12', '#c2410c', ['rgba(253,186,116,.45)', 'rgba(254,215,170,.45)', 'rgba(203,213,225,.45)'], ['#fffaf5', '#f8fafc'], ['#ffedd5', '#fef3c7', '#f1f5f9', '#fee2e2'], 'Tijolo por tijolo, rua por rua: a cidade cresce a cada serviço concluído.'),
    M('defesa', /DEFESA CIVIL|PROTECAO/, 'Base de Proteção', '🛡️', 'radar', '#1e3a5f', '#c2410c', ['rgba(147,197,253,.45)', 'rgba(253,186,116,.38)', 'rgba(191,219,254,.4)'], ['#f5f9ff', '#fff8f3'], ['#dbeafe', '#ffedd5', '#e0f2fe', '#fef3c7'], 'Prevenir, proteger e responder. Cada ação registrada aqui cuida de vidas.'),
    M('social', /ACAO SOCIAL|ASSISTENCIA|DESENVOLVIMENTO SOCIAL|CIDADANIA/, 'Abraço Social', '🤝', 'maos', '#831843', '#be185d', ['rgba(253,164,175,.42)', 'rgba(254,215,170,.45)', 'rgba(251,207,232,.4)'], ['#fff7f8', '#fffaf4'], ['#ffe4e6', '#ffedd5', '#fce7f3', '#fef3c7'], 'Ninguém fica para trás. Cada atendimento é um abraço da Prefeitura.'),
    M('cultura', /CULTURA|TURISMO|EVENTO/, 'Palco da Cultura', '🎭', 'notas', '#581c87', '#9333ea', ['rgba(240,171,252,.42)', 'rgba(253,230,138,.4)', 'rgba(196,181,253,.4)'], ['#fdf8ff', '#fffbf0'], ['#fae8ff', '#fef9c3', '#ede9fe', '#ffe4e6'], 'A alma da cidade em festa, arte e memória viva.'),
    M('ambiente', /MEIO AMBIENTE|AMBIENTAL|RECURSOS HIDRICOS/, 'Mata Viva', '🌳', 'arvore', '#064e3b', '#047857', ['rgba(110,231,183,.45)', 'rgba(153,246,228,.4)', 'rgba(217,249,157,.35)'], ['#f3fdf8', '#f7fdf0'], ['#d1fae5', '#ccfbf1', '#ecfccb', '#e0f2fe'], 'Cuidar do verde é cuidar de todos nós — hoje e amanhã.'),
    M('financas', /FINANCAS|FAZENDA|TRIBUT|ARRECADA/, 'Cofre Transparente', '💰', 'moedas', '#1e293b', '#0f766e', ['rgba(253,230,138,.45)', 'rgba(153,246,228,.4)', 'rgba(226,232,240,.5)'], ['#fffdf5', '#f4fbfa'], ['#fef3c7', '#ccfbf1', '#f1f5f9', '#e0f2fe'], 'Cada centavo bem cuidado vira serviço para a população.'),
    M('desenvolvimento', /DESENVOLVIMENTO|ECONOMI|INDUSTRIA|COMERCIO|TRABALHO|EMPREENDE/, 'Mercado em Movimento', '📈', 'grafico', '#134e4a', '#0f766e', ['rgba(153,246,228,.45)', 'rgba(253,230,138,.4)', 'rgba(187,247,208,.4)'], ['#f2fcfa', '#fffcf0'], ['#ccfbf1', '#fef9c3', '#dcfce7', '#e0f2fe'], 'Oportunidade, renda e crescimento para a nossa gente.'),
    M('administracao', /ADMINISTRACAO|PLANEJAMENTO|GESTAO/, 'Coração da Gestão', '🏛️', 'engrenagem', '#0c4a6e', '#0e7490', ['rgba(125,211,252,.45)', 'rgba(167,243,208,.38)', 'rgba(224,231,255,.45)'], ['#f3faff', '#f6fdf9'], ['#e0f2fe', '#dcfce7', '#e0e7ff', '#fef3c7'], 'Tudo começa aqui: pessoas, cadastros e organização que fazem a cidade andar.'),
    M('gabinete', /GABINETE|PREFEIT|VICE/, 'Gabinete', '⭐', 'estrela', '#172554', '#1d4ed8', ['rgba(253,224,71,.38)', 'rgba(147,197,253,.45)', 'rgba(224,231,255,.5)'], ['#f6f8ff', '#fffcf0'], ['#e0e7ff', '#fef9c3', '#dbeafe', '#fae8ff'], 'Onde as prioridades da cidade ganham rumo e acompanhamento.'),
    M('transportes', /TRANSPORTE|FROTA|TRANSITO|MOBILIDADE/, 'Estrada Viva', '🚌', 'estrada', '#1e3a8a', '#2563eb', ['rgba(147,197,253,.45)', 'rgba(253,224,71,.35)', 'rgba(187,247,208,.38)'], ['#f5f9ff', '#fffdf2'], ['#dbeafe', '#fef9c3', '#dcfce7', '#e0f2fe'], 'Gente e cuidado em movimento por toda Sertânia.'),
    M('comunicacao', /COMUNICACAO|IMPRENSA/, 'Voz da Cidade', '📣', 'ondas', '#3b0764', '#7c3aed', ['rgba(196,181,253,.45)', 'rgba(103,232,249,.38)', 'rgba(251,207,232,.38)'], ['#faf7ff', '#f2fdff'], ['#ede9fe', '#cffafe', '#fce7f3', '#e0e7ff'], 'Informar bem é aproximar a Prefeitura de cada morador.'),
    M('seguranca', /SEGURANCA|GUARDA/, 'Guarda Cidadã', '🚔', 'escudo', '#172554', '#1e40af', ['rgba(147,197,253,.45)', 'rgba(253,230,138,.35)', 'rgba(199,210,254,.45)'], ['#f5f8ff', '#fffcf2'], ['#dbeafe', '#e0e7ff', '#fef9c3', '#e0f2fe'], 'Presença que protege, cuidado que tranquiliza.'),
    M('cedoca', /CEDOCA|CRIANCA|ADOLESC|JUVENTUDE/, 'Ninho de Sonhos', '🎈', 'baloes', '#4c1d95', '#7c3aed', ['rgba(249,168,212,.4)', 'rgba(147,197,253,.4)', 'rgba(253,230,138,.4)'], ['#fff8fc', '#f7fbff'], ['#fce7f3', '#dbeafe', '#fef9c3', '#ede9fe'], 'Infância e juventude cuidadas com carinho e atenção.'),
    M('esporte', /ESPORTE|LAZER/, 'Arena da Cidade', '⚽', 'bola', '#14532d', '#15803d', ['rgba(134,239,172,.45)', 'rgba(253,224,71,.35)', 'rgba(147,197,253,.38)'], ['#f5fdf6', '#fffdf2'], ['#dcfce7', '#fef9c3', '#dbeafe', '#ffedd5'], 'Saúde, união e alegria em movimento.'),
    M('mulher', /MULHER/, 'Casa Lilás', '💜', 'maos', '#3b0764', '#7e22ce', ['rgba(196,181,253,.45)', 'rgba(249,168,212,.38)', 'rgba(167,243,208,.35)'], ['#fbf7ff', '#fffaf6'], ['#ede9fe', '#ffe4ef', '#d9f7ea', '#ffe7d6'], 'Espaço de acolhimento, proteção e autonomia das mulheres.'),
  ];
  const PRACA = M('praca', /^$/, 'Praça de Sertânia', '🏙️', 'cidade', '#0f3b52', '#0e7490', ['rgba(125,211,252,.42)', 'rgba(167,243,208,.38)', 'rgba(253,224,71,.28)'], ['#f3fbff', '#f9fdf6'], ['#e0f2fe', '#dcfce7', '#fef9c3', '#ede9fe'], 'Um espaço de trabalho cuidado para servir melhor à cidade.');
  const mundoBase = nome => MUNDOS.find(m => m.re.test(norm(nome))) || PRACA;
  /* Frases editáveis por secretaria (pedido 25/11/2026): app_settings 'blocos'.value.frases[norm(nome)] = {nome, lema}.
   * nome '' = frase removida (some dos cards, selos e faixas); ausente = frase padrão do mundo. */
  const frasesTodas = () => { let v = (S().appSettings || []).find(r => r.id === 'blocos')?.value; try { if (typeof v === 'string') v = JSON.parse(v); } catch { v = {}; } return v?.frases || {}; };
  const mundoDe = nome => { const m = mundoBase(nome), f = nome ? frasesTodas()[norm(nome).replace(/\s+/g, ' ').trim()] : null;
    const n = f && typeof f.nome === 'string' ? f.nome.trim() : m.nome, l = f && typeof f.lema === 'string' && f.lema.trim() ? f.lema.trim() : m.lema;
    return {...m, nome: n, lema: l, rotulo: n || String(nome || m.nome).trim(), padrao: m.nome, lemaPadrao: m.lema}; };
  window.universoMundoBase = mundoBase;
  window.universoMundo = mundoDe;

  /* ícone e frase de cada espaço (grupo) pelo nome */
  const ESPACOS = [
    [/PIPA|AGUA|ABASTEC|CISTERNA/, '💧', 'Água chegando a quem precisa'], [/POCO|PERFURA/, '⛲', 'Poços e perfurações'],
    [/SANEAMENTO|ESGOTO/, '🚰', 'Saneamento que muda vidas'], [/RETRO|MAQUINA|PATROL|TRATOR|ESTRADA|TERRAPLEN/, '🚜', 'Máquinas a serviço da zona rural'],
    [/ILUMINA|LAMPAD|POSTE/, '💡', 'Ruas iluminadas e seguras'], [/LIMPEZA|LIXO|COLETA|ENTULHO/, '🧹', 'Cidade limpa e cuidada'],
    [/MERENDA|ALIMENTA|CESTA/, '🍎', 'Comida boa na mesa'], [/ESCOLA|CRECHE|ENSINO|ALUNO|EDUCA/, '🏫', 'Escolas que acolhem'],
    [/MAMOGRAF|ULTRASS|EXAME|CONSULTA/, '🩺', 'Exames e consultas'], [/MEDICA|FARMAC|REMEDIO/, '💊', 'Remédios a quem precisa'],
    [/SAUDE|UBS|POSTO|HOSPITAL/, '🏥', 'Unidades de saúde'], [/VEICULO|FROTA|ONIBUS|CARRO|TRANSPORT/, '🚐', 'Veículos e deslocamentos'],
    [/EXPO|FESTA|EVENTO|SAO JOAO|CARNAVAL/, '🎪', 'Eventos que reúnem a cidade'], [/CULTURA|MUSICA|BANDA|ARTE/, '🎶', 'Arte e cultura viva'],
    [/OBRA|CONSTRU|REFORMA|PREDIO|PAVIMENTA/, '🏗️', 'Obras e reformas'], [/LEITE|CABRA|CAPRIN|OVIN|GADO|BOI|ANIMAL|VACINA/, '🐐', 'Criação e produção animal'],
    [/SEMENTE|PLANTIO|PRODUTOR|AGRIC|HORTA|FEIRA/, '🌱', 'Quem planta e produz'], [/EXTINTOR|INCENDIO/, '🧯', 'Prevenção de incêndio'],
    [/CHUVA|ALAGA|RISCO|DESLIZA|SECA|ESTIAGEM/, '🌧️', 'Riscos e prevenção'], [/PESSOA|SERVIDOR|EMPREGO|FOLHA|RH|BCC|VEREADOR/, '👥', 'Pessoas que fazem a cidade'],
    [/CADASTRO|EQUIPAMENTO|LOCAIS|PREDIOS/, '🗂️', 'Cadastros organizados'], [/CONTA|PAGAMENTO|FINANC|MULTA|SEGURO/, '💳', 'Contas em dia'],
    [/LICITA|CONTRATO|COMPRA/, '📑', 'Compras e contratos'], [/ESTOQUE|ALMOX|MATERIA|DISTRIBUI/, '📦', 'Estoque e distribuição'],
    [/OFICIO|DOCUMENT|PROTOCOLO|MEMORANDO/, '📨', 'Documentos e ofícios'], [/CAMPO|FOTO|REGISTRO/, '📷', 'Registros de campo'],
    [/ASSOCIA|COMUNIDADE|BAIRRO|DISTRITO|SITIO/, '🏘️', 'Comunidades e bairros'], [/CURSO|CAPACITA|PALESTRA|OFICINA|RODA/, '🎓', 'Aprender e crescer juntos'],
    [/ESPORTE|FUTEBOL|QUADRA|CAMPEONATO/, '⚽', 'Esporte e lazer'], [/MULHER/, '💜', 'Cuidado com as mulheres'],
    [/SOLICITA|DEMANDA|PEDIDO|ATENDIMENTO|URGENCIA/, '📝', 'Pedidos da população'],
  ];
  const espacoDe = (g, mundo) => { const t = norm(g?.name); const f = ESPACOS.find(([re]) => re.test(t)); return f ? {ico: f[1], txt: f[2]} : {ico: mundo.emoji, txt: 'Lançamentos desta área'}; };
  window.universoEspaco = g => espacoDe(g, PRACA);

  const vars = m => `--uv-a:${m.a};--uv-b:${m.b};--uv-g1:${m.aur[0]};--uv-g2:${m.aur[1]};--uv-g3:${m.aur[2]};--uv-bg1:${m.bg[0]};--uv-bg2:${m.bg[1]};${m.tiles.map((t, i) => `--uv-t${i + 1}:${t}`).join(';')}`;
  const aplicarMundo = (m, onde = 'tela') => {
    const c = document.getElementById('content'); if (!c) return;
    c.setAttribute('style', (c.getAttribute('style') || '').replace(/--uv-[^;]+;?/g, '') + vars(m));
    c.dataset.mundo = m.key; c.dataset.mundoOnde = onde; c.__uvNodes = [...c.children].filter(n => !n.classList?.contains('nav-trail')); c.__uvHash = location.hash;
  };
  // quando o conteúdo marcado sai da tela (contatos, usuários, lixeira…), a aurora some
  const vigiar = () => {
    const c = document.getElementById('content'); if (!c || c.__uvObs) return; c.__uvObs = true;
    new MutationObserver(() => { if (c.dataset.mundo && location.hash !== c.__uvHash && !(c.__uvNodes || []).some(n => n.isConnected && n.parentNode === c)) { delete c.dataset.mundo; delete c.dataset.mundoOnde; delete c.dataset.uvOff; c.setAttribute('style', (c.getAttribute('style') || '').replace(/--uv-[^;]+;?/g, '')); }
      const mod = location.hash.match(/^#module\/([^/?]+)/)?.[1]; if (mod && mod !== 'atendimentos' && !c.dataset.mundo) window.universoMundoModulo(decodeURIComponent(mod)); }).observe(c, {childList: true});
  };
  document.addEventListener('DOMContentLoaded', vigiar); setTimeout(vigiar, 0);

  /* ── dados de uma secretaria ── */
  const gruposDa = secId => (S().secs || []).filter(g => g.demanda_secretaria_id === secId && (S().isAdmin || window.userCanGroup?.(g, 'acesso') !== false));
  const estat = grupos => {
    const ids = new Set(grupos.map(g => g.id)), hoje = hojeIso(), lim30 = iso(new Date(Date.now() - 30 * 864e5));
    const itens = (S().items || []).filter(i => ids.has(i.atividade_id));
    const abertos = itens.filter(i => i.concluded != 1);
    const atrasados = abertos.filter(i => i.deadline_date && String(i.deadline_date).slice(0, 10) < hoje);
    const semana = abertos.filter(i => { const d = dias(String(i.deadline_date || '').slice(0, 10)); return d != null && d >= 0 && d <= 7; });
    const feitos30 = itens.filter(i => i.concluded == 1 && String(i.conclusion_date || i.updated_at || '').slice(0, 10) >= lim30);
    return {itens, abertos, atrasados, semana, feitos30};
  };
  const saudacao = () => { const h = new Date().getHours(); return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
  const meuNome = () => String(S().me?.display_name || S().me?.displayName || '').trim().split(/\s+/)[0] || '';
  const fraseDe = (e, m) => e.atrasados.length ? `${plural(e.atrasados.length, 'lançamento passou', 'lançamentos passaram')} do prazo — que tal começar por ${e.atrasados.length === 1 ? 'ele' : 'eles'} hoje?`
    : e.semana.length ? `${plural(e.semana.length, 'prazo vence', 'prazos vencem')} nesta semana. Dá tempo de deixar tudo em dia. 🌿`
    : e.abertos.length ? `${plural(e.abertos.length, 'lançamento em andamento', 'lançamentos em andamento')}. ${m.lema}`
    : e.itens.length ? `Tudo em dia ✨ ${plural(e.feitos30.length, 'conclusão', 'conclusões')} nos últimos 30 dias. Que orgulho!` : `${m.lema} Comece pelo primeiro registro.`;

  /* ── página de entrada de UMA secretaria ── */
  let classico = false, busca = '';
  window.universoHomeFor = id => !classico && !!id && id !== 'sem-secretaria' && id !== window.mulherSecretariaId?.() && (S().secretarias || []).some(s => s.id === id);
  window.universoModoClassico = on => { classico = !!on; window.renderModulo?.('atendimentos');
    if (classico) requestAnimationFrame(() => { const sec = (S().secretarias || []).find(s => s.id === window.currentDemandSecretaria), m = mundoDe(sec?.name);
      document.querySelector('.demand-shell')?.insertAdjacentHTML('afterbegin', `<button type="button" class="uv-voltar" style="${vars(m)}" onclick="universoModoClassico(false)">${m.emoji} Voltar para ${esc(m.rotulo)}</button>`); }); };
  window.universoModoClassicoReset = () => { classico = false; busca = ''; };

  window.renderUniversoHome = function (secId) {
    const sec = (S().secretarias || []).find(s => s.id === secId); if (!sec) return;
    const m = mundoDe(sec.name), grupos = gruposDa(secId), e = estat(grupos);
    const podeCriar = window.userCanCreateItems?.() !== false;
    const gruposCriaveis = grupos.filter(g => S().isAdmin || window.userCanGroup?.(g, 'editar'));
    const hoje = new Date().toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long'});
    const gnome = id => grupos.find(g => g.id === id)?.name || '';
    const atencao = [...e.atrasados, ...e.semana.filter(i => !e.atrasados.includes(i))].map(i => ({i, d: dias(String(i.deadline_date).slice(0, 10))})).sort((a, b) => a.d - b.d).slice(0, 7);
    const ultimos = [...e.itens].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 6);
    const campo = typeof window.openFieldCapture === 'function';
    const B = window.uvBlocos ? window.uvBlocos('sec:' + secId) : {ordem: ['saudacao', 'gestos', 'busca', 'pulso', 'atencao', 'ultimos', 'espacos', 'rodape'], liga: () => true};
    const pers = window.uvBotaoPersonalizar?.('sec:' + secId, sec.name, `uvPersonalizar('sec:${secId}',${JSON.stringify(sec.name)},()=>renderUniversoHome('${secId}'))`) || '';
    const gestosHtml = `<div class="uv-gestos">
            ${podeCriar && gruposCriaveis.length ? `<button type="button" class="uv-gesto is-main" onclick="universoNovo(${arg(secId)})"><span aria-hidden="true">＋</span><b>Novo lançamento</b><small>escolha o espaço e pronto</small></button>` : ''}
            ${campo ? `<button type="button" class="uv-gesto" onclick="universoCampo(${arg(secId)})"><span aria-hidden="true">📷</span><b>Registro de campo</b><small>foto + localização</small></button>` : ''}
            ${e.atrasados.length ? `<button type="button" class="uv-gesto is-atencao" onclick="universoAtrasados(${arg(secId)})"><span aria-hidden="true">⏰</span><b>${plural(e.atrasados.length, 'atrasado', 'atrasados')}</b><small>ver o que precisa de atenção</small></button>` : `<button type="button" class="uv-gesto" onclick="document.getElementById('uv-espacos')?.scrollIntoView({behavior:'smooth',block:'start'})"><span aria-hidden="true">🧭</span><b>Espaços</b><small>${plural(grupos.length, 'área de trabalho', 'áreas de trabalho')}</small></button>`}
          </div>`;
    const duas = B.liga('atencao') && B.liga('ultimos');
    const P = {
      saudacao: () => `<section class="uv-hero"><div class="uv-hero-txt"><span class="uv-kicker">${m.emoji} ${m.nome ? esc(m.nome) + ' · ' : ''}${esc(hoje)}</span>
          <h1>${saudacao()}${meuNome() ? ', ' + esc(meuNome()) : ''}</h1><p class="uv-sec-name">${esc(sec.name)}</p><p class="uv-lema">${esc(fraseDe(e, m))}</p>
          ${B.liga('gestos') ? gestosHtml : ''}</div><div class="uv-hero-art">${art(m.art)}</div>${pers ? `<div class="uv-hero-pers">${pers}</div>` : ''}</section>`,
      gestos: () => B.liga('saudacao') ? '' : gestosHtml.replace('class="uv-gestos"', 'class="uv-gestos is-compact"'),
      busca: () => `<section class="uv-find" role="search"><span aria-hidden="true">🔎</span><input type="search" id="uv-busca" value="${esc(busca)}" placeholder="Encontrar em ${esc(m.rotulo)}: nome, telefone, localidade, assunto…" aria-label="Buscar nesta secretaria" oninput="universoBusca(${arg(secId)},this.value)" autocomplete="off"><div class="uv-find-res" id="uv-find-res"></div></section>`,
      pulso: () => `<section class="uv-pulso" aria-label="Pulso da secretaria">
        ${[['🌀', e.abertos.length, 'em andamento', 1], ['⏰', e.atrasados.length, e.atrasados.length ? 'passaram do prazo' : 'nada atrasado', e.atrasados.length ? 'warn' : 2], ['✅', e.feitos30.length, 'concluídos em 30 dias', 3], ['🧭', grupos.length, 'espaços de trabalho', 4]].map(([i, n, l, t]) => `<div class="uv-bolha is-t${t}"><span aria-hidden="true">${i}</span><b>${n}</b><small>${l}</small></div>`).join('')}
      </section>`,
      atencao: () => `<section class="uv-painel${duas ? ' is-half' : ''}" id="uv-atencao"><header><h2>⏰ Precisa de atenção</h2><small>prazos vencidos e desta semana</small></header>
          ${atencao.length ? `<ol class="uv-lista">${atencao.map(x => `<li class="${x.d < 0 ? 'is-late' : x.d === 0 ? 'is-today' : ''}"><button type="button" onclick="revealRecord('items',${arg(x.i.id)})"><span class="uv-dia"><b>${dBR(x.i.deadline_date)}</b><small>${x.d < 0 ? `há ${-x.d} d` : x.d === 0 ? 'hoje' : x.d === 1 ? 'amanhã' : `em ${x.d} d`}</small></span><span class="uv-li-txt"><b>${esc(x.i.description || 'Sem descrição')}</b><small>${esc(gnome(x.i.atividade_id))}</small></span></button></li>`).join('')}</ol>` : '<p class="uv-calma">🌿 Nenhum prazo apertado. Tudo sob controle.</p>'}
        </section>`,
      ultimos: () => `<section class="uv-painel${duas ? ' is-half' : ''}"><header><h2>🕊️ Últimos lançamentos</h2><small>o que chegou por último</small></header>
          ${ultimos.length ? `<ol class="uv-lista">${ultimos.map(i => `<li><button type="button" onclick="revealRecord('items',${arg(i.id)})"><span class="uv-ponto${i.concluded == 1 ? ' is-ok' : ''}" aria-hidden="true"></span><span class="uv-li-txt"><b>${esc(i.description || 'Sem descrição')}</b><small>${esc(gnome(i.atividade_id))}${i.created_at ? ' · ' + dBR(String(i.created_at).slice(0, 10)) : ''}${i.concluded == 1 ? ' · ✅ concluído' : ''}</small></span></button></li>`).join('')}</ol>` : '<p class="uv-calma">Ainda não há lançamentos por aqui.</p>'}
        </section>`,
      espacos: () => `<section class="uv-espacos" id="uv-espacos"><header><h2>Espaços de ${esc(m.rotulo)}</h2><small>${plural(grupos.length, 'área de trabalho', 'áreas de trabalho')} · toque para entrar</small></header>
        <div class="uv-mosaico">${grupos.map((g, k) => { const sp = espacoDe(g, m), its = (S().items || []).filter(i => i.atividade_id === g.id), ab = its.filter(i => i.concluded != 1).length;
          const big = k < 2 && grupos.length > 3 && ab > 0;
          return `<button type="button" class="uv-espaco is-t${k % 4 + 1}${big ? ' is-big' : ''}" onclick="openActivity(${arg(g.id)})"><span class="uv-esp-ico" aria-hidden="true">${sp.ico}</span><b>${esc(g.name)}</b><small>${esc(sp.txt)}</small><em>${its.length ? (ab ? `${ab} em andamento · ${its.length} no total` : `tudo em dia ✨ · ${its.length}`) : 'vazio por enquanto'}</em></button>`; }).join('') || '<p class="uv-calma">Nenhum espaço liberado para o seu usuário nesta secretaria.</p>'}</div>
      </section>`,
      rodape: () => `<footer class="uv-rodape"><button type="button" onclick="universoModoClassico(true)">▦ Ver em grade (modo clássico)</button>${window.userCanCreateGroups?.() && window.userCan?.('atendimentos', 'criar') ? `<button type="button" onclick="universoModoClassico(true);setTimeout(()=>window.newDemandGroup?.(),60)">＋ Criar grupo</button>` : ''}<span>${m.emoji} ${m.nome ? esc(m.nome) + ' · ' : ''}${esc(sec.name)} · Prefeitura de Sertânia</span></footer>`,
    };
    // Sem a saudação, a identidade vira uma faixa fina de uma linha (mais espaço para trabalhar).
    const faixa = B.liga('saudacao') ? '' : `<div class="uv-faixa"><span class="uv-faixa-ico" aria-hidden="true">${m.emoji}</span><span class="uv-faixa-txt"><b>${esc(sec.name)}</b><small>${esc(m.nome)}${e.atrasados.length ? `${m.nome ? ' · ' : ''}<em>⏰ ${plural(e.atrasados.length, 'atrasado', 'atrasados')}</em>` : e.abertos.length ? `${m.nome ? ' · ' : ''}${e.abertos.length} em andamento` : `${m.nome ? ' · ' : ''}tudo em dia ✨`}</small></span><span class="uv-faixa-art" aria-hidden="true">${art(m.art)}</span>${pers}</div>`;
    window.setC(`<div class="uv uv-home${B.liga('saudacao') ? '' : ' is-enxuto'}" style="${vars(m)}" data-mundo-home="${m.key}">${faixa}${B.ordem.filter(id => B.liga(id)).map(id => P[id]?.() || '').join('')}</div>`);
    aplicarMundo(m, 'secretaria');
    if (busca) window.universoBusca(secId, busca);
  };

  window.universoBusca = function (secId, q) {
    busca = q; const box = document.getElementById('uv-find-res'); if (!box) return;
    const t = low(q).split(/\s+/).filter(Boolean); if (!t.length) { box.innerHTML = ''; return; }
    const grupos = gruposDa(secId), ids = new Set(grupos.map(g => g.id));
    const hay = i => { let ef = i.extra_fields; try { if (typeof ef === 'string') ef = JSON.parse(ef); if (typeof ef === 'string') ef = JSON.parse(ef); } catch { ef = {}; } return low([i.description, i.observacoes, i.solicitante, ...Object.values(ef || {}).filter(v => typeof v === 'string' || typeof v === 'number')].join(' ')); };
    const lista = (S().items || []).filter(i => ids.has(i.atividade_id)).filter(i => { const h = hay(i); return t.every(k => h.includes(k)); }).slice(0, 8);
    const gn = id => grupos.find(g => g.id === id)?.name || '';
    box.innerHTML = lista.length ? lista.map(i => `<button type="button" onclick="revealRecord('items',${arg(i.id)})"><span class="uv-av" aria-hidden="true">${esc(espacoDe(grupos.find(g => g.id === i.atividade_id), PRACA).ico)}</span><span><b>${esc(i.description || 'Sem descrição')}</b><small>${esc(gn(i.atividade_id))}${i.concluded == 1 ? ' · ✅ concluído' : ''}</small></span></button>`).join('') : '<p>Nada encontrado aqui. Tente outra palavra ou use a busca do topo para procurar no site todo.</p>';
  };

  // Novo lançamento: escolher o espaço (grupo) num mosaico e abrir o formulário dele
  window.universoNovo = function (secId) {
    const sec = (S().secretarias || []).find(s => s.id === secId), m = mundoDe(sec?.name);
    const grupos = gruposDa(secId).filter(g => S().isAdmin || window.userCanGroup?.(g, 'editar'));
    if (grupos.length === 1) { window.openActivity(grupos[0].id); setTimeout(() => window.openItemModal?.(null, grupos[0].id, false, null), 30); return; }
    window.openModal(`${m.emoji} Novo lançamento`, `Em qual espaço de ${m.rotulo}?`, `<div class="uv-pick" style="${vars(m)}">${grupos.map((g, k) => { const sp = espacoDe(g, m); return `<button type="button" class="uv-espaco is-t${k % 4 + 1}" onclick="closeModal();openActivity(${arg(g.id)});setTimeout(()=>openItemModal(null,${arg(g.id)},false,null),30)"><span class="uv-esp-ico" aria-hidden="true">${sp.ico}</span><b>${esc(g.name)}</b><small>${esc(sp.txt)}</small></button>`; }).join('')}</div>`);
  };
  window.universoAtrasados = function (secId) {
    const alvo = document.getElementById('uv-atencao'); if (alvo) { alvo.scrollIntoView({behavior: 'smooth', block: 'center'}); return; }
    const sec = (S().secretarias || []).find(s => s.id === secId), m = mundoDe(sec?.name), grupos = gruposDa(secId), e = estat(grupos);
    const gn = id => grupos.find(g => g.id === id)?.name || '';
    window.openModal(`⏰ Precisa de atenção`, `${sec?.name || ''} · ${plural(e.atrasados.length, 'atrasado', 'atrasados')}`, `<div class="uv" style="${vars(m)}"><ol class="uv-lista">${e.atrasados.map(i => ({i, d: dias(String(i.deadline_date).slice(0, 10))})).sort((a, b) => a.d - b.d).map(x => `<li class="is-late"><button type="button" onclick="closeModal();revealRecord('items',${arg(x.i.id)})"><span class="uv-dia"><b>${dBR(x.i.deadline_date)}</b><small>há ${-x.d} d</small></span><span class="uv-li-txt"><b>${esc(x.i.description || 'Sem descrição')}</b><small>${esc(gn(x.i.atividade_id))}</small></span></button></li>`).join('')}</ol></div>`);
  };
  window.universoCampo = function (secId) {
    window.openFieldCapture?.();
    setTimeout(() => { const s = document.getElementById('field-secretaria'); if (s && [...s.options].some(o => o.value === secId)) { s.value = secId; s.dispatchEvent(new Event('change', {bubbles: true})); window.updateFieldCaptureGroups?.(); } }, 40);
  };

  /* ── Visão geral: Praça de Sertânia com céu da hora do dia ── */
  const ceu = () => { const h = new Date().getHours(); return h >= 5 && h < 11 ? 'manha' : h >= 11 && h < 16 ? 'dia' : h >= 16 && h < 19 ? 'tarde' : 'noite'; };
  const CEU_ART = {
    manha: `<defs><radialGradient id="uvsun"><stop offset="0" stop-color="#fef9c3"/><stop offset="1" stop-color="#fbbf24"/></radialGradient></defs><circle class="uv-pulse" style="transform-origin:150px 70px" cx="150" cy="70" r="34" fill="url(#uvsun)"/><g class="uv-drift"><ellipse cx="70" cy="60" rx="34" ry="14" fill="#fff"/><ellipse cx="92" cy="52" rx="22" ry="14" fill="#fff"/></g>`,
    dia: `<defs><radialGradient id="uvsun"><stop offset="0" stop-color="#fffbeb"/><stop offset="1" stop-color="#facc15"/></radialGradient></defs><g class="uv-spin-slow" style="transform-origin:150px 64px">${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(a => `<rect x="148" y="14" width="4" height="14" rx="2" fill="#fbbf24" transform="rotate(${a} 150 64)"/>`).join('')}</g><circle cx="150" cy="64" r="30" fill="url(#uvsun)"/><g class="uv-drift"><ellipse cx="60" cy="80" rx="34" ry="14" fill="#fff"/><ellipse cx="82" cy="72" rx="22" ry="14" fill="#fff"/></g>`,
    tarde: `<defs><radialGradient id="uvsun"><stop offset="0" stop-color="#fed7aa"/><stop offset="1" stop-color="#f97316"/></radialGradient></defs><circle class="uv-pulse" style="transform-origin:120px 120px" cx="120" cy="120" r="42" fill="url(#uvsun)"/><path d="M0 130 H220" stroke="#fdba74" stroke-width="3" opacity=".6"/><g class="uv-drift"><ellipse cx="60" cy="70" rx="30" ry="10" fill="#fecdd3"/></g>`,
    noite: `<defs><radialGradient id="uvmoon"><stop offset="0" stop-color="#fefce8"/><stop offset="1" stop-color="#fde68a"/></radialGradient></defs><circle cx="150" cy="66" r="30" fill="url(#uvmoon)"/><circle cx="164" cy="56" r="26" fill="#c7d2fe"/>${[[40, 40], [80, 90], [110, 30], [190, 120], [60, 140], [170, 160]].map(([x, y], i) => `<circle class="uv-twinkle" style="animation-delay:${i * .5}s;transform-origin:${x}px ${y}px" cx="${x}" cy="${y}" r="3.5" fill="#fde68a"/>`).join('')}`,
  };
  const CEU_FRASE = {manha: 'O dia está começando — que ele seja leve e produtivo.', dia: 'Sol alto, trabalho rendendo. Bom ver você por aqui.', tarde: 'Fim de tarde chegando — hora de fechar o dia com chave de ouro.', noite: 'Noite tranquila. Obrigado por cuidar da cidade até agora.'};
  window.universoDecorarHome = function () {
    const shell = document.querySelector('.productivity-dashboard'); if (!shell || shell.dataset.uv) return; shell.dataset.uv = '1';
    const c = ceu(), secs = (S().secretarias || []);
    aplicarMundo(PRACA, 'praca');
    const todos = (S().secs || []).filter(g => S().isAdmin || window.userCanGroup?.(g, 'acesso') !== false), e = estat(todos);
    const B = window.uvBlocos ? window.uvBlocos('praca') : {ordem: ['saudacao', 'pulso', 'campo', 'mapa', 'secretarias'], liga: () => true};
    const pers = window.uvBotaoPersonalizar?.('praca', 'na Visão geral', "uvPersonalizar('praca','na Visão geral',()=>renderModulos())") || '';
    const head = shell.querySelector('.productivity-heading');
    if (head) {
      const btn = head.querySelector('.dashboard-new-demand')?.outerHTML || '';
      const hoje = new Date().toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long'});
      const pulso = B.liga('pulso') ? `<div class="uv-praca-pulso">${[['🌀', e.abertos.length, 'em andamento'], ['⏰', e.atrasados.length, 'passaram do prazo'], ['✅', e.feitos30.length, 'concluídos em 30 dias']].map(([i, n, l], k) => `<span class="${k === 1 && n ? 'is-warn' : ''}"><i aria-hidden="true">${i}</i><b>${n}</b>${l}</span>`).join('')}</div>` : '';
      if (B.liga('saudacao')) {
        head.classList.add('uv-praca', 'is-' + c);
        head.innerHTML = `<div class="uv-praca-txt"><span class="uv-kicker">🏙️ Praça de Sertânia · ${esc(hoje)}</span><h1 id="dashboard-title">${saudacao()}${meuNome() ? ', ' + esc(meuNome()) : ''} <span aria-hidden="true">${c === 'noite' ? '🌙' : c === 'tarde' ? '🌇' : '☀️'}</span></h1><p class="uv-lema">${esc(CEU_FRASE[c])}</p>${pulso}${btn}</div>
        <svg class="uv-art uv-ceu" viewBox="0 0 220 180" aria-hidden="true" focusable="false">${CEU_ART[c]}</svg>${pers ? `<div class="uv-hero-pers">${pers}</div>` : ''}`;
      } else {
        head.classList.add('uv-praca-faixa', 'is-' + c);
        head.innerHTML = `<div class="uv-pf-id"><span class="uv-faixa-ico" aria-hidden="true">🏙️</span><span class="uv-faixa-txt"><b id="dashboard-title">Praça de Sertânia</b><small>${esc(hoje)}</small></span></div>${pulso}<div class="uv-pf-acoes">${btn}${pers}</div>`;
      }
    }
    const blocoEl = {campo: shell.querySelector('.dashboard-field-focus'), mapa: shell.querySelector('.map-shortcut-card'), secretarias: shell.querySelector('.secretary-launch-section')};
    B.ordem.filter(id => blocoEl[id]).forEach(id => { const el = blocoEl[id]; el.hidden = !B.liga(id); shell.appendChild(el); });
    shell.querySelectorAll('.secretary-launch-card').forEach(card => {
      const id = (card.getAttribute('onclick') || '').match(/openDemandSecretaria\((?:&quot;|")(.*?)(?:&quot;|")\)/)?.[1];
      const sec = secs.find(s => String(s.id) === id) || secs.find(s => norm(s.name) === norm(card.querySelector('strong')?.textContent));
      const m = mundoDe(sec?.name || card.querySelector('strong')?.textContent);
      card.classList.add('uv-card'); card.setAttribute('style', (card.getAttribute('style') || '') + ';' + vars(m));
      const icon = card.querySelector('.secretary-launch-icon'); if (icon) icon.innerHTML = `<span class="uv-card-emoji">${m.emoji}</span>`;
      const copy = card.querySelector('.secretary-launch-copy');
      if (copy && !copy.querySelector('.uv-card-mundo')) {
        const st = sec ? estat(gruposDa(sec.id)) : null;
        if (m.nome) copy.insertAdjacentHTML('afterbegin', `<em class="uv-card-mundo">${esc(m.nome)}</em>`);
        if (st && st.atrasados.length) copy.insertAdjacentHTML('beforeend', `<i class="uv-card-alerta">⏰ ${plural(st.atrasados.length, 'atrasado', 'atrasados')}</i>`);
      }
      const art2 = document.createElement('span'); art2.className = 'uv-card-art'; art2.innerHTML = art(m.art); card.appendChild(art2);
    });
  };

  /* ── tela do grupo e módulos: aurora + selo do mundo ── */
  window.universoMundoGrupo = function (gid) {
    const g = (S().secs || []).find(x => x.id === gid); if (!g) return;
    const sec = window.groupHomeSecretary?.(g) || (S().secretarias || []).find(s => s.id === g.demanda_secretaria_id);
    const m = mundoDe(sec?.name || g.name); aplicarMundo(m, 'grupo');
    const Bg = window.uvBlocos?.('grp:' + gid); const c = document.getElementById('content');
    if (c && Bg) c.dataset.uvOff = Bg.defs.filter(d => !Bg.liga(d.id)).map(d => d.id).join(' ');
    const head = document.querySelector('#content .activity-page-heading');
    if (head && !head.querySelector('.uv-selo')) {
      const sp = espacoDe(g, m);
      head.classList.add('uv-head');
      head.insertAdjacentHTML('afterbegin', `<span class="uv-selo">${m.emoji} ${m.nome ? esc(m.nome) : ''}${sec?.name ? ` <i>${m.nome ? '· ' : ''}${esc(sec.name)}</i>` : ''}</span>`);
      const t = head.querySelector('.page-title'); if (t && !t.querySelector('.uv-esp')) t.insertAdjacentHTML('afterbegin', `<span class="uv-esp" aria-hidden="true">${sp.ico}</span>`);
    }
  };
  window.uvPersonalizarGrupo = gid => { const g = (S().secs || []).find(x => x.id === gid); document.querySelectorAll('.gcb-menu[open]').forEach(d => d.open = false);
    window.uvPersonalizar('grp:' + gid, g?.name || 'este grupo', () => { const Bg = window.uvBlocos('grp:' + gid), c = document.getElementById('content'); if (c) c.dataset.uvOff = Bg.defs.filter(d => !Bg.liga(d.id)).map(d => d.id).join(' '); }, sel => !!document.querySelector('#content ' + sel)); };
  const MOD_MUNDO = {contas: 'financas', multas: 'transportes', frota: 'transportes', extintores: 'defesa', licitacoes: 'financas', estoque: 'administracao', pocos: 'agricultura', leite: 'agricultura', eventos: 'cultura', cadastros: 'administracao', empregos: 'administracao', atendimentos: 'praca'};
  window.universoMundoModulo = function (modId) {
    if (modId === 'atendimentos') return; // a página da secretaria marca o próprio mundo
    const key = Object.entries(MOD_MUNDO).find(([k]) => String(modId || '').toLowerCase().includes(k))?.[1];
    const sec = window.secretaryOfModule?.(modId);
    const m = sec ? mundoDe(sec.name) : MUNDOS.find(x => x.key === key) || PRACA; aplicarMundo(m, 'modulo');
  };
  window.universoDecorarWorkspace = function (sec) {
    const m = mundoDe(sec?.name), box = document.querySelector('#content .secretary-workspace'); if (!box) return;
    aplicarMundo(m, 'escolha'); box.classList.add('uv-ws');
    const h = box.querySelector('header'); if (h && !h.querySelector('.uv-art')) { h.insertAdjacentHTML('beforeend', `<div class="uv-ws-art">${art(m.art)}</div>`); const k = h.querySelector('.workspace-kicker'); if (k) k.textContent = `${m.emoji} ${m.rotulo}`; }
  };
  window.universoDecorarSidebar = function (host) {
    (host || document).querySelectorAll('.sidebar-secretary-link').forEach(a => {
      if (a.dataset.uv) return; a.dataset.uv = '1';
      const m = mundoDe(a.querySelector('span:not(.demand-dot)')?.textContent || a.textContent);
      a.style.setProperty('--uv-b', m.b);
      a.dataset.emoji = m.emoji; a.classList.add('uv-side'); // emoji pelo CSS: não entra no texto (leitores de tela e testes leem só o nome)
      a.title = `${m.nome ? m.nome + ' · ' : ''}${a.textContent.replace('›', '').trim()}`;
    });
  };
})();
