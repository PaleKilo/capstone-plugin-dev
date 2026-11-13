---
description: "[테스트 전용] 대시보드 서버가 꺼져 있으면 알리고, 승인 후 기동한 뒤 원래 작업을 이어서 실행"
argument-hint: "[이어서 실행할 meeting 명령, 예: /meeting:week 45]"
allowed-tools: Bash(node:*), AskUserQuestion
---

이어서 실행할 작업: $ARGUMENTS

ensure-dashboard 스킬 절차를 그대로 수행하세요.

0. 먼저 `meeting` 플러그인이 **원격 대시보드(Vercel 등)에 연결**되어 있으면(`devserver.mjs status` 의 `remoteTarget` 값, 또는 start 의 종료코드 25) 로컬 서버를 켜지 말고 "원격 주소에 연결되어 있어 로컬 서버 기동은 필요하지 않습니다"라고 알린 뒤, 로컬을 쓰려면 `/meeting:connect --reset` 또는 `/meeting:connect http://127.0.0.1:<포트>` 를 안내하고 중단하세요.
1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/devserver.mjs" status`
   - `online:true` → "이미 켜져 있습니다"를 알리고 4번으로.
   - `listener`가 있는데 `online:false` → 포트 충돌. 다른 프로세스의 정보를 보여주고 **기동하지 않고** 중단.
2. 꺼짐 확정 → 사용자에게 **"대시보드 서버가 꺼져 있습니다"**를 알리고 AskUserQuestion으로 승인 요청. 문구에 실행 내용(`node ./src/middle/server.js`, 작업 폴더, 포트)과 "재시작 시 인메모리 편집은 초기 상태"를 포함. 선택지: 기동 / 오프라인으로 계속 / 취소.
3. 승인 시에만 `... devserver.mjs start --confirm` 실행(내부적으로 최대 15초 대기). 코드 21이면 `logTail`을 보여주고 중단. 거절이면 `/meeting:*` 명령을 `--offline`으로 안내.
4. 기동 성공 시 `$ARGUMENTS`의 원래 작업을 이어서 수행(`/meeting:status`로 연결 확인 후 요청 실행).
