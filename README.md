# AI-Enhanced Minesweeper

An AI-enhanced intelligent Minesweeper game is a web application that combines the classic puzzle gameplay with modern artificial intelligence features. The system provides intelligent hints, adaptive difficulty, and real-time game probability analysis, while maintaining the core puzzle-solving experience and strategic thinking that makes Minesweeper engaging.

## Features

### 🎯 Core Gameplay
- **Classic Minesweeper Rules**: Traditional mine-sweeping with left-click to reveal, right-click to flag
- **Modern Web Interface**: Responsive design that works on desktop and mobile devices
- **Touch Support**: Optimized controls for mobile with tap-to-reveal and long-press-to-flag

### 🤖 AI-Powered Features
- **Intelligent Hints**: AI analyzes the board state and suggests optimal moves with explanations
- **Real-time Probability Analysis**: Visual probability overlays showing mine likelihood for each cell
- **Adaptive Difficulty**: Game automatically adjusts difficulty based on your performance
- **Strategic Analysis**: Post-game analysis highlighting optimal moves and improvement areas

### 🎨 User Experience
- **Multiple Difficulty Levels**: Beginner, Intermediate, Expert, and Custom settings
- **Accessibility Features**: High contrast mode, colorblind-friendly colors, keyboard navigation
- **Performance Optimized**: Web Workers for complex calculations, memory management
- **Responsive Design**: Seamless experience across desktop, tablet, and mobile

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/anushka369/Retro-Revival.git
   cd ai-minesweeper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## How to Play

### Basic Controls
- **Left Click**: Reveal a cell
- **Right Click**: Flag/unflag a cell (mark suspected mines)
- **Get Hint Button**: Request AI assistance for your next move
- **New Game Button**: Start a fresh game

### Keyboard Controls
- **Arrow Keys**: Navigate between cells
- **Enter/Space**: Reveal selected cell
- **F**: Flag selected cell
- **H**: Request hint

### AI Features

#### 1. Smart Hints
The AI analyzes the current board state and provides strategic suggestions:
- Identifies guaranteed safe moves
- Calculates probability-based recommendations when no safe moves exist
- Explains the reasoning behind each suggestion
- Prioritizes moves that reveal maximum information

#### 2. Probability Display
Real-time visual indicators show mine probabilities:
- **Green**: Low probability (safe)
- **Yellow**: Medium probability (caution)
- **Red**: High probability (likely mine)
- **Hover**: Shows exact percentage

#### 3. Adaptive Difficulty
The game learns from your performance:
- **Success**: Gradually increases mine density and board size
- **Struggles**: Reduces difficulty to maintain engagement
- **Manual Override**: Set specific difficulty levels as needed
- **Notifications**: Alerts when difficulty adjustments occur

## Game Modes

### Difficulty Levels

| Level | Board Size | Mines | Density |
|-------|------------|-------|---------|
| Beginner | 9×9 | 10 | 12.3% |
| Intermediate | 16×16 | 40 | 15.6% |
| Expert | 30×16 | 99 | 20.6% |
| Custom | Variable | Variable | Variable |

### Accessibility Options
- **High Contrast Mode**: Enhanced visibility for low-vision users
- **Colorblind Friendly**: Alternative color schemes for color vision differences
- **Keyboard Navigation**: Full game playable without mouse
- **Screen Reader Support**: ARIA labels and semantic markup

## Architecture

The application follows a modular architecture with clear separation of concerns:

```
├── src/
│   ├── game/           # Core game logic and board management
│   ├── ai/             # AI engines (hints, probability, analysis)
│   ├── adaptive/       # Adaptive difficulty and player profiling
│   ├── ui/             # User interface components and rendering
│   ├── interfaces/     # TypeScript interfaces and contracts
│   ├── types/          # Type definitions and enums
│   ├── utils/          # Utility functions and helpers
│   └── workers/        # Web Workers for performance optimization
```

### Key Components

- **GameLogic**: Implements Minesweeper rules and state management
- **ProbabilityCalculator**: Computes mine probabilities using constraint satisfaction
- **HintEngine**: Generates strategic move suggestions
- **AdaptiveDifficultyManager**: Adjusts game parameters based on performance
- **GameRenderer**: Handles canvas-based rendering and animations
- **ProfileManager**: Tracks player statistics and learning progress

## Development

### Project Structure

```
ai-minesweeper/
├── src/                   # Source code
├── tests/                 # Test suites
├── .kiro/specs/           # Feature specifications
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Build configuration
└── vitest.config.ts       # Test configuration
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Run tests with UI
```

### Testing

The project uses a comprehensive testing strategy:

- **Unit Tests**: Vitest for component and function testing
- **Property-Based Tests**: fast-check for universal correctness properties
- **Integration Tests**: End-to-end workflow validation

Run tests:
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode for development
npm run test:ui         # Interactive test UI
```

### Technology Stack

- **Frontend**: TypeScript, HTML5 Canvas, CSS3
- **Build Tool**: Vite
- **Testing**: Vitest, fast-check, jsdom
- **Performance**: Web Workers, Memory Management
- **Architecture**: Modular ES6, Interface-based design

## Performance Features

### Optimization Techniques
- **Web Workers**: Complex probability calculations run in background threads
- **Memory Management**: Automatic cleanup of old game data
- **Canvas Rendering**: Hardware-accelerated graphics for smooth animations
- **Lazy Loading**: Components loaded on-demand
- **Performance Monitoring**: Built-in performance tracking and optimization

### Browser Compatibility
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Support**: iOS Safari, Chrome Mobile, Samsung Internet
- **Progressive Enhancement**: Graceful degradation for older browsers

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Commit changes: `git commit -m "Description"`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

### Code Style
- TypeScript with strict mode enabled
- ESLint for code quality
- Prettier for formatting
- Comprehensive JSDoc comments

### Testing Requirements
- Unit tests for new functionality
- Property-based tests for algorithmic components
- Integration tests for user workflows
- 90%+ code coverage for critical paths

---

**Enjoy playing the AI-Enhanced Minesweeper game!** 🎮💣🤖
