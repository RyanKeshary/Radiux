'use client';

import React, { useState } from 'react';
import { ContributionDay } from '@/lib/types';
import { Flame, Calendar, Award, Zap } from 'lucide-react';

interface ContributionGraphProps {
  days: ContributionDay[];
  totalContributions: number;
  currentStreak: number;
  longestStreak: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_OF_WEEK = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

export function ContributionGraph({
  days,
  totalContributions,
  currentStreak,
  longestStreak,
}: ContributionGraphProps) {
  const [hoveredDay, setHoveredDay] = useState<{ day: ContributionDay; x: number; y: number } | null>(null);

  // Group days into 52 or 53 weeks (7 days per week)
  const weeks: ContributionDay[][] = [];
  let currentWeek: ContributionDay[] = [];

  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const getCellColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-emerald-500/30 border-emerald-500/40 dark:bg-emerald-500/30';
      case 2:
        return 'bg-emerald-500/60 border-emerald-500/60 dark:bg-emerald-500/60';
      case 3:
        return 'bg-emerald-500/85 border-emerald-500/80 dark:bg-emerald-500/80';
      case 4:
        return 'bg-emerald-400 border-emerald-300 dark:bg-emerald-400 shadow-sm';
      default:
        return 'border border-black/5 dark:border-white/5 opacity-40';
    }
  };

  return (
    <div 
      className="p-5 rounded-xl border shadow-sm select-none relative overflow-hidden"
      style={{
        backgroundColor: 'var(--ide-card-bg)',
        borderColor: 'var(--ide-border)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Header & Key Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b" style={{ borderColor: 'var(--ide-border)' }}>
        <div>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Developer Activity</span>
          </div>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--ide-text-muted)' }}>
            Real-time commits, workspace contributions & collaborative coding sessions
          </p>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}>
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-semibold">{totalContributions}</span>
            <span className="opacity-70 text-[11px]">this year</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">{currentStreak} days</span>
            <span className="opacity-70 text-[11px]">current</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}>
            <Award className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold">{longestStreak} days</span>
            <span className="opacity-70 text-[11px]">longest</span>
          </div>
        </div>
      </div>

      {/* Grid Canvas Wrapper */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[720px]">
          {/* Month labels */}
          <div className="flex ml-8 mb-1.5 text-[10px] font-medium" style={{ color: 'var(--ide-text-muted)' }}>
            {MONTHS.map((m, idx) => (
              <span key={idx} className="flex-1 truncate">
                {m}
              </span>
            ))}
          </div>

          <div className="flex gap-1.5 items-start">
            {/* Day of Week labels */}
            <div className="flex flex-col justify-between h-[88px] text-[9.5px] pr-2 pt-0.5" style={{ color: 'var(--ide-text-muted)' }}>
              {DAYS_OF_WEEK.map((d, idx) => (
                <span key={idx} className="h-2.5 leading-none">
                  {d}
                </span>
              ))}
            </div>

            {/* Weeks columns */}
            <div className="flex gap-[3.5px] flex-1">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3.5px]">
                  {week.map((day, dIdx) => (
                    <div
                      key={dIdx}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredDay({ day, x: rect.left + rect.width / 2, y: rect.top - 8 });
                      }}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`w-[11.5px] h-[11.5px] rounded-[2.5px] cursor-pointer transition-all duration-150 hover:scale-125 hover:z-10 ${getCellColor(
                        day.level
                      )}`}
                      style={{
                        backgroundColor: day.level === 0 ? 'var(--ide-dock-header)' : undefined,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t text-[11px]" style={{ borderColor: 'var(--ide-border)', color: 'var(--ide-text-muted)' }}>
            <span>Learn how we aggregate contributions</span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <div className="w-2.5 h-2.5 rounded-[2px] border border-black/10 dark:border-white/10" style={{ backgroundColor: 'var(--ide-dock-header)' }} />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500/30" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500/60" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500/80" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-400" />
              <span>More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Tooltip */}
      {hoveredDay && (
        <div 
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-lg shadow-xl text-xs border backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: hoveredDay.x,
            top: hoveredDay.y,
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-text)',
          }}
        >
          <div className="font-semibold text-[11.5px]">
            {hoveredDay.day.count === 0 ? 'No contributions' : `${hoveredDay.day.count} contribution${hoveredDay.day.count > 1 ? 's' : ''}`}
          </div>
          <div className="text-[10px] opacity-70">
            {new Date(hoveredDay.day.date).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
      )}
    </div>
  );
}
