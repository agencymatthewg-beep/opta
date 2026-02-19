# OptaCloud Shared Libraries

## Overview

Each platform has a shared library that handles:
- Authentication (Google, Apple, Email)
- Database operations
- Encryption
- Sync

## Swift Package

Location: `~/Documents/Opta/OptaCloud/shared-libs/swift/`

```
swift/
├── Package.swift
├── Sources/
│   └── OptaCloud/
│       ├── Auth.swift
│       ├── Database.swift
│       ├── Sync.swift
│       └── Models/
│           └── Profile.swift
└── README.md
```

### Package.swift

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OptaCloud",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "OptaCloud", targets: ["OptaCloud"])
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift", from: "2.0.0")
    ],
    targets: [
        .target(name: "OptaCloud", dependencies: ["Supabase"])
    ]
)
```

---

## TypeScript Package

Location: `~/Documents/Opta/OptaCloud/shared-libs/typescript/`

```
typescript/
├── package.json
├── src/
│   ├── index.ts
│   ├── auth.ts
│   ├── database.ts
│   ├── sync.ts
│   └── types.ts
├── tsconfig.json
└── README.md
```

### package.json

```json
{
  "name": "@optamize/optacloud",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0"
  }
}
```

---

## Common Types

```typescript
// shared-libs/common/types.ts

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  app_specific_data: Record<string, any>;
}

export interface AppConfig {
  id: string;
  user_id: string;
  app_id: string;
  config_key: string;
  config_value: any;
  updated_at: string;
}

export interface UserApiKey {
  id: string;
  user_id: string;
  provider: 'openai' | 'anthropic' | 'groq' | 'google' | 'other';
  encrypted_key: string;
  created_at: string;
}
```

---

## Usage Examples

### Swift (iOS)

```swift
import OptaCloud

// Sign in with Google
let session = try await OptaCloud.Auth.signInWithGoogle()

// Get profile
let profile = try await OptaCloud.Database.getProfile()

// Save config
try await OptaCloud.Database.saveConfig(
  appId: "optalife",
  key: "theme",
  value: "dark"
)
```

### TypeScript (Web)

```typescript
import { signInWithGoogle, getProfile, saveConfig } from '@optamize/optacloud';

// Sign in
const { session } = await signInWithGoogle();

// Get profile
const profile = await getProfile();

// Save config
await saveConfig('optalife', 'theme', 'dark');
```

---

*Last updated: 2026-02-19*
