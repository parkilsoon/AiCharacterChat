
import React, { useState, useEffect } from 'react';
import { CharacterData, AppState, Message } from './types';
import CharacterLoader from './components/CharacterLoader';
import ChatInterface from './components/ChatInterface';
import { geminiService } from './services/geminiService';
import { StorageService } from './services/storageService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IMPORT);
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [userName, setUserName] = useState('');
  const [userDescription, setUserDescription] = useState('');
  const [visualStyle, setVisualStyle] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // 멀티 캐릭터 상태
  const [isMultiCharacter, setIsMultiCharacter] = useState(false);
  const [multiCharacters, setMultiCharacters] = useState<CharacterData[]>([]);

  useEffect(() => {
    const init = async () => {
      const saved = StorageService.getItem('gemini_chat_session');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.character && parsed.messages) {
            setCharacter(parsed.character);
            setHistory(parsed.messages);
            setVisualStyle(parsed.visualStyle || '');
            setUserName(parsed.userName || '');
            setUserDescription(parsed.userDescription || '');

            // 메모리 상태 복원 (있는 경우)
            if (parsed.memoryState) {
              geminiService.importMemoryState(parsed.memoryState);
            }

            // 전체 제작자 노트 복원
            const savedGlobalNotes = parsed.globalCreatorNotes || '';
            if (savedGlobalNotes) {
              geminiService.setGlobalCreatorNotes(savedGlobalNotes);
            }

            // 멀티 캐릭터 모드 복원
            if (parsed.isMultiCharacter && parsed.multiCharacters) {
              setIsMultiCharacter(true);
              setMultiCharacters(parsed.multiCharacters);
              // 저장된 시나리오와 첫 대사를 서비스에 먼저 설정 (복원 보장)
              const savedScenario = parsed.sharedScenario || '';
              if (savedScenario) {
                geminiService.setSharedScenario(savedScenario);
              }
              if (parsed.multiFirstMessage) {
                geminiService.setMultiFirstMessage(parsed.multiFirstMessage);
              }
              await geminiService.startNewMultiChat(
                parsed.multiCharacters,
                parsed.userName,
                parsed.userDescription,
                savedScenario,
                parsed.messages,
                savedGlobalNotes
              );
            } else {
              // 싱글 캐릭터 모드
              await geminiService.startNewChat(parsed.character, parsed.userName, parsed.userDescription, parsed.messages, savedGlobalNotes);
            }
            setAppState(AppState.CHAT);
          }
        } catch (e) {
          StorageService.removeItem('gemini_chat_session');
        }
      }
      setIsInitializing(false);
    };

    init();
  }, []);

  const handleCharacterLoaded = async (data: CharacterData, name: string, description: string, style: string, globalNotes: string) => {
    setCharacter(data);
    setUserName(name);
    setUserDescription(description);
    setVisualStyle(style);
    setIsMultiCharacter(false);
    setMultiCharacters([]);

    try {
      // 1. 번역 단계
      const koreanGreeting = await geminiService.translateToKorean(data.first_mes, data.name, name);
      const initialHistory: Message[] = [{ role: 'model', content: koreanGreeting, type: 'text' }];
      setHistory(initialHistory);

      // 2. 채팅 세션 및 비주얼 프로필 생성 단계
      await geminiService.startNewChat(data, name, description, initialHistory, globalNotes);

      setAppState(AppState.CHAT);
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
    }
  };

  // 멀티 캐릭터 로드 핸들러
  const handleMultiCharacterLoaded = async (
    chars: CharacterData[],
    name: string,
    description: string,
    style: string,
    sharedScenario: string,
    firstMessage: string,
    globalNotes: string
  ) => {
    setCharacter(chars[0]); // 대표 캐릭터 설정
    setMultiCharacters(chars);
    setIsMultiCharacter(true);
    setUserName(name);
    setUserDescription(description);
    setVisualStyle(style);

    try {
      // 첫 대사 번역 (또는 그대로 사용)
      let greeting = firstMessage;
      if (firstMessage && !firstMessage.match(/[\uAC00-\uD7AF]/)) {
        // 한글이 없으면 번역
        greeting = await geminiService.translateToKorean(firstMessage, chars[0].name, name);
      }

      const initialHistory: Message[] = [{ role: 'model', content: greeting || "이야기가 시작됩니다...", type: 'text' }];
      setHistory(initialHistory);

      // 멀티 캐릭터 채팅 세션 시작
      await geminiService.startNewMultiChat(chars, name, description, sharedScenario, initialHistory, globalNotes);

      setAppState(AppState.CHAT);
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
    }
  };

  const handleExitChat = () => {
    StorageService.removeItem('gemini_chat_session');
    geminiService.resetMemoryState();  // 메모리 상태도 초기화
    setAppState(AppState.IMPORT);
    setCharacter(null);
    setHistory([]);
    setUserName('');
    setUserDescription('');
    setIsMultiCharacter(false);
    setMultiCharacters([]);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center text-indigo-400 font-bold tracking-widest text-xs animate-pulse">
        CONNECTING TO NEURAL NETWORK...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080c]">
      {appState === AppState.IMPORT ? (
        <div className="flex flex-col items-center justify-center p-4 min-h-screen">
          <header className="py-10 text-center">
            <h1 className="text-5xl font-black text-white italic tracking-tighter mb-2">GEMINI CHAT</h1>
            <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em]">Character Card Interaction Engine</p>
          </header>
          <CharacterLoader onLoaded={handleCharacterLoaded} onMultiLoaded={handleMultiCharacterLoaded} />
        </div>
      ) : (
        character && (
          <ChatInterface
            character={character}
            initialHistory={history}
            userName={userName}
            userDescription={userDescription}
            onExit={handleExitChat}
            visualStyle={visualStyle}
            isMultiCharacter={isMultiCharacter}
            multiCharacters={multiCharacters}
          />
        )
      )}
    </div>
  );
};

export default App;
