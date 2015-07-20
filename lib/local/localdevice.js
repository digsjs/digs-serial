'use strict';

let _ = require('lodash');
let Promise = require('bluebird');
let Component = require('./component');
let child_process = require('child_process');
let DigsEmitter = require('digs-common/digs-emitter');
let slugify = require('digs-common/slugify');
let pipeEvent = require('pipe-event');
let debug = require('debug')('digs:digs-local:local');

const RETRY_MAX_TRIES = 3;
const READY_TIMEOUT_MS = 1e4;
const RETRY_TIMEOUT_MS = 3e4;
const J5_CLIENT_PATH = require.resolve('./j5-client');

/**
 * @typedef {Object} LocalDeviceConfig
 * @property {?string} id Unique identifier
 * @property {?string} port Port local device is on.  If not specified, J5 will
 *     auto-detect.
 */

class LocalDevice extends DigsEmitter {

  /**
   * Sets _opts and gives the LocalDevice a unique identifier, if necessary.
   * @summary Represents a development local connected to the digs server.
   * @param {Digs} digs Digs instance
   * @param {ascoltatore} ascoltatore Ascoltatore instance
   * @param {LocalDeviceConfig} [opts] Local device configuration
   * @constructor
   */
  constructor(digs, ascoltatore, opts) {
    super();

    _.defaults(opts, {
      readyTimeout: READY_TIMEOUT_MS,
      retryInterval: RETRY_TIMEOUT_MS,
      retryMaxTries: RETRY_MAX_TRIES,
      board: {}
    });

    this.id =
      opts.id ?
        slugify(opts.id) : _.uniqueId(`${this.constructor.name}-`);
    this.name = opts.name || opts.id;
    this.description = opts.description || this.name;

    _.defaults(opts.board, {
      debug: false,
      repl: false,
      id: this.id
    });

    this._opts = opts;
    this._boardOpts = opts.board;
    this._ascoltatore = ascoltatore;
    this._digs = digs;

    this.componentMap = {};

    debug('%s instantiated w/ options', this, opts);
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
      .then(function() {
        let components = this._opts.components;
        let size = _.size(components);
        if (size) {
          debug('%s: instantiating %d components', this, size);
          return _.map(components, function(_opts, idx) {
            if (!_.isNumber(idx)) {
              _opts.id = idx;
            }
            return this.component(_opts.class, _.omit(_opts, 'class'))
              .bind(this)
              .catch(function(err) {
                this.emit('warning', '"%s" component with ID "%s" failed to ' +
                  'initialize: %j', err);
                return Promise.reject(err);
              });
          }, this);
        }
        this.warn('No components configured!  Not much to do.');
      })
      .then(function(instantiations) {
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
      _opts: _.omit(this._opts, 'components')
    };
  }

  /**
   * Readies a Component with specified J5 class and _opts.
   * @param {string} componentClass J5 class
   * @param {(Object|Array)} [_opts] Options to constructor
   * @returns {Component} New Component instance
   */
  component(componentClass, _opts) {
    debug('%s: instantiating a "%s" component w/ _opts:', this, componentClass,
      _.omit(_opts, 'board'));

    let component = new Component(this, componentClass, _opts);
    pipeEvent('error', component, this);
    return component.instantiate()
      .bind(this)
      .then(function(component) {
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

    if (this._proc) {
      return Promise.reject(new Error('Fork in progress'));
    }

    let proc = this._proc = child_process.fork(J5_CLIENT_PATH, {
      env: {
        DIGS_ID: this.id,
        DIGS_PROJECT: this._digs.project,
        DIGS_NAMESPACE: this._digs.namespace,
        DIGS_FSQ_DIR: this._opts.ascoltatoriOpts.fsq_dir,
        DIGS_BOARD_CONFIG: JSON.stringify(this._boardOpts),
        DEBUG: process.env.DEBUG
      }
    });

    return new Promise(function(resolve, reject) {
      proc.on('message', function() {
        proc.removeListener('error', reject);
        resolve();
      })
        .on('error', reject);
    })
      .bind(this)
      .then(function() {
        debug(`${this}: Successfully forked child process`);
        pipeEvent('error', proc, this);
        this.subscribe({
          clientId: this.id,
          wildcard: '+'
        }, function(message, topic) {
          this.publishAsync(topic, message)
            .then(function() {
              debug(`Published topic "${topic}" across qlobber-fsq`);
            });
        }.bind(this._ascoltatore));
      });

  }

  subscribe() {
    return this._digs.subscribe.apply(this._digs, arguments);
  }

  publish() {
    return this._digs.publish.apply(this._digs, arguments);
  }

  get connected() {
    return this._proc && this._proc.connected;
  }

}

module.exports = LocalDevice;
