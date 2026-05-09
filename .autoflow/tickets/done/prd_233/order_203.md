# Autoflow Order

## Order

- Title: 라이트 테마 LiveTerminalView 글자 가독성 개선
- Priority: normal
- Status: ready
- Change Type: code

## Request

라이트 버전의 글자가 너무 연해 가독성을 높여야함

## Context

`apps/desktop/src/renderer/main.tsx` 의 `LIVE_TERMINAL_THEME_LIGHT` palette
(line ~6256) 가 라이트 테마에서 텍스트 콘트라스트가 부족하다.

현재 설정:
- foreground: `#1f2937` (slate-800)
- blue (path): `#2563eb` (blue-600)
- magenta (key): `#9333ea` (purple-600)
- yellow (warn/num): `#ca8a04` (yellow-600)
- green (str): `#16a34a` (green-600)
- cyan (ts): `#0891b2` (cyan-600)
- bright* 계열도 6xx-bright 톤이라 흰 배경에서 묽게 보임

스크린샷에서는 "I have created the wiki page for ..." 같은 일반 본문과 path 링크 모두
흐릿하게 보여 5초 이상 응시해야 읽힌다.

기대 동작: WCAG AA (4.5:1 이상) 만족하는 darker palette 로 교체. 다크 테마는
변경하지 않는다 (vibe-terminal 톤 유지).

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] `LIVE_TERMINAL_THEME_LIGHT` 의 foreground 가 `#0f172a` (slate-900) 이상으로 진해진다
- [ ] path/key/warn/str/cyan ANSI 컬러가 700~800 톤으로 darken 돼 흰 배경에서 명확히 읽힌다
- [ ] bright 계열도 600 톤 이상으로 정렬돼 어두운 본문보다 강조 효과가 살아 있다
- [ ] 다크 테마 (`LIVE_TERMINAL_THEME_DARK`) 는 그대로 유지된다
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 라이트 팔레트 권장값:
  - foreground `#0f172a` (slate-900)
  - blue `#1d4ed8` (blue-700) — path 링크
  - magenta `#7e22ce` (purple-700) — key
  - green `#15803d` (green-700) — str
  - yellow `#a16207` (yellow-700) — warn/num
  - cyan `#0e7490` (cyan-700) — ts/time
  - red `#b91c1c` (red-700) — bad
  - bright* 계열은 한 단계 위 (600 톤) 로 맞춰 본문보다 살짝 진한 강조
- 다크 팔레트는 ANSI escape 같은 token 을 잘 보여주는 vibe-terminal 톤이 이미
  검증돼 있으니 그대로 둔다.
