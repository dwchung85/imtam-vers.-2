import { useState } from "react";
import { Calendar, Search, SlidersHorizontal, X } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { T } from "../strings";

type Filters = {
  searchQuery: string;
  minRooms: number;
  minBathrooms: number;
  minArea: number;
  visitDateFrom: string;
  visitDateTo: string;
};

type Props = { filters: Filters; onChange: (filters: Filters) => void };

export default function BrowseFilters({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const range = filters.visitDateFrom || filters.visitDateTo ? {
    from: filters.visitDateFrom ? new Date(`${filters.visitDateFrom}T00:00:00`) : undefined,
    to: filters.visitDateTo ? new Date(`${filters.visitDateTo}T00:00:00`) : undefined,
  } : undefined;
  const dateLabel = (date: string) => date ? format(new Date(`${date}T00:00:00`), "M/d") : "";
  const active = Boolean(filters.minRooms || filters.minBathrooms || filters.minArea || filters.visitDateFrom || filters.visitDateTo);
  const inputClass = "h-11 w-full rounded-[10px] border border-input bg-filter-surface px-3 text-sm text-foreground focus:outline-none focus:border-filter focus:ring-1 focus:ring-filter";
  const addressInput = (id: string) => (
    <div className="relative min-w-0 flex-1">
      <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-filter" />
      <input id={id} aria-label={T.app.addressLabel} placeholder={T.app.searchPlaceholder} value={filters.searchQuery}
        onChange={(event) => update({ searchQuery: event.target.value })}
        className={`${inputClass} pl-10 text-xs sm:text-sm`} />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-3 rounded-[10px] border border-border bg-filter-surface p-4 md:p-6">
        {addressInput("browse-address")}
        <SheetTrigger asChild>
          <Button variant="filter" size="icon" aria-label={T.app.filtersOpen} title={T.app.filtersOpen}
            className={`size-11 shrink-0 rounded-full border-transparent ${active ? "bg-filter-muted" : ""}`}>
            <SlidersHorizontal />
          </Button>
        </SheetTrigger>
      </div>
      <SheetContent side="right" aria-describedby={undefined}
        className="flex h-dvh w-full max-w-[420px] flex-col gap-0 p-0 sm:max-w-[420px] [&>button]:hidden motion-reduce:animate-none motion-reduce:transition-none">
        <SheetHeader className="shrink-0 flex-row items-center justify-between space-y-0 border-b border-border px-5 py-4 text-left">
          <SheetTitle>{T.app.filtersTitle}</SheetTitle>
          <SheetClose asChild>
            <Button variant="filter" size="icon" className="size-10 rounded-full" aria-label={T.app.filtersClose}><X /></Button>
          </SheetClose>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6">
          {([
            { key: "minRooms", label: T.app.roomsLabel, values: [1, 2, 3, 4], labels: [T.app.rooms1Plus, T.app.rooms2Plus, T.app.rooms3Plus, T.app.rooms4Plus] },
            { key: "minBathrooms", label: T.app.bathroomsLabel, values: [1, 2, 3], labels: [T.app.bathrooms1Plus, T.app.bathrooms2Plus, T.app.bathrooms3Plus] },
            { key: "minArea", label: T.app.areaLabel, values: [10, 20, 30, 40], labels: [T.app.area10Plus, T.app.area20Plus, T.app.area30Plus, T.app.area40Plus] },
          ] as const).map(({ key, label, values, labels }) => (
            <div key={key} className="space-y-2">
              <label htmlFor={`filter-${key}`} className="text-sm font-bold">{label}</label>
              <select id={`filter-${key}`} value={filters[key]} onChange={(event) => update({ [key]: Number(event.target.value) })} className={inputClass}>
                <option value={0}>{label}</option>
                {values.map((value, index) => <option key={value} value={value}>{labels[index]}</option>)}
              </select>
            </div>
          ))}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{T.app.visitDateLabel}</span>
              {range && <Button variant="ghost" size="icon" className="size-8 text-filter" aria-label={T.app.visitDateResetAriaLabel}
                onClick={() => update({ visitDateFrom: "", visitDateTo: "" })}><X /></Button>}
            </div>
            <Button variant="filter" className="h-11 w-full justify-start rounded-[10px]" aria-label={T.app.visitDateLabel}
              aria-expanded={calendarOpen} onClick={() => setCalendarOpen(!calendarOpen)}>
              <Calendar />
              {range ? <span className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center text-center"><span>{dateLabel(filters.visitDateFrom)}</span><span>~</span><span>{dateLabel(filters.visitDateTo)}</span></span> : T.app.visitDateLabel}
            </Button>
            {calendarOpen && <CalendarPicker mode="range" selected={range} locale={ko} defaultMonth={range?.from}
              className="mx-auto max-w-full" onSelect={(value) => update({
                visitDateFrom: value?.from ? format(value.from, "yyyy-MM-dd") : "",
                visitDateTo: value?.to ? format(value.to, "yyyy-MM-dd") : "",
              })} />}
          </div>
        </div>
        <div className="flex shrink-0 gap-3 border-t border-border p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <Button variant="filter" className="h-11 rounded-[10px]" onClick={() => onChange({ searchQuery: "", minRooms: 0, minBathrooms: 0, minArea: 0, visitDateFrom: "", visitDateTo: "" })}>{T.app.filtersReset}</Button>
          <SheetClose asChild><Button variant="filter" className="h-11 flex-1 rounded-[10px]">{T.app.filtersApply}</Button></SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}