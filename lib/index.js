'use strict';

const DigsSerial = require('./serial');
const pkg = require('../package.json');

function digsSerial(digs, opts, next) {
  opts = opts || {};

  digs.log('digs-serial', 'Initializing digs-serial');

  DigsSerial({
    config: opts
  }, digs).then(() => next());
}

digsSerial.attributes = {
  pkg: pkg,
  dependencies: 'digs'
};

module.exports = digsSerial;
