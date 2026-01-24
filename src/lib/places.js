const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

/**
 * Search for nearby bars/venues using Google Places API
 * @param {{lat: number, lng: number}} location - Center point for search
 * @param {number} radius - Search radius in meters (default 1500)
 * @returns {Promise<Array>} Array of place objects
 */
export async function searchNearbyBars(location, radius = 1500) {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Google Places API key not configured')
    return getMockBars(location)
  }

  try {
    // Using the Places API Nearby Search
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
    url.searchParams.set('location', `${location.lat},${location.lng}`)
    url.searchParams.set('radius', radius.toString())
    url.searchParams.set('type', 'bar')
    url.searchParams.set('key', GOOGLE_PLACES_API_KEY)

    // Note: In production, this should go through a backend proxy
    // to avoid exposing the API key
    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== 'OK') {
      console.error('Places API error:', data.status)
      return getMockBars(location)
    }

    return parsePlacesResponse(data.results).slice(0, 3)
  } catch (error) {
    console.error('Error fetching places:', error)
    return getMockBars(location)
  }
}

/**
 * Parse Google Places API response into our format
 * @param {Array} results - Raw API results
 * @returns {Array} Parsed place objects
 */
export function parsePlacesResponse(results) {
  return results.map(place => ({
    id: place.place_id,
    name: place.name,
    address: place.vicinity,
    location: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng
    },
    rating: place.rating || null,
    priceLevel: place.price_level || null,
    totalRatings: place.user_ratings_total || 0,
    isOpen: place.opening_hours?.open_now ?? null,
    photo: place.photos?.[0]?.photo_reference || null
  }))
}

/**
 * Get mock bars for development/demo
 * @param {{lat: number, lng: number}} location - Center point
 * @returns {Array} Mock bar data
 */
function getMockBars(location) {
  const offset = 0.002 // ~200m offset
  return [
    {
      id: 'mock-1',
      name: 'The Local Pub',
      address: '123 Main Street',
      location: { lat: location.lat + offset, lng: location.lng - offset },
      rating: 4.5,
      priceLevel: 2,
      totalRatings: 128,
      isOpen: true
    },
    {
      id: 'mock-2',
      name: 'Craft Beer House',
      address: '456 Oak Avenue',
      location: { lat: location.lat - offset, lng: location.lng + offset },
      rating: 4.2,
      priceLevel: 2,
      totalRatings: 89,
      isOpen: true
    },
    {
      id: 'mock-3',
      name: 'Rooftop Lounge',
      address: '789 Skyline Blvd',
      location: { lat: location.lat + offset, lng: location.lng + offset },
      rating: 4.7,
      priceLevel: 3,
      totalRatings: 256,
      isOpen: true
    }
  ]
}

/**
 * Get photo URL from photo reference
 * @param {string} photoReference - Google Places photo reference
 * @param {number} maxWidth - Maximum width (default 400)
 * @returns {string} Photo URL
 */
export function getPhotoUrl(photoReference, maxWidth = 400) {
  if (!photoReference || !GOOGLE_PLACES_API_KEY) {
    return null
  }
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`
}

/**
 * Format price level as dollar signs
 * @param {number} level - Price level (0-4)
 * @returns {string} Dollar sign representation
 */
export function formatPriceLevel(level) {
  if (level === null || level === undefined) return ''
  return '$'.repeat(level + 1)
}
