import { Booking, House, UserProfile } from './types';

const USERS_KEY = 'imtam_users';
const HOUSES_KEY = 'imtam_houses';
const BOOKINGS_KEY = 'imtam_bookings';

const defaultUser = {
  id: 'test_imtam_com',
  email: 'test@imtam.com',
  name: '임탐테스터 (나)',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  balance: 10000000,
};

type StoredUser = UserProfile & { email: string };

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function seedInitialDatabaseIfEmpty() {
  const users = readJson<StoredUser[]>(USERS_KEY, []);
  if (users.length === 0) writeJson(USERS_KEY, [defaultUser]);

  // Purge previously-seeded demo houses and bookings so the initial
  // listing only contains entries real users have registered.
  if (canUseStorage()) {
    const DEMO_HOUSE_IDS = new Set(['house-1', 'house-2', 'house-3', 'house-4', 'house-5']);
    const DEMO_BOOKING_IDS = new Set(['booking-mock-1', 'booking-mock-2']);
    const houses = readJson<House[]>(HOUSES_KEY, []);
    const realHouses = houses.filter((h) => !DEMO_HOUSE_IDS.has(h.id));
    if (realHouses.length !== houses.length) writeJson(HOUSES_KEY, realHouses);
    const bookings = readJson<Booking[]>(BOOKINGS_KEY, []);
    const realBookings = bookings.filter(
      (b) => !DEMO_BOOKING_IDS.has(b.id) && !DEMO_HOUSE_IDS.has(b.houseId),
    );
    if (realBookings.length !== bookings.length) writeJson(BOOKINGS_KEY, realBookings);
  }
}

export function findUserByEmail(email: string): UserProfile | null {
  const normEmail = email.trim().toLowerCase();
  const users = readJson<StoredUser[]>(USERS_KEY, [defaultUser]);
  const found = users.find((user) => user.email.toLowerCase() === normEmail);
  return found ? toUserProfile(found) : null;
}

export function createUserProfile(email: string, name: string, avatar: string): UserProfile {
  const users = readJson<StoredUser[]>(USERS_KEY, [defaultUser]);
  const newUser: StoredUser = {
    id: `user_${Date.now()}`,
    email: email.trim().toLowerCase(),
    name: name.trim(),
    avatar,
    balance: 10000000,
  };
  writeJson(USERS_KEY, [...users, newUser]);
  return toUserProfile(newUser);
}

export function fetchHouses(): House[] {
  return readJson<House[]>(HOUSES_KEY, []);
}

export function addHouseListingDb(house: House): void {
  const houses = readJson<House[]>(HOUSES_KEY, []);
  writeJson(HOUSES_KEY, [house, ...houses.filter((item) => item.id !== house.id)]);
}

export function fetchBookings(): Booking[] {
  return readJson<Booking[]>(BOOKINGS_KEY, []);
}

export function addBookingDb(booking: Booking): void {
  const bookings = readJson<Booking[]>(BOOKINGS_KEY, []);
  writeJson(BOOKINGS_KEY, [booking, ...bookings.filter((item) => item.id !== booking.id)]);
}

export function updateBookingStatusDb(
  bookingId: string,
  status: 'confirmed' | 'cancelled' | 'completed',
): void {
  const bookings = readJson<Booking[]>(BOOKINGS_KEY, []);
  writeJson(
    BOOKINGS_KEY,
    bookings.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking)),
  );
}

// 게스트가 임장 완료 후 별점을 등록하면 해당 booking에 rating을 저장하고,
// 해당 매물의 전체 평균 평점/리뷰 수를 실제 작성된 리뷰 기준으로 다시 계산한다.
export function submitBookingReviewDb(
  bookingId: string,
  rating: number,
): House | null {
  const bookings = readJson<Booking[]>(BOOKINGS_KEY, []);
  const target = bookings.find((b) => b.id === bookingId);
  if (!target) return null;

  const updatedBookings = bookings.map((b) =>
    b.id === bookingId ? { ...b, rating } : b,
  );
  writeJson(BOOKINGS_KEY, updatedBookings);

  // 해당 매물에 작성된 모든 실제 리뷰 평균 재계산
  const houseReviews = updatedBookings.filter(
    (b) => b.houseId === target.houseId && typeof b.rating === 'number',
  );
  const reviewsCount = houseReviews.length;
  const avg =
    reviewsCount === 0
      ? undefined
      : houseReviews.reduce((sum, b) => sum + (b.rating ?? 0), 0) / reviewsCount;

  const houses = readJson<House[]>(HOUSES_KEY, []);
  let updatedHouse: House | null = null;
  const nextHouses = houses.map((h) => {
    if (h.id !== target.houseId) return h;
    const next: House = { ...h, rating: avg, reviewsCount };
    updatedHouse = next;
    return next;
  });
  writeJson(HOUSES_KEY, nextHouses);
  return updatedHouse;
}


function toUserProfile(user: StoredUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    balance: user.balance,
  };
}