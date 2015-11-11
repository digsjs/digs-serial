'use strict';

const common = require('digs-common');
const Promise = common.Promise;
const definitions = common.definitions;
const DigsObject = definitions.DigsObject;
const DigsFSM = definitions.DigsFSM;
const DigsIdentifier = definitions.DigsIdentifier;
const DigsEmitter = definitions.DigsEmitter;
let spawnm = require('spawn-module');
const _ = common.utils;
const defaultAdapter = require('./default-adapter');

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
      from: ['started', 'stopped'],
      to: 'stopped'
    },
    {
      name: 'restart',
      from: ['started', 'stopped'],
      to: 'stopped'
    }
  ])
  .refs({
    config: {},
    adapter: defaultAdapter
  })
  .methods({
    kill() {
      if (this.client) {
        spawnm.kill(this.client);
        delete this.client;
      }
    },
    onstart(opts) {
      return spawnm(this.adapter)
        .then(client => {
          this.client = Promise.promisifyAll(client);
          this.digs.on('stop', this.kill.bind(this));
          process.on('exit', this.kill.bind(this));
          return this.client.initAsync(this.config, {
            timeout: this.timeout
          });
        })
        .catch(err => {
          this.error(_.dump(err));
        })
        .return(opts);
    },
    onstop(opts) {
      this.kill();
      return opts;
    }
  })
  .compose(DigsEmitter);

module.exports = DigsSerialDevice;
