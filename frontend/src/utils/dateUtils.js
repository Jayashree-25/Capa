export const formatDate = (dateStr) => {
  if (!dateStr || dateStr.length !== 6) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = parseInt(dateStr.substring(0, 2)) - 1;
  const year = dateStr.substring(2);
  if (month < 0 || month > 11) return '';
  return `${months[month]} ${year}`;
};

export const getMonthName = (dateStr) => {
  if (!dateStr || dateStr.length !== 6) return '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const month = parseInt(dateStr.substring(0, 2)) - 1;
  const year = dateStr.substring(2);
  if (month < 0 || month > 11) return '';
  return `${months[month]} ${year}`;
};

export const parseDate = (monthStr) => {
  if (!monthStr || monthStr.length !== 6) return null;
  const month = parseInt(monthStr.substring(0, 2)) - 1;
  const year = parseInt(monthStr.substring(2));
  return new Date(year, month);
};
