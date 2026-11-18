'use strict';

function createDeviceStore(key) {
  const metaKey = key + ':sync';
  const database = new Promise((resolve, reject) => {
    const request = indexedDB.open('framelab-r11-workspace', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('desks');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('浏览器存储正在被其他窗口占用'));
  }).catch(() => null);

  function legacy() {
    const snapshot = localStorage.getItem(key);
    if (!snapshot) return null;
    let meta;
    try { meta = JSON.parse(localStorage.getItem(metaKey)); } catch {}
    return {snapshot, revision: meta?.revision || 0, dirty: !!meta?.dirty, legacy: true};
  }

  function removeLegacy() {
    localStorage.removeItem(key);
    localStorage.removeItem(metaKey);
  }

  function transaction(db, mode, operation) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('desks', mode);
      const request = operation(tx.objectStore('desks'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || request.error);
    });
  }

  return {
    async read() {
      const db = await database;
      return (db && await transaction(db, 'readonly', store => store.get(key))) || legacy();
    },
    async write(record) {
      const db = await database;
      if (db) {
        await transaction(db, 'readwrite', store => store.put(record, key));
        try { removeLegacy(); } catch {}
      } else {
        localStorage.setItem(key, record.snapshot);
        localStorage.setItem(metaKey, JSON.stringify({revision: record.revision, dirty: record.dirty}));
      }
    },
    async clear() {
      const db = await database;
      if (db) await transaction(db, 'readwrite', store => store.delete(key));
      removeLegacy();
    }
  };
}
