import React, { useState } from 'react';
import { House, Booking } from '../types';
import { PlusCircle, DollarSign, ListFilter, ClipboardCheck, ArrowUpRight, Calendar, Clock, User, Eye, Sparkles, Building, Landmark, Upload, X, Camera } from 'lucide-react';

interface HostDashboardProps {
  houses: House[];
  bookings: Booking[];
  currentUserId: string;
  onAddHouse: (newHouse: Omit<House, 'id' | 'hostId' | 'hostName' | 'hostAvatar' | 'rating' | 'reviewsCount'>) => void;
  onUpdateBookingStatus: (bookingId: string, status: 'confirmed' | 'cancelled') => void;
  onSelectHouse: (house: House) => void;
}

const PRESET_IMAGES = [
  {
    name: '유기농 가든 & 빈티지 월넛 룸',
    url: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: '리노베이션 한옥 서재 & 다도',
    url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: '하이엔드 오디오 & 오션 펜트하우스',
    url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: '내추럴 화로 오크 산택 오두막',
    url: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: '업사이클링 빈티지 아틀리에 숍',
    url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
  }
];

export default function HostDashboard({
  houses,
  bookings,
  currentUserId,
  onAddHouse,
  onUpdateBookingStatus,
  onSelectHouse
}: HostDashboardProps) {
  // Filter objects owned by the current host
  const hostHouses = houses.filter((h) => h.hostId === currentUserId);
  const hostHouseIds = hostHouses.map((h) => h.id);
  const receivedBookings = bookings.filter((b) => hostHouseIds.includes(b.houseId));

  // Form states in host section
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pricePerVisit, setPricePerVisit] = useState<number>(30000);
  const [location, setLocation] = useState('');
  const [maxGuests, setMaxGuests] = useState<number>(2);
  const [rooms, setRooms] = useState<number>(3);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [area, setArea] = useState<number>(24);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Visit Dates & Slots configuration states
  const getNextDays = (count = 3) => {
    const dates = [];
    for (let i = 1; i <= count; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const [availableDates, setAvailableDates] = useState<string[]>(getNextDays(3));
  const [dateInput, setDateInput] = useState<string>('');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([
    '오전 10:00 ~ 12:00',
    '오후 02:00 ~ 04:00',
    '오후 04:00 ~ 06:00',
    '저녁 07:00 ~ 09:00'
  ]);
  const [customTimeInput, setCustomTimeInput] = useState<string>('');

  // Stats calculation
  const totalHostEarnings = receivedBookings
    .filter((b) => b.status === 'confirmed')
    .reduce((sum, b) => sum + b.totalPrice, 0);

  const pendingCount = receivedBookings.filter((b) => b.status === 'pending').length;

  // --- Handlers for up to 8 uploaded compressed images ---
  const compressAndAndImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 1024; // High definition but light file footprint

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Convert to web-optimized JPEG at 75% quality (around ~80KB-120KB)
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            resolve(compressed);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error('이미지 분석 실패'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList) => {
    const fileList = Array.from(files);
    const imageFiles = fileList.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (uploadedImages.length + imageFiles.length > 8) {
      alert('사진은 최대 8장까지만 업로드할 수 있습니다.');
      return;
    }

    for (const file of imageFiles) {
      try {
        const compressedBase64 = await compressAndAndImage(file);
        setUploadedImages((prev) => {
          if (prev.length >= 8) return prev;
          return [...prev, compressedBase64];
        });
      } catch (err) {
        console.error('Image compression failed:', err);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setUploadedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddDate = () => {
    if (!dateInput) {
      alert('추가할 날짜를 선택해주세요.');
      return;
    }
    if (availableDates.includes(dateInput)) {
      alert('이미 설정된 방문 가능 날짜입니다.');
      return;
    }
    setAvailableDates((prev) => [...prev, dateInput].sort());
    setDateInput('');
  };

  const handleRemoveDate = (dateToRemove: string) => {
    setAvailableDates((prev) => prev.filter((d) => d !== dateToRemove));
  };

  const handleToggleTimeSlot = (slot: string) => {
    if (availableTimeSlots.includes(slot)) {
      setAvailableTimeSlots((prev) => prev.filter((item) => item !== slot));
    } else {
      setAvailableTimeSlots((prev) => [...prev, slot]);
    }
  };

  const handleAddCustomTimeSlot = () => {
    const trimmed = customTimeInput.trim();
    if (!trimmed) {
      alert('시간 및 설명 문구를 입력해 주세요.');
      return;
    }
    if (availableTimeSlots.includes(trimmed)) {
      alert('이미 등록된 시간대입니다.');
      return;
    }
    setAvailableTimeSlots((prev) => [...prev, trimmed]);
    setCustomTimeInput('');
  };

  const handleRemoveTimeSlot = (slotToRemove: string) => {
    setAvailableTimeSlots((prev) => prev.filter((slot) => slot !== slotToRemove));
  };

  const handleAddHouseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !location.trim()) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    if (uploadedImages.length === 0) {
      alert('최소 1장 이상의 대표 임장 주거 컷을 직접 업로드해 주세요.');
      return;
    }

    if (availableDates.length === 0) {
      alert('방문 가능한 날짜를 최소 1일 이상 지정해 주세요.');
      return;
    }

    if (availableTimeSlots.length === 0) {
      alert('방문 가능한 시간대 또는 타입 슬롯을 최소 1개 이상 활성화해 주세요.');
      return;
    }

    onAddHouse({
      title,
      description,
      pricePerVisit,
      location,
      maxGuests,
      imageUrl: uploadedImages[0], // 첫 번째 이미지를 대표(썸네일) 컷으로 등록
      imageUrls: uploadedImages,    // 전체 등록한 이미지 목록 (최대 8장) 보존
      amenities: [],
      availableDates,
      availableTimeSlots,
      rooms,
      bathrooms,
      area,
    });

    setIsSuccess(true);
    // Reset form
    setTitle('');
    setDescription('');
    setPricePerVisit(30000);
    setLocation('');
    setMaxGuests(2);
    setRooms(3);
    setBathrooms(2);
    setArea(24);
    setUploadedImages([]);
    setAvailableDates(getNextDays(3));
    setAvailableTimeSlots([
      '오전 10:00 ~ 12:00',
      '오후 02:00 ~ 04:00',
      '오후 04:00 ~ 06:00',
      '저녁 07:00 ~ 09:00'
    ]);
    setDateInput('');
    setCustomTimeInput('');

    setTimeout(() => {
      setIsSuccess(false);
    }, 3000);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Host Earnings & Wallet Stats */}
      <div className="bg-white rounded-3xl border border-blue-100 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <DollarSign className="w-5 h-5 animate-pulse" />
          </span>
          <div>
            <span className="text-[10px] font-extrabold tracking-wider text-neutral-400 uppercase block">누적 중개 매칭 및 가이드 수수료 정산 현황</span>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-neutral-900">₩{totalHostEarnings.toLocaleString()}</span>
              <span className="text-xs text-neutral-400 font-bold text-emerald-600 inline-flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5 inline" />
                <span>체결·확정 완료 {receivedBookings.filter((b) => b.status === "confirmed").length}건</span>
              </span>
            </div>
          </div>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-neutral-100 pt-3 md:pt-0 md:pl-6 flex flex-col justify-center text-xs text-neutral-500 font-semibold shrink-0">
          <span className="text-neutral-400 text-[10px] uppercase font-bold mb-0.5">승인 심사 대기 자금</span>
          <span className="font-extrabold text-sm text-blue-600">
            ₩{receivedBookings.filter((b) => b.status === 'pending').reduce((s, b) => s + b.totalPrice, 0).toLocaleString()} ({pendingCount}건 대기)
          </span>
        </div>
      </div>

      {/* Main Grid: Management Form (Left) & Visitor Reservation list (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Form to List new house (3/5 width) */}
        <div className="xl:col-span-3 bg-white rounded-3xl border border-neutral-200 p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg md:text-xl font-black text-neutral-900 tracking-tight">오픈하우스 등록</h3>
          </div>

          {isSuccess && (
            <div className="bg-emerald-50 text-emerald-800 text-xs md:text-sm font-bold p-4 rounded-2xl border border-emerald-200 flex items-center gap-2 animate-bounce">
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>신규 주택 매물이 임장 투어 및 지도 채널 리스트에 정상 등재되었습니다!</span>
            </div>
          )}

          <form onSubmit={handleAddHouseSubmit} className="space-y-5">
            {/* Title / Description */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">매물 한 줄 소개 (제목) *</label>
                <input
                  type="text"
                  placeholder="예: 분당 정자동 테라스 타운하우스 및 정밀 조경 조망 오픈하우스"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">실내 실사 및 인테리어 건축 핵심 제원 가이드제공 *</label>
                <textarea
                  placeholder="공간의 지분 가치, 우수한 정주권, 사용된 수입 조명 및 수입 가구 배치 옵션 등 탐방 및 투어에 나서는 투자 바이어가 확인해야 할 프리미엄 요점을 남겨주세요."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  required
                />
              </div>
            </div>

            {/* Pricing & Location & Guests count */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">1인 임장 수수료 가이드 가격 (원) *</label>
                <input
                  type="number"
                  placeholder="50,000"
                  value={pricePerVisit}
                  onChange={(e) => setPricePerVisit(Math.max(1000, Number(e.target.value)))}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  min="1000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">회차당 최대 가이드 가능 인원 (명) *</label>
                <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50/50 p-2 text-xs justify-between">
                  <span className="text-neutral-500 pl-2 text-xs">동행 실사</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMaxGuests(Math.max(1, maxGuests - 1))}
                      className="w-8 h-8 rounded-full border border-neutral-200 bg-white hover:bg-neutral-100 flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold text-neutral-800 w-5 text-center">{maxGuests}</span>
                    <button
                      type="button"
                      onClick={() => setMaxGuests(maxGuests + 1)}
                      className="w-8 h-8 rounded-full border border-neutral-200 bg-white hover:bg-neutral-100 flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">실제 매물 구역 상세 (시/군/구 동단위) *</label>
                <input
                  type="text"
                  placeholder="예: 경기도 성남시 분당구 정자동"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  required
                />
              </div>
            </div>

            {/* 매물 내부 구조 상세 스펙 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-neutral-100 pt-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">방 개수 *</label>
                <input
                  type="number"
                  placeholder="3"
                  value={rooms}
                  onChange={(e) => setRooms(Math.max(1, Number(e.target.value)))}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">화장실 개수 *</label>
                <input
                  type="number"
                  placeholder="2"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Math.max(1, Number(e.target.value)))}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">공급 면적 (평수) *</label>
                <input
                  type="number"
                  placeholder="24"
                  value={area}
                  onChange={(e) => setArea(Math.max(1, Number(e.target.value)))}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  min="1"
                  required
                />
              </div>
            </div>

            {/* Image Upload Dropzone (Max 8 photos, Supports Drag & Drop) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-neutral-700">
                <span>실제 매물 전경 및 실내 사진 등록 (최대 8장) *</span>
                <span className={`text-[11px] ${uploadedImages.length === 8 ? 'text-amber-600' : 'text-neutral-400'}`}>
                  {uploadedImages.length} / 8 장 업로드 완료
                </span>
              </div>

              {/* Dropzone container */}
              <label
                htmlFor="house-images-uploader"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all gap-2 block ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/50 scale-[0.99] text-blue-700'
                    : 'border-neutral-250 bg-neutral-50/50 hover:bg-neutral-50 hover:border-blue-400 text-neutral-500'
                }`}
              >
                <input
                  type="file"
                  id="house-images-uploader"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploadedImages.length >= 8}
                />
                
                <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-600 animate-bounce' : 'text-neutral-400'}`} />
                <div>
                  <p className="text-xs font-bold text-neutral-800">
                    실제 공간 사진들을 드래그 앤 드롭 하거나 클릭하여 탐색기에서 선택
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-1 leading-normal">
                    매물 신뢰도를 높이기 위해 실물 등기 및 인테리어 실사 원본 등록을 권장합니다. (개별 최대 5MB)
                  </p>
                </div>
              </label>

              {/* Image Previews / Thumbnails Grid */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3.5 pt-1.5">
                  {uploadedImages.map((imageUri, index) => (
                    <div
                      key={index}
                      className="relative rounded-xl overflow-hidden aspect-square border border-neutral-200 bg-neutral-100 shadow-xs animate-fadeIn group"
                    >
                      <img
                        src={imageUri}
                        alt={`등록사진-${index + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Delete button badge */}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 bg-black/75 hover:bg-red-600 text-white p-1 rounded-full shadow-md transition-colors cursor-pointer"
                        title="사진 삭제"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* Main representative image badge on first index */}
                      {index === 0 && (
                        <div className="absolute bottom-1 left-1 right-1 bg-blue-600 text-white py-0.5 text-[8px] font-black text-center rounded-md pointer-events-none select-none tracking-tight">
                          대표 사진
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Appointment Scheduling Settings (Visit Dates & Timeslots) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-neutral-150 pt-5 pr-1">
              {/* Left Side: Appointment Dates Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-neutral-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>방문객 맞이 가능 날짜 설정 *</span>
                </label>
                <p className="text-[11px] text-neutral-450 leading-normal">
                  바이어들이 현장 임장을 예약하고 직접 내방할 수 있는 날짜들을 하나씩 추가해주세요.
                </p>
                
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateInput}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="flex-1 text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-2 rounded-xl bg-neutral-50/50 text-neutral-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddDate}
                    className="bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-black px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                  >
                    날짜 추가
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[85px] p-2 bg-neutral-50 rounded-xl border border-neutral-150">
                  {availableDates.length === 0 ? (
                    <span className="text-[10px] text-neutral-400 font-semibold p-1">지정한 일정이 없습니다. 날짜를 선정해 주세요.</span>
                  ) : (
                    availableDates.map((date) => (
                      <span
                        key={date}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-50 text-blue-700 p-1 px-2.5 rounded-lg border border-blue-100 animate-fadeIn"
                      >
                        {date}
                        <button
                          type="button"
                          onClick={() => handleRemoveDate(date)}
                          className="hover:bg-blue-100 text-blue-900 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center text-[9px] font-black cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Right Side: Appointment Hours / Time slots Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-black text-neutral-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>방문 예약 타임 슬롯 설정 *</span>
                </label>
                <p className="text-[11px] text-neutral-450 leading-normal">
                  바이어가 선택할 수 있는 정기 안내 코스를 체크하거나 커스텀 시간대를 만들어 입정시킵니다.
                </p>

                {/* Preset Time Slots Toggler */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    '오전 10:00 ~ 12:00',
                    '오후 02:00 ~ 04:00',
                    '오후 04:00 ~ 06:00',
                    '저녁 07:00 ~ 09:00'
                  ].map((slot) => {
                    const isChecked = availableTimeSlots.includes(slot);
                    return (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => handleToggleTimeSlot(slot)}
                        className={`text-[11px] font-bold py-1.5 rounded-lg border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white font-extrabold'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Time Slot Creator */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="예: 주말 특별투어 13:00 ~ 15:00"
                    value={customTimeInput}
                    onChange={(e) => setCustomTimeInput(e.target.value)}
                    className="flex-1 text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-2 rounded-xl bg-neutral-50/50 text-neutral-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTimeSlot}
                    className="bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-black px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                  >
                    슬롯 추가
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[85px] p-2 bg-neutral-50 rounded-xl border border-neutral-150">
                  {availableTimeSlots.length === 0 ? (
                    <span className="text-[10px] text-neutral-400 font-semibold p-1">활성화된 예약 시간대가 없습니다.</span>
                  ) : (
                    availableTimeSlots.map((slot) => (
                      <span
                        key={slot}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-neutral-100 text-neutral-800 p-1 px-2.5 rounded-lg border border-neutral-200"
                      >
                        {slot}
                        <button
                          type="button"
                          onClick={() => handleRemoveTimeSlot(slot)}
                          className="hover:bg-neutral-200 text-neutral-900 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center text-[9px] font-black cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold py-3.5 px-4 rounded-xl cursor-pointer shadow-md transition-all mt-4"
            >
              공식 투어 오픈하우스 리스트에 부동산 매물 올려두기
            </button>
          </form>
        </div>

        {/* Visitor Requests / Bookings Received (2/5 width) */}
        <div className="xl:col-span-2 space-y-5">
          {/* List of current listings */}
          <div className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-4">
            <h4 className="font-bold text-neutral-900 text-sm md:text-base flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-blue-600" />
              <span>현재 전속 등록한 내 오픈하우스 매물 목록 ({hostHouses.length}지점)</span>
            </h4>
            
            {hostHouses.length === 0 ? (
              <p className="text-neutral-400 text-xs text-center py-6 font-semibold">아직 리스팅 완료된 부동산 실소유 개방 매물이 없습니다.</p>
            ) : (
              <div className="divide-y divide-neutral-105 max-h-[190px] overflow-y-auto pr-1">
                {hostHouses.map((hCode) => (
                  <div key={hCode.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={hCode.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-neutral-100 shrink-0 border border-neutral-200" referrerPolicy="no-referrer" />
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-neutral-800 truncate" title={hCode.title}>{hCode.title}</h5>
                        <p className="text-[10px] text-neutral-500 font-semibold">방 {hCode.rooms ?? 3}개 · 욕실 {hCode.bathrooms ?? 2}개 · {hCode.area ?? 24}평</p>
                        <p className="text-[10px] text-blue-600 font-bold">₩{hCode.pricePerVisit.toLocaleString()} / 임장 가이드</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectHouse(hCode)}
                      className="shrink-0 text-[10px] font-bold px-2 py-1 border border-neutral-200 hover:border-blue-400 hover:text-blue-600 rounded-lg text-neutral-600 bg-white flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3 text-blue-500" />
                      매물 실사
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incoming Bookings panel */}
          <div className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-4 flex flex-col h-[400px]">
            <h4 className="font-bold text-neutral-900 text-sm md:text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-blue-600" />
                <span>오픈하우스 수강 및 현장 임장 신청자 목록</span>
              </div>
              {pendingCount > 0 && (
                <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  조율중 {pendingCount}
                </span>
              )}
            </h4>

            {receivedBookings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                <Calendar className="w-10 h-10 text-neutral-300 mb-2" />
                <p className="text-neutral-500 text-xs font-bold">아직 접수된 현치 임장 조율 요청이 없습니다.</p>
                <p className="text-[10px] text-neutral-400 mt-1 max-w-[200px] leading-relaxed font-semibold">
                  계정 모드를 전환해 타 주택에 가상으로 임장 투어를 청약해 테스트해보실 수 있습니다!
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {receivedBookings.map((bk) => (
                  <div
                    key={bk.id}
                    className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl flex flex-col gap-2.5 relative"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-neutral-800">{bk.guestName}</span>
                          <span className="text-[10px] text-neutral-400 ml-1">바이어 지망</span>
                        </div>
                      </div>

                      {/* Status pill */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        bk.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : bk.status === 'cancelled'
                            ? 'bg-neutral-200 text-neutral-600'
                            : 'bg-blue-100 text-blue-700'
                      }`}>
                        {bk.status === 'confirmed' ? '임장확정' : bk.status === 'cancelled' ? '배정취소' : '조율대기'}
                      </span>
                    </div>

                    {/* Booking stays summary */}
                    <div className="text-xs text-neutral-600 border-t border-neutral-150 pt-2 space-y-1 font-semibold">
                      <p className="font-bold text-neutral-800 truncate mb-1">임장 주택: {bk.houseTitle}</p>
                      <p className="text-[11px]"><span className="text-neutral-400 shrink-0">매칭일정:</span> {bk.visitDate} ({bk.visitTimeSlot})</p>
                      <p className="text-[11px]"><span className="text-neutral-400 shrink-0">동행단 수:</span> {bk.totalVisitors}명</p>
                      <p className="text-[11px] font-bold text-blue-700"><span className="text-neutral-400 font-semibold text-neutral-600">안내 정산액:</span> ₩{bk.totalPrice.toLocaleString()}</p>
                    </div>

                    {/* Pending Action Buttons */}
                    {bk.status === 'pending' && (
                      <div className="grid grid-cols-2 gap-2 border-t border-neutral-150 pt-2 text-xs font-sans">
                        <button
                          onClick={() => onUpdateBookingStatus(bk.id, 'cancelled')}
                          className="py-1 px-2 border border-neutral-300 rounded-lg hover:border-neutral-400 font-bold text-neutral-500 hover:text-neutral-850 bg-white cursor-pointer transition-all"
                        >
                          조율 불가 거절
                        </button>
                        <button
                          onClick={() => onUpdateBookingStatus(bk.id, 'confirmed')}
                          className="py-1 px-2 bg-blue-600 hover:bg-blue-700 font-bold text-white rounded-lg cursor-pointer transition-all"
                        >
                          임장 예약 수락
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
