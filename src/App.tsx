import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import { MatchDetailDrawer } from './components/MatchDetailDrawer';
import { MatchRow } from './components/MatchRow';
import { Sidebar } from './components/Sidebar';
import {
  fetchScoreboardForDate,
  fetchTourRankings,
  formatDisplayDate,
  formatShortDate,
  shiftDateKey,
  toLocalDateKey,
} from './services/espnTennis';
import type {
  RankedPlayer,
  ScoreboardResult,
  TennisMatch,
  TennisTournamentGroup,
  TourFilter,
  TourType,
} from './types/tennis';

type GroupMode = 'tournament' | 'hour';
type RankingScope = 'all' | 'top100';
type DisciplineFilter = 'all' | 'singles' | 'doubles';

export default function App() {
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);

  const [tourFilter, setTourFilter] = useState<TourFilter>('all');
  const [rankingTour, setRankingTour] = useState<TourType>('atp');
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [groupMode, setGroupMode] = useState<GroupMode>('tournament');
  const [rankingScope, setRankingScope] = useState<RankingScope>('all');
  const [disciplineFilter, setDisciplineFilter] = useState<DisciplineFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);

  const [rankingsByTour, setRankingsByTour] = useState<Record<TourType, RankedPlayer[]>>({
    atp: [],
    wta: [],
  });
  const [rankingsLoading, setRankingsLoading] = useState<boolean>(true);

  const [scoreboard, setScoreboard] = useState<ScoreboardResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [inspectedMatch, setInspectedMatch] = useState<TennisMatch | null>(null);

  const loadData = useCallback(
    async (targetTourFilter: TourFilter, targetDate: string, forceRefresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const [atpRank, wtaRank, sbRes] = await Promise.all([
          fetchTourRankings('atp', forceRefresh),
          fetchTourRankings('wta', forceRefresh),
          fetchScoreboardForDate(targetTourFilter, targetDate, forceRefresh),
        ]);
        setRankingsByTour({
          atp: atpRank.list,
          wta: wtaRank.list,
        });
        setScoreboard(sbRes);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error while loading ESPN data.';
        setError(message);
      } finally {
        setLoading(false);
        setRankingsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData(tourFilter, selectedDate);
  }, [tourFilter, selectedDate, loadData]);

  const handleTourFilterChange = (nextFilter: TourFilter) => {
    if (nextFilter === tourFilter) return;
    setSelectedPlayerKey(null);
    setInspectedMatch(null);
    setTourFilter(nextFilter);
    if (nextFilter === 'atp' || nextFilter === 'wta') {
      setRankingTour(nextFilter);
    }
  };

  const handleDateChange = (nextDate: string) => {
    if (!nextDate) return;
    setInspectedMatch(null);
    setSelectedDate(nextDate);
  };

  const activePlayerKeysToday = useMemo(() => {
    const keys = new Set<string>();
    if (!scoreboard) return keys;
    for (const m of scoreboard.allMatches) {
      for (const c of m.competitors) {
        if (c.rankedPlayer && c.rankedPlayer.rank <= 100) {
          keys.add(`${m.tour}-${c.rankedPlayer.id}`);
        }
      }
    }
    return keys;
  }, [scoreboard]);

  const selectedPlayerInfo = useMemo(() => {
    if (!selectedPlayerKey) return null;
    const dashIdx = selectedPlayerKey.indexOf('-');
    if (dashIdx === -1) return null;
    const playerTour = selectedPlayerKey.slice(0, dashIdx) as TourType;
    const playerId = selectedPlayerKey.slice(dashIdx + 1);
    const player = rankingsByTour[playerTour]?.find((p) => p.id === playerId);
    return player ? { tour: playerTour, player } : null;
  }, [rankingsByTour, selectedPlayerKey]);

  const filteredMatches = useMemo(() => {
    if (!scoreboard) return [];
    const q = searchQuery.trim().toLowerCase();

    return scoreboard.allMatches.filter((m) => {
      if (rankingScope === 'top100' && !m.hasTop100Player) return false;
      if (disciplineFilter !== 'all' && m.discipline !== disciplineFilter) return false;

      if (selectedPlayerInfo) {
        if (m.tour !== selectedPlayerInfo.tour) return false;
        const pid = selectedPlayerInfo.player.id;
        const matchesPlayer = m.competitors.some(
          (c) =>
            c.id === pid ||
            c.id.split('-').includes(pid) ||
            c.rankedPlayer?.id === pid
        );
        if (!matchesPlayer) return false;
      }

      if (q) {
        const inTournament =
          m.tournamentName.toLowerCase().includes(q) ||
          m.tournamentLocation.toLowerCase().includes(q);
        const inPlayers = m.competitors.some((c) => c.displayName.toLowerCase().includes(q));
        const inRound = m.roundName.toLowerCase().includes(q);
        const inTour = m.tour.toLowerCase().includes(q);
        if (!inTournament && !inPlayers && !inRound && !inTour) return false;
      }

      return true;
    });
  }, [scoreboard, rankingScope, disciplineFilter, selectedPlayerInfo, searchQuery]);

  const groupedByTournament = useMemo<TennisTournamentGroup[]>(() => {
    if (!scoreboard) return [];
    const map = new Map<string, TennisTournamentGroup>();

    for (const m of filteredMatches) {
      let grp = map.get(m.tournamentId);
      if (!grp) {
        const orig = scoreboard.tournaments.find((t) => t.id === m.tournamentId);
        grp = {
          id: m.tournamentId,
          tour: m.tour,
          name: m.tournamentName,
          shortName: orig?.shortName ?? m.tournamentName,
          location: orig?.location ?? m.tournamentLocation,
          isMajor: m.isMajor,
          startDate: orig?.startDate ?? '',
          endDate: orig?.endDate ?? '',
          matches: [],
        };
        map.set(m.tournamentId, grp);
      }
      grp.matches.push(m);
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
      g.matches.sort((a, b) => a.startTimestamp - b.startTimestamp);
    }
    groups.sort((a, b) => {
      const aTime = a.matches[0]?.startTimestamp ?? 0;
      const bTime = b.matches[0]?.startTimestamp ?? 0;
      return aTime - bTime || a.name.localeCompare(b.name);
    });
    return groups;
  }, [scoreboard, filteredMatches]);

  const groupedByHour = useMemo(() => {
    const slots = new Map<string, TennisMatch[]>();
    for (const m of filteredMatches) {
      const hourSlot = `${m.localTimeLabel.slice(0, 2)}:00`;
      const list = slots.get(hourSlot) ?? [];
      list.push(m);
      slots.set(hourSlot, list);
    }
    return Array.from(slots.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredMatches]);

  const kpis = useMemo(() => {
    const total = filteredMatches.length;
    const tournamentsCount = new Set(filteredMatches.map((m) => m.tournamentId)).size;
    const top100Count = filteredMatches.filter((m) => m.hasTop100Player).length;
    return { total, tournamentsCount, top100Count };
  }, [filteredMatches]);

  const nearestActiveDate = useMemo(() => {
    const dates = scoreboard?.calendarDates ?? [];
    if (dates.length === 0) return null;
    const pastOrSame = dates.filter((d) => d < selectedDate);
    if (pastOrSame.length > 0) return pastOrSame[pastOrSame.length - 1];
    const future = dates.filter((d) => d > selectedDate);
    return future[0] ?? null;
  }, [scoreboard, selectedDate]);

  const headerTitle =
    tourFilter === 'all'
      ? 'All Matches (ATP & WTA)'
      : `${tourFilter.toUpperCase()} Matches`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Left Desktop Sidebar */}
      <Sidebar
        tourFilter={tourFilter}
        rankingTour={rankingTour}
        onSelectRankingTour={setRankingTour}
        rankings={rankingsByTour[rankingTour]}
        rankingsLoading={rankingsLoading}
        selectedPlayerKey={selectedPlayerKey}
        onSelectPlayerKey={setSelectedPlayerKey}
        activePlayerKeysToday={activePlayerKeysToday}
      />

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Workspace Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between gap-8 sticky top-0 z-20">
          <div className="min-w-0 flex items-baseline gap-3">
            <h1 className="font-display text-lg font-semibold tracking-tight text-slate-900 whitespace-nowrap">
              {headerTitle}
            </h1>
            <span className="text-slate-300" aria-hidden="true">
              /
            </span>
            <span className="text-sm text-slate-600 truncate">
              {formatDisplayDate(selectedDate)}
            </span>
          </div>

          {/* Date Controls + Refresh */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => handleDateChange(shiftDateKey(selectedDate, -1))}
                aria-label="Previous day"
                className="px-2.5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-r border-slate-200 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <label className="relative flex items-center px-3 py-1.5 text-xs font-mono font-medium text-slate-800 cursor-pointer hover:bg-slate-50">
                <Calendar className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  aria-label="Select date"
                  className="bg-transparent text-xs font-mono tabular-nums text-slate-900 focus:outline-none cursor-pointer"
                />
              </label>
              <button
                type="button"
                onClick={() => handleDateChange(shiftDateKey(selectedDate, 1))}
                aria-label="Next day"
                className="px-2.5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l border-slate-200 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {selectedDate !== todayKey && (
              <button
                type="button"
                onClick={() => handleDateChange(todayKey)}
                className="px-3 py-2 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Today
              </button>
            )}

            <button
              type="button"
              onClick={() => loadData(tourFilter, selectedDate, true)}
              disabled={loading}
              aria-label="Refresh matches"
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Main Content Container */}
        <main className="flex-1 px-8 py-5 max-w-[1220px] w-full mx-auto space-y-4">
          {/* Filter & Organization Toolbar */}
          <section className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Circuit filter: All | ATP | WTA */}
              <div
                role="group"
                aria-label="Tour filter"
                className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
              >
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'atp', label: 'ATP' },
                    { id: 'wta', label: 'WTA' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTourFilterChange(item.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      tourFilter === item.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Ranking filter: All Matches vs Top 100 */}
              <div
                role="group"
                aria-label="Top 100 filter"
                className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
              >
                <button
                  type="button"
                  onClick={() => setRankingScope('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    rankingScope === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Players
                </button>
                <button
                  type="button"
                  onClick={() => setRankingScope('top100')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    rankingScope === 'top100'
                      ? 'bg-emerald-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top 100
                </button>
              </div>

              {/* Organization toggle: By Tournament & Time vs By Time */}
              <div
                role="group"
                aria-label="List grouping"
                className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
              >
                <button
                  type="button"
                  onClick={() => setGroupMode('tournament')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    groupMode === 'tournament'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  By Tournament &amp; Time
                </button>
                <button
                  type="button"
                  onClick={() => setGroupMode('hour')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    groupMode === 'hour'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  By Time
                </button>
              </div>

              {/* Discipline filter */}
              <div
                role="group"
                aria-label="Draw filter"
                className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
              >
                <button
                  type="button"
                  onClick={() => setDisciplineFilter('all')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    disciplineFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Draws
                </button>
                <button
                  type="button"
                  onClick={() => setDisciplineFilter('singles')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    disciplineFilter === 'singles'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Singles
                </button>
                <button
                  type="button"
                  onClick={() => setDisciplineFilter('doubles')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    disciplineFilter === 'doubles'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Doubles
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search player or tournament..."
                aria-label="Search player or tournament"
                className="w-full pl-8 pr-7 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-800 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </section>

          {/* Compact Inline Summary */}
          <div
            aria-label="Daily summary"
            className="flex items-center gap-3 text-xs text-slate-500 border-b border-slate-200 pb-3"
          >
            <span>
              <strong className="font-mono font-semibold tabular-nums text-slate-900">
                {loading ? '—' : kpis.total}
              </strong>{' '}
              {kpis.total === 1 ? 'match' : 'matches'}
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span>
              <strong className="font-mono font-semibold tabular-nums text-slate-900">
                {loading ? '—' : kpis.tournamentsCount}
              </strong>{' '}
              {kpis.tournamentsCount === 1 ? 'tournament' : 'tournaments'}
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span>
              <strong className="font-mono font-semibold tabular-nums text-emerald-900">
                {loading ? '—' : kpis.top100Count}
              </strong>{' '}
              with Top 100
            </span>
          </div>

          {/* Active Player Filter Indicator */}
          {selectedPlayerInfo && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs text-emerald-950">
              <span>
                Filtering by player ({selectedPlayerInfo.tour.toUpperCase()}):{' '}
                <strong className="font-semibold">
                  #{selectedPlayerInfo.player.rank} {selectedPlayerInfo.player.displayName}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedPlayerKey(null)}
                className="font-medium text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Clear filter
              </button>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-white border border-red-200 rounded-lg p-6 text-center space-y-3">
              <p className="text-sm font-medium text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => loadData(tourFilter, selectedDate, true)}
                className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && !error && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="px-5 py-4 flex items-center gap-6">
                    <div className="w-16 h-8 bg-slate-100 rounded animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
                      <div className="h-4 w-56 bg-slate-100 rounded animate-pulse" />
                    </div>
                    <div className="w-24 h-6 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredMatches.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center max-w-2xl mx-auto">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {selectedPlayerInfo
                  ? `No matches for ${selectedPlayerInfo.player.displayName} on this date`
                  : scoreboard && scoreboard.allMatches.length > 0 && rankingScope === 'top100'
                    ? 'No Top 100 matches for current filters'
                    : `No matches scheduled for ${formatShortDate(selectedDate)}`}
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {selectedPlayerInfo
                  ? 'This player has no matches scheduled for the selected date and filters.'
                  : scoreboard && scoreboard.allMatches.length > 0 && rankingScope === 'top100'
                    ? `There are ${scoreboard.allMatches.length} matches on this day, but none feature players currently ranked in the official Top 100.`
                    : `The official ESPN calendar has no ${tourFilter === 'all' ? 'ATP or WTA' : tourFilter.toUpperCase()} matches scheduled for this date.`}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {selectedPlayerInfo && (
                  <button
                    type="button"
                    onClick={() => setSelectedPlayerKey(null)}
                    className="px-4 py-2 text-xs font-medium bg-emerald-900 text-white rounded-lg hover:bg-emerald-950 transition-colors cursor-pointer"
                  >
                    Clear player filter
                  </button>
                )}

                {scoreboard && scoreboard.allMatches.length > 0 && rankingScope === 'top100' && (
                  <button
                    type="button"
                    onClick={() => setRankingScope('all')}
                    className="px-4 py-2 text-xs font-medium bg-emerald-900 text-white rounded-lg hover:bg-emerald-950 transition-colors cursor-pointer"
                  >
                    Show all matches ({scoreboard.allMatches.length})
                  </button>
                )}

                {nearestActiveDate && (
                  <button
                    type="button"
                    onClick={() => handleDateChange(nearestActiveDate)}
                    className="px-4 py-2 text-xs font-medium bg-emerald-900 text-white rounded-lg hover:bg-emerald-950 transition-colors cursor-pointer"
                  >
                    Jump to tournament day ({formatShortDate(nearestActiveDate)})
                  </button>
                )}

                {tourFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => handleTourFilterChange('all')}
                    className="px-4 py-2 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    View all tours (ATP &amp; WTA)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Schedule View 1: Grouped by Tournament, sorted chronologically by hour */}
          {!loading && !error && filteredMatches.length > 0 && groupMode === 'tournament' && (
            <div className="space-y-5">
              {groupedByTournament.map((tournament) => (
                <section
                  key={tournament.id}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                >
                  {/* Tournament Header */}
                  <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex items-baseline gap-2.5">
                      <span className="text-xs font-mono font-semibold text-emerald-900 shrink-0">
                        {tournament.tour.toUpperCase()}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <h2 className="font-display text-base font-semibold text-slate-900 truncate">
                        {tournament.name}
                      </h2>
                      {tournament.location && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs text-slate-500 truncate">
                            {tournament.location}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                      {tournament.matches.length}{' '}
                      {tournament.matches.length === 1 ? 'match' : 'matches'}
                    </span>
                  </div>

                  {/* Table Column Header */}
                  <div className="px-5 py-2 border-b border-slate-100 grid grid-cols-[88px_minmax(0,1fr)_170px_110px_20px] gap-4 text-[11px] font-medium text-slate-400">
                    <span>Time / Court</span>
                    <div className="flex items-center justify-between pr-2">
                      <span>Rank · Players</span>
                      <span>Sets</span>
                    </div>
                    <span>Round</span>
                    <span className="text-right">Status</span>
                    <span />
                  </div>

                  {/* Match Rows */}
                  <div className="divide-y divide-slate-100">
                    {tournament.matches.map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        showTournamentColumn={false}
                        isSelected={inspectedMatch?.id === match.id}
                        onSelect={setInspectedMatch}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Schedule View 2: Chronological by Hour across all tournaments */}
          {!loading && !error && filteredMatches.length > 0 && groupMode === 'hour' && (
            <div className="space-y-5">
              {groupedByHour.map(([hourLabel, matchesInHour]) => (
                <section
                  key={hourLabel}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                >
                  <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <h2 className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                        {hourLabel}
                      </h2>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {matchesInHour.length}{' '}
                      {matchesInHour.length === 1 ? 'match' : 'matches'}
                    </span>
                  </div>

                  <div className="px-5 py-2 border-b border-slate-100 grid grid-cols-[88px_220px_minmax(0,1fr)_170px_110px_20px] gap-4 text-[11px] font-medium text-slate-400">
                    <span>Time / Court</span>
                    <span>Tournament</span>
                    <div className="flex items-center justify-between pr-2">
                      <span>Rank · Players</span>
                      <span>Sets</span>
                    </div>
                    <span>Round</span>
                    <span className="text-right">Status</span>
                    <span />
                  </div>

                  <div className="divide-y divide-slate-100">
                    {matchesInHour.map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        showTournamentColumn={true}
                        isSelected={inspectedMatch?.id === match.id}
                        onSelect={setInspectedMatch}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>

        {/* Quiet Footer */}
        <footer className="px-8 py-4 border-t border-slate-200 bg-white text-xs text-slate-500 flex items-center justify-between">
          <span>Official match schedules and rankings via ESPN Tennis API</span>
          <span className="font-mono tabular-nums">
            {scoreboard
              ? `Updated at ${new Date(scoreboard.fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </span>
        </footer>
      </div>

      {/* Slide-over Match Detail Drawer */}
      <MatchDetailDrawer
        match={inspectedMatch}
        onClose={() => setInspectedMatch(null)}
      />
    </div>
  );
}
