export type PolylineCoordinate = readonly [latitude: number, longitude: number];

function readValue(encoded: string, index: number) {
  let result = 0;
  let shift = 0;
  let cursor = index;

  while (cursor < encoded.length) {
    const value = encoded.charCodeAt(cursor++) - 63;
    if (value < 0 || value > 63 || shift > 30) throw new Error("Invalid encoded polyline");
    result |= (value & 0x1f) << shift;
    if (value < 0x20) return { delta: result & 1 ? ~(result >> 1) : result >> 1, index: cursor };
    shift += 5;
  }

  throw new Error("Invalid encoded polyline");
}

export function decodePolyline(encoded: string): PolylineCoordinate[] {
  if (!encoded) throw new Error("Invalid encoded polyline");
  const coordinates: PolylineCoordinate[] = [];
  let latitude = 0;
  let longitude = 0;
  let index = 0;

  while (index < encoded.length) {
    const lat = readValue(encoded, index);
    const lng = readValue(encoded, lat.index);
    latitude += lat.delta;
    longitude += lng.delta;
    index = lng.index;
    const coordinate = [latitude / 1e5, longitude / 1e5] as const;
    if (Math.abs(coordinate[0]) > 90 || Math.abs(coordinate[1]) > 180) throw new Error("Invalid encoded polyline");
    coordinates.push(coordinate);
  }

  return coordinates;
}

function encodeValue(delta: number) {
  let value = delta < 0 ? ~(delta << 1) : delta << 1;
  let encoded = "";
  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>>= 5;
  }
  return encoded + String.fromCharCode(value + 63);
}

export function encodePolyline(coordinates: readonly PolylineCoordinate[]) {
  if (coordinates.length === 0) throw new Error("Invalid coordinate");
  let previousLatitude = 0;
  let previousLongitude = 0;
  let encoded = "";

  for (const [latitude, longitude] of coordinates) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new Error("Invalid coordinate");
    }
    const nextLatitude = Math.round(latitude * 1e5);
    const nextLongitude = Math.round(longitude * 1e5);
    encoded += encodeValue(nextLatitude - previousLatitude) + encodeValue(nextLongitude - previousLongitude);
    previousLatitude = nextLatitude;
    previousLongitude = nextLongitude;
  }

  return encoded;
}
