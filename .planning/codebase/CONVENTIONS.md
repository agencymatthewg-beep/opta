# Code Conventions

*Last updated: 2025-01-29*

## TypeScript/React (Desktop & Web)

### File Naming
- **Components**: PascalCase (`InvestigationPanel.tsx`, `ModelCard.tsx`)
- **Hooks**: PascalCase with `use` prefix (`useMediaQuery.ts`, `useCentralCard.tsx`)
- **Utilities**: kebab-case or camelCase (`utils.ts`)
- **Types**: PascalCase (`optimization.ts`, `investigation.ts`)
- **Config**: Standard names (`vite.config.ts`, `tsconfig.json`)

### Naming Patterns
```typescript
// Functions: camelCase
function fetchTelemetry() { }
const handleClick = () => { }

// Variables: camelCase
const expandedChanges = true;
const clipboardTimeoutRef = useRef();

// Hooks: use* prefix
const [state, setState] = useState();
const value = useContext(MyContext);

// Types/Interfaces: PascalCase (no I prefix)
interface InvestigationPanelProps { }
type ModelType = 'gpt' | 'claude';

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
```

### Import Organization
```typescript
// 1. React imports
import React, { useState, useRef } from 'react';

// 2. External packages
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

// 3. Internal modules (path aliases)
import { Button } from '@/components/ui';
import { useChessGame } from '@/hooks';

// 4. Relative imports
import { utils } from './utils';

// 5. Type imports
import type { ChessPosition } from '@/types';
```

### Component Pattern
```typescript
/**
 * ComponentName - Brief description
 *
 * Longer description of purpose.
 * @see DESIGN_SYSTEM.md - Part X: Section name
 */
export function ComponentName({ prop1, prop2 }: Props) {
  // 1. Hooks first
  const [state, setState] = useState();
  const ref = useRef();

  // 2. Handlers
  const handleAction = () => { };

  // 3. Effects
  useEffect(() => { }, []);

  // 4. Render
  return <div>...</div>;
}
```

### Documentation Style
```typescript
/**
 * @fileoverview Brief file description
 */

/**
 * Function description
 * @param param1 - Description
 * @returns Description
 * @throws When condition
 * @see DESIGN_SYSTEM.md - Part X
 */
function example(param1: string): number { }
```

### Formatting Standards
- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Line length**: 100 chars (soft)
- **Trailing commas**: In multi-line objects/arrays

## Swift (iOS)

### File Naming
- **Views**: PascalCase (`OptaApp.swift`, `ContentView.swift`)
- **ViewModels**: PascalCase with ViewModel suffix
- **Services**: PascalCase (`CameraService.swift`)
- **Tests**: PascalCase with `Tests` suffix

### Naming Patterns
```swift
// Functions: camelCase
func updateScore() { }

// Variables: camelCase
var currentScore = 0
let isLoading = false

// Types: PascalCase
struct SystemMetrics { }
enum MomentumState { }

// Property wrappers
@State private var value = 0
@EnvironmentObject var viewModel: ViewModel
```

### View Pattern
```swift
/// View description
struct ViewName: View {
    // State properties first
    @State private var value = 0

    // Environment
    @EnvironmentObject var viewModel: ViewModel

    // Body
    var body: some View {
        // View hierarchy
    }
}
```

### Documentation Style
```swift
//
//  FileName.swift
//  ProjectName
//
//  Description of the file.
//

/// Brief description
/// - Parameter param: Description
/// - Returns: Description
func example(param: String) -> Int { }
```

### Formatting Standards
- **Indentation**: 4 spaces
- **Line length**: 120 chars

## Rust (Shared Libraries)

### File Naming
- **Modules**: snake_case (`telemetry.rs`, `mod.rs`)
- **Tests**: snake_case, in `tests/` directory or `_test.rs` suffix

### Naming Patterns
```rust
// Functions: snake_case
fn get_processes() { }
pub fn send_telemetry() -> Result<(), Error> { }

// Variables: snake_case
let process_list = vec![];
let is_running = true;

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES: u32 = 3;

// Types: PascalCase
struct SystemMetrics { }
enum RingState { }
```

### Module Pattern
```rust
//! Module description
//!
//! # Usage
//! Examples and explanation

pub struct PublicType { /* ... */ }

/// Public function description
///
/// # Errors
/// Returns error when...
pub fn public_function() -> Result<T, E> {
    // Implementation
}
```

### Error Handling
```rust
// Use thiserror for error types
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

// Propagate with ?
fn example() -> Result<(), AppError> {
    let data = read_file()?;
    Ok(())
}
```

### Formatting Standards
- **Indentation**: 4 spaces
- **Line length**: 100 chars
- **Tool**: `rustfmt`

## Design System Requirements (MANDATORY)

### Typography
- **Desktop/Web**: Sora font exclusively
- **iOS**: SF Pro with Dynamic Type support

### Colors
```css
/* All colors as CSS variables, NEVER hardcoded */
--background: #09090b;  /* OLED-optimized, not #000000 */
--primary: hsl(265 90% 65%);  /* Electric Violet */
--secondary: hsl(265 50% 20%);  /* Dormant Violet */
```

### Glass Effects
```typescript
// Always use glass classes for containers
<div className="glass">...</div>
<div className="glass-subtle">...</div>
<div className="glass-strong">...</div>
```

### Animations (TypeScript/React)
```typescript
// Framer Motion ONLY - no CSS transitions
import { motion, AnimatePresence } from 'framer-motion';

// Spring physics presets
const spring = { response: 0.3, dampingFraction: 0.7 };
```

### Icons
```typescript
// Lucide React ONLY - never inline SVGs
import { Settings, ChevronRight } from 'lucide-react';
```
```swift
// SF Symbols ONLY for iOS
Image(systemName: "gear")
```

## Linting & Tools

### TypeScript
- **ESLint**: Next.js configs (`eslint.config.mjs`)
- **TypeScript**: Strict mode enabled
- **Path aliases**: `@/*` maps to `./src/*`

### Rust
```bash
cargo check                          # Type checking
cargo clippy -- -W clippy::pedantic  # Linting
cargo fmt --check                    # Formatting
```

### Swift
- **SwiftLint**: Standard rules
- **SwiftFormat**: Default configuration
