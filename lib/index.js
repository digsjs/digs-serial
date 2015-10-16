'use strict';

let Serial = require('./serial');
let pkg = require('../package.json');
let serialports = require('./ports');

function digsSerial(digs, opts, next) {
  opts = opts || {};

  digs.log('digs-serial', 'Initializing digs-serial');

  let serial = new Serial(digs, opts);
  serial.start()
    .then(function expose() {
      digs.expose('serialPorts', serialports(digs));
      digs.expose('serialDevices', serial.devices);
    })
    .catch(function fail(err) {
      digs.log(['error'], err);
    })
    .then(function report() {
      digs.log('digs-serial', 'Registered successfully');
    })
    .finally(next);
}

digsSerial.attributes = {
  pkg: pkg,
  dependencies: ['digs', 'digs-mqtt-broker'],
  multiple: true
};

module.exports = digsSerial;
