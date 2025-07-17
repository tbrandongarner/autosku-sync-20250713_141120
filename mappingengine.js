const db = require('../db');
const { format: formatDate } = require('date-fns');

const TRANSFORMERS = {
  trim: val => val != null ? String(val).trim() : val,
  toString: val => val != null ? String(val) : val,
  toNumber: val => {
    const num = Number(val);
    if (Number.isNaN(num)) throw new Error(`Cannot convert value "${val}" to Number`);
    return num;
  },
  toLowerCase: val => val != null ? String(val).toLowerCase() : val,
  toUpperCase: val => val != null ? String(val).toUpperCase() : val,
  dateFormat: (val, pattern) => {
    if (val === undefined || val === null || val === '') return val;
    const date = new Date(val);
    if (isNaN(date.getTime())) throw new Error(`Invalid date value "${val}"`);
    if (pattern) {
      try {
        return formatDate(date, pattern);
      } catch (e) {
        throw new Error(`Invalid date format pattern "${pattern}": ${e.message}`);
      }
    }
    return date.toISOString();
  }
};

async function loadMappingConfig(merchantId) {
  if (!merchantId) throw new Error('Merchant ID is required to load mapping configuration');
  const config = await db.getMappingConfigByMerchantId(merchantId);
  if (!config || !Array.isArray(config.mappings)) {
    throw new Error(`Mapping configuration not found or invalid for merchant ID ${merchantId}`);
  }
  return config;
}

function validateMapping(mappingConfig) {
  if (!mappingConfig || !Array.isArray(mappingConfig.mappings)) {
    throw new Error('Invalid mapping configuration: "mappings" array is required');
  }
  const seenTargets = new Set();
  for (const entry of mappingConfig.mappings) {
    const { sourceField, targetField, transformation, transformationOptions } = entry;
    if (!sourceField || !targetField) {
      throw new Error(`Mapping entries must include sourceField and targetField (${JSON.stringify(entry)})`);
    }
    if (seenTargets.has(targetField)) {
      throw new Error(`Duplicate targetField "${targetField}" in mapping configuration`);
    }
    seenTargets.add(targetField);
    if (transformation && typeof transformation !== 'function' && typeof transformation !== 'string') {
      throw new Error(`Transformation for "${sourceField}" must be a function or a string key`);
    }
    if (typeof transformation === 'string' && !TRANSFORMERS[transformation]) {
      throw new Error(`Unknown transformation "${transformation}" for mapping "${sourceField}"`);
    }
    if (transformationOptions !== undefined && typeof transformationOptions !== 'string' && !Array.isArray(transformationOptions)) {
      throw new Error(`transformationOptions for "${sourceField}" must be a string or an array if provided`);
    }
  }
}

function applyMapping(mappingConfig, inputRow) {
  if (!mappingConfig || !Array.isArray(mappingConfig.mappings)) {
    throw new Error('Invalid mapping configuration');
  }
  if (typeof inputRow !== 'object' || inputRow === null) {
    throw new Error('Input row must be an object');
  }
  const mapped = {};
  for (const entry of mappingConfig.mappings) {
    const { sourceField, targetField, defaultValue, required, transformation, transformationOptions } = entry;
    let value = inputRow[sourceField];
    if ((value === undefined || value === null || value === '') && defaultValue !== undefined) {
      value = defaultValue;
    }
    if ((value === undefined || value === null || value === '') && required) {
      throw new Error(`Required field "${sourceField}" is missing or empty`);
    }
    if (transformation) {
      try {
        if (typeof transformation === 'function') {
          value = transformation(value, inputRow);
        } else {
          const args = transformationOptions;
          if (Array.isArray(args)) {
            value = TRANSFORMERS[transformation](value, ...args);
          } else {
            value = TRANSFORMERS[transformation](value, args);
          }
        }
      } catch (err) {
        throw new Error(`Error applying transformation "${transformation}" on field "${sourceField}" -> "${targetField}": ${err.message}`);
      }
    }
    mapped[targetField] = value;
  }
  return mapped;
}

function transformMappedData(mappedRow, mappingConfig) {
  if (typeof mappedRow !== 'object' || mappedRow === null) {
    throw new Error('Mapped data must be an object');
  }
  let result = { ...mappedRow };
  if (mappingConfig && Array.isArray(mappingConfig.postTransformations)) {
    for (const fn of mappingConfig.postTransformations) {
      if (typeof fn !== 'function') continue;
      let out;
      try {
        out = fn(result);
      } catch (err) {
        throw new Error(`Error in postTransformation "${fn.name || 'anonymous'}": ${err.message}`);
      }
      if (typeof out !== 'object' || out === null) {
        throw new Error(`Post-transformation "${fn.name || 'anonymous'}" did not return a valid object`);
      }
      result = out;
    }
  }
  Object.keys(result).forEach(key => {
    if (result[key] === undefined || result[key] === null) delete result[key];
  });
  return result;
}

module.exports = {
  loadMappingConfig,
  validateMapping,
  applyMapping,
  transformMappedData
};