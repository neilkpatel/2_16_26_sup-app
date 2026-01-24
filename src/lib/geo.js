/**
 * Calculate the geographic midpoint of multiple coordinates
 * @param {Array<{lat: number, lng: number}>} points - Array of coordinate objects
 * @returns {{lat: number, lng: number}} - Midpoint coordinates
 */
export function calculateMidpoint(points) {
  if (!points || points.length === 0) {
    return null
  }

  if (points.length === 1) {
    return { lat: points[0].lat, lng: points[0].lng }
  }

  // Convert to radians and calculate cartesian coordinates
  let x = 0
  let y = 0
  let z = 0

  for (const point of points) {
    const latRad = (point.lat * Math.PI) / 180
    const lngRad = (point.lng * Math.PI) / 180

    x += Math.cos(latRad) * Math.cos(lngRad)
    y += Math.cos(latRad) * Math.sin(lngRad)
    z += Math.sin(latRad)
  }

  const total = points.length
  x /= total
  y /= total
  z /= total

  // Convert back to lat/lng
  const lngRad = Math.atan2(y, x)
  const hyp = Math.sqrt(x * x + y * y)
  const latRad = Math.atan2(z, hyp)

  return {
    lat: (latRad * 180) / Math.PI,
    lng: (lngRad * 180) / Math.PI
  }
}

/**
 * Calculate distance between two points in kilometers using Haversine formula
 * @param {{lat: number, lng: number}} point1
 * @param {{lat: number, lng: number}} point2
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(point1, point2) {
  const R = 6371 // Earth's radius in km
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Format distance for display
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  return `${km.toFixed(1)} km`
}
