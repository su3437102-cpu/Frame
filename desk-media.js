const prefix = 'frame-media:';
export const mediaDigest = /^[a-f0-9]{64}$/;
export const mediaTypes = /^data:(?:image\/(?:png|jpeg|webp|gif)|application\/x-pikado);base64,[a-z0-9+/]+=*$/i;

export function deskMediaSlots(state) {
  const slots = [];
  function collect(record, keys) {
    if (!record || typeof record !== 'object') return;
    for (const key of keys) {
      const data = record[key];
      if (typeof data === 'string' && data) slots.push({record, key, data});
    }
  }
  for (const entries of [state?.objects, state?.trash]) {
    if (Array.isArray(entries)) {
      for (const object of entries) collect(object, ['src', 'psInputSrc', 'aiInput']);
    }
  }
  for (const project of Object.values(state?.pikadoProjects || {})) {
    collect(project, ['pkd', 'preview', 'inputSrc']);
  }
  return slots;
}

export function mediaReference(digest) {
  return prefix + digest;
}

export function referenceDigest(value) {
  return value.startsWith(prefix) ? value.slice(prefix.length) : null;
}

export async function digestMedia(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function forEachMedia(items, visit, concurrency = 4) {
  const iterator = items[Symbol.iterator]();
  const results = await Promise.allSettled(Array.from({length: concurrency}, async () => {
    for (const item of iterator) await visit(item);
  }));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
}
