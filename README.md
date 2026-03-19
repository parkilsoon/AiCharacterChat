
# Gemini Character Chat Local

이 프로젝트는 Gemini 3 API를 사용하여 SillyTavern 캐릭터 카드와 대화할 수 있는 웹 애플리케이션입니다.

## 로컬 실행 방법

1. **필수 환경**: Node.js (v18 이상 권장)
2. **설치**:
   ```bash
   npm install
   ```
3. **환경 변수 설정**:
   프로젝트 루트 디렉토리에 `.env` 파일을 만들고 아래 내용을 입력합니다.
   ```env
   VITE_API_KEY=여기에_구글_제미나이_API_키_입력
   ```
4. **실행**:
   ```bash
   npm run dev
   ```
5. **접속**: 
   브라우저에서 `http://localhost:5173`으로 접속합니다.

## 주요 기능
- **ST Card V2/V3 지원**: AICC ID 입력 시 자동으로 PNG 이미지에서 JSON 데이터를 추출합니다.
- **이미지 생성**: 대화 맥락에 맞는 장면을 Gemini 2.5 Flash Image 모델로 자동 생성합니다. (우측 상단 'Scene' 버튼)
- **소설체 출력**: 괄호를 사용한 지문 묘사와 따옴표 대화 형식을 지원합니다.
- **HUD 대시보드**: 캐릭터의 상태, 호감도, 기억을 실시간으로 추적합니다.
