'use strict';

let Promise = require('bluebird');
let serialport = require('serialport');
let list = Promise.promisify(serialport.list);
let _ = require('lodash');
let debug = require('debug')('digs:digs-local:ports');

function serialPorts(force) {
  let usbDb;
  if (this.ports && !force) {
    return Promise.resolve(this.ports);
  }
  try {
    usbDb = require('../data/usb-ids.json');
  }
  catch (ignored) {
    usbDb = null;
  }
  return list()
    .bind(this)
    .then(function(ports) {
      if (usbDb) {
        _.each(ports, function(port) {
          let vendor;
          let product;
          if (port.vendorId && (vendor = usbDb[port.vendorId])) {
            port.vendor = vendor.name;
            if (port.productId &&
              (product = usbDb[port.vendorId].products[port.productId])) {
              port.product = product;
            }
          }
        });
      }
      debug('<Digs.serialPorts>: Found %d ports', ports.length);
      return ports;
    });
}

module.exports = serialPorts;
