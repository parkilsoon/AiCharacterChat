
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CharacterData, Message, MemoryState, GeminiApiError } from '../types';
import { geminiService } from '../services/geminiService';
import { StorageService } from '../services/storageService';
import { parseModelResponse } from '../utils/hudParser';
import CoreStatusPanel from './hud/CoreStatusPanel';

interface ChatInterfaceProps {
  character: CharacterData;
  initialHistory: Message[];
  onExit: () => void;
  visualStyle: string;
  userName: string;
  userDescription: string;
  isMultiCharacter?: boolean;
  multiCharacters?: CharacterData[];
}

// 에러 메시지 생성 유틸리티
const getErrorMessage = (error: unknown): { message: string; retryable: boolean } => {
  if (error instanceof GeminiApiError) {
    return { message: error.userMessage, retryable: error.retryable };
  }
  if (error instanceof Error) {
    return { message: error.message || '알 수 없는 오류가 발생했습니다.', retryable: true };
  }
  return { message: '연결 오류가 발생했습니다.', retryable: true };
};

// 마크다운 이미지를 HTML img 태그로 변환
const renderMarkdownImages = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    // 이미지 전 텍스트
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // 이미지 태그
    const alt = match[1] || 'Character image';
    const src = match[2];
    parts.push(
      <img
        key={`img-${keyIndex++}`}
        src={src}
        alt={alt}
        className="max-w-full rounded-xl my-3 border border-white/10 shadow-lg"
        loading="lazy"
      />
    );
    lastIndex = regex.lastIndex;
  }

  // 남은 텍스트
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};

// 메시지 버블 컴포넌트 (메모이제이션 적용)
interface MessageBubbleProps {
  msg: Message;
  isLast: boolean;
  isTyping: boolean;
  onReroll: () => void;
  onChoiceSelect: (choice: string) => void;
}

const MessageBubble = React.memo(({ msg, isLast, isTyping, onReroll, onChoiceSelect }: MessageBubbleProps) => {
  if (msg.type === 'image') {
    return (
      <div className="flex flex-col space-y-3 max-w-2xl">
        <div className="relative group rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
          {msg.imageUrl ? (
            <img src={msg.imageUrl} alt="Generated Scene" className="w-full aspect-video object-cover" />
          ) : (
            <div className="w-full aspect-video bg-slate-800 flex flex-col items-center justify-center p-6 text-center text-[10px] text-slate-500 italic">
              이미지 데이터는 세션 종료 시 사라집니다.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">NEURAL RENDER OUTPUT</span>
        </div>
      </div>
    );
  }

  if (msg.role === 'system') {
    const isError = msg.content.includes('오류') || msg.content.includes('다시 시도') || msg.content.includes('error') || msg.content.includes('Error');
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={`${isError ? 'bg-red-900/20 border-red-500/30 text-red-300' : 'bg-slate-800/30 border-slate-700/50 text-slate-400'} border px-6 py-2 rounded-full text-xs italic`}>
          {msg.content}
        </div>
        {isError && isLast && !isTyping && (
          <button
            onClick={onReroll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white transition-all text-[10px] font-black uppercase border border-red-500/30"
          >
            <i className="fas fa-redo-alt"></i> 다시 시도
          </button>
        )}
      </div>
    );
  }

  if (msg.role === 'user') {
    return <div className="text-lg text-indigo-50 leading-relaxed font-medium">{msg.content}</div>;
  }

  // model role
  const { mainBody, hudData } = useMemo(() => parseModelResponse(msg.content), [msg.content]);

  const renderedContent = renderMarkdownImages(mainBody);
  const hasImages = renderedContent.some(part => typeof part !== 'string');
  const hasHudData = hudData.header || hudData.statusBar || hudData.innerAnalysis || hudData.stateRecord;

  return (
    <div className="flex flex-col space-y-4 group/msg relative">
      <div className={`text-slate-200 text-lg leading-relaxed ${hasImages ? '' : 'whitespace-pre-wrap'}`}>
        {renderedContent.length > 0 ? renderedContent.map((part, i) =>
          typeof part === 'string' ? <span key={i} className="whitespace-pre-wrap">{part}</span> : part
        ) : (isTyping && isLast ? "..." : "")}
      </div>
      {hasHudData && (
        <CoreStatusPanel data={hudData} isStreaming={isTyping && isLast} />
      )}
      {msg.role === 'model' && isLast && !isTyping && hudData.choices && hudData.choices.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {hudData.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => onChoiceSelect(choice)}
              className="text-left px-4 py-3 rounded-xl bg-indigo-950/40 hover:bg-indigo-600/30 text-indigo-200 hover:text-white border border-indigo-500/20 hover:border-indigo-400/40 transition-all text-sm leading-snug"
            >
              <span className="text-indigo-400/60 font-bold mr-2">{i + 1}.</span>
              {choice}
            </button>
          ))}
        </div>
      )}
      {msg.role === 'model' && isLast && !isTyping && (
        <button onClick={onReroll} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white transition-all text-[10px] font-black uppercase border border-slate-700"><i className="fas fa-redo-alt"></i> Regenerate</button>
      )}
    </div>
  );
});

const ChatInterface: React.FC<ChatInterfaceProps> = ({ character, initialHistory, onExit, visualStyle, userName, userDescription, isMultiCharacter = false, multiCharacters = [] }) => {
  const [messages, setMessages] = useState<Message[]>(initialHistory);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saveSession = () => {
      try {
        // StorageService의 압축 기능 사용
        const compressedMessages = StorageService.compressMessages(messages);

        // 메모리 상태도 함께 저장
        const memoryState = geminiService.exportMemoryState();

        const sessionData = {
          character,
          messages: compressedMessages,
          visualStyle,
          userName,
          userDescription,
          memoryState,  // 메모리 상태 추가
          isMultiCharacter,  // 멀티 캐릭터 모드 여부
          multiCharacters: isMultiCharacter ? multiCharacters : undefined,  // 멀티 캐릭터 목록
          sharedScenario: isMultiCharacter ? geminiService.getSharedScenario() : undefined,  // 공유 시나리오
          multiFirstMessage: isMultiCharacter ? geminiService.getMultiFirstMessage() : undefined,  // 멀티 캐릭터 첫 대사
          globalCreatorNotes: geminiService.getGlobalCreatorNotes() || undefined,  // 전체 제작자 노트
          lastUpdated: Date.now()
        };
        StorageService.setItem('gemini_chat_session', JSON.stringify(sessionData));
      } catch (e) {
        console.warn('[Session] 저장 실패:', e);
      }
    };
    saveSession();
  }, [messages, character, visualStyle, userName, userDescription, isMultiCharacter, multiCharacters]);

  // 스크롤 헬퍼 함수
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = async (e?: React.FormEvent, overrideMsg?: string) => {
    if (e) e.preventDefault();
    const userMessage = overrideMsg || input.trim();
    if (!userMessage || isTyping || isGeneratingImage) return;

    if (!overrideMsg) setInput('');
    if (!overrideMsg) setMessages(prev => [...prev, { role: 'user', content: userMessage, type: 'text' }]);

    // 메시지 전송 시 스크롤 (스트리밍 중에는 스크롤하지 않음)
    setTimeout(scrollToBottom, 50);
    
    setIsTyping(true);
    try {
      let fullResponse = "";
      // 현재 메시지 상태를 캡처
      const currentMessages = [...messages, { role: 'user' as const, content: userMessage, type: 'text' as const }];
      setMessages(prev => [...prev, { role: 'model', content: "", type: 'text' }]);

      await geminiService.sendMessageStream(
        userMessage,
        (chunk) => {
          fullResponse += chunk;
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: fullResponse
            };
            return newMessages;
          });
        },
        currentMessages  // 자동 요약을 위해 전체 메시지 히스토리 전달
      );
    } catch (error) {
      // 에러 유형에 따른 메시지 생성
      const { message: errorMessage, retryable } = getErrorMessage(error);
      const displayMessage = retryable
        ? `${errorMessage} 다시 시도해주세요.`
        : errorMessage;

      // 오류 발생 시: 마지막 model 응답 제거 (빈 응답 + 잘린 응답 모두), 유저 메시지는 유지 (재시도를 위해)
      setMessages(prev => {
        const filtered = prev.filter((msg, idx) => {
          if (idx === prev.length - 1 && msg.role === 'model') return false;
          return true;
        });
        return [...filtered, { role: 'system', content: displayMessage, type: 'text' }];
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleReroll = useCallback(async () => {
    if (isTyping || messages.length < 2) return;
    const newHistory = [...messages];
    let lastUserMsg = "";

    // 시스템 메시지(오류)가 있으면 제거
    if (newHistory[newHistory.length - 1].role === 'system') {
      newHistory.pop();
    }

    // 마지막 사용자 메시지 찾기 및 제거 (재전송할 것이므로)
    for (let i = newHistory.length - 1; i >= 0; i--) {
      if (newHistory[i].role === 'user') {
        lastUserMsg = newHistory[i].content;
        newHistory.splice(i, 1); // 사용자 메시지 제거
        break;
      }
    }

    // 일반 리롤의 경우: 마지막 model 응답도 제거
    if (newHistory[newHistory.length - 1]?.role === 'model') {
      newHistory.pop();
      // 그리고 그 앞의 user 메시지 찾기
      for (let i = newHistory.length - 1; i >= 0; i--) {
        if (newHistory[i].role === 'user') {
          lastUserMsg = newHistory[i].content;
          newHistory.splice(i, 1);
          break;
        }
      }
    }

    if (!lastUserMsg) return;
    setMessages(newHistory);

    // 멀티 캐릭터 모드인지에 따라 다른 함수 호출
    if (isMultiCharacter && multiCharacters.length > 0) {
      await geminiService.startNewMultiChat(multiCharacters, userName, userDescription, geminiService.getSharedScenario(), newHistory);
    } else {
      await geminiService.startNewChat(character, userName, userDescription, newHistory);
    }
    handleSend(undefined, lastUserMsg);
  }, [messages, isTyping, character, userName, userDescription, isMultiCharacter, multiCharacters]);

  const handleNewChat = async () => {
    // confirm() 제거: 샌드박스 환경 오작동 방지
    setMessages([{ role: 'system', content: "세션을 초기화 중입니다...", type: 'text' }]);
    setIsTyping(true);
    try {
      if (isMultiCharacter && multiCharacters.length > 0) {
        // 멀티 캐릭터 모드 초기화 - 저장된 첫 대사와 시나리오 사용
        const savedScenario = geminiService.getSharedScenario();
        const savedFirstMessage = geminiService.getMultiFirstMessage();
        const greeting = savedFirstMessage || "이야기가 시작됩니다...";
        const initialHistory: Message[] = [{ role: 'model', content: greeting, type: 'text' }];
        await geminiService.startNewMultiChat(multiCharacters, userName, userDescription, savedScenario, initialHistory);
        setMessages(initialHistory);
      } else {
        // 싱글 캐릭터 모드 초기화
        const koreanGreeting = await geminiService.translateToKorean(character.first_mes);
        const initialHistory: Message[] = [{ role: 'model', content: koreanGreeting, type: 'text' }];
        await geminiService.startNewChat(character, userName, userDescription, initialHistory);
        setMessages(initialHistory);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: "초기화 실패.", type: 'text' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleVisualize = useCallback(async () => {
    if (isGeneratingImage || isTyping) return;
    setIsGeneratingImage(true);
    try {
      const result = await geminiService.generateSceneImage(messages, visualStyle);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `새로운 장면이 렌더링되었습니다.`,
        type: 'image',
        imageUrl: result.url,
        imagePrompt: result.prompt
      }]);
    } catch (err) {
      const { message: errorMessage } = getErrorMessage(err);
      setMessages(prev => [...prev, { role: 'system', content: `이미지 생성 오류: ${errorMessage}`, type: 'text' }]);
    } finally {
      setIsGeneratingImage(false);
    }
  }, [isGeneratingImage, isTyping, messages, visualStyle]);

  const handleChoiceSelect = useCallback((choice: string) => {
    if (isTyping) return;
    setMessages(prev => [...prev, { role: 'user', content: choice, type: 'text' }]);
    handleSend(undefined, choice);
  }, [isTyping, handleSend]);

  // 메시지 렌더링을 위한 콜백 (메모이제이션 적용)
  const renderMessage = useCallback((msg: Message, idx: number, isLast: boolean) => {
    const justifyClass = msg.role === 'user'
      ? 'justify-end'
      : (msg.role === 'system' && msg.type !== 'image' ? 'justify-center' : 'justify-start');
    const bubbleClass = msg.role === 'user'
      ? 'bg-indigo-600/10 border border-indigo-500/20 px-6 py-4 rounded-2xl'
      : '';

    return (
      <div key={idx} className={`flex ${justifyClass}`}>
        <div className={`max-w-[90%] ${bubbleClass}`}>
          <MessageBubble
            msg={msg}
            isLast={isLast}
            isTyping={isTyping}
            onReroll={handleReroll}
            onChoiceSelect={handleChoiceSelect}
          />
        </div>
      </div>
    );
  }, [isTyping, handleReroll, handleChoiceSelect]);

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-[#07080c] shadow-2xl border-x border-slate-800 relative">
      <header className="p-4 bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/50 flex justify-between items-center z-20">
        <div className="flex items-center gap-4">
          {isMultiCharacter ? (
            <>
              <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black">
                <i className="fas fa-users text-sm"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-lg text-white uppercase tracking-tighter">
                    {multiCharacters.slice(0, 2).map(c => c.name).join(' & ')}
                    {multiCharacters.length > 2 && ` +${multiCharacters.length - 2}`}
                  </h2>
                </div>
                <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Multi Character Mode</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black">{character.name[0]}</div>
              <div>
                <h2 className="font-black text-lg text-white uppercase tracking-tighter">{character.name}</h2>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Link</p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleNewChat} disabled={isTyping || isGeneratingImage} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-[10px] font-black uppercase flex items-center gap-2">
            <i className="fas fa-sync-alt"></i> New Chat
          </button>
          <button onClick={handleVisualize} disabled={isGeneratingImage || isTyping} className={`px-4 py-2 rounded-lg border text-[10px] font-black uppercase flex items-center gap-2 ${isGeneratingImage ? 'bg-indigo-600/50 text-white animate-pulse' : 'bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border-indigo-500/20'}`}>
            {isGeneratingImage ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-image"></i>} Visualize
          </button>
          <button onClick={() => setShowPromptModal(true)} className="p-2 text-slate-500 hover:text-white"><i className="fas fa-brain"></i></button>
          <button onClick={onExit} className="p-2 text-slate-500 hover:text-red-500"><i className="fas fa-power-off"></i></button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-12 bg-gradient-to-b from-transparent to-indigo-950/5 custom-scrollbar">
        {messages.map((msg, idx) => renderMessage(msg, idx, idx === messages.length - 1))}
      </div>

      <div className="p-8 bg-[#07080c] border-t border-slate-800/50">
        <form onSubmit={handleSend} className="relative flex items-center gap-4 max-w-4xl mx-auto">
          <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} disabled={isTyping || isGeneratingImage} placeholder="메시지를 입력하세요..." className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5 text-white focus:outline-none focus:border-indigo-500/50 text-lg resize-none shadow-inner" />
          <button type="submit" disabled={!input.trim() || isTyping || isGeneratingImage} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl active:scale-90"><i className="fas fa-arrow-up text-xl"></i></button>
        </form>
      </div>

      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/95 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[80vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-black text-white uppercase tracking-widest italic">Core Logic</h3>
              <button onClick={() => setShowPromptModal(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="flex-1 overflow-auto p-8 font-mono text-xs text-slate-400 whitespace-pre-wrap break-words leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{geminiService.getFormattedPromptForExport()}</div>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }` }} />
    </div>
  );
};

export default ChatInterface;
