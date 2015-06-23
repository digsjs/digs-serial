'use strict';

let serialport = require('serialport');

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
    .then(function (ports) {
      if (usbDb) {
        _.each(ports, function (port) {
          let vendor, product;
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
      return (this.ports = ports);
    });
}
