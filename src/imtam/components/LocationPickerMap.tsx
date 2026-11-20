import React, { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    __imtamMapsReady?: boolean;
    __imtamMapsCallbacks?: Array<() => void>;
    __imtamMapsLoading?: boolean;
    __imtamInitMaps?: () => void;
  }
}

function loadMapsApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.__imtamMapsReady && (window as any).google?.maps) {
      resolve();
      return;
    }
    window.__imtamMapsCallbacks = window.__imtamMapsCallbacks || [];
    window.__imtamMapsCallbacks.push(resolve);
    if (window.__imtamMapsLoading) return;
    window.__imtamMapsLoading = true;
    window.__imtamInitMaps = () => {
      window.__imtamMapsReady = true;
      (window.__imtamMapsCallbacks || []).forEach((cb) => cb());
      window.__imtamMapsCallbacks = [];
    };
    const script = document.createElement("script");
    // Lovable 공용 키는 *.lovable.app / *.lovableproject.com 전용,
    // 커스텀 도메인(imtam.com)용 키는 커넥터가 심어준 환경변수 사용.
    // 접속 주소에 따라 허용된 키를 자동으로 고른다.
    const LOVABLE_MANAGED_KEY = "AIzaSyDjX4YpvFl1FaREcNugk7SslGTGRtWnG_0";
    const host = window.location.hostname;
    const isLovableHost =
      host === "localhost" ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovableproject.com");
    const key = isLovableHost
      ? LOVABLE_MANAGED_KEY
      : import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__imtamInitMaps${channel ? `&channel=${channel}` : ""}`;
    script.async = true;
    script.onerror = () => reject(new Error("지도를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

interface Props {
  lat: number;
  lng: number;
  onChange?: (lat: number, lng: number) => void;
  readOnly?: boolean;
}

const LocationPickerMap: React.FC<Props> = ({ lat, lng, onChange, readOnly = false }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMapsApi()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const g = (window as any).google.maps;
        const center = { lat, lng };
        const map = new g.Map(mapRef.current, {
          center,
          zoom: 17,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: readOnly ? "cooperative" : undefined,
        });
        const marker = new g.Marker({
          position: center,
          map,
          draggable: !readOnly,
        });
        markerRef.current = marker;
        if (!readOnly && onChange) {
          marker.addListener("dragend", () => {
            const p = marker.getPosition();
            if (p) onChange(p.lat(), p.lng());
          });
          map.addListener("click", (e: any) => {
            if (!e.latLng) return;
            marker.setPosition(e.latLng);
            onChange(e.latLng.lat(), e.latLng.lng());
          });
        }
      })
      .catch(() => setLoadError(true));
    return () => {
      cancelled = true;
    };
    // 초기 좌표 기준으로 1회 생성
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 외부에서 좌표가 바뀌면(주소 재검색) 지도/마커 이동
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const g = (window as any).google?.maps;
    if (!g) return;
    const pos = new g.LatLng(lat, lng);
    marker.setPosition(pos);
    marker.getMap()?.setCenter(pos);
  }, [lat, lng]);

  if (loadError) {
    return (
      <div className="w-full min-w-full h-[280px] md:h-[360px] flex items-center justify-center text-xs font-bold text-neutral-500">
        지도를 불러오지 못했습니다.
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full min-w-full h-[280px] md:h-[360px]"
      style={{ width: "100%" }}
    />
  );
};

export default LocationPickerMap;
