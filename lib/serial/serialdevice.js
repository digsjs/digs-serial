'use strict';

let _ = require('lodash');
let Promise = require('bluebird');
let Component = require('./component');
let child_process = require('child_process');
let DigsEmitter = require('digs-common/digs-emitter');
let slugify = require('digs-common/slugify');
let pipeEvent = require('pipe-event');
let Boom = require('boom');

const RETRY_MAX_TRIES = 3;
const READY_TIMEOUT_MS = 1e4;
const RETRY_TIMEOUT_MS = 3e4;
const J5_CLIENT_PATH = require.resolve('./j5-client');

/**
 * @typedef {Object} SerialDeviceConfig
 * @property {?string} id Unique identifier
 * @property {?string} port Port local device is on.  If not specified, J5 will
 *     auto-detect.
 */

class SerialDevice extends DigsEmitter {

  /**
   * Sets _opts and gives the SerialDevice a unique identifier, if necessary.
   * @summary Represents a development local connected to the digs server.
   * @param {Digs} server Digs instance
   * @param {ascoltatore} ascoltatore Ascoltatore instance
   * @param {SerialDeviceConfig} [opts] Local device configuration
   * @constructor
   */
  constructor(server, ascoltatore, opts) {
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
    this._server = server;

    this.components = {};

    this.log(`${this}: instantiated w/ options`, opts);
  }

  log(data) {
    this._server.log(['digs-serial', 'serialdevice'], data);
  }

  /**
   * Starts the local by forking J5.
   * @param {Function} [callback] Optional callback if not using Promises
   * @returns {Promise.<SerialDevice>} This SerialDevice
   */
  start(callback) {
    if (this._starting) {
      return this._starting;
    }
    this.log(`${this}: starting`);

    return (this._starting = this._fork()
      .bind(this)
      .then(function() {
        let components = this._opts.components;
        let size = _.size(components);
        if (size) {
          this.log(`${this}: instantiating ${size} component(s)`);
          return Promise.all(_.map(components, function(opts, componentName) {
            if (_.isString(componentName)) {
              opts.id = slugify(componentName);
            }
            return this.component(opts.class, _.omit(opts, 'class'))
              .bind(this)
              .catch(function(err) {
                this.emit('warning', '"%s" component with ID "%s" failed to ' +
                  'initialize: %j', err);
                return Promise.reject(err);
              });
          }, this));
        }
        this.warn('No components configured!  Not much to do.');
      })
      .tap(function() {
        this._server.log('digs-serial', `Serial device "${this.id}" started`);
        return this;
      }))
      .nodeify(callback);
  }

  /**
   * Disconnects the J5 process.
   */
  stop() {
    if (this._proc) {
      this._proc.kill();
      this._proc = null;
      this.log(`${this}: disconnected`, this);
      return true;
    }
    return false;
  }

  /**
   * Readies a Component with specified J5 class and _opts.
   * @param {string} componentClass J5 class
   * @param {(Object|Array)} [opts] Options to constructor
   * @returns {Component} New Component instance
   */
  component(componentClass, opts) {
    this.log(`${this}: instantiating a "${componentClass}" component ` +
      `w/ _opts: ${opts}`);

    let component = new Component(this._server, this, componentClass, opts);
    pipeEvent('error', component, this);
    return component.instantiate()
      .bind(this)
      .then(function(component) {
        return (this.components[component.id] = component);
      });
  }

  /**
   * Forks a ChildProcess; attaches event listeners
   * @param {number} [attempt] Number of forking attempts
   * @returns {Worker} Worker process
   */
  _fork(attempt) {
    // TODO retry attempts
    attempt = attempt || 1;

    if (this._proc) {
      return Promise.reject(new Error('Fork in progress'));
    }

    let proc = this._proc = child_process.fork(J5_CLIENT_PATH, {
      env: {
        DIGS_ID: this.id,
        DIGS_PROJECT: this._server.project,
        DIGS_NAMESPACE: this._server.namespace,
        DIGS_FSQ_DIR: this._opts.ascoltatoriOpts.fsq_dir,
        DIGS_BOARD_CONFIG: JSON.stringify(this._boardOpts)
      }
    });

    proc.on('message', function(message) {
      switch (message.type) {
        case 'log':
          switch (message.level) {
            case 'debug':
              this.log(message.msg[0]);
              break;
          }
          break;
      }
    }.bind(this));

    this.subscribe(`${this.id}/+`, function(topic, data) {
      let event = topic.split('/').slice(1).join('/');
      this.log(`${this}: Received "${topic}"; emitting event "${event}" ` +
        `with data: ${JSON.stringify(data)}`);
      this.emit(event, data);
    });

    return this.when('ready', 'error')
      .bind(this)
      .then(function(data) {
        this.port = data.port;
        this._ready = true;

        //this._digs.subscribe({
        //  clientId: this.id,
        //  wildcard: '+'
        //}, function(topic, message) {
        //  this.publishAsync(topic, message)
        //    .then(function() {
        //      debug(`${this}: Published topic "${topic}" across qlobber-fsq`);
        //    });
        //}.bind(this._ascoltatore));


        this.log(`${this}: Board "${data.id}" is ready on port ${this.port}`);
      });
  }

  subscribe(topic, callback) {
    return this._ascoltatore.subscribe(topic, callback.bind(this));
  }

  publish(topic, data) {
    topic = `${this.id}-local/${topic}`;
    this.log(`${this} (FSQ): Publishing topic "${topic}" with data`, data);
    return this._ascoltatore.publishAsync(topic, data);
  }

  get online() {
    let starting = this._starting;
    let proc = this._proc;
    return proc && proc.connected && starting && starting.isFulfilled();
  }

  get starting() {
    let starting = this._starting;
    let proc = this._proc;
    return proc && proc.connected && starting &&
      !(starting.isFulfilled() && starting.isRejected());
  }

  get status() {
    if (this.online) {
      return 'online';
    } else if (this.starting) {
      return 'starting';
    }
    return 'stopped';
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      port: this.port,
      components: this.components
    };
  }

}

module.exports = SerialDevice;
