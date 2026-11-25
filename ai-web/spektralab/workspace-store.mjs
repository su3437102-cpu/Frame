const dbName = 'framelab-spektralab-library';
const store = 'photos';
let connection;

function open() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store, {keyPath:'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => {connection = null; throw error;});
  return connection;
}

async function transaction(mode, operation) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = operation(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = tx.onerror = () => reject(tx.error || request.error);
  });
}

export const listPhotos = () => transaction('readonly', bucket => bucket.getAll());
export const savePhoto = photo => transaction('readwrite', bucket => bucket.put(photo));
