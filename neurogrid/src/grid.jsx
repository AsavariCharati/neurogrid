function Grid({ grid, playerPos, aiPos }) {
  return (
    <div
      className="grid gap-1 p-3 rounded-2xl"
      style={{
        gridTemplateColumns: 'repeat(10, 1fr)',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {grid.map((row, r) =>
        row.map((cell, c) => {
          const isPlayer = playerPos.r === r && playerPos.c === c
          const isAI = aiPos.r === r && aiPos.c === c

          let style = {}
          let extraClass = 'transition-all duration-300 rounded-lg aspect-square'

          if (cell === 'empty') {
            style = {
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }
          }

          if (cell === 'player') {
            style = {
              background: 'rgba(59,130,246,0.7)',
              border: '1px solid rgba(99,179,237,0.4)',
              boxShadow: '0 0 6px rgba(59,130,246,0.4)',
            }
          }

          if (cell === 'ai') {
            style = {
              background: 'rgba(239,68,68,0.7)',
              border: '1px solid rgba(252,129,129,0.4)',
              boxShadow: '0 0 6px rgba(239,68,68,0.4)',
            }
          }

          if (isPlayer) {
            extraClass += ' animate-pulse'
            style = {
              background: 'rgba(147,210,255,0.95)',
              border: '2px solid rgba(147,210,255,0.9)',
              boxShadow: '0 0 16px rgba(99,179,237,0.9), 0 0 32px rgba(59,130,246,0.5)',
            }
          }

          if (isAI) {
            extraClass += ' animate-pulse'
            style = {
              background: 'rgba(255,120,120,0.95)',
              border: '2px solid rgba(255,120,120,0.9)',
              boxShadow: '0 0 16px rgba(252,129,129,0.9), 0 0 32px rgba(239,68,68,0.5)',
            }
          }

          return (
            <div
              key={`${r}-${c}`}
              className={extraClass}
              style={style}
            />
          )
        })
      )}
    </div>
  )
}

export default Grid