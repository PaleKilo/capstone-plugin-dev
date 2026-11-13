---
description: "[테스트 전용] meeting-dev 도구 사용법과 전체 테스트 워크플로우 안내"
---

아래를 한국어로 안내하세요.

## meeting-dev (테스트 전용)
로컬 루프백(`127.0.0.1`)에서 대시보드 서버를 테스트하기 위한 도구입니다. **Dataiku 전환 시 이 플러그인을 삭제**하세요(정규 `meeting` 플러그인에는 기동 코드가 없습니다).

| 명령 | 동작 | 승인 |
| :-- | :-- | :-- |
| `/meeting-dev:ensure [이어갈 작업]` | 꺼짐 확인 → 알림 → 승인 → 기동 → 대기 → 원래 작업 재개 | 필수 |
| `/meeting-dev:start` | 서버 기동 | 필수 |
| `/meeting-dev:stop` | 이 도구가 띄운 서버(PID 파일)만 종료 | 필수 |
| `/meeting-dev:terminate` | 온라인 서버를 기동 주체와 무관하게 종료(대상이 `node src/middle/server.js`인지 검증) | 필수 |
| `/meeting-dev:help` | 이 안내 | - |

## 전체 테스트 사이클
```
서버 꺼짐 ──/meeting:week 45──▶ "꺼져 있습니다" 알림
   │                                 │ (a) 오프라인으로 계속
   │                                 └─(b) /meeting-dev:ensure ─ 승인 ─▶ 기동·대기 ─▶ 원래 작업 재개 (온라인)
온라인 작업 (/meeting:week, :ask, :compare, :edit)
   └─ /meeting-dev:terminate ─ 승인 ─▶ 서버 종료 ─▶ 꺼짐 상태 동작 재확인
```

## 안전장치
- 모든 기동/종료는 사용자 승인 후 `--confirm`으로만 실행(그 전에는 dry-run).
- terminate는 포트 소유 프로세스가 대시보드 서버로 확인될 때만 종료(코드 22로 오종료 방지). 창 없는 node는 강제 종료(`/F`)되며, 이 서버는 인메모리 전용이라 디스크 손실은 없고 **편집 내용은 초기화**됩니다.
- 설정: `dashboard_root`(**필수**, 대시보드 폴더 절대경로), `port`(기본 3000). 로그/PID는 플러그인 데이터 폴더(`devserver.log`, `devserver.pid`).

종료코드: 20 포트 충돌 · 21 기동 시간 초과 · 22 종료 대상 불일치 · 23 종료 실패 · 24 서버 진입점 없음 · 25 원격 대시보드에 연결되어 있어 기동하지 않음

> Vercel 등 원격 주소에 `/meeting:connect` 로 연결한 상태에서는 이 플러그인이 로컬 서버를 켜지 않습니다(코드 25). 로컬로 돌아가려면 `/meeting:connect --reset`.
