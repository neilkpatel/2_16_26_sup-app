import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Haversine distance in meters */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { lat, lng, radius = 1500 } = await req.json();

    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: "lat and lng required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Google Places API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", radius.toString());
    url.searchParams.set("type", "bar");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    // Filter to 4.2+ stars, compute distance, sort by closest, return top 5
    const places = (data.results || [])
      .filter((place: any) => (place.rating || 0) >= 4.2)
      .map((place: any) => {
        const plat = place.geometry.location.lat;
        const plng = place.geometry.location.lng;
        const meters = distanceMeters(lat, lng, plat, plng);
        const walkMinutes = Math.round(meters / 80); // ~80m/min walking pace

        return {
          id: place.place_id,
          name: place.name,
          address: place.vicinity,
          location: { lat: plat, lng: plng },
          rating: place.rating || null,
          priceLevel: place.price_level || null,
          totalRatings: place.user_ratings_total || 0,
          isOpen: place.opening_hours?.open_now ?? null,
          distanceMeters: Math.round(meters),
          walkMinutes,
        };
      })
      .sort((a: any, b: any) => a.distanceMeters - b.distanceMeters)
      .slice(0, 5);

    return new Response(JSON.stringify(places), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
