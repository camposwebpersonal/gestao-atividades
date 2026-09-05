import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadScript } from './helpers/loadScript.js';

const NAMES = [
  'CE_UNIDADES',
  '_ceEsc',
  '_ceFmtMoney',
  '_ceFmtNum',
  '_ceFator',
  '_ceUnidadeBase',
  '_ceCritico',
  '_ceCalc',
  '_ceHoje',
  '_ceReqId',
  '_ceNovaReqId',
  '_ceReqComprado',
  '_ceReqItemStatus',
  '_ceReqStatus',
  '_ceNormDesc',
];

const ce = loadScript('js/controle-estoque.js', NAMES).exports;

afterEach(() => {
  vi.useRealTimers();
});

describe('CE_UNIDADES', () => {
  it('lista as unidades suportadas', () => {
    expect(ce.CE_UNIDADES).toEqual(['UNIDADE', 'FRASCO', 'LITRO', 'CAIXA']);
  });
});

describe('_ceEsc', () => {
  it('escapa HTML e trata valores nulos', () => {
    expect(ce._ceEsc('<b>"x" & y</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
    expect(ce._ceEsc(null)).toBe('');
  });
});

describe('_ceFmtMoney', () => {
  it('formata no padrao pt-BR com duas casas', () => {
    expect(ce._ceFmtMoney(1234.5)).toBe('1.234,50');
    expect(ce._ceFmtMoney('10')).toBe('10,00');
  });

  it('trata vazio, nulo e texto como zero', () => {
    expect(ce._ceFmtMoney('')).toBe('0,00');
    expect(ce._ceFmtMoney(null)).toBe('0,00');
    expect(ce._ceFmtMoney('abc')).toBe('NaN');
  });
});

describe('_ceFmtNum', () => {
  it('mantem inteiros sem casas decimais', () => {
    expect(ce._ceFmtNum(5)).toBe('5');
    expect(ce._ceFmtNum('12')).toBe('12');
    expect(ce._ceFmtNum(null)).toBe('0');
  });

  it('usa virgula com duas casas para fracionarios', () => {
    expect(ce._ceFmtNum(2.5)).toBe('2,50');
    expect(ce._ceFmtNum(1 / 3)).toBe('0,33');
  });
});

describe('_ceFator', () => {
  const prod = { extra_fields: { ce_fator_CAIXA: '12', ce_fator_LITRO: 'x' } };

  it('le o fator da unidade', () => {
    expect(ce._ceFator(prod, 'CAIXA')).toBe(12);
  });

  it('usa 1 quando o fator e ausente, invalido ou o produto e nulo', () => {
    expect(ce._ceFator(prod, 'FRASCO')).toBe(1);
    expect(ce._ceFator(prod, 'LITRO')).toBe(1);
    expect(ce._ceFator(null, 'CAIXA')).toBe(1);
    expect(ce._ceFator({}, 'CAIXA')).toBe(1);
  });
});

describe('_ceUnidadeBase', () => {
  it('normaliza a unidade base para maiusculas sem espacos', () => {
    expect(ce._ceUnidadeBase({ extra_fields: { ce_unidade_base: ' frasco ' } })).toBe('FRASCO');
  });

  it('usa UNIDADE como padrao', () => {
    expect(ce._ceUnidadeBase(null)).toBe('UNIDADE');
    expect(ce._ceUnidadeBase({})).toBe('UNIDADE');
    expect(ce._ceUnidadeBase({ extra_fields: { ce_unidade_base: '' } })).toBe('UNIDADE');
  });
});

describe('_ceCritico', () => {
  it('le o estoque critico', () => {
    expect(ce._ceCritico({ extra_fields: { ce_estoque_critico: '10' } })).toBe(10);
  });

  it('usa zero quando ausente ou invalido', () => {
    expect(ce._ceCritico({ extra_fields: { ce_estoque_critico: 'abc' } })).toBe(0);
    expect(ce._ceCritico({})).toBe(0);
    expect(ce._ceCritico(null)).toBe(0);
  });
});

describe('_ceCalc', () => {
  const prod = { id: 'p1', extra_fields: { ce_estoque_critico: '5' } };
  const lancs = [
    { subitem_id: 'p1', tipo: 'ENTRADA', qtd_base: '10', valor_total: '100' },
    { subitem_id: 'p1', tipo: 'ENTRADA', qtd_base: 5, valor_total: 50 },
    { subitem_id: 'p1', tipo: 'SAIDA', qtd_base: '4' },
    { subitem_id: 'p2', tipo: 'ENTRADA', qtd_base: '99', valor_total: '999' },
  ];

  it('soma entradas, saidas, saldo e valor apenas do produto', () => {
    expect(ce._ceCalc(prod, lancs)).toEqual({ ent: 15, sai: 4, saldo: 11, total: 150, critico: 5 });
  });

  it('devolve zeros sem lancamentos', () => {
    expect(ce._ceCalc({ id: 'p1' }, [])).toEqual({ ent: 0, sai: 0, saldo: 0, total: 0, critico: 0 });
  });

  it('ignora quantidades e valores invalidos', () => {
    const ruins = [{ subitem_id: 'p1', tipo: 'ENTRADA', qtd_base: 'abc', valor_total: null }];
    expect(ce._ceCalc({ id: 'p1' }, ruins)).toMatchObject({ ent: 0, total: 0 });
  });
});

describe('_ceHoje', () => {
  it('devolve a data de hoje em ISO curto', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T10:00:00Z'));
    expect(ce._ceHoje()).toBe('2026-08-19');
  });
});

describe('ids de itens de requisicao', () => {
  it('_ceReqId gera sequencia incremental', () => {
    const primeiro = ce._ceReqId();
    const segundo = ce._ceReqId();
    expect(primeiro).toMatch(/^ri_\d+$/);
    expect(Number(segundo.slice(3))).toBe(Number(primeiro.slice(3)) + 1);
  });

  it('_ceNovaReqId gera ids unicos com prefixo ri_', () => {
    const ids = new Set(Array.from({ length: 50 }, () => ce._ceNovaReqId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^ri_[a-z0-9]+_[a-z0-9]{5}$/);
  });
});

describe('_ceReqComprado', () => {
  const lancs = [
    { requisicao_id: 'r1', requisicao_item_id: 'i1', tipo: 'ENTRADA', qtd_base: '3' },
    { requisicao_id: 'r1', requisicao_item_id: 'i1', tipo: 'ENTRADA', qtd_base: 2 },
    { requisicao_id: 'r1', requisicao_item_id: 'i1', tipo: 'SAIDA', qtd_base: 5 },
    { requisicao_id: 'r2', requisicao_item_id: 'i1', tipo: 'ENTRADA', qtd_base: 7 },
    { requisicao_id: 'r1', requisicao_item_id: 'i2', tipo: 'ENTRADA', qtd_base: 9 },
  ];

  it('soma somente as entradas da requisicao e do item', () => {
    expect(ce._ceReqComprado('r1', 'i1', lancs)).toBe(5);
  });

  it('devolve zero quando nao ha entradas correspondentes', () => {
    expect(ce._ceReqComprado('r3', 'i1', lancs)).toBe(0);
  });
});

describe('_ceReqItemStatus', () => {
  const item = { id: 'i1', qtd_base: 10 };
  const entrada = (qtd) => [{ requisicao_id: 'r1', requisicao_item_id: 'i1', tipo: 'ENTRADA', qtd_base: qtd }];

  it.each([
    [[], 'PENDENTE'],
    [entrada(4), 'PARCIAL'],
    [entrada(10), 'COMPRADO'],
    [entrada(11), 'EXCEDENTE'],
  ])('classifica o item conforme o comprado', (lancs, esperado) => {
    expect(ce._ceReqItemStatus('r1', item, lancs)).toBe(esperado);
  });

  it('considera item sem quantidade como excedente quando ha compra', () => {
    expect(ce._ceReqItemStatus('r1', { id: 'i1' }, entrada(1))).toBe('EXCEDENTE');
  });
});

describe('_ceReqStatus', () => {
  const req = (itens) => ({ id: 'r1', itens });
  const lanc = (itemId, qtd) => ({ requisicao_id: 'r1', requisicao_item_id: itemId, tipo: 'ENTRADA', qtd_base: qtd });

  it('devolve PENDENTE para requisicao sem itens', () => {
    expect(ce._ceReqStatus(req([]), [])).toBe('PENDENTE');
    expect(ce._ceReqStatus(req(undefined), [])).toBe('PENDENTE');
  });

  it('devolve PENDENTE quando nenhum item foi comprado', () => {
    expect(ce._ceReqStatus(req([{ id: 'i1', qtd_base: 5 }, { id: 'i2', qtd_base: 5 }]), [])).toBe('PENDENTE');
  });

  it('devolve COMPRADO quando todos os itens foram atendidos', () => {
    const itens = [{ id: 'i1', qtd_base: 5 }, { id: 'i2', qtd_base: 2 }];
    expect(ce._ceReqStatus(req(itens), [lanc('i1', 5), lanc('i2', 2)])).toBe('COMPRADO');
  });

  it('devolve PARCIAL quando so parte foi comprada', () => {
    const itens = [{ id: 'i1', qtd_base: 5 }, { id: 'i2', qtd_base: 5 }];
    expect(ce._ceReqStatus(req(itens), [lanc('i1', 5)])).toBe('PARCIAL');
  });

  it('EXCEDENTE tem precedencia sobre PARCIAL', () => {
    const itens = [{ id: 'i1', qtd_base: 5 }, { id: 'i2', qtd_base: 5 }];
    expect(ce._ceReqStatus(req(itens), [lanc('i1', 9), lanc('i2', 1)])).toBe('EXCEDENTE');
  });
});

describe('_ceNormDesc', () => {
  it('reduz a descricao a letras e numeros minusculos sem acento', () => {
    expect(ce._ceNormDesc('Álcool 70% — 1L')).toBe('alcool701l');
    expect(ce._ceNormDesc(null)).toBe('');
  });

  it('gera a mesma chave para variacoes de grafia', () => {
    expect(ce._ceNormDesc('Soro Fisiológico')).toBe(ce._ceNormDesc('soro  fisiologico'));
  });
});
