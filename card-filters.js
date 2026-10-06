const LABELS = {atk: '공격력', def: '수비력', level: '레벨'};

function bound(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : NaN;
}

export function conditionError(condition) {
  if (condition.field === 'level') return '';
  const min = bound(condition.min), max = bound(condition.max);
  if (Number.isNaN(min) || Number.isNaN(max)) return '0 이상의 정수를 입력해줘.';
  return min != null && max != null && min > max ? '최솟값은 최댓값보다 클 수 없어.' : '';
}

export function statConditionsMatch(card, conditions) {
  return conditions.every(condition => {
    if (!Object.hasOwn(LABELS, condition.field) || conditionError(condition)) return false;
    if (condition.field === 'level') {
      const levels = condition.levels || [];
      return !levels.length || Number.isInteger(card.level) && levels.includes(card.level);
    }
    const min = bound(condition.min), max = bound(condition.max);
    if (min == null && max == null) return true;
    const value = card[condition.field];
    return Number.isFinite(value) && value >= 0 && (min == null || value >= min) && (max == null || value <= max);
  });
}

export function statConditionSummary(condition) {
  if (conditionError(condition)) return '';
  if (condition.field === 'level') {
    const levels = [...(condition.levels || [])].sort((a, b) => a - b);
    return levels.length ? `레벨 ${levels.join('·')}` : '';
  }
  const min = bound(condition.min), max = bound(condition.max), label = LABELS[condition.field];
  if (!label || min == null && max == null) return '';
  if (min != null && max != null) return `${label} ${min}~${max}`;
  return `${label} ${min ?? max} ${min != null ? '이상' : '이하'}`;
}

export function createStatFilters(root, onChange) {
  const document = root.ownerDocument, conditions = new Map();
  const node = (tag, text, className) => {
    const result = document.createElement(tag);
    if (text != null) result.textContent = text;
    if (className) result.className = className;
    return result;
  };
  const heading = node('h3', '능력치 조건');
  const hint = node('p', '추가한 조건은 모두 적용돼. 별은 여러 개 선택할 수 있어.', 'muted');
  const rows = node('div', null, 'stat-condition-list');
  const controls = node('div', null, 'stat-condition-add');
  const select = node('select'); select.id = 'stat-condition-kind'; select.setAttribute('aria-label', '추가할 능력치 조건');
  for (const [field, label] of Object.entries(LABELS)) {
    const option = node('option', field === 'level' ? '레벨(별) 선택' : `${label} 범위`); option.value = field; select.append(option);
  }
  const add = node('button', '+ 조건 추가'); add.type = 'button'; add.id = 'add-stat-condition';
  controls.append(select, add); root.replaceChildren(heading, hint, rows, controls);
  function updateChoices() {
    for (const option of select.options) option.disabled = conditions.has(option.value);
    const available = [...select.options].find(option => !option.disabled);
    if (!select.selectedOptions[0] || select.selectedOptions[0].disabled) select.value = available?.value || '';
    select.disabled = add.disabled = !available;
  }
  function addCondition(field) {
    if (!Object.hasOwn(LABELS, field) || conditions.has(field)) return;
    const condition = field === 'level' ? {field, levels: []} : {field, min: '', max: ''};
    conditions.set(field, condition);
    const box = node('fieldset', null, 'stat-condition');
    box.append(node('legend', field === 'level' ? '레벨(별) · 복수 선택' : `${LABELS[field]} 범위`));
    const remove = node('button', '삭제', 'text-button'); remove.type = 'button'; remove.setAttribute('aria-label', `${LABELS[field]} 조건 삭제`);
    remove.addEventListener('click', () => {conditions.delete(field); box.remove(); updateChoices(); add.focus(); onChange();});
    if (field === 'level') {
      const levels = node('div', null, 'level-choices');
      for (let level = 1; level <= 12; level++) {
        const label = node('label', null, 'level-choice'), input = node('input'); input.type = 'checkbox'; input.value = String(level);
        input.setAttribute('aria-label', `레벨 ${level}`);
        input.addEventListener('change', () => {condition.levels = [...levels.querySelectorAll('input:checked')].map(item => Number(item.value)); onChange();});
        label.append(input, node('span', `★ ${level}`)); levels.append(label);
      }
      box.append(levels);
    } else {
      const range = node('div', null, 'stat-range');
      const error = node('p', '', 'stat-condition-error'); error.setAttribute('role', 'status'); error.hidden = true;
      for (const [key, labelText] of [['min', '최솟값'], ['max', '최댓값']]) {
        const label = node('label', labelText), input = node('input'); input.type = 'number'; input.inputMode = 'numeric'; input.min = '0'; input.step = '1'; input.placeholder = '제한 없음';
        input.id = `stat-${field}-${key}`; label.htmlFor = input.id;
        input.addEventListener('input', () => {
          condition[key] = input.validity.badInput ? 'invalid' : input.value;
          error.textContent = conditionError(condition); error.hidden = !error.textContent;
          for (const control of range.querySelectorAll('input')) control.setAttribute('aria-invalid', String(Boolean(error.textContent)));
          onChange();
        });
        const cell = node('div'); cell.append(label, input); range.append(cell);
      }
      box.append(range, error);
    }
    box.append(remove); rows.append(box); updateChoices(); onChange();
    box.querySelector('input')?.focus();
  }
  add.addEventListener('click', () => addCondition(select.value));
  return {
    values: () => [...conditions.values()],
    summary: () => [...conditions.values()].map(statConditionSummary).filter(Boolean),
    reset: () => {conditions.clear(); rows.replaceChildren(); updateChoices();}
  };
}
