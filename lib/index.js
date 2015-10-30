'use strict';

const DigsSerial = require('./serial');
const pkg = require('../package.json');

function digsSerial(digs, opts, done) {
  digs.log(['digs-serial', 'debug'], 'Initializing digs-serial');

  return DigsSerial(opts || {}, digs)
    .then(() => done());
}

digsSerial.attributes = {
  pkg: pkg,
  dependencies: 'digs'
};

module.exports = digsSerial;
