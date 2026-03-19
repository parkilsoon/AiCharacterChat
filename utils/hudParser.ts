
export interface HudHeader {
  date: string;
  time: string;
  location: string;
  weather: string;
  relationship: string;
}

export interface StatusBar {
  hp: number;
  arousal: number;
  pain: number;
  sanity: number;
}

export interface EmotionFlow {
  previous: string;
  current: string;
  reason: string;
}

export interface InnerAnalysis {
  physicalState: string | null;
  emotionFlow: EmotionFlow | null;
  userInterpretation: string;
  innerThought: string;
  impulse: string;
  reactionDecision: string;
}

export interface StateRecord {
  currentGoal: string;
  psychologicalState: string;
  emotionIntensity: number;
  memos: string[];
}

export interface ParsedHudData {
  header: HudHeader | null;
  statusBar: StatusBar | null;
  innerAnalysis: InnerAnalysis | null;
  stateRecord: StateRecord | null;
  choices: string[] | null;
  rawText: string;
}

export interface ParseResult {
  mainBody: string;
  hudData: ParsedHudData;
}

function parseHudHeader(text: string): { header: HudHeader | null; cleaned: string } {
  const match = text.match(/>\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)/);
  if (!match) return { header: null, cleaned: text };

  const header: HudHeader = {
    date: match[1].trim(),
    time: match[2].trim(),
    location: match[3].trim(),
    weather: match[4].trim(),
    relationship: match[5].trim(),
  };

  const cleaned = text.replace(match[0], '').trim();
  return { header, cleaned };
}

function parseStatusBar(text: string): { statusBar: StatusBar | null; cleaned: string } {
  const match = text.match(/\[\]\(체력:(\d+)\|흥분:(\d+)\|고통:(\d+)\|이성:(\d+)\)/);
  if (!match) return { statusBar: null, cleaned: text };

  const statusBar: StatusBar = {
    hp: parseInt(match[1], 10),
    arousal: parseInt(match[2], 10),
    pain: parseInt(match[3], 10),
    sanity: parseInt(match[4], 10),
  };

  const cleaned = text.replace(match[0], '').trim();
  return { statusBar, cleaned };
}

function parseEmotionFlow(line: string): EmotionFlow | null {
  // 감정연속성: 경계 → 약간 호의적 [친근한 인사에 반응]
  const match = line.match(/감정연속성:\s*(.+?)\s*[→➡>]\s*(.+?)(?:\s*[\[【](.+?)[\]】])?$/);
  if (!match) return null;
  return {
    previous: match[1].trim(),
    current: match[2].trim(),
    reason: match[3]?.trim() || '',
  };
}

function parseInnerAnalysis(block: string): InnerAnalysis | null {
  const section = extractSection(block, '내면 분석');
  if (!section) return null;

  const lines = section.split('\n');
  let physicalState: string | null = null;
  let emotionFlow: EmotionFlow | null = null;
  let userInterpretation = '';
  let innerThought = '';
  let impulse = '';
  let reactionDecision = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('신체상태:')) {
      physicalState = trimmed.replace('신체상태:', '').trim();
    } else if (trimmed.startsWith('감정연속성:')) {
      emotionFlow = parseEmotionFlow(trimmed);
    } else if (trimmed.startsWith('유저발언해석:')) {
      userInterpretation = trimmed.replace('유저발언해석:', '').trim();
    } else if (trimmed.startsWith('속마음:')) {
      innerThought = trimmed.replace('속마음:', '').trim();
    } else if (trimmed.startsWith('충동:')) {
      impulse = trimmed.replace('충동:', '').trim();
    } else if (trimmed.startsWith('반응결정:')) {
      reactionDecision = trimmed.replace('반응결정:', '').trim();
    }
  }

  if (!physicalState && !emotionFlow && !userInterpretation && !innerThought && !reactionDecision) {
    return null;
  }

  return { physicalState, emotionFlow, userInterpretation, innerThought, impulse, reactionDecision };
}

function parseStateRecord(block: string): StateRecord | null {
  const section = extractSection(block, '상태 기록');
  if (!section) return null;

  const lines = section.split('\n');
  let currentGoal = '';
  let psychologicalState = '';
  let emotionIntensity = 0;
  const memos: string[] = [];
  let inMemos = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('현재목표:')) {
      currentGoal = trimmed.replace('현재목표:', '').trim();
      inMemos = false;
    } else if (trimmed.startsWith('심리상태:')) {
      psychologicalState = trimmed.replace('심리상태:', '').trim();
      inMemos = false;
    } else if (trimmed.startsWith('감정강도:')) {
      const num = trimmed.match(/(\d+)/);
      emotionIntensity = num ? parseInt(num[1], 10) : 0;
      inMemos = false;
    } else if (trimmed.startsWith('메모:')) {
      inMemos = true;
      const inline = trimmed.replace('메모:', '').trim();
      if (inline && inline !== '-') memos.push(inline);
    } else if (inMemos && trimmed.startsWith('-')) {
      const memo = trimmed.replace(/^-\s*/, '').trim();
      if (memo) memos.push(memo);
    } else if (inMemos && trimmed === '') {
      inMemos = false;
    }
  }

  if (!currentGoal && !psychologicalState && emotionIntensity === 0 && memos.length === 0) {
    return null;
  }

  return { currentGoal, psychologicalState, emotionIntensity, memos };
}

function parseChoices(block: string): string[] | null {
  const section = extractSection(block, '선택지');
  if (!section) return null;

  const choices: string[] = [];
  const lines = section.split('\n');
  for (const line of lines) {
    const match = line.trim().match(/^[1-3]\.\s*(.+)/);
    if (match) {
      choices.push(match[1].trim());
    }
  }

  return choices.length >= 2 ? choices : null;
}

function extractSection(block: string, sectionName: string): string | null {
  const regex = new RegExp(`\\[${sectionName}\\]([\\s\\S]*?)(?=\\[|$)`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

export function parseModelResponse(content: string): ParseResult {
  // Extract code block
  let codeBlock = '';
  const mainWithoutCode = content.replace(/```([\s\S]*?)```/g, (_, p1) => {
    codeBlock = p1.trim();
    return '';
  });

  // Parse HUD header from main body
  const { header, cleaned: afterHud } = parseHudHeader(mainWithoutCode);

  // Parse status bar from main body
  const { statusBar, cleaned: mainBody } = parseStatusBar(afterHud);

  // Parse code block sections
  const innerAnalysis = codeBlock ? parseInnerAnalysis(codeBlock) : null;
  const stateRecord = codeBlock ? parseStateRecord(codeBlock) : null;
  const choices = codeBlock ? parseChoices(codeBlock) : null;

  return {
    mainBody: mainBody.trim(),
    hudData: {
      header,
      statusBar,
      innerAnalysis,
      stateRecord,
      choices,
      rawText: codeBlock,
    },
  };
}
