var createPersistent = namespace => ({
    set(key, value) {
        window.localStorage && window.localStorage.setItem(`${namespace}-${key}`, value);
    },

    get(key) {
        return window.localStorage && window.localStorage.getItem(`${namespace}-${key}`);
    }
});
