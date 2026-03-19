
import React, { useState } from 'react';
import { CharacterData } from '../types';
import { geminiService } from '../services/geminiService';

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (character: CharacterData) => void;
}

const QuickCreateModal: React.FC<QuickCreateModalProps> = ({ isOpen, onClose, onGenerated }) => {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!description.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const character = await geminiService.generateCharacterFromDescription(description.trim());
      onGenerated(character);
      setDescription('');
      setError(null);
    } catch (err: any) {
      setError(err.userMessage || err.message || '캐릭터 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <h3 className="font-black text-white uppercase tracking-widest text-sm">
            <i className="fas fa-wand-magic-sparkles mr-2 text-violet-400"></i>
            간편생성
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors" disabled={loading}>
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-400">
            원하는 캐릭터나 스토리를 자유롭게 설명하면 AI가 상세한 캐릭터 데이터를 자동 생성합니다.
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 text-sm resize-none transition-all shadow-inner placeholder:text-slate-600"
            placeholder={"예시:\n조선시대 궁궐을 배경으로 한 비밀 호위무사. 냉철하고 과묵하지만 주인공에게만은 부드러운 면을 보인다. 검술에 뛰어나며 어두운 과거를 가지고 있다.\n\n또는:\n현대 카페를 운영하는 밝고 활발한 바리스타. 손님들에게 항상 웃으며 대하지만 사실은 소설가 지망생이다."}
            disabled={loading}
          />

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 text-red-200 rounded-xl text-sm flex gap-2 items-center">
              <i className="fas fa-exclamation-triangle"></i>
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-800/30">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-bold transition-all"
            disabled={loading}
          >
            취소
          </button>
          <button
            onClick={handleGenerate}
            disabled={!description.trim() || loading}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          >
            {loading ? (
              <>
                <i className="fas fa-circle-notch animate-spin"></i>
                생성 중...
              </>
            ) : (
              <>
                <i className="fas fa-wand-magic-sparkles"></i>
                생성하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickCreateModal;
