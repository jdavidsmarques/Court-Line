import type {
  DisciplineType,
  MatchCompetitor,
  MatchStatusState,
  RankedPlayer,
  ScoreboardResult,
  SetScore,
  TennisMatch,
  TennisTournamentGroup,
  TourFilter,
  TourType,
} from '../types/tennis';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/tennis';

const rankingsCache: Partial<Record<TourType, { data: RankedPlayer[]; map: Map<string, RankedPlayer>; fetchedAt: number }>> = {};
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function toEspnDateParam(dateKey: string): string {
  return dateKey.replace(/-/g, '');
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return toLocalDateKey(dt);
}

export function formatDisplayDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export async function fetchTourRankings(tour: TourType, forceRefresh = false): Promise<{
  list: RankedPlayer[];
  byId: Map<string, RankedPlayer>;
}> {
  const cached = rankingsCache[tour];
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { list: cached.data, byId: cached.map };
  }

  const res = await fetch(`${ESPN_BASE}/${tour}/rankings`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${tour.toUpperCase()} rankings (${res.status})`);
  }

  const json = await res.json();
  const rawRanks = json?.rankings?.[0]?.ranks ?? [];

  const list: RankedPlayer[] = [];
  const byId = new Map<string, RankedPlayer>();

  for (const item of rawRanks) {
    const rankNum = Number(item?.current);
    const athlete = item?.athlete;
    if (!athlete?.id || !Number.isFinite(rankNum)) continue;

    const id = String(athlete.id);
    const playercard = Array.isArray(athlete.links)
      ? athlete.links.find((l: { rel?: string[]; href?: string }) => l.rel?.includes('playercard'))?.href
      : undefined;

    const player: RankedPlayer = {
      id,
      rank: rankNum,
      previousRank: Number(item?.previous ?? rankNum),
      points: Number(item?.points ?? 0),
      trend: String(item?.trend ?? '-'),
      displayName: String(athlete.displayName ?? athlete.fullName ?? 'Player'),
      shortName: String(athlete.shortname ?? athlete.shortName ?? athlete.displayName ?? ''),
      countryName: String(athlete.flagAltText ?? athlete.citizenship ?? ''),
      flagUrl: typeof athlete.flag === 'string' ? athlete.flag : athlete.flag?.href,
      headshotUrl: typeof athlete.headshot === 'string' ? athlete.headshot : undefined,
      age: typeof athlete.age === 'number' ? athlete.age : undefined,
      citizenship: typeof athlete.citizenship === 'string' ? athlete.citizenship : undefined,
      playerCardUrl: playercard,
    };

    if (rankNum <= 100) {
      list.push(player);
    }
    byId.set(id, player);
  }

  list.sort((a, b) => a.rank - b.rank);
  rankingsCache[tour] = { data: list, map: byId, fetchedAt: Date.now() };
  return { list, byId };
}

function normalizeStatusState(state?: string): MatchStatusState {
  if (state === 'in') return 'in';
  if (state === 'post') return 'post';
  return 'pre';
}

function translateStatus(state: MatchStatusState, rawDetail?: string): string {
  if (state === 'in') return rawDetail && rawDetail !== 'In Progress' ? rawDetail : 'Live';
  if (state === 'post') {
    if (rawDetail && /walkover/i.test(rawDetail)) return 'Walkover';
    if (rawDetail && /ret/i.test(rawDetail)) return 'Retired';
    return 'Final';
  }
  return 'Scheduled';
}

function inferDiscipline(slug?: string, displayName?: string, competitors?: unknown[]): DisciplineType {
  const s = `${slug ?? ''} ${displayName ?? ''}`.toLowerCase();
  if (s.includes('doubles')) return 'doubles';
  if (Array.isArray(competitors) && competitors.some((c: unknown) => (c as { type?: string })?.type === 'team')) {
    return 'doubles';
  }
  return 'singles';
}

function parseCompetitor(
  raw: Record<string, unknown>,
  rankMap: Map<string, RankedPlayer>,
  isDoubles: boolean
): MatchCompetitor {
  const id = String(raw.id ?? '');
  const athlete = raw.athlete as Record<string, unknown> | undefined;
  const roster = raw.roster as Record<string, unknown> | undefined;

  const displayName = String(
    athlete?.displayName ??
      roster?.displayName ??
      athlete?.fullName ??
      'TBD'
  );
  const shortName = String(
    athlete?.shortName ??
      roster?.shortDisplayName ??
      displayName
  );

  const isTbd = id.startsWith('-') || displayName.toUpperCase() === 'TBD';

  // Match official rank via athlete ID (or split doubles IDs like "2725-2434")
  const candidateIds = id.includes('-') && !id.startsWith('-') ? id.split('-') : [id];
  let bestRankedPlayer: RankedPlayer | undefined;
  for (const cid of candidateIds) {
    const found = rankMap.get(cid);
    if (found) {
      if (!bestRankedPlayer || found.rank < bestRankedPlayer.rank) {
        bestRankedPlayer = found;
      }
    }
  }

  const rawFlag = athlete?.flag as { href?: string; alt?: string } | string | undefined;
  const rosterAthletes = Array.isArray(roster?.athletes) ? (roster?.athletes as Array<Record<string, unknown>>) : [];
  const firstRosterFlag = rosterAthletes[0]?.flag as { href?: string; alt?: string } | undefined;

  const flagUrl =
    bestRankedPlayer?.flagUrl ??
    (typeof rawFlag === 'string' ? rawFlag : rawFlag?.href) ??
    firstRosterFlag?.href;

  const countryAlt =
    bestRankedPlayer?.countryName ??
    (typeof rawFlag === 'object' ? rawFlag?.alt : undefined) ??
    firstRosterFlag?.alt;

  const links = (athlete?.links as Array<{ rel?: string[]; href?: string }> | undefined) ?? [];
  const playerCardUrl =
    bestRankedPlayer?.playerCardUrl ??
    links.find((l) => l.rel?.includes('playercard'))?.href;

  const rawSets = Array.isArray(raw.linescores) ? (raw.linescores as Array<Record<string, unknown>>) : [];
  const sets: SetScore[] = rawSets.map((s) => ({
    games: Number(s.value ?? 0),
    tiebreak: s.tiebreak !== undefined ? Number(s.tiebreak) : undefined,
    winner: typeof s.winner === 'boolean' ? s.winner : undefined,
  }));

  const curatedRank = raw.curatedRank as { current?: number } | undefined;
  const seed = typeof curatedRank?.current === 'number' && curatedRank.current > 0 ? curatedRank.current : undefined;

  return {
    id,
    order: Number(raw.order ?? 1),
    displayName,
    shortName,
    isWinner: Boolean(raw.winner),
    isDoubles,
    seed,
    officialRank: bestRankedPlayer?.rank,
    rankedPlayer: bestRankedPlayer,
    flagUrl,
    countryAlt,
    headshotUrl: bestRankedPlayer?.headshotUrl,
    playerCardUrl,
    sets,
    isTbd,
  };
}

async function fetchSingleTourScoreboard(
  tour: TourType,
  dateKey: string,
  forceRefresh = false
): Promise<{
  tournaments: TennisTournamentGroup[];
  allMatches: TennisMatch[];
  calendarDates: string[];
}> {
  const [{ byId: rankMap }, sbRes] = await Promise.all([
    fetchTourRankings(tour, forceRefresh),
    fetch(`${ESPN_BASE}/${tour}/scoreboard?dates=${toEspnDateParam(dateKey)}`),
  ]);

  if (!sbRes.ok) {
    throw new Error(`Failed to fetch ESPN ${tour.toUpperCase()} scoreboard (${sbRes.status})`);
  }

  const sbJson = await sbRes.json();

  const rawCalendar: string[] = sbJson?.leagues?.[0]?.calendar ?? [];
  const calendarDateSet = new Set<string>();
  for (const iso of rawCalendar) {
    const dt = new Date(iso);
    if (!Number.isNaN(dt.getTime())) {
      calendarDateSet.add(toLocalDateKey(dt));
    }
  }
  const calendarDates = Array.from(calendarDateSet).sort();

  const events = Array.isArray(sbJson?.events) ? sbJson.events : [];
  const tournaments: TennisTournamentGroup[] = [];
  const allMatches: TennisMatch[] = [];

  for (const ev of events) {
    const rawTournamentId = String(ev.id ?? ev.name ?? Math.random());
    const tournamentId = `${tour}-${rawTournamentId}`;
    const tournamentName = String(ev.name ?? 'Tournament');
    const tournamentShort = String(ev.shortName ?? tournamentName);
    const eventVenue = ev.venue?.fullName ? String(ev.venue.fullName) : '';
    const isMajor = Boolean(ev.major);

    const groupings = Array.isArray(ev.groupings)
      ? ev.groupings
      : Array.isArray(ev.competitions)
        ? [{ grouping: { slug: 'singles', displayName: 'Singles' }, competitions: ev.competitions }]
        : [];

    const matchesInTournament: TennisMatch[] = [];

    for (const grp of groupings) {
      const slug = grp?.grouping?.slug;
      const grpName = String(grp?.grouping?.displayName ?? 'Singles');
      const competitions = Array.isArray(grp?.competitions) ? grp.competitions : [];

      for (const comp of competitions) {
        const startIso = String(comp.date ?? comp.startDate ?? '');
        const startDt = new Date(startIso);
        if (Number.isNaN(startDt.getTime())) continue;

        const matchDateKey = toLocalDateKey(startDt);
        if (matchDateKey !== dateKey) continue;

        const rawCompetitors = Array.isArray(comp.competitors) ? comp.competitors : [];
        const discipline = inferDiscipline(slug, grpName, rawCompetitors);
        const isDoubles = discipline === 'doubles';

        const competitors: MatchCompetitor[] = rawCompetitors
          .map((c: Record<string, unknown>) => parseCompetitor(c, rankMap, isDoubles))
          .sort((a: MatchCompetitor, b: MatchCompetitor) => a.order - b.order);

        const rankedValues = competitors
          .map((c) => c.officialRank)
          .filter((r): r is number => typeof r === 'number' && r <= 100);

        const hasTop100Player = rankedValues.length > 0;
        const highestTop100Rank = rankedValues.length > 0 ? Math.min(...rankedValues) : null;

        const statusState = normalizeStatusState(comp.status?.type?.state);
        const statusShort = String(comp.status?.type?.shortDetail ?? comp.status?.type?.description ?? '');
        const statusDetail = translateStatus(statusState, statusShort);

        const court = comp.venue?.court ? String(comp.venue.court) : '';
        const location = comp.venue?.fullName ? String(comp.venue.fullName) : eventVenue;
        const roundName = comp.round?.displayName ? String(comp.round.displayName) : 'Match';
        const noteText = comp.notes?.[0]?.text ? String(comp.notes[0].text) : undefined;

        const match: TennisMatch = {
          id: `${tour}-${String(comp.id ?? `${tournamentId}-${startIso}`)}`,
          tour,
          tournamentId,
          tournamentName,
          tournamentLocation: location,
          isMajor,
          discipline,
          disciplineLabel: isDoubles ? 'Doubles' : 'Singles',
          roundName,
          court,
          startIso,
          startTimestamp: startDt.getTime(),
          localDateKey: matchDateKey,
          localTimeLabel: formatLocalTime(startDt),
          statusState,
          statusDetail,
          statusShort,
          noteText,
          competitors,
          hasTop100Player,
          highestTop100Rank,
        };

        matchesInTournament.push(match);
        allMatches.push(match);
      }
    }

    matchesInTournament.sort((a, b) => a.startTimestamp - b.startTimestamp || a.roundName.localeCompare(b.roundName));

    if (matchesInTournament.length > 0) {
      tournaments.push({
        id: tournamentId,
        tour,
        name: tournamentName,
        shortName: tournamentShort,
        location: eventVenue || matchesInTournament[0].tournamentLocation,
        isMajor,
        startDate: String(ev.date ?? ''),
        endDate: String(ev.endDate ?? ''),
        matches: matchesInTournament,
      });
    }
  }

  return { tournaments, allMatches, calendarDates };
}

export async function fetchScoreboardForDate(
  tourFilter: TourFilter,
  dateKey: string,
  forceRefresh = false
): Promise<ScoreboardResult> {
  const toursToFetch: TourType[] = tourFilter === 'all' ? ['atp', 'wta'] : [tourFilter];
  const results = await Promise.all(
    toursToFetch.map((t) => fetchSingleTourScoreboard(t, dateKey, forceRefresh))
  );

  const tournaments = results.flatMap((r) => r.tournaments);
  const allMatches = results.flatMap((r) => r.allMatches);
  const calendarDateSet = new Set<string>();
  for (const r of results) {
    for (const d of r.calendarDates) {
      calendarDateSet.add(d);
    }
  }

  tournaments.sort((a, b) => {
    const aTime = a.matches[0]?.startTimestamp ?? 0;
    const bTime = b.matches[0]?.startTimestamp ?? 0;
    return aTime - bTime || a.name.localeCompare(b.name);
  });

  allMatches.sort((a, b) => a.startTimestamp - b.startTimestamp || a.tournamentName.localeCompare(b.tournamentName));

  return {
    tourFilter,
    selectedDate: dateKey,
    tournaments,
    allMatches,
    calendarDates: Array.from(calendarDateSet).sort(),
    fetchedAt: Date.now(),
  };
}
