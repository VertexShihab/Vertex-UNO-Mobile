// ============================================================
// game.js — UNO Core Game Engine
// ============================================================

const UnoGame = (() => {
    // ── Card & Deck Definitions ──────────────────────────────
    const COLORS = ['Red', 'Green', 'Blue', 'Yellow'];
    const VALUES = ['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','Draw'];
    const WILDS  = ['Wild', 'Wild_Draw'];

    function createDeck() {
        const deck = [];
        // For each color: one 0, two of 1-9, two of Skip/Reverse/Draw
        for (const color of COLORS) {
            // One zero
            deck.push({ color, value: '0', id: `${color}_0_a` });
            // Two each of 1-9
            for (let n = 1; n <= 9; n++) {
                deck.push({ color, value: String(n), id: `${color}_${n}_a` });
                deck.push({ color, value: String(n), id: `${color}_${n}_b` });
            }
            // Two each of action cards
            for (const action of ['Skip', 'Reverse', 'Draw']) {
                deck.push({ color, value: action, id: `${color}_${action}_a` });
                deck.push({ color, value: action, id: `${color}_${action}_b` });
            }
        }
        // 4 Wild, 4 Wild Draw Four
        for (let i = 0; i < 4; i++) {
            deck.push({ color: 'Wild', value: 'Wild', id: `Wild_${i}` });
            deck.push({ color: 'Wild', value: 'Wild_Draw', id: `Wild_Draw_${i}` });
        }
        return deck; // 108 cards
    }

    function getCardImage(card) {
        if (card.value === 'Wild') return 'assets/cards/Wild.png';
        if (card.value === 'Wild_Draw') return 'assets/cards/Wild_Draw.png';
        return `assets/cards/${card.color}_${card.value}.png`;
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ── Game State ───────────────────────────────────────────
    let state = null;

    function createPlayer(name, isHuman, teamId = null) {
        return {
            name,
            isHuman,
            teamId,
            hand: [],
            calledUno: false
        };
    }

    function initGame(mode, playerCount) {
        const deck = shuffle(createDeck());
        const players = [];

        if (mode === 'duo') {
            // 2v2: Human + AI1 (Team A) vs AI2 + AI3 (Team B)
            players.push(createPlayer('You', true, 'A'));
            players.push(createPlayer('Bot 1', false, 'B'));
            players.push(createPlayer('Partner', false, 'A'));
            players.push(createPlayer('Bot 2', false, 'B'));
        } else {
            // Solo mode with variable player count
            players.push(createPlayer('You', true));
            const botNames = ['Bot 1', 'Bot 2', 'Bot 3'];
            for (let i = 0; i < playerCount - 1; i++) {
                players.push(createPlayer(botNames[i], false));
            }
        }

        state = {
            deck,
            discardPile: [],
            players,
            currentPlayer: 0,
            direction: 1,
            currentColor: '',
            currentValue: '',
            gameMode: mode,
            playerCount: players.length,
            gameOver: false,
            winner: null,
            winningTeam: null,
            unoCallRequired: -1,   // player index that needs to press UNO
            unoPenaltyTimer: null,
            turnPhase: 'play',     // 'play' | 'drawn' | 'waiting'
            drawnCard: null,       // the card just drawn (for play-after-draw)
            lastAction: ''        // description of what just happened
        };

        // Deal 7 cards to each player
        for (let i = 0; i < 7; i++) {
            for (const player of state.players) {
                player.hand.push(state.deck.pop());
            }
        }

        // Flip starter card — if Wild, reshuffle it back and try again
        flipStarterCard();

        return state;
    }

    function flipStarterCard() {
        let card = state.deck.pop();
        // If the first card is Wild or an action card, keep drawing until a number
        while (card.color === 'Wild' || ['Skip', 'Reverse', 'Draw'].includes(card.value)) {
            state.deck.unshift(card); // put it back at bottom
            shuffle(state.deck);
            card = state.deck.pop();
        }
        state.discardPile.push(card);
        state.currentColor = card.color;
        state.currentValue = card.value;
    }

    // ── Card Legality ────────────────────────────────────────
    function isPlayable(card) {
        if (card.color === 'Wild') return true;
        if (card.color === state.currentColor) return true;
        if (card.value === state.currentValue) return true;
        return false;
    }

    function getPlayableIndices(playerIdx) {
        const hand = state.players[playerIdx].hand;
        const indices = [];
        for (let i = 0; i < hand.length; i++) {
            if (isPlayable(hand[i])) indices.push(i);
        }
        return indices;
    }

    function hasPlayableCard(playerIdx) {
        return getPlayableIndices(playerIdx).length > 0;
    }

    // ── Play a Card ──────────────────────────────────────────
    function playCard(playerIdx, cardIdx, chosenColor = null) {
        const player = state.players[playerIdx];
        const card = player.hand[cardIdx];

        if (!isPlayable(card)) return { success: false, reason: 'Card not playable' };

        // Remove card from hand
        player.hand.splice(cardIdx, 1);
        state.discardPile.push(card);

        // Update current color/value
        if (card.color === 'Wild') {
            state.currentColor = chosenColor || 'Red';
            state.currentValue = card.value;
        } else {
            state.currentColor = card.color;
            state.currentValue = card.value;
        }

        // Reset UNO call
        player.calledUno = false;

        // Check UNO condition (1 card left)
        if (player.hand.length === 1) {
            state.unoCallRequired = playerIdx;
        } else {
            state.unoCallRequired = -1;
        }

        // Check win
        if (player.hand.length === 0) {
            state.gameOver = true;
            state.winner = playerIdx;
            if (state.gameMode === 'duo') {
                state.winningTeam = player.teamId;
            }
            return { success: true, card, effect: 'win', winner: playerIdx };
        }

        // Apply card effects
        const effect = applyCardEffect(card);

        return { success: true, card, effect };
    }

    function applyCardEffect(card) {
        const effectResult = { type: 'none', skippedPlayer: -1, drawPlayer: -1, drawCount: 0 };

        if (card.value === 'Skip') {
            effectResult.type = 'skip';
            // Skip next player
            const nextIdx = getNextPlayerIdx();
            effectResult.skippedPlayer = nextIdx;
            advanceTurn(); // extra advance to skip
        } else if (card.value === 'Reverse') {
            effectResult.type = 'reverse';
            if (state.playerCount === 2) {
                // In 2-player, Reverse = Skip
                const nextIdx = getNextPlayerIdx();
                effectResult.skippedPlayer = nextIdx;
                advanceTurn();
            } else {
                state.direction *= -1;
            }
        } else if (card.value === 'Draw') {
            effectResult.type = 'draw2';
            const nextIdx = getNextPlayerIdx();
            effectResult.drawPlayer = nextIdx;
            effectResult.drawCount = 2;
            // Next player draws 2 and is skipped
            drawCards(nextIdx, 2);
            advanceTurn(); // skip them
        } else if (card.value === 'Wild_Draw') {
            effectResult.type = 'draw4';
            const nextIdx = getNextPlayerIdx();
            effectResult.drawPlayer = nextIdx;
            effectResult.drawCount = 4;
            // Next player draws 4 and is skipped
            drawCards(nextIdx, 4);
            advanceTurn(); // skip them
        }

        return effectResult;
    }

    // ── Draw Cards ───────────────────────────────────────────
    function drawCards(playerIdx, count) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            if (state.deck.length === 0) reshuffleDeck();
            if (state.deck.length === 0) break; // no cards left at all
            const card = state.deck.pop();
            state.players[playerIdx].hand.push(card);
            drawn.push(card);
        }
        return drawn;
    }

    function drawCardForTurn(playerIdx) {
        const drawn = drawCards(playerIdx, 1);
        if (drawn.length > 0) {
            state.drawnCard = drawn[0];
            state.turnPhase = 'drawn';
            // Check if drawn card is playable
            if (isPlayable(drawn[0])) {
                return { drawn: drawn[0], canPlay: true };
            }
        }
        return { drawn: drawn.length > 0 ? drawn[0] : null, canPlay: false };
    }

    function reshuffleDeck() {
        if (state.discardPile.length <= 1) return;
        const topCard = state.discardPile.pop();
        state.deck = shuffle([...state.discardPile]);
        state.discardPile = [topCard];
    }

    // ── Turn Management ──────────────────────────────────────
    function getNextPlayerIdx() {
        let next = state.currentPlayer + state.direction;
        if (next >= state.playerCount) next = 0;
        if (next < 0) next = state.playerCount - 1;
        return next;
    }

    function advanceTurn() {
        state.currentPlayer = getNextPlayerIdx();
        state.turnPhase = 'play';
        state.drawnCard = null;
    }

    function endTurn() {
        advanceTurn();
    }

    // ── UNO Call ─────────────────────────────────────────────
    function callUno(playerIdx) {
        if (state.unoCallRequired === playerIdx) {
            state.players[playerIdx].calledUno = true;
            state.unoCallRequired = -1;
            return true;
        }
        return false;
    }

    function penalizeUno(playerIdx) {
        // Player didn't call UNO in time — draw 2 penalty
        drawCards(playerIdx, 2);
        state.unoCallRequired = -1;
        state.players[playerIdx].calledUno = false;
    }

    // ── Getters ──────────────────────────────────────────────
    function getState() { return state; }

    function getTopCard() {
        return state.discardPile[state.discardPile.length - 1];
    }

    function getCurrentPlayer() {
        return state.players[state.currentPlayer];
    }

    function isTeammate(playerIdxA, playerIdxB) {
        if (state.gameMode !== 'duo') return false;
        return state.players[playerIdxA].teamId === state.players[playerIdxB].teamId;
    }

    function getNextPlayerIdxFromCurrent() {
        return getNextPlayerIdx();
    }

    // ── Public API ───────────────────────────────────────────
    return {
        COLORS,
        createDeck,
        getCardImage,
        initGame,
        getState,
        getTopCard,
        getCurrentPlayer,
        isPlayable,
        getPlayableIndices,
        hasPlayableCard,
        playCard,
        drawCardForTurn,
        drawCards,
        advanceTurn,
        endTurn,
        callUno,
        penalizeUno,
        isTeammate,
        getNextPlayerIdxFromCurrent,
        shuffle
    };
})();
