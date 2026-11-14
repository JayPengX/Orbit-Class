// ---- src/ask-link.js ----
// 問 Orbit (the Pass sheet's one question box, kit ask-orbit.mjs) opens the
// app with the question in the address (`#ask=<words>`): 問我的課表 with it,
// the editor's AI box filled and sent as if typed (editor-nl-edit.js answers
// a question; an edit is only offered, never applied without the person's tap).
export const hasAsk = hash => /(?:^#|&)ask=/.test(String(hash || ''));

export async function askInBox(text, load = () => import('./editor-nl-edit.js')) {
  if (!text) return false;
  window.openEditor?.();
  await load();
  const input = document.getElementById('nl-edit-input');
  const send = document.getElementById('nl-edit-submit');
  if (!input || !send) return false;
  input.value = text;
  send.click();
  return true;
}

// `hash`: the address as the app opened, read before the tab bar wrote its
// own over it; the question taken out of the address so a reload doesn't ask again.
// 「開始專注飛行 50 分鐘」 (a command, src/act.js) opens 專注飛行 at once, never the editor.
export function askFromLink(hash = location.hash) {
  if (!hasAsk(hash)) return;
  import('#kit/ask-orbit.mjs')
    .then(async m => {
      const text = m.takeAsk?.({ hash, pathname: location.pathname, search: location.search }) || '';
      const { readClassAct, startFocus } = await import('./act.js');
      const act = text && (await readClassAct(text));
      if (act?.act === 'focus') return startFocus(act);
      return askInBox(text);
    })
    .catch(() => {});
}
