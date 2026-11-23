import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { T } from "../strings";

interface TourCostHelpProps {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}

// "투어 비용" 문구 오른쪽 위에 붙는 작은 물음표. 누르면 짧은 설명 팝업이 뜬다.
export default function TourCostHelp({ align = "end", side = "top" }: TourCostHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={T.tourCostHelp.ariaLabel}
          onClick={(e) => e.stopPropagation()}
          className="ml-0.5 -translate-y-[3px] inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-[9px] font-black leading-none text-neutral-400 hover:border-[#008000] hover:text-[#008000] cursor-pointer"
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="z-[70] w-[260px] max-w-[calc(100vw-32px)] rounded-[10px] border-neutral-200 bg-white p-3 shadow-md"
      >
        <p className="text-xs font-black text-neutral-900 mb-1.5">{T.tourCostHelp.title}</p>
        <p className="text-[11px] leading-relaxed text-neutral-600 whitespace-pre-line">{T.tourCostHelp.body}</p>
      </PopoverContent>
    </Popover>
  );
}
