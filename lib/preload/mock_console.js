var m_log = require('./debug_log.js');
var consoleList = [];


var console = window.console || {};
var mock = {};
mock.log = console.log;
mock.info = console.info;
mock.warn = console.warn;
mock.debug = console.debug;
mock.error = console.error;
/**
 * print log to origin console
 * @protected
 */
function printOriginLog(item) {
  if (typeof mock[item.logType] === 'function') {
      try{
          mock[item.logType].apply(window, item.logs);
      }catch(e){
          printOriginLog = function(){};
      }
  }
}

function printLog(item) {
  var logs = item.logs || [];
  if (!logs[0]) {
    return;
  }

  logs = [].slice.apply(logs);
  m_log.push({
      msg: '代码报错：' + item.logType+'|' + logs.join(' ')
  });
  printOriginLog(item);
}


window.console.warn = function() {
  printLog({
    logType: 'warn',
    logs: arguments
  });
};

window.console.error = function() {
  printLog({
    logType: 'error',
    logs: arguments
  });
};
