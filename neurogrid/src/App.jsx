import { useState, useEffect, useCallback } from 'react'
import Grid from './grid'

const ROWS = 10
const COLS = 10
const BACKEND = 'https://neurogrid-production-197d.up.railway.app'

function createGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill('empty'))
}

function getRandomMove(pos, grid = null) {
  const dirs = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
  ]
  let valid = dirs.filter(
    d => pos.r + d.r >= 0 && pos.r + d.r < ROWS && pos.c + d.c >= 0 && pos.c + d.c < COLS
  )
  if (grid) {
    valid = valid.filter(d => grid[pos.r + d.r][pos.c + d.c] === 'empty')
  }
  if (valid.length === 0) return null
  return valid[Math.floor(Math.random() * valid.length)]
}

function getScore(grid) {
  let player = 0, ai = 0, empty = 0
  grid.forEach(row => row.forEach(cell => {
    if (cell === 'player') player++
    else if (cell === 'ai') ai++
    else empty++
  }))
  return { player, ai, empty }
}

function isStuck(pos, grid) {
  const dirs = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
  ]
  return dirs.every(d => {
    const nr = pos.r + d.r
    const nc = pos.c + d.c
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return true
    return grid[nr][nc] !== 'empty'
  })
}

function App() {
  const [grid, setGrid] = useState(createGrid())
  const [playerPos, setPlayerPos] = useState({ r: 0, c: 0 })
  const [aiPos, setAiPos] = useState({ r: 9, c: 9 })
  const [turn, setTurn] = useState('player')
  const [winner, setWinner] = useState(null)
  const [playerStuck, setPlayerStuck] = useState(false)
  const [predictionStats, setPredictionStats] = useState({ total: 0, correct: 0 })

  useEffect(() => {
    const newGrid = createGrid()
    newGrid[0][0] = 'player'
    newGrid[9][9] = 'ai'
    setGrid(newGrid)
  }, [])

  const checkWinner = useCallback((g, pPos, aPos) => {
    const { player, ai, empty } = getScore(g)
    const pStuck = isStuck(pPos, g)
    const aStuck = isStuck(aPos, g)

    if (empty === 0 || (pStuck && aStuck)) {
      if (player > ai) setWinner('player')
      else if (ai > player) setWinner('ai')
      else setWinner('draw')
      return { pStuck, aStuck, gameOver: true }
    }
    return { pStuck, aStuck, gameOver: false }
  }, [])

  const moveAI = useCallback(async (currentGrid, currentAiPos, lastMove, currentPlayerPos) => {
    const { pStuck, aStuck, gameOver } = checkWinner(currentGrid, currentPlayerPos, currentAiPos)
    if (gameOver) return

    if (aStuck) {
      setPlayerStuck(false)
      setTurn('player')
      return
    }

    let nr, nc

    try {
      const res = await fetch('${BACKEND}/ai-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiPos: currentAiPos,
          playerPos: currentPlayerPos,
          grid: currentGrid,
          lastMove: lastMove
        })
      })
      const data = await res.json()

      if (data.strategy === 'predicted' && data.best_move) {
        const { r, c } = data.best_move
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && currentGrid[r][c] === 'empty') {
          nr = r
          nc = c
          setPredictionStats(prev => ({
            total: prev.total + 1,
            correct: prev.correct + 1
          }))
        } else {
          const dir = getRandomMove(currentAiPos, currentGrid)
          if (!dir) { setTurn('player'); return }
          nr = currentAiPos.r + dir.r
          nc = currentAiPos.c + dir.c
          setPredictionStats(prev => ({ ...prev, total: prev.total + 1 }))
        }
      } else {
        const dir = getRandomMove(currentAiPos, currentGrid)
        if (!dir) { setTurn('player'); return }
        nr = currentAiPos.r + dir.r
        nc = currentAiPos.c + dir.c
      }
    } catch (e) {
      const dir = getRandomMove(currentAiPos, currentGrid)
      if (!dir) { setTurn('player'); return }
      nr = currentAiPos.r + dir.r
      nc = currentAiPos.c + dir.c
    }

    const newGrid = currentGrid.map(row => [...row])
    newGrid[nr][nc] = 'ai'
    const newAiPos = { r: nr, c: nc }
    setGrid(newGrid)
    setAiPos(newAiPos)

    const result = checkWinner(newGrid, currentPlayerPos, newAiPos)
    if (result.gameOver) return

    if (result.pStuck) {
      setPlayerStuck(true)
      setTimeout(() => moveAI(newGrid, newAiPos, lastMove, currentPlayerPos), 300)
    } else {
      setPlayerStuck(false)
      setTurn('player')
    }
  }, [checkWinner])

  useEffect(() => {
    const handleKey = (e) => {
      if (turn !== 'player' || winner) return

      const dirs = {
        ArrowUp:    { r: -1, c: 0 },
        ArrowDown:  { r: 1,  c: 0 },
        ArrowLeft:  { r: 0,  c: -1 },
        ArrowRight: { r: 0,  c: 1 },
      }
      const dir = dirs[e.key]
      if (!dir) return

      setPlayerPos(prev => {
        const nr = prev.r + dir.r
        const nc = prev.c + dir.c
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return prev
        if (grid[nr][nc] !== 'empty') return prev

        const newPlayerPos = { r: nr, c: nc }

        setGrid(g => {
          const newGrid = g.map(row => [...row])
          newGrid[nr][nc] = 'player'

          const moveData = {
            from: { r: prev.r, c: prev.c },
            to: { r: nr, c: nc },
            direction: e.key,
          }

          fetch('${BACKEND}/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(moveData)
          })

          const result = checkWinner(newGrid, newPlayerPos, aiPos)
          if (!result.gameOver) {
            setTimeout(() => moveAI(newGrid, aiPos, moveData, newPlayerPos), 300)
          }
          return newGrid
        })

        setTurn('ai')
        return newPlayerPos
      })
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [turn, aiPos, moveAI, winner, checkWinner, grid])

  const score = getScore(grid)
  const accuracy = predictionStats.total > 0
    ? Math.round((predictionStats.correct / predictionStats.total) * 100)
    : 0

  function resetGame() {
    const newGrid = createGrid()
    newGrid[0][0] = 'player'
    newGrid[9][9] = 'ai'
    setGrid(newGrid)
    setPlayerPos({ r: 0, c: 0 })
    setAiPos({ r: 9, c: 9 })
    setTurn('player')
    setWinner(null)
    setPlayerStuck(false)
    setPredictionStats({ total: 0, correct: 0 })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 gap-6">
      <h1
        className="text-4xl font-bold tracking-tight"
        style={{
          background: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        NeuroGrid 🧠
      </h1>

      <div className="flex gap-8 text-white text-lg">
        <span className="text-blue-400">🔵 You: {score.player}</span>
        <span className="text-gray-400">Empty: {score.empty}</span>
        <span className="text-red-400">🔴 AI: {score.ai}</span>
      </div>

      <div className="w-96">
        <Grid grid={grid} playerPos={playerPos} aiPos={aiPos} />
      </div>

      {winner ? (
        <div
          className="flex flex-col items-center gap-3 p-6 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <p className="text-3xl font-bold text-white">
            {winner === 'player' ? '🎉 You Win!' : winner === 'ai' ? '😈 AI Wins!' : '🤝 Draw!'}
          </p>
          <p className="text-gray-400">You: {score.player} cells · AI: {score.ai} cells</p>

          <div className="flex gap-6 mt-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{score.player}</p>
              <p className="text-gray-500 text-xs">Your cells</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{score.ai}</p>
              <p className="text-gray-500 text-xs">AI cells</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-400">{accuracy}%</p>
              <p className="text-gray-500 text-xs">AI predicted you</p>
            </div>
          </div>

          <p className="text-yellow-400 text-sm mt-1">
            {accuracy > 60
              ? '😈 AI had you figured out!'
              : '🧠 You kept the AI guessing!'}
          </p>

          <button
            onClick={resetGame}
            className="mt-2 px-6 py-2 rounded-lg text-white font-medium"
            style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}
          >
            Play Again
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className="text-gray-400 text-sm">
            {turn === 'player' ? '🔵 Your turn — use arrow keys' : '🔴 AI is thinking...'}
          </p>
          {playerStuck && (
            <p className="text-yellow-400 text-sm">⚠️ You're stuck! AI keeps moving...</p>
          )}
        </div>
      )}
    </div>
  )
}

export default App