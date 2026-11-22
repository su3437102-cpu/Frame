export const MaterialCache = (() => {
  'use strict';

  const DATABASE = 'cut-and-paste-workspace';
  const MATERIALS = 'materials';
  const PREFERENCES = 'preferences';
  const DIRECTORY = 'workspace-directory';
  const PERMISSION_MODE = {mode: 'readwrite'};

  // Preserve in-session editing if private mode or a full disk prevents storage.
  const temporary = new Map();
  let databasePending;
  let directoryPending;
  let directoryHandle = null;
  let directoryRemembered = false;
  let directoryWrites = Promise.resolve();

  function database() {
    if (databasePending) return databasePending;
    let blocked = false;
    databasePending = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('当前浏览器无法使用素材缓存。'));
        return;
      }
      const request = window.indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(MATERIALS, {keyPath: 'id'});
        request.result.createObjectStore(PREFERENCES);
      };
      request.onsuccess = () => {
        const connection = request.result;
        if (blocked) {
          connection.close();
          return;
        }
        connection.onversionchange = () => {
          connection.close();
          databasePending = undefined;
        };
        resolve(connection);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(new Error('另一个页面正在占用素材缓存。'));
      };
    }).catch(error => {
      databasePending = undefined;
      throw error;
    });
    return databasePending;
  }

  function transact(connection, storeName, mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = connection.transaction(storeName, mode);
      transaction.onabort = () => reject(transaction.error || new Error('无法完成素材缓存操作。'));
      try {
        const request = operation(transaction.objectStore(storeName));
        transaction.oncomplete = () => resolve(request?.result);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  }

  async function listStatus() {
    const records = new Map();
    let persistent = true;
    try {
      const saved = await transact(await database(), MATERIALS, 'readonly', store => store.getAll());
      for (const record of saved) records.set(record.id, record);
    } catch {
      persistent = false;
    }
    for (const record of temporary.values()) records.set(record.id, record);
    return {
      records: [...records.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      persistent: persistent && temporary.size === 0,
      temporaryCount: temporary.size
    };
  }

  async function list() {
    return (await listStatus()).records;
  }

  function supportsDirectory() {
    return typeof window.showDirectoryPicker === 'function';
  }

  function loadDirectory() {
    if (!directoryPending) {
      directoryPending = (async () => {
        try {
          const saved = await transact(await database(), PREFERENCES, 'readonly', store => store.get(DIRECTORY));
          if (saved?.kind === 'directory') {
            directoryHandle = saved;
            directoryRemembered = true;
          }
        } catch {
          // A browser can allow picking a directory without persisting its handle.
        }
      })();
    }
    return directoryPending;
  }

  async function permission(handle) {
    if (!handle) return 'none';
    try {
      return await handle.queryPermission(PERMISSION_MODE);
    } catch {
      return 'denied';
    }
  }

  async function directoryStatus() {
    const supported = supportsDirectory();
    if (supported) await loadDirectory();
    return {
      supported,
      name: directoryHandle?.name || null,
      access: await permission(directoryHandle),
      remembered: directoryRemembered
    };
  }

  async function chooseDirectory() {
    if (!supportsDirectory()) throw new Error('当前浏览器暂不支持选择本地文件夹。');
    const picked = await window.showDirectoryPicker({id: 'cut-paste-materials', ...PERMISSION_MODE});
    await loadDirectory();
    directoryHandle = picked;
    directoryRemembered = false;
    try {
      await transact(await database(), PREFERENCES, 'readwrite', store => store.put(picked, DIRECTORY));
      directoryRemembered = true;
    } catch {
      // The chosen directory is available for this session when it cannot be remembered.
      await forgetDirectory().catch(() => {});
    }
    return directoryStatus();
  }

  async function reconnectDirectory() {
    if (!directoryHandle) await loadDirectory();
    const handle = directoryHandle;
    if (!handle) return directoryStatus();
    await handle.requestPermission(PERMISSION_MODE);
    return directoryStatus();
  }

  async function disconnectDirectory() {
    await loadDirectory();
    if (directoryRemembered) await forgetDirectory();
    else await forgetDirectory().catch(() => {});
    directoryHandle = null;
    directoryRemembered = false;
  }

  async function forgetDirectory() {
    await transact(await database(), PREFERENCES, 'readwrite', store => store.delete(DIRECTORY));
  }

  function fileStem(record) {
    const title = record.name.replace(/\.png$/iu, '')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-')
      .replace(/^[.\s]+|[.\s]+$/gu, '').slice(0, 50) || '拼贴素材';
    const id = record.id.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 80);
    return `${title}--${id}`;
  }

  async function getExisting(directory, name) {
    try {
      return await directory.getFileHandle(name);
    } catch (error) {
      if (error.name !== 'NotFoundError') throw error;
      return null;
    }
  }

  async function identical(file, blob) {
    if (file.size !== blob.size) return false;
    const [first, second] = await Promise.all([file.arrayBuffer(), blob.arrayBuffer()]);
    const current = new Uint8Array(first);
    const incoming = new Uint8Array(second);
    return current.every((byte, index) => byte === incoming[index]);
  }

  async function writeCutout(directory, record) {
    const stem = fileStem(record);
    for (let version = 1; version <= 100; version++) {
      const suffix = version === 1 ? '' : '-' + version;
      const name = stem + suffix + '.png';
      const existing = await getExisting(directory, name);
      if (existing) {
        if (await identical(await existing.getFile(), record.blob)) return;
        continue;
      }
      const target = await directory.getFileHandle(name, {create: true});
      if ((await target.getFile()).size) continue;
      await writeNewFile(directory, target, name, record.blob);
      return;
    }
    throw new Error('同名素材过多，无法保存到工作文件夹。');
  }

  async function writeNewFile(directory, target, name, blob) {
    let writer;
    try {
      writer = await target.createWritable();
      await writer.write(blob);
      await writer.close();
    } catch (error) {
      if (writer) await writer.abort().catch(() => {});
      try {
        if (!(await target.getFile()).size) await directory.removeEntry(name);
      } catch {
        // Preserve the initial write error if the directory is now inaccessible.
      }
      throw error;
    }
  }

  async function mirror(records) {
    const results = {count: 0, directory: false};
    if (!supportsDirectory()) return results;
    await loadDirectory();
    const handle = directoryHandle;
    if (!handle) return results;
    const cutouts = records.filter(record => record.kind === 'cutout');
    const write = directoryWrites.then(async () => {
      if (directoryHandle !== handle) return results;
      if (await permission(handle) !== 'granted') {
        return {...results, directoryError: '请重新授权工作文件夹。'};
      }
      let failed = false;
      for (const record of cutouts) {
        if (directoryHandle !== handle) return results;
        try {
          await writeCutout(handle, record);
          results.count++;
        } catch {
          failed = true;
        }
      }
      results.directory = !failed;
      if (failed) results.directoryError = '部分素材未能写入工作文件夹，可在授权后再次同步。';
      return results;
    });
    directoryWrites = write.catch(() => {});
    return write;
  }

  async function save(records) {
    let persistent = true;
    if (records.length) {
      try {
        await transact(await database(), MATERIALS, 'readwrite', store => {
          for (const record of records) store.put(record);
        });
        for (const record of records) temporary.delete(record.id);
      } catch {
        persistent = false;
        for (const record of records) temporary.set(record.id, record);
      }
    }
    return {persistent, ...await mirror(records)};
  }

  async function remove(ids) {
    if (!ids.length) return;
    let connection;
    try {
      connection = await database();
    } catch (error) {
      if (ids.some(id => !temporary.has(id))) throw error;
    }
    if (connection) {
      await transact(connection, MATERIALS, 'readwrite', store => {
        for (const id of ids) store.delete(id);
      });
    }
    for (const id of ids) temporary.delete(id);
  }

  async function syncDirectory() {
    return mirror(await list());
  }

  return {list, listStatus, save, remove, directoryStatus, chooseDirectory, reconnectDirectory, disconnectDirectory, syncDirectory};
})();
