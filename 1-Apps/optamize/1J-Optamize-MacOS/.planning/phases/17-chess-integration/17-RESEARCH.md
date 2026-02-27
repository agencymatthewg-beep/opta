# Phase 17: Chess Integration - Research

**Researched:** 2026-01-16
**Domain:** Ambient chess experience with AI opponents in a React/Tauri desktop application
**Confidence:** HIGH

<research_summary>
## Summary

Researched the JavaScript/TypeScript chess ecosystem for building an ambient chess experience with three modes and AI opponents. The standard approach uses **chess.js** for game logic (move validation, PGN/FEN, game state) combined with **react-chessboard** for the UI, and **Stockfish WASM** for AI opponents.

Key finding: The chess ecosystem is mature and well-defined. Don't hand-roll move validation, game state management, or AI—use chess.js and Stockfish. The challenge isn't technology selection but UX design for "ambient" chess that feels relaxed and non-competitive.

**Primary recommendation:** Use chess.js + react-chessboard + stockfish (WASM) stack. Design three distinct modes (Casual Play, Puzzles, Analysis) with relaxed UX patterns from casual gaming. Stockfish Skill Level 0-20 provides difficulty adjustment without custom AI.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chess.js | 1.4.0 | Game logic, move validation, FEN/PGN | De facto standard, TypeScript native, handles all chess rules |
| react-chessboard | 5.8.6 | Board UI component | Modern, maintained, TypeScript support, drag-and-drop |
| stockfish | 17.1.0 | AI opponent (WASM) | Strongest engine, WASM port, adjustable difficulty |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | 4.4.x | Chess state management | Already in Opta stack, manages game state |
| framer-motion | - | Board animations | Already in Opta stack, piece movement animations |
| uuid | - | Game session IDs | Already in Opta stack, unique game identifiers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-chessboard | cm-chessboard | cm-chessboard is vanilla JS, needs wrapper for React |
| react-chessboard | chessboard.jsx | Unmaintained, react-chessboard is its successor |
| stockfish | Maia Chess | Maia is more "human-like" but requires more setup |
| stockfish | lc0 (Leela Chess Zero) | Heavier, GPU-dependent, overkill for casual play |

**Installation:**
```bash
npm install chess.js react-chessboard stockfish
```

**TypeScript types:**
chess.js and react-chessboard ship with TypeScript definitions. Stockfish WASM requires manual types for UCI communication.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── features/
│   └── chess/
│       ├── components/
│       │   ├── ChessBoard.tsx        # Wrapper around react-chessboard
│       │   ├── GameControls.tsx      # New game, undo, resign
│       │   ├── MoveHistory.tsx       # Move list display
│       │   ├── DifficultySelector.tsx # AI strength picker
│       │   └── ModeSelector.tsx      # Casual/Puzzle/Analysis tabs
│       ├── hooks/
│       │   ├── useChessGame.ts       # Game state and logic
│       │   ├── useStockfish.ts       # AI opponent communication
│       │   └── usePuzzle.ts          # Puzzle mode logic
│       ├── stores/
│       │   └── chessStore.ts         # Zustand store for chess state
│       ├── types/
│       │   └── chess.ts              # TypeScript interfaces
│       └── utils/
│           ├── stockfishWorker.ts    # Web Worker for Stockfish
│           └── puzzleDatabase.ts     # Puzzle storage/loading
├── pages/
│   └── ChessPage.tsx                 # Main chess feature page
```

### Pattern 1: Chess Game Hook
**What:** Custom hook wrapping chess.js with React state
**When to use:** All chess game interactions
**Example:**
```typescript
// Source: chess.js docs + React patterns
import { Chess, Move } from 'chess.js';
import { useState, useCallback } from 'react';

interface UseChessGameOptions {
  initialFen?: string;
  onGameOver?: (result: 'checkmate' | 'stalemate' | 'draw') => void;
}

export function useChessGame(options: UseChessGameOptions = {}) {
  const [game] = useState(() => new Chess(options.initialFen));
  const [fen, setFen] = useState(game.fen());
  const [history, setHistory] = useState<Move[]>([]);

  const makeMove = useCallback((move: { from: string; to: string; promotion?: string }) => {
    try {
      const result = game.move(move);
      if (result) {
        setFen(game.fen());
        setHistory(game.history({ verbose: true }));

        if (game.isGameOver()) {
          if (game.isCheckmate()) options.onGameOver?.('checkmate');
          else if (game.isStalemate()) options.onGameOver?.('stalemate');
          else options.onGameOver?.('draw');
        }
        return result;
      }
    } catch {
      return null;
    }
    return null;
  }, [game, options]);

  const reset = useCallback(() => {
    game.reset();
    setFen(game.fen());
    setHistory([]);
  }, [game]);

  return { game, fen, history, makeMove, reset, isGameOver: game.isGameOver() };
}
```

### Pattern 2: Stockfish Web Worker Communication
**What:** UCI protocol communication via Web Worker
**When to use:** AI opponent moves, position analysis
**Example:**
```typescript
// Source: stockfish.js docs + lichess patterns
class StockfishEngine {
  private worker: Worker;
  private resolveMove: ((move: string) => void) | null = null;

  constructor() {
    // Stockfish WASM runs in Web Worker for non-blocking
    this.worker = new Worker(new URL('stockfish.js', import.meta.url));
    this.worker.onmessage = this.handleMessage.bind(this);
    this.sendCommand('uci');
  }

  private sendCommand(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private handleMessage(event: MessageEvent) {
    const line = event.data;
    if (line.startsWith('bestmove')) {
      const move = line.split(' ')[1];
      this.resolveMove?.(move);
      this.resolveMove = null;
    }
  }

  setSkillLevel(level: number) {
    // Skill Level 0-20, where 20 is strongest
    this.sendCommand(`setoption name Skill Level value ${level}`);
  }

  async getBestMove(fen: string, thinkTime = 1000): Promise<string> {
    return new Promise((resolve) => {
      this.resolveMove = resolve;
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go movetime ${thinkTime}`);
    });
  }

  destroy() {
    this.worker.terminate();
  }
}
```

### Pattern 3: Three-Mode Architecture
**What:** Separate game modes with shared board component
**When to use:** Mode switching between Casual/Puzzle/Analysis
**Example:**
```typescript
// Mode types
type ChessMode = 'casual' | 'puzzle' | 'analysis';

interface ModeConfig {
  casual: {
    aiEnabled: boolean;
    skillLevel: number;      // 0-20
    timeControl: null;       // Ambient = no time pressure
  };
  puzzle: {
    puzzleId: string;
    targetMoves: string[];   // Solution moves
    hintsEnabled: boolean;
  };
  analysis: {
    showEngine: boolean;     // Show Stockfish evaluation
    showArrows: boolean;     // Show best move arrows
    depth: number;           // Analysis depth
  };
}

// Mode-specific behavior in ChessBoard wrapper
function ChessBoard({ mode, config }: { mode: ChessMode; config: ModeConfig[typeof mode] }) {
  // Board renders the same, behavior differs by mode
}
```

### Anti-Patterns to Avoid
- **Custom move validation:** chess.js handles all rules including en passant, castling, promotion
- **Stockfish in main thread:** Always use Web Worker, WASM blocks UI
- **State duplication:** chess.js IS the source of truth, don't mirror state
- **Synchronous AI:** AI thinking must be async with visual feedback
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Move validation | Custom legal move checking | chess.js `.move()` | 100+ edge cases (castling rights, en passant, pins) |
| Game state | Manual piece tracking | chess.js `.fen()` / `.pgn()` | FEN/PGN are standards, chess.js handles them |
| Check/checkmate detection | Custom king threat analysis | chess.js `.isCheck()` / `.isCheckmate()` | Complex pattern, already solved |
| AI opponent | Custom minimax/alpha-beta | Stockfish WASM | Decades of optimization, adjustable strength |
| Board rendering | Custom SVG/Canvas board | react-chessboard | Drag-drop, animations, accessibility built-in |
| Puzzles | Custom puzzle generation | Lichess puzzle database | 3M+ puzzles available, rated by difficulty |
| Opening theory | Custom opening book | Lichess opening explorer API | Community-maintained, comprehensive |

**Key insight:** Chess is a solved UI/logic problem. The entire stack from board rendering to grandmaster-level AI exists as mature, tested libraries. The innovation space is UX (ambient/relaxed play), not technology. Building custom chess logic wastes time and introduces bugs in well-understood territory.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Stockfish Blocking Main Thread
**What goes wrong:** UI freezes during AI thinking
**Why it happens:** Stockfish WASM runs synchronously if not in Worker
**How to avoid:** Always instantiate Stockfish in a Web Worker, use async/await for moves
**Warning signs:** Board unresponsive after player move, frozen animations

### Pitfall 2: FEN/State Desync
**What goes wrong:** Board shows different position than game logic
**Why it happens:** Maintaining separate state from chess.js
**How to avoid:** Always derive board position from `game.fen()`, single source of truth
**Warning signs:** Illegal moves appearing possible, pieces in wrong places after undo

### Pitfall 3: Stockfish Skill Level Confusion
**What goes wrong:** AI too strong or too weak for intended difficulty
**Why it happens:** Misunderstanding Skill Level scale (0-20, not ELO)
**How to avoid:** Map user-friendly levels (Beginner/Intermediate/Advanced) to Skill Levels
**Warning signs:** Beginners getting destroyed, advanced players finding no challenge

**Skill Level mapping recommendation:**
- Beginner (casual): Skill Level 0-3 (plays obvious blunders)
- Casual: Skill Level 4-8 (club player level)
- Intermediate: Skill Level 9-13 (strong amateur)
- Advanced: Skill Level 14-17 (expert)
- Maximum: Skill Level 18-20 (near-perfect play)

### Pitfall 4: Puzzle Mode False Failures
**What goes wrong:** Correct moves rejected as wrong
**Why it happens:** Multiple valid moves, different move notations
**How to avoid:** Normalize moves to SAN, accept alternative winning lines
**Warning signs:** Users complaining "my move was also good"

### Pitfall 5: Memory Leaks from Stockfish
**What goes wrong:** App slowdown over time
**Why it happens:** Not terminating Web Workers when unmounting
**How to avoid:** Clean up worker in useEffect cleanup function
**Warning signs:** Memory growth in dev tools, lag after many games
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Basic react-chessboard + chess.js Integration
```typescript
// Source: react-chessboard docs + chess.js docs
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useState, useMemo } from 'react';

function ChessGame() {
  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(game.fen());

  function onDrop(sourceSquare: string, targetSquare: string) {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Always promote to queen for simplicity
      });

      if (move) {
        setFen(game.fen());
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  return (
    <Chessboard
      position={fen}
      onPieceDrop={onDrop}
      boardOrientation="white"
      customBoardStyle={{
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
    />
  );
}
```

### Stockfish AI Response
```typescript
// Source: stockfish.js UCI protocol docs
async function getAIMove(fen: string, skillLevel: number): Promise<string> {
  const worker = new Worker('/stockfish.js');

  return new Promise((resolve) => {
    let initialized = false;

    worker.onmessage = (e) => {
      const line = e.data;

      if (line === 'uciok') {
        initialized = true;
        worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage('go movetime 1000'); // Think for 1 second
      }

      if (line.startsWith('bestmove') && initialized) {
        const move = line.split(' ')[1]; // e.g., "e2e4"
        worker.terminate();
        resolve(move);
      }
    };

    worker.postMessage('uci');
  });
}
```

### Move History Display
```typescript
// Source: chess.js history() API
function MoveHistory({ game }: { game: Chess }) {
  const moves = game.history({ verbose: true });

  // Group into pairs (white move, black move)
  const movePairs: [Move, Move?][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push([moves[i], moves[i + 1]]);
  }

  return (
    <div className="move-history">
      {movePairs.map(([white, black], i) => (
        <div key={i} className="move-pair">
          <span className="move-number">{i + 1}.</span>
          <span className="white-move">{white.san}</span>
          {black && <span className="black-move">{black.san}</span>}
        </div>
      ))}
    </div>
  );
}
```

### Ambient Chess UX Pattern - Relaxed Timer
```typescript
// Pattern for "ambient" feel - no time pressure, gentle prompts
function AmbientChessGame() {
  const [showHint, setShowHint] = useState(false);
  const [lastMoveTime, setLastMoveTime] = useState(Date.now());

  // After 30 seconds of inactivity, gently suggest it's player's turn
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastMoveTime > 30000 && !showHint) {
        setShowHint(true);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [lastMoveTime, showHint]);

  // Hint is subtle, not urgent
  return (
    <div>
      <ChessBoard />
      {showHint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          className="text-muted-foreground text-sm"
        >
          Take your time...
        </motion.div>
      )}
    </div>
  );
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| chessboard.js (vanilla) | react-chessboard | 2022+ | React-native integration, maintained |
| Stockfish JS (asm.js) | Stockfish WASM | 2020+ | 2-3x faster, smaller bundle |
| Manual skill tuning | Stockfish Skill Level UCI | Native | Consistent difficulty scaling |
| Custom puzzle DB | Lichess puzzle API | Available | 3M+ rated puzzles, free |

**New tools/patterns to consider:**
- **Maia Chess:** Human-like engine that plays "human" moves at specific ELO levels (1100-1900). Better for training than Stockfish's artificial weakness. Worth evaluating for "Casual" mode.
- **NNUE evaluation:** Stockfish 12+ uses neural network evaluation. Enabled by default in stockfish npm package.
- **WebGPU for engine:** Not yet mainstream, but Lc0 experiments show potential. Monitor for 2026.

**Deprecated/outdated:**
- **chessboardjsx:** Unmaintained, use react-chessboard instead
- **stockfish.js (asm.js build):** Use WASM build for performance
- **Chess.com API for puzzles:** Rate-limited, prefer Lichess (fully open)
</sota_updates>

<three_modes_design>
## Three Modes Architecture

Based on Opta's "ambient chess" concept and research into chess UX patterns:

### Mode 1: Casual Play (Ambient)
**Philosophy:** Relaxed, no-pressure games against AI
**Features:**
- Adjustable AI difficulty (Stockfish Skill Level mapped to friendly names)
- No time control (take as long as you want)
- Undo available (learning-friendly)
- Optional hints ("show best move")
- Gentle notifications, no alerts
- Game auto-saves, resume anytime

**UX Patterns:**
- Soft colors, subtle animations
- No win/loss tracking visible (unless requested)
- "Take your time" messaging
- Background music/ambient sounds optional

### Mode 2: Puzzles (Training)
**Philosophy:** Bite-sized tactical challenges
**Features:**
- Lichess puzzle database integration (rated 500-3000)
- Difficulty auto-adjusts based on performance
- "Streak" gamification (optional)
- Hints available (reduces score)
- Explanation after solve/fail

**UX Patterns:**
- Single focused objective
- Clear success/failure feedback
- Progress tracking
- Short sessions (5-10 puzzles)

### Mode 3: Analysis (Learning)
**Philosophy:** Deep dive into positions and games
**Features:**
- Stockfish evaluation bar
- Best move arrows
- Opening explorer (what do masters play here?)
- Import PGN from other games
- Annotate with comments

**UX Patterns:**
- Information-rich but organized
- Toggle-able overlays
- Export/share analysis
</three_modes_design>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Maia vs Stockfish for Casual Mode**
   - What we know: Maia plays more "human" moves, Stockfish with low skill level makes random blunders
   - What's unclear: Whether Maia's setup complexity is worth it for better UX
   - Recommendation: Start with Stockfish Skill Level (simpler), evaluate Maia in v2.1 if feedback suggests AI feels "artificial"

2. **Puzzle Source: Local vs API**
   - What we know: Lichess has 3M+ puzzles via API, could also download subset locally
   - What's unclear: Offline support requirements for Opta (Tauri desktop app)
   - Recommendation: Start with API, cache recent puzzles locally. Evaluate full offline DB if users request it.

3. **Board Theming Integration**
   - What we know: react-chessboard supports custom themes via CSS/props
   - What's unclear: How to integrate with Opta's glass/neon design system elegantly
   - Recommendation: Create custom board theme matching Opta aesthetics during implementation. Consider dark wood + neon highlights.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [/jhlywa/chess.js](https://github.com/jhlywa/chess.js) - Context7: API, FEN/PGN, move validation
- [/clariity/react-chessboard](https://github.com/Clariity/react-chessboard) - Context7: props, styling, events
- [/nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) - Context7: UCI protocol, WASM setup
- [/lichess-org/stockfish-web](https://github.com/lichess-org/stockfish-web) - Context7: production WASM builds

### Secondary (MEDIUM confidence)
- [Stockfish UCI Commands](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html) - Skill Level documentation
- [Stockfish Skill Level discussion](https://github.com/official-stockfish/Stockfish/issues/3635) - Calibration info
- [Lichess Architecture](https://github.com/lichess-org/lila) - Production chess platform patterns
- [react-chessboard npm](https://www.npmjs.com/package/react-chessboard) - Version verification

### Tertiary (LOW confidence - needs validation)
- [Medium: Chess App with React](https://medium.com/@wispa.sultan/my-journey-building-a-chess-app-with-react-typescript-and-chess-js-81b55b861a63) - Integration patterns
- [Casual Game UX](https://pixune.com/blog/hypercasual-games-ui-ux-design-guide/) - Ambient gaming patterns
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: chess.js, react-chessboard, Stockfish WASM
- Ecosystem: Lichess puzzle API, opening explorer
- Patterns: Three-mode architecture, ambient UX, AI difficulty scaling
- Pitfalls: Worker threads, state sync, skill level calibration

**Confidence breakdown:**
- Standard stack: HIGH - verified with Context7, npm, widely used in production (Lichess)
- Architecture: HIGH - patterns from Context7 docs and Lichess open source
- Pitfalls: HIGH - documented in GitHub issues and community forums
- Code examples: HIGH - from Context7/official sources
- Three-mode design: MEDIUM - extrapolated from research, needs UX validation

**Research date:** 2026-01-16
**Valid until:** 2026-02-16 (30 days - chess ecosystem is stable)
</metadata>

---

*Phase: 17-chess-integration*
*Research completed: 2026-01-16*
*Ready for planning: yes*
