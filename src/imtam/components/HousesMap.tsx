import React, { useEffect, useRef, useState } from "react";
import { House } from "../types";
import { loadMapsApi } from "./LocationPickerMap";

interface Props {
  houses: House[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

const GREEN = "#008000";

function priceLabel(p: number) {
  return p >= 10000 ? `${Math.round(p / 1000) / 10}만` : `${p.toLocaleString("ko-KR")}원`;
}

function pinIcon(g: any, label: string, active: boolean) {
  const w = Math.max(44, label.length * 9 + 20);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="34"><rect x="1" y="1" rx="13" ry="13" width="${w - 2}" height="26" fill="${active ? GREEN : "#fff"}" stroke="${GREEN}" stroke-width="2"/><path d="M${w / 2 - 5} 27 L${w / 2} 33 L${w / 2 + 5} 27 Z" fill="${active ? GREEN : "#fff"}" stroke="${GREEN}" stroke-width="2"/><text x="${w / 2}" y="18.5" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="800" fill="${active ? "#fff" : GREEN}">${label}</text></svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new g.Size(w, 34),
    anchor: new g.Point(w / 2, 34),
  };
}

const HousesMap: React.FC<Props> = ({ houses, selectedId, onSelect, className }) => {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMapsApi()
      .then(() => {
        if (cancelled || !elRef.current) return;
        const g = (window as any).google.maps;
        mapRef.current = new g.Map(elRef.current, {
          center: { lat: 37.5665, lng: 126.978 },
          zoom: 11,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current.addListener("click", () => onSelectRef.current(null));
        setReady(true);
      })
      .catch(() => setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // 매물 목록이 바뀌면 핀 다시 그리고 화면 맞추기
  useEffect(() => {
    if (!ready) return;
    const g = (window as any).google.maps;
    const map = mapRef.current;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
    const bounds = new g.LatLngBounds();
    let count = 0;
    houses.forEach((h) => {
      if (typeof h.lat !== "number" || typeof h.lng !== "number") return;
      const marker = new g.Marker({
        position: { lat: h.lat, lng: h.lng },
        map,
        icon: pinIcon(g, priceLabel(h.pricePerVisit), h.id === selectedId),
        title: h.title,
      });
      marker.addListener("click", () => onSelectRef.current(h.id));
      markersRef.current.set(h.id, marker);
      bounds.extend({ lat: h.lat, lng: h.lng });
      count++;
    });
    if (count === 1) {
      map.setCenter(bounds.getCenter());
      map.setZoom(15);
    } else if (count > 1) {
      map.fitBounds(bounds, 48);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, houses]);

  // 선택된 핀 강조
  useEffect(() => {
    if (!ready) return;
    const g = (window as any).google.maps;
    houses.forEach((h) => {
      const m = markersRef.current.get(h.id);
      if (!m) return;
      const active = h.id === selectedId;
      m.setIcon(pinIcon(g, priceLabel(h.pricePerVisit), active));
      m.setZIndex(active ? 1000 : undefined);
      if (active) mapRef.current.panTo(m.getPosition());
    });
  }, [ready, selectedId, houses]);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center text-xs font-bold text-neutral-500 bg-neutral-100 ${className ?? ""}`}>
        지도를 불러오지 못했습니다.
      </div>
    );
  }
  return <div ref={elRef} className={`bg-neutral-100 ${className ?? ""}`} />;
};

export default HousesMap;
