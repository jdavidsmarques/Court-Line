import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { RankedPlayer, TourFilter, TourType } from '../types/tennis';
import { CountryFlag } from './CountryFlag';

interface SidebarProps {
  tourFilter: TourFilter;
  rankingTour: TourType;
  onSelectRankingTour: (tour: TourType) => void;
  rankings: RankedPlayer[];
  rankingsLoading: boolean;
  selectedPlayerKey: string | null;
  onSelectPlayerKey: (playerKey: string | null) => void;
  activePlayerKeysToday: Set<string>;
}

export function Sidebar({
  tourFilter,
  rankingTour,
  onSelectRankingTour,
  rankings,
  rankingsLoading,
  selectedPlayerKey,
  onSelectPlayerKey,
  activePlayerKeysToday,
}: SidebarProps) {
  const [rankSearch, setRankSearch] = useState('');

  const filteredRankings = useMemo(() => {
    const q = rankSearch.trim().toLowerCase();
    if (!q) return rankings;
    return rankings.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.countryName.toLowerCase().includes(q) ||
        String(p.rank) === q
    );
  }, [rankings, rankSearch]);

  return (
    <aside className="w-[280px] shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 select-none">
      {/* Brand Lockup */}
      <div className="px-5 h-16 border-b border-slate-200 flex items-center justify-between shrink-0">
        <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
          CourtLine
        </span>
        <span className="text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap">
          ATP · WTA
        </span>
      </div>

      {/* Top 100 Rankings Directory */}
      <div className="flex flex-col min-h-0 flex-1">
        <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-xs font-semibold text-slate-800 truncate">
              Top 100 Rankings
            </h2>

            <div className="flex items-center gap-2 shrink-0">
              {selectedPlayerKey && (
                <button
                  type="button"
                  onClick={() => onSelectPlayerKey(null)}
                  className="text-[11px] font-medium text-emerald-800 hover:text-emerald-950 flex items-center gap-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}

              {tourFilter === 'all' ? (
                <div className="flex items-center bg-slate-100 rounded p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => onSelectRankingTour('atp')}
                    className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                      rankingTour === 'atp'
                        ? 'bg-white text-emerald-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    ATP
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectRankingTour('wta')}
                    className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                      rankingTour === 'wta'
                        ? 'bg-white text-emerald-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    WTA
                  </button>
                </div>
              ) : (
                <span className="text-[11px] font-mono text-slate-500">
                  {rankingTour.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={rankSearch}
              onChange={(e) => setRankSearch(e.target.value)}
              placeholder="Filter player or rank..."
              aria-label="Search Top 100 rankings"
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 focus:bg-white transition-colors"
            />
            {rankSearch && (
              <button
                type="button"
                onClick={() => setRankSearch('')}
                aria-label="Clear ranking search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {rankingsLoading ? (
            <div className="p-4 space-y-2.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-7 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredRankings.length === 0 ? (
            <div className="p-4 text-xs text-slate-500 text-center">
              No players found in Top 100.
            </div>
          ) : (
            filteredRankings.map((player) => {
              const key = `${rankingTour}-${player.id}`;
              const isSelected = selectedPlayerKey === key;
              const playsToday = activePlayerKeysToday.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectPlayerKey(isSelected ? null : key)}
                  className={`w-full px-4 py-2 flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/90 text-emerald-950'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <span className="w-7 text-right text-xs font-mono font-semibold tabular-nums text-slate-500 shrink-0">
                    {player.rank}
                  </span>
                  <CountryFlag src={player.flagUrl} alt={player.countryName} className="w-4 h-3" />
                  <span className={`text-xs truncate flex-1 ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                    {player.displayName}
                  </span>
                  {playsToday && (
                    <span className="text-[11px] font-medium text-emerald-800 shrink-0" title="Playing on selected day">
                      Playing
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
