'use strict';

let Local = require('./local');
let pkg = require('../package.json');

function digsLocal(digs, opts) {
  opts = opts || {};

  let local = new Local(digs, opts);
  return local.start();
}

digsLocal.metadata = {
  name: pkg.name,
  dependencies: [],
  defaults: {},
  version: pkg.version
};

digsLocal.Local = Local;

module.exports = digsLocal;
