'use strict';

const common = require('digs-common');
const definitions = common.definitions;
const DigsIdentifier = definitions.DigsIdentifier;

const DigsSerialComponent = DigsIdentifier
  .static({
    defName: 'DigsSerialComponent'
  });

module.exports = DigsSerialComponent;
