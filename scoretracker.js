class ScoreTracker {
    constructor() {
        this.players = [];
        this.currentRound = 1;
        this.history = [];
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('btn-score-tracker').addEventListener('click', () => this.showSetup());
        document.getElementById('st-btn-minus').addEventListener('click', () => this.changePlayerCount(-1));
        document.getElementById('st-btn-plus').addEventListener('click', () => this.changePlayerCount(1));
        document.getElementById('st-btn-start').addEventListener('click', () => this.startTracking());
        document.getElementById('st-btn-back-setup').addEventListener('click', () => this.backToMenu());
        document.getElementById('st-btn-submit').addEventListener('click', () => this.submitRound());
        document.getElementById('st-btn-undo').addEventListener('click', () => this.undoRound());
        document.getElementById('st-btn-exit').addEventListener('click', () => this.confirmExit());
        document.getElementById('st-btn-menu').addEventListener('click', () => this.backToMenu());
    }

    showSetup() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('st-setup-screen').classList.add('active');
        this.playerCount = 3;
        document.getElementById('st-player-count').textContent = this.playerCount;
        this.updatePlayerNames();
    }

    backToMenu() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('menu-screen').classList.add('active');
    }

    changePlayerCount(delta) {
        this.playerCount = Math.max(2, Math.min(20, this.playerCount + delta));
        document.getElementById('st-player-count').textContent = this.playerCount;
        this.updatePlayerNames();
    }

    updatePlayerNames() {
        const container = document.getElementById('st-player-names');
        container.innerHTML = '';
        for (let i = 0; i < this.playerCount; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Player ${i + 1}`;
            input.dataset.index = i;
            container.appendChild(input);
        }
    }

    startTracking() {
        const inputs = document.querySelectorAll('#st-player-names input');
        this.players = Array.from(inputs).map((input, i) => ({
            name: input.value.trim() || `Player ${i + 1}`,
            totalScore: 0,
        }));
        this.currentRound = 1;
        this.history = [];
        this.showTracker();
    }

    showTracker() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('st-game-screen').classList.add('active');
        this.render();
    }

    render() {
        document.getElementById('st-round-label').textContent = `Round ${this.currentRound}`;

        const standingsEl = document.getElementById('st-standings');
        const sorted = [...this.players].sort((a, b) => b.totalScore - a.totalScore);
        standingsEl.innerHTML = sorted.map((p, i) => `
            <div class="st-standing-row${i === 0 && p.totalScore > 0 ? ' leading' : ''}">
                <span class="st-rank">${i + 1}.</span>
                <span class="st-name">${p.name}</span>
                <span class="st-total">${p.totalScore}</span>
            </div>
        `).join('');

        const inputsEl = document.getElementById('st-score-inputs');
        inputsEl.innerHTML = this.players.map((p, i) => `
            <div class="st-input-row">
                <label>${p.name}</label>
                <input type="number" id="st-score-${i}" placeholder="0" min="0" inputmode="numeric" />
            </div>
        `).join('');

        document.getElementById('st-btn-undo').disabled = this.history.length === 0;
    }

    submitRound() {
        const scores = this.players.map((p, i) => {
            const val = parseInt(document.getElementById(`st-score-${i}`).value) || 0;
            return val;
        });

        this.history.push(scores);
        scores.forEach((s, i) => this.players[i].totalScore += s);
        this.currentRound++;

        const winner = this.players.find(p => p.totalScore >= TARGET_SCORE);
        if (winner) {
            this.showWinner();
        } else {
            this.render();
        }
    }

    undoRound() {
        if (this.history.length === 0) return;
        const lastScores = this.history.pop();
        lastScores.forEach((s, i) => this.players[i].totalScore -= s);
        this.currentRound--;
        this.render();
    }

    showWinner() {
        const sorted = [...this.players].sort((a, b) => b.totalScore - a.totalScore);
        const winner = sorted[0];
        const container = document.getElementById('st-final-scores');
        container.innerHTML = sorted.map((p, i) => {
            if (i === 0) {
                return `<div class="score-row winner"><span class="name">👑 ${p.name}</span><span class="points">${p.totalScore}</span></div>`;
            }
            const diff = winner.totalScore - p.totalScore;
            return `
                <div class="score-row"><span class="name">${p.name}</span><span class="points">${p.totalScore}</span></div>
                <div class="debt-row"><span>Owes ${winner.name} ${diff} bags of gold!</span></div>
            `;
        }).join('');

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('st-game-over-screen').classList.add('active');
    }

    confirmExit() {
        if (confirm('Leave score tracker? Progress will be lost.')) {
            this.backToMenu();
        }
    }
}

const scoreTracker = new ScoreTracker();
