'use strict';

let _ = require('lodash');
let Promise = require('bluebird');
let Component = require('./component');
let errors = require('digs-common/errors');
let child_process = require('child_process');
let DigsEmitter = require('digs-common/digs-emitter');
let DigsClient = require('digs-client');
let slugify = require('digs-common/slugify');
let pipeEvent = require('pipe-event');

let debug = require('debug')('digs-local:local');

const RETRY_MAX_TRIES = 3;
const READY_TIMEOUT_MS = 1e4;
const RETRY_TIMEOUT_MS = 3e4;

/**
 * @typedef {Object} LocalDeviceConfig
 * @property {?string} id Unique identifier
 * @property {?string} port Port local device is on.  If not specified, J5 will
 *     auto-detect.
 */

class LocalDevice extends DigsEmitter {

  /**
   * Sets opts and gives the LocalDevice a unique identifier, if necessary.
   * @summary Represents a development local connected to the digs server.
   * @param {LocalDeviceConfig} [config] Local device configuration
   * @constructor
   */
  constructor(config) {
    super(config);

    _.defaults(config, {
      readyTimeout: READY_TIMEOUT_MS,
      retryInterval: RETRY_TIMEOUT_MS,
      retryMaxTries: RETRY_MAX_TRIES
    });


    // assign relevant opts.options to self, including some stuff from opts
    _.extend(this, config.options, _.pick(config, 'id', 'name', 'description'));

    // opts will be passed into j5
    this.opts = _.omit(config, 'options');

    this.componentMap = {};

    debug('%s instantiated w/ options', this, config);
  }


  /**
   * Starts the local by forking J5.
   * @param {Function} [callback] Optional callback if not using Promises
   * @returns {Promise.<LocalDevice>} This LocalDevice
   */
  start(callback) {
    if (this._proc) {
      // warn?
      debug('%s: already started!', this);
      return Promise.resolve(this);
    }
    debug('%s: starting', this);

    return this.fork()
      .bind(this)
      .catch(errors.ForkError, function (err) {
        debug(err.message);
        this.emit('error:fork', err);
        throw err;
      })
      .catch(function (err) {
        debug(err.message);
        this.emit('error', err);
        throw err;
      })
      .then(function () {
        let components = this.opts.components,
          size = _.size(components);
        if (size) {
          debug('%s: instantiating %d components', this, size);
          return _.map(components, function (opts, idx) {
            if (!_.isNumber(idx)) {
              opts.id = idx;
            }
            return this.component(opts.class, _.omit(opts, 'class'))
              .bind(this)
              .catch(function (err) {
                this.emit('warning', '"%s" component with ID "%s" failed to ' +
                  'initialize: %j', err);
                return Promise.reject(err);
              });
          }, this);
        }
        this.warn('No components configured!  Not much to do.');
      })
      .then(function (instantiations) {
        if (instantiations) {
          return Promise.settle(instantiations);
        }
      })
      .return(this)
      .nodeify(callback);
  }

  /**
   * Disconnects the J5 process.
   * @returns {LocalDevice} This LocalDevice.
   */
  stop() {
    if (this._worker && this._worker.connected) {
      this._worker.kill();
      debug('%s: disconnected', this);
    }
    return this;
  }

  /**
   * For `JSON.stringify()`; choose user-visible fields
   * @returns {Object} Object representation of this LocalDevice suitable for
   *     JSON.stringify()
   */
  toJSON() {
    return {
      id: this.id,
      port: this.port,
      connected: this.connected,
      ready: this.ready,
      components: _.keys(this.componentMap),
      opts: _.omit(this.opts, 'components')
    };
  }

  /**
   * Readies a Component with specified J5 class and opts.
   * @param {string} componentClass J5 class
   * @param {(Object|Array)} [opts] Options to constructor
   * @returns {Component} New Component instance
   */
  component(componentClass, opts) {
    debug('%s: instantiating a "%s" component w/ opts:', this, componentClass,
      _.omit(opts, 'board'));

    let component = new Component(this, componentClass, opts);
    pipeEvent('error', component, this);
    return component.instantiate()
      .bind(this)
      .then(function (component) {
        return (this.componentMap[component.id] = component);
      });
  }

  get components() {
    return _.values(this.componentMap);
  }

  kill() {
    let proc = this._proc;
    if (proc && proc.connected) {
      let pid = proc.pid;
      proc.kill();
      this._proc = null;
      debug(`${this}: Killed worker with PID ${pid}`);
    } else if (proc) {
      debug('Child process already dead');
    }
    else {
      debug('Child process never forked');
    }
  }

  /**
   * Forks a `ChildProcess`; attaches event listeners
   * @param {number} [attempt] Number of forking attempts
   * @returns {Worker} Worker process
   */
  fork(attempt) {
    // TODO retry attempts
    attempt = attempt || 1;

    if (this.client || this._proc) {
      throw new Error('Fork in progress');
    }

    let digs = this._board.digs;
    let address = digs.broker.address();
    let proc, client,
      board = this._board;

    return new Promise(function (resolve, reject) {
      function cleanup(err) {
        debug(err);
        client.removeAllListeners();
        proc.removeAllListeners();
        return client.disconnect()
          .finally(function () {
            debug('%s: DigsClient terminated', board);
            return new Promise(function (resolve) {
              function _resolve() {
                debug('%s: ChildProcess destroyed', board);
                resolve();
              }

              proc.once('exit', _resolve)
                .once('error', _resolve)
                .kill();
            });
          })
          .then(function () {
            reject(err);
          });
      }

      client = this.client =
        new DigsClient({
          id: this.id,
          host: address.address,
          port: address.port,
          project: digs.project,
          namespace: digs.namespace,
          monitor: _.get(digs.opts, 'client.monitor')
        })
          .once('error', cleanup)
          .once('close', cleanup)
          .once('topic:online', function (message) {
            let clientId = message.clientId;
            debug('%s: Local client "%s" online', this, clientId);
            proc.removeListener('disconnect', reject);
            resolve(clientId);
          });

      client.subscribe({
        clientId: `${this.id}-local`,
        project: digs.project,
        wildcard: '#'
      });

      proc = this._proc = child_process.fork(PEON_PATH, {
        env: _.extend({
          DIGS_MQTT_PORT: address.port,
          DIGS_MQTT_HOST: address.address,
          DIGS_ID: this.id,
          DIGS_NAMESPACE: digs.namespace,
          DIGS_PROJECT: digs.project
        }, process.env)
      })
        .once('error', function (err) {
          if (attempt < this.retryMaxTries) {
            this.fork(++attempt);
          }
          cleanup(new errors.ForkError(err, this));
        }.bind(this))
        .once('disconnect', cleanup);
    }.bind(this))
      .bind(this)
      .catch(function (err) {
        delete this._proc;
        delete this.client;
        debug(err);
        return Promise.reject(err);
      })
      .then(function () {
        return new Promise(function (resolve, reject) {
          this.client.request('init',
            _.omit(this._board.opts, 'components', 'options'))
            .then(resolve);

          this._proc.once('message', function (err) {
            debug(err);
            reject(new errors.ForkError(err, this._board));
          }.bind(this));
        }.bind(this));
      })
      .then(function (response) {
        if (response.id) {
          debug('LocalDevice "%s" ready!', this.id);
          this.port = this._board.port || response.port;
          this.ready = true;
        } else {
          throw new errors.ForkError(`Failed to initialize Board "${this.id}"`);
        }
      });
  }

  request() {
    return this.client.request.apply(this.client, arguments);
  }

  publish() {
    return this.client.request.apply(this.client, arguments);
  }

  get connected() {
    return this._proc && this._proc.connected;
  }

}

module.exports = LocalDevice;
