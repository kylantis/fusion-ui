
// eslint-disable-next-line no-unused-vars
class AppShellUtils {
    showError(msg) {
        console.log(msg);
    }

    showSuccess(msg) {
        console.log(msg);
    }

    showSpinner() {
        $('.ui.loader').parent().css('visibility', 'visible');
    }

    hideSpinner() {
        $('.ui.loader').parent().css('visibility', 'hidden');
    }

    /**
    * Simple object check.
    * @param item
    * @returns {boolean}
    */
    isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }

    /**
     * Deep merge two objects.
     * @param target
     * @param ...sources
     */
    mergeDeep(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();

        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }

        return this.mergeDeep(target, ...sources);
    }

    removeCookieWithPath(key) {
        const path = window.location.pathname;
        document.cookie = `${key}=;Version=1;Path=${path || '/'};Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
    }

    removeCookie(key) {
        document.cookie = `${key}=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
    }

    getCookieOnce(key) {
        const value = this.getCookie(key);
        this.removeCookieWithPath(key, window.location.pathname);
        return value;
    }

    getCookie(key) {
        const allcookies = document.cookie;
        const pos = allcookies.indexOf(key);
        if (pos !== -1) {
            const len = key.length + 1;
            const start = pos + len;
            let end = allcookies.indexOf(';', start);
            if (end === -1
            ) end = allcookies.length;
            let value = allcookies.substring(start, end);
            value = unescape(value);
            return value;
        }
        return null;
    }

    setCookie(key, value, rem) {
        if (rem) {
            const nextyear = new Date();
            nextyear.setFullYear(nextyear.getFullYear() + 1);
            document.cookie = `${key}=${value}; expires=${nextyear.toGMTString()}; path=/`;
        } else {
            document.cookie = `${key}=${value}; path=/`;
        }
    }

    trimText(string, maxLength) {
        if (string.length > maxLength) {
            let trimmedText = '';
            // We split the text, then add '...'
            for (let ind = 0; ind < maxLength; ind++) {
                trimmedText += string.charAt(ind);
            }
            // eslint-disable-next-line no-param-reassign
            string = `${trimmedText} ...`;
        }

        return string;
    }
}
