// ============================================================
// main.js — UNO App Controller & Game Loop
// Premium Edition
// ============================================================

const UnoApp = (() => {
    let gameState = null;
    let isProcessing = false;
    let unoTimerId = null;

    // ── Initialize App ───────────────────────────────────────
    function init() {
        UnoUI.cacheDom();
        bindMenuEvents();
        runSplashScreen();
    }

    // ── Splash Screen ────────────────────────────────────────
    function runSplashScreen() {
        const splashScreen = document.getElementById('splash-screen');
        const loaderFill   = document.getElementById('splash-loader-fill');
        const splashTap    = document.getElementById('splash-tap');

        // Preload all card images & essential assets
        const imagePaths = [];
        const colors = ['Red', 'Green', 'Blue', 'Yellow'];
        const values = ['0','1','2','3','4','5','6','7','8','9','Draw','Reverse','Skip'];
        for (const c of colors) {
            for (const v of values) {
                imagePaths.push(`assets/cards/${c}_${v}.png`);
            }
        }
        imagePaths.push('assets/cards/Wild.png', 'assets/cards/Wild_Draw.png', 'assets/cards/Deck.png');
        imagePaths.push('assets/tables/Table_1.png', 'assets/Banner.png', 'assets/icon.jpg');

        let loaded = 0;
        const total = imagePaths.length;
        let isDismissed = false;

        function updateProgress() {
            loaded++;
            const pct = Math.min(100, Math.round((loaded / total) * 100));
            if (loaderFill) loaderFill.style.width = pct + '%';

            if (loaded >= total) {
                setTimeout(() => {
                    if (splashTap) splashTap.classList.add('visible');
                }, 300);
            }
        }

        for (const src of imagePaths) {
            const img = new Image();
            img.onload  = updateProgress;
            img.onerror = updateProgress;
            img.src = src;
        }

        // Guaranteed fallback if images load from memory cache quickly
        setTimeout(() => {
            if (loaderFill) loaderFill.style.width = '100%';
            if (splashTap) splashTap.classList.add('visible');
        }, 1200);

        // Dismiss action
        function dismissSplash() {
            if (isDismissed) return;
            isDismissed = true;

            splashScreen.removeEventListener('click', dismissSplash);
            splashScreen.removeEventListener('touchend', dismissSplash);

            splashScreen.classList.add('fade-out');

            setTimeout(() => {
                splashScreen.classList.remove('active');
                splashScreen.style.display = 'none';
                UnoUI.showScreen('menu');
            }, 600);
        }

        // Allow click to enter after short delay or instantly
        setTimeout(() => {
            splashScreen.addEventListener('click', dismissSplash);
            splashScreen.addEventListener('touchend', dismissSplash);
        }, 500);

        // Auto transition after 4.5 seconds if user doesn't tap
        setTimeout(() => {
            if (!isDismissed && splashScreen.classList.contains('active')) {
                dismissSplash();
            }
        }, 4500);
    }


    function bindMenuEvents() {
        document.getElementById('btn-solo-1v1').onclick = () => startGame('solo', 2);
        document.getElementById('btn-solo-1v2').onclick = () => startGame('solo', 3);
        document.getElementById('btn-solo-1v3').onclick = () => startGame('solo', 4);
        document.getElementById('btn-duo').onclick      = () => startGame('duo', 4);
        document.getElementById('btn-play-again').onclick = () => {
            startGame(gameState.gameMode, gameState.playerCount);
        };
        document.getElementById('btn-main-menu').onclick = () => {
            UnoUI.showScreen('menu');
        };
        document.getElementById('btn-back-to-menu').onclick = () => {
            UnoUI.showScreen('menu');
        };
    }

    // ── Start Game ───────────────────────────────────────────
    function startGame(mode, playerCount) {
        gameState = UnoGame.initGame(mode, playerCount);
        isProcessing = false;
        clearTimeout(unoTimerId);

        UnoUI.showScreen('game');
        UnoUI.setupGameUI(gameState);
        UnoUI.setCallbacks(onCardClicked, onDrawClicked, onUnoClicked);
        UnoUI.render(gameState);
        UnoUI.setStatus("Your turn — play a card or draw");

        if (!gameState.players[gameState.currentPlayer].isHuman) {
            processAITurn();
        }
    }

    // ── Human Actions ────────────────────────────────────────
    function onCardClicked(cardIdx, card) {
        if (isProcessing || gameState.gameOver) return;
        const state = gameState;
        if (!state.players[state.currentPlayer].isHuman) return;

        if (card.color === 'Wild') {
            isProcessing = true;
            UnoUI.showColorChooser().then(chosenColor => {
                executePlay(state.currentPlayer, cardIdx, chosenColor);
            });
        } else {
            isProcessing = true;
            executePlay(state.currentPlayer, cardIdx, null);
        }
    }

    function onDrawClicked() {
        if (isProcessing || gameState.gameOver) return;
        const state = gameState;
        const playerIdx = state.currentPlayer;
        if (!state.players[playerIdx].isHuman) return;

        if (state.turnPhase === 'drawn') {
            passTurn(playerIdx);
            return;
        }

        if (state.turnPhase !== 'play') return;

        isProcessing = true;
        const posMap = UnoUI.getPositionMap(state.playerCount);

        UnoUI.animateCardDraw(posMap[playerIdx]).then(() => {
            const result = UnoGame.drawCardForTurn(playerIdx);

            if (result.drawn) {
                UnoUI.showAction('You drew a card');
            }

            if (result.canPlay) {
                UnoUI.setStatus("Play the drawn card or tap draw pile to pass");
                UnoUI.render(gameState);
                isProcessing = false;
            } else {
                UnoUI.render(gameState);
                setTimeout(() => { passTurn(playerIdx); }, 500);
            }
        });
    }

    function onUnoClicked() {
        if (gameState.gameOver) return;
        const success = UnoGame.callUno(0);
        if (success) {
            UnoUI.showAction('🎯 UNO!');
            UnoUI.hideUnoButton();
            clearTimeout(unoTimerId);
        }
        UnoUI.render(gameState);
    }

    // ── Execute Play ─────────────────────────────────────────
    async function executePlay(playerIdx, cardIdx, chosenColor) {
        const state = gameState;
        const posMap = UnoUI.getPositionMap(state.playerCount);
        const card = state.players[playerIdx].hand[cardIdx];

        // Animate card flying
        await UnoUI.animateCardPlay(posMap[playerIdx], card);

        // Execute
        const result = UnoGame.playCard(playerIdx, cardIdx, chosenColor);

        if (!result.success) {
            isProcessing = false;
            UnoUI.render(state);
            return;
        }

        // Action message
        showCardAction(state.players[playerIdx].name, result, chosenColor);
        UnoUI.render(state);

        // Check win
        if (result.effect === 'win') {
            setTimeout(() => { UnoUI.showResult(state); }, 800);
            isProcessing = false;
            return;
        }

        // Show special overlays
        if (result.effect && result.effect.type === 'reverse') {
            UnoUI.showReverseOverlay();
            await sleep(600);
        } else if (result.effect && result.effect.type === 'skip') {
            UnoUI.showSkipOverlay();
            await sleep(600);
        }

        // UNO call timing
        handleUnoCall(playerIdx);

        // Draw penalty animations
        if (result.effect && result.effect.type === 'draw2') {
            await animateDrawPenalty(result.effect.drawPlayer, 2);
        } else if (result.effect && result.effect.type === 'draw4') {
            await animateDrawPenalty(result.effect.drawPlayer, 4);
        }

        // Next turn
        UnoGame.endTurn();
        UnoUI.render(state);
        isProcessing = false;

        // Continue
        if (!state.gameOver) {
            if (!state.players[state.currentPlayer].isHuman) {
                processAITurn();
            } else {
                updateHumanStatus();
            }
        }
    }

    // ── AI Turn ──────────────────────────────────────────────
    function processAITurn() {
        if (gameState.gameOver || isProcessing) return;
        isProcessing = true;

        const state = gameState;
        const playerIdx = state.currentPlayer;
        const player = state.players[playerIdx];
        const posMap = UnoUI.getPositionMap(state.playerCount);

        UnoUI.setStatus(`${player.name} is thinking...`);

        const delay = UnoAI.getThinkDelay();

        setTimeout(async () => {
            const decision = UnoAI.decide(playerIdx);

            if (decision.action === 'play') {
                const card = player.hand[decision.cardIdx];

                await UnoUI.animateCardPlay(posMap[playerIdx], card);

                const result = UnoGame.playCard(playerIdx, decision.cardIdx, decision.chosenColor);
                showCardAction(player.name, result, decision.chosenColor);
                UnoUI.render(state);

                if (result.effect === 'win') {
                    setTimeout(() => UnoUI.showResult(state), 800);
                    isProcessing = false;
                    return;
                }

                // Overlays
                if (result.effect && result.effect.type === 'reverse') {
                    UnoUI.showReverseOverlay();
                    await sleep(600);
                } else if (result.effect && result.effect.type === 'skip') {
                    UnoUI.showSkipOverlay();
                    await sleep(600);
                }

                // AI auto-calls UNO
                if (state.unoCallRequired === playerIdx) {
                    await sleep(300);
                    UnoGame.callUno(playerIdx);
                    UnoUI.showAction(`${player.name} calls UNO!`);
                }

                // Draw penalties
                if (result.effect && result.effect.type === 'draw2') {
                    await animateDrawPenalty(result.effect.drawPlayer, 2);
                } else if (result.effect && result.effect.type === 'draw4') {
                    await animateDrawPenalty(result.effect.drawPlayer, 4);
                }

                UnoGame.endTurn();
                UnoUI.render(state);
                isProcessing = false;

                if (!state.gameOver) {
                    if (!state.players[state.currentPlayer].isHuman) {
                        setTimeout(() => processAITurn(), 250);
                    } else {
                        updateHumanStatus();
                    }
                }
            } else {
                // AI draws
                await UnoUI.animateCardDraw(posMap[playerIdx]);
                const drawResult = UnoGame.drawCardForTurn(playerIdx);
                UnoUI.showAction(`${player.name} draws a card`);
                UnoUI.render(state);

                if (drawResult.canPlay) {
                    const drawnDecision = UnoAI.decideDrawnCard(playerIdx, drawResult.drawn);

                    if (drawnDecision.action === 'play') {
                        await sleep(500);
                        const cardIdx = player.hand.indexOf(drawResult.drawn);
                        if (cardIdx >= 0) {
                            await UnoUI.animateCardPlay(posMap[playerIdx], drawResult.drawn);
                            const result = UnoGame.playCard(playerIdx, cardIdx, drawnDecision.chosenColor);
                            showCardAction(player.name, result, drawnDecision.chosenColor);
                            UnoUI.render(state);

                            if (result.effect === 'win') {
                                setTimeout(() => UnoUI.showResult(state), 800);
                                isProcessing = false;
                                return;
                            }

                            if (result.effect && result.effect.type === 'reverse') {
                                UnoUI.showReverseOverlay();
                                await sleep(600);
                            } else if (result.effect && result.effect.type === 'skip') {
                                UnoUI.showSkipOverlay();
                                await sleep(600);
                            }

                            if (state.unoCallRequired === playerIdx) {
                                UnoGame.callUno(playerIdx);
                                UnoUI.showAction(`${player.name} calls UNO!`);
                            }

                            if (result.effect && (result.effect.type === 'draw2' || result.effect.type === 'draw4')) {
                                await animateDrawPenalty(result.effect.drawPlayer, result.effect.drawCount);
                            }
                        }
                    }
                }

                UnoGame.endTurn();
                UnoUI.render(state);
                isProcessing = false;

                if (!state.gameOver) {
                    if (!state.players[state.currentPlayer].isHuman) {
                        setTimeout(() => processAITurn(), 250);
                    } else {
                        updateHumanStatus();
                    }
                }
            }
        }, delay);
    }

    // ── Helpers ───────────────────────────────────────────────
    function passTurn(playerIdx) {
        UnoGame.endTurn();
        UnoUI.render(gameState);
        isProcessing = false;

        if (!gameState.players[gameState.currentPlayer].isHuman && !gameState.gameOver) {
            processAITurn();
        } else if (!gameState.gameOver) {
            updateHumanStatus();
        }
    }

    async function animateDrawPenalty(playerIdx, count) {
        const posMap = UnoUI.getPositionMap(gameState.playerCount);
        const playerName = gameState.players[playerIdx].name;
        UnoUI.showAction(`${playerName} draws ${count} cards!`);

        for (let i = 0; i < count; i++) {
            await UnoUI.animateCardDraw(posMap[playerIdx]);
            await sleep(120);
        }
        UnoUI.render(gameState);
    }

    function handleUnoCall(playerIdx) {
        if (gameState.unoCallRequired === 0) {
            clearTimeout(unoTimerId);
            unoTimerId = setTimeout(() => {
                if (gameState.unoCallRequired === 0 && !gameState.players[0].calledUno) {
                    UnoGame.penalizeUno(0);
                    UnoUI.showAction('Missed UNO! +2 penalty! 😱');
                    UnoUI.hideUnoButton();
                    UnoUI.render(gameState);
                }
            }, 3000);
        }
    }

    function showCardAction(playerName, result, chosenColor) {
        const card = result.card;
        let msg = `${playerName} played `;

        if (card.value === 'Wild')           msg += `Wild → ${chosenColor}`;
        else if (card.value === 'Wild_Draw') msg += `Wild +4 → ${chosenColor}`;
        else if (card.value === 'Draw')      msg += `${card.color} +2`;
        else if (card.value === 'Skip')      msg += `${card.color} Skip`;
        else if (card.value === 'Reverse')   msg += `${card.color} Reverse`;
        else                                 msg += `${card.color} ${card.value}`;

        UnoUI.showAction(msg);
    }

    function updateHumanStatus() {
        const state = gameState;
        if (UnoGame.hasPlayableCard(state.currentPlayer)) {
            UnoUI.setStatus("Your turn — play a card or draw");
        } else {
            UnoUI.setStatus("No playable cards — tap the draw pile");
        }
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ── Boot ─────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

    return { init };
})();
