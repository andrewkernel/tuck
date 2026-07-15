export const minutesSince = (timestamp: number, now = Date.now()): number =>
  Math.max(0, Math.floor((now - timestamp) / 60_000));

export const relativeTime = (timestamp: number, now = Date.now()): string => {
  const minutes = minutesSince(timestamp, now);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
