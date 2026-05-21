class OnlineGame {
    constructor() {
        this.db = firebase.database();
        this.roomRef = null;
        this.roomCode = null;
        this.playerId = null;
        this.playerName = null;
        this.isHost = false;
        this.unsubscribers = [];

        this.screens = {
            menu: document.getElementById('menu-screen'),
            online: document.getElementById('online-screen'),
            lobby: document.getElementById('lobby-screen'),
            onlineGame: document.getElementById('online-game-screen'),
            onlineRoundEnd: document.getElementById('online-round-end-screen'),
            onlineGameOver: document.getElementById('online-game-over-screen'),
        };

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('btn-create-room').addEventListener('click', () => this.showCreateRoom());
        document.getElementById('btn-join-room').addEventListener('click', () => this.showJoinRoom());
        document.getElementById('btn-back-online').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('btn-confirm-create').addEventListener('click', () => this.createRoom());
        document.getElementById('btn-confirm-join').addEventListener('click', () => this.joinRoom());
        document.getElementById('btn-start-online').addEventListener('click', () => this.startOnlineGame());
        document.getElementById('btn-leave-room').addEventListener('click', () => this.leaveRoom());
        document.getElementById('btn-online-flip').addEventListener('click', () => this.onlineFlip());
        document.getElementById('btn-online-stop').addEventListener('click', () => this.onlineStop());
        document.getElementById('btn-online-next-round').addEventListener('click', () => this.hostNextRound());
        document.getElementById('btn-online-play-again').addEventListener('click', () => this.leaveRoom());
    }

    showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (this.screens[name]) {
            this.screens[name].classList.add('active');
        } else {
            document.getElementById('menu-screen').classList.add('active');
        }
    }

    showCreateRoom() {
        document.getElementById('online-mode-title').textContent = 'Create Room';
        document.getElementById('join-code-group').style.display = 'none';
        document.getElementById('btn-confirm-create').style.display = 'block';
        document.getElementById('btn-confirm-join').style.display = 'none';
        this.showScreen('online');
    }

    showJoinRoom() {
        document.getElementById('online-mode-title').textContent = 'Join Room';
        document.getElementById('join-code-group').style.display = 'block';
        document.getElementById('btn-confirm-create').style.display = 'none';
        document.getElementById('btn-confirm-join').style.display = 'block';
        this.showScreen('online');
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    generatePlayerId() {
        return 'p_' + Math.random().toString(36).substr(2, 9);
    }

    async createRoom() {
        const name = document.getElementById('online-player-name').value.trim();
        if (!name) {
            document.getElementById('online-status').textContent = 'Please enter your name';
            return;
        }

        this.playerName = name;
        this.playerId = this.generatePlayerId();
        this.isHost = true;
        this.roomCode = this.generateRoomCode();

        const roomData = {
            code: this.roomCode,
            host: this.playerId,
            state: 'lobby',
            players: {
                [this.playerId]: { name: this.playerName, connected: true }
            },
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        this.roomRef = this.db.ref('rooms/' + this.roomCode);
        await this.roomRef.set(roomData);

        this.roomRef.child('players/' + this.playerId + '/connected').onDisconnect().set(false);

        this.showLobby();
        this.listenToRoom();
    }

    async joinRoom() {
        const name = document.getElementById('online-player-name').value.trim();
        const code = document.getElementById('join-code-input').value.trim().toUpperCase();

        if (!name) {
            document.getElementById('online-status').textContent = 'Please enter your name';
            return;
        }
        if (!code) {
            document.getElementById('online-status').textContent = 'Please enter a room code';
            return;
        }

        this.playerName = name;
        this.playerId = this.generatePlayerId();
        this.isHost = false;
        this.roomCode = code;
        this.roomRef = this.db.ref('rooms/' + this.roomCode);

        const snapshot = await this.roomRef.once('value');
        if (!snapshot.exists()) {
            document.getElementById('online-status').textContent = 'Room not found';
            return;
        }

        const room = snapshot.val();
        if (room.state !== 'lobby') {
            document.getElementById('online-status').textContent = 'Game already in progress';
            return;
        }

        const playerCount = Object.keys(room.players || {}).length;
        if (playerCount >= 6) {
            document.getElementById('online-status').textContent = 'Room is full';
            return;
        }

        await this.roomRef.child('players/' + this.playerId).set({
            name: this.playerName,
            connected: true
        });

        this.roomRef.child('players/' + this.playerId + '/connected').onDisconnect().set(false);

        this.showLobby();
        this.listenToRoom();
    }

    showLobby() {
        document.getElementById('lobby-room-code').textContent = this.roomCode;
        document.getElementById('btn-start-online').style.display = this.isHost ? 'block' : 'none';
        this.showScreen('lobby');
    }

    listenToRoom() {
        const unsub = this.roomRef.on('value', (snapshot) => {
            if (!snapshot.exists()) {
                this.leaveRoom();
                return;
            }

            const room = snapshot.val();
            this.updateLobbyPlayers(room.players || {});

            if (room.state === 'playing') {
                this.handleGameState(room);
            } else if (room.state === 'round_end') {
                this.handleRoundEnd(room);
            } else if (room.state === 'game_over') {
                this.handleGameOver(room);
            }
        });
        this.unsubscribers.push(() => this.roomRef.off('value', unsub));
    }

    updateLobbyPlayers(players) {
        const list = document.getElementById('lobby-players');
        list.innerHTML = Object.entries(players).map(([id, p]) => {
            const isMe = id === this.playerId;
            const isHost = id === this.playerId && this.isHost;
            return `<div class="lobby-player ${isMe ? 'me' : ''}">${p.name}${isHost ? ' (Host)' : ''}${!p.connected ? ' (disconnected)' : ''}</div>`;
        }).join('');

        const count = Object.keys(players).length;
        document.getElementById('btn-start-online').disabled = count < 2;
    }

    async startOnlineGame() {
        if (!this.isHost) return;

        const snapshot = await this.roomRef.once('value');
        const room = snapshot.val();
        const playerIds = Object.keys(room.players);

        const deck = shuffle(buildDeck()).map((c, i) => ({ ...c, id: i }));

        const gameState = {
            state: 'playing',
            currentRound: 1,
            totalRounds: 3,
            turnOrder: playerIds,
            currentTurnIndex: 0,
            deck: deck,
            deckIndex: 0,
            currentCards: [],
            hasSecondChance: false,
            frozenPlayers: {},
            scores: {},
            roundScores: {},
        };

        playerIds.forEach(id => {
            gameState.scores[id] = 0;
            gameState.roundScores[id] = 0;
        });

        await this.roomRef.update(gameState);
    }

    handleGameState(room) {
        this.showScreen('onlineGame');

        const players = room.players || {};
        const turnOrder = room.turnOrder || [];
        const currentPlayerId = turnOrder[room.currentTurnIndex];
        const isMyTurn = currentPlayerId === this.playerId;
        const currentPlayer = players[currentPlayerId];

        document.getElementById('online-round-info').textContent =
            `Round ${room.currentRound} / ${room.totalRounds}`;
        document.getElementById('online-deck-remaining').textContent =
            (room.deck || []).length - (room.deckIndex || 0);
        document.getElementById('online-current-player').textContent =
            isMyTurn ? 'Your Turn!' : `${currentPlayer ? currentPlayer.name : '...'}'s Turn`;

        const currentCards = room.currentCards || [];
        const cardsContainer = document.getElementById('online-flipped-cards');
        cardsContainer.innerHTML = currentCards.map(card => {
            if (card.type === 'number') {
                return `<div class="card number${card.bust ? ' bust' : ''}">${card.value}<span class="card-label">${card.bust ? 'BUST' : ''}</span></div>`;
            } else {
                return `<div class="card special"><span class="card-icon">${card.icon}</span>${card.label}</div>`;
            }
        }).join('');

        let score = 0;
        for (const card of currentCards) {
            if (card.type === 'number' && !card.bust) score += card.value;
            else if (card.subtype === 'plus2') score += 2;
            else if (card.subtype === 'plus4') score += 4;
        }
        const numberCount = currentCards.filter(c => c.type === 'number' && !c.bust).length;
        document.getElementById('online-current-points').textContent = score;
        document.getElementById('online-card-count').textContent = `(${numberCount}/7 number cards)`;

        document.getElementById('btn-online-flip').disabled = !isMyTurn;
        document.getElementById('btn-online-stop').disabled = !isMyTurn || currentCards.length === 0;

        document.getElementById('online-status-message').textContent = room.statusMessage || '';

        const scoreboard = document.getElementById('online-scoreboard');
        scoreboard.innerHTML = turnOrder.map((id, i) => {
            const p = players[id];
            const isCurrent = i === room.currentTurnIndex;
            const isFrozen = room.frozenPlayers && room.frozenPlayers[id];
            return `<div class="score-chip ${isCurrent ? 'active' : ''}">
                <span class="chip-name">${p ? p.name : '?'}</span>
                <span class="chip-score">${room.scores[id] || 0}${isFrozen ? ' ❄️' : ''}</span>
            </div>`;
        }).join('');

        if (room.freezeChoice && room.freezeChoice.chooser === this.playerId && !room.freezeChoice.chosen) {
            this.showOnlineFreezeModal(room);
        }
    }

    async onlineFlip() {
        const snapshot = await this.roomRef.once('value');
        const room = snapshot.val();
        const turnOrder = room.turnOrder || [];
        const currentPlayerId = turnOrder[room.currentTurnIndex];

        if (currentPlayerId !== this.playerId) return;

        const deckIndex = room.deckIndex || 0;
        const deck = room.deck || [];
        if (deckIndex >= deck.length) return;

        const card = deck[deckIndex];
        const currentCards = room.currentCards || [];
        const hasSecondChance = room.hasSecondChance || false;

        if (card.type === 'number') {
            const isDuplicate = currentCards.some(c => c.type === 'number' && c.value === card.value && !c.bust);

            if (isDuplicate) {
                if (hasSecondChance) {
                    await this.roomRef.update({
                        deckIndex: deckIndex + 1,
                        hasSecondChance: false,
                        statusMessage: '🛡️ Second Chance saved you!'
                    });
                    return;
                }
                currentCards.push({ ...card, bust: true });
                const updates = {
                    deckIndex: deckIndex + 1,
                    currentCards: currentCards,
                    statusMessage: '💥 BUST! Scored 0 this round.'
                };
                updates['roundScores/' + this.playerId] = 0;
                await this.roomRef.update(updates);

                setTimeout(() => this.advanceTurn(room), 2000);
                return;
            }

            currentCards.push(card);
            const numberCount = currentCards.filter(c => c.type === 'number').length;

            if (numberCount >= 7) {
                let score = 0;
                for (const c of currentCards) {
                    if (c.type === 'number') score += c.value;
                    else if (c.subtype === 'plus2') score += 2;
                    else if (c.subtype === 'plus4') score += 4;
                }
                score *= 2;

                const updates = {
                    deckIndex: deckIndex + 1,
                    currentCards: currentCards,
                    statusMessage: '🎉 7 NUMBER CARDS! Score doubled!'
                };
                updates['roundScores/' + this.playerId] = score;
                await this.roomRef.update(updates);

                setTimeout(() => this.advanceTurn(room), 2000);
                return;
            }

            await this.roomRef.update({
                deckIndex: deckIndex + 1,
                currentCards: currentCards,
                statusMessage: ''
            });
        } else {
            currentCards.push(card);
            const updates = {
                deckIndex: deckIndex + 1,
                currentCards: currentCards,
            };

            if (card.subtype === 'second_chance') {
                updates.hasSecondChance = true;
                updates.statusMessage = '🛡️ Second Chance active!';
            } else if (card.subtype === 'freeze') {
                updates.freezeChoice = { chooser: this.playerId, chosen: null };
                updates.statusMessage = '❄️ Choose a player to freeze!';
            } else {
                updates.statusMessage = '';
            }

            await this.roomRef.update(updates);
        }
    }

    showOnlineFreezeModal(room) {
        if (document.querySelector('.freeze-modal')) return;

        const turnOrder = room.turnOrder || [];
        const players = room.players || {};
        const frozenPlayers = room.frozenPlayers || {};

        const targets = turnOrder
            .filter(id => id !== this.playerId && !frozenPlayers[id])
            .map(id => ({ id, name: players[id].name }));

        if (targets.length === 0) {
            this.roomRef.update({ freezeChoice: null, statusMessage: '❄️ No one to freeze!' });
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'freeze-modal';
        modal.innerHTML = `
            <div class="freeze-modal-content">
                <h3>❄️ Freeze a Player!</h3>
                <p style="color:#a0a0b0;margin-bottom:16px">They'll keep their banked points but can't flip anymore this round.</p>
                ${targets.map(t => `<button class="freeze-btn" data-id="${t.id}">${t.name}</button>`).join('')}
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.freeze-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const targetId = btn.dataset.id;
                const updates = {};
                updates['frozenPlayers/' + targetId] = true;
                updates.freezeChoice = null;
                updates.statusMessage = `❄️ ${players[targetId].name} is frozen!`;
                await this.roomRef.update(updates);
                modal.remove();
            });
        });
    }

    async onlineStop() {
        const snapshot = await this.roomRef.once('value');
        const room = snapshot.val();
        const turnOrder = room.turnOrder || [];
        const currentPlayerId = turnOrder[room.currentTurnIndex];

        if (currentPlayerId !== this.playerId) return;

        const currentCards = room.currentCards || [];
        let score = 0;
        for (const c of currentCards) {
            if (c.type === 'number') score += c.value;
            else if (c.subtype === 'plus2') score += 2;
            else if (c.subtype === 'plus4') score += 4;
        }

        const updates = {};
        updates['roundScores/' + this.playerId] = score;
        updates.statusMessage = `✓ Banked ${score} points`;
        await this.roomRef.update(updates);

        setTimeout(() => this.advanceTurn(room), 1500);
    }

    async advanceTurn(room) {
        const turnOrder = room.turnOrder || [];
        let nextIndex = (room.currentTurnIndex || 0) + 1;
        const frozenPlayers = room.frozenPlayers || {};

        while (nextIndex < turnOrder.length && frozenPlayers[turnOrder[nextIndex]]) {
            nextIndex++;
        }

        if (nextIndex >= turnOrder.length) {
            await this.endOnlineRound(room);
        } else {
            await this.roomRef.update({
                currentTurnIndex: nextIndex,
                currentCards: [],
                hasSecondChance: false,
                freezeChoice: null,
                statusMessage: ''
            });
        }
    }

    async endOnlineRound(room) {
        const turnOrder = room.turnOrder || [];
        const scores = { ...(room.scores || {}) };
        const roundScores = room.roundScores || {};

        turnOrder.forEach(id => {
            scores[id] = (scores[id] || 0) + (roundScores[id] || 0);
        });

        if ((room.currentRound || 1) >= (room.totalRounds || 3)) {
            await this.roomRef.update({
                state: 'game_over',
                scores: scores,
                statusMessage: ''
            });
        } else {
            await this.roomRef.update({
                state: 'round_end',
                scores: scores,
                statusMessage: ''
            });
        }
    }

    handleRoundEnd(room) {
        this.showScreen('onlineRoundEnd');
        const players = room.players || {};
        const turnOrder = room.turnOrder || [];
        const roundScores = room.roundScores || {};
        const scores = room.scores || {};

        const container = document.getElementById('online-round-scores');
        container.innerHTML = turnOrder.map(id => {
            const p = players[id];
            return `<div class="score-row">
                <span class="name">${p ? p.name : '?'}</span>
                <span>
                    <span class="round-detail">+${roundScores[id] || 0}</span>
                    <span class="points">${scores[id] || 0}</span>
                </span>
            </div>`;
        }).join('');

        document.getElementById('online-round-number').textContent = `Round ${room.currentRound} Complete!`;
        document.getElementById('btn-online-next-round').style.display = this.isHost ? 'block' : 'none';
    }

    async hostNextRound() {
        if (!this.isHost) return;

        const snapshot = await this.roomRef.once('value');
        const room = snapshot.val();
        const turnOrder = room.turnOrder || [];
        const deck = shuffle(buildDeck()).map((c, i) => ({ ...c, id: i }));

        const roundScores = {};
        turnOrder.forEach(id => { roundScores[id] = 0; });

        await this.roomRef.update({
            state: 'playing',
            currentRound: (room.currentRound || 1) + 1,
            currentTurnIndex: 0,
            deck: deck,
            deckIndex: 0,
            currentCards: [],
            hasSecondChance: false,
            frozenPlayers: {},
            roundScores: roundScores,
            freezeChoice: null,
            statusMessage: ''
        });
    }

    handleGameOver(room) {
        this.showScreen('onlineGameOver');
        const players = room.players || {};
        const turnOrder = room.turnOrder || [];
        const scores = room.scores || {};

        const sorted = turnOrder
            .map(id => ({ id, name: (players[id] || {}).name || '?', score: scores[id] || 0 }))
            .sort((a, b) => b.score - a.score);

        const container = document.getElementById('online-final-scores');
        container.innerHTML = sorted.map((p, i) => `
            <div class="score-row ${i === 0 ? 'winner' : ''}">
                <span class="name">${i === 0 ? '👑 ' : ''}${p.name}</span>
                <span class="points">${p.score}</span>
            </div>
        `).join('');
    }

    async leaveRoom() {
        if (this.roomRef && this.playerId) {
            await this.roomRef.child('players/' + this.playerId + '/connected').set(false);
            if (this.isHost) {
                await this.roomRef.remove();
            }
        }
        this.unsubscribers.forEach(fn => fn());
        this.unsubscribers = [];
        this.roomRef = null;
        this.roomCode = null;
        this.playerId = null;
        this.isHost = false;
        this.showScreen('menu');
    }
}

let onlineGame;
document.addEventListener('DOMContentLoaded', () => {
    onlineGame = new OnlineGame();
});
