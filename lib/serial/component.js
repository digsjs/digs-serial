/**
 * @module models/component
 */

'use strict';

let DigsEmitter = require('digs-common/digs-emitter');
let _ = require('lodash');
let slugify = require('digs-common/slugify');

class Component extends DigsEmitter {
  /**
   *
   * @param {SerialDevice} serialDevice LocalDevice instance
   * @param {string} componentClass Johnny-Five class name
   * @param {Object} [opts={}] Options for the class constructor
   */
  constructor(server, serialDevice, componentClass, opts) {
    super();

    this._serialDevice = serialDevice;
    this.componentClass = Component.normalize(componentClass);
    opts = opts || {};
    let name = opts.name || opts.id;
    let id = opts.id = slugify(name) || _.uniqueId(`${this.componentClass}-`);
    _.extend(this, {
      name: name || id,
      description: opts.description || name || id,
      id: id
    });
    delete opts.description;
    delete opts.name;
    this.opts = opts;
    this._server = server;
  }

  log(data) {
    this._server.log(['digs-serial', 'component'], data);
  }

  static normalize(componentClass) {
    return _.capitalize(_.camelCase(componentClass));
  }

  publish(topic, data) {
    return this._serialDevice.publish(topic, data);
  }

  when(fulfilledEvent, rejectedEvent) {
    return this._serialDevice.when(fulfilledEvent, rejectedEvent);
  }

  instantiate(callback) {
    return this.publish('instantiate', {
        componentClass: this.componentClass,
        opts: this.opts
      })
      .bind(this)
      .then(function() {
        return this.when('instantiated', 'error');
      })
      .then(function(data) {
        this._server.log('debug', `Got data: ${JSON.stringify(data)}`);
        let id = data.id;
        this.id = id;
        this.log(`Instantiated J5 "${data.componentClass}" with id "${id}"`);

        //
        //this._server.route({
        //  method: 'GET',
        //  path: th
        //})

        let methods = this.methods = data.methods;
        _.each(methods, function(methodName) {
          this[methodName] = function(args, callback) {
            return this.publish('execute', {
                id: this.id,
                method: methodName,
                args: [].concat(args)
              })
              .bind(this)
              .then(function() {
                return this.when('executed', 'error');
              })
              .nodeify(callback);
          }.bind(this);
        }, this);
        this.log(`Attached methods to prototype: ${methods}`);

        return this;
      })
      .catch(function(err) {
        this._server.log('error', err.message);
        throw new Error(err);
      })
      .nodeify(callback);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      methods: this.methods,
      type: this.componentClass
    };
  }

}

module.exports = Component;
