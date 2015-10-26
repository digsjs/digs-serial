'use strict';

const common = require('digs-common');
const Promise = common.Promise;
const definitions = common.definitions;
const DigsObject = definitions.DigsObject;
const DigsFSM = definitions.DigsFSM;
const DigsIdentifier = definitions.DigsIdentifier;

const DigsSerialDevice = DigsObject
  .compose(DigsIdentifier)
  .static({
    defName: 'DigsSerialDevice'
  })
  .compose(DigsFSM)
  .initial('stopped')
  .events([
    {
      name: 'start',
      from: 'stopped',
      to: 'started'
    },
    {
      name: 'stop',
      from: 'started',
      to: 'stopped'
    },
    {
      name: 'restart',
      from: 'started'
    }
  ])
  .refs({
    autoStart: false
  })
  .methods({
    onstart() {},
    onstop(opts) {
      if (opts.from) {
        console.log(opts.from);
        console.log('stopped');
      }
    }
  })
  .init(function init() {
    if (this.autoStart) {
      return this.start()
        .return(this);
    }
    return Promise.resolve(this);
  })
  .methods({});

module.exports = DigsSerialDevice;
