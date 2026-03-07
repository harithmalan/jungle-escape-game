"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- CONFIGURATION ---

const BIRD_WIDTH = 110;  // <-- Increased width
const BIRD_HEIGHT = 110; // <-- Increased height
const BIRD_X = 120; // Fixed left position

// Bird Sprite Sheet Data (based on image_5.png)
const SPRITE_SHEET_FRAMES = 6;
const SPRITE_COLUMNS = 3;
const SPRITE_ROWS = 2;
const FRAME_DURATION = 100; // Time in ms per frame (animation speed)

// Physics
const GRAVITY = 0.08; // Floaty gravity
const JUMP_STRENGTH = -4; // Tuned for floaty gravity

// Obstacles
const PIPE_WIDTH = 119; 

interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}

export default function JungleEscapeGame() {
  // Screen Dimensions for Fullscreen
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Game State
  const [birdPos, setBirdPos] = useState(300);
  const [velocity, setVelocity] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  
  // Animation State: Current frame from 0 to 5
  const [currentAnimationFrame, setCurrentAnimationFrame] = useState(0);
  
  // Revive Mechanic State
  const [hasUsedRevive, setHasUsedRevive] = useState(false);
  const [showPuzzle, setShowPuzzle] = useState(false);
  const [puzzleData, setPuzzleData] = useState<{ question: string, solution: number } | null>(null);
  const [userAnswer, setUserAnswer] = useState("");

  const gameLoopRef = useRef<number>();

  // Handle Fullscreen Window Resizing
  useEffect(() => {
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Timer logic for the countdown
  useEffect(() => {
    if (countdown === null || isPaused) return; 
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(null);
      setGameStarted(true);
    }
  }, [countdown, isPaused]);

  const initiateGame = () => {
    setBirdPos(dimensions.height / 2); // Start in middle of screen
    setVelocity(0);
    setPipes([]);
    setScore(0);
    setGameOver(false);
    setGameStarted(false); 
    setHasUsedRevive(false);
    setIsPaused(false);
    setCountdown(3); // Start the 5-second countdown
    setCurrentAnimationFrame(0); // Reset animation
  };

  const goToMainMenu = () => {
    setGameStarted(false);
    setGameOver(false);
    setIsPaused(false);
    setScore(0);
    setBirdPos(dimensions.height / 2);
    setPipes([]);
    setCountdown(null);
    setHasUsedRevive(false);
  };

  const togglePause = useCallback(() => {
    if ((gameStarted || countdown !== null) && !gameOver && !showPuzzle) {
      setIsPaused((prev) => !prev);
    }
  }, [gameStarted, countdown, gameOver, showPuzzle]);

  const jump = useCallback(() => {
    if (!gameOver && gameStarted && countdown === null && !isPaused) {
      setVelocity(JUMP_STRENGTH);
    } else if (!gameStarted && dimensions.width > 0 && countdown === null && !gameOver && !showPuzzle) {
      initiateGame();
    }
  }, [gameOver, gameStarted, dimensions, countdown, isPaused, showPuzzle]);

  // Handle Keyboard Input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault(); // Prevent scrolling
        jump();
      }
      if (e.code === "Escape" || e.code === "KeyP") {
        togglePause();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [jump, togglePause]);

  // Fetch Puzzle API
  const fetchPuzzle = async () => {
    try {
      const res = await fetch('/api/puzzle');
      const data = await res.json();
      setPuzzleData(data);
      setShowPuzzle(true);
    } catch (err) {
      console.error("Error fetching puzzle", err);
      setGameOver(true);
    }
  };

  const handlePuzzleSubmit = () => {
    if (puzzleData && parseInt(userAnswer) === puzzleData.solution) {
      setShowPuzzle(false);
      setGameOver(false);
      setHasUsedRevive(true);
      setBirdPos(dimensions.height / 2);
      setVelocity(0);
      setUserAnswer("");
      setPipes(prev => prev.map(p => ({ ...p, x: p.x + 400 }))); // Clear nearby pipes
      
      setGameStarted(false);
      setCountdown(3); // Pre-revive countdown
      setCurrentAnimationFrame(0); // Reset animation
    } else {
      alert("Uh oh! Incorrect. The jungle remains blocked.");
      setShowPuzzle(false);
      setGameOver(true);
    }
  };

  // Dynamic Difficulty Scaling
  const currentSpeed = Math.min(3 + score * 0.2, 11); 
  const currentPipeGap = Math.max(360 - score * 3, 160); 

  // Core Game Loop
  useEffect(() => {
    if (gameStarted && !gameOver && !showPuzzle && dimensions.height > 0 && countdown === null && !isPaused) {
      const update = () => {
        setBirdPos((pos) => {
          const newPos = pos + velocity;
          if (newPos > dimensions.height - BIRD_HEIGHT || newPos < 0) {
            handleGameOver();
            return pos;
          }
          return newPos;
        });

        setVelocity((v) => v + GRAVITY);

        setPipes((prevPipes) => {
          const lastPipe = prevPipes[prevPipes.length - 1];
          
          if (!lastPipe || lastPipe.x < dimensions.width - 500) {
            const minPipeHeight = 100;
            const maxPipeHeight = dimensions.height - currentPipeGap - minPipeHeight;
            const topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1) + minPipeHeight);
            
            prevPipes.push({ x: dimensions.width, topHeight, passed: false });
          }

          return prevPipes
            .map((pipe) => {
              const newX = pipe.x - currentSpeed;
              
              const birdRect = { top: birdPos, bottom: birdPos + BIRD_HEIGHT, left: BIRD_X, right: BIRD_X + BIRD_WIDTH };
              const topPipeRect = { top: 0, bottom: pipe.topHeight, left: newX, right: newX + PIPE_WIDTH };
              const bottomPipeRect = { top: pipe.topHeight + currentPipeGap, bottom: dimensions.height, left: newX, right: newX + PIPE_WIDTH };

              if (
                (birdRect.right > topPipeRect.left && birdRect.left < topPipeRect.right && birdRect.top < topPipeRect.bottom) ||
                (birdRect.right > bottomPipeRect.left && birdRect.left < bottomPipeRect.right && birdRect.bottom > bottomPipeRect.top)
              ) {
                handleGameOver();
              }

              if (!pipe.passed && newX + PIPE_WIDTH < BIRD_X) {
                setScore(s => s + 1);
                pipe.passed = true;
              }

              return { ...pipe, x: newX };
            })
            .filter((pipe) => pipe.x > -PIPE_WIDTH);
        });

        gameLoopRef.current = requestAnimationFrame(update);
      };

      gameLoopRef.current = requestAnimationFrame(update);
      return () => cancelAnimationFrame(gameLoopRef.current!);
    }
  }, [gameStarted, gameOver, velocity, birdPos, showPuzzle, dimensions, score, currentSpeed, currentPipeGap, countdown, isPaused]);

  // ANIMATION LOOP: Separated from the physics loop for independent control
  useEffect(() => {
    // Only animate if the game is active, not paused, and not solving puzzle
    if (!gameOver && !isPaused && !showPuzzle && dimensions.width > 0) {
        const animationInterval = setInterval(() => {
            setCurrentAnimationFrame((prev) => (prev + 1) % SPRITE_SHEET_FRAMES);
        }, FRAME_DURATION);
        
        return () => clearInterval(animationInterval);
    }
  }, [gameOver, isPaused, showPuzzle, dimensions]);

  const handleGameOver = () => {
    cancelAnimationFrame(gameLoopRef.current!);
    setGameOver(true);
  };

  // Prevent loading hydration errors
  if (dimensions.width === 0) return <div className="min-h-screen bg-[#2D5E37]"></div>;

  return (
    <div 
      className="relative w-screen h-screen bg-[url('/jungle-clearing.png')] bg-cover bg-no-repeat overflow-hidden select-none cursor-pointer text-[#FDF0C6] font-sans"
      onClick={jump}
    >
      {/* Bottom Ground line */}
      <div className="absolute bottom-0 w-full h-8 bg-[#D2A967] border-t-8 border-[#2D5E37] z-10"></div>
      
      {/* Top UI Bar (Score & Pause) */}
      {(gameStarted || countdown !== null) && !gameOver && !showPuzzle && (
        <div className="absolute top-10 w-full flex justify-between items-start px-12 z-20 pointer-events-none">
          <div className="flex-1"></div>
          <div className="flex-1 text-center">
            {/* Score in 'Wood-carved' style box */}
            <div className="inline-block bg-[#735D39] px-10 py-4 rounded-xl border-4 border-[#3D301C] shadow-[0_5px_0_rgba(0,0,0,0.3)]">
                <span className="text-7xl font-black tracking-wider text-[#FDF0C6] drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]">
                  {score}
                </span>
            </div>
          </div>
          <div className="flex-1 flex justify-end pointer-events-auto">
            {/* Pause in 'Wood-carved' style button */}
            <button 
              onClick={(e) => { e.stopPropagation(); togglePause(); }}
              className="bg-[#735D39] hover:bg-[#8D7248] active:translate-y-1 border-4 border-[#3D301C] w-16 h-16 rounded-2xl flex items-center justify-center shadow-[0_6px_0_rgba(0,0,0,0.4)] transition-all"
            >
              <div className="flex gap-2">
                <div className="w-2.5 h-7 bg-[#FDF0C6] rounded-sm shadow-inner"></div>
                <div className="w-2.5 h-7 bg-[#FDF0C6] rounded-sm shadow-inner"></div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Countdown Overlay */}
      {countdown !== null && countdown > 0 && !isPaused && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/10 pointer-events-none">
          <span className="text-[200px] font-black text-[#50E3C2] drop-shadow-[0_8px_0_rgba(0,0,0,0.7)] animate-pulse">
            {countdown}
          </span>
        </div>
      )}

      {/* --- THE BIRD (New Animated Model) --- */}
      <div 
        className="absolute z-20 transition-transform"
        style={{ 
          width: `${BIRD_WIDTH}px`, 
          height: `${BIRD_HEIGHT}px`, 
          left: BIRD_X, 
          top: birdPos,
          transform: `rotate(${Math.min(velocity * 4, 90)}deg)`,
          transition: isPaused ? 'none' : 'transform 0.1s ease-out',
          
          // --- SPRITESHEET ANIMATION LOGIC ---
          backgroundImage: `url('/jungle-bird-spritesheet.png')`,
          // 1. Scaled Size: How big the entire spritesheet should be when scaled to match your bird's dimensions.
          backgroundSize: `${BIRD_WIDTH * SPRITE_COLUMNS}px ${BIRD_HEIGHT * SPRITE_ROWS}px`,
          // 2. Position Calculation: Moves the spritesheet so only the correct frame is visible.
          backgroundPosition: (() => {
            const frameIndex = currentAnimationFrame % SPRITE_SHEET_FRAMES;
            const col = frameIndex % SPRITE_COLUMNS;
            const row = Math.floor(frameIndex / SPRITE_COLUMNS);
            // X position is column times scaled width, Y is row times scaled height.
            return `-${col * BIRD_WIDTH}px -${row * BIRD_HEIGHT}px`;
          })(),
        }}
      />

      {/* THE OBSTACLES (Stylized Jungle Plants) */}
      {pipes.map((pipe, i) => (
        <React.Fragment key={i}>
          {/* Top Plant/Vine/Structure */}
          <div 
            className="absolute bg-[#1A3D1E] border-x-4 border-black z-10"
            style={{ width: PIPE_WIDTH, height: pipe.topHeight, left: pipe.x, top: 0 }}
          >
            {/* Moss/Vines vector textures */}
            <div className="absolute inset-0 bg-[url('/moss-texture.png')] opacity-10"></div>
            
            {/* Cap: massive stylized green jungle leaf block */}
            <div className="absolute bottom-0 left-[-4px] w-[118px] h-12 bg-[#2D5E37] border-4 border-black rounded-b-xl shadow-[0_5px_0_rgba(0,0,0,0.5)]">
                {/* Inside details: lighter green vector pattern */}
                <div className="absolute bottom-1 right-1.5 w-4 h-4 bg-[#67B96D] rounded-full border-2 border-black"></div>
                <div className="absolute bottom-1 right-1.5 w-4 h-4 bg-[#67B96D] rounded-full border-2 border-black opacity-40"></div>
            </div>
          </div>
          {/* Bottom Plant/Vine/Structure */}
          <div 
            className="absolute bg-[#1A3D1E] border-x-4 border-black z-10"
            style={{ width: PIPE_WIDTH, height: dimensions.height - (pipe.topHeight + currentPipeGap), left: pipe.x, top: pipe.topHeight + currentPipeGap }}
          >
            {/* Moss/Vines vector textures */}
            <div className="absolute inset-0 bg-[url('/moss-texture.png')] opacity-10"></div>
            
            {/* Cap: massive stylized green jungle leaf block */}
            <div className="absolute top-0 left-[-4px] w-[118px] h-12 bg-[#2D5E37] border-4 border-black rounded-t-xl shadow-[0_-5px_0_rgba(0,0,0,0.5)]">
                 {/* Inside details: lighter green vector pattern */}
                <div className="absolute top-1 left-1.5 w-4 h-4 bg-[#67B96D] rounded-full border-2 border-black"></div>
                <div className="absolute top-1 left-1.5 w-4 h-4 bg-[#67B96D] rounded-full border-2 border-black opacity-40"></div>
            </div>
          </div>
        </React.Fragment>
      ))}

      {/* MAIN START SCREEN OVERLAY */}
      {!gameStarted && countdown === null && !gameOver && !showPuzzle && (
        <div className="absolute inset-0 bg-black/10 flex flex-col items-center justify-center z-30 p-10 backdrop-blur-sm">
          <div className="text-center bg-[#735D39] border-8 border-[#3D301C] p-12 rounded-3xl shadow-[0_15px_0_rgba(0,0,0,0.6)]">
            <h1 className="text-8xl font-black text-[#FDF0C6] drop-shadow-[0_8px_0_rgba(0,0,0,0.7)] mb-12 tracking-wider">
                JUNGLE ESCAPE
            </h1>
            <button 
                onClick={(e) => { e.stopPropagation(); initiateGame(); }}
                className="bg-[#D2A967] hover:bg-[#EC673C] active:translate-y-1 transition-all border-4 border-[#000] px-14 py-6 rounded-full font-black text-[#FDF0C6] text-5xl shadow-[0_10px_0_rgba(0,0,0,1)] drop-shadow-[0_4px_0_rgba(0,0,0,0.3)]"
            >
                START ESCAPE
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MENU MODAL (Wood Carved Look) */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-50 p-4">
          <div 
            className="bg-[#735D39] p-10 rounded-3xl border-8 border-[#3D301C] text-center shadow-[0_15px_0_rgba(0,0,0,0.6)] max-w-lg w-full"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-7xl font-black text-[#FDF0C6] mb-12 drop-shadow-[0_6px_0_rgba(0,0,0,0.7)] tracking-wide">PAUSED</h2>
            
            <button 
              onClick={(e) => { e.stopPropagation(); togglePause(); }}
              className="bg-[#D2A967] hover:bg-[#8D7248] active:translate-y-1 border-4 border-[#000] px-8 py-5 rounded-2xl font-bold text-[#FDF0C6] w-full mb-6 transition-all text-3xl shadow-[0_8px_0_rgba(0,0,0,0.8)]"
            >
              ▶ RESUME ESCAPE
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); goToMainMenu(); }}
              className="bg-[#EC673C] hover:bg-[#8D7248] active:translate-y-1 border-4 border-[#000] px-8 py-5 rounded-2xl font-bold text-[#FDF0C6] w-full transition-all text-3xl shadow-[0_8px_0_rgba(0,0,0,0.8)]"
            >
              🏠 MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal (Wood Carved Look) */}
      {gameOver && !showPuzzle && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-30 p-4">
          <div className="bg-[#735D39] p-10 rounded-3xl border-8 border-[#3D301C] text-center shadow-[0_15px_0_rgba(0,0,0,0.6)] max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-7xl font-black text-[#EC673C] mb-4 drop-shadow-[0_6px_0_rgba(0,0,0,0.7)]">CRASHED!</h2>
            <p className="text-3xl font-bold text-[#FDF0C6] mb-10">Score: {score}</p>
            
            {!hasUsedRevive ? (
              <button 
                onClick={(e) => { e.stopPropagation(); fetchPuzzle(); }}
                className="bg-[#c49447] hover:bg-[#EC673C] active:translate-y-1 border-4 border-[#000] px-8 py-5 rounded-2xl font-bold text-[#FDF0C6] w-full mb-4 transition-all text-2xl shadow-[0_8px_0_rgba(0,0,0,0.8)]"
              >
                SOLVE PUZZLE FOR REVIVE
              </button>
            ) : (
              <p className="text-[#FDF0C6] font-bold mb-6 bg-black/20 p-3 rounded-lg border border-[#000]">Revive protocols complete for this escape.</p>
            )}

            <button 
              onClick={(e) => { e.stopPropagation(); initiateGame(); }}
              className="bg-[#826331] hover:bg-[#8D7248] active:translate-y-1 border-4 border-[#000] px-8 py-5 rounded-2xl font-bold text-[#FDF0C6] w-full mb-4 transition-all text-2xl shadow-[0_8px_0_rgba(0,0,0,0.8)]"
            >
              REINITIALIZE
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); goToMainMenu(); }}
              className="bg-[#EC673C] hover:bg-[#8D7248] active:translate-y-1 border-4 border-[#000] px-8 py-5 rounded-2xl font-bold text-[#FDF0C6] w-full transition-all text-2xl shadow-[0_8px_0_rgba(0,0,0,0.8)]"
            >
              🏠 MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Puzzle Modal (Cartoon Look) */}
      {showPuzzle && puzzleData && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#735D39] p-8 rounded-3xl border-8 border-[#3D301C] max-w-xl w-full shadow-[0_15px_0_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-3xl mb-6 text-center text-[#50E3C2] drop-shadow-[0_4px_0_rgba(0,0,0,0.7)]">Resolve Jungle Anomaly</h3>
            
            <div className="bg-black/20 p-3 rounded-lg mb-8 flex justify-center border-4 border-dashed border-[#FDF0C6] shadow-inner">
              <img src={puzzleData.question} alt="Jungle Anomaly Puzzle" className="max-w-full rounded" />
            </div>

            <div className="flex gap-4">
              <input 
                type="number" 
                className="bg-[#D2A967] border-4 border-[#000] p-4 rounded-xl w-full text-center text-3xl font-bold text-[#FDF0C6] focus:border-[#EC673C] focus:outline-none shadow-inner"
                placeholder="?"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePuzzleSubmit()}
                autoFocus
              />
              <button 
                onClick={handlePuzzleSubmit}
                className="bg-[#67B96D] hover:bg-[#D2A967] active:translate-y-1 border-4 border-[#000] text-[#FDF0C6] px-10 rounded-xl font-black text-2xl transition-all shadow-[0_8px_0_rgba(0,0,0,0.8)]"
              >
                SUBMIT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}