# Phase 10: Voice Messages

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus/tasks/plans/phase-10-voice-messages.md`

**Depends on:** Phase 7 (File Sharing) must be completed first — uses attachment infrastructure.

---

<context>
Read these files:
1. `CLAUDE.md` — Coding rules
2. `Shared/Sources/OptaMolt/Chat/AttachmentManager.swift` — From Phase 7 (attachment handling)
3. `Shared/Sources/OptaMolt/Networking/OpenClawProtocol.swift` — ChatSendAttachment (base64)
4. `Shared/Sources/OptaMolt/Chat/MessageBubble.swift` — Message rendering
5. `macOS/OptaPlusMacOS/ContentView.swift` — macOS input area
6. `iOS/OptaPlusIOS/Views/ChatInputBar.swift` — iOS input bar

Voice messages use AVFoundation to record audio, encode as base64, send as attachment with mimeType "audio/m4a". For received audio (TTS responses), render an inline audio player.
</context>

<instructions>
### 1. Shared: VoiceRecorder (OptaMolt)

Create `Shared/Sources/OptaMolt/Chat/VoiceRecorder.swift`:

```swift
import AVFoundation
import Combine

public final class VoiceRecorder: NSObject, ObservableObject, @unchecked Sendable {
    @Published public var isRecording = false
    @Published public var duration: TimeInterval = 0
    @Published public var audioLevel: Float = 0  // 0-1 for waveform visualization
    
    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private let tempURL: URL  // temp file for recording
    
    public func startRecording() throws {
        // Request mic permission
        // Configure AVAudioSession (iOS) / check permission (macOS)
        // Settings: .m4a, AAC, 44100Hz, mono
        // Start AVAudioRecorder
        // Start timer for duration + level metering
    }
    
    public func stopRecording() -> Data? {
        // Stop recorder
        // Read file data
        // Clean up temp file
        // Return audio data
    }
    
    public func cancelRecording() {
        // Stop without saving
        // Delete temp file
    }
    
    // Level metering for waveform
    private func updateLevel() {
        recorder?.updateMeters()
        let level = recorder?.averagePower(forChannel: 0) ?? -160
        audioLevel = max(0, (level + 50) / 50)  // Normalize -50...0 to 0...1
    }
}
```

### 2. Shared: AudioPlayer (OptaMolt)

Create `Shared/Sources/OptaMolt/Chat/AudioPlayer.swift`:

```swift
import AVFoundation

public final class AudioPlayer: NSObject, ObservableObject, AVAudioPlayerDelegate, @unchecked Sendable {
    @Published public var isPlaying = false
    @Published public var progress: Double = 0  // 0-1
    @Published public var duration: TimeInterval = 0
    
    private var player: AVAudioPlayer?
    private var timer: Timer?
    
    public func play(data: Data) throws {
        player = try AVAudioPlayer(data: data)
        player?.delegate = self
        duration = player?.duration ?? 0
        player?.play()
        isPlaying = true
        startProgressTimer()
    }
    
    public func pause() { ... }
    public func stop() { ... }
    public func seek(to progress: Double) { ... }
}
```

### 3. macOS: Hold-to-Record Button

**ContentView.swift / ChatTextInput.swift:**

1. **Mic button** (🎤) next to send button — appears when text field is empty
2. **Press and hold:** Start recording, show live waveform + duration
3. **Release:** Stop recording, send as attachment
4. **Drag up while holding:** Cancel recording (like Telegram)
5. **Waveform visualization:** Animated bars based on `audioLevel`

```swift
// Recording overlay (appears during hold)
VStack {
    WaveformView(level: recorder.audioLevel)
    Text(formatDuration(recorder.duration))
    Text("Release to send · Drag up to cancel")
}
```

### 4. iOS: Voice Button + Record UI

**ChatInputBar.swift:**

1. **Mic button** replaces send when text is empty
2. **Tap and hold:** Record with iOS haptic feedback
3. **Recording UI:** Full-width bar with waveform + timer + "slide to cancel"
4. **Release:** Send voice message
5. **Request microphone permission** on first use

### 5. Audio Playback in Message Bubbles

**MessageBubble.swift:**

When a message has an audio attachment (mimeType starts with "audio/"):

```swift
HStack(spacing: 12) {
    // Play/Pause button
    Button { togglePlayback() } label: {
        Image(systemName: isPlaying ? "pause.fill" : "play.fill")
    }
    
    // Waveform progress bar
    WaveformProgressView(progress: player.progress)
    
    // Duration
    Text(formatDuration(player.duration))
        .font(.caption)
}
.padding(12)
.background(.ultraThinMaterial)
.clipShape(RoundedRectangle(cornerRadius: 16))
```

Also handle TTS audio from bot (MEDIA: paths in bot responses → decode and show player).

### 6. WaveformView Components

Create `Shared/Sources/OptaMolt/Chat/WaveformView.swift`:

- `WaveformView(level:)` — Live recording bars (animated)
- `WaveformProgressView(progress:)` — Playback progress with static waveform shape
- Use spring physics for bar animations
- Bars: 20-30 vertical bars, height based on audio level
</instructions>

<constraints>
- AVFoundation only — no third-party audio libraries
- Audio format: M4A (AAC), 44100Hz, mono — good quality, small size
- Max recording: 5 minutes (300 seconds)
- Microphone permission: handle denial gracefully (show settings link)
- macOS: check `AVCaptureDevice.authorizationStatus(for: .audio)`
- iOS: `AVAudioSession.sharedInstance().requestRecordPermission`
- Audio data sent as base64 attachment (same as images)
- Spring physics for all waveform animations
- Both platforms build with 0 errors
</constraints>

<output>
Test checklist:
1. macOS: Hold mic button → waveform shows → release → voice sent
2. macOS: Drag up during recording → cancelled, nothing sent
3. iOS: Hold mic → haptic + waveform → release → voice sent
4. Received audio in bubble → play button, waveform, progress bar
5. Play → Pause → Resume works
6. Permission denied → shows "Enable microphone in Settings"
7. Recording > 5 min → auto-stops and sends
8. Both platforms build with 0 errors

When completely finished, run:
```bash
openclaw system event --text "Done: Phase 10 — Voice messages on both platforms" --mode now
```
</output>
