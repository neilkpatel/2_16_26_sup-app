import { supabase } from './supabase'

/**
 * Search for nearby places via Supabase Edge Function
 * (proxies Google Places API to avoid CORS and keep API key server-side)
 * @param {{lat: number, lng: number}} location - Center point for search
 * @param {number} radius - Search radius in meters (default 1500)
 * @param {string} placeType - Type of place: 'bar' or 'cafe' (default 'bar')
 * @returns {Promise<Array>} Array of place objects
 */
export async function searchNearbyPlaces(location, radius = 1500, placeType = 'bar') {
  try {
    const { data, error } = await supabase.functions.invoke('nearby-places', {
      body: { lat: location.lat, lng: location.lng, radius, placeType }
    })

    if (error) throw error
    if (Array.isArray(data) && data.length > 0) return data

    return getMockPlaces(location, placeType)
  } catch (error) {
    console.error('Error fetching places:', error)
    return getMockPlaces(location, placeType)
  }
}

// Backwards-compatible alias
export const searchNearbyBars = (location, radius = 1500) =>
  searchNearbyPlaces(location, radius, 'bar')

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
 * Get mock places for development/demo
 * @param {{lat: number, lng: number}} location - Center point
 * @param {string} placeType - 'bar' or 'cafe'
 * @returns {Array} Mock place data
 */
function getMockPlaces(location, placeType = 'bar') {
  const offset = 0.002 // ~200m offset

  if (placeType === 'cafe') {
    return [
      {
        id: 'mock-cafe-1',
        name: 'Morning Brew',
        address: '100 Coffee Lane',
        location: { lat: location.lat + offset, lng: location.lng - offset },
        rating: 4.6,
        priceLevel: 1,
        totalRatings: 210,
        isOpen: true,
        placeType: 'cafe'
      },
      {
        id: 'mock-cafe-2',
        name: 'The Grind',
        address: '202 Espresso Blvd',
        location: { lat: location.lat - offset, lng: location.lng + offset },
        rating: 4.4,
        priceLevel: 2,
        totalRatings: 154,
        isOpen: true,
        placeType: 'cafe'
      },
      {
        id: 'mock-cafe-3',
        name: 'Bean & Gone',
        address: '303 Latte Ave',
        location: { lat: location.lat + offset, lng: location.lng + offset },
        rating: 4.8,
        priceLevel: 2,
        totalRatings: 312,
        isOpen: true,
        placeType: 'cafe'
      }
    ]
  }

  return [
    {
      id: 'mock-1',
      name: 'The Local Pub',
      address: '123 Main Street',
      location: { lat: location.lat + offset, lng: location.lng - offset },
      rating: 4.5,
      priceLevel: 2,
      totalRatings: 128,
      isOpen: true,
      placeType: 'bar'
    },
    {
      id: 'mock-2',
      name: 'Craft Beer House',
      address: '456 Oak Avenue',
      location: { lat: location.lat - offset, lng: location.lng + offset },
      rating: 4.2,
      priceLevel: 2,
      totalRatings: 89,
      isOpen: true,
      placeType: 'bar'
    },
    {
      id: 'mock-3',
      name: 'Rooftop Lounge',
      address: '789 Skyline Blvd',
      location: { lat: location.lat + offset, lng: location.lng + offset },
      rating: 4.7,
      priceLevel: 3,
      totalRatings: 256,
      isOpen: true,
      placeType: 'bar'
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
