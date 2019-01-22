'use strict';

var pathFn = require('path');
var fs = require('hexo-fs');
var swig = require('swig-templates');
var moment = require('moment');
var Promise = require('bluebird');
var spawn = require('child-process-promise').spawn;

var swigHelpers = {
  now: function(format) {
    return moment().format(format);
  }
};

module.exports = function(args) {
  var baseDir = args.base_dir || process.cwd();
  var deployDir = pathFn.join(baseDir, args.deploy_dir);
  var tmpDeployDir = pathFn.join(baseDir, '.deploy_git');
  var ignoreHidden = args.ignore_hidden;
  var ignorePattern = args.ignore_pattern;
  var repo = args.repo;
  var message = commitMessage(args);
  var verbose = !args.silent;
  var branch = args.branch || 'gh-pages';

  if (!repo) {
    console.error('You have to specify a repo.');
    return;
  }

  function git() {
    var len = arguments.length;
    var args = new Array(len);

    for (var i = 0; i < len; i++) {
      args[i] = arguments[i];
    }

    return spawn('git', args, {
      cwd: tmpDeployDir,
      verbose: verbose,
      stdio: 'inherit'
    });
  }

  function setup() {
    // Create a placeholder for the first commit
    return fs.writeFile(pathFn.join(tmpDeployDir, 'placeholder'), '').then(function() {
      return git('init');
    }).then(function() {
      return git('add', '-A');
    }).then(function() {
      return git('commit', '-m', 'First commit');
    });
  }

  function push() {
    return git('add', '-A').then(function() {
      return git('commit', '-m', message).catch(function() {
        // Do nothing. It's OK if nothing to commit.
      });
    }).then(function() {
      return git('push', '-u', repo, 'HEAD:'+branch, '--force');
    });
  }

  return fs.exists(tmpDeployDir).then(function(exist) {
    if (exist) return;

    console.info('Setting up Git deployment...');
    return setup();
  })
  .then(function() {
    console.info('Clearing .deploy_git folder...');
    return fs.emptyDir(tmpDeployDir);
  }).then(function() {
    var opts = {};
    console.info('Copying files from deploy folder...');
    if (typeof ignoreHidden === 'object') {
      opts.ignoreHidden = ignoreHidden.public;
    } else {
      opts.ignoreHidden = ignoreHidden;
    }

    if (typeof ignorePattern === 'string') {
      opts.ignorePattern = new RegExp(ignorePattern);
    } else if (typeof ignorePattern === 'object' && ignorePattern.hasOwnProperty('public')) {
      opts.ignorePattern = new RegExp(ignorePattern.public);
    }

    return fs.copyDir(deployDir, tmpDeployDir, opts);
  }).then(function() {
    return push();
  });
};

function commitMessage(args) {
  var message = args.m || args.msg || args.message || 'Site updated: {{ now(\'YYYY-MM-DD HH:mm:ss\') }}';
  return swig.compile(message)(swigHelpers);
}
