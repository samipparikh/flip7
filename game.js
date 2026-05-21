const TOTAL_ROUNDS = 3;
const SEVEN_CARD_BONUS = true;

function buildDeck() {
    const cards = [];
    // Number cards: 1-12, quantity equals the value (1×1, 2×2, ... 12×12) = 78 cards
    for (let n = 1; n <= 12; n++) {
        for (let i = 0; i < n; i++) {
            cards.push({ type: 'number', value: n });
        }
    }
    // Special cards (38 total)
    for (let i = 0; i < 14; i++) cards.push({ type: 'special', subtype: 'plus2', label: '+2', icon: '⭐' });
    for (let i = 0; i < 6; i++) cards.push({ type: 'special', subtype: 'plus4', label: '+4', icon: '💎' });
    for (let i = 0; i < 10; i++) cards.push({ type: 'special', subtype: 'second_chance', label: '2nd Chance', icon: '🛡️' });
    for (let i = 0; i < 8; i++) cards.push({ type: 'special', subtype: 'freeze', label: 'Freeze', icon: '❄️' });
    return cards;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

class Game {
    constructor() {
        this.screens = {
            menu: document.getElementById('menu-screen'),
            game: document.getElementById('game-screen'),
            roundEnd: document.getElementById('round-end-screen'),
            gameOver: document.getElementById('game-over-screen'),
            rules: document.getElementById('rules-screen'),
        };
        this.playerCount = 3;
        this.players = [];
        this.currentRound = 1;
        this.currentPlayerIndex = 0;
        this.deck = [];
        this.currentCards = [];
        this.hasSecondChance = false;
        this.turnActive = false;
        this.frozenPlayers = new Set();

        this.bindEvents();
        this.updatePlayerNames();
    }

    bindEvents() {
        document.getElementById('btn-minus').addEventListener('click', () => this.changePlayerCount(-1));
        document.getElementById('btn-plus').addEventListener('click', () => this.changePlayerCount(1));
        document.getElementById('btn-start').addEventListener('click', () => this.startGame());
        document.getElementById('btn-play-online').addEventListener('click', () => this.showOnlineMenu());
        document.getElementById('btn-rules').addEventListener('click', () => this.showScreen('rules'));
        document.getElementById('btn-back-rules').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-flip').addEventListener('click', () => this.flipCard());
        document.getElementById('btn-stop').addEventListener('click', () => this.stopTurn());
        document.getElementById('btn-next-round').addEventListener('click', () => this.nextRound());
        document.getElementById('btn-play-again').addEventListener('click', () => this.showScreen('menu'));
    }

    showOnlineMenu() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('online-screen').classList.add('active');
    }

    changePlayerCount(delta) {
        this.playerCount = Math.max(2, Math.min(6, this.playerCount + delta));
        document.getElementById('player-count').textContent = this.playerCount;
        this.updatePlayerNames();
    }

    updatePlayerNames() {
        const container = document.getElementById('player-names');
        container.innerHTML = '';
        for (let i = 0; i < this.playerCount; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Player ${i + 1}`;
            input.dataset.index = i;
            container.appendChild(input);
        }
    }

    showScreen(name) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.screens[name].classList.add('active');
    }

    startGame() {
        const inputs = document.querySelectorAll('#player-names input');
        this.players = Array.from(inputs).map((input, i) => ({
            name: input.value.trim() || `Player ${i + 1}`,
            totalScore: 0,
            roundScores: [],
        }));
        this.currentRound = 1;
        this.startRound();
    }

    startRound() {
        this.deck = shuffle(buildDeck());
        this.currentPlayerIndex = 0;
        this.frozenPlayers = new Set();
        this.players.forEach(p => p.roundScore = 0);
        document.getElementById('current-round').textContent = this.currentRound;
        document.getElementById('total-rounds').textContent = TOTAL_ROUNDS;
        this.showScreen('game');
        this.startTurn();
    }

    startTurn() {
        if (this.currentPlayerIndex >= this.players.length) {
            this.endRound();
            return;
        }

        const player = this.players[this.currentPlayerIndex];

        if (this.frozenPlayers.has(this.currentPlayerIndex)) {
            this.currentPlayerIndex++;
            this.startTurn();
            return;
        }

        this.currentCards = [];
        this.hasSecondChance = false;
        this.turnActive = true;

        document.getElementById('current-player-name').textContent = player.name;
        document.getElementById('flipped-cards').innerHTML = '';
        document.getElementById('current-points').textContent = '0';
        document.getElementById('card-count-display').textContent = '(0 cards)';
        document.getElementById('status-message').textContent = '';
        document.getElementById('btn-flip').disabled = false;
        document.getElementById('btn-stop').disabled = true;
        document.getElementById('deck-remaining').textContent = this.deck.length;
        this.updateScoreboard();
    }

    flipCard() {
        if (!this.turnActive || this.deck.length === 0) return;

        const card = this.deck.pop();
        document.getElementById('deck-remaining').textContent = this.deck.length;

        if (card.type === 'number') {
            const isDuplicate = this.currentCards.some(c => c.type === 'number' && c.value === card.value);

            if (isDuplicate) {
                if (this.hasSecondChance) {
                    this.hasSecondChance = false;
                    this.renderCard(card, true);
                    document.getElementById('status-message').textContent = '🛡️ Second Chance saved you!';
                    setTimeout(() => {
                        const container = document.getElementById('flipped-cards');
                        const lastCard = container.lastElementChild;
                        if (lastCard) lastCard.remove();
                        document.getElementById('status-message').textContent = '';
                    }, 1000);
                    return;
                }
                this.bust(card);
                return;
            }

            this.currentCards.push(card);
            this.renderCard(card);
        } else {
            this.currentCards.push(card);
            this.renderCard(card);
            this.handleSpecialCard(card);
        }

        this.updateCurrentScore();

        if (this.currentCards.filter(c => c.type === 'number').length >= 7) {
            document.getElementById('status-message').textContent = '🎉 7 CARDS! Score doubled!';
            this.turnActive = false;
            document.getElementById('btn-flip').disabled = true;
            document.getElementById('btn-stop').disabled = true;
            setTimeout(() => this.bankScore(true), 1500);
            return;
        }

        if (this.currentCards.length > 0) {
            document.getElementById('btn-stop').disabled = false;
        }
    }

    handleSpecialCard(card) {
        switch (card.subtype) {
            case 'plus2':
            case 'plus4':
                break;
            case 'second_chance':
                this.hasSecondChance = true;
                document.getElementById('status-message').textContent = '🛡️ Second Chance active!';
                break;
            case 'freeze':
                this.showFreezeModal();
                break;
        }
    }

    showFreezeModal() {
        const otherPlayers = this.players
            .map((p, i) => ({ ...p, index: i }))
            .filter(p => p.index > this.currentPlayerIndex && !this.frozenPlayers.has(p.index));

        if (otherPlayers.length === 0) {
            document.getElementById('status-message').textContent = '❄️ No one to freeze!';
            return;
        }

        this.turnActive = false;
        const modal = document.createElement('div');
        modal.className = 'freeze-modal';
        modal.innerHTML = `
            <div class="freeze-modal-content">
                <h3>❄️ Freeze a Player!</h3>
                <p style="color:#a0a0b0;margin-bottom:16px">They'll keep their current banked points but can't flip anymore this round.</p>
                ${otherPlayers.map(p => `<button class="freeze-btn" data-index="${p.index}">${p.name}</button>`).join('')}
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.freeze-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                this.frozenPlayers.add(idx);
                document.getElementById('status-message').textContent = `❄️ ${this.players[idx].name} is frozen!`;
                modal.remove();
                this.turnActive = true;
            });
        });
    }

    renderCard(card, isBust = false) {
        const container = document.getElementById('flipped-cards');
        const el = document.createElement('div');

        if (card.type === 'number') {
            el.className = `card number${isBust ? ' bust' : ''}`;
            el.innerHTML = `${card.value}<span class="card-label">${isBust ? 'BUST' : ''}</span>`;
        } else {
            el.className = 'card special';
            el.innerHTML = `<span class="card-icon">${card.icon}</span>${card.label}`;
        }

        container.appendChild(el);
    }

    bust(card) {
        this.turnActive = false;
        this.renderCard(card, true);
        document.getElementById('btn-flip').disabled = true;
        document.getElementById('btn-stop').disabled = true;
        document.getElementById('status-message').textContent = '💥 BUST! You scored 0 this round.';
        document.getElementById('current-points').textContent = '0';

        setTimeout(() => {
            this.players[this.currentPlayerIndex].roundScore = 0;
            this.currentPlayerIndex++;
            this.startTurn();
        }, 2000);
    }

    calculateScore() {
        let score = 0;
        for (const card of this.currentCards) {
            if (card.type === 'number') {
                score += card.value;
            } else if (card.subtype === 'plus2') {
                score += 2;
            } else if (card.subtype === 'plus4') {
                score += 4;
            }
        }
        return score;
    }

    updateCurrentScore() {
        const score = this.calculateScore();
        const numberCount = this.currentCards.filter(c => c.type === 'number').length;
        document.getElementById('current-points').textContent = score;
        document.getElementById('card-count-display').textContent = `(${numberCount}/7 number cards)`;
    }

    stopTurn() {
        if (!this.turnActive) return;
        this.turnActive = false;
        this.bankScore(false);
    }

    bankScore(isSevenBonus) {
        let score = this.calculateScore();
        if (isSevenBonus) score *= 2;

        this.players[this.currentPlayerIndex].roundScore = score;
        document.getElementById('status-message').textContent =
            isSevenBonus ? `🎉 Banked ${score} points (doubled!)` : `✓ Banked ${score} points`;

        setTimeout(() => {
            this.currentPlayerIndex++;
            this.startTurn();
        }, 1500);
    }

    updateScoreboard() {
        const container = document.getElementById('scoreboard');
        container.innerHTML = this.players.map((p, i) => `
            <div class="score-chip ${i === this.currentPlayerIndex ? 'active' : ''}">
                <span class="chip-name">${p.name}</span>
                <span class="chip-score">${p.totalScore}${this.frozenPlayers.has(i) ? ' ❄️' : ''}</span>
            </div>
        `).join('');
    }

    endRound() {
        const container = document.getElementById('round-scores');
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

        if (this.currentRound >= TOTAL_ROUNDS) {
            document.getElementById('btn-next-round').textContent = 'See Final Results';
            document.getElementById('btn-next-round').onclick = () => this.endGame();
        } else {
            document.getElementById('btn-next-round').textContent = 'Next Round';
            document.getElementById('btn-next-round').onclick = () => this.nextRound();
        }

        this.showScreen('roundEnd');
    }

    nextRound() {
        this.currentRound++;
        this.startRound();
    }

    endGame() {
        const sorted = [...this.players].sort((a, b) => b.totalScore - a.totalScore);
        const container = document.getElementById('final-scores');
        container.innerHTML = sorted.map((p, i) => `
            <div class="score-row ${i === 0 ? 'winner' : ''}">
                <span class="name">${i === 0 ? '👑 ' : ''}${p.name}</span>
                <span class="points">${p.totalScore}</span>
            </div>
        `).join('');
        this.showScreen('gameOver');
    }
}

new Game();
