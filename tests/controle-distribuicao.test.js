import { describe, expect, it, vi, afterEach } from 'vitest';
import { loadScript } from './helpers/loadScript.js';

const NAMES = [
  'DIST_CAMPOS',
  '_distEsc',
  '_distFmtCPF',
  '_distFmtTel',
  '_distCalcIdade',
  '_distGetExtra',
  '_distNorm',
  '_distMatchesBusca',
  '_distStats',
];

function load() {
  return loadScript('js/controle-distribuicao.js', NAMES).exports;
}

const dist = load();

afterEach(() => {
  vi.useRealTimers();
});

describe('DIST_CAMPOS', () => {
  it('exige apenas a data de nascimento', () => {
    const obrigatorios = dist.DIST_CAMPOS.filter((c) => c.required).map((c) => c.key);
    expect(obrigatorios).toEqual(['Data de Nascimento do Paciente']);
  });
});

describe('_distEsc', () => {
  it('escapa caracteres de HTML', () => {
    expect(dist._distEsc('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('trata null e undefined como string vazia', () => {
    expect(dist._distEsc(null)).toBe('');
    expect(dist._distEsc(undefined)).toBe('');
  });

  it('preserva o zero', () => {
    expect(dist._distEsc(0)).toBe('0');
  });
});

describe('_distFmtCPF', () => {
  it.each([
    ['', ''],
    ['12', '12'],
    ['1234', '123.4'],
    ['1234567', '123.456.7'],
    ['12345678901', '123.456.789-01'],
  ])('formata %s como %s', (entrada, esperado) => {
    expect(dist._distFmtCPF(entrada)).toBe(esperado);
  });

  it('ignora caracteres nao numericos e trunca em 11 digitos', () => {
    expect(dist._distFmtCPF('123.456.789-01999')).toBe('123.456.789-01');
    expect(dist._distFmtCPF('abc')).toBe('');
  });
});

describe('_distFmtTel', () => {
  it.each([
    ['', ''],
    ['8', '8'],
    ['8199', '(81) 99'],
    ['8133334444', '(81) 3333-4444'],
    ['81999998888', '(81) 99999-8888'],
  ])('formata %s como %s', (entrada, esperado) => {
    expect(dist._distFmtTel(entrada)).toBe(esperado);
  });

  it('trunca acima de 11 digitos', () => {
    expect(dist._distFmtTel('+55 81 99999-8888')).toBe('(55) 81999-9988');
  });
});

describe('_distCalcIdade', () => {
  function comHoje(iso, nascimento) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${iso}T12:00:00`));
    return dist._distCalcIdade(nascimento);
  }

  it('devolve vazio sem data ou com data invalida', () => {
    expect(dist._distCalcIdade('')).toBe('');
    expect(dist._distCalcIdade(null)).toBe('');
    expect(dist._distCalcIdade('data-ruim')).toBe('');
  });

  it('formata anos e meses', () => {
    expect(comHoje('2026-08-19', '2020-02-19')).toBe('6a 6m');
  });

  it('omite os meses quando o aniversario e exato', () => {
    expect(comHoje('2026-08-19', '2000-08-19')).toBe('26a');
  });

  it('formata meses e dias para bebes', () => {
    expect(comHoje('2026-08-19', '2026-05-09')).toBe('3m 10d');
    expect(comHoje('2026-08-19', '2026-06-19')).toBe('2m');
  });

  it('formata apenas dias no primeiro mes de vida', () => {
    expect(comHoje('2026-08-19', '2026-08-09')).toBe('10d');
  });

  it('empresta dias do mes anterior quando o dia atual e menor', () => {
    expect(comHoje('2026-04-01', '2026-01-30')).toBe('2m 2d');
  });

  it('omite os dias quando o emprestimo de fevereiro zera/negativa a sobra', () => {
    // fevereiro tem menos dias que o intervalo emprestado: `dias` fica <= 0 e a
    // funcao cai no formato somente-meses.
    expect(comHoje('2026-03-01', '2026-01-30')).toBe('1m');
  });
});

describe('_distGetExtra', () => {
  it('le o campo extra pela chave', () => {
    expect(dist._distGetExtra({ extra_fields: { Telefone: '81' } }, 'Telefone')).toBe('81');
  });

  it('devolve vazio quando o item ou a chave nao existem', () => {
    expect(dist._distGetExtra(null, 'Telefone')).toBe('');
    expect(dist._distGetExtra({}, 'Telefone')).toBe('');
    expect(dist._distGetExtra({ extra_fields: {} }, 'Telefone')).toBe('');
  });
});

describe('_distNorm', () => {
  it('remove acentos e converte para maiusculas', () => {
    expect(dist._distNorm('José Antônio')).toBe('JOSE ANTONIO');
    expect(dist._distNorm(null)).toBe('');
  });
});

describe('_distMatchesBusca', () => {
  const item = {
    description: 'Maria da Silva',
    extra_fields: {
      'CPF do Paciente': '123.456.789-01',
      'Nome do Responsável': 'João Conceição',
      Fórmula: 'Nutren',
      Telefone: '(81) 99999-8888',
    },
  };

  it('aceita qualquer item quando a busca esta vazia', () => {
    expect(dist._distMatchesBusca({}, '')).toBe(true);
  });

  it('encontra por descricao, cpf, responsavel e formula', () => {
    expect(dist._distMatchesBusca(item, 'MARIA')).toBe(true);
    expect(dist._distMatchesBusca(item, '123.456')).toBe(true);
    expect(dist._distMatchesBusca(item, 'JOAO CONCEICAO')).toBe(true);
    expect(dist._distMatchesBusca(item, 'NUTREN')).toBe(true);
  });

  it('nao encontra termos ausentes e ignora campos fora da lista de busca', () => {
    expect(dist._distMatchesBusca(item, 'PEDRO')).toBe(false);
    expect(dist._distMatchesBusca({ description: '', extra_fields: {} }, 'X')).toBe(false);
  });
});

describe('_distStats', () => {
  it('devolve zeros para lista vazia', () => {
    expect(dist._distStats([])).toEqual({ total: 0, criancas: 0, adultos: 0, idosos: 0, qtdTotal: 0 });
  });

  it('classifica faixas de idade e soma a quantidade mensal', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T12:00:00'));
    const itens = [
      { extra_fields: { 'Data de Nascimento do Paciente': '1990-01-01', 'Quantidade Distribuído Mensal': '3' } },
      { extra_fields: { 'Data de Nascimento do Paciente': '1950-01-01', 'Quantidade Distribuído Mensal': '1.5' } },
      { extra_fields: { 'Data de Nascimento do Paciente': '1966-08-19', 'Quantidade Distribuído Mensal': '2' } },
      { extra_fields: {} },
    ];
    expect(dist._distStats(itens)).toEqual({
      total: 4,
      criancas: 0,
      adultos: 2,
      idosos: 2,
      qtdTotal: 6.5,
    });
  });

  it('classifica bebes como adultos porque a idade vem em meses/dias', () => {
    // `_distCalcIdade` devolve '5m'/'10d' para menores de 1 ano e o parseInt le
    // esse numero como anos, portanto `criancas` nunca e incrementado.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T12:00:00'));
    const bebes = [
      { extra_fields: { 'Data de Nascimento do Paciente': '2026-03-19' } },
      { extra_fields: { 'Data de Nascimento do Paciente': '2026-08-09' } },
    ];
    expect(dist._distStats(bebes)).toMatchObject({ total: 2, criancas: 0, adultos: 2, idosos: 0 });
  });

  it('trunca quantidades com virgula decimal (parseFloat)', () => {
    const itens = [{ extra_fields: { 'Quantidade Distribuído Mensal': '3,5' } }];
    expect(dist._distStats(itens).qtdTotal).toBe(3);
  });

  it('conta como adulto quem nao tem data de nascimento', () => {
    expect(dist._distStats([{ extra_fields: {} }])).toMatchObject({ total: 1, adultos: 1 });
  });
});
