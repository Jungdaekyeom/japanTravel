# 지도 가로 경계 Design QA

- Source visual truth: `/var/folders/ll/n_3pkrj97plfd6lydm_qxppm0000gn/T/codex-clipboard-eee7bbd5-26d7-4f03-b6ad-32b2c4ac06f7.png`
- Implementation screenshot: `/private/tmp/japan-travel-map-bounds-final.png`
- Combined comparison: `/private/tmp/japan-travel-map-bounds-comparison.png`
- State: 관찰자, 일정 패널 닫힘, 전체 5일 경로
- Browser viewport: 412 × 915 CSS px, device pixel ratio 2
- Source pixels: 1080 × 342
- Implementation export: 412 × 915 px; Browser screenshot API가 CSS 크기로 정규화
- Focused comparison: source를 412 × 130으로 축소하고 implementation의 전체 경로 영역을 412 × 130으로 잘라 세로로 결합

## Full-view comparison evidence

- 인천·부산·간사이·교토·도쿄권·나리타의 전체 경로 마커가 한 화면에 유지된다.
- 인천 라벨은 왼쪽 경계에, 나리타 라벨은 오른쪽 경계에 붙되 잘리지 않는다.
- 일정 패널 열기, 범례, Google 저작권 표시는 기존 위치와 동작을 유지한다.

## Focused region comparison evidence

- 결합 이미지의 위쪽은 제공된 기준 이미지, 아래쪽은 구현 화면이다.
- 양쪽 모두 인천이 화면 서쪽 끝, 나리타가 동쪽 끝이 되며 두 공항 바깥에는 짧은 지도 여백만 남는다.
- 기준 이미지의 파란 선과 구현 화면의 회색 선 차이는 경로 선택·확정 전 상태에 따른 기존 제품 동작으로, 이번 카메라 범위 변경 대상이 아니다.

## Required fidelity surfaces

- Fonts and typography: 기존 Google 지도 지명과 앱 마커 라벨을 그대로 사용하며 잘림이나 새 줄바꿈이 없다.
- Spacing and layout rhythm: 가로 끝점을 인천 서쪽 약 1도, 나리타 동쪽 약 1도로 제한했다. 전체 마커가 412px 폭 안에 표시된다.
- Colors and visual tokens: 지도 필터, 마커, 선, 범례 색상을 변경하지 않았다.
- Image quality and asset fidelity: Google 지도 원본 타일을 유지하며 새 래스터·대체 에셋을 만들지 않았다.
- Copy and content: 일정·장소·경로 문구는 변경하지 않았다.

## Comparison history

1. 첫 구현은 `strictBounds: true` 때문에 정수 줌 단계가 강제되어 인천과 나리타가 화면 밖으로 잘렸다. `strictBounds: false`로 바꿔 전체 경로를 다시 맞췄다.
2. 전체 경로 padding 54px은 다음 정수 줌 단계로 축소되어 여백이 과도했다. 기존 36px을 유지해 기준 이미지처럼 양 끝 라벨이 경계에 가깝게 보이도록 했다.
3. 최종 화면에서 인천·나리타를 포함한 모든 마커가 보이고, 1일차 선택 시 패널 자동 접힘과 경로 재생이 정상이며 브라우저 경고·오류가 없다.

## Findings

- P0/P1/P2 없음.
- P3: 작은 화면에서 긴 나리타 라벨이 오른쪽 가장자리에 매우 가깝지만 잘리지 않으며 기준 이미지의 밀도와 일치한다.

## Implementation checklist

- [x] 전체 경로의 동서 경계 제한
- [x] 인천·나리타 라벨 가시성 확인
- [x] 일차별 경로 재생 회귀 확인
- [x] 브라우저 경고·오류 확인

final result: passed
