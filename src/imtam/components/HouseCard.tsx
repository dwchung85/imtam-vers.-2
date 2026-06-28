import { House } from '../types';
import { Star, MapPin, Users, CalendarCheck } from 'lucide-react';

interface HouseCardProps {
  key?: string;
  house: House;
  onClick: () => void;
  isOwnListing?: boolean;
}

export default function HouseCard({ house, onClick, isOwnListing = false }: HouseCardProps) {
  // Format price helper
  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR');
  };

  return (
    <div
      id={`house-card-${house.id}`}
      onClick={onClick}
      className="group cursor-pointer bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 flex flex-col h-full"
    >
      {/* House Image Container */}
      <div className="relative aspect-4/3 w-full bg-neutral-100 overflow-hidden">
        <img
          src={house.imageUrl}
          alt={house.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {isOwnListing ? (
          <span className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-sm uppercase tracking-wider">
            내 등록 매물 (Owner)
          </span>
        ) : (
          <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-sm uppercase tracking-wider">
            오픈하우스 진행중
          </span>
        )}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs text-xs font-semibold px-2 py-1 rounded-lg text-neutral-800 flex items-center gap-1 shadow-xs">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          <span>{house.rating.toFixed(1)}</span>
          <span className="text-neutral-400 font-normal">({house.reviewsCount})</span>
        </div>
      </div>

      {/* House Details Content */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          {/* Location & Tags */}
          <div className="flex items-center gap-1 text-xs text-neutral-500 mb-1.5 font-medium">
            <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
            <span className="truncate">{house.location}</span>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors text-sm md:text-base leading-snug line-clamp-2 mb-2">
            {house.title}
          </h3>
          
          {/* Brief info */}
          <p className="text-xs text-neutral-500 line-clamp-2 mb-3 font-normal leading-relaxed">
            {house.description}
          </p>

          {/* Specs badges: Rooms, Bathrooms, Area */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="bg-neutral-100 text-neutral-700 text-[11px] font-bold px-2.5 py-0.5 rounded-md">
              방 {house.rooms ?? 3}개
            </span>
            <span className="bg-neutral-100 text-neutral-700 text-[11px] font-bold px-2.5 py-0.5 rounded-md">
              욕실 {house.bathrooms ?? 2}개
            </span>
            <span className="bg-blue-50 text-blue-700 text-[11px] font-extrabold px-2.5 py-0.5 rounded-md">
              {house.area ?? 24}평
            </span>
          </div>
        </div>

        <div>
          {/* Divider */}
          <div className="border-t border-neutral-100 my-2 pt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-semibold">
              <CalendarCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>동반 임장 최대 {house.maxGuests}명</span>
            </div>
            
            <div className="text-right">
              <span className="text-base md:text-lg font-black text-blue-600">
                ₩{formatPrice(house.pricePerVisit)}
              </span>
              <span className="text-[10px] text-neutral-400 ml-0.5 block font-bold">임장 예약 투어</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
