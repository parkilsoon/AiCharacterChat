
import React, { useState, useRef } from 'react';
import { fetchCharacterById, ImportStep, parseCharacterJson, parseMultiCharacterJson, isMultiCharacterJson } from '../services/characterService';
import { geminiService } from '../services/geminiService';
import { CharacterData } from '../types';
import CharacterCreatorModal from './CharacterCreatorModal';
import QuickCreateModal from './QuickCreateModal';

interface CharacterLoaderProps {
  onLoaded: (char: CharacterData, userName: string, userDescription: string, visualStyle: string, globalCreatorNotes: string) => Promise<void>;
  onMultiLoaded?: (chars: CharacterData[], userName: string, userDescription: string, visualStyle: string, sharedScenario: string, firstMessage: string, globalCreatorNotes: string) => Promise<void>;
}

interface MultiCharacterData {
  characters: CharacterData[];
  sharedScenario: string;
  firstMessage: string;
}

const STYLE_PRESETS = [
  { name: '시네마틱', value: 'Cinematic digital painting, highly detailed, dramatic lighting, masterpiece' },
  { name: '애니메이션', value: 'Modern high-quality anime, vibrant colors, detailed background, lens flare, cinematic lighting' },
  { name: '모던만화', value: 'Modern sophisticated manga art, Oh! great style, Bakemonogatari aesthetic, sleek character design, sharp and clean line art, urban fashion, expressive and sensual eyes, professional digital manga finish, high-contrast monochrome' },
  { name: '부드러운', value: 'Studio Ghibli style, soft painterly background, nostalgic atmosphere, hand-drawn aesthetic' },
  { name: '실사', value: 'Photorealistic, 8k, highly detailed, natural lighting, shot on 35mm lens, realistic skin textures' }
];

const CharacterLoader: React.FC<CharacterLoaderProps> = ({ onLoaded, onMultiLoaded }) => {
  const [chubInput, setChubInput] = useState('https://chub.ai/characters/your/character');
  const [userName, setUserName] = useState('');
  const [userDescription, setUserDescription] = useState('');
  const [globalCreatorNotes, setGlobalCreatorNotes] = useState('');
  const [visualStyle, setVisualStyle] = useState(STYLE_PRESETS[1].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<ImportStep>('IDLE');
  const [stepMsg, setStepMsg] = useState('');
  const [fetchedData, setFetchedData] = useState<CharacterData | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [characterSummary, setCharacterSummary] = useState<string>('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 멀티 캐릭터 관련 상태
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [multiCharData, setMultiCharData] = useState<MultiCharacterData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFetch = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setFetchedData(null);
    setStep('FETCHING');
    try {
      const data = await fetchCharacterById(chubInput, (s, msg) => {
        setStep(s);
        if (msg) setStepMsg(msg);
      });
      setFetchedData(data);
      setStep('SUCCESS');
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "데이터를 가져오는 중 오류가 발생했습니다.");
      setStep('ERROR');
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // 멀티 캐릭터 JSON인지 확인
        if (isMultiCharacterJson(json)) {
          const multiData = parseMultiCharacterJson(json);
          if (multiData) {
            setMultiCharData(multiData);
            setFetchedData(null);
            setStep('SUCCESS');
            setError(null);
            return;
          }
        }

        // 일반 캐릭터 JSON
        const data = parseCharacterJson(json);
        setFetchedData(data);
        setMultiCharData(null);
        setStep('SUCCESS');
        setError(null);
      } catch (err) {
        setError("유효하지 않은 JSON 파일입니다.");
      }
    };
    reader.readAsText(file);
  };

  const handleStart = async () => {
    if (!fetchedData) return;
    setLoading(true);
    setStep('ANALYZING');
    setStepMsg('첫 대사 번역 및 페르소나 동기화 중...');
    try {
      await onLoaded(fetchedData, userName || "주인공", userDescription, visualStyle, globalCreatorNotes);
    } catch (err: any) {
      setError(err.message || "채팅 시작 중 오류가 발생했습니다.");
      setStep('ERROR');
      setLoading(false);
    }
  };

  // 멀티 캐릭터 시작
  const handleMultiStart = async () => {
    if (!multiCharData || !onMultiLoaded) return;
    setLoading(true);
    setStep('ANALYZING');
    setStepMsg('멀티 캐릭터 세션 초기화 중...');
    try {
      await onMultiLoaded(
        multiCharData.characters,
        userName || "주인공",
        userDescription,
        visualStyle,
        multiCharData.sharedScenario,
        multiCharData.firstMessage,
        globalCreatorNotes
      );
    } catch (err: any) {
      setError(err.message || "채팅 시작 중 오류가 발생했습니다.");
      setStep('ERROR');
      setLoading(false);
    }
  };

  // 캐릭터 생성 모달에서 제출
  const handleCreatorSubmit = (characters: CharacterData[], scenario: string) => {
    // 첫 번째 캐릭터의 first_mes 또는 공통 시작 메시지 사용
    const firstMessage = characters[0]?.first_mes || "이야기가 시작됩니다...";
    setMultiCharData({
      characters,
      sharedScenario: scenario,
      firstMessage
    });
    setFetchedData(null);
    setShowCreatorModal(false);
    setStep('SUCCESS');
  };

  const handleQuickCreate = (character: CharacterData) => {
    setFetchedData(character);
    setMultiCharData(null);
    setShowQuickCreate(false);
    setStep('SUCCESS');
    setError(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 mt-10 relative">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-white mb-2 italic tracking-tight uppercase">AI Persona Portal</h1>
        <p className="text-slate-400 font-medium">원하는 캐릭터를 불러오고 세계관에 접속하세요</p>
      </div>

      <div className="space-y-6">
        {step !== 'SUCCESS' && (
          <>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                <span className="flex items-center gap-2">
                  <i className="fas fa-link text-indigo-500"></i>
                  Chub.ai Character URL
                </span>
                <button
                  onClick={() => setShowQuickCreate(true)}
                  className="text-violet-400 hover:text-violet-300 transition-colors lowercase tracking-normal font-normal"
                >
                  <i className="fas fa-wand-magic-sparkles mr-1"></i> 간편생성
                </button>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chubInput}
                  onChange={(e) => setChubInput(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-indigo-500 font-mono text-sm transition-all shadow-inner disabled:opacity-50"
                  placeholder="https://chub.ai/characters/author/character 또는 author/character"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-700"></span></div>
              <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-500 tracking-widest"><span className="px-2 bg-slate-800">OR</span></div>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-6 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-all bg-slate-900/30 group"
              >
                <i className="fas fa-file-upload text-2xl group-hover:scale-110 transition-transform"></i>
                <span className="text-xs font-black uppercase tracking-widest">Upload JSON</span>
              </button>
              <button
                onClick={() => setShowCreatorModal(true)}
                className="py-6 border-2 border-dashed border-emerald-700/50 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/50 transition-all bg-slate-900/30 group"
              >
                <i className="fas fa-users text-2xl group-hover:scale-110 transition-transform"></i>
                <span className="text-xs font-black uppercase tracking-widest">Create Characters</span>
              </button>
            </div>

            <button
              onClick={handleFetch}
              disabled={loading || !chubInput.trim()}
              className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white font-black py-4 px-6 rounded-xl transition-all shadow-xl flex items-center justify-center gap-4 text-lg border border-white/5"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <i className="fas fa-circle-notch animate-spin"></i>
                  <span className="uppercase tracking-widest text-xs">{stepMsg || 'Fetching...'}</span>
                </div>
              ) : (
                <>
                  <i className="fas fa-search"></i>
                  <span className="uppercase tracking-wider">Fetch From Online</span>
                </>
              )}
            </button>
          </>
        )}

        {step === 'SUCCESS' && (fetchedData || multiCharData) && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
            {/* 싱글 캐릭터 표시 */}
            {fetchedData && !multiCharData && (
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                    {fetchedData.name[0]}
                  </div>
                  <div>
                    <p className="text-white font-bold">{fetchedData.name}</p>
                    <p className="text-xs text-indigo-300 uppercase tracking-widest font-black">Character Sync Ready</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setShowInfo(true);
                      if (!characterSummary && fetchedData) {
                        setIsSummarizing(true);
                        const summary = await geminiService.summarizeCharacterInfo(fetchedData);
                        setCharacterSummary(summary);
                        setIsSummarizing(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    title="캐릭터 정보 보기"
                  >
                    <i className="fas fa-info-circle"></i>
                  </button>
                  <button
                    onClick={() => { setStep('IDLE'); setFetchedData(null); setCharacterSummary(''); }}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    <i className="fas fa-undo"></i>
                  </button>
                </div>
              </div>
            )}

            {/* 멀티 캐릭터 표시 */}
            {multiCharData && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-users text-emerald-400"></i>
                    <span className="text-xs text-emerald-300 uppercase tracking-widest font-black">
                      Multi Character Mode ({multiCharData.characters.length}명)
                    </span>
                  </div>
                  <button
                    onClick={() => { setStep('IDLE'); setMultiCharData(null); }}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    <i className="fas fa-undo"></i>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {multiCharData.characters.map((char, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg">
                      <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center text-white text-xs font-bold">
                        {char.name[0]}
                      </div>
                      <span className="text-white text-sm font-medium">{char.name}</span>
                    </div>
                  ))}
                </div>
                {multiCharData.sharedScenario && (
                  <p className="text-slate-400 text-xs mt-3 italic">
                    <i className="fas fa-map-marker-alt mr-1"></i>
                    {multiCharData.sharedScenario.slice(0, 80)}...
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                <i className="fas fa-user text-indigo-500"></i>
                Your Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 text-base transition-all shadow-inner"
                placeholder="이름 또는 호칭 (예: 미나, 검사)"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                <i className="fas fa-id-card text-indigo-500"></i>
                Your Description <span className="text-slate-600 font-normal lowercase">(선택)</span>
              </label>
              <textarea
                value={userDescription}
                onChange={(e) => setUserDescription(e.target.value)}
                rows={3}
                maxLength={300}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 text-sm resize-none transition-all shadow-inner"
                placeholder="외모, 성격, 특징 등 (예: 24세 여성, 긴 흑발, 검사)"
              />
              <p className="text-[10px] text-slate-600 text-right">{userDescription.length}/300</p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                <i className="fas fa-scroll text-amber-500"></i>
                Global Creator Notes <span className="text-slate-600 font-normal lowercase">(선택)</span>
              </label>
              <textarea
                value={globalCreatorNotes}
                onChange={(e) => setGlobalCreatorNotes(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 text-sm resize-none transition-all shadow-inner"
                placeholder="AI에게 전달할 전체 지시사항 (예: 한국어로 대화해주세요, 이 세계관에서는...)"
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                <i className="fas fa-image text-indigo-500"></i>
                Visual Style
              </label>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setVisualStyle(preset.value)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${
                      visualStyle === preset.value
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]'
                      : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={multiCharData ? handleMultiStart : handleStart}
              disabled={loading || (multiCharData && !onMultiLoaded)}
              className={`w-full ${multiCharData ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white font-black py-5 px-6 rounded-xl transition-all shadow-xl flex items-center justify-center gap-4 text-xl active:scale-95 group border border-white/10`}
            >
              {loading ? (
                <i className="fas fa-circle-notch animate-spin text-2xl"></i>
              ) : (
                <>
                  <i className={`fas ${multiCharData ? 'fa-users' : 'fa-bolt'} group-hover:scale-125 transition-transform`}></i>
                  <span className="uppercase tracking-wider">
                    {multiCharData ? 'Start Multi Chat' : 'Initialize Sync'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {step === 'ERROR' && error && (
          <div className="p-4 bg-red-900/20 border border-red-500/30 text-red-200 rounded-xl text-sm flex gap-3 items-center animate-in slide-in-from-top-2">
            <i className="fas fa-exclamation-triangle"></i>
            <p className="font-medium">{error}</p>
          </div>
        )}
      </div>

      {showInfo && fetchedData && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[80vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h3 className="font-black text-white uppercase tracking-widest text-sm">
                <i className="fas fa-user-circle mr-2 text-indigo-400"></i>
                캐릭터 정보
              </h3>
              <button onClick={() => setShowInfo(false)} className="p-2 text-slate-400 hover:text-white transition-colors">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {isSummarizing ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <i className="fas fa-circle-notch animate-spin text-3xl text-indigo-400 mb-4"></i>
                  <p className="text-sm font-medium">캐릭터 정보를 번역 중...</p>
                </div>
              ) : characterSummary ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  {characterSummary.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) {
                      return <h4 key={i} className="text-indigo-400 font-black text-xs uppercase tracking-widest mt-6 mb-2 first:mt-0">{line.replace('## ', '')}</h4>;
                    }
                    if (line.trim()) {
                      return <p key={i} className="text-slate-300 text-sm leading-relaxed mb-2">{line}</p>;
                    }
                    return null;
                  })}
                </div>
              ) : (
                <div className="text-slate-500 text-center py-8">정보를 불러오는 중...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 캐릭터 생성 모달 */}
      <CharacterCreatorModal
        isOpen={showCreatorModal}
        onClose={() => setShowCreatorModal(false)}
        onSubmit={handleCreatorSubmit}
      />

      {/* 간편생성 모달 */}
      <QuickCreateModal
        isOpen={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        onGenerated={handleQuickCreate}
      />
    </div>
  );
};

export default CharacterLoader;
