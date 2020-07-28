module.exports.flattenJson = function (data) {
    var result = {};
    function recurse(cur, prop) {
        if (Object(cur) !== cur) {
            result[prop] = cur;
        } else if (Array.isArray(cur)) {
            for (var i = 0, l = cur.length; i < l; i++)
                recurse(cur[i], prop ? prop + "." + i : "" + i);
            if (l == 0)
                result[prop] = [];
        } else {
            var isEmpty = true;
            for (var p in cur) {
                isEmpty = false;
                recurse(cur[p], prop ? prop + "." + p : p);
            }
            if (isEmpty)
                result[prop] = {};
        }
    }
    recurse(data, "");
    return result;
};

module.exports.getRandomInt = function (min = 10000, max = 99999) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports.generateRandomString = function (length = 8) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

module.exports.ensureUniqueKeys = function (objects, mutualKey) {
    const keys = [];
    for (const json of objects) {
        const k = json[mutualKey];
        if (keys.includes(k)) {
            return false;
        }
        keys.push(k);
    }
    return true;
}

module.exports.extend = function () {

    // Variables
    var extended = {};
    var deep = false;
    var i = 0;
    var length = arguments.length;

    // Check if a deep merge
    if (Object.prototype.toString.call(arguments[0]) === '[object Boolean]') {
        deep = arguments[0];
        i++;
    }

    // Merge the object into the extended object
    var merge = function (obj) {
        for (var prop in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, prop)) {
                // If deep merge and property is an object, merge properties
                if (deep && Object.prototype.toString.call(obj[prop]) === '[object Object]') {
                    extended[prop] = extend(true, extended[prop], obj[prop]);
                } else {
                    extended[prop] = obj[prop];
                }
            }
        }
    };

    // Loop through each object and conduct a merge
    for (; i < length; i++) {
        var obj = arguments[i];
        merge(obj);
    }

    return extended;
};

module.exports.addPloyfills = function () {

    Array.prototype = {
        ...Array.prototype,
        peek: function() {
            if (this.length > 0) {
                return this[this.length-1];
            }
            return undefined;
        },
        clone: function() {
            return [].concat(this);
        },
        equals: function(array) {
            return JSON.stringify(this) == JSON.stringify(array);
        }
    };

    Object.prototype = {
        ...Object.prototype,
        clone: function() {
            return JSON.parse(JSON.stringify(this));
        },
        clear: function() {
            for (var key in this) {
                delete this[key];
            }
        }
    }
}