import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string }) => {
    const address = (input?.address ?? "").trim();
    if (!address || address.length > 200) throw new Error("Invalid address");
    return { address };
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !mapsKey) {
      return { lat: null, lng: null, error: "지도 서비스가 연결되지 않았습니다." };
    }

    const response = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(data.address)}&language=ko&region=kr`,
      {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": mapsKey,
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error(`Geocode failed [${response.status}]: ${body}`);
      return { lat: null, lng: null, error: "주소 위치를 찾지 못했습니다." };
    }

    const json = (await response.json()) as {
      status?: string;
      results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
    };
    const loc = json.results?.[0]?.geometry?.location;
    if (json.status !== "OK" || !loc) {
      return { lat: null, lng: null, error: "주소 위치를 찾지 못했습니다." };
    }
    return { lat: loc.lat, lng: loc.lng, error: null };
  });
