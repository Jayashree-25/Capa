const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Normalize any date to the Monday of its week
export const getMonday = (d) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
};

export const weekToMonday = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : getMonday(d);
};

export const addWeeks = (d, weeks) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + weeks * 7);
  return copy;
};

export const addMonths = (d, months) => new Date(d.getFullYear(), d.getMonth() + months, 1);

export const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const todayMonday = () => getMonday(new Date());

export const toISO = toISODate;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatWeekLabel = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

export const formatMonthLabel = (iso) => {
  const [year, month] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
};

export const monthKeyOfIso = (iso) => (iso ? iso.slice(0, 7) : null);

// Build up to `count` bucket keys starting at `start` (Monday for weeks, YYYY-MM for months)
export const buildBuckets = (granularity, start, count) => {
  const keys = [];
  if (granularity === 'week') {
    for (let i = 0; i < count; i += 1) {
      keys.push(toISODate(addWeeks(start, i)));
    }
  } else {
    for (let i = 0; i < count; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      keys.push(toISODate(d).slice(0, 7));
    }
  }
  return keys;
};