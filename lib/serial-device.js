'use strict';

const common = require('digs-common');
const Promise = common.Promise;
const DigsObject = common.definitions.DigsObject;

const DigsSerialDevice = DigsObject
  .methods({
    start() {
      return Promise.resolve();
    }
  });

module.exports = DigsSerialDevice;
