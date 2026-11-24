import { useState } from 'react';
import { ExternalLink, MapPin, Trophy, X } from 'lucide-react';
import type { MatchCompetitor, TennisMatch, TourType } from '../types/tennis';
import { formatDisplayDate } from '../services/espnTennis';
import { CountryFlag } from './CountryFlag';

interface MatchDetailDrawerProps {
  match: TennisMatch | null;
  onClose: () => void;
}

function PlayerProfileCard({ competitor, tour }: { competitor: MatchCompetitor; tour: TourType }) {
  const [imgError, setImgError] = useState(false);
  const rp = competitor.rankedPlayer;
  const initials = competitor.displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/50">
      <div className="flex items-start gap-3.5">
        {competitor.headshotUrl && !imgError ? (
          <img
            src={competitor.headshotUrl}
            alt={competitor.displayName}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-12 h-12 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-slate-200/80 text-slate-700 font-display font-semibold text-sm flex items-center justify-center shrink-0">
            {initials || '—'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CountryFlag src={competitor.flagUrl} alt={competitor.countryAlt} className="w-4 h-3" />
            <span className="text-sm font-semibold text-slate-900 truncate">
              {competitor.displayName}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
            {competitor.officialRank ? (
              <span
                className={`font-mono font-semibold tabular-nums ${
                  competitor.officialRank <= 100 ? 'text-emerald-900' : 'text-slate-700'
                }`}
              >
                #{competitor.officialRank} {tour.toUpperCase()}
              </span>
            ) : (
              <span>Outside Top 150</span>
            )}
            {rp && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{rp.points.toLocaleString('en-US')} pts</span>
              </>
            )}
            {rp?.age && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{rp.age} yrs</span>
              </>
            )}
          </div>

          {competitor.playerCardUrl && (
            <a
              href={competitor.playerCardUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
            >
              ESPN Profile
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function MatchDetailDrawer({ match, onClose }: MatchDetailDrawerProps) {
  if (!match) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-900/20 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Match details"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col shadow-xl"
      >
        <div className="px-6 h-16 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-slate-900 truncate">
              Match Details
            </h3>
            <p className="text-xs text-slate-500 truncate">
              {match.tournamentName} · {match.roundName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Block */}
          <div className="space-y-2 text-xs text-slate-600 border-b border-slate-200 pb-5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Local date &amp; time</span>
              <span className="font-mono font-medium text-slate-900 tabular-nums">
                {formatDisplayDate(match.localDateKey)} · {match.localTimeLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tournament</span>
              <span className="font-medium text-slate-900 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-slate-400" />
                {match.tournamentName}
              </span>
            </div>
            {(match.tournamentLocation || match.court) && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Venue / Court</span>
                <span className="font-medium text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {[match.court, match.tournamentLocation].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Draw / Status</span>
              <span className="font-medium text-slate-900">
                {match.tour.toUpperCase()} · {match.disciplineLabel} · {match.statusDetail}
              </span>
            </div>
          </div>

          {/* Scoreboard Summary */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 mb-3">Scoreboard</h4>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 bg-white">
              {match.competitors.map((comp) => (
                <div key={comp.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs font-mono tabular-nums font-semibold w-8 ${
                        comp.officialRank && comp.officialRank <= 100
                          ? 'text-emerald-900'
                          : 'text-slate-500'
                      }`}
                    >
                      {comp.officialRank ? `#${comp.officialRank}` : '—'}
                    </span>
                    <CountryFlag src={comp.flagUrl} alt={comp.countryAlt} className="w-4 h-3" />
                    <span
                      className={`text-sm truncate ${
                        comp.isWinner ? 'font-semibold text-slate-950' : 'text-slate-700'
                      }`}
                    >
                      {comp.displayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 font-mono text-sm tabular-nums shrink-0">
                    {comp.sets.length > 0 ? (
                      comp.sets.map((s, idx) => (
                        <span
                          key={idx}
                          className={`w-5 text-center ${
                            s.winner ? 'font-semibold text-slate-950' : 'text-slate-500'
                          }`}
                        >
                          {s.games}
                          {s.tiebreak !== undefined && (
                            <sup className="text-[9px] text-slate-400 ml-[1px]">{s.tiebreak}</sup>
                          )}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {match.noteText && (
              <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">{match.noteText}</p>
            )}
          </div>

          {/* Player Cards */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 mb-3">Players</h4>
            <div className="space-y-3">
              {match.competitors.map((comp) => (
                <PlayerProfileCard key={comp.id} competitor={comp} tour={match.tour} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
