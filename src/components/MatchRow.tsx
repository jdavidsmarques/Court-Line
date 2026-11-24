import { Check, ChevronRight } from 'lucide-react';
import type { MatchCompetitor, TennisMatch } from '../types/tennis';
import { CountryFlag } from './CountryFlag';

interface MatchRowProps {
  match: TennisMatch;
  showTournamentColumn: boolean;
  isSelected: boolean;
  onSelect: (match: TennisMatch) => void;
}

function CompetitorLine({ competitor }: { competitor: MatchCompetitor }) {
  const rankDisplay = competitor.officialRank ? `#${competitor.officialRank}` : '—';
  const isTop100 = typeof competitor.officialRank === 'number' && competitor.officialRank <= 100;
  const isRanked = typeof competitor.officialRank === 'number';

  return (
    <div className="flex items-center justify-between gap-3 min-w-0 h-6">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span
          className={`w-9 text-right text-xs font-mono tabular-nums shrink-0 ${
            isTop100
              ? 'font-semibold text-emerald-900'
              : isRanked
                ? 'font-medium text-slate-500'
                : 'text-slate-400'
          }`}
          title={
            isTop100
              ? `Top 100 · Official rank #${competitor.officialRank}`
              : isRanked
                ? `Official rank #${competitor.officialRank}`
                : 'Unranked in Top 150'
          }
        >
          {rankDisplay}
        </span>
        <CountryFlag src={competitor.flagUrl} alt={competitor.countryAlt} className="w-4 h-3" />
        <span
          className={`text-sm truncate ${
            competitor.isWinner
              ? 'font-semibold text-slate-950'
              : competitor.isTbd
                ? 'text-slate-400 italic'
                : 'font-normal text-slate-700'
          }`}
        >
          {competitor.displayName}
        </span>
        {competitor.seed && (
          <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
            [{competitor.seed}]
          </span>
        )}
        {competitor.isWinner && (
          <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-label="Winner" />
        )}
      </div>

      {/* Set scores */}
      {competitor.sets.length > 0 && (
        <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums text-sm">
          {competitor.sets.map((set, idx) => (
            <span
              key={idx}
              className={`w-5 text-center ${
                set.winner ? 'font-semibold text-slate-950' : 'text-slate-500'
              }`}
            >
              {set.games}
              {set.tiebreak !== undefined && (
                <sup className="text-[9px] text-slate-400 ml-[1px]">{set.tiebreak}</sup>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MatchRow({ match, showTournamentColumn, isSelected, onSelect }: MatchRowProps) {
  const c1 = match.competitors[0];
  const c2 = match.competitors[1];

  return (
    <button
      type="button"
      onClick={() => onSelect(match)}
      className={`w-full text-left px-5 py-3.5 grid items-center gap-4 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-800 ${
        showTournamentColumn
          ? 'grid-cols-[88px_220px_minmax(0,1fr)_170px_110px_20px]'
          : 'grid-cols-[88px_minmax(0,1fr)_170px_110px_20px]'
      } ${isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50/90'}`}
    >
      {/* Time & Court */}
      <div className="min-w-0">
        <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
          {match.localTimeLabel}
        </div>
        <div className="text-xs text-slate-500 truncate" title={match.court || undefined}>
          {match.court || 'Court TBD'}
        </div>
      </div>

      {/* Optional Tournament Column (in Chronological / By Hour view) */}
      {showTournamentColumn && (
        <div className="min-w-0 pr-2">
          <div className="text-sm font-medium text-slate-900 truncate" title={match.tournamentName}>
            {match.tournamentName}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {match.tour.toUpperCase()} · {match.tournamentLocation || match.disciplineLabel}
          </div>
        </div>
      )}

      {/* Competitors & Set Scores */}
      <div className="min-w-0 space-y-1">
        {c1 && <CompetitorLine competitor={c1} />}
        {c2 && <CompetitorLine competitor={c2} />}
      </div>

      {/* Round & Discipline (unboxed metadata) */}
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-800 truncate">{match.roundName}</div>
        <div className="text-xs text-slate-500 truncate">
          {match.tour.toUpperCase()} · {match.disciplineLabel}
        </div>
      </div>

      {/* Status (unboxed semantic text) */}
      <div className="text-right min-w-0">
        {match.statusState === 'in' ? (
          <span className="inline-flex items-center justify-end gap-1.5 text-xs font-semibold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
            {match.statusDetail}
          </span>
        ) : match.statusState === 'post' ? (
          <span className="text-xs font-medium text-slate-500">{match.statusDetail}</span>
        ) : (
          <span className="text-xs font-medium text-emerald-800">{match.statusDetail}</span>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-slate-400 justify-self-end" aria-hidden="true" />
    </button>
  );
}
