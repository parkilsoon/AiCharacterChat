#!/usr/bin/env node

import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

const API_KEY = "AIzaSyBVMCSgk5wzRZ4FWrDWfbqi1vZy7I4z4Yg";
const INPUT_FILE = "/Users/kizuato/Downloads/The.Outpost.2020.1080p.WEBRip.X264.DD.5.1-EVO[EtHD].srt";
const OUTPUT_FILE = "/Users/kizuato/Downloads/The.Outpost.2020.1080p.WEBRip.X264.DD.5.1-EVO[EtHD].kor.srt";

const ai = new GoogleGenAI({ apiKey: API_KEY });

// SRT 파싱: 자막 블록 단위로 분리
function parseSRT(content) {
  const blocks = content.trim().split(/\n\s*\n/);
  return blocks.map(block => {
    const lines = block.split('\n');
    if (lines.length < 2) return null;

    const index = lines[0].trim();
    const timestamp = lines[1].trim();
    const text = lines.slice(2).join('\n').trim();

    return { index, timestamp, text };
  }).filter(Boolean);
}

// SRT 재조립
function buildSRT(entries) {
  return entries.map(e => `${e.index}\n${e.timestamp}\n${e.text}`).join('\n\n');
}

// 배치 번역 (여러 자막을 한 번에)
async function translateBatch(texts, retryCount = 0) {
  const maxRetries = 3;
  const numbered = texts.map((t, i) => `[${i}] ${t}`).join('\n');

  const prompt = `Translate these Indonesian/English movie subtitles to natural Korean.
Keep the [number] prefix for each line. Return ONLY the translations, one per line.
Do not add any explanation.

${numbered}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const result = response.text || "";
    const translated = [];

    // 번역 결과 파싱
    for (let i = 0; i < texts.length; i++) {
      const regex = new RegExp(`\\[${i}\\]\\s*(.+?)(?=\\[${i+1}\\]|$)`, 's');
      const match = result.match(regex);
      if (match) {
        translated.push(match[1].trim());
      } else {
        // 매칭 실패시 원문 유지
        translated.push(texts[i]);
      }
    }

    return translated;
  } catch (e) {
    if (retryCount < maxRetries) {
      console.log(`  재시도 중... (${retryCount + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
      return translateBatch(texts, retryCount + 1);
    }
    console.error(`번역 실패, 원문 유지:`, e.message);
    return texts;
  }
}

async function main() {
  console.log("=== SRT 자막 한글 번역기 ===\n");

  // 파일 읽기
  console.log(`입력 파일: ${INPUT_FILE}`);
  const content = fs.readFileSync(INPUT_FILE, 'utf-8');

  // 파싱
  const entries = parseSRT(content);
  console.log(`총 ${entries.length}개 자막 블록 발견\n`);

  // 배치 크기 (API 제한 고려)
  const BATCH_SIZE = 20;
  const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

  console.log(`배치 크기: ${BATCH_SIZE}, 총 ${totalBatches}개 배치\n`);

  // 번역 진행
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = entries.slice(i, i + BATCH_SIZE);
    const texts = batch.map(e => e.text);

    process.stdout.write(`[${batchNum}/${totalBatches}] 번역 중... `);

    const translated = await translateBatch(texts);

    // 결과 적용
    for (let j = 0; j < batch.length; j++) {
      entries[i + j].text = translated[j] || batch[j].text;
    }

    console.log(`완료 (${i + batch.length}/${entries.length})`);

    // API 레이트 리밋 방지
    if (i + BATCH_SIZE < entries.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // 결과 저장
  const output = buildSRT(entries);
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');

  console.log(`\n=== 완료 ===`);
  console.log(`출력 파일: ${OUTPUT_FILE}`);
}

main().catch(console.error);
