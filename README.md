# lmj451-sketchlens-frontend-ui-v9

MobileNetV3 분류 → **LLM 진단** 2단계 구조. 로그인 · 진단 기록 · 수정본 재진단 · 전후 비교 포함.
진단 기준표의 4개 항목(**선 품질 · 비율 · 실루엣 · 균형**)은 그대로 두고, **점수는 매기지 않는다.**
LLM이 항목마다 상태(보완 필요 · 양호 · 판단 불가)와 고칠 점(점검 포인트 · 부위 · 문제 · 이유 · 고치는 방법)을 쓴다.

## v8 → v9 변경 사항
- 채점 점수(세부 기준 2·1·0점, 항목 0~100점, 평균) 삭제
- 진단 기준표 4개 항목(선 품질 · 비율 · 실루엣 · 균형)과 점검 포인트는 유지 → criteria `v2_draft`
- 결과: 항목 상태(보완 필요 · 양호 · 판단 불가) + 고칠 점(점검 포인트 · 부위 · 문제 · 이유 · 고치는 방법), 고민 · 중요 순 우선순위
- 전후 비교: 점수 차이 대신 항목 상태 변화 + 이전 고칠 점 해결 여부(해결 · 일부 해결 · 남음) + 새로 생긴 고칠 점
- 내 기록: 점수 그래프 대신 버전 × 항목 상태 표
- 2단계 API 이름 `/api/score` → `/api/diagnose`
- `index.html` 추가: 저장소 기본 주소로 들어오면 사용자용 화면으로 이동

## 파일
| 파일 | 용도 | 결과 카드 탭 |
|---|---|---|
| `index.html` | 저장소 기본 주소로 들어오면 사용자용 화면으로 이동 | — |
| `SketchLens_v9.html` | 개발용. 요청·응답 JSON 확인 (`<body data-mode="dev">`) | 진단 · 입력·출력 · 이 작품의 버전 |
| `SketchLens_v9_user.html` | 사용자용(발표·시연). JSON 화면 없음 (`<body data-mode="user">`) | 진단 · 이 작품의 버전 |

GitHub Pages 주소 (저장소 `SketchLens_v9`)
- 기본 주소: https://lmj451.github.io/SketchLens_v9/ → 사용자용 화면으로 이동
- 개발용: https://lmj451.github.io/SketchLens_v9/SketchLens_v9.html
- 사용자용: https://lmj451.github.io/SketchLens_v9/SketchLens_v9_user.html

## 진단 기준표 (criteria v2_draft, 점수 없음)
| 항목 | 점검 포인트 |
|---|---|
| 선 품질 | 주요 선의 식별 가능성 · 필요한 연결부의 명확성 · 겹친 선의 해석 방해 여부 |
| 비율 | 대응 부위의 길이 차이 · 대응 부위의 너비 차이 · 부위 간 크기 관계 |
| 실루엣 | 외곽선 누락 여부 · 외곽선 중첩 여부 · 전체 형태의 판독 가능성 |
| 균형 | 대응 요소의 높이 차이 · 대응 요소의 위치 차이 · 중심선 기준 정렬 |

항목 상태: **보완 필요**(고칠 점 있음) · **양호**(뚜렷한 문제 없음) · **판단 불가**(잘림 · 가림 · 해상도 부족)
선 품질 외 3개 항목의 점검 포인트는 초안 (`AXES` 배열). 확정하면 LLM 고정 프롬프트와 함께 바꿀 것.

## 화면 (주소 뒤 #으로 이동)
| 화면 | 주소 | 내용 |
|---|---|---|
| 진단 | `#diagnose` | 업로드 → 분류 → LLM 진단 → 결과. 로그인 상태면 자동 저장 |
| 로그인 · 회원가입 | `#login`, `#login/signup` | 로그인 전에 한 진단은 로그인하면 v1로 저장 |
| 내 기록 | `#history` | 작품 목록 (보완 필요 항목 수, 고칠 점 수, v1 고칠 점 중 해결한 수) |
| 작품 상세 | `#history/{작품id}` | 버전 × 항목 상태 표, 이전 대비 해결 수, 버전마다 진단 다시 보기 |
| 전후 비교 | `#compare/{작품id}/{이전}/{이후}` | 두 버전 이미지, 항목 상태 변화, 이전 고칠 점마다 해결 · 일부 해결 · 남음, 새로 생긴 고칠 점 |
| 기준 가이드 | `#guide` | 진단 항목 · 점검 포인트, 항목 상태, 고칠 점 구성, 진단 과정 |

## 진단 결과 구성
총평 → 고민에 대한 답(고민 글을 쓴 경우) → **가장 먼저 고칠 점** → 항목별 진단(보완 필요 항목부터, 항목마다 상태 · 한 줄 평 · 고칠 점).
고칠 점 우선순위: 고민 글 · 중점 항목(focus) → "중요" 표시 → 기준표 항목 순서. 번호는 서버가 붙인다.

## 사용 흐름
1. 스케치를 올려 진단한다. 로그인 상태면 새 작품의 **v1**로 저장된다.
2. 결과 아래 **수정본 올려 다시 진단**을 누르면 수정본 모드가 된다.
3. 고친 스케치를 올려 진단하면 **v2**로 저장되고, 결과 위에 "이전 고칠 점 n개 중 m개 해결"과 **전후 비교 보기** 버튼이 나온다.

시연: `예시 · 티셔츠` 진단 → 수정본 올려 다시 진단 → `예시 · 티셔츠 수정본` 진단 → 전후 비교 보기.

## 백엔드 연동 시 바꿀 곳 (js/sketchlens.js에서 `TODO(백엔드 연동 지점)` 검색)
| 함수 | 실제 요청 |
|---|---|
| `requestClassify()` | `POST /api/classify` FormData(image) |
| `requestDiagnose()` | `POST /api/diagnose` `{diagnosis_id, worry, focus, artwork_id}` (artwork_id: 새 작품이면 null) |
| `apiSignup()` / `apiLogin()` / `apiLogout()` | `POST /api/auth/signup` · `/api/auth/login` · `/api/auth/logout` → `{token, user}` |
| `apiListArtworks()` | `GET /api/artworks` |
| `apiGetArtwork()` | `GET /api/artworks/{id}` → `{artwork, versions:[진단…]}` |
| `apiCompare()` | `POST /api/artworks/{id}/compare` `{from_version, to_version}` |
| `apiDeleteArtwork()` | `DELETE /api/artworks/{id}` |

로그인 후 요청에는 `Authorization: Bearer {token}`을 붙인다. `merge()`와 `saveDiagnosis()`는 서버가 할 일을 흉내 낸 것.

### DB 테이블 (안)
```
users       (id, email, password_hash, name, created_at)
artworks    (id, user_id, title, category, created_at, updated_at)
diagnoses   (id, artwork_id, version, image_path, worry, focus, criteria_version, prompt_version,
             category, confidence, summary, worry_answer, items JSON, issues JSON, created_at)
comparisons (id, artwork_id, from_version, to_version, result JSON, created_at)
```

### 최종 응답 예시 (`/api/diagnose`)
```json
{
  "criteria_version": "v2_draft", "prompt_version": "p2_draft",
  "relevance": { "category": "티셔츠", "confidence": 0.92 },
  "focus": ["proportion"],
  "summary": "선 품질 · 비율 · 균형 항목에 고칠 점이 있어요. 나머지 항목은 양호해요.",
  "worry_answer": "고민하신 부분은 비율 항목의 문제와 관련이 있어요. 해당 고칠 점을 먼저 보여드릴게요.",
  "items": {
    "line_quality": { "status": "needs_work", "comment": "1가지를 고치면 좋아요. 선이 한곳에 몰려 있어요" },
    "proportion":   { "status": "needs_work", "comment": "1가지를 고치면 좋아요. 좌우 소매 길이가 달라요" },
    "silhouette":   { "status": "ok", "comment": "외곽선이 끊김 없이 이어져 전체 형태가 잘 읽혀요." },
    "balance":      { "status": "needs_work", "comment": "2가지를 고치면 좋아요. 좌우 위치가 어긋나요" }
  },
  "issues": [
    { "priority": 1, "item": "proportion", "criterion": "대응 부위의 길이 차이", "importance": "high",
      "title": "좌우 소매 길이가 달라요", "where": "오른쪽 소매",
      "problem": "오른쪽 쪽 선 양이 반대쪽의 1.43배예요.",
      "why": "짝이 되는 부위의 길이가 다르면 옷이 한쪽으로 기울어 보여요.",
      "fix": "어깨너비와 소매 길이 기준선을 먼저 긋고, 양쪽 소매를 같은 기준선에 맞춰 다시 그려 보세요." }
  ],
  "record": { "artwork_id": "a_2", "version": 1, "title": "티셔츠 도식화" }
}
```

### 전후 비교 응답 예시 (`/api/artworks/{id}/compare`)
```json
{
  "from_version": 1, "to_version": 2, "same_criteria": true,
  "counts": { "resolved": 3, "partial": 0, "remaining": 1, "new": 0, "improved_items": 2 },
  "summary": "이전 고칠 점 4개 중 3개를 해결했어요, 1개는 아직 남아 있어요. 비율 · 균형 항목이 양호로 바뀌었어요.",
  "item_changes": [ { "item": "proportion", "before": "needs_work", "after": "ok", "change": "improved" } ],
  "issue_results": [ { "item": "proportion", "title": "좌우 소매 길이가 달라요", "status": "resolved", "comment": "…" } ],
  "new_issues": []
}
```

## 지금 상태 (데모)
- 서버 연동 전이라 `buildDemoClassify()` / `buildDemoDiagnose()` / `compareCore()`가 **실제 응답과 같은 모양의 JSON**을 만든다. 진단 내용은 선 계산으로 흉내 낸 것.
- 데모의 고칠 점 `id`는 버전끼리 같은 문제를 맞춰 보려고 붙인 표시. 실제로는 LLM이 이전 진단을 읽고 해결 여부를 판단한다.
- 로그인과 기록은 이 브라우저의 localStorage(`sketchlens_demo_v9_items`)에만 임시 저장된다. 비밀번호는 저장하지 않는다.

## 확인 필요
- 같은 스케치를 여러 번 진단했을 때 항목 상태와 고칠 점이 얼마나 같게 나오는지(일관성)는 실제 LLM으로 검증해야 한다.
- 분류 클래스 목록(`CATEGORIES`)은 데모용.
