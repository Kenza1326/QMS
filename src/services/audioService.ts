/**
 * Audio service for queue announcements
 * Uses native Web Audio API for harmonic bank chimes
 * Uses Web Speech API for voice ticket call synthesis
 * Ensures announcements repeat EXACTLY 2 times, then stop cleanly.
 */

class AudioService {
  private audioCtx: AudioContext | null = null;
  private activeUtterances: Set<SpeechSynthesisUtterance> = new Set();
  private isProcessingAnnouncement = false;
  private currentTimeout: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlockAudio();
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
    }
  }

  public unlockAudio(): void {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Play an elegant 2-tone melodic bank hall chime
   */
  public playChime(volume: number = 0.8): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.linearRampToValueAtTime(volume * 0.4, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      gainNode.connect(ctx.destination);

      // Tone 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.connect(gainNode);
      osc1.start(now);
      osc1.stop(now + 0.7);

      // Tone 2: 880.00 Hz (A5)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.28);
      osc2.connect(gainNode);
      osc2.start(now + 0.28);
      osc2.stop(now + 1.6);
    } catch (e) {
      console.warn('[AudioService] Could not play chime:', e);
    }
  }

  /**
   * Vocal announcement of ticket number and counter
   * Repeats EXACTLY 2 times, then stops completely.
   */
  public speakTicketCall(
    ticketNumber: string,
    counterName: string,
    lang: string = 'fr-FR',
    enabled: boolean = true
  ): void {
    if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      // Clear any pending timeouts
      if (this.currentTimeout) {
        clearTimeout(this.currentTimeout);
        this.currentTimeout = null;
      }

      window.speechSynthesis.cancel();
      this.activeUtterances.clear();

      // Format ticket letters with spaces for clear speech (e.g. C - 0 2 5)
      const formattedTicket = ticketNumber.split('').join(' ');
      const text = `Ticket ${formattedTicket}, ${counterName}`;

      let repetitionsDone = 0;
      const totalAllowed = 2; // Strict limit: exactly twice only

      const triggerRepetition = () => {
        if (repetitionsDone >= totalAllowed) {
          window.speechSynthesis.cancel();
          return;
        }

        // Play chime first
        this.playChime(0.75);

        this.currentTimeout = setTimeout(() => {
          if (repetitionsDone >= totalAllowed) return;

          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = lang;
          utterance.rate = 0.95;
          utterance.pitch = 1.05;

          utterance.onend = () => {
            this.activeUtterances.delete(utterance);
            repetitionsDone++;
            if (repetitionsDone < totalAllowed) {
              // Pause 1s before 2nd repetition
              this.currentTimeout = setTimeout(() => {
                triggerRepetition();
              }, 1000);
            } else {
              window.speechSynthesis.cancel();
            }
          };

          utterance.onerror = () => {
            this.activeUtterances.delete(utterance);
            repetitionsDone++;
          };

          this.activeUtterances.add(utterance);
          window.speechSynthesis.speak(utterance);
        }, 550);
      };

      triggerRepetition();
    } catch (e) {
      console.warn('[AudioService] Could not speak ticket call:', e);
    }
  }
}

export const audioService = new AudioService();
