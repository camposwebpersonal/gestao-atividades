// Carrega os scripts de navegador (js/*.js) em um contexto isolado e devolve as
// funcoes internas para teste. Os arquivos do app nao sao modulos ES: declaram
// funcoes/consts no escopo global do script, por isso sao avaliados com `vm` e
// o valor de conclusao do script expoe os nomes pedidos.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '../..');

/**
 * DOM minimo: os modulos testados aqui sao logica pura, mas os arquivos tambem
 * contem renderizadores que tocam o documento no carregamento ou em helpers.
 */
function createElementStub(id = '') {
  const el = {
    id,
    value: '',
    checked: false,
    innerHTML: '',
    style: {},
    children: [],
    appendChild(child) {
      el.children.push(child);
      return child;
    },
    addEventListener() {},
    focus() {},
    setSelectionRange() {},
  };
  return el;
}

function createDocumentStub(elements = {}) {
  return {
    elements,
    getElementById: (id) => elements[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => createElementStub(),
    head: createElementStub('head'),
    body: createElementStub('body'),
  };
}

function createDomStubs(extraGlobals = {}) {
  const { elements, windowProps, ...globals } = extraGlobals;
  const document = createDocumentStub({ content: createElementStub('content'), ...elements });
  const sandbox = {
    document,
    console,
    toast: () => {},
    closeModal: () => {},
    loadData: async () => {},
    doc: (...args) => ({ args }),
    collection: (...args) => ({ args }),
    addDoc: async () => ({ id: 'novo' }),
    updateDoc: async () => {},
    serverTimestamp: () => 'ts',
    db: {},
    curSecId: null,
    ...windowProps,
    ...globals,
  };
  // No navegador `window` E o objeto global: escrever em `window.x` cria uma
  // global. O sandbox se aponta para si mesmo para reproduzir isso.
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const window = sandbox;
  // Getters preguicosos para que os fake timers do vitest (que substituem os
  // globais do realm externo) tambem valham dentro do sandbox.
  for (const key of ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']) {
    Object.defineProperty(sandbox, key, { get: () => globalThis[key], configurable: true });
  }
  const context = vm.createContext(sandbox);
  return { context, sandbox, window, document };
}

/**
 * Avalia um script do app e devolve `{ exports, sandbox, window }`.
 *
 * @param {string} file caminho relativo a raiz do repositorio (ex.: 'js/modulos.js')
 * @param {string[]} names nomes declarados no script que devem ser expostos
 * @param {object} extraGlobals globais adicionais injetados antes da avaliacao;
 *   a chave `elements` registra elementos para `document.getElementById` e a
 *   chave `windowProps` pre-popula o objeto `window`
 */
export function loadScript(file, names, extraGlobals = {}) {
  const filename = path.join(ROOT, file);
  const source = fs.readFileSync(filename, 'utf8');
  const { context, sandbox, window, document } = createDomStubs(extraGlobals);
  const capture = `\n;({ ${names.map((n) => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(', ')} });`;
  const exports = vm.runInContext(source + capture, context, { filename });
  return { exports, sandbox, window, document };
}

export { createElementStub };

/** Estado global `S` minimo usado pelos modulos do app. */
export function makeS(overrides = {}) {
  return {
    isAdmin: false,
    permissoes: { modulos: {} },
    secs: [],
    items: [],
    subitems: [],
    fieldTemplates: [],
    estoque: [],
    requisicoes: [],
    contas: [],
    distribuicao: [],
    responsaveis: [],
    ...overrides,
  };
}
