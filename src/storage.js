// localStorage wrapper matching window.storage API
const storage = {
  async get(key) {
    const val = localStorage.getItem(key);
    return val ? { key, value: val } : null;
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem(key);
    return { key, deleted: true };
  },
  async list(prefix = '') {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(prefix)) keys.push(k);
    }
    return { keys, prefix };
  }
};

export default storage;
