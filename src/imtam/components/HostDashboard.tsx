import React, { useState } from "react";
import { T } from "../strings";
import { House, Booking } from "../types";
import {
  PlusCircle,
  DollarSign,
  ListFilter,
  ClipboardCheck,
  ArrowUpRight,
  Calendar,
  Clock,
  User,
  Eye,
  Sparkles,
  Building,
  Landmark,
  Upload,
  X,
  Camera,
} from "lucide-react";

interface HostDashboardProps {
  houses: House[];
  bookings: Booking[];
  currentUserId: string;
  onAddHouse: (newHouse: Omit<House, "id" | "hostId" | "hostName" | "hostAvatar" | "rating" | "reviewsCount">) => void;
  onUpdateBookingStatus: (bookingId: string, status: "confirmed" | "cancelled" | "completed") => void;
  onSelectHouse: (house: House) => void;
}

export default function HostDashboard({
  houses,
  bookings,
  currentUserId,
  onAddHouse,
  onUpdateBookingStatus,
  onSelectHouse,
}: HostDashboardProps) {
  // Filter objects owned by the current host
  const hostHouses = houses.filter((h) => h.hostId === currentUserId);
  const hostHouseIds = hostHouses.map((h) => h.id);
  const receivedBookings = bookings.filter((b) => hostHouseIds.includes(b.houseId));

  // Form states in host section
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerVisit, setPricePerVisit] = useState<number>(30000);
  const [location, setLocation] = useState("");
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
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };

  const [availableDates, setAvailableDates] = useState<string[]>(getNextDays(3));
  const [dateInput, setDateInput] = useState<string>("");
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([
    T.host.timeSlotMorning,
    T.host.timeSlotAfternoon1,
    T.host.timeSlotAfternoon2,
    T.host.timeSlotEvening,
  ]);
  const [customTimeInput, setCustomTimeInput] = useState<string>("");

  // Stats calculation
  const totalHostEarnings = receivedBookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + b.totalPrice, 0);

  const pendingCount = receivedBookings.filter((b) => b.status === "pending").length;

  // --- Handlers for up to 8 uploaded compressed images ---
  const compressAndAndImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
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
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Convert to web-optimized JPEG at 75% quality (around ~80KB-120KB)
            const compressed = canvas.toDataURL("image/jpeg", 0.75);
            resolve(compressed);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error(T.host.imageAnalysisFailed));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error(T.host.fileReadFailed));
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList) => {
    const fileList = Array.from(files);
    const imageFiles = fileList.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      alert(T.host.onlyImageFilesAlert);
      return;
    }

    if (uploadedImages.length + imageFiles.length > 8) {
      alert(T.host.maxPhotosAlert);
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
        console.error("Image compression failed:", err);
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
      alert(T.host.selectDateAlert);
      return;
    }
    if (availableDates.includes(dateInput)) {
      alert(T.host.dateAlreadySetAlert);
      return;
    }
    setAvailableDates((prev) => [...prev, dateInput].sort());
    setDateInput("");
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
      alert(T.host.enterTimeSlotAlert);
      return;
    }
    if (availableTimeSlots.includes(trimmed)) {
      alert(T.host.timeSlotAlreadyRegisteredAlert);
      return;
    }
    setAvailableTimeSlots((prev) => [...prev, trimmed]);
    setCustomTimeInput("");
  };

  const handleRemoveTimeSlot = (slotToRemove: string) => {
    setAvailableTimeSlots((prev) => prev.filter((slot) => slot !== slotToRemove));
  };

  const handleAddHouseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !location.trim()) {
      alert(T.host.requiredFieldsAlert);
      return;
    }

    if (uploadedImages.length === 0) {
      alert(T.host.minOnePhotoAlert);
      return;
    }

    if (availableDates.length === 0) {
      alert(T.host.minOneDateAlert);
      return;
    }

    if (availableTimeSlots.length === 0) {
      alert(T.host.minOneTimeSlotAlert);
      return;
    }

    onAddHouse({
      title,
      description,
      pricePerVisit,
      location,
      maxGuests,
      imageUrl: uploadedImages[0], // 첫 번째 이미지를 대표(썸네일) 컷으로 등록
      imageUrls: uploadedImages, // 전체 등록한 이미지 목록 (최대 8장) 보존
      amenities: [],
      availableDates,
      availableTimeSlots,
      rooms,
      bathrooms,
      area,
    });

    setIsSuccess(true);
    // Reset form
    setTitle("");
    setDescription("");
    setPricePerVisit(30000);
    setLocation("");
    setMaxGuests(2);
    setRooms(3);
    setBathrooms(2);
    setArea(24);
    setUploadedImages([]);
    setAvailableDates(getNextDays(3));
    setAvailableTimeSlots([T.host.timeSlotMorning, T.host.timeSlotAfternoon1, T.host.timeSlotAfternoon2, T.host.timeSlotEvening]);
    setDateInput("");
    setCustomTimeInput("");

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
            <span className="text-[10px] font-extrabold tracking-wider text-neutral-400 uppercase block">
              {T.host.totalEarningsLabel}
            </span>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-neutral-900">
                ₩{totalHostEarnings.toLocaleString()}
              </span>
              <span className="text-xs text-neutral-400 font-bold text-emerald-600 inline-flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5 inline" />
                <span>{T.host.confirmedCountPrefix}{receivedBookings.filter((b) => b.status === "confirmed").length}{T.host.confirmedCountSuffix}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-neutral-100 pt-3 md:pt-0 md:pl-6 flex flex-col justify-center text-xs text-neutral-500 font-semibold shrink-0">
          <span className="text-neutral-400 text-[10px] uppercase font-bold mb-0.5">{T.host.pendingFundsLabel}</span>
          <span className="font-extrabold text-sm text-blue-600">
            ₩
            {receivedBookings
              .filter((b) => b.status === "pending")
              .reduce((s, b) => s + b.totalPrice, 0)
              .toLocaleString()}{" "}
            {T.host.pendingCountPrefix}{pendingCount}{T.host.pendingCountSuffix}
          </span>
        </div>
      </div>

      {/* Main Grid: Management Form (Left) & Visitor Reservation list (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Form to List new house (3/5 width) */}
        <div className="xl:col-span-3 bg-white rounded-3xl border border-neutral-200 p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg md:text-xl font-black text-neutral-900 tracking-tight">{T.host.registerListingTitle}</h3>
          </div>

          {isSuccess && (
            <div className="bg-emerald-50 text-emerald-800 text-xs md:text-sm font-bold p-4 rounded-2xl border border-emerald-200 flex items-center gap-2 animate-bounce">
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>{T.host.listingSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleAddHouseSubmit} className="space-y-5">
            {/* Title / Description */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">{T.host.titleLabel}</label>
                <input
                  type="text"
                  placeholder={T.host.titlePlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  {T.host.descriptionLabel}
                </label>
                <textarea
                  placeholder={T.host.descriptionPlaceholder}
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
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">{T.host.priceLabel}</label>
                <input
                  type="number"
                  placeholder={T.host.pricePlaceholder}
                  value={pricePerVisit}
                  onChange={(e) => setPricePerVisit(Math.max(1000, Number(e.target.value)))}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  min="1000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  {T.host.maxGuestsLabel}
                </label>
                <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50/50 p-2 text-xs justify-between">
                  <span className="text-neutral-500 pl-2 text-xs">{T.host.accompaniedTourLabel}</span>
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
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  {T.host.locationLabel}
                </label>
                <input
                  type="text"
                  placeholder={T.host.locationPlaceholder}
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
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">{T.host.roomsLabel}</label>
                <input
                  type="number"
                  placeholder={T.host.roomsPlaceholder}
                  value={rooms}
                  onChange={(e) => setRooms(Math.max(1, Number(e.target.value)))}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">{T.host.bathroomsLabel}</label>
                <input
                  type="number"
                  placeholder={T.host.bathroomsPlaceholder}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Math.max(1, Number(e.target.value)))}
                  className="w-full text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-3 rounded-xl bg-neutral-50/50 focus:bg-white transition-all text-neutral-800"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">{T.host.areaLabel}</label>
                <input
                  type="number"
                  placeholder={T.host.areaPlaceholder}
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
                <span>{T.host.photosLabel}</span>
                <span className={`text-[11px] ${uploadedImages.length === 8 ? "text-amber-600" : "text-neutral-400"}`}>
                  {uploadedImages.length}{T.host.photosUploadedSuffix}
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
                    ? "border-blue-600 bg-blue-50/50 scale-[0.99] text-blue-700"
                    : "border-neutral-250 bg-neutral-50/50 hover:bg-neutral-50 hover:border-blue-400 text-neutral-500"
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

                <Upload className={`w-8 h-8 ${isDragging ? "text-blue-600 animate-bounce" : "text-neutral-400"}`} />
                <div>
                  <p className="text-xs font-bold text-neutral-800">
                    {T.host.dropzoneTitle}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-1 leading-normal">
                    {T.host.dropzoneSubtitle}
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
                        alt={`${T.host.registeredPhotoAltPrefix}${index + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />

                      {/* Delete button badge */}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 bg-black/75 hover:bg-red-600 text-white p-1 rounded-full shadow-md transition-colors cursor-pointer"
                        title={T.host.deletePhotoTitle}
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* Main representative image badge on first index */}
                      {index === 0 && (
                        <div className="absolute bottom-1 left-1 right-1 bg-blue-600 text-white py-0.5 text-[8px] font-black text-center rounded-md pointer-events-none select-none tracking-tight">
                          {T.host.mainPhotoBadge}
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
                  <span>{T.host.visitDatesLabel}</span>
                </label>
                <p className="text-[11px] text-neutral-450 leading-normal">
                  {T.host.visitDatesHelp}
                </p>

                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateInput}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="flex-1 text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-2 rounded-xl bg-neutral-50/50 text-neutral-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddDate}
                    className="bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-black px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                  >
                    {T.host.addDateButton}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[85px] p-2 bg-neutral-50 rounded-xl border border-neutral-150">
                  {availableDates.length === 0 ? (
                    <span className="text-[10px] text-neutral-400 font-semibold p-1">
                      {T.host.noDatesSet}
                    </span>
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
                  <span>{T.host.timeSlotsLabel}</span>
                </label>
                <p className="text-[11px] text-neutral-450 leading-normal">
                  {T.host.timeSlotsHelp}
                </p>

                {/* Preset Time Slots Toggler */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[T.host.timeSlotMorning, T.host.timeSlotAfternoon1, T.host.timeSlotAfternoon2, T.host.timeSlotEvening].map(
                    (slot) => {
                      const isChecked = availableTimeSlots.includes(slot);
                      return (
                        <button
                          type="button"
                          key={slot}
                          onClick={() => handleToggleTimeSlot(slot)}
                          className={`text-[11px] font-bold py-1.5 rounded-lg border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-blue-600 border-blue-600 text-white font-extrabold"
                              : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    },
                  )}
                </div>

                {/* Custom Time Slot Creator */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={T.host.customTimeSlotPlaceholder}
                    value={customTimeInput}
                    onChange={(e) => setCustomTimeInput(e.target.value)}
                    className="flex-1 text-xs font-bold border border-neutral-200 focus:border-blue-400 focus:outline-hidden p-2 rounded-xl bg-neutral-50/50 text-neutral-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTimeSlot}
                    className="bg-neutral-900 hover:bg-neutral-850 text-white text-xs font-black px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                  >
                    {T.host.addTimeSlotButton}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[85px] p-2 bg-neutral-50 rounded-xl border border-neutral-150">
                  {availableTimeSlots.length === 0 ? (
                    <span className="text-[10px] text-neutral-400 font-semibold p-1">
                      {T.host.noTimeSlotsActive}
                    </span>
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
              {T.host.submitListingButton}
            </button>
          </form>
        </div>

        {/* Visitor Requests / Bookings Received (2/5 width) */}
        <div className="xl:col-span-2 space-y-5">
          {/* List of current listings */}
          <div className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-4">
            <h4 className="font-bold text-neutral-900 text-sm md:text-base flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-blue-600" />
              <span>{T.host.myListingsPrefix}{hostHouses.length}{T.host.myListingsSuffix}</span>
            </h4>

            {hostHouses.length === 0 ? (
              <p className="text-neutral-400 text-xs text-center py-6 font-semibold">
                {T.host.noListingsYet}
              </p>
            ) : (
              <div className="divide-y divide-neutral-105 max-h-[190px] overflow-y-auto pr-1">
                {hostHouses.map((hCode) => (
                  <div key={hCode.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={hCode.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover bg-neutral-100 shrink-0 border border-neutral-200"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-neutral-800 truncate" title={hCode.title}>
                          {hCode.title}
                        </h5>
                        <p className="text-[10px] text-neutral-500 font-semibold">
                          {T.host.specRoomsPrefix}{hCode.rooms ?? 3}{T.host.specRoomsMid}{hCode.bathrooms ?? 2}{T.host.specBathroomsMid}{hCode.area ?? 24}{T.host.specAreaSuffix}
                        </p>
                        <p className="text-[10px] text-blue-600 font-bold">
                          ₩{hCode.pricePerVisit.toLocaleString()}{T.host.perGuideSuffix}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectHouse(hCode)}
                      className="shrink-0 text-[10px] font-bold px-2 py-1 border border-neutral-200 hover:border-blue-400 hover:text-blue-600 rounded-lg text-neutral-600 bg-white flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3 text-blue-500" />
                      {T.host.inspectButton}
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
                <span>{T.host.applicantsListTitle}</span>
              </div>
              {pendingCount > 0 && (
                <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {T.host.negotiatingPrefix}{pendingCount}
                </span>
              )}
            </h4>

            {receivedBookings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                <Calendar className="w-10 h-10 text-neutral-300 mb-2" />
                <p className="text-neutral-500 text-xs font-bold">{T.host.noBookingsYet}</p>
                <p className="text-[10px] text-neutral-400 mt-1 max-w-[200px] leading-relaxed font-semibold">
                  {T.host.switchAccountHint}
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
                          <span className="text-[10px] text-neutral-400 ml-1">{T.host.buyerAspirant}</span>
                        </div>
                      </div>

                      {/* Status pill */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          bk.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-700"
                            : bk.status === "cancelled"
                              ? "bg-neutral-200 text-neutral-600"
                              : bk.status === "completed"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {bk.status === "confirmed"
                          ? T.host.statusConfirmed
                          : bk.status === "cancelled"
                            ? T.host.statusCancelled
                            : bk.status === "completed"
                              ? T.host.statusCompleted
                              : T.host.statusPending}
                      </span>
                    </div>

                    {/* Booking stays summary */}
                    <div className="text-xs text-neutral-600 border-t border-neutral-150 pt-2 space-y-1 font-semibold">
                      <p className="font-bold text-neutral-800 truncate mb-1">{T.host.tourHousePrefix}{bk.houseTitle}</p>
                      <p className="text-[11px]">
                        <span className="text-neutral-400 shrink-0">{T.host.matchScheduleLabel}</span> {bk.visitDate} ({bk.visitTimeSlot})
                      </p>
                      <p className="text-[11px]">
                        <span className="text-neutral-400 shrink-0">{T.host.accompanyCountLabel}</span> {bk.totalVisitors}{T.host.peopleSuffix}
                      </p>
                      <p className="text-[11px] font-bold text-blue-700">
                        <span className="text-neutral-400 font-semibold text-neutral-600">{T.host.settlementAmountLabel}</span> ₩
                        {bk.totalPrice.toLocaleString()}
                      </p>
                    </div>

                    {/* Pending Action Buttons */}
                    {bk.status === "pending" && (
                      <div className="grid grid-cols-2 gap-2 border-t border-neutral-150 pt-2 text-xs font-sans">
                        <button
                          onClick={() => onUpdateBookingStatus(bk.id, "cancelled")}
                          className="py-1 px-2 border border-neutral-300 rounded-lg hover:border-neutral-400 font-bold text-neutral-500 hover:text-neutral-850 bg-white cursor-pointer transition-all"
                        >
                          {T.host.rejectButton}
                        </button>
                        <button
                          onClick={() => onUpdateBookingStatus(bk.id, "confirmed")}
                          className="py-1 px-2 bg-blue-600 hover:bg-blue-700 font-bold text-white rounded-lg cursor-pointer transition-all"
                        >
                          {T.host.acceptButton}
                        </button>
                      </div>
                    )}

                    {/* Confirmed → Complete tour guide */}
                    {bk.status === "confirmed" && (
                      <div className="border-t border-neutral-150 pt-2">
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                T.host.completeGuideConfirm,
                              )
                            ) {
                              onUpdateBookingStatus(bk.id, "completed");
                            }
                          }}
                          className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 font-bold text-white rounded-lg cursor-pointer transition-all text-xs"
                        >
                          {T.host.completeGuideButton}
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
