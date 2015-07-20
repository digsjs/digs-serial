/**
 * @module models/component
 */

'use strict';

let DigsEmitter = require('digs-common/digs-emitter');
let _ = require('lodash');
let slugify = require('digs-common/slugify');

let debug = require('debug')('digs:digs-local:component');

/**
 * @alias module:models/component
 */
class Component extends DigsEmitter {
  /**
   *
   * @param {LocalDevice} localDevice LocalDevice instance
   * @param {string} componentClass Johnny-Five class name
   * @param {Object} [opts={}] Options for the class constructor
   */
  constructor(localDevice, componentClass, opts) {
    super();

    this._localDevice = localDevice;
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
  }

  static normalize(componentClass) {
    return _.capitalize(_.camelCase(componentClass));
  }

  publish(topic, data) {
    topic = `${this.id}/${topic}`;
    return this._localDevice.publish(topic, data);
  }

  instantiate(callback) {
    return this.publish('instantiate', {
      componentClass: this.componentClass,
      opts: this.opts
    })
      .bind(this)
      .then(function() {
        return this.when('instantiated');
      })
      .then(function(data) {
        let id = data.id;
        this.id = id;
        debug('Instantiated J5 "%s" with id "%s"', data.componentClass, id);
        return this._localDevice.request('dir', {
          id: id
        });
      })
      .get('methods')
      .then(function(methods) {
        this.methods = methods;
        _.each(methods, function(methodName) {
          this[methodName] = function(args, callback) {
            return this._localDevice.request('execute', {
              id: this.id,
              method: methodName,
              args: [].concat(args)
            })
              .nodeify(callback);
          }.bind(this);
        }, this);
        debug('Attached methods to prototype: %s', methods.join(', '));
        return this;
      })
      .nodeify(callback);
  }

  toJSON() {
    return _.pick(this, Component.fields);
  }

}

Component.fields = [
  'id',
  'methods',
  'componentClass',
  'description',
  'opts',
  'name'
];

module.exports = Component;
