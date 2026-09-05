import { describe, expect, it } from 'vitest';
import { createElementStub, loadScript, makeS } from './helpers/loadScript.js';

const NAMES = [
  'CC_TIPOS',
  'ccEsc',
  '_ccNorm',
  '_ccFindKey',
  '_ccLocalExtraFields',
  '_ccLocalMatchesBusca',
  '_ccTokenHit',
  '_ccHighlight',
  '_ccFiltrosTela',
];

function load(extraGlobals = {}) {
  return loadScript('js/controle-contas.js', NAMES, { S: makeS(), ...extraGlobals });
}

const { exports: cc, window } = load();

describe('CC_TIPOS', () => {
  it('lista os tipos de conta suportados', () => {
    expect(cc.CC_TIPOS).toEqual(['Luz', 'Água', 'Aluguel', 'Apólice', 'Seguro', 'Telefone', 'Internet', 'Outros']);
  });
});

describe('ccEsc', () => {
  it('escapa HTML e trata nulos', () => {
    expect(cc.ccEsc('<i>a & "b"</i>')).toBe('&lt;i&gt;a &amp; &quot;b&quot;&lt;/i&gt;');
    expect(cc.ccEsc(null)).toBe('');
  });

  it('e publicado em window.esc quando ninguem definiu antes', () => {
    expect(window.esc).toBe(cc.ccEsc);
  });

  it('nao sobrescreve window.esc definido por outro modulo', () => {
    const escPrevio = () => 'ja-existia';
    const { window: w } = load({ windowProps: { esc: escPrevio } });
    expect(w.esc).toBe(escPrevio);
  });
});

describe('_ccNorm', () => {
  it('remove acentos, converte para maiusculas e apara espacos', () => {
    expect(cc._ccNorm('  Água & Luz  ')).toBe('AGUA & LUZ');
  });
});

describe('_ccFindKey', () => {
  const ef = { 'Numero do Relógio': '123', 'CONTA CONTRATO': '456', Endereco: 'Rua A' };

  it('encontra a chave por fragmento sem acento e sem case', () => {
    expect(cc._ccFindKey(ef, 'relogio')).toBe('Numero do Relógio');
    expect(cc._ccFindKey(ef, 'conta contrato')).toBe('CONTA CONTRATO');
  });

  it('devolve null quando nenhum fragmento casa', () => {
    expect(cc._ccFindKey(ef, 'medidor')).toBeNull();
    expect(cc._ccFindKey({}, 'relogio')).toBeNull();
  });
});

describe('_ccLocalExtraFields', () => {
  it('mapeia os campos extras do local', () => {
    const local = {
      extra_fields: {
        'Numero do Relógio': '111',
        'Conta Contrato': '222',
        'Endereço': 'Rua B',
        MEDIDOR: 'M9',
      },
    };
    expect(cc._ccLocalExtraFields(local)).toEqual({
      numero_relogio: '111',
      conta_contrato: '222',
      endereco: 'Rua B',
      medidor: 'M9',
    });
  });

  it('usa CONTRATO como alternativa de CONTA CONTRATO', () => {
    const local = { extra_fields: { 'Numero do Contrato': '333' } };
    expect(cc._ccLocalExtraFields(local).conta_contrato).toBe('333');
  });

  it('devolve campos vazios quando o local nao tem extras', () => {
    expect(cc._ccLocalExtraFields(null)).toEqual({
      numero_relogio: '',
      conta_contrato: '',
      endereco: '',
      medidor: '',
    });
  });
});

describe('_ccLocalMatchesBusca', () => {
  const S = makeS({
    contas: [
      { subitem_id: 'l1', observacao: 'Vencida em janeiro' },
      { subitem_id: 'l2', observacao: 'Outra conta' },
    ],
  });
  const { exports: mod } = load({ S });
  const item = { description: 'Prédio da Prefeitura' };
  const local = { id: 'l1', description: 'Sala 2', extra_fields: { 'Numero do Relógio': 'AB-90' } };

  it('aceita tudo quando nao ha tokens', () => {
    expect(mod._ccLocalMatchesBusca(item, local, [])).toBe(true);
    expect(mod._ccLocalMatchesBusca(item, local, null)).toBe(true);
  });

  it('casa tokens vindos do item, do local, dos extras e das observacoes', () => {
    expect(mod._ccLocalMatchesBusca(item, local, ['PREDIO'])).toBe(true);
    expect(mod._ccLocalMatchesBusca(item, local, ['SALA'])).toBe(true);
    expect(mod._ccLocalMatchesBusca(item, local, ['AB-90'])).toBe(true);
    expect(mod._ccLocalMatchesBusca(item, local, ['JANEIRO'])).toBe(true);
  });

  it('exige que todos os tokens casem (AND)', () => {
    expect(mod._ccLocalMatchesBusca(item, local, ['SALA', 'JANEIRO'])).toBe(true);
    expect(mod._ccLocalMatchesBusca(item, local, ['SALA', 'FEVEREIRO'])).toBe(false);
  });

  it('nao considera observacoes de outros locais', () => {
    expect(mod._ccLocalMatchesBusca(item, local, ['OUTRA'])).toBe(false);
  });
});

describe('_ccTokenHit', () => {
  it('acerta quando qualquer token esta no texto (OR)', () => {
    expect(cc._ccTokenHit('Conta de Água', ['AGUA'])).toBe(true);
    expect(cc._ccTokenHit('Conta de Água', ['LUZ', 'AGUA'])).toBe(true);
  });

  it('devolve false sem tokens ou sem correspondencia', () => {
    expect(cc._ccTokenHit('Conta de Água', [])).toBe(false);
    expect(cc._ccTokenHit('Conta de Água', null)).toBe(false);
    expect(cc._ccTokenHit('Conta de Água', ['LUZ'])).toBe(false);
  });
});

describe('_ccHighlight', () => {
  it('devolve o texto escapado quando nao ha tokens', () => {
    expect(cc._ccHighlight('<b>x</b>', [])).toBe('&lt;b&gt;x&lt;/b&gt;');
    expect(cc._ccHighlight(null, ['A'])).toBe('');
  });

  it('marca o trecho encontrado preservando os acentos originais', () => {
    expect(cc._ccHighlight('Conta de Água', ['AGUA'])).toBe('Conta de <mark class="cc-hl">Água</mark>');
  });

  it('marca todas as ocorrencias', () => {
    expect(cc._ccHighlight('luz e luz', ['LUZ'])).toBe(
      '<mark class="cc-hl">luz</mark> e <mark class="cc-hl">luz</mark>',
    );
  });

  it('funde trechos sobrepostos em uma unica marca', () => {
    expect(cc._ccHighlight('abcd', ['ABC', 'BCD'])).toBe('<mark class="cc-hl">abcd</mark>');
  });

  it('escapa o conteudo marcado', () => {
    expect(cc._ccHighlight('a <b> c', ['<B>'])).toBe('a <mark class="cc-hl">&lt;b&gt;</mark> c');
  });

  it('devolve o texto escapado quando o token nao aparece', () => {
    expect(cc._ccHighlight('Conta & Luz', ['AGUA'])).toBe('Conta &amp; Luz');
  });

  it('ignora tokens vazios', () => {
    expect(cc._ccHighlight('Luz', ['', 'LUZ'])).toBe('<mark class="cc-hl">Luz</mark>');
  });
});

describe('_ccFiltrosTela', () => {
  it('le os filtros do formulario e tokeniza a busca', () => {
    const elements = {
      'cc-filtro-tipo': { ...createElementStub('cc-filtro-tipo'), value: 'Luz' },
      'cc-filtro-ano': { ...createElementStub('cc-filtro-ano'), value: '2026' },
      'cc-filtro-pago': { ...createElementStub('cc-filtro-pago'), value: 'pago' },
      'cc-busca': { ...createElementStub('cc-busca'), value: '  Água  prefeitura ' },
    };
    const { exports: mod } = load({ elements, S: makeS() });
    expect(mod._ccFiltrosTela('sec1')).toEqual({
      tipo: 'Luz',
      ano: '2026',
      pago: 'pago',
      busca: 'Água  prefeitura',
      buscaTokens: ['AGUA', 'PREFEITURA'],
    });
  });

  it('devolve filtros vazios quando os campos nao existem na tela', () => {
    expect(cc._ccFiltrosTela('sec1')).toEqual({ tipo: '', ano: '', pago: '', busca: '', buscaTokens: [] });
  });
});
