"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// --- DATABASE SETUP ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BIRD_WIDTH = 110;
const BIRD_HEIGHT = 110;
const BIRD_X = 120;

const SPRITE_SHEET_FRAMES = 6;
const SPRITE_COLUMNS = 3;
const SPRITE_ROWS = 2;
const FRAME_DURATION = 100;

const GRAVITY = 0.08;
const JUMP_STRENGTH = -4;

const PIPE_WIDTH = 119;

interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}

export default function JungleEscapeGame() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const [birdPos, setBirdPos] = useState(300);
  const [velocity, setVelocity] = useState(0);
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const [currentAnimationFrame, setCurrentAnimationFrame] = useState(0);

  const [hasUsedRevive, setHasUsedRevive] = useState(false);
  const [showPuzzle, setShowPuzzle] = useState(false);
  const [puzzleData, setPuzzleData] = useState<{
    question: string;
    solution: number;
  } | null>(null);
  const [userAnswer, setUserAnswer] = useState("");

  // --- FULL STACK STATE ---
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

  const gameLoopRef = useRef<number>();

  // --- AUDIO REFS ---
  const menuBgmRef = useRef<HTMLAudioElement | null>(null);
  const gameBgmRef = useRef<HTMLAudioElement | null>(null);
  const jumpSoundRef = useRef<HTMLAudioElement | null>(null);
  const gameOverSoundRef = useRef<HTMLAudioElement | null>(null);
  const uiClickSoundRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio Objects
  useEffect(() => {
    // Background Musics
    menuBgmRef.current = new Audio("/menu-and-login- welcome-music.mp3");
    menuBgmRef.current.loop = true;
    menuBgmRef.current.volume = 0.4; // Slightly lower BGM volume

    gameBgmRef.current = new Audio("/game-play-sound.mp3");
    gameBgmRef.current.loop = true;
    gameBgmRef.current.volume = 0.4;

    // Sound Effects
    jumpSoundRef.current = new Audio("/game-click.mp3");
    jumpSoundRef.current.volume = 0.6;

    gameOverSoundRef.current = new Audio("/game-over.mp3");
    gameOverSoundRef.current.volume = 0.8;

    uiClickSoundRef.current = new Audio("/button-click.mp3");
    uiClickSoundRef.current.volume = 0.8;
  }, []);

  // --- AUDIO HELPERS ---
  const playJumpSound = () => {
    if (jumpSoundRef.current) {
      jumpSoundRef.current.currentTime = 0;
      jumpSoundRef.current.play().catch(() => {}); // Catch prevents browser autoplay errors
    }
  };

  const playUiClick = () => {
    if (uiClickSoundRef.current) {
      uiClickSoundRef.current.currentTime = 0;
      uiClickSoundRef.current.play().catch(() => {});
    }
  };

  const playGameOverSound = () => {
    if (gameOverSoundRef.current) {
      gameOverSoundRef.current.currentTime = 0;
      gameOverSoundRef.current.play().catch(() => {});
    }
  };

  // Manage Background Music Transitions
  useEffect(() => {
    const isPlayingGame =
      gameStarted &&
      !gameOver &&
      !showPuzzle &&
      !isPaused &&
      countdown === null;

    if (isPlayingGame) {
      menuBgmRef.current?.pause();
      gameBgmRef.current?.play().catch(() => {});
    } else {
      gameBgmRef.current?.pause();
      menuBgmRef.current?.play().catch(() => {});
    }
  }, [gameStarted, gameOver, showPuzzle, isPaused, countdown]);

  // Window Resizing & Auth Listener
  useEffect(() => {
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => {
      window.removeEventListener("resize", handleResize);
      authListener.subscription.unsubscribe();
    };
  }, []);

  // --- AUTHENTICATION FUNCTIONS ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    playUiClick();
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else {
        alert("Success! You can now log in.");
        setAuthMode("login");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) alert(error.message);
      else setShowAuth(false);
    }
    setPassword("");
  };

  const handleSignOut = async () => {
    playUiClick();
    await supabase.auth.signOut();
  };

  // --- LEADERBOARD FUNCTIONS ---
  const fetchLeaderboard = async () => {
    playUiClick();
    const { data, error } = await supabase
      .from("leaderboard")
      .select("username, score")
      .order("score", { ascending: false })
      .limit(10);

    if (data) setLeaderboardData(data);
    setShowLeaderboard(true);
  };

  const submitScoreToDatabase = async (finalScore: number) => {
    if (user && finalScore > 0) {
      const username = user.email.split("@")[0];
      await supabase
        .from("leaderboard")
        .insert([{ username, score: finalScore }]);
    }
  };

  // countdown
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
    setBirdPos(dimensions.height / 2);
    setVelocity(0);
    setPipes([]);
    setScore(0);
    setGameOver(false);
    setGameStarted(false);
    setHasUsedRevive(false);
    setIsPaused(false);
    setCountdown(3);
    setCurrentAnimationFrame(0);
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
      playJumpSound(); // Trigger Jump Audio
    } else if (
      !gameStarted &&
      dimensions.width > 0 &&
      countdown === null &&
      !gameOver &&
      !showPuzzle &&
      !showAuth &&
      !showLeaderboard
    ) {
      playUiClick(); // Start game click sound
      initiateGame();
    }
  }, [
    gameOver,
    gameStarted,
    dimensions,
    countdown,
    isPaused,
    showPuzzle,
    showAuth,
    showLeaderboard,
  ]);

  //  Keyboard Input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
      if (e.code === "Escape" || e.code === "KeyP") {
        playUiClick();
        togglePause();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [jump, togglePause]);

  // Puzzle API
  const fetchPuzzle = async () => {
    playUiClick();
    try {
      const res = await fetch("/api/puzzle");
      const data = await res.json();
      setPuzzleData(data);
      setShowPuzzle(true);
    } catch (err) {
      console.error("Error fetching puzzle", err);
      setGameOver(true);
      submitScoreToDatabase(score);
    }
  };

  const handlePuzzleSubmit = () => {
    playUiClick();
    if (puzzleData && parseInt(userAnswer) === puzzleData.solution) {
      setShowPuzzle(false);
      setGameOver(false);
      setHasUsedRevive(true);
      setBirdPos(dimensions.height / 2);
      setVelocity(0);
      setUserAnswer("");
      setPipes((prev) => prev.map((p) => ({ ...p, x: p.x + 400 })));

      setGameStarted(false);
      setCountdown(3);
      setCurrentAnimationFrame(0);
    } else {
      alert("Uh oh! Incorrect. The jungle remains blocked.");
      setShowPuzzle(false);
      setGameOver(true);
      submitScoreToDatabase(score);
    }
  };

  const currentSpeed = Math.min(3 + score * 0.2, 11);
  const currentPipeGap = Math.max(360 - score * 3, 160);

  // Game Loop
  useEffect(() => {
    if (
      gameStarted &&
      !gameOver &&
      !showPuzzle &&
      dimensions.height > 0 &&
      countdown === null &&
      !isPaused
    ) {
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
            const maxPipeHeight =
              dimensions.height - currentPipeGap - minPipeHeight;
            const topHeight = Math.floor(
              Math.random() * (maxPipeHeight - minPipeHeight + 1) +
                minPipeHeight,
            );

            prevPipes.push({ x: dimensions.width, topHeight, passed: false });
          }

          return prevPipes
            .map((pipe) => {
              const newX = pipe.x - currentSpeed;

              const birdRect = {
                top: birdPos,
                bottom: birdPos + BIRD_HEIGHT,
                left: BIRD_X,
                right: BIRD_X + BIRD_WIDTH,
              };
              const topPipeRect = {
                top: 0,
                bottom: pipe.topHeight,
                left: newX,
                right: newX + PIPE_WIDTH,
              };
              const bottomPipeRect = {
                top: pipe.topHeight + currentPipeGap,
                bottom: dimensions.height,
                left: newX,
                right: newX + PIPE_WIDTH,
              };

              if (
                (birdRect.right > topPipeRect.left &&
                  birdRect.left < topPipeRect.right &&
                  birdRect.top < topPipeRect.bottom) ||
                (birdRect.right > bottomPipeRect.left &&
                  birdRect.left < bottomPipeRect.right &&
                  birdRect.bottom > bottomPipeRect.top)
              ) {
                handleGameOver();
              }

              if (!pipe.passed && newX + PIPE_WIDTH < BIRD_X) {
                setScore((s) => s + 1);
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
  }, [
    gameStarted,
    gameOver,
    velocity,
    birdPos,
    showPuzzle,
    dimensions,
    score,
    currentSpeed,
    currentPipeGap,
    countdown,
    isPaused,
  ]);

  // ANIMATION LOOP: Separated from the physics loop for independent control
  useEffect(() => {
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
    submitScoreToDatabase(score);
    playGameOverSound(); // Trigger Game Over Audio
  };

  // Prevent loading hydration errors
  if (dimensions.width === 0)
    return <div className="min-h-screen bg-[#2D5E37]"></div>;

  return (
    <div
      className="relative w-screen h-screen bg-[url('/jungle-clearing.png')] bg-cover bg-no-repeat overflow-hidden select-none cursor-pointer text-[#FDF0C6] font-sans"
      onClick={jump}
    >
      {/* Bottom Ground line */}
      <div className="absolute bottom-0 w-full h-8 bg-[#D2A967] border-t-8 border-[#2D5E37] z-10"></div>

      {/* --- ACCOUNT & TOP NAV BAR --- */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        {user ? (
          <div className="flex items-center gap-4 glass-panel px-5 py-2 rounded-full border border-white/20 shadow-xl backdrop-blur-md">
            <span className="font-bold text-sm truncate max-w-[150px] text-green-300 drop-shadow-md">
              👤 {user.email?.split('@')[0]}
            </span>
            <button onClick={(e) => { e.stopPropagation(); handleSignOut(); }} className="text-white hover:text-red-400 text-sm font-black transition-colors">LOGOUT</button>
          </div>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); playUiClick(); setShowAuth(true); }}
            className="glass-panel hover:bg-white/20 text-white border border-white/30 px-6 py-3 rounded-full font-black text-sm shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all transform hover:-translate-y-1 backdrop-blur-md"
          >
            👤 LOGIN TO SAVE SCORE
          </button>
        )}
      </div>

      {/* Top UI Bar (Score & Pause) */}
      {(gameStarted || countdown !== null) && !gameOver && !showPuzzle && (
        <div className="absolute top-0 left-0 w-full p-6 z-20 flex justify-between items-start pointer-events-none">
          {/* Score Container - Glassmorphism */}
          <div className="pointer-events-auto ml-4">
            <div className="glass-panel px-8 py-3 rounded-2xl border-t border-white/20">
              <span className="text-6xl font-black tracking-wider text-white drop-shadow-lg">
                {score}
              </span>
            </div>
          </div>

          {/* Pause Button - Glassmorphism */}
          <div className="pointer-events-auto mr-4 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                playUiClick();
                togglePause();
              }}
              className="glass-panel w-14 h-14 rounded-full flex items-center justify-center hover:bg-white/30 transition-all active:scale-95 border border-white/20"
            >
              {isPaused ? (
                <svg
                  className="w-6 h-6 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-6 bg-white rounded-full shadow-sm"></div>
                  <div className="w-1.5 h-6 bg-white rounded-full shadow-sm"></div>
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Countdown Overlay */}
      {countdown !== null && countdown > 0 && !isPaused && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none bg-black/20 backdrop-blur-sm">
          <span className="text-[200px] font-black text-white drop-shadow-[0_8px_0_rgba(0,0,0,0.5)] animate-pulse">
            {countdown}
          </span>
        </div>
      )}

      {/* PAUSE OVERLAY */}
      {isPaused && !gameOver && (
        <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
          <h2 className="text-6xl font-black text-white mb-12 drop-shadow-xl">
            PAUSED
          </h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              playUiClick();
              togglePause();
            }}
            className="glass-panel px-12 py-4 rounded-2xl font-black text-2xl text-white hover:bg-white/30 transition-all border border-white/20"
          >
            RESUME
          </button>
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
          transition: isPaused ? "none" : "transform 0.1s ease-out",

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
            style={{
              width: PIPE_WIDTH,
              height: pipe.topHeight,
              left: pipe.x,
              top: 0,
            }}
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
            style={{
              width: PIPE_WIDTH,
              height: dimensions.height - (pipe.topHeight + currentPipeGap),
              left: pipe.x,
              top: pipe.topHeight + currentPipeGap,
            }}
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
      {!gameStarted &&
        countdown === null &&
        !gameOver &&
        !showPuzzle &&
        !showAuth &&
        !showLeaderboard && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-10 animate-fade-in">
            {/* Animated Logo Container */}
            <div className="text-center mb-12 relative group">
              <div className="absolute inset-0 bg-green-400 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
              <h1 className="title-text relative z-10 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] transform group-hover:scale-105 transition-transform duration-300">
                JUNGLE ESCAPE
              </h1>
            </div>

            {/* Main Play Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                playUiClick();
                initiateGame();
              }}
              className="relative group mb-10"
            >
              <div className="absolute -inset-2 bg-yellow-400 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-200"></div>
              <div className="relative px-16 py-6 bg-gradient-to-b from-green-400 to-green-600 hover:from-green-300 hover:to-green-500 rounded-2xl border-b-8 border-green-800 active:border-b-0 active:translate-y-2 transition-all shadow-xl">
                <span className="text-4xl font-black text-white tracking-widest uppercase">
                  START ESCAPE
                </span>
              </div>
            </button>

            {/* Secondary Actions */}
            <div className="flex gap-6">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchLeaderboard();
                }}
                className="glass-panel px-10 py-4 rounded-2xl font-black text-xl text-white hover:bg-white/20 transition-all transform hover:-translate-y-1"
              >
                🏆 LEADERBOARD
              </button>

              {!user && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playUiClick();
                    setShowAuth(true);
                  }}
                  className="glass-panel px-10 py-4 rounded-2xl font-black text-xl text-white hover:bg-white/20 transition-all transform hover:-translate-y-1"
                >
                  🔐 LOGIN
                </button>
              )}
            </div>
          </div>
        )}

      {/* --- AUTHENTICATION MODAL --- */}
      {showAuth && (
        <div
          className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50 p-4 backdrop-blur-md animate-fade-in"
          onClick={() => {
            playUiClick();
            setShowAuth(false);
          }}
        >
          <div
            className="glass-panel p-10 rounded-3xl max-w-sm w-full border-t border-white/30"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-4xl font-black text-white mb-8 text-center drop-shadow-lg">
              {authMode === "login" ? "PILOT LOGIN" : "REGISTER PILOT"}
            </h2>
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input p-4 text-lg"
              />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input p-4 text-lg"
              />
              <button
                type="submit"
                className="btn-primary py-4 rounded-xl font-bold text-xl mt-4 text-white"
              >
                {authMode === "login" ? "ENTER JUNGLE" : "CREATE ACCOUNT"}
              </button>
            </form>
            <button
              onClick={() => {
                playUiClick();
                setAuthMode((m) => (m === "login" ? "signup" : "login"));
              }}
              className="mt-6 text-white/70 underline font-bold w-full text-center hover:text-white transition-colors"
            >
              {authMode === "login"
                ? "Need an account? Sign up"
                : "Have an account? Log in"}
            </button>
          </div>
        </div>
      )}

      {/* --- LEADERBOARD MODAL --- */}
      {showLeaderboard && (
        <div
          className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50 p-4 backdrop-blur-md animate-fade-in"
          onClick={() => {
            playUiClick();
            setShowLeaderboard(false);
          }}
        >
          <div
            className="glass-panel p-8 rounded-3xl max-w-md w-full border-t border-white/30"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-5xl font-black text-white mb-8 text-center drop-shadow-lg">
              TOP ESCAPERS
            </h2>

            <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden mb-6 backdrop-blur-sm">
              {leaderboardData.length > 0 ? (
                leaderboardData.map((entry, index) => (
                  <div
                    key={index}
                    className="flex justify-between px-6 py-3 border-b-2 border-[#3D301C] bg-[#D2A967] text-black font-bold text-xl last:border-b-0"
                  >
                    <span className="truncate w-2/3">
                      <span className="text-[#EC673C] mr-2">#{index + 1}</span>{" "}
                      {entry.username}
                    </span>
                    <span className="font-black text-[#2D5E37]">
                      {entry.score}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-black font-bold">
                  No scores yet. Be the first!
                </div>
              )}
            </div>

            <button
              onClick={() => {
                playUiClick();
                setShowLeaderboard(false);
              }}
              className="bg-[#EC673C] hover:bg-[#FDF0C6] hover:text-black border-4 border-[#000] py-4 w-full rounded-xl font-black text-2xl shadow-[0_6px_0_rgba(0,0,0,0.8)] transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MENU MODAL (Wood Carved Look) */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-50 p-4">
          <div
            className="bg-[#735D39] p-10 rounded-3xl border-8 border-[#3D301C] text-center shadow-[0_15px_0_rgba(0,0,0,0.6)] max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-7xl font-black text-[#FDF0C6] mb-12 drop-shadow-[0_6px_0_rgba(0,0,0,0.7)] tracking-wide">
              PAUSED
            </h2>

            <button
              onClick={(e) => {
                e.stopPropagation();
                playUiClick();
                togglePause();
              }}
              className="bg-[#D2A967] hover:bg-[#8D7248] active:translate-y-1 border-4 border-[#000] px-8 py-5 rounded-2xl font-bold text-[#FDF0C6] w-full mb-6 transition-all text-3xl shadow-[0_8px_0_rgba(0,0,0,0.8)]"
            >
              ▶ RESUME ESCAPE
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                playUiClick();
                goToMainMenu();
              }}
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
          <div
            className="bg-[#735D39] p-10 rounded-3xl border-8 border-[#3D301C] text-center shadow-[0_15px_0_rgba(0,0,0,0.6)] max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-7xl font-black text-[#EC673C] mb-4 drop-shadow-[0_6px_0_rgba(0,0,0,0.7)]">
              CRASHED!
            </h2>
            <p className="text-3xl font-bold text-[#FDF0C6] mb-10">
              Score: {score}
            </p>

            {!hasUsedRevive ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchPuzzle();
                }}
                className="bg-[#c49447] hover:bg-[#EC673C] active:translate-y-1 border-4 border-[#000] px-8 py-5 rounded-2xl font-bold text-[#FDF0C6] w-full mb-4 transition-all text-2xl shadow-[0_8px_0_rgba(0,0,0,0.8)]"
              >
                SOLVE PUZZLE FOR REVIVE
              </button>
            ) : (
              <p className="text-[#FDF0C6] font-bold mb-6 bg-black/20 p-3 rounded-lg border border-[#000]">
                Revive protocols complete for this escape.
              </p>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                playUiClick();
                initiateGame();
              }}
              className="bg-[#826331] hover:bg-[#8D7248] active:translate-y-1 border-4 border-[#000] px-8 py-5 rounded-2xl font-bold text-[#FDF0C6] w-full mb-4 transition-all text-2xl shadow-[0_8px_0_rgba(0,0,0,0.8)]"
            >
              REINITIALIZE
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                playUiClick();
                goToMainMenu();
              }}
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
          <div
            className="bg-[#735D39] p-8 rounded-3xl border-8 border-[#3D301C] max-w-xl w-full shadow-[0_15px_0_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-black text-3xl mb-6 text-center text-[#50E3C2] drop-shadow-[0_4px_0_rgba(0,0,0,0.7)]">
              Resolve Jungle Anomaly
            </h3>

            <div className="bg-black/20 p-3 rounded-lg mb-8 flex justify-center border-4 border-dashed border-[#FDF0C6] shadow-inner">
              <img
                src={puzzleData.question}
                alt="Jungle Anomaly Puzzle"
                className="max-w-full rounded"
              />
            </div>

            <div className="flex gap-4">
              <input
                type="number"
                className="bg-[#D2A967] border-4 border-[#000] p-4 rounded-xl w-full text-center text-3xl font-bold text-[#FDF0C6] focus:border-[#EC673C] focus:outline-none shadow-inner"
                placeholder="?"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePuzzleSubmit()}
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
