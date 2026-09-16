export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const languageCodes = {
  english: 'en', hindi: 'hi', bengali: 'bn', gujarati: 'gu', kannada: 'kn',
  malayalam: 'ml', marathi: 'mr', odia: 'or', punjabi: 'pa', tamil: 'ta', telugu: 'te',
};
export const getLanguageCode = language => languageCodes[language] || language?.split('-')[0] || 'en';

export async function portalRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const detail = typeof data?.detail === 'string' ? data.detail : 'Please try again.';
    throw new Error(`Request failed (${response.status}). ${detail}`);
  }
  return data;
}

// Keep stable option values separate from translated labels for conditions and scoring.
export function buildDatabaseForm(rows, englishRows = rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('No questionnaire is configured.');
  const version = Number(rows[0].version_number);
  if (!Number.isInteger(version) || rows.some(row => Number(row.version_number) !== version)) {
    throw new Error('Questionnaire versions do not match. Please reload.');
  }
  const englishByKey = new Map(englishRows.map(row => [row.question_key, row]));
  const localized = {};
  const english = {};
  const configs = new Map();
  const sortedRows = [...rows].sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  for (const row of sortedRows) {
    const key = row.question_key;
    const options = [...row.options].sort((a, b) => a.sort_order - b.sort_order);
    localized[key] = { question: row.question_text, answers: options.map(o => o.option_label) };
    english[key] = { question: englishByKey.get(key)?.question_text || row.question_text, answers: options.map(o => o.option_value) };
    const repeated = ['V2_Q13C_TRIMESTERS', 'V2_Q13D_TRIMESTERS'].includes(key);
    configs.set(row.id, {
      key,
      type: key === 'V2_Q02' ? 'hospital-select' : repeated ? 'repeat_select'
        : key === 'V2_Q18' ? 'compact_dropdown'
        : row.input_type || (row.response_type === 'numbers_only' ? 'number' : 'text'),
      required: row.is_required,
      min: row.min_value == null ? undefined : Number(row.min_value),
      max: row.max_value == null ? undefined : Number(row.max_value),
      step: row.step_value == null ? undefined : Number(row.step_value),
      placeholder: row.placeholder || undefined,
      videoUrlOnNo: row.video_url || undefined,
      otherOptionId: row.other_option_id || undefined,
      otherPlaceholder: row.other_placeholder || undefined,
      subQuestions: [],
    });
  }
  const sections = new Map();
  for (const row of sortedRows) {
    const config = configs.get(row.id);
    if (row.parent_question_id) {
      const parent = configs.get(row.parent_question_id);
      if (!parent) throw new Error('Questionnaire contains a missing parent question.');
      if (config.type === 'repeat_select') config.repeatCountKey = parent.key;
      if (row.trigger_answer) config.condition = { key: parent.key, value: row.trigger_answer };
      parent.subQuestions.push(config);
    } else {
      const title = row.section || 'Questionnaire';
      if (!sections.has(title)) sections.set(title, []);
      sections.get(title).push(config);
    }
  }
  return { version, localized, english, formStructure: Array.from(sections, ([title, questions]) => ({ title, questions })) };
}
