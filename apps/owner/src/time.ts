const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function departureAt(tripDate: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tripDate) || !timePattern.test(time)) {
    throw new Error("출발 시각은 HH:mm 형식이어야 합니다.");
  }
  return `${tripDate}T${time}:00+09:00`;
}
