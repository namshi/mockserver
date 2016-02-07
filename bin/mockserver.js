#!/usr/bin/env node

var http        = require('http');
var mockserver  = require('./../mockserver');
var argv        = require('yargs').argv;
var colors      = require('colors')
var info        = require('./../package.json');
var mocks       = argv.m || argv.mocks;
var port        = argv.p || argv.port;
var verbose     = !(argv.s || argv.silent);

if (!mocks || !port) {
  console.log("Mockserver v" + info.version);
  console.log();
  console.log("Usage:   mockserver -s -p PORT -m /PATH/TO/YOUR/MOCKS");
  console.log("Example: mockserver -s -p 8080 -m test/mocks");
} else {
  http.createServer(mockserver(mocks, verbose)).listen(port);

  if (verbose) {
    console.log('Mockserver serving mocks {'
      + 'verbose'.yellow + ':' + (verbose && 'true'.green || 'false')
      + '} under "' + mocks.green  + '" at '
      + 'http://localhost:'.green + port.toString().green);
  }
}
