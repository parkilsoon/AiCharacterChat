
import React, { useState } from 'react';
import { ParsedHudData, EmotionFlow } from '../../utils/hudParser';

interface CoreStatusPanelProps {
  data: ParsedHudData;
  isStreaming: boolean;
}

// --- Color mapping utilities ---

type EmotionCategory = 'positive' | 'negative' | 'alert' | 'intense' | 'sad' | 'neutral';

const EMOTION_KEYWORDS: Record<EmotionCategory, string[]> = {
  positive: ['호의', '따뜻', '기쁨', '친근', '호감', '행복', '편안', '만족', '감사', '즐거', '애정', '기대', '설렘', '웃음', '좋아', '반가', '다정'],
  negative: ['분노', '짜증', '불쾌', '화남', '적대', '혐오', '증오', '격분', '못마땅', '싫'],
  alert: ['경계', '의심', '긴장', '조심', '조심스러', '불안', '두려', '공포', '걱정', '초조', '주의', '의구심', '경고'],
  intense: ['흥분', '놀라움', '동요', '충격', '놀람', '흥미', '당황', '두근', '놀란'],
  sad: ['슬픔', '외로움', '후회', '우울', '쓸쓸', '서글', '고독', '아쉬움', '미안', '죄책', '그리움'],
  neutral: ['평온', '무심', '담담', '무관심', '차분', '냉정', '중립', '덤덤', '관조'],
};

const EMOTION_COLORS: Record<EmotionCategory, { text: string; bg: string; border: string }> = {
  positive: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  negative: { text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  alert: { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  intense: { text: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/30' },
  sad: { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  neutral: { text: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/30' },
};

function getEmotionCategory(emotion: string): EmotionCategory {
  const lower = emotion.toLowerCase();
  for (const [category, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category as EmotionCategory;
    }
  }
  return 'neutral';
}

function getEmotionColor(emotion: string) {
  return EMOTION_COLORS[getEmotionCategory(emotion)];
}

const REACTION_STYLES: Record<string, { color: string; bg: string; icon: string }> = {
  '협조': { color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: 'fa-handshake' },
  '무시': { color: 'text-slate-400', bg: 'bg-slate-500/15', icon: 'fa-eye-slash' },
  '거부': { color: 'text-rose-400', bg: 'bg-rose-500/15', icon: 'fa-times-circle' },
  '회피': { color: 'text-amber-400', bg: 'bg-amber-500/15', icon: 'fa-person-running' },
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  '낯섬': 'bg-slate-600 text-slate-200',
  '지인': 'bg-sky-600/80 text-sky-100',
  '친구': 'bg-emerald-600/80 text-emerald-100',
  '연인': 'bg-rose-600/80 text-rose-100',
  '적대': 'bg-red-700/80 text-red-100',
};

function getRelationshipStyle(rel: string): string {
  for (const [key, style] of Object.entries(RELATIONSHIP_COLORS)) {
    if (rel.includes(key)) return style;
  }
  return 'bg-slate-600 text-slate-200';
}

const WEATHER_ICONS: Record<string, string> = {
  '맑음': 'fa-sun',
  '흐림': 'fa-cloud',
  '구름': 'fa-cloud',
  '비': 'fa-cloud-rain',
  '눈': 'fa-snowflake',
  '안개': 'fa-smog',
  '폭풍': 'fa-bolt',
  '바람': 'fa-wind',
  '밤': 'fa-moon',
  '저녁': 'fa-cloud-moon',
  '새벽': 'fa-moon',
};

function getWeatherIcon(weather: string): string {
  for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
    if (weather.includes(key)) return icon;
  }
  return 'fa-cloud';
}

// --- Sub-components ---

const ContextBar: React.FC<{ date: string; time: string; location: string; weather: string; relationship: string }> = ({ date, time, location, weather, relationship }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 text-[10px]">
      <i className="fas fa-calendar-alt text-[8px] opacity-60"></i>{date}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 text-[10px]">
      <i className="fas fa-clock text-[8px] opacity-60"></i>{time}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 text-[10px]">
      <i className="fas fa-map-marker-alt text-[8px] opacity-60"></i>{location}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 text-[10px]">
      <i className={`fas ${getWeatherIcon(weather)} text-[8px] opacity-60`}></i>{weather}
    </span>
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${getRelationshipStyle(relationship)}`}>
      {relationship}
    </span>
  </div>
);

const EmotionTransition: React.FC<{ flow: EmotionFlow }> = ({ flow }) => {
  const prevColor = getEmotionColor(flow.previous);
  const currColor = getEmotionColor(flow.current);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${prevColor.bg} ${prevColor.text} border ${prevColor.border}`}>
        {flow.previous}
      </span>
      <i className="fas fa-arrow-right text-[8px] text-slate-600"></i>
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${currColor.bg} ${currColor.text} border ${currColor.border}`}>
        {flow.current}
      </span>
      {flow.reason && (
        <span className="text-[9px] text-slate-500 italic ml-1">[{flow.reason}]</span>
      )}
    </div>
  );
};

const ProgressGauge: React.FC<{ value: number; max?: number; label: string; colorClass: string }> = ({ value, max = 100, label, colorClass }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[9px] text-slate-500 w-6 shrink-0 text-right font-mono">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass} transition-all duration-500`} style={{ width: `${pct}%` }}></div>
      </div>
      <span className="text-[9px] text-slate-500 w-6 shrink-0 font-mono">{value}</span>
    </div>
  );
};

const StatBars: React.FC<{ hp: number; arousal: number; pain: number; sanity: number }> = ({ hp, arousal, pain, sanity }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
    <ProgressGauge value={hp} label="HP" colorClass="bg-emerald-500" />
    <ProgressGauge value={arousal} label="흥분" colorClass="bg-rose-500" />
    <ProgressGauge value={pain} label="고통" colorClass="bg-amber-500" />
    <ProgressGauge value={sanity} label="이성" colorClass="bg-sky-500" />
  </div>
);

const InnerAnalysisSection: React.FC<{ analysis: NonNullable<ParsedHudData['innerAnalysis']> }> = ({ analysis }) => (
  <div className="space-y-2.5">
    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Inner Analysis</div>

    {analysis.physicalState && (
      <div className="text-[10px]">
        <span className="text-slate-500 mr-1.5">신체상태:</span>
        <span className="text-slate-300">{analysis.physicalState}</span>
      </div>
    )}

    {analysis.userInterpretation && (
      <div className="text-[10px]">
        <span className="text-slate-500 mr-1.5">발언해석:</span>
        <span className="text-slate-300">{analysis.userInterpretation}</span>
      </div>
    )}

    {analysis.innerThought && (
      <div className="border border-dashed border-slate-600/50 rounded-lg p-2.5 bg-slate-900/50 relative">
        <div className="absolute -top-2 left-2 px-1.5 bg-slate-900 text-[8px] font-black text-red-400/70 uppercase tracking-widest">Classified</div>
        <p className="text-[11px] text-slate-300 italic leading-relaxed">{analysis.innerThought}</p>
      </div>
    )}

    {analysis.impulse && (
      <div className="text-[10px]">
        <span className="text-slate-500 mr-1.5">충동:</span>
        <span className="text-slate-300 italic">{analysis.impulse}</span>
      </div>
    )}

    {analysis.reactionDecision && (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500">반응:</span>
        {analysis.reactionDecision.split(/[/,]/).map((r, i) => {
          const trimmed = r.trim();
          const style = REACTION_STYLES[trimmed] || { color: 'text-slate-400', bg: 'bg-slate-500/15', icon: 'fa-question' };
          return (
            <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${style.color} ${style.bg}`}>
              <i className={`fas ${style.icon} text-[8px]`}></i>{trimmed}
            </span>
          );
        })}
      </div>
    )}
  </div>
);

const StateRecordSection: React.FC<{ record: NonNullable<ParsedHudData['stateRecord']> }> = ({ record }) => (
  <div className="space-y-2.5">
    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">State Record</div>

    {record.currentGoal && (
      <div className="text-[10px]">
        <span className="text-slate-500 mr-1.5">목표:</span>
        <span className="text-slate-300">{record.currentGoal}</span>
      </div>
    )}

    {record.psychologicalState && (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-slate-500 mr-0.5">심리:</span>
        {record.psychologicalState.split(/[,、\s]+/).filter(Boolean).map((tag, i) => {
          const color = getEmotionColor(tag);
          return (
            <span key={i} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] ${color.bg} ${color.text} border ${color.border}`}>
              {tag}
            </span>
          );
        })}
      </div>
    )}

    {record.emotionIntensity > 0 && (
      <ProgressGauge value={record.emotionIntensity} label="강도" colorClass="bg-violet-500" />
    )}

    {record.memos.length > 0 && (
      <div className="space-y-1">
        <span className="text-[10px] text-slate-500">메모:</span>
        {record.memos.map((memo, i) => (
          <div key={i} className="text-[10px] text-slate-400 pl-3 border-l border-slate-700/50">
            {memo}
          </div>
        ))}
      </div>
    )}
  </div>
);

// --- Main component ---

const CoreStatusPanel: React.FC<CoreStatusPanelProps> = ({ data, isStreaming }) => {
  const [expanded, setExpanded] = useState(true);

  const hasCompactContent = data.header || data.statusBar || data.innerAnalysis?.emotionFlow || data.stateRecord?.emotionIntensity;
  const hasExpandedContent = data.innerAnalysis || data.stateRecord;
  const hasAnyContent = hasCompactContent || hasExpandedContent;

  if (!hasAnyContent) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl font-mono text-[11px]">
      {/* Header bar */}
      <button
        onClick={() => !isStreaming && setExpanded(prev => !prev)}
        className="w-full px-4 py-2 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between hover:bg-slate-800/80 transition-colors cursor-pointer"
      >
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Core Status</span>
        {hasExpandedContent && (
          <i className={`fas fa-chevron-down text-[8px] text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}></i>
        )}
      </button>

      {/* Compact view - always visible */}
      <div className="px-4 py-3 space-y-2.5">
        {data.header && (
          <ContextBar
            date={data.header.date}
            time={data.header.time}
            location={data.header.location}
            weather={data.header.weather}
            relationship={data.header.relationship}
          />
        )}

        {data.innerAnalysis?.emotionFlow && (
          <EmotionTransition flow={data.innerAnalysis.emotionFlow} />
        )}

        {data.statusBar && (
          <StatBars
            hp={data.statusBar.hp}
            arousal={data.statusBar.arousal}
            pain={data.statusBar.pain}
            sanity={data.statusBar.sanity}
          />
        )}
      </div>

      {/* Expanded view - toggled */}
      {hasExpandedContent && (
        <div
          className={`overflow-hidden transition-all ${isStreaming ? '' : 'duration-300 ease-in-out'}`}
          style={{
            maxHeight: expanded ? '600px' : '0px',
            opacity: expanded ? 1 : 0,
          }}
        >
          <div className="px-4 pb-4 space-y-4 border-t border-slate-700/30 pt-3">
            {data.innerAnalysis && <InnerAnalysisSection analysis={data.innerAnalysis} />}
            {data.stateRecord && <StateRecordSection record={data.stateRecord} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoreStatusPanel;
