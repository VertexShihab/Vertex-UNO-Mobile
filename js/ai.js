// ============================================================
// ai.js — UNO AI Decision Engine
// ============================================================

const UnoAI = (() => {

    /**
     * Main AI decision: returns { action, cardIdx, chosenColor }
     * action: 'play' | 'draw'
     */
    function decide(playerIdx) {
        const state = UnoGame.getState();
        const player = state.players[playerIdx];
        const playable = UnoGame.getPlayableIndices(playerIdx);

        if (playable.length === 0) {
            return { action: 'draw' };
        }

        // Score each playable card
        const scored = playable.map(idx => ({
            idx,
            card: player.hand[idx],
            score: scoreCard(player.hand[idx], playerIdx)
        }));

        // Sort by score descending (higher = better to play)
        scored.sort((a, b) => b.score - a.score);

        const best = scored[0];
        let chosenColor = null;

        if (best.card.color === 'Wild') {
            chosenColor = pickBestColor(player.hand);
        }

        return { action: 'play', cardIdx: best.idx, chosenColor };
    }

    /**
     * Score a card for AI play priority.
     * Higher score = more desirable to play.
     */
    function scoreCard(card, playerIdx) {
        const state = UnoGame.getState();
        let score = 0;
        const nextIdx = UnoGame.getNextPlayerIdxFromCurrent();
        const nextIsTeammate = UnoGame.isTeammate(playerIdx, nextIdx);

        // ── Base scores by card type ─────────────────────────
        if (['0','1','2','3','4','5','6','7','8','9'].includes(card.value)) {
            // Number cards: prefer higher numbers (more points saved)
            score = 10 + parseInt(card.value);
        } else if (card.value === 'Skip') {
            score = nextIsTeammate ? 2 : 25; // avoid skipping teammate
        } else if (card.value === 'Reverse') {
            score = evaluateReverse(playerIdx);
        } else if (card.value === 'Draw') { // +2
            score = nextIsTeammate ? 1 : 30; // avoid penalizing teammate
        } else if (card.value === 'Wild') {
            score = 5; // save wilds — low priority
        } else if (card.value === 'Wild_Draw') {
            score = nextIsTeammate ? 0 : 8; // very low if teammate is next
        }

        // ── Color matching bonus ─────────────────────────────
        // Prefer playing cards that match the color we have most of
        const colorCounts = countColors(state.players[playerIdx].hand);
        if (card.color !== 'Wild' && colorCounts[card.color]) {
            score += colorCounts[card.color] * 0.5;
        }

        // ── Reduce hand pressure ─────────────────────────────
        // If we have many cards, slightly prefer action cards
        if (state.players[playerIdx].hand.length > 10) {
            if (['Skip', 'Reverse', 'Draw'].includes(card.value)) {
                score += 5;
            }
        }

        // ── Endgame: if we have 2 cards, be strategic ───────
        if (state.players[playerIdx].hand.length === 2) {
            // Prefer playing non-wild so we keep Wild as last card flexibility
            if (card.color !== 'Wild') score += 15;
        }

        return score;
    }

    /**
     * Evaluate how good a Reverse card is to play.
     */
    function evaluateReverse(playerIdx) {
        const state = UnoGame.getState();
        if (state.playerCount === 2) {
            // In 2-player, reverse = skip → check teammate
            const nextIdx = UnoGame.getNextPlayerIdxFromCurrent();
            return UnoGame.isTeammate(playerIdx, nextIdx) ? 2 : 25;
        }
        // In multiplayer: reverse might help if the player before us (who would become next) has many cards
        // and the player after us has few cards
        return 18;
    }

    /**
     * Count cards per color in a hand.
     */
    function countColors(hand) {
        const counts = { Red: 0, Green: 0, Blue: 0, Yellow: 0 };
        for (const card of hand) {
            if (counts[card.color] !== undefined) {
                counts[card.color]++;
            }
        }
        return counts;
    }

    /**
     * Pick the best color when playing a Wild card.
     * Chooses the color the AI has the most of.
     */
    function pickBestColor(hand) {
        const counts = countColors(hand);
        let best = 'Red';
        let max = 0;
        for (const [color, count] of Object.entries(counts)) {
            if (count > max) {
                max = count;
                best = color;
            }
        }
        // If no colored cards, pick random
        if (max === 0) {
            const colors = ['Red', 'Green', 'Blue', 'Yellow'];
            best = colors[Math.floor(Math.random() * 4)];
        }
        return best;
    }

    /**
     * Decide whether to play the drawn card.
     */
    function decideDrawnCard(playerIdx, drawnCard) {
        if (!UnoGame.isPlayable(drawnCard)) return { action: 'pass' };

        const state = UnoGame.getState();
        const nextIdx = UnoGame.getNextPlayerIdxFromCurrent();
        const nextIsTeammate = UnoGame.isTeammate(playerIdx, nextIdx);

        // Generally play it unless it would hurt teammate
        if (drawnCard.value === 'Draw' && nextIsTeammate) return { action: 'pass' };
        if (drawnCard.value === 'Wild_Draw' && nextIsTeammate) return { action: 'pass' };
        if (drawnCard.value === 'Skip' && nextIsTeammate) return { action: 'pass' };

        let chosenColor = null;
        if (drawnCard.color === 'Wild') {
            chosenColor = pickBestColor(state.players[playerIdx].hand);
        }

        return { action: 'play', chosenColor };
    }

    /**
     * Get a random "thinking" delay for natural feel.
     */
    function getThinkDelay() {
        return 800 + Math.random() * 700; // 800-1500ms
    }

    return {
        decide,
        decideDrawnCard,
        getThinkDelay,
        pickBestColor
    };
})();
