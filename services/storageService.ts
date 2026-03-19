
import { Message } from '../types';

/**
 * StorageService
 * 브라우저 환경에 따라 localStorage 접근이 차단될 수 있습니다.
 * 최소한의 코드로 메모리 폴백을 지원합니다.
 */

const memoryStore: Record<string, string> = {};

// localStorage 용량 관련 상수
const MAX_MESSAGE_COUNT = 100; // 저장할 최대 메시지 수
const IMAGE_PRESERVE_COUNT = 10; // 이미지 URL을 유지할 최근 메시지 수

export const StorageService = {
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // QuotaExceededError 처리
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        console.warn('[Storage] 용량 초과, 오래된 데이터 정리 시도');
        this.cleanupOldData();
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // 정리 후에도 실패하면 메모리에 저장
          memoryStore[key] = value;
        }
      } else {
        memoryStore[key] = value;
      }
    }
  },

  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return memoryStore[key] || null;
    }
  },

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      delete memoryStore[key];
    }
  },

  /**
   * 오래된 데이터 정리
   * 캐시 데이터를 우선적으로 제거
   */
  cleanupOldData(): void {
    try {
      // 캐시 키들을 먼저 정리
      const cacheKeys = [
        'gemini_visual_cache',
        'gemini_translation_cache',
        'gemini_summary_cache'
      ];
      cacheKeys.forEach(key => {
        window.localStorage.removeItem(key);
      });
      console.log('[Storage] 캐시 데이터 정리 완료');
    } catch (e) {
      console.warn('[Storage] 정리 실패:', e);
    }
  },

  /**
   * 메시지 히스토리 압축
   * - 오래된 메시지의 이미지 URL 제거
   * - 최대 메시지 수 제한
   */
  compressMessages(messages: Message[]): Message[] {
    // 최대 개수 제한
    const limited = messages.slice(-MAX_MESSAGE_COUNT);

    // 오래된 메시지의 이미지 URL 제거 (최근 N개는 유지)
    return limited.map((msg, idx) => {
      const isRecent = idx >= limited.length - IMAGE_PRESERVE_COUNT;
      if (!isRecent && msg.imageUrl) {
        return { ...msg, imageUrl: undefined };
      }
      return msg;
    });
  },

  /**
   * 저장 용량 확인 (대략적)
   */
  getUsedSpace(): { used: number; available: number; percentage: number } {
    try {
      let total = 0;
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          const value = window.localStorage.getItem(key);
          total += (key.length + (value?.length || 0)) * 2; // UTF-16
        }
      }
      // localStorage는 보통 5MB (5 * 1024 * 1024 = 5242880 bytes)
      const maxSize = 5 * 1024 * 1024;
      return {
        used: total,
        available: maxSize - total,
        percentage: Math.round((total / maxSize) * 100)
      };
    } catch {
      return { used: 0, available: 0, percentage: 0 };
    }
  }
};
