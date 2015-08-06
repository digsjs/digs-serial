'use strict';

let pkg = require('../../package.json');
let _ = require('lodash');

class SerialController {
  constructor(serial, opts) {

    if (SerialController.cache[serial]) {
      return SerialController.cache[serial];
    }

    if (!(this instanceof SerialController)) {
      return new SerialController(serial);
    }

    this._serial = serial;
    this._opts = opts;

    SerialController.cache[serial] = this;
  }

  get devices() {
    return _.map(this._serial.devices, DeviceController);
  }

}

SerialController.cache = new WeakMap();

class DeviceController {
  constructor(device) {

    if (DeviceController.cache[device]) {
      return DeviceController.cache[device];
    }

    if (!(this instanceof DeviceController)) {
      return new DeviceController(device);
    }

    this._device = device;

    DeviceController.cache[device] = this;
  }

  get components() {
    return _.map(this._device.components, ComponentController);
  }

  get id() {
    return this._device.id;
  }

  get port() {
    return this._device.port;
  }

  get status() {
    return this._device.status;
  }

  stop() {
    if (this._device.status === 'online') {
      this._device.stop();
    }
    return this._device.status;
  }

  start() {
    if (this._device.status === 'stopped') {
      this._device.start();
    }
    return this._device.status;
  }
}

DeviceController.cache = new WeakMap();

class ComponentController {
  constructor(component) {
    if (ComponentController.cache[component]) {
      return ComponentController.cache[component];
    }

    if (!(this instanceof ComponentController)) {
      return new ComponentController(component);
    }

    this._component = component;

    _.each(component.methods, function(methodName) {
      this[methodName] = function() {
        return component[methodName].apply(component, arguments);
      };
    }, this);
  }

}
