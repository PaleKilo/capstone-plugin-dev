---
name: ensure-dashboard
description: "[테스트 전용] meeting 플러그인이 대시보드 꺼짐(종료코드 10, DASHBOARD_DOWN)을 보고했고 사용자가 서버 기동을 원할 때 사용. 승인 후 로컬 서버를 기동하고 원래 작업을 재개한다."
---

# 대시보드 서버 기동 보장 (테스트 전용)

트리거: `meeting` 플러그인 명령이 "대시보드 꺼짐"을 알린 뒤 사용자가 **기동하겠다고 선택**한 경우, 또는 `/meeting-dev:ensure` 호출.

## 원칙
- 자동 기동 금지. 꺼짐을 알린 뒤 **AskUserQuestion 승인**을 받아야만 `start --confirm`을 실행한다.
- 승인 문구에는 실행 명령(`node ./src/middle/server.js`), 작업 폴더, 포트, "인메모리 편집은 초기 상태로 시작"을 포함한다.
- `meeting` 플러그인이 원격 대시보드(Vercel 등)에 연결되어 있으면(코드 25) 기동하지 않고 `/meeting:connect --reset` 안내만 한다.
- 포트가 다른 프로세스에 점유(코드 20)되어 있으면 기동하지 않고 점유 정보를 보고한다.
- 기동 성공 후에는 사용자가 처음 요청한 작업(예: `/meeting:week 45`)을 이어서 실행해 흐름이 끊기지 않게 한다.
- 거절하면 오프라인(`--offline`) 모드를 안내한다.

절차는 `/meeting-dev:ensure` 명령 문서와 동일하며, 모든 동작은 `node "${CLAUDE_PLUGIN_ROOT}/scripts/devserver.mjs"`를 통해서만 수행한다.
