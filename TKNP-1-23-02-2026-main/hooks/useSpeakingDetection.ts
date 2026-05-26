import { useEffect, useState } from 'react';

const SPEAKING_THRESHOLD = 18;

/** Detects speech from a MediaStream via Web Audio API AnalyserNode. */
export function useSpeakingDetection(stream: MediaStream | null, enabled = true): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!enabled || !stream) {
      setIsSpeaking(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setIsSpeaking(false);
      return;
    }

    let raf = 0;
    let closed = false;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (closed) return;
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
      setIsSpeaking(avg > SPEAKING_THRESHOLD);
      raf = requestAnimationFrame(tick);
    };

    void audioContext.resume().then(() => {
      if (!closed) tick();
    });

    return () => {
      closed = true;
      cancelAnimationFrame(raf);
      source.disconnect();
      void audioContext.close();
      setIsSpeaking(false);
    };
  }, [stream, enabled]);

  return isSpeaking;
}
