export const formatISTDate = (date) => {
  const istDate = new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  const [time, rest] = istDate.split(", ");
  return `${time}\n${rest} (IST)`;
};
