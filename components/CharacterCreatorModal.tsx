
import React, { useState } from 'react';
import { CharacterData } from '../types';

interface SingleCharacterForm {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
}

interface CharacterCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (characters: CharacterData[], scenario: string) => void;
}

const createEmptyCharacter = (): SingleCharacterForm => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36),
  name: '',
  description: '',
  personality: '',
  scenario: '',
  first_mes: '',
  mes_example: '',
  creator_notes: ''
});

const CharacterCreatorModal: React.FC<CharacterCreatorModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [characters, setCharacters] = useState<SingleCharacterForm[]>([createEmptyCharacter()]);
  const [activeTab, setActiveTab] = useState(0);
  const [sharedScenario, setSharedScenario] = useState('');
  const [firstMessage, setFirstMessage] = useState('');

  if (!isOpen) return null;

  const addCharacter = () => {
    if (characters.length >= 5) return; // 최대 5명
    setCharacters([...characters, createEmptyCharacter()]);
    setActiveTab(characters.length);
  };

  const removeCharacter = (index: number) => {
    if (characters.length <= 1) return;
    const newChars = characters.filter((_, i) => i !== index);
    setCharacters(newChars);
    if (activeTab >= newChars.length) {
      setActiveTab(newChars.length - 1);
    }
  };

  const updateCharacter = (index: number, field: keyof SingleCharacterForm, value: string) => {
    const newChars = [...characters];
    newChars[index] = { ...newChars[index], [field]: value };
    setCharacters(newChars);
  };

  const handleSubmit = () => {
    // 유효성 검사
    const validChars = characters.filter(c => c.name.trim());
    if (validChars.length === 0) {
      alert('최소 한 명의 캐릭터 이름을 입력해주세요.');
      return;
    }

    // CharacterData 배열로 변환
    const charDataList: CharacterData[] = validChars.map(c => ({
      name: c.name.trim(),
      description: c.description.trim(),
      personality: c.personality.trim(),
      scenario: sharedScenario.trim() || c.scenario.trim(),
      first_mes: firstMessage.trim() || c.first_mes.trim(),
      mes_example: c.mes_example.trim(),
      creator_notes: c.creator_notes.trim()
    }));

    onSubmit(charDataList, sharedScenario);
  };

  const downloadJson = () => {
    const validChars = characters.filter(c => c.name.trim());
    if (validChars.length === 0) {
      alert('최소 한 명의 캐릭터를 입력해주세요.');
      return;
    }

    const exportData = {
      spec: "chara_card_v2_multi",
      spec_version: "1.0",
      shared_scenario: sharedScenario,
      first_message: firstMessage,
      characters: validChars.map(c => ({
        name: c.name,
        description: c.description,
        personality: c.personality,
        scenario: c.scenario,
        mes_example: c.mes_example,
        creator_notes: c.creator_notes
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi_character_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeChar = characters[activeTab];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <h3 className="font-black text-white uppercase tracking-widest text-sm">
            <i className="fas fa-users mr-2 text-indigo-400"></i>
            캐릭터 만들기
          </h3>
          <div className="flex gap-2">
            <button
              onClick={downloadJson}
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
              title="JSON 내보내기"
            >
              <i className="fas fa-download mr-1"></i> JSON
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        {/* Character Tabs */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-800 bg-slate-850 overflow-x-auto">
          {characters.map((char, idx) => (
            <button
              key={char.id}
              onClick={() => setActiveTab(idx)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === idx
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px]">
                {idx + 1}
              </span>
              {char.name || `캐릭터 ${idx + 1}`}
              {characters.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); removeCharacter(idx); }}
                  className="ml-1 text-slate-500 hover:text-red-400 cursor-pointer"
                >
                  <i className="fas fa-times text-[10px]"></i>
                </span>
              )}
            </button>
          ))}
          {characters.length < 5 && (
            <button
              onClick={addCharacter}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 text-indigo-400 hover:bg-slate-700 transition-all"
            >
              <i className="fas fa-plus mr-1"></i> 추가
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* 공통 설정 섹션 (첫 번째 탭에서만 표시 또는 항상 상단에 표시) */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">
              <i className="fas fa-globe mr-2"></i>공통 설정
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  공통 시나리오 (모든 캐릭터에 적용)
                </label>
                <textarea
                  value={sharedScenario}
                  onChange={(e) => setSharedScenario(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-indigo-500"
                  placeholder="예: 서울의 한 대학교. 당신과 캐릭터들은 같은 동아리 소속입니다."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  첫 대사 (게임 시작 시 표시)
                </label>
                <textarea
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-indigo-500"
                  placeholder="예: 동아리방 문이 열리며 익숙한 얼굴들이 보인다."
                />
              </div>
            </div>
          </div>

          {/* 개별 캐릭터 폼 */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              <i className="fas fa-user mr-2"></i>캐릭터 {activeTab + 1} 정보
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  이름 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={activeChar.name}
                  onChange={(e) => updateCharacter(activeTab, 'name', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="캐릭터 이름"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  성격
                </label>
                <input
                  type="text"
                  value={activeChar.personality}
                  onChange={(e) => updateCharacter(activeTab, 'personality', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="차분함, 활발함, 츤데레..."
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                외모 및 특징
              </label>
              <textarea
                value={activeChar.description}
                onChange={(e) => updateCharacter(activeTab, 'description', e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-indigo-500"
                placeholder="캐릭터의 외모, 배경, 특징 등을 자세히 적어주세요."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                개별 시나리오 (선택사항 - 공통 시나리오가 없을 때 사용)
              </label>
              <textarea
                value={activeChar.scenario}
                onChange={(e) => updateCharacter(activeTab, 'scenario', e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-indigo-500"
                placeholder="이 캐릭터만의 개별 시나리오"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                대화 예시 (선택)
              </label>
              <textarea
                value={activeChar.mes_example}
                onChange={(e) => updateCharacter(activeTab, 'mes_example', e.target.value)}
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-indigo-500 font-mono"
                placeholder="{{user}}: 안녕?&#10;{{char}}: 반가워!"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                제작자 노트 (선택)
              </label>
              <input
                type="text"
                value={activeChar.creator_notes}
                onChange={(e) => updateCharacter(activeTab, 'creator_notes', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="AI에게 전달할 추가 지시사항"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex justify-between items-center">
          <div className="text-xs text-slate-500">
            <i className="fas fa-info-circle mr-1"></i>
            {characters.filter(c => c.name.trim()).length}명의 캐릭터가 준비됨 (최대 5명)
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-all"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2"
            >
              <i className="fas fa-play"></i>
              게임 시작
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterCreatorModal;
