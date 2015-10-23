'use strict';

const DigsSerial = require('./serial');
const pkg = require('../package.json');
//let serialports = require('./ports');

function digsSerial(digs, opts, next) {
  opts = opts || {};

  digs.log('digs-serial', 'Initializing digs-serial');
  next();
}

digsSerial.attributes = {
  pkg: pkg,
  dependencies: 'digs'
};

module.exports = digsSerial;
