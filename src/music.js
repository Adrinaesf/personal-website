/** Default-on soundtrack; the entry gesture unlocks playback where required. */
export function initMusic(button, status) {
  const audio = new Audio();
  audio.preload = 'none';
  audio.loop = true;
  audio.volume = 0;
  let enabled = true;
  let request = 0;
  let animation = 0;
  const targetVolume = 0.22;

  function paint(message = '') {
    button.setAttribute('aria-pressed', String(enabled));
    button.querySelector('.music-state').textContent = enabled ? 'On' : 'Off';
    status.textContent = message;
  }
  function stopFade() { cancelAnimationFrame(animation); animation = 0; }
  function fade(to, done = () => {}) {
    stopFade();
    const from = audio.volume, start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / 900, 1);
      audio.volume = Math.min(1, Math.max(0, from + (to - from) * t));
      if (t < 1) animation = requestAnimationFrame(step);
      else { animation = 0; done(); }
    }
    animation = requestAnimationFrame(step);
  }
  async function play() {
    const current = ++request;
    if (!audio.getAttribute('src')) audio.src = 'assets/wind-song.mp3';
    try {
      await audio.play();
      // A pending play may finish after Off or a visibility change.
      // Stop it explicitly, without interrupting a newer enabled request.
      if (!enabled || document.hidden) {
        stopFade();
        audio.pause();
        audio.volume = 0;
        return;
      }
      if (current !== request) return;
      paint('Playing Wind Song by Ludovico Einaudi.');
      fade(targetVolume);
    } catch (error) {
      if (current !== request) return;
      if (error.name === 'NotAllowedError' && enabled) {
        paint('Music will start when you enter the world.');
        return;
      }
      enabled = false;
      stopFade();
      audio.pause();
      paint('Music could not start. Select Music to try again.');
    }
  }
  button.addEventListener('click', () => {
    enabled = !enabled;
    paint(enabled ? 'Starting music.' : 'Music off.');
    if (enabled) { stopFade(); void play(); }
    else {
      ++request;
      fade(0, () => audio.pause());
    }
  });
  document.addEventListener('visibilitychange', () => {
    ++request;
    stopFade();
    audio.pause();
    audio.volume = 0;
    if (!document.hidden && enabled) void play();
  });
  // Looping normally seeks back to the start, which fails on servers that
  // cannot serve part of a file: the song then just stops. Reloading the
  // file at the end restarts it everywhere, so do that by hand.
  let restarting = false;
  function restart() {
    if (restarting) return;
    restarting = true;
    stopFade();
    audio.volume = 0;
    audio.load?.();
    if (enabled && !document.hidden) void play();
  }
  audio.addEventListener('playing', () => { restarting = false; });
  audio.addEventListener('ended', restart);
  audio.addEventListener('timeupdate', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 1 && audio.currentTime > audio.duration - 0.3) restart();
  });
  audio.addEventListener('error', () => {
    ++request;
    enabled = false;
    stopFade();
    audio.pause();
    paint('Music is unavailable. You can continue exploring without sound.');
  });
  paint();
  void play();
  return { isOn: () => enabled, start() { if (enabled) { stopFade(); void play(); } } };
}
