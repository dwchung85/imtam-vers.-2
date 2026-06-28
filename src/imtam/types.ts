export interface House {
  id: string;
  title: string;
  description: string;
  pricePerVisit: number; // 1인 기준 집 구경 입장료 (관람비)
  imageUrl: string;
  imageUrls?: string[]; // 최대 8장 업로드 가능한 실제 임장 사진 목록
  location: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  amenities: string[]; // 제공 혜택 (예: 웰컴 미니 드링크, 인테리어 가구 구매 정보, 호스트 가이드 투어 등)
  maxGuests: number; // 타임 슬롯당 동시 관람 최대 인원
  rating?: number; // 실제 받은 평균 평점 (리뷰가 1개 이상일 때만 존재)
  reviewsCount?: number; // 실제 작성된 리뷰 수 (없으면 undefined)
  availableDates?: string[]; // 방문 가능 지정 날짜 목록 (예: ["2026-06-25", "2026-06-26"])
  availableTimeSlots?: string[]; // 방문 가능 지정 시간 목록 (예: ["오전 10:00 ~ 12:00", ...])
  rooms?: number; // 방 갯수
  bathrooms?: number; // 화장실 갯수
  area?: number; // 넓이 (평)
}

export interface Booking {
  id: string;
  houseId: string;
  houseTitle: string;
  houseImage: string;
  housePricePerVisit: number;
  guestId: string;
  guestName: string;
  visitDate: string; // 탐방 날짜
  visitTimeSlot: string; // 탐방 시간대 (예: 오전 10시, 오후 2시, 저녁 7시 등)
  totalVisitors: number; // 관람 탐방객 인원수
  totalPrice: number; // 최종 결제 집 구경 요금
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  balance: number;
}
