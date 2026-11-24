export type TourType = 'atp' | 'wta';

export type TourFilter = 'all' | TourType;

export type MatchStatusState = 'pre' | 'in' | 'post';

export type DisciplineType = 'singles' | 'doubles';

export interface RankedPlayer {
  id: string;
  rank: number;
  previousRank: number;
  points: number;
  trend: string;
  displayName: string;
  shortName: string;
  countryName: string;
  flagUrl?: string;
  headshotUrl?: string;
  age?: number;
  citizenship?: string;
  playerCardUrl?: string;
}

export interface SetScore {
  games: number;
  tiebreak?: number;
  winner?: boolean;
}

export interface MatchCompetitor {
  id: string;
  order: number;
  displayName: string;
  shortName: string;
  isWinner: boolean;
  isDoubles: boolean;
  seed?: number;
  officialRank?: number;
  rankedPlayer?: RankedPlayer;
  flagUrl?: string;
  countryAlt?: string;
  headshotUrl?: string;
  playerCardUrl?: string;
  sets: SetScore[];
  isTbd: boolean;
}

export interface TennisMatch {
  id: string;
  tour: TourType;
  tournamentId: string;
  tournamentName: string;
  tournamentLocation: string;
  isMajor: boolean;
  discipline: DisciplineType;
  disciplineLabel: string;
  roundName: string;
  court: string;
  startIso: string;
  startTimestamp: number;
  localDateKey: string;
  localTimeLabel: string;
  statusState: MatchStatusState;
  statusDetail: string;
  statusShort: string;
  noteText?: string;
  competitors: MatchCompetitor[];
  hasTop100Player: boolean;
  highestTop100Rank: number | null;
}

export interface TennisTournamentGroup {
  id: string;
  tour: TourType;
  name: string;
  shortName: string;
  location: string;
  isMajor: boolean;
  startDate: string;
  endDate: string;
  matches: TennisMatch[];
}

export interface ScoreboardResult {
  tourFilter: TourFilter;
  selectedDate: string;
  tournaments: TennisTournamentGroup[];
  allMatches: TennisMatch[];
  calendarDates: string[];
  fetchedAt: number;
}
