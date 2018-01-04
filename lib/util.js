/*
 * @Author: liquidliang
 * @Date:   2016-11-10 21:32:19
 * @Last Modified by:   liquidliang
 * @Last Modified time: 2016-11-16 19:44:41
 */

'use strict';
const { URL } = require('url');

/**
 * 把字符串变成 '-' 链接的格式
 * @param {*} str 
 */

function toJoin(str) {
    return ('' + str).replace(/[^a-zA-Z0-9]+(\w)/g,
        function (all, letter) {
            return '-' + letter;
        });
}


function getName(path) {
    const myURL = new URL(path);
    return toJoin(path.replace(myURL.origin, '').replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ''));
}



/*
    m_util.iterator((report.warn || []), function(item, next, arr) {
        var selector = item[0];
        G.browser.waitForElementVisible(selector, G.timeout, false, function(result) { //waitForElementVisible是异步执行的
            if (!result.value) {
                notOkDict[selector] = {
                    height: 0
                };
            } else {
                var config = {};
                config[selector] = item[2];
                _checkSample(config, secondCheck);
                //样式检查
            }
            if (arr.length) {
                next();
            } else {
                G.browser.pause(100);
            }
        }, path + '|$(\'' + item[0] + '\')未显示');
    });

 */
//迭代器，对originList中的每个元素同步分别调用callback
function iterator(originList, callback) {
    if (originList && originList.length) {
        var list = originList.slice();
        var item = list.shift();
        var next = function () {
            iterator(list, callback);
        };
        callback(item, next, list);
    }
}

module.exports = {
    getName: getName,
    iterator: iterator
};
