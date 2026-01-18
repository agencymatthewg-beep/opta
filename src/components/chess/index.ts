/**
 * Chess Components - Opta Chess Mastery System
 *
 * Complete chess experience with premium visuals and AI tutoring.
 *
 * Core Components:
 * - ChessBoard: Interactive board with Opta glass styling
 * - GameControls: Difficulty and game actions
 * - MoveHistory: Move history with scroll
 * - MiniChessBoard: Compact board for widget
 *
 * Quick Access (Phase 51):
 * - ChessWidget: Floating draggable widget
 * - ChessWidgetStatus: Glanceable status display
 * - ChessWidgetTabs: Play/Puzzles/Tutor navigation
 *
 * Puzzle System (Phase 52):
 * - PuzzleBoard: Lichess puzzle integration
 *
 * Game Import (Phase 53):
 * - GameCard: Game preview card
 * - GameBrowser: Import and browse games
 * - GameReview: Move-by-move analysis
 *
 * Personal AI (Phase 54):
 * - StyleComparison: Compare with famous players
 * - CloneSettings: AI behavior tuning
 *
 * Ring Tutoring (Phase 55):
 * - LessonOverlay: Ring-synchronized hints
 * - CongratulationBurst: Success celebration
 * - OpeningLesson, TacticLesson, EndgameLesson
 *
 * Premium Board (Phase 56):
 * - PremiumBoard: Material themes
 * - ThemeSelector: Theme picker
 *
 * Settings (Phase 57):
 * - ChessSettingsPanel: Full customization
 */

export { ChessBoard, type ChessBoardProps } from './ChessBoard';
export { GameControls, type GameControlsProps } from './GameControls';
export { MoveHistory, type MoveHistoryProps } from './MoveHistory';
export { ChessWidget, type ChessWidgetProps } from './ChessWidget';
export { ChessWidgetStatus, type ChessWidgetStatusProps } from './ChessWidgetStatus';
export { ChessWidgetTabs, type ChessWidgetTabsProps, type ChessWidgetTab } from './ChessWidgetTabs';
export { MiniChessBoard, type MiniChessBoardProps } from './MiniChessBoard';

// Game archive components (Phase 53)
export { GameCard } from './games/GameCard';
export { GameBrowser, type GameBrowserProps } from './games/GameBrowser';
export { GameReview, type GameReviewProps } from './games/GameReview';

// Premium board components (Phase 56)
export { PremiumBoard, type PremiumBoardProps, ThemeSelector, type ThemeSelectorProps } from './premium';

// Settings components (Phase 57)
export {
  ChessSettingsPanel,
  type ChessSettingsPanelProps,
  type PresetTheme,
  presetThemes,
} from './settings';

// Puzzle components (Phase 52)
export { PuzzleBoard, type PuzzleBoardProps } from './puzzles';

// Tutoring components (Phase 55)
export {
  LessonOverlay,
  CongratulationBurst,
  useCongratulationBurst,
  OpeningLesson,
  TacticLesson,
  EndgameLesson,
  type LessonOverlayProps,
  type CongratulationBurstProps,
  type OpeningLessonProps,
  type TacticLessonProps,
  type EndgameLessonProps,
} from './tutoring';

// Clone/AI components (Phase 54)
export { StyleComparison, CloneSettings } from './clone';
