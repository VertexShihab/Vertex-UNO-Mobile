// ============================================================
// ui.js — UNO Premium UI Renderer
// Inspired by Ubisoft's UNO visual language
// ============================================================

const UnoUI = (() => {
    // ── DOM Cache ────────────────────────────────────────────
    let els = {};

    function cacheDom() {
        els = {
            menuScreen:     document.getElementById('menu-screen'),
            gameScreen:     document.getElementById('game-screen'),
            resultScreen:   document.getElementById('result-screen'),
            // Canvases
            particleCanvas: document.getElementById('particle-canvas'),
            confettiCanvas: document.getElementById('confetti-canvas'),
            // Player seats
            playerBottom: document.getElementById('player-bottom'),
            playerTop:    document.getElementById('player-top'),
            playerLeft:   document.getElementById('player-left'),
            playerRight:  document.getElementById('player-right'),
            // Hands
            handBottom: document.getElementById('hand-bottom'),
            handTop:    document.getElementById('hand-top'),
            handLeft:   document.getElementById('hand-left'),
            handRight:  document.getElementById('hand-right'),
            // Avatar rings
            avatarBottom: document.getElementById('avatar-ring-bottom'),
            avatarTop:    document.getElementById('avatar-ring-top'),
            avatarLeft:   document.getElementById('avatar-ring-left'),
            avatarRight:  document.getElementById('avatar-ring-right'),
            // Names / counts / labels
            nameBottom: document.getElementById('name-bottom'),
            nameTop:    document.getElementById('name-top'),
            nameLeft:   document.getElementById('name-left'),
            nameRight:  document.getElementById('name-right'),
            countBottom: document.getElementById('count-bottom'),
            countTop:    document.getElementById('count-top'),
            countLeft:   document.getElementById('count-left'),
            countRight:  document.getElementById('count-right'),
            labelBottom: document.getElementById('label-bottom'),
            labelTop:    document.getElementById('label-top'),
            labelLeft:   document.getElementById('label-left'),
            labelRight:  document.getElementById('label-right'),
            // Center
            discardPile:  document.getElementById('discard-pile'),
            drawPile:     document.getElementById('draw-pile'),
            colorIndicator: document.getElementById('color-indicator'),
            dirIndicator: document.getElementById('direction-indicator'),
            ringProgress: document.getElementById('ring-progress'),
            // HUD
            hudText:    document.getElementById('hud-text'),
            gameStatus: document.getElementById('game-status'),
            // Buttons / modals
            unoBtn:     document.getElementById('uno-btn'),
            colorModal: document.getElementById('color-modal'),
            actionLog:  document.getElementById('action-log'),
            backBtn:    document.getElementById('btn-back-to-menu'),
            // Overlays
            reverseOverlay: document.getElementById('reverse-overlay'),
            skipOverlay:    document.getElementById('skip-overlay'),
            // Result
            resultTitle:   document.getElementById('result-title'),
            resultMessage: document.getElementById('result-message'),
            resultTrophy:  document.getElementById('result-trophy'),
        };

        initParticles();
    }

    // ── Screen Management ────────────────────────────────────
    function showScreen(name) {
        els.menuScreen.classList.toggle('active', name === 'menu');
        els.gameScreen.classList.toggle('active', name === 'game');
        els.resultScreen.classList.toggle('active', name === 'result');

        if (name === 'result') startConfetti();
        if (name === 'menu') startParticleLoop();
    }

    // ── Position Mapping ─────────────────────────────────────
    function getPositionMap(playerCount) {
        switch (playerCount) {
            case 2: return ['bottom', 'top'];
            case 3: return ['bottom', 'left', 'right'];
            case 4: return ['bottom', 'left', 'top', 'right'];
            default: return ['bottom', 'left', 'top', 'right'];
        }
    }

    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const getHandEl   = pos => els[`hand${cap(pos)}`];
    const getNameEl   = pos => els[`name${cap(pos)}`];
    const getCountEl  = pos => els[`count${cap(pos)}`];
    const getLabelEl  = pos => els[`label${cap(pos)}`];
    const getSeatEl   = pos => els[`player${cap(pos)}`];
    const getAvatarEl = pos => els[`avatar${cap(pos)}`];

    // ── Initial Game Setup ───────────────────────────────────
    function setupGameUI(state) {
        const posMap = getPositionMap(state.playerCount);

        // Hide all seats
        ['bottom', 'top', 'left', 'right'].forEach(pos => {
            getSeatEl(pos).classList.add('hidden-seat');
            getAvatarEl(pos).classList.remove('active-ring');
            getLabelEl(pos).className = 'team-badge';
            getLabelEl(pos).style.display = 'none';
        });

        // Show active seats
        state.players.forEach((player, idx) => {
            const pos = posMap[idx];
            getSeatEl(pos).classList.remove('hidden-seat');
            getNameEl(pos).textContent = player.name;

            if (state.gameMode === 'duo') {
                const lbl = getLabelEl(pos);
                if (player.teamId === 'A') {
                    lbl.textContent = 'TEAM A';
                    lbl.className = 'team-badge team-a-badge';
                } else {
                    lbl.textContent = 'TEAM B';
                    lbl.className = 'team-badge team-b-badge';
                }
                lbl.style.display = 'block';
            }
        });
    }

    // ── Callbacks ────────────────────────────────────────────
    let onCardClick = null;
    let onDrawClick = null;
    let onUnoClick  = null;

    function setCallbacks(cardCb, drawCb, unoCb) {
        onCardClick = cardCb;
        onDrawClick = drawCb;
        onUnoClick  = unoCb;
    }

    // ── Render Full State ────────────────────────────────────
    function render(state) {
        const posMap = getPositionMap(state.playerCount);

        // Render each player
        state.players.forEach((player, idx) => {
            const pos = posMap[idx];
            renderHand(player, idx, pos, state);
            getCountEl(pos).textContent = player.hand.length;
        });

        // Discard pile
        renderDiscard(state);

        // Direction
        renderDirection(state);

        // Color indicator
        renderColorIndicator(state);

        // Turn ring & avatar highlights
        renderTurnIndicator(state, posMap);

        // UNO button
        updateUnoButton(state);

        // Draw pile click
        els.drawPile.onclick = () => { if (onDrawClick) onDrawClick(); };
    }

    // ── Render Hand ──────────────────────────────────────────
    function renderHand(player, playerIdx, position, state) {
        const container = getHandEl(position);
        container.innerHTML = '';

        if (player.isHuman) {
            const playable = UnoGame.getPlayableIndices(playerIdx);
            const isMyTurn = state.currentPlayer === playerIdx && !state.gameOver;
            const totalCards = player.hand.length;

            player.hand.forEach((card, cardIdx) => {
                const cardEl = document.createElement('div');
                cardEl.className = 'card human-card';

                const img = document.createElement('img');
                img.src = UnoGame.getCardImage(card);
                img.alt = `${card.color} ${card.value}`;
                img.draggable = false;
                cardEl.appendChild(img);

                const canPlay = isMyTurn && playable.includes(cardIdx) && state.turnPhase === 'play';
                const canPlayDrawn = isMyTurn && state.turnPhase === 'drawn' && state.drawnCard &&
                    card.id === state.drawnCard.id && UnoGame.isPlayable(card);

                if (canPlay || canPlayDrawn) {
                    cardEl.classList.add('playable');
                    cardEl.onclick = () => { if (onCardClick) onCardClick(cardIdx, card); };
                } else {
                    cardEl.classList.add('not-playable');
                    if (isMyTurn) {
                        cardEl.onclick = () => {
                            cardEl.classList.add('shake');
                            setTimeout(() => cardEl.classList.remove('shake'), 500);
                        };
                    }
                }

                // Fan spread
                const maxAngle = Math.min(totalCards * 2.5, 25);
                const angle = totalCards > 1
                    ? -maxAngle + (cardIdx / (totalCards - 1)) * 2 * maxAngle
                    : 0;
                const rise = -Math.abs(angle) * 0.6;
                cardEl.style.transform = `rotate(${angle}deg) translateY(${rise}px)`;
                cardEl.style.zIndex = cardIdx;

                container.appendChild(cardEl);
            });
        } else {
            // AI: card backs
            const count = player.hand.length;
            const isVertical = position === 'left' || position === 'right';

            for (let i = 0; i < count; i++) {
                const cardEl = document.createElement('div');
                cardEl.className = 'card ai-card';

                const img = document.createElement('img');
                img.src = 'assets/cards/Deck.png';
                img.alt = 'Card back';
                img.draggable = false;
                cardEl.appendChild(img);

                if (isVertical) {
                    const maxOff = Math.min(count * 7, 70);
                    const off = count > 1 ? -maxOff / 2 + (i / (count - 1)) * maxOff : 0;
                    cardEl.style.transform = `translateY(${off}px)`;
                } else {
                    const maxOff = Math.min(count * 12, 120);
                    const off = count > 1 ? -maxOff / 2 + (i / (count - 1)) * maxOff : 0;
                    cardEl.style.transform = `translateX(${off}px)`;
                }
                cardEl.style.zIndex = i;
                container.appendChild(cardEl);
            }
        }
    }

    // ── Render Discard ───────────────────────────────────────
    function renderDiscard(state) {
        const topCard = UnoGame.getTopCard();
        if (!topCard) return;

        els.discardPile.innerHTML = '';
        const img = document.createElement('img');
        img.src = UnoGame.getCardImage(topCard);
        img.alt = `${topCard.color} ${topCard.value}`;
        img.className = 'discard-card';
        const rot = (Math.random() - 0.5) * 12;
        img.style.transform = `rotate(${rot}deg)`;
        els.discardPile.appendChild(img);
    }

    // ── Direction ────────────────────────────────────────────
    function renderDirection(state) {
        if (state.direction === 1) {
            els.dirIndicator.classList.add('clockwise');
            els.dirIndicator.classList.remove('counter-clockwise');
        } else {
            els.dirIndicator.classList.remove('clockwise');
            els.dirIndicator.classList.add('counter-clockwise');
        }
    }

    // ── Color Indicator ──────────────────────────────────────
    function renderColorIndicator(state) {
        const el = els.colorIndicator;
        el.className = 'active-color';
        el.classList.add(`color-${state.currentColor.toLowerCase()}`);
        el.querySelector('.active-color-text').textContent = state.currentColor.toUpperCase();
    }

    // ── Turn Indicator ───────────────────────────────────────
    function renderTurnIndicator(state, posMap) {
        // Clear all avatar highlights
        ['bottom', 'top', 'left', 'right'].forEach(pos => {
            getAvatarEl(pos).classList.remove('active-ring');
        });

        // Highlight current player
        const currentPos = posMap[state.currentPlayer];
        if (currentPos) {
            getAvatarEl(currentPos).classList.add('active-ring');
        }

        // Update turn ring progress
        updateTurnRing(state.currentPlayer, state.playerCount, posMap);
    }

    function updateTurnRing(currentPlayer, playerCount, posMap) {
        const circumference = 2 * Math.PI * 130; // ~817
        const segment = circumference / playerCount;
        const offset = circumference - (segment * (currentPlayer + 1));
        els.ringProgress.style.strokeDashoffset = offset;

        // Color the ring — gold for human, red-tint for AI (Steam style)
        const pos = posMap[currentPlayer];
        if (pos === 'bottom') {
            els.ringProgress.style.stroke = '#D4A935';
            els.ringProgress.style.filter = 'drop-shadow(0 0 6px rgba(212,169,53,0.7))';
        } else {
            els.ringProgress.style.stroke = '#E8292C';
            els.ringProgress.style.filter = 'drop-shadow(0 0 6px rgba(232,41,44,0.5))';
        }
    }

    // ── UNO Button ───────────────────────────────────────────
    function updateUnoButton(state) {
        if (state.unoCallRequired === 0 && !state.players[0].calledUno) {
            els.unoBtn.classList.add('visible');
            els.unoBtn.onclick = () => { if (onUnoClick) onUnoClick(); };
        } else {
            els.unoBtn.classList.remove('visible');
        }
    }

    function hideUnoButton() {
        els.unoBtn.classList.remove('visible');
    }

    // ── Color Chooser ────────────────────────────────────────
    function showColorChooser() {
        return new Promise(resolve => {
            els.colorModal.classList.add('visible');
            const btns = els.colorModal.querySelectorAll('.color-pick');
            btns.forEach(btn => {
                btn.onclick = () => {
                    const color = btn.dataset.color;
                    els.colorModal.classList.remove('visible');
                    resolve(color);
                };
            });
        });
    }

    function hideColorChooser() {
        els.colorModal.classList.remove('visible');
    }

    // ── Action Toast ─────────────────────────────────────────
    function showAction(message) {
        els.actionLog.textContent = message;
        els.actionLog.classList.add('show');
        clearTimeout(showAction._timer);
        showAction._timer = setTimeout(() => {
            els.actionLog.classList.remove('show');
        }, 1800);
    }

    // ── Reverse / Skip Overlays ──────────────────────────────
    function showReverseOverlay() {
        els.reverseOverlay.classList.add('show');
        setTimeout(() => els.reverseOverlay.classList.remove('show'), 1200);
    }

    function showSkipOverlay() {
        els.skipOverlay.classList.add('show');
        setTimeout(() => els.skipOverlay.classList.remove('show'), 1200);
    }

    // ── HUD Status ───────────────────────────────────────────
    function setStatus(message) {
        els.hudText.textContent = message;
    }

    // ── Card Animations ──────────────────────────────────────
    function animateCardPlay(fromPosition, card) {
        return new Promise(resolve => {
            const flyCard = document.createElement('div');
            flyCard.className = 'flying-card';

            const img = document.createElement('img');
            img.src = UnoGame.getCardImage(card);
            flyCard.appendChild(img);

            const fromEl = getSeatEl(fromPosition);
            const toEl = els.discardPile;
            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();

            flyCard.style.left = `${fromRect.left + fromRect.width / 2 - 36}px`;
            flyCard.style.top = `${fromRect.top + fromRect.height / 2 - 54}px`;

            document.body.appendChild(flyCard);

            requestAnimationFrame(() => {
                flyCard.style.transition = 'all 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                flyCard.style.left = `${toRect.left + toRect.width / 2 - 36}px`;
                flyCard.style.top = `${toRect.top + toRect.height / 2 - 54}px`;
                flyCard.style.transform = `rotate(${(Math.random() - 0.5) * 25}deg) scale(1.15)`;
            });

            setTimeout(() => { flyCard.remove(); resolve(); }, 480);
        });
    }

    function animateCardDraw(toPosition) {
        return new Promise(resolve => {
            const flyCard = document.createElement('div');
            flyCard.className = 'flying-card';

            const img = document.createElement('img');
            img.src = 'assets/cards/Deck.png';
            flyCard.appendChild(img);

            const fromRect = els.drawPile.getBoundingClientRect();
            const toEl = getSeatEl(toPosition);
            const toRect = toEl.getBoundingClientRect();

            flyCard.style.left = `${fromRect.left + fromRect.width / 2 - 36}px`;
            flyCard.style.top = `${fromRect.top + fromRect.height / 2 - 54}px`;

            document.body.appendChild(flyCard);

            requestAnimationFrame(() => {
                flyCard.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                flyCard.style.left = `${toRect.left + toRect.width / 2 - 36}px`;
                flyCard.style.top = `${toRect.top + toRect.height / 2 - 54}px`;
                flyCard.style.opacity = '0.5';
            });

            setTimeout(() => { flyCard.remove(); resolve(); }, 430);
        });
    }

    // ── Result Screen ────────────────────────────────────────
    function showResult(state) {
        const winner = state.players[state.winner];
        const isHumanWin = winner.isHuman;
        const isDuoWin = state.gameMode === 'duo' && state.winningTeam === 'A';

        if (isHumanWin || isDuoWin) {
            els.resultTrophy.textContent = '🏆';
            els.resultTitle.textContent = 'YOU WIN!';
            els.resultTitle.className = 'result-title win';
            els.resultMessage.textContent = state.gameMode === 'duo'
                ? `Team A wins! ${winner.name} played all cards!`
                : 'You cleared your hand!';
        } else {
            els.resultTrophy.textContent = '😞';
            els.resultTitle.textContent = 'GAME OVER';
            els.resultTitle.className = 'result-title lose';
            els.resultMessage.textContent = state.gameMode === 'duo'
                ? `Team B wins. ${winner.name} cleared their hand.`
                : `${winner.name} wins the round.`;
        }

        showScreen('result');
    }

    // ═══════════════════════════════════════════════════════════
    // ███  PARTICLES (Menu background)  ███
    // ═══════════════════════════════════════════════════════════
    let particles = [];
    let particleCtx = null;
    let particleAnimId = null;

    function initParticles() {
        const canvas = els.particleCanvas;
        if (!canvas) return;
        particleCtx = canvas.getContext('2d');
        resizeParticleCanvas();
        window.addEventListener('resize', resizeParticleCanvas);
        createParticles();
        startParticleLoop();
    }

    function resizeParticleCanvas() {
        const canvas = els.particleCanvas;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createParticles() {
        particles = [];
        const count = Math.min(55, Math.floor(window.innerWidth * window.innerHeight / 16000));
        // Gold and green particles — Steam UNO table feel
        const colors = ['#D4A935', '#F5C842', '#1B5230', '#2E7D32', '#8B7020', '#E8292C'];

        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                vx: (Math.random() - 0.5) * 0.25,
                vy: (Math.random() - 0.5) * 0.25,
                r: Math.random() * 1.8 + 0.4,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: Math.random() * 0.22 + 0.04
            });
        }
    }

    function startParticleLoop() {
        if (particleAnimId) return;
        function loop() {
            drawParticles();
            particleAnimId = requestAnimationFrame(loop);
        }
        loop();
    }

    function drawParticles() {
        if (!particleCtx) return;
        const ctx = particleCtx;
        const w = els.particleCanvas.width;
        const h = els.particleCanvas.height;

        ctx.clearRect(0, 0, w, h);

        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = w;
            if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h;
            if (p.y > h) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        }

        // Draw connections
        ctx.globalAlpha = 1;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.03 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ███  CONFETTI (Result screen)  ███
    // ═══════════════════════════════════════════════════════════
    let confettiPieces = [];
    let confettiCtx = null;
    let confettiAnimId = null;

    function startConfetti() {
        const canvas = els.confettiCanvas;
        if (!canvas) return;
        confettiCtx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        confettiPieces = [];
        const colors = ['#E8292C', '#0079BF', '#00A651', '#FFCB05', '#6c5ce7', '#ff6b81', '#ffa502'];

        for (let i = 0; i < 100; i++) {
            confettiPieces.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                w: Math.random() * 10 + 4,
                h: Math.random() * 6 + 3,
                vx: (Math.random() - 0.5) * 3,
                vy: Math.random() * 3 + 2,
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }

        if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
        function loop() {
            drawConfetti();
            confettiAnimId = requestAnimationFrame(loop);
        }
        loop();
    }

    function drawConfetti() {
        if (!confettiCtx) return;
        const ctx = confettiCtx;
        const w = els.confettiCanvas.width;
        const h = els.confettiCanvas.height;

        ctx.clearRect(0, 0, w, h);

        for (const p of confettiPieces) {
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotSpeed;
            p.vy += 0.05;

            if (p.y > h + 20) {
                p.y = -20;
                p.x = Math.random() * w;
                p.vy = Math.random() * 3 + 2;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
    }

    // ── Public API ───────────────────────────────────────────
    return {
        cacheDom,
        showScreen,
        setupGameUI,
        render,
        setCallbacks,
        showColorChooser,
        hideColorChooser,
        showAction,
        showReverseOverlay,
        showSkipOverlay,
        setStatus,
        animateCardPlay,
        animateCardDraw,
        updateUnoButton,
        hideUnoButton,
        showResult,
        getPositionMap
    };
})();
