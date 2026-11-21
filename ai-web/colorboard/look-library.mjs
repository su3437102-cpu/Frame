import { normalizeLookRecipe } from './look-extractor.mjs';

export const LOOK_LIMIT = 48;
export const LOOK_NAME_LIMIT = 36;
export const LOOK_STORAGE_KEY = 'color-studio.reference-looks.v1';

const fileType = 'color-studio-reference-look';
const schemaVersion = 1;
const maxFileLength = 128 * 1024;
const savedFields = ['id', 'name', 'recipe', 'strength', 'createdAt'];
const fileFields = ['type', 'version', 'name', 'recipe', 'strength'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}

function lookSettings({ name, recipe, strength }) {
  if (typeof name !== 'string') throw new TypeError('请输入模板名称。');
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > LOOK_NAME_LIMIT) {
    throw new RangeError(`模板名称须为 1 至 ${LOOK_NAME_LIMIT} 个字符。`);
  }
  if (!Number.isInteger(strength) || strength < 1 || strength > 100) {
    throw new RangeError('模板强度须为 1 至 100 的整数。');
  }
  return { name: trimmedName, recipe: normalizeLookRecipe(recipe), strength };
}

function validatedSavedLook(template) {
  if (!hasFields(template, savedFields) || typeof template.id !== 'string' || !uuidPattern.test(template.id)) {
    throw new TypeError('模板记录格式有误。');
  }
  const { id, createdAt } = template;
  if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt)) ||
      new Date(createdAt).toISOString() !== createdAt) {
    throw new TypeError('模板创建时间格式有误。');
  }
  return { id, ...lookSettings(template), createdAt };
}

function validatedLibrary(templates) {
  if (!Array.isArray(templates) || templates.length > LOOK_LIMIT) {
    throw new RangeError(`模板库最多可保存 ${LOOK_LIMIT} 份调色模板。`);
  }
  const records = Array.from(templates, validatedSavedLook);
  if (new Set(records.map(record => record.id)).size !== records.length) {
    throw new TypeError('模板库包含重复记录。');
  }
  return records;
}

export function createLookTemplate({ name, recipe, strength = 100 }) {
  const settings = lookSettings({ name, recipe, strength });
  return { id: crypto.randomUUID(), ...settings, createdAt: new Date().toISOString() };
}

export function readLookLibrary(storage = localStorage) {
  const text = storage.getItem(LOOK_STORAGE_KEY);
  if (text === null) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new TypeError('无法读取本地调色模板库。');
  }
  if (!hasFields(data, ['version', 'templates']) || data.version !== schemaVersion) {
    throw new TypeError('本地调色模板库的格式不受支持。');
  }
  return validatedLibrary(data.templates);
}

export function writeLookLibrary(templates, storage = localStorage) {
  const records = validatedLibrary(templates);
  storage.setItem(LOOK_STORAGE_KEY, JSON.stringify({ version: schemaVersion, templates: records }));
}

export function encodeLookTemplate(template) {
  const { name, recipe, strength } = validatedSavedLook(template);
  return JSON.stringify({ type: fileType, version: schemaVersion, name, recipe, strength }, null, 2);
}

export function decodeLookTemplate(text) {
  if (typeof text !== 'string' || text.length < 1 || text.length > maxFileLength) {
    throw new TypeError('调色模板文件大小无效。');
  }
  let data;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new TypeError('无法读取调色模板 JSON。');
  }
  if (!hasFields(data, fileFields) || data.type !== fileType || data.version !== schemaVersion) {
    throw new TypeError('文件不是受支持的色板调色模板。');
  }
  return createLookTemplate(data);
}
