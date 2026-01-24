import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './Map.css'

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom icons
const createIcon = (color, label) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-pin" style="background: ${color}">
        <span class="marker-label">${label}</span>
      </div>
    `,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48]
  })
}

const userIcon = createIcon('#667eea', 'You')
const friendIcon = (initial) => createIcon('#22c55e', initial.toUpperCase())
const midpointIcon = L.divIcon({
  className: 'midpoint-marker',
  html: '<div class="midpoint-pin"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
})

// Component to recenter map when location changes
function MapUpdater({ center, shouldCenter }) {
  const map = useMap()

  useEffect(() => {
    if (center && shouldCenter) {
      map.setView([center.lat, center.lng], map.getZoom())
    }
  }, [center, shouldCenter, map])

  return null
}

export function Map({
  userLocation,
  isSupActive,
  friendSessions = [],
  midpoint
}) {
  const mapRef = useRef(null)
  const initialCentered = useRef(false)

  // Default center (will be overwritten by user location)
  const defaultCenter = { lat: 40.7128, lng: -74.0060 } // NYC
  const center = userLocation || defaultCenter

  // Only center on first load
  const shouldCenter = !initialCentered.current && userLocation
  if (shouldCenter) {
    initialCentered.current = true
  }

  return (
    <div className="map-wrapper">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        className="leaflet-map"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater center={center} shouldCenter={shouldCenter} />

        {/* Current user marker */}
        {userLocation && isSupActive && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
          >
            <Popup>
              <strong>You</strong>
              <br />
              You're Sup!
            </Popup>
          </Marker>
        )}

        {/* Friend markers */}
        {friendSessions.map((session) => {
          if (!session.parsedLocation) return null
          const initial = session.username?.[0] || '?'
          return (
            <Marker
              key={session.id}
              position={[session.parsedLocation.lat, session.parsedLocation.lng]}
              icon={friendIcon(initial)}
            >
              <Popup>
                <strong>@{session.username || 'Friend'}</strong>
                <br />
                is Sup!
              </Popup>
            </Marker>
          )
        })}

        {/* Midpoint marker */}
        {midpoint && friendSessions.length > 0 && (
          <Marker
            position={[midpoint.lat, midpoint.lng]}
            icon={midpointIcon}
          >
            <Popup>
              <strong>Midpoint</strong>
              <br />
              Best spot to meet!
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {!userLocation && (
        <div className="map-overlay">
          <p>Enable location to see the map</p>
        </div>
      )}
    </div>
  )
}

export default Map
