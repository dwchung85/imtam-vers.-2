import { createServerFn } from "@tanstack/react-start";

// GOOGLE_API_KEY is explicitly confirmed by the owner as a public,
// HTTP-referrer-restricted Maps JavaScript browser key, not a server credential.
// Keep gateway/server credentials out of this public configuration response.
export const getMapsBrowserConfig = createServerFn({ method: "GET" }).handler(async () => {
  const browserKey = process.env["GOOGLE_API_KEY"]?.trim();
  if (!browserKey) throw new Error("지도 표시용 키가 설정되지 않았습니다.");
  return { browserKey };
});