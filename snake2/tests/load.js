// Loads the browser scripts into ONE vm context, in page order, so the tests
// see exactly the same global scope the page does (no module wrappers needed).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ORDER = ['config', 'roman', 'grid', 'snake', 'rules', 'bots', 'game'];

function load() {
  const ctx = vm.createContext({});
  for (const name of ORDER) {
    const file = path.join(__dirname, '..', 'js', name + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: name + '.js' });
  }
  // const/let globals are not on the context object, so read them through the script scope.
  return new Proxy(ctx, {
    get: (t, k) => (k in t ? t[k] : vm.runInContext(String(k), t)),
  });
}

// Copy a context object into plain JS so node's deepStrictEqual compares values, not prototypes.
function plain(x) {
  return JSON.parse(JSON.stringify(x));
}

module.exports = { load, plain };
