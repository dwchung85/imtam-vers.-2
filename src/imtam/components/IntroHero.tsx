import { useEffect, useState } from "react";
import { CalendarCheck, ChevronDown, ChevronUp, MapPin, Search } from "lucide-react";
import { T } from "../strings";

// 한 번 본 사람은 접어서 보여준다
const SEEN_KEY = "imtam_intro_seen";

type Props = {
  onBrowse: () => void;
  onRegister: () => void;
};

export default function IntroHero({ onBrowse, onRegister }: Props) {
  // 브라우저 저장소는 hydration 이후에만 읽을 수 있다
  const [expanded, setExpanded] = useState<boolean | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
      if (!seen) window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      seen = false;
    }
    setExpanded(!seen);
  }, []);

  if (expanded === null) return null;

  const steps = [
    { Icon: Search, title: T.intro.step1Title, desc: T.intro.step1Desc },
    { Icon: CalendarCheck, title: T.intro.step2Title, desc: T.intro.step2Desc },
    { Icon: MapPin, title: T.intro.step3Title, desc: T.intro.step3Desc },
  ];

  if (!expanded) {
    return (
      <div className="flex items-center justify-between gap-3 bg-white border border-neutral-200 rounded-[10px] px-4 py-2.5">
        <span className="text-sm font-bold text-neutral-700 truncate">{T.intro.collapsedLabel}</span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] border border-[#008000] bg-white text-[#008000] text-sm font-bold whitespace-nowrap hover:bg-[#008000] hover:text-white"
        >
          <ChevronDown className="w-4 h-4" />
          {T.intro.expandButton}
        </button>
      </div>
    );
  }

  return (
    <section className="bg-white border border-neutral-200 rounded-[10px] p-5 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-black text-neutral-900 leading-snug">{T.intro.headline}</h1>
          <p className="text-sm md:text-base text-neutral-500 leading-relaxed">{T.intro.subline}</p>
        </div>
        <button
          type="button"
          aria-label={T.intro.collapseButton}
          onClick={() => setExpanded(false)}
          className="shrink-0 p-1.5 rounded-[10px] text-neutral-400 hover:text-neutral-700"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>

      <ol className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {steps.map(({ Icon, title, desc }, i) => (
          <li key={title} className="rounded-[10px] border border-neutral-200 p-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 shrink-0 inline-flex items-center justify-center rounded-[10px] bg-[#008000] text-white text-xs font-black">
                {i + 1}
              </span>
              <Icon className="w-4 h-4 shrink-0 text-[#008000]" />
              <span className="font-bold text-neutral-900 text-sm md:text-base">{title}</span>
            </div>
            <p className="mt-2 text-xs md:text-sm text-neutral-500 leading-relaxed">{desc}</p>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={onBrowse}
          className="h-10 px-5 rounded-[10px] border border-[#008000] bg-white text-[#008000] text-sm font-bold whitespace-nowrap hover:bg-[#008000] hover:text-white"
        >
          {T.intro.browseButton}
        </button>
        <button
          type="button"
          onClick={onRegister}
          className="h-10 px-5 rounded-[10px] border border-[#008000] bg-white text-[#008000] text-sm font-bold whitespace-nowrap hover:bg-[#008000] hover:text-white"
        >
          {T.intro.registerButton}
        </button>
        <span className="text-xs text-neutral-400 sm:ml-1">{T.intro.registerHint}</span>
      </div>
    </section>
  );
}
