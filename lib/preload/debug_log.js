var logList = [];
var whiteReg = /^$/;
var whiteList = [];

var uniqueID = 0;

function getUniqueID() {
    return uniqueID++;
}

module.exports = {
    /**
     * 白名单表示关心的xhr请求关键词，避免上报数据过多
     * 添加白名单，参数是将被转换成正则表达式的字符串。白名单仅针对xhr请求的数据
     */
    addWhite: function(){
        whiteList = whiteList.concat.apply(whiteList, arguments).filter(function(s){
            return typeof s == 'string';
        });
        if(whiteList.length){
            whiteReg = new RegExp(whiteList.join('|'));
        }
    },
    check: function(url){ //经测试，正则要比数组、字典等遍历方式高效
        return whiteReg.test(url);
    },
    push: function(value){
        logList[getUniqueID()] = value;
    },
    get: function(key){
        return logList[key];
    },
    update: function(key, value){
        logList[key] = value;
    },
    getUniqueID: getUniqueID,
    getReport: function () {
        var list = [];
        for(var i=0; i<uniqueID; i++){
            var item = logList[i];
            if(!item || item.reported){
                continue;
            }
            if(item.url){
                if(item.readyState==4 && item.status != 200){
                    if(!item.endTime){
                        var endTime = +new Date();
                        item.costTime = endTime - (item.startTime || endTime);
                    }
                    item.msg = ['xhr', item.url, item.withCredentials, item.costTime, item.readyState, item.status, item.response].join('|');
                    item.reported = true;
                    list.push(item);
                }
                continue;
            }
            item.reported = true;
            list.push(item);
        }
        return list;
    }
};
