
export interface CharacterData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: CharacterBook;
}

// Lorebook (Character Book) 타입
export interface LorebookEntry {
  keys: string[];           // 트리거 키워드들
  content: string;          // 주입할 내용
  enabled: boolean;         // 활성화 여부
  case_sensitive?: boolean; // 대소문자 구분
  name?: string;            // 엔트리 이름 (선택)
}

export interface CharacterBook {
  entries: LorebookEntry[];
}

export interface CharacterCardV2 {
  spec: "chara_card_v2" | "chara_card_v3";
  spec_version?: string;
  data: CharacterData;
}

// 멀티 캐릭터 카드 타입
export interface MultiCharacterCard {
  spec: "chara_card_v2_multi";
  spec_version: string;
  shared_scenario: string;
  first_message: string;
  characters: CharacterData[];
}

// 멀티 캐릭터 세션 데이터
export interface MultiCharacterSession {
  characters: CharacterData[];
  sharedScenario: string;
  isMultiCharacter: true;
}

export interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  type?: 'text' | 'image';
  imageUrl?: string;
  imagePrompt?: string;
}

// Memory Latch 시스템 타입
export interface MemoryLatch {
  // 현재 상태
  status: string;           // 캐릭터의 현재 상태
  innerMonologue: string;   // 내적 독백
  npcActivity: string;      // NPC 활동
  relationship: string;     // 관계 인식
  affection: number;        // 호감도 (0-100)

  // 확장 상태 (선택적)
  location?: string;        // 현재 위치
  dateTime?: string;        // 게임 내 시간
  weather?: string;         // 날씨
  hp?: number;              // 체력
  arousal?: number;         // 흥분도
  pain?: number;            // 고통
  sanity?: number;          // 이성

  // 장기 기억
  keyMemories?: string[];   // 중요 기억들
  lastSummary?: string;     // 마지막 요약
  turnCount?: number;       // 턴 카운트

  // 감정 관성 추적
  emotionalState?: string;       // 현재 주요 감정 (심리상태 키워드)
  emotionalIntensity?: number;   // 감정 강도 (0~100)
}

export interface MemoryState {
  latch: MemoryLatch;
  longTermMemory: string[];  // 장기 기억 저장소 (미사용)
  summaryHistory: string[];  // 요약 히스토리 (미사용, 하위 호환용)
  eventMemories: string[];   // 이벤트 기억 (메모 필드에서 수집, 10턴마다 요약)
  summarizedMemories: string[];  // 요약된 장기 기억 (10턴마다 누적)
  conversationSummaries: string[];  // 윈도우 밖 대화 요약 (슬라이딩 윈도우 탈락 시 자동 생성)
  lastSummaryTurn: number;   // 마지막 요약 시점의 턴 수
  lastSummarizedIndex: number;  // 마지막으로 요약된 메시지 인덱스 (중복 요약 방지)
}

export enum AppState {
  IMPORT = 'IMPORT',
  CHAT = 'CHAT'
}

// ===== API Error Types =====

export type GeminiErrorCode =
  | 'NETWORK'
  | 'RATE_LIMIT'
  | 'SAFETY_FILTER'
  | 'INVALID_KEY'
  | 'QUOTA_EXCEEDED'
  | 'CONTENT_BLOCKED'
  | 'MODEL_OVERLOADED'
  | 'UNKNOWN';

export class GeminiApiError extends Error {
  public readonly code: GeminiErrorCode;
  public readonly originalError?: Error;
  public readonly retryable: boolean;
  public readonly userMessage: string;

  constructor(
    code: GeminiErrorCode,
    message: string,
    userMessage: string,
    options?: { originalError?: Error; retryable?: boolean }
  ) {
    super(message);
    this.name = 'GeminiApiError';
    this.code = code;
    this.userMessage = userMessage;
    this.originalError = options?.originalError;
    this.retryable = options?.retryable ?? false;
  }
}

// ===== Chub.ai API Response Types =====

export interface ChubCharacterDefinition {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  first_message?: string;
  greeting?: string;
  mes_example?: string;
  example_dialogs?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: unknown;
}

export interface ChubCharacterNode {
  name?: string;
  fullPath?: string;
  tagline?: string;
  definition?: ChubCharacterDefinition;
}

export interface ChubApiResponse {
  node?: ChubCharacterNode;
  // fallback: response itself can be the node
  name?: string;
  fullPath?: string;
  definition?: ChubCharacterDefinition;
}

export interface AllOriginsResponse {
  contents?: string;
  status?: { http_code: number };
}

// ===== Type Guards =====

export function isValidCharacterData(data: unknown): data is CharacterData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    obj.name.length > 0 &&
    typeof obj.description === 'string' &&
    typeof obj.personality === 'string' &&
    typeof obj.scenario === 'string' &&
    typeof obj.first_mes === 'string'
  );
}

export function isChubApiResponse(data: unknown): data is ChubApiResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  // Either has node property or is a node itself (has definition or name/fullPath)
  return (
    typeof obj.node === 'object' ||
    typeof obj.definition === 'object' ||
    (typeof obj.name === 'string' && typeof obj.fullPath === 'string')
  );
}

export function isAllOriginsResponse(data: unknown): data is AllOriginsResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return 'contents' in obj;
}
