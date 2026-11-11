// ---- src/testing.js ----
// Orbit Class's own switches in the kit's 測試工具 (hidden until unlocked:
// Orbit Pass › seven taps on 除錯紀錄). Read where they act as
// globalThis.ORBIT_TEST?.flags?.<name>; the kit's clock, place and network
// switches work here as everywhere.
//   classOff: today has no classes (holiday), all day (typhoon) or from 12:00
//   flightFail / flightNone: 專注飛行's planes can't be read / none land in time
const T = (zh, en) => (/^zh/i.test(document.documentElement.lang || 'zh') ? zh : en);
const closeTester = () => document.querySelector('dialog.q-tester[open]')?.close();
(globalThis.ORBIT_TEST_TOOLS ||= []).push(
  {
    app: 'orbit',
    title: T('時間模擬（課表）', 'Time simulation (timetable)'),
    sub: T('Class 自己的：任何一天任何時刻，可快轉、可暫停', 'Class’s own: any day and time, fast-forward or pause'),
    label: T('打開', 'Open'),
    run: () => {
      closeTester();
      window.openTestPanel?.();
    }
  },
  {
    app: 'orbit',
    title: T('歡迎卡片', 'Welcome card'),
    sub: T('沒有課表時第一次打開看到的卡片', 'What a first opening with no timetable shows'),
    label: T('顯示', 'Show'),
    run: async () => {
      closeTester();
      const { showOnboardingPrompt } = await import('./onboarding.js');
      const { hasSavedSchedule } = await import('./data.js');
      if (hasSavedSchedule()) return T('已經有課表，歡迎卡片只在沒有課表時出現（用測試帳號看）', 'There’s a timetable: the card shows only without one (use a test pass)');
      showOnboardingPrompt({ force: true });
    }
  },
  {
    app: 'orbit',
    title: T('今天停課', 'No classes today'),
    sub: T('國定假日、颱風停課整天，或 12:00 起停課', 'A holiday, a typhoon day off, or off from 12:00'),
    flag: 'classOff',
    options: [
      { id: 'holiday', label: T('假日', 'Holiday') },
      { id: 'typhoon', label: T('颱風整天', 'Typhoon, all day') },
      { id: 'afternoon', label: T('12:00 起', 'From 12:00') }
    ]
  },
  { app: 'orbit', title: T('專注飛行：讀不到班機', 'Focus flight: planes can’t be read'), sub: T('看讀取失敗的畫面和「再試一次」', 'The failed state and 再試一次'), flag: 'flightFail' },
  { app: 'orbit', title: T('專注飛行：沒有班機', 'Focus flight: no planes'), sub: T('這段時間內沒有要降落的班機', 'Nothing lands in the time picked'), flag: 'flightNone' }
);
