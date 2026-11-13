---
description: "[테스트 전용] 온라인 상태의 대시보드 서버를 기동 주체와 무관하게 종료 (대상 검증 + 승인 필수)"
allowed-tools: Bash(node:*), AskUserQuestion
---

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/devserver.mjs" terminate` (dry-run) 실행.
   - "이미 꺼져 있습니다" → 그대로 보고하고 종료.
   - 코드 22(TARGET_MISMATCH) → 포트를 점유한 프로세스가 대시보드 서버로 확인되지 않음. 프로세스 정보를 보여주고 **종료하지 않고** 중단.
2. 검증 통과 시 대상(PID, 커맨드라인)을 보여주고 AskUserQuestion으로 승인 요청. 문구에 **"강제 종료되며 인메모리 편집 내용이 모두 사라집니다"**를 포함.
3. 승인 시에만 `terminate --confirm` 실행. 코드 23이면 원인(권한 등)을 보고.
4. 성공 후 안내: 이제 `/meeting:status`는 "꺼짐"을 보고하며, `/meeting-dev:ensure`로 다시 켜거나 `--offline`으로 스냅샷을 읽을 수 있음.
