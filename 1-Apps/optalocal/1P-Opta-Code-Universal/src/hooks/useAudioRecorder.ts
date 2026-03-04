import { useState, useRef, useCallback } from 'react';

/**
 * Hook for capturing audio via MediaRecorder.
 * 
 * Supports browser environments natively. Will require Tauri plugin adaptation
 * if we need direct OS microphone access beyond WebView capabilities in the future.
 */
export function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [continuousMode, setContinuousMode] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);

    const playAudioBase64 = useCallback(async (base64String: string) => {
        try {
            if (!audioContextRef.current) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRef.current = new AudioContextClass();
            }
            const context = audioContextRef.current;
            
            const binaryString = atob(base64String);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const audioBuffer = await context.decodeAudioData(bytes.buffer);
            const source = context.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(context.destination);
            source.start(0);
        } catch (err) {
            console.error('Error playing audio:', err);
            setError(err instanceof Error ? err.message : 'Unknown audio playback error');
        }
    }, []);

    const startRecording = useCallback(async () => {
        setError(null);
        setAudioBase64(null);
        audioChunksRef.current = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    // Extract just the base64 part
                    const base64String = base64data.split(',')[1];
                    setAudioBase64(base64String);
                };

                // Cleanup constraints
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error starting audio recording:', err);
            setError(err instanceof Error ? err.message : 'Unknown audio recording error');
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    return {
        isRecording,
        startRecording,
        stopRecording,
        audioBase64,
        setAudioBase64, // to easily clear it out
        error,
        playAudioBase64,
        continuousMode,
        setContinuousMode,
    };
}
