import { describe, expect, it } from 'vitest';
import { loadScript, makeS } from './helpers/loadScript.js';

const NAMES = ['MODULOS', 'NOME_MODULO', '_modFromName', '_myPerms', '_md'];

function load(S) {
  return loadScript('js/modulos.js', NAMES, S === undefined ? {} : { S });
}

const { exports: mod, window } = load(makeS());

describe('MODULOS', () => {
  it('expoe o catalogo em window.MODULOS', () => {
    expect(window.MODULOS).toBe(mod.MODULOS);
  });

  it('tem ids unicos e o modulo generico por ultimo', () => {
    const ids = mod.MODULOS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(mod.MODULOS.at(-1)).toMatchObject({ id: 'atividades', isAtividades: true });
  });

  it('so usa flags de coluna nos modulos com controle proprio', () => {
    const comFlag = mod.MODULOS.filter((m) => m.flag).map((m) => [m.id, m.flag]);
    expect(comFlag).toEqual([
      ['contas', 'controle_contas'],
      ['distribuicao', 'controle_distribuicao'],
      ['estoque', 'controle_estoque'],
    ]);
  });
});

describe('_modFromName', () => {
  it.each([
    ['Expocose 2026', 'eventos'],
    ['Projeto das Cisternas', 'projetos'],
    ['Demandas de Barreiros', 'obras'],
    ['Seguro dos Veículos', 'frota'],
    ['Serviços de Urgência', 'atendimentos'],
    ['Contratos e BCCs', 'rh'],
    ['Controle de Contas', 'contas'],
    ['Distribuição de Leite', 'distribuicao'],
    ['Secretaria de Saúde — Farmácia', 'estoque'],
    ['Aluguéis de Imóveis', 'alugueis'],
    ['Proteção da Mulher', 'mulher'],
    ['Compromisso da Prefeita', 'agenda_prefeita'],
  ])('classifica %s como %s', (nome, esperado) => {
    expect(mod._modFromName(nome)).toBe(esperado);
  });

  it('cai em atividades quando nada casa', () => {
    expect(mod._modFromName('Assunto Desconhecido')).toBe('atividades');
    expect(mod._modFromName('')).toBe('atividades');
    expect(mod._modFromName(null)).toBe('atividades');
  });

  it('respeita a ordem do catalogo quando ha mais de um termo', () => {
    // 'eventos' vem antes de 'contas' em MODULOS
    expect(mod._modFromName('Evento de Contas')).toBe('eventos');
    // 'agenda' pertence a eventos e por isso vence 'agenda da prefeita'
    expect(mod._modFromName('Agenda da Prefeita')).toBe('eventos');
  });
});

describe('_myPerms / userCan', () => {
  it('nega tudo sem estado global', () => {
    const { window: w } = load(undefined);
    expect(w.userCan('contas')).toBe(false);
    expect(w.userCan('contas', 'criar')).toBe(false);
  });

  it('libera tudo para admin', () => {
    const { window: w } = load(makeS({ isAdmin: true }));
    expect(w.userCan('contas')).toBe(true);
    expect(w.userCan('contas', 'editar')).toBe(true);
    expect(w.userCan('qualquer-coisa', 'acao-inexistente')).toBe(true);
  });

  it('respeita as permissoes por modulo', () => {
    const { window: w } = load(
      makeS({ permissoes: { modulos: { contas: { acesso: true, criar: true }, estoque: { acesso: true } } } }),
    );
    expect(w.userCan('contas')).toBe(true);
    expect(w.userCan('contas', 'criar')).toBe(true);
    expect(w.userCan('contas', 'editar')).toBe(false);
    expect(w.userCan('estoque', 'criar')).toBe(false);
    expect(w.userCan('frota')).toBe(false);
  });

  it('gerenciar implica criar e editar', () => {
    const { window: w } = load(makeS({ permissoes: { modulos: { rh: { gerenciar: true } } } }));
    expect(w.userCan('rh', 'criar')).toBe(true);
    expect(w.userCan('rh', 'editar')).toBe(true);
    expect(w.userCan('rh', 'acesso')).toBe(false);
  });

  it('devolve false para acoes desconhecidas de nao-admin', () => {
    const { window: w } = load(makeS({ permissoes: { modulos: { rh: { gerenciar: true } } } }));
    expect(w.userCan('rh', 'excluir')).toBe(false);
  });
});

describe('_md.fmtD', () => {
  it('formata datas no padrao pt-BR', () => {
    expect(mod._md.fmtD('2026-08-19')).toBe('19/08/2026');
    expect(mod._md.fmtD('2026-08-19T15:30')).toBe('19/08/2026');
  });

  it('usa travessao para vazio e devolve o original para data invalida', () => {
    expect(mod._md.fmtD('')).toBe('—');
    expect(mod._md.fmtD(null)).toBe('—');
    expect(mod._md.fmtD('nao-e-data')).toBe('Invalid Date');
  });
});

describe('_md.pColor', () => {
  it('escolhe a cor pela faixa de progresso', () => {
    expect(mod._md.pColor(100)).toBe('#10b981');
    expect(mod._md.pColor(50)).toBe('#3b82f6');
    expect(mod._md.pColor(0)).toBe('#334155');
  });
});

describe('_md.extra', () => {
  it('aceita objeto e JSON em texto', () => {
    expect(mod._md.extra({ extra_fields: { modulo: 'rh' } })).toEqual({ modulo: 'rh' });
    expect(mod._md.extra({ extra_fields: '{"modulo":"rh"}' })).toEqual({ modulo: 'rh' });
  });

  it('devolve objeto vazio para ausente ou JSON invalido', () => {
    expect(mod._md.extra({})).toEqual({});
    expect(mod._md.extra({ extra_fields: '{invalido' })).toEqual({});
  });
});

describe('_md.modFor / modForSec', () => {
  it('prioriza o modulo declarado em extra_fields', () => {
    expect(window.modForSec({ extra_fields: { modulo: 'frota' }, name: 'Controle de Contas' })).toBe('frota');
  });

  it('usa as flags de controle na ausencia de extra_fields', () => {
    expect(window.modForSec({ controle_estoque: 1 })).toBe('estoque');
    expect(window.modForSec({ controle_estoque_modelo: 1 })).toBe('estoque');
    expect(window.modForSec({ controle_contas: 1 })).toBe('contas');
    expect(window.modForSec({ controle_distribuicao: 1 })).toBe('distribuicao');
  });

  it('cai na heuristica de nome e depois na descricao', () => {
    expect(window.modForSec({ name: 'Distribuição de Leite' })).toBe('distribuicao');
    expect(window.modForSec({ name: '', description: 'Compromisso da Prefeita' })).toBe('agenda_prefeita');
    expect(window.modForSec({})).toBe('atividades');
  });
});

describe('_md.grupos', () => {
  it('filtra os grupos do modulo e ordena por order_num', () => {
    const secs = [
      { id: 'b', name: 'Contas B', controle_contas: 1, order_num: 2 },
      { id: 'a', name: 'Contas A', controle_contas: 1, order_num: 1 },
      { id: 'c', name: 'Frota', extra_fields: { modulo: 'frota' } },
    ];
    const { exports: m } = load(makeS({ secs }));
    const contas = m.MODULOS.find((x) => x.id === 'contas');
    expect(m._md.grupos(contas).map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('agrupa em atividades tudo que nao casa com outro modulo', () => {
    const secs = [{ id: 'x', name: 'Assunto Desconhecido' }];
    const { exports: m } = load(makeS({ secs }));
    const atividades = m.MODULOS.find((x) => x.isAtividades);
    expect(m._md.grupos(atividades).map((g) => g.id)).toEqual(['x']);
  });

  it('devolve lista vazia sem estado global', () => {
    const { exports: m } = load(undefined);
    expect(m._md.grupos(m.MODULOS[0])).toEqual([]);
  });
});

describe('_md.ativTotal', () => {
  it('conta os itens do grupo', () => {
    const items = [
      { id: 'i1', atividade_id: 'g1' },
      { id: 'i2', atividade_id: 'g1' },
      { id: 'i3', atividade_id: 'g2' },
    ];
    expect(load(makeS({ items })).exports._md.ativTotal({ id: 'g1' })).toBe(2);
    expect(load(undefined).exports._md.ativTotal({ id: 'g1' })).toBe(0);
  });
});

describe('_md.pct', () => {
  function comEstado(items, subitems) {
    return load(makeS({ items, subitems }));
  }

  it('devolve zero para grupo sem itens', () => {
    const { exports: m } = comEstado([], []);
    expect(m._md.pct({ id: 'g1' })).toBe(0);
  });

  it('calcula o percentual de itens concluidos', () => {
    const items = [
      { id: 'i1', atividade_id: 'g1', concluded: 1 },
      { id: 'i2', atividade_id: 'g1', concluded: 0 },
      { id: 'i3', atividade_id: 'g1', concluded: 0 },
      { id: 'i4', atividade_id: 'g2', concluded: 0 },
    ];
    const { exports: m } = comEstado(items, []);
    expect(m._md.pct({ id: 'g1' })).toBe(33);
  });

  it('olha somente a flag do item, ignorando sub-itens concluidos', () => {
    const items = [{ id: 'i1', atividade_id: 'g1', concluded: 0 }];
    const subs = [
      { id: 's1', item_id: 'i1', concluded: 1 },
      { id: 's2', item_id: 'i1', concluded: 1 },
    ];
    expect(comEstado(items, subs).exports._md.pct({ id: 'g1' })).toBe(0);
  });

  it('aceita concluded como texto (comparacao solta)', () => {
    const items = [{ id: 'i1', atividade_id: 'g1', concluded: '1' }];
    expect(comEstado(items, []).exports._md.pct({ id: 'g1' })).toBe(100);
  });

  it('devolve 100 quando todos os itens estao concluidos', () => {
    const items = [
      { id: 'i1', atividade_id: 'g1', concluded: 1 },
      { id: 'i2', atividade_id: 'g1', concluded: 1 },
    ];
    expect(comEstado(items, []).exports._md.pct({ id: 'g1' })).toBe(100);
  });
});

describe('renderModulos', () => {
  it('mostra apenas os modulos liberados para o usuario', () => {
    const { window: w, document } = loadScript('js/modulos.js', NAMES, {
      S: makeS({ permissoes: { modulos: { contas: { acesso: true } } } }),
    });
    w.renderModulos();
    const html = document.getElementById('content').innerHTML;
    expect(html).toContain('Controle de Contas');
    expect(html).not.toContain('Controle de Estoque');
  });

  it('avisa quando nenhum modulo esta liberado', () => {
    const { window: w, document } = loadScript('js/modulos.js', NAMES, { S: makeS() });
    w.renderModulos();
    expect(document.getElementById('content').innerHTML).toContain('Nenhum módulo liberado');
  });
});

describe('renderModulo', () => {
  it('avisa modulo inexistente e acesso negado', () => {
    const mensagens = [];
    const { window: w, document } = loadScript('js/modulos.js', NAMES, {
      S: makeS(),
      toast: (msg, tipo) => mensagens.push([msg, tipo]),
    });
    w.renderModulo('nao-existe');
    w.renderModulo('contas');
    expect(mensagens).toEqual([
      ['Módulo não encontrado', 'error'],
      ['Acesso negado a este módulo', 'error'],
    ]);
    expect(document.getElementById('content').innerHTML).toBe('');
  });

  it('renderiza os grupos do modulo liberado', () => {
    const { window: w, document } = loadScript('js/modulos.js', NAMES, {
      S: makeS({
        permissoes: { modulos: { contas: { acesso: true } } },
        secs: [{ id: 'g1', name: 'Conta de Luz', controle_contas: 1 }],
      }),
    });
    w.renderModulo('contas');
    const html = document.getElementById('content').innerHTML;
    expect(html).toContain('Conta de Luz');
    expect(html).not.toContain('+ Novo Grupo');
  });
});
