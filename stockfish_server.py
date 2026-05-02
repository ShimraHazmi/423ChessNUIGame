from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
"https://stockfishchess.org/download/"
app = Flask(__name__)
CORS(app)

class StockfishEngine:
    def __init__(self):
        exe_path = './stockfish/stockfish.exe'
        
        if not os.path.exists(exe_path):
            raise FileNotFoundError(f"Stockfish not found at {exe_path}")
        
        
        self.process = subprocess.Popen(
            [exe_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            universal_newlines=True,
            bufsize=1
        )
        
        self._send_command('uci')
        self._wait_for('uciok')
        # check if engine ready
        self._send_command('isready')
        self._wait_for('readyok')
    # sned to stockfish
    def _send_command(self, command):
        self.process.stdin.write(command + '\n')
        self.process.stdin.flush()
    
    # wait for analysis
    def _wait_for(self, target):
        while True:
            line = self.process.stdout.readline().strip()
            if target in line:
                return
    
    # low depth so engine is good enough but doesnt crash
    # send, analyze, and get best move and return
    def analyze(self, fen, depth=18):
        self._send_command(f'position fen {fen}')
        self._send_command(f'go depth {depth}')
        
        best_move = None
        
        while True:
            line = self.process.stdout.readline().strip()
            
            if line.startswith('bestmove'):
                best_move = line.split()[1]
                break
        
        return {'move': best_move}

# Start engine and analyze get result
engine = StockfishEngine()

@app.route('/analyze', methods=['POST'])
def analyze():
    fen = request.json.get('fen')
    depth = request.json.get('depth', 18)
    
    result = engine.analyze(fen, depth)
    return jsonify(result)

if __name__ == '__main__':
    app.run(port=5001, host='0.0.0.0')