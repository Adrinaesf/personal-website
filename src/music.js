/** Default-on soundtrack; the entry gesture unlocks playback where required. */
export function initMusic(button, status) {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.loop = true;
  // Start audibly: silently autoplaying and then raising volume can cause
  // browsers to pause playback when no user gesture has unlocked sound.
  audio.volume = 0.22;
  let enabled = true;
  let request = 0;

  function paint(message = '') {
    button.setAttribute('aria-pressed', String(enabled));
    button.querySelector('.music-state').textContent = enabled ? 'On' : 'Off';
    status.textContent = message;
  }
  async function play() {
    if (!enabled || document.hidden) return;
    const current = ++request;
    if (!audio.getAttribute('src')) audio.src = 'assets/wind-song.mp3';
    // A media error requires a fresh load; keep retries inside the entry
    // gesture so browsers can grant permission to play sound.
    if (audio.error) audio.load();
    try {
      await audio.play();
      // A pending play may finish after Off or a visibility change.
      // Stop it explicitly, without interrupting a newer enabled request.
      if (!enabled || document.hidden) {
        audio.pause();
        return;
      }
      if (current !== request) return;
      paint('Playing Wind Song by Ludovico Einaudi.');
    } catch (error) {
      if (current !== request) return;
      // Playback failures must not overwrite the visitor's On preference:
      // entering the world can retry an interrupted or blocked startup.
      if (error.name === 'NotAllowedError') {
        paint('Music will start when you enter the world.');
      } else if (error.name !== 'AbortError') {
        paint('Music could not start. Select Music off and on to try again.');
      }
    }
  }
  button.addEventListener('click', () => {
    enabled = !enabled;
    paint(enabled ? 'Starting music.' : 'Music off.');
    if (enabled) void play();
    else {
      ++request;
      audio.pause();
    }
  });
  document.addEventListener('visibilitychange', () => {
    ++request;
    audio.pause();
    if (!document.hidden && enabled) void play();
  });
  // Let the browser loop the buffered track. Reloading near the end aborts
  // playback and can require a new gesture to start sound again.
  audio.addEventListener('error', () => {
    ++request;
    audio.pause();
    if (enabled) paint('Music is unavailable. Enter the world or select Music off and on to retry.');
  });
  paint();
  void play();
  return { isOn: () => enabled, start() { if (enabled) void play(); } };
}
