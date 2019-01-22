#!/usr/bin/env node

var packageJSON = require('require-module')('./package.json');
var deploy = require('./lib/deploy');

var cfg = packageJSON['git-deploy'] || {};
deploy(cfg);
