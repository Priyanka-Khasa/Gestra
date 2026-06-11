let enabled = false;

export async function initTTS() {
  enabled = 'speechSynthesis' in window;
  window.speechSynthesis.getVoices(); // preload voices
  return enabled;
}

export function speakFeedback(text) {
  if (!enabled || !text) return;

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.includes('en')) || voices[0];

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 0.9;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn('Speech synthesis failed:', error);
  }
}