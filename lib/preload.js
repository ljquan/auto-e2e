window.__nightmare = {};
__nightmare.ipc = require('electron').ipcRenderer;
__nightmare.sliced = require('sliced');
__nightmare.notok = {};


// Listen for error events
window.addEventListener('error', function (e) {
    __nightmare.ipc.send('page', 'error', e.message, e.error.stack);
});

(function () {
    // prevent 'unload' and 'beforeunload' from being bound
    var defaultAddEventListener = window.addEventListener;
    window.addEventListener = function (type) {
        if (type === 'unload' || type === 'beforeunload') {
            return;
        }
        defaultAddEventListener.apply(window, arguments);
    };

    // prevent 'onunload' and 'onbeforeunload' from being set
    Object.defineProperties(window, {
        onunload: {
            enumerable: true,
            writable: false,
            value: null
        },
        onbeforeunload: {
            enumerable: true,
            writable: false,
            value: null
        }
    });

    // listen for console.log
    var defaultLog = console.log;
    console.log = function () {
        __nightmare.ipc.send('console', 'log', __nightmare.sliced(arguments));
        return defaultLog.apply(this, arguments);
    };

    var util = require('./util');
    function addNotOk(opt){
        var name = util.getName(__nightmare.currentPath || location.href);
        opt.path = __nightmare.currentPath;
        if (__nightmare.notok[name]) {
            __nightmare.notok[name].push(opt);
        } else {
            __nightmare.notok[name] = [opt];
        }
    }
    
    // listen for console.warn
    var defaultWarn = console.warn;
    console.warn = function () {
        addNotOk({
            type: 'warn', 
            val: __nightmare.sliced(arguments)
        });
        __nightmare.ipc.send('console', 'warn', __nightmare.sliced(arguments));
        return defaultWarn.apply(this, arguments);
    };

    // listen for console.error
    var defaultError = console.error;
    console.error = function () {
        addNotOk({
            type: 'error',
            val: __nightmare.sliced(arguments)
        });
        __nightmare.ipc.send('console', 'error', __nightmare.sliced(arguments));
        return defaultError.apply(this, arguments);
    };

    // overwrite the default alert
    window.alert = function (message) {
        addNotOk({
            type: 'alert',
            val: __nightmare.sliced(arguments)
        });
        __nightmare.ipc.send('page', 'alert', message);
    };

    // overwrite the default prompt
    window.prompt = function (message, defaultResponse) {
        __nightmare.ipc.send('page', 'prompt', message, defaultResponse);
    }

    // overwrite the default confirm
    window.confirm = function (message, defaultResponse) {
        __nightmare.ipc.send('page', 'confirm', message, defaultResponse);
    }
})()
