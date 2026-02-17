import { useEffect, useRef, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
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
const createIcon = (color, label, extraClass = '') => {
  return L.divIcon({
    className: `custom-marker ${extraClass}`,
    html: `
      <div class="marker-pin" style="background: ${color}">
        <span class="marker-label">${label}</span>
      </div>
      ${extraClass.includes('marker-heading') ? '<div class="marker-pulse-ring"></div>' : ''}
    `,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48]
  })
}

const HEADING_COLOR = '#0ea5e9'

const userIcon = createIcon('#667eea', 'You')
const userHeadingIcon = createIcon(HEADING_COLOR, 'You', 'marker-heading')
const friendIcon = (initial) => createIcon('#22c55e', initial.toUpperCase())
const friendHeadingIcon = (initial) => createIcon(HEADING_COLOR, initial.toUpperCase(), 'marker-heading')
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

// Animated marker — smoothly interpolates position over 500ms
function AnimatedMarker({ position, icon, children, sessionId }) {
  const markerRef = useRef(null)
  const prevPosition = useRef(position)
  const animFrame = useRef(null)
  const [isNew, setIsNew] = useState(true)

  // Pop-in animation for new markers
  useEffect(() => {
    if (isNew) {
      const timeout = setTimeout(() => setIsNew(false), 600)
      return () => clearTimeout(timeout)
    }
  }, [isNew])

  // Smooth position animation
  useEffect(() => {
    const marker = markerRef.current
    if (!marker || !position) return

    const from = prevPosition.current
    if (!from || (from[0] === position[0] && from[1] === position[1])) {
      prevPosition.current = position
      return
    }

    const duration = 500
    const start = performance.now()
    const fromLat = from[0]
    const fromLng = from[1]
    const toLat = position[0]
    const toLng = position[1]

    const animate = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)

      const lat = fromLat + (toLat - fromLat) * eased
      const lng = fromLng + (toLng - fromLng) * eased
      marker.setLatLng([lat, lng])

      if (progress < 1) {
        animFrame.current = requestAnimationFrame(animate)
      } else {
        prevPosition.current = position
      }
    }

    animFrame.current = requestAnimationFrame(animate)

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current)
    }
  }, [position])

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      className={isNew ? 'marker-appear' : ''}
    >
      {children}
    </Marker>
  )
}

// Dashed polyline for destination routes
const destinationLineStyle = {
  color: HEADING_COLOR,
  weight: 2,
  opacity: 0.6,
  dashArray: '8, 8'
}

export function Map({
  userLocation,
  isSupActive,
  friendSessions = [],
  midpoint,
  myDestination
}) {
  const mapRef = useRef(null)
  const initialCentered = useRef(false)
  const prevFriendIds = useRef(new Set())

  // Track new friends for pop-in animation
  const newFriendIds = useMemo(() => {
    const currentIds = new Set(friendSessions.map(s => s.id))
    const newIds = new Set()
    currentIds.forEach(id => {
      if (!prevFriendIds.current.has(id)) newIds.add(id)
    })
    prevFriendIds.current = currentIds
    return newIds
  }, [friendSessions])

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
          <AnimatedMarker
            position={[userLocation.lat, userLocation.lng]}
            icon={myDestination ? userHeadingIcon : userIcon}
            sessionId="user"
          >
            <Popup>
              <strong>You</strong>
              <br />
              {myDestination
                ? `Heading to ${myDestination.name}`
                : "You're Sup!"}
            </Popup>
          </AnimatedMarker>
        )}

        {/* Destination line from user to bar */}
        {userLocation && isSupActive && myDestination?.location && (
          <Polyline
            positions={[
              [userLocation.lat, userLocation.lng],
              [myDestination.location.lat, myDestination.location.lng]
            ]}
            pathOptions={destinationLineStyle}
          />
        )}

        {/* Friend markers */}
        {friendSessions.map((session) => {
          if (!session.parsedLocation) return null
          const initial = session.username?.[0] || '?'
          const hasDestination = !!session.destination_name
          const icon = hasDestination
            ? friendHeadingIcon(initial)
            : friendIcon(initial)

          return (
            <AnimatedMarker
              key={session.id}
              position={[session.parsedLocation.lat, session.parsedLocation.lng]}
              icon={icon}
              sessionId={session.id}
            >
              <Popup>
                <strong>@{session.username || 'Friend'}</strong>
                <br />
                {hasDestination
                  ? `Heading to ${session.destination_name}`
                  : 'is Sup!'}
              </Popup>
            </AnimatedMarker>
          )
        })}

        {/* Friend destination lines */}
        {friendSessions.map((session) => {
          if (!session.parsedLocation || !session.parsedDestination) return null
          return (
            <Polyline
              key={`line-${session.id}`}
              positions={[
                [session.parsedLocation.lat, session.parsedLocation.lng],
                [session.parsedDestination.lat, session.parsedDestination.lng]
              ]}
              pathOptions={destinationLineStyle}
            />
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
