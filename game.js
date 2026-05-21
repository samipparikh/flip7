const TARGET_SCORE = 200;
const SEVEN_CARD_BONUS = true;

const SPECIAL_CARD_DEFAULTS = {
    plus2: { label: '+2', icon: '⭐', count: 14 },
    plus4: { label: '+4', icon: '💎', count: 6 },
    second_chance: { label: '2nd Chance', icon: '🛡️', count: 10 },
    freeze: { label: 'Freeze', icon: '❄️', count: 8 },
    flip3: { label: 'Flip 3', icon: '🎯', count: 8 },
};

let deckSettings = JSON.parse(JSON.stringify(SPECIAL_CARD_DEFAULTS));

function loadDeckSettings() {
    const saved = localStorage.getItem('flip7_deck_settings');
    if (saved) {
        const parsed = JSON.parse(saved);
        for (const key of Object.keys(deckSettings)) {
            if (parsed[key] !== undefined) {
                deckSettings[key].count = parsed[key];
            }
        }
    }
}

function saveDeckSettings() {
    const toSave = {};
    for (const [key, val] of Object.entries(deckSettings)) {
        toSave[key] = val.count;
    }
    localStorage.setItem('flip7_deck_settings', JSON.stringify(toSave));
}

function buildDeck() {
    const cards = [];
    for (let n = 1; n <= 12; n++) {
        for (let i = 0; i < n; i++) {
            cards.push({ type: 'number', value: n });
        }
    }
    for (const [subtype, config] of Object.entries(deckSettings)) {
        for (let i = 0; i < config.count; i++) {
            cards.push({ type: 'special', subtype, label: config.label, icon: config.icon });
        }
    }
    return cards;
}

loadDeckSettings();

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
            feedback: document.getElementById('feedback-screen'),
            rules: document.getElementById('rules-screen'),
            deckSettings: document.getElementById('deck-settings-screen'),
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
        document.getElementById('btn-deck-settings').addEventListener('click', () => this.showDeckSettings());
        document.getElementById('btn-back-deck').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-reset-deck').addEventListener('click', () => this.resetDeckSettings());
        document.getElementById('btn-feedback').addEventListener('click', () => this.showScreen('feedback'));
        document.getElementById('btn-back-feedback').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-submit-feedback').addEventListener('click', () => this.submitFeedback());
        document.getElementById('btn-rules').addEventListener('click', () => this.showScreen('rules'));
        document.getElementById('btn-back-rules').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-flip').addEventListener('click', () => this.flipCard());
        document.getElementById('btn-stop').addEventListener('click', () => this.stopTurn());
        document.getElementById('btn-next-round').addEventListener('click', () => this.nextRound());
        document.getElementById('btn-play-again').addEventListener('click', () => this.showScreen('menu'));
    }

    showOnlineMenu() {
        if (typeof onlineGame !== 'undefined') {
            onlineGame.showOnlineScreen();
        } else {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('online-screen').classList.add('active');
        }
    }

    showDeckSettings() {
        this.renderDeckSettings();
        this.showScreen('deckSettings');
    }

    renderDeckSettings() {
        const container = document.getElementById('deck-settings-list');
        container.innerHTML = Object.entries(deckSettings).map(([key, config]) => `
            <div class="deck-setting-row">
                <span class="deck-setting-label">${config.icon} ${config.label}</span>
                <div class="player-count-selector">
                    <button class="btn-count" data-key="${key}" data-delta="-1">−</button>
                    <span class="deck-setting-count" id="deck-count-${key}">${config.count}</span>
                    <button class="btn-count" data-key="${key}" data-delta="1">+</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.btn-count').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                const delta = parseInt(btn.dataset.delta);
                deckSettings[key].count = Math.max(0, deckSettings[key].count + delta);
                document.getElementById(`deck-count-${key}`).textContent = deckSettings[key].count;
                saveDeckSettings();
                this.updateDeckTotal();
            });
        });

        this.updateDeckTotal();
    }

    updateDeckTotal() {
        let total = 78;
        for (const config of Object.values(deckSettings)) {
            total += config.count;
        }
        document.getElementById('deck-total-count').textContent = total;
    }

    resetDeckSettings() {
        for (const key of Object.keys(deckSettings)) {
            deckSettings[key].count = SPECIAL_CARD_DEFAULTS[key].count;
        }
        saveDeckSettings();
        this.renderDeckSettings();
    }

    submitFeedback() {
        const description = document.getElementById('feedback-description').value.trim();
        const steps = document.getElementById('feedback-steps').value.trim();
        const category = document.getElementById('feedback-category').value;

        if (!description) {
            alert('Please describe the bug.');
            return;
        }

        const title = `[Bug] [${category}] ${description.substring(0, 60)}`;
        const body = `**Category:** ${category}\n\n**Description:**\n${description}\n\n**Steps to reproduce:**\n${steps || 'N/A'}\n\n**Browser:** ${navigator.userAgent}`;

        const url = `https://github.com/samipparikh/flip7/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=bug`;
        window.open(url, '_blank');

        document.getElementById('feedback-description').value = '';
        document.getElementById('feedback-steps').value = '';
        document.getElementById('feedback-category').value = 'gameplay';
        this.showScreen('menu');
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
        document.getElementById('total-rounds').textContent = `Target: ${TARGET_SCORE}`;
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

        if (player.bustedByFlip3) {
            player.bustedByFlip3 = false;
            player.roundScore = 0;
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

        if (player.pendingCards && player.pendingCards.length > 0) {
            this.turnActive = false;
            document.getElementById('btn-flip').disabled = true;
            this.applyPendingCards(player.pendingCards.slice(), 0);
            player.pendingCards = [];
        }
    }

    applyPendingCards(cards, index) {
        if (index >= cards.length) {
            if (this.turnActive === false && document.getElementById('btn-flip').disabled) {
                const numberCount = this.currentCards.filter(c => c.type === 'number').length;
                if (numberCount >= 7) {
                    document.getElementById('status-message').textContent = '🎉 7 CARDS! +15 bonus!';
                    document.getElementById('btn-stop').disabled = true;
                    setTimeout(() => this.bankScore(true), 1500);
                    return;
                }
                this.turnActive = true;
                document.getElementById('btn-flip').disabled = false;
                if (this.currentCards.length > 0) {
                    document.getElementById('btn-stop').disabled = false;
                }
                this.updateCurrentScore();
                document.getElementById('status-message').textContent = '';
            }
            return;
        }

        const card = cards[index];
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
                        setTimeout(() => this.applyPendingCards(cards, index + 1), 500);
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
        setTimeout(() => this.applyPendingCards(cards, index + 1), 800);
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
            document.getElementById('status-message').textContent = '🎉 7 CARDS! +15 bonus!';
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
            case 'flip3':
                this.showFlip3Modal();
                break;
        }
    }

    showFlip3Modal() {
        const eligiblePlayers = this.players
            .map((p, i) => ({ ...p, index: i }))
            .filter(p => p.index >= this.currentPlayerIndex && !this.frozenPlayers.has(p.index));

        if (eligiblePlayers.length === 0) {
            document.getElementById('status-message').textContent = '🎯 No one to target!';
            return;
        }

        this.turnActive = false;
        const modal = document.createElement('div');
        modal.className = 'freeze-modal';
        modal.innerHTML = `
            <div class="freeze-modal-content">
                <h3>🎯 Flip 3 — Choose Target!</h3>
                <p style="color:#a0a0b0;margin-bottom:16px">Draw 3 cards for the target player.</p>
                ${eligiblePlayers.map(p => `<button class="freeze-btn" data-index="${p.index}">${p.name}${p.index === this.currentPlayerIndex ? ' (You)' : ''}</button>`).join('')}
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.freeze-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                modal.remove();
                this.executeFlip3(idx);
            });
        });
    }

    executeFlip3(targetIndex) {
        if (targetIndex === this.currentPlayerIndex) {
            this.flip3ForSelf(3);
        } else {
            const originalPlayer = this.currentPlayerIndex;
            const originalCards = this.currentCards;
            const originalSecondChance = this.hasSecondChance;

            // Switch focus to target player
            const target = this.players[targetIndex];
            if (!target.flip3Cards) target.flip3Cards = [];
            this.hasSecondChance = false;

            document.getElementById('current-player-name').textContent = `🎯 ${target.name} (Flip 3)`;
            document.getElementById('flipped-cards').innerHTML = '';
            document.getElementById('current-points').textContent = '0';
            document.getElementById('card-count-display').textContent = '(0/7 number cards)';
            document.getElementById('btn-flip').disabled = true;
            document.getElementById('btn-stop').disabled = true;

            let cardsDrawn = 0;
            let targetCards = [...(target.flip3Cards || [])];
            let targetBusted = false;
            let targetSecondChance = false;

            const drawNext = () => {
                if (cardsDrawn >= 3 || this.deck.length === 0 || targetBusted) {
                    // Save target's cards for their turn
                    if (!targetBusted) {
                        target.pendingCards = targetCards;
                    } else {
                        target.pendingCards = null;
                        target.bustedByFlip3 = true;
                    }

                    // Switch focus back to original player
                    setTimeout(() => {
                        const origPlayer = this.players[originalPlayer];
                        document.getElementById('current-player-name').textContent = origPlayer.name;
                        document.getElementById('flipped-cards').innerHTML = '';
                        this.currentCards = originalCards;
                        this.hasSecondChance = originalSecondChance;
                        for (const c of this.currentCards) {
                            this.renderCard(c);
                        }
                        this.updateCurrentScore();
                        document.getElementById('status-message').textContent = targetBusted
                            ? `🎯 ${target.name} busted from Flip 3!`
                            : `🎯 ${target.name} will start with ${targetCards.length} card(s)`;
                        document.getElementById('btn-flip').disabled = false;
                        if (this.currentCards.length > 0) {
                            document.getElementById('btn-stop').disabled = false;
                        }
                        this.turnActive = true;
                    }, 1000);
                    return;
                }

                const card = this.deck.pop();
                document.getElementById('deck-remaining').textContent = this.deck.length;
                cardsDrawn++;

                if (card.type === 'number') {
                    const isDuplicate = targetCards.some(c => c.type === 'number' && c.value === card.value);
                    if (isDuplicate) {
                        if (targetSecondChance) {
                            targetSecondChance = false;
                            this.renderCard(card, true);
                            document.getElementById('status-message').textContent = `🛡️ Second Chance saved ${target.name}!`;
                            setTimeout(() => {
                                const container = document.getElementById('flipped-cards');
                                const lastCard = container.lastElementChild;
                                if (lastCard) lastCard.remove();
                                setTimeout(drawNext, 500);
                            }, 1000);
                            return;
                        }
                        this.renderCard(card, true);
                        targetBusted = true;
                        document.getElementById('status-message').textContent = `💥 ${target.name} BUSTED from Flip 3!`;
                        setTimeout(drawNext, 1000);
                        return;
                    }
                    targetCards.push(card);
                    this.renderCard(card);
                } else {
                    targetCards.push(card);
                    this.renderCard(card);
                    if (card.subtype === 'second_chance') targetSecondChance = true;
                }

                // Update score display for target
                let score = 0;
                for (const c of targetCards) {
                    if (c.type === 'number') score += c.value;
                    else if (c.subtype === 'plus2') score += 2;
                    else if (c.subtype === 'plus4') score += 4;
                }
                const numCount = targetCards.filter(c => c.type === 'number').length;
                document.getElementById('current-points').textContent = score;
                document.getElementById('card-count-display').textContent = `(${numCount}/7 number cards)`;
                document.getElementById('status-message').textContent = `🎯 Drawing for ${target.name} (${cardsDrawn}/3)`;

                setTimeout(drawNext, 800);
            };

            setTimeout(drawNext, 600);
        }
    }

    flip3ForSelf(remaining) {
        if (remaining <= 0 || this.deck.length === 0) {
            this.turnActive = true;
            this.updateCurrentScore();
            document.getElementById('status-message').textContent = '';
            if (this.currentCards.filter(c => c.type === 'number').length >= 7) {
                document.getElementById('status-message').textContent = '🎉 7 CARDS! +15 bonus!';
                this.turnActive = false;
                document.getElementById('btn-flip').disabled = true;
                document.getElementById('btn-stop').disabled = true;
                setTimeout(() => this.bankScore(true), 1500);
            }
            return;
        }

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
                        setTimeout(() => this.flip3ForSelf(remaining - 1), 500);
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
        setTimeout(() => this.flip3ForSelf(remaining - 1), 800);
    }

    showFreezeModal() {
        const otherPlayers = this.players
            .map((p, i) => ({ ...p, index: i }))
            .filter(p => p.index >= this.currentPlayerIndex && !this.frozenPlayers.has(p.index));

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
                if (idx === this.currentPlayerIndex) {
                    this.bankScore(false);
                } else {
                    this.turnActive = true;
                }
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
        if (isSevenBonus) score += 15;

        this.players[this.currentPlayerIndex].roundScore = score;
        document.getElementById('status-message').textContent =
            isSevenBonus ? `🎉 Banked ${score} points (+15 bonus!)` : `✓ Banked ${score} points`;

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

        const anyoneReachedTarget = this.players.some(p => p.totalScore >= TARGET_SCORE);

        if (anyoneReachedTarget) {
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
        const winner = sorted[0];
        const container = document.getElementById('final-scores');
        container.innerHTML = sorted.map((p, i) => {
            const diff = winner.totalScore - p.totalScore;
            if (i === 0) {
                return `
                    <div class="score-row winner">
                        <span class="name">👑 ${p.name}</span>
                        <span class="points">${p.totalScore}</span>
                    </div>
                `;
            }
            return `
                <div class="score-row">
                    <span class="name">${p.name}</span>
                    <span>
                        <span class="points">${p.totalScore}</span>
                    </span>
                </div>
                <div class="debt-row">
                    <span>Now you owe ${winner.name} ${diff} bags of gold!</span>
                </div>
            `;
        }).join('');
        this.showScreen('gameOver');
    }
}

new Game();
