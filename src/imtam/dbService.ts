import { supabase } from '@/integrations/supabase/client';
import { Booking, House, SlotLoad, UserProfile } from './types';

// ============================
// Row <-> Domain mappers
// ============================
type HouseRow = {
  id: string;
  title: string;
  description: string;
  price_per_visit: number;
  image_url: string;
  image_urls: string[] | null;
  location: string;
  host_id: string;
  host_name: string;
  host_avatar: string;
  amenities: string[] | null;
  max_guests: number;
  rating: number | null;
  reviews_count: number;
  available_dates: string[] | null;
  available_time_slots: string[] | null;
  rooms: number | null;
  bathrooms: number | null;
  area: number | null;
};

type BookingRow = {
  id: string;
  house_id: string;
  house_title: string;
  house_image: string;
  house_price_per_visit: number;
  guest_id: string;
  guest_name: string;
  visit_date: string;
  visit_time_slot: string;
  total_visitors: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  rating: number | null;
  created_at: string;
};

function houseFromRow(r: HouseRow): House {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    pricePerVisit: r.price_per_visit,
    imageUrl: r.image_url,
    imageUrls: r.image_urls ?? [],
    location: r.location,
    hostId: r.host_id,
    hostName: r.host_name,
    hostAvatar: r.host_avatar,
    amenities: r.amenities ?? [],
    maxGuests: r.max_guests,
    rating: r.rating ?? undefined,
    reviewsCount: r.reviews_count ?? 0,
    availableDates: r.available_dates ?? [],
    availableTimeSlots: r.available_time_slots ?? [],
    rooms: r.rooms ?? undefined,
    bathrooms: r.bathrooms ?? undefined,
    area: r.area ?? undefined,
  };
}

function bookingFromRow(r: BookingRow): Booking {
  return {
    id: r.id,
    houseId: r.house_id,
    houseTitle: r.house_title,
    houseImage: r.house_image,
    housePricePerVisit: r.house_price_per_visit,
    guestId: r.guest_id,
    guestName: r.guest_name,
    visitDate: r.visit_date,
    visitTimeSlot: r.visit_time_slot,
    totalVisitors: r.total_visitors,
    totalPrice: r.total_price,
    status: r.status,
    rating: r.rating ?? undefined,
    createdAt: (r.created_at ?? '').split('T')[0],
  };
}

// ============================
// Profile
// ============================
export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar, balance')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('fetchProfile error', error);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    avatar: data.avatar,
    balance: Number(data.balance ?? 0),
  };
}

// ============================
// Houses
// ============================
export async function fetchHouses(): Promise<House[]> {
  const { data, error } = await supabase
    .from('houses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchHouses error', error);
    return [];
  }
  return (data as HouseRow[]).map(houseFromRow);
}

export async function addHouseListingDb(
  input: Omit<House, 'id' | 'rating' | 'reviewsCount'>,
): Promise<House | null> {
  const { data, error } = await supabase
    .from('houses')
    .insert({
      title: input.title,
      description: input.description,
      price_per_visit: input.pricePerVisit,
      image_url: input.imageUrl,
      image_urls: input.imageUrls ?? [],
      location: input.location,
      host_id: input.hostId,
      host_name: input.hostName,
      host_avatar: input.hostAvatar,
      amenities: input.amenities ?? [],
      max_guests: input.maxGuests,
      available_dates: input.availableDates ?? [],
      available_time_slots: input.availableTimeSlots ?? [],
      rooms: input.rooms ?? null,
      bathrooms: input.bathrooms ?? null,
      area: input.area ?? null,
    })
    .select('*')
    .single();
  if (error) {
    console.error('addHouseListingDb error', error);
    return null;
  }
  return houseFromRow(data as HouseRow);
}

// ============================
// Bookings
// ============================
export async function fetchBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchBookings error', error);
    return [];
  }
  return (data as BookingRow[]).map(bookingFromRow);
}

// 특정 매물의 날짜·시간대별 예약 인원 집계 (남은 자리 계산용)
export async function fetchHouseSlotLoad(houseId: string): Promise<SlotLoad[]> {
  const { data, error } = await supabase.rpc('house_slot_load', { _house_id: houseId });
  if (error) {
    console.error('fetchHouseSlotLoad error', error);
    return [];
  }
  return ((data ?? []) as { visit_date: string; visit_time_slot: string; booked_visitors: number }[]).map(
    (r) => ({
      visitDate: r.visit_date,
      visitTimeSlot: r.visit_time_slot,
      bookedVisitors: Number(r.booked_visitors ?? 0),
    }),
  );
}

export async function addBookingDb(
  input: Omit<Booking, 'id' | 'status' | 'createdAt' | 'rating'>,
): Promise<{ booking: Booking | null; error: string | null }> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      house_id: input.houseId,
      house_title: input.houseTitle,
      house_image: input.houseImage,
      house_price_per_visit: input.housePricePerVisit,
      guest_id: input.guestId,
      guest_name: input.guestName,
      visit_date: input.visitDate,
      visit_time_slot: input.visitTimeSlot,
      total_visitors: input.totalVisitors,
      total_price: input.totalPrice,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) {
    console.error('addBookingDb error', error);
    return { booking: null, error: error.message || '예약 신청에 실패했습니다.' };
  }
  return { booking: bookingFromRow(data as BookingRow), error: null };
}


export async function updateBookingStatusDb(
  bookingId: string,
  status: 'confirmed' | 'cancelled' | 'completed',
): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId);
  if (error) console.error('updateBookingStatusDb error', error);
}

// 게스트가 임장 완료 후 별점을 등록하면 booking에 저장.
// 매물 평점/리뷰 수는 DB 트리거가 자동 재계산함.
export async function submitBookingReviewDb(
  bookingId: string,
  rating: number,
): Promise<House | null> {
  const { data: bookingRow, error: bErr } = await supabase
    .from('bookings')
    .update({ rating })
    .eq('id', bookingId)
    .select('house_id')
    .single();
  if (bErr || !bookingRow) {
    console.error('submitBookingReviewDb error', bErr);
    return null;
  }
  const { data: houseRow, error: hErr } = await supabase
    .from('houses')
    .select('*')
    .eq('id', bookingRow.house_id)
    .single();
  if (hErr || !houseRow) return null;
  return houseFromRow(houseRow as HouseRow);
}
