/**
 * DEBUG=nightmare*
 */
var log = require('debug')('nightmare:log');
var debug = require('debug')('nightmare');
var electronLog = {
    stdout: require('debug')('electron:stdout'),
    stderr: require('debug')('electron:stderr')
};


/**
 * Module dependencies
 */

const default_electron_path = require('electron');
const proc = require('child_process'); 
const child = require('./lib/ipc');
const sliced = require('sliced');
const once = require('once');
const path = require('path');
var defaults = require('defaults');
var split2 = require('split2');

const noop = function () { };

/**
 * runner script
 */

const runner = path.join(__dirname, './lib/runner.js');

// Standard timeout for wait(ms)
const DEFAULT_WAIT_TIMEOUT = 30 * 1000;
// Standard timeout for loading URLs
const DEFAULT_GOTO_TIMEOUT = 30 * 1000;
// Timeout between keystrokes for `.type()`
const DEFAULT_TYPE_INTERVAL = 100;
// timeout between `wait` polls
const DEFAULT_POLL_INTERVAL = 250;
// max retry for authentication
const MAX_AUTH_RETRIES = 3;
// max execution time for `.evaluate()`
const DEFAULT_EXECUTION_TIMEOUT = 30 * 1000
// Error message when halted
const DEFAULT_HALT_MESSAGE = 'Nightmare Halted';
// Non-persistent partition to use by defaults
const DEFAULT_PARTITION = 'nightmare';

/**
 * Export `Nightmare`
 */

module.exports = Nightmare;

/**
 * Initialize `Nightmare`
 *
 * @param {Object} options
 */

function Nightmare(options) {
    if (!(this instanceof Nightmare)) return new Nightmare(options);
    options = options || {};
    var electronArgs = {};
    var self = this;

    options.waitTimeout = options.waitTimeout || DEFAULT_WAIT_TIMEOUT;
    options.gotoTimeout = options.gotoTimeout || DEFAULT_GOTO_TIMEOUT;
    options.pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;

    options.typeInterval = options.typeInterval || DEFAULT_TYPE_INTERVAL;
    options.executionTimeout = options.executionTimeout || DEFAULT_EXECUTION_TIMEOUT;
    options.webPreferences = options.webPreferences || {};

    // null is a valid value, which will result in the use of the electron default behavior, which is to persist storage.
    // The default behavior for nightmare will be to use non-persistent storage.
    // http://electron.atom.io/docs/api/browser-window/#new-browserwindowoptions
    options.webPreferences.partition = options.webPreferences.partition !== undefined ? options.webPreferences.partition : DEFAULT_PARTITION;

    options.Promise = options.Promise || Nightmare.Promise || Promise;

    var electron_path = options.electronPath || default_electron_path

    if (options.paths) {
        electronArgs.paths = options.paths;
    }

    if (options.switches) {
        electronArgs.switches = options.switches;
    }
    options.maxAuthRetries = options.maxAuthRetries || MAX_AUTH_RETRIES;

    electronArgs.loadTimeout = options.loadTimeout;
    if (options.loadTimeout && options.gotoTimeout && options.loadTimeout < options.gotoTimeout) {
        debug(`WARNING:  load timeout of ${options.loadTimeout} is shorter than goto timeout of ${options.gotoTimeout}`);
    }

    electronArgs.dock = options.dock || false;

    attachToProcess(this);

    // initial state
    this.state = 'initial';
    this.running = false;
    this.ending = false;
    this.ended = false;
    this._queue = [];
    this._headers = {};
    this.options = options;

    debug('queuing process start');
    this.queue((done) => {

        this.proc = proc.spawn(electron_path, [runner].concat(JSON.stringify(electronArgs)), {
            stdio: [null, null, null, 'ipc'],
            env: defaults(options.env || {}, process.env)
        });

        this.proc.stdout.pipe(split2()).on('data', (data) => {
            electronLog.stdout(data);
        });

        this.proc.stderr.pipe(split2()).on('data', (data) => {
            electronLog.stderr(data);
        });

        this.proc.on('close', (code) => {
            if (!self.ended) {
                handleExit(code, self, noop);
            }
        });

        this.child = child(this.proc);

        this.child.once('die', function (err) {
            debug('dying: ' + err);
            self.die = err;
        });

        // propagate console.log(...) through
        this.child.on('log', function () {
            log.apply(log, arguments);
        });

        this.child.on('uncaughtException', function (stack) {
            console.error('Nightmare runner error:\n\n%s\n', '\t' + stack.replace(/\n/g, '\n\t'));
            endInstance(self, noop);
            process.exit(1);
        });

        this.child.on('page', function (type) {
            log.apply(null, ['page-' + type].concat(sliced(arguments, 1)));
        });

        // propogate events through to debugging
        this.child.on('did-finish-load', function () { log('did-finish-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('did-fail-load', function () { log('did-fail-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('did-fail-provisional-load', function () { log('did-fail-provisional-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('did-frame-finish-load', function () { log('did-frame-finish-load', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('did-start-loading', function () { log('did-start-loading', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('did-stop-loading', function () { log('did-stop-loading', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('did-get-response-details', function () { log('did-get-response-details', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('did-get-redirect-request', function () { log('did-get-redirect-request', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('dom-ready', function () { log('dom-ready', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('page-favicon-updated', function () { log('page-favicon-updated', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('new-window', function () { log('new-window', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('will-navigate', function () { log('will-navigate', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('crashed', function () { log('crashed', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('plugin-crashed', function () { log('plugin-crashed', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('destroyed', function () { log('destroyed', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('media-started-playing', function () { log('media-started-playing', JSON.stringify(Array.prototype.slice.call(arguments))); });
        this.child.on('media-paused', function () { log('media-paused', JSON.stringify(Array.prototype.slice.call(arguments))); });

        this.child.once('ready', (versions) => {
            this.engineVersions = versions;
            this.child.call('browser-initialize', options, function () {
                self.state = 'ready';
                done();
            });
        });
    });

    // initialize namespaces
    Nightmare.namespaces.forEach(function (name) {
        if ('function' === typeof this[name]) {
            this[name] = this[name]()
        }
    }, this)

    //prepend adding child actions to the queue
    Object.keys(Nightmare.childActions).forEach(function (key) {
        debug('queueing child action addition for "%s"', key);
        this.queue(function (done) {
            this.child.call('action', key, String(Nightmare.childActions[key]), done);
        });
    }, this);
}





function handleExit(code, instance, cb) {
    const help = {
        127: 'command not found - you may not have electron installed correctly',
        126: 'permission problem or command is not an executable - you may not have all the necessary dependencies for electron',
        1: 'general error - you may need xvfb',
        0: 'success!'
    };

    debug('electron child process exited with code ' + code + ': ' + help[code]);
    instance.proc.removeAllListeners();
    cb();
};

function endInstance(instance, cb, forceKill) {
    instance.ended = true;
    detachFromProcess(instance);
    if (instance.proc && instance.proc.connected) {
        instance.proc.on('close', (code) => {
            handleExit(code, instance, cb);
        });
        instance.child.call('quit', () => {
            instance.child.removeAllListeners();
            if (forceKill) {
                instance.proc.kill('SIGINT');
            }
        });
    } else {
        debug('electron child process not started yet, skipping kill.');
        cb();
    }
}
/**
 * Attach any instance-specific process-level events.
 */
function attachToProcess(instance) {
    instance._endNow = endInstance.bind(null, instance, noop);
    process.setMaxListeners(Infinity);
    process.on('exit', instance._endNow);
    process.on('SIGINT', instance._endNow);
    process.on('SIGTERM', instance._endNow);
    process.on('SIGQUIT', instance._endNow);
    process.on('SIGHUP', instance._endNow);
    process.on('SIGBREAK', instance._endNow);
}

function detachFromProcess(instance) {
    process.removeListener('exit', instance._endNow);
    process.removeListener('SIGINT', instance._endNow);
    process.removeListener('SIGTERM', instance._endNow);
    process.removeListener('SIGQUIT', instance._endNow);
    process.removeListener('SIGHUP', instance._endNow);
    process.removeListener('SIGBREAK', instance._endNow);
}


/**
 * Namespaces to initialize
 */

Nightmare.namespaces = [];

/**
 * Child actions to create
 */

Nightmare.childActions = {};

/**
 * Version
 */
Nightmare.version = require(path.resolve(__dirname, 'package.json')).version;

/**
 * Promise library (can override)
 */

Nightmare.Promise = Promise;



/**
 * Go to a `url`
 */

Nightmare.prototype.goto = function (url, headers) {
    debug('queueing action "goto" for %s', url);
    var self = this;

    headers = headers || {};
    for (var key in this._headers) {
        headers[key] = headers[key] || this._headers[key];
    }

    this.queue(function (fn) {
        self.child.call('goto', url, headers, this.options.gotoTimeout, fn);
    });
    return this;
};

/**
 * Queue
 */

Nightmare.prototype.queue = function (done) {
    if (!arguments.length) return this._queue;
    var args = sliced(arguments);
    var fn = args.pop();
    this._queue.push([fn, args]);
};


/**
 * run
 */

Nightmare.prototype.run = function (fn) {
    debug('running')
    var steps = this.queue();
    this.running = true;
    this._queue = [];
    var self = this;

    // kick us off
    next();

    // next function
    function next(err, res) {
        var item = steps.shift();
        // Immediately halt execution if an error has been thrown, or we have no more queued up steps.
        if (err || !item) return done.apply(self, arguments);
        var args = item[1] || [];
        var method = item[0];
        args.push(once(after));
        method.apply(self, args);
    }

    function after(err, res) {
        err = err || self.die;
        var args = sliced(arguments);

        if (self.child) {
            self.child.call('continue', () => next.apply(self, args));
        } else {
            next.apply(self, args);
        }
    }

    function done() {
        var doneargs = arguments;
        self.running = false;
        if (self.ending) {
            return endInstance(self, () => fn.apply(self, doneargs));
        }
        return fn.apply(self, doneargs);
    }

    return this;
};

/**
 * then
 */

Nightmare.prototype.then = function (fulfill, reject) {
    var self = this;

    return new this.options.Promise(function (success, failure) {
        self._rejectActivePromise = failure;
        self.run(function (err, result) {
            if (err) failure(err);
            else success(result);
        })
    })
        .then(fulfill, reject);
};

/**
 * catch
 */

Nightmare.prototype.catch = function (reject) {
    this._rejectActivePromise = reject;
    return this.then(undefined, reject);
};

/**
 * end
 */

Nightmare.prototype.end = function (done) {
    this.ending = true;

    if (done && !this.running && !this.ended) {
        return this.then(done);
    }

    return this;
};