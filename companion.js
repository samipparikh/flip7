class CompanionGame {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.currentRound = 1;
        this.turnOrder = [];
        this.turnOrderIndex = 0;
        this.frozenPlayers = new Set();
        this.currentCards = [];
        this.hasSecondChance = false;
        this.drawnCards = [];
        this.turnActive = false;

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('btn-companion').addEventListener('click', () => this.showSetup());
        document.getElementById('comp-btn-minus').addEventListener('click', () => this.changePlayerCount(-1));
        document.getElementById('comp-btn-plus').addEventListener('click', () => this.changePlayerCount(1));
        document.getElementById('comp-btn-start').addEventListener('click', () => this.startGame());
        document.getElementById('comp-btn-back-setup').addEventListener('click', () => this.backToMenu());
        document.getElementById('comp-btn-stop').addEventListener('click', () => this.stopTurn());
        document.getElementById('comp-btn-menu').addEventListener('click', () => this.confirmExit());
        document.getElementById('comp-btn-play-again-menu').addEventListener('click', () => this.backToMenu());
    }

    showSetup() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('companion-setup-screen').classList.add('active');
        this.playerCount = 3;
        document.getElementById('comp-player-count').textContent = this.playerCount;
        this.updatePlayerNames();
    }

    backToMenu() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('menu-screen').classList.add('active');
    }

    changePlayerCount(delta) {
        this.playerCount = Math.max(2, Math.min(10, this.playerCount + delta));
        document.getElementById('comp-player-count').textContent = this.playerCount;
        this.updatePlayerNames();
    }

    updatePlayerNames() {
        const container = document.getElementById('comp-player-names');
        container.innerHTML = '';
        for (let i = 0; i < this.playerCount; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Player ${i + 1}`;
            input.dataset.index = i;
            container.appendChild(input);
        }
    }

    startGame() {
        const inputs = document.querySelectorAll('#comp-player-names input');
        this.players = Array.from(inputs).map((input, i) => ({
            name: input.value.trim() || `Player ${i + 1}`,
            totalScore: 0,
            roundScores: [],
        }));
        this.currentRound = 1;
        this.startRound();
    }

    startRound() {
        this.drawnCards = [];
        const startPlayer = (this.currentRound - 1) % this.players.length;
        this.turnOrder = [];
        for (let i = 0; i < this.players.length; i++) {
            this.turnOrder.push((startPlayer + i) % this.players.length);
        }
        this.turnOrderIndex = 0;
        this.frozenPlayers = new Set();
        this.players.forEach(p => p.roundScore = 0);

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('companion-game-screen').classList.add('active');

        this.startTurn();
    }

    startTurn() {
        if (this.turnOrderIndex >= this.turnOrder.length) {
            this.endRound();
            return;
        }

        this.currentPlayerIndex = this.turnOrder[this.turnOrderIndex];

        if (this.frozenPlayers.has(this.currentPlayerIndex)) {
            this.turnOrderIndex++;
            this.startTurn();
            return;
        }

        const player = this.players[this.currentPlayerIndex];
        this.currentCards = [];
        this.hasSecondChance = false;
        this.turnActive = true;

        document.getElementById('comp-current-player').textContent = player.name;
        document.getElementById('comp-round-info').textContent = `Round ${this.currentRound} | Target: ${TARGET_SCORE}`;
        document.getElementById('comp-current-points').textContent = '0';
        document.getElementById('comp-card-count').textContent = '(0 cards)';
        document.getElementById('comp-status').textContent = '';
        document.getElementById('comp-flipped-cards').innerHTML = '';
        document.getElementById('comp-btn-stop').disabled = true;

        this.renderCardInput();
        this.updateCompScoreboard();
        this.updateDeckTracker();
    }

    renderCardInput() {
        const container = document.getElementById('comp-card-input');
        const numbersInHand = this.currentCards.filter(c => c.type === 'number').map(c => c.value);

        let html = '<div class="comp-input-section"><div class="comp-input-label">Number Cards</div><div class="comp-number-grid">';
        for (let n = 1; n <= 12; n++) {
            const inHand = numbersInHand.includes(n);
            const cls = inHand ? 'comp-num-btn danger' : 'comp-num-btn';
            html += `<button class="${cls}" data-number="${n}">${n}${inHand ? ' ⚠' : ''}</button>`;
        }
        html += '</div></div>';

        html += '<div class="comp-input-section"><div class="comp-input-label">Special Cards</div><div class="comp-special-grid">';
        const specials = [
            { key: 'plus2', label: '+2' },
            { key: 'plus4', label: '+4' },
            { key: 'plus6', label: '+6' },
            { key: 'plus8', label: '+8' },
            { key: 'plus10', label: '+10' },
            { key: 'x2', label: 'x2' },
            { key: 'second_chance', label: '2nd Chance' },
            { key: 'freeze', label: 'Freeze' },
            { key: 'flip3', label: 'Flip 3' },
        ];
        for (const s of specials) {
            html += `<button class="comp-special-btn" data-special="${s.key}">${s.label}</button>`;
        }
        html += '</div></div>';

        container.innerHTML = html;

        container.querySelectorAll('.comp-num-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.turnActive) return;
                this.inputNumber(parseInt(btn.dataset.number));
            });
        });

        container.querySelectorAll('.comp-special-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.turnActive) return;
                this.inputSpecial(btn.dataset.special);
            });
        });
    }

    inputNumber(value) {
        const isDuplicate = this.currentCards.some(c => c.type === 'number' && c.value === value);

        if (isDuplicate) {
            if (this.hasSecondChance) {
                this.hasSecondChance = false;
                document.getElementById('comp-status').textContent = `🛡️ Second Chance saved you! (${value} discarded)`;
                this.drawnCards.push({ type: 'number', value, discarded: true });
                this.updateDeckTracker();
                this.renderCardInput();
                return;
            }
            this.bust(value);
            return;
        }

        const card = { type: 'number', value };
        this.currentCards.push(card);
        this.drawnCards.push(card);
        this.renderFlippedCard(card);
        this.updateScore();
        this.renderCardInput();
        this.updateDeckTracker();

        if (this.currentCards.filter(c => c.type === 'number').length >= 7) {
            document.getElementById('comp-status').textContent = '🎉 7 CARDS! +15 bonus!';
            this.turnActive = false;
            setTimeout(() => this.bankScore(true), 1000);
            return;
        }

        document.getElementById('comp-btn-stop').disabled = false;
    }

    inputSpecial(subtype) {
        const config = SPECIAL_CARD_DEFAULTS[subtype];
        const card = { type: 'special', subtype, label: config.label, icon: config.icon };
        this.currentCards.push(card);
        this.drawnCards.push(card);
        this.renderFlippedCard(card);
        this.updateScore();
        this.updateDeckTracker();

        switch (subtype) {
            case 'second_chance':
                this.hasSecondChance = true;
                document.getElementById('comp-status').textContent = '🛡️ Second Chance active!';
                break;
            case 'freeze':
                this.showCompFreezeModal();
                break;
            case 'flip3':
                document.getElementById('comp-status').textContent = '🎯 Flip 3 — input cards for the target player manually';
                break;
            default:
                document.getElementById('comp-status').textContent = `${config.icon} ${config.label} added!`;
                break;
        }

        document.getElementById('comp-btn-stop').disabled = false;
    }

    showCompFreezeModal() {
        const otherPlayers = this.players
            .map((p, i) => ({ ...p, index: i }))
            .filter(p => {
                const remaining = this.turnOrder.slice(this.turnOrderIndex + 1);
                return remaining.includes(p.index) && !this.frozenPlayers.has(p.index);
            });

        if (otherPlayers.length === 0) {
            document.getElementById('comp-status').textContent = '❄️ No one to freeze!';
            return;
        }

        this.turnActive = false;
        const modal = document.createElement('div');
        modal.className = 'freeze-modal';
        modal.innerHTML = `
            <div class="freeze-modal-content">
                <h3>❄️ Freeze a Player!</h3>
                <p style="color:#a0a0b0;margin-bottom:16px">They'll keep their banked points but can't flip anymore this round.</p>
                ${otherPlayers.map(p => `<button class="freeze-btn" data-index="${p.index}">${p.name}</button>`).join('')}
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.freeze-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                this.frozenPlayers.add(idx);
                document.getElementById('comp-status').textContent = `❄️ ${this.players[idx].name} is frozen!`;
                modal.remove();
                this.turnActive = true;
            });
        });
    }

    renderFlippedCard(card) {
        const container = document.getElementById('comp-flipped-cards');
        const el = document.createElement('div');
        if (card.type === 'number') {
            el.className = 'card number';
            el.innerHTML = `${card.value}`;
        } else {
            el.className = 'card special';
            el.innerHTML = `<span class="card-icon">${card.icon}</span>${card.label}`;
        }
        container.appendChild(el);
    }

    bust(value) {
        this.turnActive = false;
        this.drawnCards.push({ type: 'number', value, bust: true });

        const container = document.getElementById('comp-flipped-cards');
        const el = document.createElement('div');
        el.className = 'card number bust';
        el.innerHTML = `${value}<span class="card-label">BUST</span>`;
        container.appendChild(el);

        document.getElementById('comp-status').textContent = '💥 BUST! 0 points this round.';
        document.getElementById('comp-current-points').textContent = '0';
        document.getElementById('comp-btn-stop').disabled = true;

        this.updateDeckTracker();

        setTimeout(() => {
            this.players[this.currentPlayerIndex].roundScore = 0;
            this.turnOrderIndex++;
            this.startTurn();
        }, 2000);
    }

    calculateScore() {
        let score = 0;
        let hasX2 = false;
        for (const card of this.currentCards) {
            if (card.type === 'number') {
                score += card.value;
            } else if (card.subtype === 'plus2') {
                score += 2;
            } else if (card.subtype === 'plus4') {
                score += 4;
            } else if (card.subtype === 'plus6') {
                score += 6;
            } else if (card.subtype === 'plus8') {
                score += 8;
            } else if (card.subtype === 'plus10') {
                score += 10;
            } else if (card.subtype === 'x2') {
                hasX2 = true;
            }
        }
        if (hasX2) score *= 2;
        return score;
    }

    updateScore() {
        const score = this.calculateScore();
        const numberCount = this.currentCards.filter(c => c.type === 'number').length;
        document.getElementById('comp-current-points').textContent = score;
        document.getElementById('comp-card-count').textContent = `(${numberCount}/7 number cards)`;
    }

    stopTurn() {
        if (!this.turnActive) return;
        this.turnActive = false;
        this.bankScore(false);
    }

    bankScore(isSevenBonus) {
        let score = this.calculateScore();
        if (isSevenBonus) score += 15;

        this.players[this.currentPlayerIndex].roundScore = score;
        document.getElementById('comp-status').textContent =
            isSevenBonus ? `🎉 Banked ${score} points (+15 bonus!)` : `✓ Banked ${score} points`;
        document.getElementById('comp-btn-stop').disabled = true;

        setTimeout(() => {
            this.turnOrderIndex++;
            this.startTurn();
        }, 1500);
    }

    updateCompScoreboard() {
        const container = document.getElementById('comp-scoreboard');
        container.innerHTML = this.players.map((p, i) => `
            <div class="score-chip ${i === this.currentPlayerIndex ? 'active' : ''}">
                <span class="chip-name">${p.name}</span>
                <span class="chip-score">${p.totalScore}${this.frozenPlayers.has(i) ? ' ❄️' : ''}</span>
            </div>
        `).join('');
    }

    updateDeckTracker() {
        const container = document.getElementById('comp-deck-tracker');

        const numberCounts = {};
        for (let n = 1; n <= 12; n++) numberCounts[n] = { total: n, drawn: 0 };
        const specialCounts = {};
        for (const [key, config] of Object.entries(SPECIAL_CARD_DEFAULTS)) {
            specialCounts[key] = { total: config.count, drawn: 0, label: config.label };
        }

        for (const card of this.drawnCards) {
            if (card.type === 'number') {
                numberCounts[card.value].drawn++;
            } else if (card.type === 'special') {
                specialCounts[card.subtype].drawn++;
            }
        }

        let html = '<div class="comp-tracker-title">Deck Tracker</div><div class="comp-tracker-grid">';
        for (let n = 1; n <= 12; n++) {
            const c = numberCounts[n];
            const remaining = c.total - c.drawn;
            const cls = remaining === 0 ? 'comp-tracker-item empty' : 'comp-tracker-item';
            html += `<div class="${cls}"><span class="comp-tracker-val">${n}</span><span class="comp-tracker-rem">${remaining}/${c.total}</span></div>`;
        }
        html += '</div>';

        html += '<div class="comp-tracker-specials">';
        for (const [key, c] of Object.entries(specialCounts)) {
            const remaining = c.total - c.drawn;
            if (c.total > 0) {
                const cls = remaining === 0 ? 'comp-tracker-special empty' : 'comp-tracker-special';
                html += `<span class="${cls}">${c.label}: ${remaining}/${c.total}</span>`;
            }
        }
        html += '</div>';

        container.innerHTML = html;
    }

    endRound() {
        const container = document.getElementById('comp-round-scores');
        const rows = this.players.map(p => {
            p.roundScores.push(p.roundScore || 0);
            p.totalScore += (p.roundScore || 0);
            return `
                <div class="score-row">
                    <span class="name">${p.name}</span>
                    <span>
                        <span class="round-detail">+${p.roundScore || 0}</span>
                        <span class="points">${p.totalScore}</span>
                    </span>
                </div>
            `;
        }).join('');
        container.innerHTML = rows;

        const anyoneReachedTarget = this.players.some(p => p.totalScore >= TARGET_SCORE);

        const btn = document.getElementById('comp-btn-next-round');
        if (anyoneReachedTarget) {
            btn.textContent = 'See Final Results';
            btn.onclick = () => this.endGame();
        } else {
            btn.textContent = 'Next Round';
            btn.onclick = () => this.nextRound();
        }

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('companion-round-end-screen').classList.add('active');
    }

    nextRound() {
        this.currentRound++;
        this.startRound();
    }

    endGame() {
        const sorted = [...this.players].sort((a, b) => b.totalScore - a.totalScore);
        const winner = sorted[0];
        const container = document.getElementById('comp-final-scores');
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
        document.getElementById('companion-game-over-screen').classList.add('active');
    }

    confirmExit() {
        if (confirm('Leave companion mode? Progress will be lost.')) {
            this.backToMenu();
        }
    }
}

const companionGame = new CompanionGame();
