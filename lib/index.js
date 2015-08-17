'use strict';

let Serial = require('./serial');
let pkg = require('../package.json');
let serialports = require('./ports');

function digsSerial(server, opts, next) {
  opts = opts || {};

  server.log('digs-serial', 'Initializing digs-serial');

  let serial = new Serial(server, opts);
  serial.start()
    .then(function expose() {
      server.expose('serialPorts', serialports(server));
      server.expose('serialDevices', serial.devices);
    })
    .catch(function fail(err) {
      server.log(['error'], err);
    })
    .then(function report() {
      server.log('digs-serial', 'Registered successfully');
    })
    .finally(next);
}

digsSerial.attributes = {
  pkg: pkg,
  dependencies: 'digs'
};

module.exports = digsSerial;
