'use strict';

let Promise = require('bluebird');
let serialport = require('serialport');
let list = Promise.promisify(serialport.list);
let _ = require('lodash');

module.exports = function serialPortsFactory(server) {

  function serialPorts(force, done) {
    let usbDb;
    if (this.ports && !force) {
      return Promise.resolve(this.ports)
        .nodeify(done);
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
        server.log('digs-serial', `Found ${ports.length} ports`);
        return ports;
      })
      .nodeify(done);
  }

  return serialPorts;
};
