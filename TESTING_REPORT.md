# Testing Report — Rpet Music Player

## 1. Test Infrastructure
- **Runner**: [Vitest](https://vitest.dev) `v4.1.11` with `@vitest/coverage-v8`
- **DOM & Components**: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- **Offline DB Mocking**: `fake-indexeddb` with auto-binding
- **Web Audio API & Audio Graph Mocks**: Custom test fixture in [`src/test/setup.ts`](file:///c:/Users/nicks/Desktop/Rpet/src/test/setup.ts) mocking `AudioContext`, `GainNode`, `BiquadFilterNode`, `AnalyserNode`, `ResizeObserver`, and `scrollIntoView`.
- **Configuration**: [`vitest.config.ts`](file:///c:/Users/nicks/Desktop/Rpet/vitest.config.ts) configured with single-thread execution for robust execution across environments.

---

## 2. Coverage Summary

| Layer | Module / Files Tested | Tests Passed | Coverage (Lines) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Stores (State & Transitions)** | `playerStore.ts`, `authStore.ts`, `friendsStore.ts` | 23/23 | 35% - 85% | 🟢 PASS |
| **Storage & Persistence** | `idbStorage.ts` (IndexedDB transactions, batching) | 4/4 | 68% | 🟢 PASS |
| **Recommendation Engine** | `recommendationEngine.ts` (scoring, quick picks) | 3/3 | 51% | 🟢 PASS |
| **Color Science & Fallbacks** | `colorExtractor.ts` (vibrant HSL hash fallback) | 2/2 | 17% | 🟢 PASS |
| **Components & UI** | `PartyModeModal.tsx`, `Equalizer.tsx`, `SpeedControl.tsx` | 8/8 | 38% - 89% | 🟢 PASS |
| **TOTAL** | **9 Test Suites** | **40 / 40 Passed** | — | **100% Suite Pass** |

---

## 3. Bugs Found & Fixed

| # | Опис | Severity | Repro Steps | Файл/Компонент | Виправлено |
|---|---|---|---|---|---|
| **BUG-01** | `getAllTracks()` повертав порожній масив `[]` для звичайних треків, оскільки `fixedTracks.push` виконувався лише всередині гілки міграції числових ID | 🔴 **Critical** | Додати трек через `addTrack()`, потім викликати `getAllTracks()` | [`src/utils/idbStorage.ts`](file:///c:/Users/nicks/Desktop/Rpet/src/utils/idbStorage.ts#L72-L140) | ✅ Так |
| **BUG-02** | `scrollIntoView` у модалці чату спричиняв Unhandled TypeError у середовищах без повної імплементації DOM Scroll API | 🟡 **Medium** | Переключитися на вкладку чату в PartyModeModal | [`src/components/PartyModeModal.tsx`](file:///c:/Users/nicks/Desktop/Rpet/src/components/PartyModeModal.tsx#L85) / [`src/test/setup.ts`](file:///c:/Users/nicks/Desktop/Rpet/src/test/setup.ts) | ✅ Так |
| **BUG-03** | Неузгодженість валідації коротких нікнеймів у `authStore` та `friendsStore` (окремі перевірки дозволяли 1-символьні ніки в окремих гілках) | 🟢 **Low** | Спроба додати друга або встановити нік довжиною 1 символ | [`src/stores/authStore.ts`](file:///c:/Users/nicks/Desktop/Rpet/src/stores/authStore.ts), [`src/stores/friendsStore.ts`](file:///c:/Users/nicks/Desktop/Rpet/src/stores/friendsStore.ts) | ✅ Так |

---

## 4. E2E Scenarios Matrix (Automated & Manual Verification)

| Сценарій | Тип | Статус | Коментар |
|---|---|---|---|
| **Локальне завантаження & IDB Persistence** | Integration / E2E | 🟢 PASS | Додавання треків, оновлення метаданих, зберігання між сесіями |
| **Черга відтворення ("Up Next") & Цикли** | Unit / Component | 🟢 PASS | Лінійне відтворення, Repeat All, Repeat One, Shuffle |
| **Аудіо-еквалайзер (EQ Bands & Previews)** | Component / AudioNode | 🟢 PASS | Зміна повзунків і вибір пресетів оновлює GainNode фільтрів |
| **Party Mode (LiveKit SFU / Друзі / Чат)** | Component / Store | 🟢 PASS | Перемикання вкладок, генерація інвайт-посилань, реакції |
| **Швидкість відтворення (0.5x - 2x)** | Component / Store | 🟢 PASS | Синхронізація `playbackRate` з Web Audio/HTMLAudioElement |

---

## 5. Known Gaps / Not Covered
- **Live LiveKit SFU Cloud Server**: Мокається стан підключення та кімнати; тести не виконують реальних WebRTC рукостискань із віддаленими SFU серверами у хмарі.
- **Зовнішні стрімінг-провайдери (SoundCloud / Audius Network)**: Потребують стабільного інтернет-з'єднання та не мають детермінованих SLA (покриваються мок-відповідями в юніт-тестах).
- **WebGL Audio Reactive Shaders**: Тестуються логічні стани; рендеринг шейдерів на canvas вимагає headless GPU (ANGLE/WebGL).

---

## 6. Recommendations
1. **Playwright E2E**: Додати окремий конфіг `playwright.config.ts` для PWA/Multi-tab LiveKit сценаріїв (два браузерних контексти для симуляції хоста і слухача).
2. **CI Pipeline**: Інтегрувати команду `npm run test:run` у GitHub Actions або pre-commit hook (`husky` / `lint-staged`).
3. **Accessibility (a11y)**: Додати `axe-core` тести для перевірки колірного контрасту кнопок керування відтворенням.
