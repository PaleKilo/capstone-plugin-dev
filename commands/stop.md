---
description: "[테스트 전용] 이 도구가 기동한 대시보드 서버(PID 파일)만 종료 (승인 필수)"
allowed-tools: Bash(node:*), AskUserQuestion
---

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/devserver.mjs" stop` (dry-run). 대상이 없으면 "이 도구가 기동한 서버 없음 — 외부 기동 서버는 `/meeting-dev:terminate` 사용"을 안내하고 종료.
2. 대상 PID를 보여주고 AskUserQuestion으로 승인(인메모리 편집 내용이 사라짐을 고지).
3. 승인 시에만 `stop --confirm` 실행 후 결과 보고.
