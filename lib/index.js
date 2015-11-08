'use strict';

const DigsSerial = require('./serial');
const pkg = require('../package.json');
const ports = require('./ports');

function digsSerial(digs, opts, done) {
  digs.log(['digs-serial', 'debug'], 'Initializing digs-serial');

  return DigsSerial(opts || {}, digs)
    .then(() => {
      digs.expose('serialPorts', ports(digs));
      digs.log(['digs-serial', 'debug'], 'Exposed digs.plugins.serialPorts()');
    })
    .asCallback(done);
}

digsSerial.attributes = {
  pkg: pkg,
  dependencies: 'digs'
};

module.exports = digsSerial;
