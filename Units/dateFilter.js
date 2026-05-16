// utils/dateFilter.js
export const getDateRange = (type) => {
  const now = new Date();

  let startDate;

  if (type === "daily") {
    startDate = new Date(now.setHours(0, 0, 0, 0));
  } 
  else if (type === "weekly") {
    startDate = new Date();
    startDate.setDate(now.getDate() - 7);
  } 
  else if (type === "monthly") {
    startDate = new Date();
    startDate.setMonth(now.getMonth() - 1);
  }

  return { startDate, endDate: new Date() };
};