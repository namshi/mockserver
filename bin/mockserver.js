#!/usr/bin/env node

var http        = require('http');
var mockserver  = require('./../mockserver');
var argv        = require('yargs').argv;
var colors      = require('colors')
var info        = require('./../package.json');
var mocks       = argv.m || argv.mocks;
var port        = argv.p || argv.port;

if (!mocks || !port) {
  console.log("Mockserver v" + info.version);
  console.log();
  console.log("Usage:   mockserver -p PORT -m /PATH/TO/YOUR/MOCKS");
  console.log("Example: mockserver -p 8080 -m test/mocks");
} else {
  http.createServer(mockserver(mocks)).listen(port);
  
  console.log('Mockserver serving mocks under "' + mocks.green  + '" at ' + 'http://localhost:'.green + port.toString().green);
}