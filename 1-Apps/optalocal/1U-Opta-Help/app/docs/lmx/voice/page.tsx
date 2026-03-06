"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "overview", title: "Overview", level: 2 as const },
  { id: "speech-to-text", title: "Speech to Text", level: 2 as const },
  { id: "text-to-speech", title: "Text to Speech", level: 2 as const },
  { id: "runtime-notes", title: "Runtime Notes", level: 2 as const },
];

export default function LmxVoicePage() {
  const { prev, next } = getPrevNext("/docs/lmx/voice/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "LMX", href: "/docs/lmx/" },
          { label: "Voice & Audio" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>LMX Voice & Audio</h1>
          <p className="lead">
            Opta LMX exposes OpenAI-compatible audio endpoints for speech-to-text (STT)
            and text-to-speech (TTS) on Apple Silicon.
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            Voice and audio capabilities are served under <code>/v1/audio/*</code> and can be used
            directly by clients that already speak the OpenAI API contract.
          </p>
          <Callout variant="info" title="Compatibility">
            Endpoint shape is aligned with OpenAI-style audio routes so existing tooling can
            integrate with minimal change.
          </Callout>

          <h2 id="speech-to-text">Speech to Text</h2>
          <p>
            Transcription is available via <code>/v1/audio/transcriptions</code>. Upload audio
            (for example <code>.wav</code>, <code>.mp3</code>, <code>.m4a</code>) as multipart form data.
          </p>
          <CommandBlock
            command={`curl -X POST http://lmx-host.local:1234/v1/audio/transcriptions \\
  -F "file=@sample.wav" \\
  -F "model=mlx-community/whisper-base"`}
            description="Transcribe audio with Whisper on LMX"
          />

          <h2 id="text-to-speech">Text to Speech</h2>
          <p>
            Speech synthesis is available via <code>/v1/audio/speech</code>. LMX streams generated
            audio from the configured TTS model.
          </p>
          <CodeBlock
            language="json"
            filename="POST /v1/audio/speech"
            code={`{
  "model": "mlx-audio/kokoro-82m",
  "input": "Opta runtime is healthy and ready.",
  "voice": "af_heart",
  "response_format": "wav"
}`}
          />
          <CommandBlock
            command={`curl -X POST http://lmx-host.local:1234/v1/audio/speech \\
  -H "Content-Type: application/json" \\
  -d '{"model":"mlx-audio/kokoro-82m","input":"Hello from Opta LMX","voice":"af_heart"}' \\
  --output speech.wav`}
            description="Generate speech audio from text"
          />

          <h2 id="runtime-notes">Runtime Notes</h2>
          <ul>
            <li>Audio endpoints run on the same LMX service instance as chat completions.</li>
            <li>Model availability and latency depend on Apple Silicon memory headroom.</li>
            <li>Use <code>/healthz</code> and <code>/readyz</code> before long-running audio jobs.</li>
          </ul>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}

