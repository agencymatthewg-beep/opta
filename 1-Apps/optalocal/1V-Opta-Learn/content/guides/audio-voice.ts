import type { Guide } from './index';

export const audioVoiceGuide: Guide = {
  slug: 'audio-voice',
  title: "Audio & Voice with Opta LMX",
  app: 'lmx',
  category: 'feature',
  template: 'feature-deep-dive',
  summary: "A complete guide to local speech-to-text transcription and text-to-speech synthesis with Opta LMX — all processed on your hardware via MLX, with zero cloud dependency.",
  tags: ["lmx", "audio", "voice", "tts", "stt", "mlx-whisper", "mlx-audio", "speech", "transcription"],
  updatedAt: '2026-03-05',
  sections: [
    {
      heading: "[Setup] What Is the Audio / Voice Feature?",
      body: `<a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a> exposes two fully local audio endpoints that integrate directly into the OpenAI-compatible API surface:<br><br>
<ul>
  <li><strong>Speech-to-Text (STT):</strong> <code>POST /v1/audio/transcriptions</code> — powered by <strong>mlx-whisper</strong>. Accepts WAV, MP3, M4A, or WebM audio files and returns a transcribed text string.</li>
  <li><strong>Text-to-Speech (TTS):</strong> <code>POST /v1/audio/speech</code> — powered by <strong>mlx-audio</strong>. Accepts a text prompt and voice selection and returns an MP3 audio stream.</li>
</ul><br>
Both are implemented as OpenAI-compatible endpoints so any tool that already targets OpenAI's audio API can be redirected to LMX with zero code changes. Neither endpoint sends data off your LAN — every byte of audio is processed locally on the Apple Silicon unified memory.`,
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid grid-cols-2 gap-4">
    <div class="bg-[#18181b] rounded-lg p-4 border border-[#3f3f46]">
      <div class="flex items-center gap-2 mb-3"><span class="text-[#a855f7] font-mono text-xs">POST</span><span class="text-white font-mono text-xs">/v1/audio/transcriptions</span></div>
      <div class="text-[#a1a1aa] text-xs">Audio → Text</div>
      <div class="mt-2 text-[#22c55e] text-xs font-mono">mlx-whisper</div>
    </div>
    <div class="bg-[#18181b] rounded-lg p-4 border border-[#3f3f46]">
      <div class="flex items-center gap-2 mb-3"><span class="text-[#a855f7] font-mono text-xs">POST</span><span class="text-white font-mono text-xs">/v1/audio/speech</span></div>
      <div class="text-[#a1a1aa] text-xs">Text → Audio</div>
      <div class="mt-2 text-[#22c55e] text-xs font-mono">mlx-audio</div>
    </div>
  </div>
</div>`,
    },
    {
      heading: "[Configuration] Use Cases",
      body: `The audio pipeline unlocks a set of workflows that are otherwise gated behind cloud dependency:<br><br>
<ul>
  <li><strong>Voice-first developer UX:</strong> Dictate code review notes, commit messages, or documentation while your hands are occupied compiling or deploying.</li>
  <li><strong>Meeting transcription:</strong> Record and transcribe local meetings or code walkthroughs with no subscription or third-party data processing.</li>
  <li><strong>Offline accessibility:</strong> Teams in air-gapped environments (secure, classified, or regulated workplaces) can access speech input/output without external network egress.</li>
  <li><strong>Voice-driven <a href="/guides/cli" class="app-link link-cli">Opta CLI</a>:</strong> The CLI's voice compositor uses STT to convert microphone input into prompt text, enabling hands-free AI sessions via <code>opta chat --mic</code>.</li>
  <li><strong>TTS readback:</strong> Feed code explanations, summaries, or documentation back as synthesized speech using one of several voice personas.</li>
</ul>`,
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-2 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">Primary workflows</div>
      <div class="mt-2 text-text-secondary">dictation, meeting transcript, offline accessibility</div>
    </div>
    <div class="rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/10 p-3">
      <div class="text-[#c4b5fd] uppercase tracking-wider">Operator flows</div>
      <div class="mt-2 text-text-secondary">voice-driven CLI + TTS readback</div>
    </div>
  </div>
</div>`,
    },
    {
      heading: "[Operation] Under the Hood",
      body: `<strong>Speech-to-Text via mlx-whisper</strong><br>
mlx-whisper is a fork of OpenAI Whisper that runs on the Apple Neural Engine and GPU via MLX. The model is loaded on-demand on first call and pinned in unified memory alongside the active language model. Multiple Whisper model sizes are supported (tiny, base, small, medium, large) and are configured in <code>~/.opta-lmx/config.yaml</code> under the <code>audio.stt_model</code> key.<br><br>
<strong>Text-to-Speech via mlx-audio</strong><br>
mlx-audio renders synthesised speech using Apple Silicon MLX kernels. Voice personas are discrete model weights (e.g. <code>alloy</code>, <code>nova</code>, <code>echo</code>) streamed as MP3. Response format defaults to MP3 and can be set to WAV or OPUS via the <code>response_format</code> request field.<br><br>
<strong>Memory management:</strong> Audio models share unified memory with the primary inference model. LMX uses a tiered eviction strategy: if loading an audio model would push total memory use above <strong>90%</strong>, the least-recently-used secondary model is evicted automatically. This ensures the system never OOMs.`,
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">STT</div>
      <div class="mt-2 text-white">mlx-whisper on MLX</div>
    </div>
    <div class="rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/10 p-3">
      <div class="text-[#c4b5fd] uppercase tracking-wider">TTS</div>
      <div class="mt-2 text-white">mlx-audio stream</div>
    </div>
    <div class="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-3">
      <div class="text-[#fdba74] uppercase tracking-wider">Memory guard</div>
      <div class="mt-2 text-white">evict at 90% pressure</div>
    </div>
  </div>
</div>`,
      code: `# In ~/.opta-lmx/config.yaml
audio:
  stt_model: "mlx-community/whisper-large-v3-mlx"    # whisper model
  tts_model: "mlx-community/lucataco-orpheus-3b-0.1-ft-4bit-mlx"
  response_format: "mp3"   # mp3 | wav | opus`,
    },
    {
      heading: "[Troubleshooting] Usage and Configuration",
      body: `<strong>Transcription (STT)</strong><br>
Send an audio file to the <code>/v1/audio/transcriptions</code> endpoint. The response is a JSON object with a <code>text</code> field.<br>`,
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-2 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="text-white uppercase tracking-wider">STT request path</div>
      <div class="mt-2 text-text-secondary">upload audio → parse → text JSON</div>
    </div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="text-white uppercase tracking-wider">TTS request path</div>
      <div class="mt-2 text-text-secondary">prompt + voice → synth → MP3 stream</div>
    </div>
  </div>
</div>`,
      code: `# STT — transcribe an audio file
curl -X POST http://192.168.188.11:1234/v1/audio/transcriptions \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@recording.webm" \\
  -F "model=whisper-large-v3"

# Returns:
# { "text": "transcribed content here…" }

# TTS — generate speech from text
curl -X POST http://192.168.188.11:1234/v1/audio/speech \\
  -H "Content-Type: application/json" \\
  -d '{ "model": "tts-1", "input": "Hello from Opta LMX", "voice": "alloy", "response_format": "mp3" }' \\
  --output output.mp3

# From the Opta CLI (uses daemon audio proxy)
opta do "transcribe this meeting recording" --attach recording.mp3`,
      note: `The audio endpoints on <a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a> are only accessible over LAN by default. If you need to expose them to other devices, configure the <code>host</code> setting in your LMX config to <code>0.0.0.0</code> and ensure firewall rules appropriately restrict access.`,
    },
    {
      heading: "[Optimization] Operational Limits and Troubleshooting",
      body: `If transcription or synthesis latency spikes, the most common cause is memory contention between the active LLM and audio models. Start by reducing the base model size for either STT or TTS and rerun the same request. For recurring production workloads, pin a known-good audio model pair in your host profile and avoid hot-swapping during peak usage windows.<br><br>
If requests fail with <code>model not available</code>, confirm your configured model IDs still exist on disk and that the LMX process can read the model cache directory. If responses are empty or clipped, validate input audio format and sample rate first; malformed WebM exports are the most frequent failure mode in browser-captured recordings.`,
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-3 text-[#fdba74]">Check memory contention first</div>
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3 text-[#86efac]">Pin known-good model pair</div>
    <div class="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-3 text-[#fca5a5]">Validate audio format + sample rate</div>
  </div>
</div>`,
      note: `Use <code>GET /healthz</code> and the LMX logs together when debugging audio issues. Health probes confirm service readiness, while logs expose model load/eviction decisions and request-level failures.`,
    },
  ],
};
