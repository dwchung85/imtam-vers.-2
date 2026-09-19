import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ address: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const GOOGLE_MAPS_API_KEY = process.env["GOOGLE_MAPS_API_KEY"];
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps credentials not configured");
    }

    const response = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(data.address)}`,
      {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Geocoding failed [${response.status}]: ${errorBody}`);
      throw new Error(`Geocoding request failed [${response.status}]`);
    }

    const result = await response.json();
    const location = result.results?.[0]?.geometry?.location;
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      return { lat: null as number | null, lng: null as number | null };
    }
    return { lat: location.lat, lng: location.lng };
  });
