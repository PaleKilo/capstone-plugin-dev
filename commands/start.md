---
description: "[테스트 전용] 대시보드 서버 기동 (승인 필수)"
allowed-tools: Bash(node:*), AskUserQuestion
---

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/devserver.mjs" start` (dry-run) 로 상태 확인. **종료코드 25**(meeting 플러그인이 원격 대시보드에 연결됨)이면 로컬 서버를 켜지 말고 `/meeting:connect --reset` 또는 로컬 주소로 재연결을 안내한 뒤 중단. 이미 실행 중이면 알리고 종료, 코드 20(포트 충돌)이면 점유 프로세스 정보를 보고하고 중단.
2. AskUserQuestion으로 승인("서버를 시작할까요? 실행: node ./src/middle/server.js, 포트 …").
3. 승인 시에만 같은 명령에 `--confirm`을 붙여 실행하고, 결과(PID, 주소, 로그 경로)를 보고. 승인 없이 기동 금지.
