from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np
from sklearn.tree import DecisionTreeClassifier
from collections import deque

app = Flask(__name__)
CORS(app)

move_history = []
model = None
direction_map = {
    'ArrowUp': 0,
    'ArrowDown': 1,
    'ArrowLeft': 2,
    'ArrowRight': 3
}
reverse_map = {0: 'ArrowUp', 1: 'ArrowDown', 2: 'ArrowLeft', 3: 'ArrowRight'}

def train_model():
    global model
    if len(move_history) < 5:
        return False
    X, y = [], []
    for i in range(len(move_history) - 1):
        current = move_history[i]
        next_move = move_history[i + 1]
        X.append([
            current['from']['r'],
            current['from']['c'],
            current['to']['r'],
            current['to']['c'],
            direction_map.get(current['direction'], -1)
        ])
        y.append(direction_map.get(next_move['direction'], -1))
    model = DecisionTreeClassifier()
    model.fit(np.array(X), np.array(y))
    return True

def get_empty_cells_reachable(pos, grid):
    # BFS to count how many empty cells AI can reach from pos
    visited = set()
    queue = deque()
    queue.append((pos['r'], pos['c']))
    visited.add((pos['r'], pos['c']))
    count = 0
    while queue:
        r, c = queue.popleft()
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < 10 and 0 <= nc < 10 and (nr, nc) not in visited:
                if grid[nr][nc] == 'empty' or grid[nr][nc] == 'ai':
                    visited.add((nr, nc))
                    if grid[nr][nc] == 'empty':
                        count += 1
                    queue.append((nr, nc))
    return count

def get_best_strategic_move(ai_pos, player_pos, grid):
    dirs = [(-1,0),(1,0),(0,-1),(0,1)]
    best_move = None
    best_score = -1

    for dr, dc in dirs:
        nr, nc = ai_pos['r'] + dr, ai_pos['c'] + dc
        if not (0 <= nr < 10 and 0 <= nc < 10):
            continue
        if grid[nr][nc] != 'empty':
            continue

        # simulate AI moving here
        test_grid = [row[:] for row in grid]
        test_grid[nr][nc] = 'ai'

        # score = empty cells AI can reach from this new pos
        reachable = get_empty_cells_reachable({'r': nr, 'c': nc}, test_grid)

        # bonus: if this move is closer to player, it cuts them off
        dist_to_player = abs(nr - player_pos['r']) + abs(nc - player_pos['c'])
        cutoff_bonus = max(0, 10 - dist_to_player) * 2

        score = reachable + cutoff_bonus

        if score > best_score:
            best_score = score
            best_move = {'r': nr, 'c': nc}

    return best_move

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({'status': 'ok', 'message': 'NeuroGrid backend is alive!'})

@app.route('/move', methods=['POST'])
def record_move():
    data = request.json
    move_history.append(data)
    trained = train_model()
    return jsonify({
        'status': 'recorded',
        'total_moves': len(move_history),
        'model_trained': trained
    })

@app.route('/ai-move', methods=['POST'])
def ai_move():
    data = request.json
    ai_pos = data['aiPos']
    player_pos = data['playerPos']
    grid = data['grid']
    last_move = data.get('lastMove')

    # get strategic move based on territory
    strategic_move = get_best_strategic_move(ai_pos, player_pos, grid)

    # if model is trained, blend ML prediction with strategy
    if model is not None and last_move:
        try:
            X = np.array([[
                last_move['from']['r'],
                last_move['from']['c'],
                last_move['to']['r'],
                last_move['to']['c'],
                direction_map.get(last_move['direction'], -1)
            ]])
            predicted_dir = reverse_map[model.predict(X)[0]]
            confidence = max(model.predict_proba(X)[0])

            # if high confidence, try to cut off predicted move
            dir_deltas = {
                'ArrowUp':    (-1, 0),
                'ArrowDown':  (1, 0),
                'ArrowLeft':  (0, -1),
                'ArrowRight': (0, 1),
            }
            dr, dc = dir_deltas[predicted_dir]
            intercept = {
                'r': last_move['to']['r'] + dr,
                'c': last_move['to']['c'] + dc
            }

            # only use ML intercept if confidence is high enough
            if confidence > 0.6:
                ir, ic = intercept['r'], intercept['c']
                if 0 <= ir < 10 and 0 <= ic < 10 and grid[ir][ic] == 'empty':
                    # pick move toward intercept point
                    dirs = [(-1,0),(1,0),(0,-1),(0,1)]
                    best = None
                    best_dist = float('inf')
                    for ddr, ddc in dirs:
                        nr, nc = ai_pos['r'] + ddr, ai_pos['c'] + ddc
                        if 0 <= nr < 10 and 0 <= nc < 10 and grid[nr][nc] == 'empty':
                            dist = abs(nr - ir) + abs(nc - ic)
                            if dist < best_dist:
                                best_dist = dist
                                best = {'r': nr, 'c': nc}
                    if best:
                        return jsonify({
                            'strategy': 'predicted',
                            'best_move': best,
                            'confidence': round(confidence * 100, 1)
                        })
        except Exception as e:
            pass

    # fallback to pure strategic move
    if strategic_move:
        return jsonify({
            'strategy': 'strategic',
            'best_move': strategic_move
        })

    return jsonify({'strategy': 'random'})

@app.route('/history', methods=['GET'])
def get_history():
    return jsonify({'moves': move_history})

if __name__ == '__main__':
    app.run(debug=True, port=5000)