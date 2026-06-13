import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, BarChart2, Clock, Trophy, Music2 } from 'lucide-react';
import { usePlayerStore } from '../stores/playerStore';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

interface StatsModalProps {
  onClose: () => void;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export const StatsModal: React.FC<StatsModalProps> = ({ onClose }) => {
  const tracks = usePlayerStore(state => state.tracks);

  const stats = useMemo(() => {
    let totalTime = 0;
    const artistStats: Record<string, number> = {};
    const trackStats: Record<string, { name: string; artist: string; plays: number; time: number }> = {};

    tracks.forEach(t => {
      const time = t.timeListened || 0;
      const plays = t.playCount || 0;
      totalTime += time;

      if (t.artist) {
        artistStats[t.artist] = (artistStats[t.artist] || 0) + time;
      }

      trackStats[t.id] = {
        name: t.name,
        artist: t.artist || 'Unknown',
        plays: plays,
        time: time
      };
    });

    const topArtists = Object.entries(artistStats)
      .map(([name, time]) => ({ name, value: Math.round(time / 60) })) // in minutes
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topTracks = Object.values(trackStats)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5)
      .map(t => ({ name: t.name, plays: t.plays }));

    return { totalTime, topArtists, topTracks };
  }, [tracks]);

  const totalHours = (stats.totalTime / 3600).toFixed(1);

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" onClick={onClose}>
      <div className="bg-background border border-secondary rounded-2xl w-full max-w-4xl shadow-2xl my-8 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 to-purple-500/20 p-6 sm:p-8 flex items-center justify-between border-b border-secondary">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <BarChart2 className="w-8 h-8 text-primary" />
              Rpet Wrapped
            </h2>
            <p className="text-gray-400 mt-2">Ваша музична статистика</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors bg-black/20 rounded-full hover:bg-black/40">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Top Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-secondary/30 p-6 rounded-xl border border-secondary/50 flex flex-col items-center justify-center text-center">
              <Clock className="w-8 h-8 text-blue-400 mb-3" />
              <div className="text-3xl font-bold text-white">{totalHours}</div>
              <div className="text-sm text-gray-400 mt-1">Годин прослухано</div>
            </div>
            
            <div className="bg-secondary/30 p-6 rounded-xl border border-secondary/50 flex flex-col items-center justify-center text-center">
              <Trophy className="w-8 h-8 text-yellow-400 mb-3" />
              <div className="text-xl font-bold text-white truncate w-full">
                {stats.topArtists[0]?.name || 'Немає даних'}
              </div>
              <div className="text-sm text-gray-400 mt-1">Улюблений артист</div>
            </div>
            
            <div className="bg-secondary/30 p-6 rounded-xl border border-secondary/50 flex flex-col items-center justify-center text-center">
              <Music2 className="w-8 h-8 text-pink-400 mb-3" />
              <div className="text-3xl font-bold text-white">{tracks.length}</div>
              <div className="text-sm text-gray-400 mt-1">Треків у бібліотеці</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Top Artists Pie Chart */}
            <div className="bg-secondary/10 p-6 rounded-xl border border-secondary/30">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" /> Топ Артистів (хв)
              </h3>
              {stats.topArtists.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.topArtists}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {stats.topArtists.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">Недостатньо даних</div>
              )}
            </div>

            {/* Top Tracks Bar Chart */}
            <div className="bg-secondary/10 p-6 rounded-xl border border-secondary/30">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Music2 className="w-5 h-5 text-primary" /> Топ Треків (відтворення)
              </h3>
              {stats.topTracks.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topTracks} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                      />
                      <Bar dataKey="plays" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                        {stats.topTracks.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">Недостатньо даних</div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
