/**
 * Chess components for Opta.
 *
 * Provides UI components for the chess feature:
 * - ChessBoard: Interactive chess board with Opta glass styling
 * - GameControls: Difficulty selector and game actions
 * - MoveHistory: Move history display with scroll
 * - ChessWidget: Floating draggable quick-access widget (Phase 51)
 * - ChessWidgetStatus: Glanceable status for collapsed widget
 * - ChessWidgetTabs: Three-tab navigation (Play/Puzzles/Tutor)
 * - MiniChessBoard: Compact chess board for widget
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
