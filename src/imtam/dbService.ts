import { Booking, House, UserProfile } from './types';
import { INITIAL_BOOKINGS, INITIAL_HOUSES } from './initialData';

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

export async function seedInitialDatabaseIfEmpty() {
  const users = readJson<StoredUser[]>(USERS_KEY, []);
  if (users.length === 0) writeJson(USERS_KEY, [defaultUser]);

  const houses = readJson<House[]>(HOUSES_KEY, []);
  if (houses.length === 0) {
    writeJson(
      HOUSES_KEY,
      INITIAL_HOUSES.map((house, index) => ({
        ...house,
        rooms: house.rooms ?? Math.min(4, index + 2),
        bathrooms: house.bathrooms ?? (index % 2 === 0 ? 2 : 1),
        area: house.area ?? 18 + index * 6,
        availableDates: house.availableDates ?? getNextDays(4 + (index % 2)),
        availableTimeSlots: house.availableTimeSlots ?? [
          '오전 10:00 ~ 12:00',
          '오후 02:00 ~ 04:00',
          '저녁 07:00 ~ 09:00',
        ],
      })),
    );
  }

  const bookings = readJson<Booking[]>(BOOKINGS_KEY, []);
  if (bookings.length === 0) writeJson(BOOKINGS_KEY, INITIAL_BOOKINGS);
}

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const normEmail = email.trim().toLowerCase();
  const users = readJson<StoredUser[]>(USERS_KEY, [defaultUser]);
  const found = users.find((user) => user.email.toLowerCase() === normEmail);
  return found ? toUserProfile(found) : null;
}

export async function createUserProfile(email: string, name: string, avatar: string): Promise<UserProfile> {
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

export async function fetchHouses(): Promise<House[]> {
  return readJson<House[]>(HOUSES_KEY, []);
}

export async function addHouseListingDb(house: House): Promise<void> {
  const houses = readJson<House[]>(HOUSES_KEY, []);
  writeJson(HOUSES_KEY, [house, ...houses.filter((item) => item.id !== house.id)]);
}

export async function fetchBookings(): Promise<Booking[]> {
  return readJson<Booking[]>(BOOKINGS_KEY, []);
}

export async function addBookingDb(booking: Booking): Promise<void> {
  const bookings = readJson<Booking[]>(BOOKINGS_KEY, []);
  writeJson(BOOKINGS_KEY, [booking, ...bookings.filter((item) => item.id !== booking.id)]);
}

export async function updateBookingStatusDb(bookingId: string, status: 'confirmed' | 'cancelled'): Promise<void> {
  const bookings = readJson<Booking[]>(BOOKINGS_KEY, []);
  writeJson(
    BOOKINGS_KEY,
    bookings.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking)),
  );
}

function toUserProfile(user: StoredUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    balance: user.balance,
  };
}

function getNextDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    return date.toISOString().split('T')[0];
  });
}