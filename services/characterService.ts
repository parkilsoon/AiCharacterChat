
import {
  CharacterData,
  CharacterBook,
  LorebookEntry,
  MultiCharacterCard,
  ChubApiResponse,
  ChubCharacterNode,
  ChubCharacterDefinition,
  AllOriginsResponse,
  isChubApiResponse,
  isAllOriginsResponse
} from "../types";

export type ImportStep = 'IDLE' | 'FETCHING' | 'ANALYZING' | 'EXTRACTING' | 'SUCCESS' | 'ERROR';

const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
];

// PNG 캐릭터 데이터 (다양한 필드명 지원)
interface PngCharacterData {
  name?: string;
  char_name?: string;
  description?: string;
  char_persona?: string;
  personality?: string;
  scenario?: string;
  world_scenario?: string;
  first_mes?: string;
  first_message?: string;
  char_greeting?: string;
  mes_example?: string;
  example_dialogs?: string;
  example_dialogue?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: unknown;
  data?: PngCharacterData;
}

// 공통 캐릭터 입력 타입 (다양한 소스를 통합)
type CharacterInput = PngCharacterData & Partial<ChubCharacterDefinition>;

const extractJsonFromPng = (arrayBuffer: ArrayBuffer): PngCharacterData => {
  const view = new DataView(arrayBuffer);
  let offset = 8;

  while (offset < view.byteLength) {
    if (offset + 12 > view.byteLength) break;
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4), view.getUint8(offset + 5),
      view.getUint8(offset + 6), view.getUint8(offset + 7)
    );

    if (type === 'tEXt' || type === 'iTXt') {
      const data = new Uint8Array(arrayBuffer, offset + 8, length);
      let nullIndex = 0;
      while (nullIndex < data.length && data[nullIndex] !== 0) nullIndex++;
      const keyword = new TextDecoder().decode(data.slice(0, nullIndex));
      
      if (keyword === 'chara') {
        let jsonStr = "";
        if (type === 'tEXt') {
          jsonStr = new TextDecoder().decode(data.slice(nullIndex + 1));
        } else {
          let nullCount = 0, textOffset = 0;
          for (let i = 0; i < data.length; i++) {
            if (data[i] === 0 && ++nullCount === 5) { textOffset = i + 1; break; }
          }
          jsonStr = new TextDecoder().decode(data.slice(textOffset));
        }
        const trimmed = jsonStr.trim();
        try { return JSON.parse(atob(trimmed)); } 
        catch { try { return JSON.parse(trimmed); } catch {}}
      }
    }
    offset += length + 12;
  }
  throw new Error("캐릭터 데이터(chara)를 찾을 수 없는 PNG입니다.");
};

// Chub.ai 캐릭터 카드 다운로드 API
const fetchChubDownload = async (fullPath: string): Promise<ChubCharacterDefinition> => {
  // 방법 1: GET 방식 직접 다운로드 (tavern 형식 JSON)
  const jsonUrl = `https://api.chub.ai/api/characters/${fullPath}?full=true`;

  for (const getProxyUrl of PROXIES) {
    try {
      const proxyUrl = getProxyUrl(jsonUrl);
      const response = await fetch(proxyUrl);

      if (!response.ok) continue;

      let data: unknown;
      if (proxyUrl.includes('allorigins')) {
        const result: unknown = await response.json();
        if (!isAllOriginsResponse(result) || !result.contents) continue;
        data = JSON.parse(result.contents);
      } else {
        data = await response.json();
      }

      if (!isChubApiResponse(data)) continue;

      // full=true 응답에서 definition 추출
      const node: ChubCharacterNode = data.node || data;
      if (node.definition) {
        return node.definition;
      }
    } catch (e) {
      continue;
    }
  }
  throw new Error("캐릭터 카드를 다운로드할 수 없습니다.");
};

// Chub.ai URL 또는 fullPath에서 API 경로 추출
const getChubApiUrl = (input: string): string => {
  let fullPath = input.trim();

  // 전체 URL인 경우 fullPath 추출
  if (fullPath.includes('chub.ai/characters/')) {
    fullPath = fullPath.split('chub.ai/characters/')[1];
  }
  // https:// 등 프로토콜만 있는 경우 제거
  fullPath = fullPath.replace(/^https?:\/\//, '');

  if (!fullPath || !fullPath.includes('/')) {
    throw new Error("올바른 Chub.ai 캐릭터 경로가 아닙니다. (예: author/character-name)");
  }

  return `https://api.chub.ai/api/characters/${fullPath}`;
};

export const fetchCharacterById = async (
  input: string,
  onStep?: (step: ImportStep, message?: string) => void
): Promise<CharacterData> => {
  const apiUrl = getChubApiUrl(input);

  onStep?.('FETCHING', 'Chub.ai API 요청 중...');

  // CORS 프록시를 통해 요청
  for (const getProxyUrl of PROXIES) {
    try {
      const proxyUrl = getProxyUrl(apiUrl);
      const response = await fetch(proxyUrl);

      if (!response.ok) continue;

      let data: unknown;
      if (proxyUrl.includes('allorigins')) {
        const result: unknown = await response.json();
        if (!isAllOriginsResponse(result) || !result.contents) continue;
        data = JSON.parse(result.contents);
      } else {
        data = await response.json();
      }

      if (!isChubApiResponse(data)) continue;

      onStep?.('ANALYZING', '캐릭터 데이터 분석 중...');

      // Chub.ai API 응답 구조: { node: { ... } }
      const charNode: ChubCharacterNode = data.node || data;

      // definition이 있으면 직접 사용, 없으면 PNG에서 추출
      if (charNode.definition) {
        onStep?.('SUCCESS', '가져오기 성공!');
        return parseChubCharacter(charNode);
      }

      // Chub.ai 캐릭터 카드 다운로드 API 사용
      const fullPath = charNode.fullPath;
      if (!fullPath) {
        throw new Error("캐릭터 경로를 찾을 수 없습니다.");
      }

      onStep?.('EXTRACTING', '캐릭터 카드 다운로드 중...');

      // Chub.ai 다운로드 API: /api/characters/download
      const downloadData = await fetchChubDownload(fullPath);

      onStep?.('SUCCESS', '가져오기 성공!');
      return parseCharacterJson(downloadData);
    } catch (e) {
      continue;
    }
  }

  throw new Error("캐릭터를 가져올 수 없습니다. URL을 확인해주세요.");
};

// Lorebook 엔트리 원시 타입
interface RawLorebookEntry {
  keys?: string[];
  key?: string | string[];
  content?: string;
  text?: string;
  enabled?: boolean;
  case_sensitive?: boolean;
  name?: string;
  comment?: string;
}

// character_book 파싱
const parseCharacterBook = (book: unknown): CharacterBook | undefined => {
  if (!book || typeof book !== 'object') return undefined;

  const bookObj = book as Record<string, unknown>;
  // entries 배열 추출 (다양한 형식 지원)
  const rawEntries = bookObj.entries || book;

  if (!Array.isArray(rawEntries) && typeof rawEntries === 'object' && rawEntries !== null) {
    // entries가 객체인 경우 (key-value 형태)
    const entryValues = Object.values(rawEntries) as RawLorebookEntry[];
    const entries: LorebookEntry[] = entryValues.map((entry) => ({
      keys: entry.keys || (Array.isArray(entry.key) ? entry.key : entry.key ? [entry.key] : []),
      content: entry.content || entry.text || "",
      enabled: entry.enabled !== false,
      case_sensitive: entry.case_sensitive || false,
      name: entry.name || entry.comment || ""
    })).filter((e: LorebookEntry) => e.keys.length > 0 && e.content);

    return entries.length > 0 ? { entries } : undefined;
  }

  if (Array.isArray(rawEntries)) {
    const entries: LorebookEntry[] = (rawEntries as RawLorebookEntry[]).map((entry) => ({
      keys: Array.isArray(entry.keys) ? entry.keys : (entry.key ? (Array.isArray(entry.key) ? entry.key : [entry.key]) : []),
      content: entry.content || entry.text || "",
      enabled: entry.enabled !== false,
      case_sensitive: entry.case_sensitive || false,
      name: entry.name || entry.comment || ""
    })).filter((e: LorebookEntry) => e.keys.length > 0 && e.content);

    return entries.length > 0 ? { entries } : undefined;
  }

  return undefined;
};

// Chub.ai API 응답 파싱
const parseChubCharacter = (node: ChubCharacterNode): CharacterData => {
  // Chub.ai는 definition 필드에 캐릭터 데이터를 저장
  const def: ChubCharacterDefinition = node.definition || {};

  return {
    name: node.name || def.name || "Unknown",
    description: def.description || "",
    personality: def.personality || "",
    scenario: def.scenario || "",
    first_mes: def.first_mes || def.greeting || "Hello!",
    mes_example: def.mes_example || def.example_dialogs || "",
    creator_notes: def.creator_notes || node.tagline || "",
    system_prompt: def.system_prompt || "",
    post_history_instructions: def.post_history_instructions || "",
    alternate_greetings: def.alternate_greetings || [],
    character_book: parseCharacterBook(def.character_book)
  };
};

export const parseCharacterJson = (json: CharacterInput): CharacterData => {
  const char: CharacterInput = ('data' in json && json.data) ? json.data : json;
  return {
    name: char.name || char.char_name || "Unknown",
    description: char.description || char.char_persona || "",
    personality: char.personality || "",
    scenario: char.scenario || char.world_scenario || "",
    // Chub.ai: first_message, 표준: first_mes
    first_mes: char.first_mes || char.first_message || char.char_greeting || "Hello!",
    // Chub.ai: example_dialogs, 표준: mes_example
    mes_example: char.mes_example || char.example_dialogs || char.example_dialogue || "",
    creator_notes: char.creator_notes || "",
    system_prompt: char.system_prompt || "",
    post_history_instructions: char.post_history_instructions || "",
    alternate_greetings: char.alternate_greetings || [],
    character_book: parseCharacterBook(char.character_book)
  };
};

// 멀티 캐릭터 JSON 입력 타입
interface MultiCharacterJsonInput {
  spec?: string;
  characters?: Array<{
    name?: string;
    description?: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
  }>;
  shared_scenario?: string;
  first_message?: string;
}

// 멀티 캐릭터 JSON 파싱
export const parseMultiCharacterJson = (json: MultiCharacterJsonInput): { characters: CharacterData[], sharedScenario: string, firstMessage: string } | null => {
  // 멀티 캐릭터 포맷 확인
  if (json.spec === "chara_card_v2_multi" && Array.isArray(json.characters)) {
    const characters: CharacterData[] = json.characters.map((char) => ({
      name: char.name || "Unknown",
      description: char.description || "",
      personality: char.personality || "",
      scenario: char.scenario || "",
      first_mes: char.first_mes || "",
      mes_example: char.mes_example || "",
      creator_notes: char.creator_notes || "",
      system_prompt: char.system_prompt || "",
      post_history_instructions: char.post_history_instructions || "",
      alternate_greetings: char.alternate_greetings || []
    }));

    return {
      characters,
      sharedScenario: json.shared_scenario || "",
      firstMessage: json.first_message || ""
    };
  }

  return null;
};

// JSON이 멀티 캐릭터 포맷인지 확인
export const isMultiCharacterJson = (json: unknown): json is MultiCharacterJsonInput => {
  if (typeof json !== 'object' || json === null) return false;
  const obj = json as Record<string, unknown>;
  return obj.spec === "chara_card_v2_multi" && Array.isArray(obj.characters);
};
