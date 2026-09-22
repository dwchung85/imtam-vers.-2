import { useMemo, useState } from 'react';
import { House } from '../types';
import { T } from '../strings';
import { ShieldCheck, Check, X, FileText, RotateCcw, Image as ImageIcon } from 'lucide-react';

interface AdminDashboardProps {
  houses: House[];
  onReviewHouse: (
    houseId: string,
    status: 'approved' | 'rejected' | 'pending',
    rejectReason?: string,
  ) => Promise<void> | void;
}

type StatusFilter = 'pending' | 'approved' | 'rejected';

function StatusPill({ status }: { status: StatusFilter }) {
  const map: Record<StatusFilter, { label: string; cls: string }> = {
    pending: { label: T.host.approvalPending, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { label: T.host.approvalApproved, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: T.host.approvalRejected, cls: 'bg-rose-50 text-rose-600 border-rose-200' },
  };
  const s = map[status];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
  );
}

function DocBlock({ label, src }: { label: string; src?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-neutral-600 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5 text-neutral-400" />
        {label}
      </p>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer" className="block group">
          <img
            src={src}
            alt={label}
            className="w-full h-36 object-cover rounded-xl border border-neutral-200 bg-neutral-50"
          />
          <span className="mt-1 inline-block text-[10px] font-bold text-blue-600 group-hover:underline">
            {T.admin.openImage}
          </span>
        </a>
      ) : (
        <div className="w-full h-36 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 flex items-center justify-center text-[11px] font-bold text-neutral-400">
          {T.admin.docMissing}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard({ houses, onReviewHouse }: AdminDashboardProps) {
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { pending: 0, approved: 0, rejected: 0 };
    houses.forEach((h) => {
      const s = (h.approvalStatus ?? 'pending') as StatusFilter;
      if (c[s] !== undefined) c[s] += 1;
    });
    return c;
  }, [houses]);

  const list = houses.filter((h) => (h.approvalStatus ?? 'pending') === filter);

  const handle = async (
    houseId: string,
    status: 'approved' | 'rejected' | 'pending',
  ) => {
    if (status === 'rejected' && !(reasons[houseId] ?? '').trim()) {
      alert(T.admin.rejectReasonRequired);
      return;
    }
    setBusyId(houseId);
    try {
      await onReviewHouse(houseId, status, (reasons[houseId] ?? '').trim());
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'pending', label: T.admin.filterPending },
    { key: 'approved', label: T.admin.filterApproved },
    { key: 'rejected', label: T.admin.filterRejected },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-neutral-200 p-5 md:p-6 space-y-4">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-black text-neutral-900 text-base md:text-lg">{T.admin.title}</h3>
            <p className="text-xs text-neutral-500 font-semibold mt-0.5">{T.admin.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t border-neutral-100">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`text-[11px] md:text-xs font-bold px-3.5 py-2 rounded-full border transition-colors cursor-pointer ${
                filter === t.key
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:border-blue-300'
              }`}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 bg-white border border-neutral-200 rounded-3xl">
          <p className="text-xs font-bold text-neutral-400">{T.admin.emptyList}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {list.map((h) => {
            const photos = h.imageUrls && h.imageUrls.length > 0 ? h.imageUrls : h.imageUrl ? [h.imageUrl] : [];
            const status = (h.approvalStatus ?? 'pending') as StatusFilter;
            return (
              <div key={h.id} className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-neutral-900 text-sm md:text-base truncate">{h.title}</h4>
                      <StatusPill status={status} />
                    </div>
                    <p className="text-[11px] text-neutral-500 font-semibold mt-1">
                      {T.admin.hostLabel}: {h.hostName} · {T.admin.priceLabel}: ₩
                      {h.pricePerVisit.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-neutral-500 font-semibold">
                      {T.admin.addressLabel}: {h.location}
                      {h.locationDetail ? ` ${h.locationDetail}` : ''}
                    </p>
                    <p className="text-[11px] text-neutral-500 font-semibold">
                      {T.admin.specLabel}: 방 {h.rooms ?? 3}개 · 욕실 {h.bathrooms ?? 2}개 · {h.area ?? 24}평
                    </p>
                  </div>
                </div>

                <p className="text-xs text-neutral-600 leading-relaxed whitespace-pre-line bg-neutral-50 rounded-2xl p-3.5">
                  {h.description}
                </p>

                {/* Photos */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-neutral-600 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
                    {T.admin.photosLabel} ({photos.length})
                  </p>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {photos.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noreferrer">
                        <img
                          src={src}
                          alt=""
                          className="w-full h-24 object-cover rounded-xl border border-neutral-200 bg-neutral-50"
                        />
                      </a>
                    ))}
                  </div>
                </div>

                {/* Documents */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-black text-neutral-700">{T.admin.docsLabel}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DocBlock label={T.admin.docRegistration} src={h.residencyDocRegistration || undefined} />
                    <DocBlock label={T.admin.docUtility} src={h.residencyDocUtility || undefined} />
                  </div>
                </div>

                {status === 'rejected' && h.rejectReason ? (
                  <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                    {T.admin.rejectReasonLabel}: {h.rejectReason}
                  </p>
                ) : null}

                {/* Actions */}
                <div className="pt-3 border-t border-neutral-100 space-y-2.5">
                  {status !== 'approved' && (
                    <textarea
                      value={reasons[h.id] ?? ''}
                      onChange={(e) => setReasons((p) => ({ ...p, [h.id]: e.target.value }))}
                      placeholder={T.admin.rejectReasonPlaceholder}
                      rows={2}
                      className="w-full text-xs p-3 rounded-xl border border-neutral-200 focus:border-blue-400 focus:outline-hidden bg-neutral-50 focus:bg-white font-semibold"
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {status !== 'approved' && (
                      <button
                        disabled={busyId === h.id}
                        onClick={() => handle(h.id, 'approved')}
                        className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {T.admin.approveButton}
                      </button>
                    )}
                    {status !== 'rejected' && (
                      <button
                        disabled={busyId === h.id}
                        onClick={() => handle(h.id, 'rejected')}
                        className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        {T.admin.rejectButton}
                      </button>
                    )}
                    {status !== 'pending' && (
                      <button
                        disabled={busyId === h.id}
                        onClick={() => handle(h.id, 'pending')}
                        className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {T.admin.revertButton}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
