document.addEventListener('DOMContentLoaded', () => {
    // --- INITIALISATION ---
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId');
    const playerId = urlParams.get('playerId');
    
    if (!gameId || !playerId || !window.db) { window.location.href = 'index.html'; return; }

    const db = window.db;
    const gameRef = db.ref(`games/${gameId}`);
    let currentGame = {};
    let isProcessing = false;

    // --- RÉFÉRENCES UI ---
    const UI = {
        pyramidContainer: document.getElementById('pyramid-container'),
        playersCardsContainer: document.getElementById('players-cards-container'),
        dynamicActionsContainer: document.getElementById('dynamic-actions-container'),
        targetModal: document.getElementById('target-modal'),
        sipsCount: document.getElementById('sips-count'),
        targetPlayers: document.getElementById('target-players'),
        menuToggle: document.getElementById('menu-toggle'),
        sidebar: document.getElementById('mobile-sidebar'),
        closeSidebar: document.getElementById('close-sidebar'),
        playersContainer: document.getElementById('players-container'),
        chatInput: document.getElementById('chat-input-mobile'),
        sendChatBtn: document.getElementById('send-chat-mobile'),
        leaveGameBtn: document.getElementById('leave-game-mobile'),
        toast: document.getElementById('toast-notification'),
        toastContent: document.querySelector('.toast-content')
    };
    
    // --- ÉVÉNEMENTS UI ---
    UI.menuToggle.addEventListener('click', () => UI.sidebar.classList.add('open'));
    UI.closeSidebar.addEventListener('click', () => UI.sidebar.classList.remove('open'));
    UI.sendChatBtn.addEventListener('click', sendChatMessage);
    UI.chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendChatMessage());
    UI.leaveGameBtn.addEventListener('click', handleLeaveGame);

    // --- ÉCOUTEURS FIREBASE ---
    gameRef.on('value', handleGameUpdate);
    db.ref(`games/${gameId}/chat`).on('child_added', renderChatMessage);

    function handleGameUpdate(snapshot) {
        currentGame = snapshot.val();
        if (!currentGame || !currentGame.players || !currentGame.players[playerId]) { window.location.href = 'index.html'; return; }
        if (currentGame.phase === "distribution") { window.location.href = `game.html?gameId=${gameId}&playerId=${playerId}`; return; }
        updateEntireUI();
    }

    function updateEntireUI() {
        updateHeaderInfo(); // Met à jour le nouvel en-tête
        renderPyramid();
        renderAllPlayersCards();
        renderPlayersList();
        renderDynamicActions();
    }
    
    function updateHeaderInfo() {
        const me = currentGame.players[playerId];
        if (!me) return;

        const gameIdDisplay = document.getElementById('game-id-mobile');
        const avatarDisplay = document.getElementById('header-player-avatar');
        const nameDisplay = document.getElementById('header-player-name');

        if (gameIdDisplay) gameIdDisplay.textContent = currentGame.gameCode || '...';
        if (nameDisplay) nameDisplay.textContent = me.name || '...';
        if (avatarDisplay) {
            if (me.avatar) {
                avatarDisplay.style.backgroundImage = `url('${me.avatar}')`;
            } else {
                avatarDisplay.style.backgroundImage = 'none';
            }
        }
    }

    async function handlePyramidCardClick(rowIndex, cardIndex) {
        if (isProcessing || currentGame.hostId !== playerId) return;

        const allPlayersActed = Object.values(currentGame.players).every(p => {
            const lastCardId = currentGame.lastRevealedCardId;
            // Un joueur a agi s'il a cliqué (actedOnCard) ou s'il doit gérer des gorgées (sipsQueue)
            return p.actedOnCard === lastCardId || (p.sipsQueue && Object.keys(p.sipsQueue).length > 0);
        });

        if (currentGame.lastRevealedCardId && !allPlayersActed) {
            showToast("Attendez que tous les joueurs aient agi !", 'error');
            return;
        }

        isProcessing = true;
        try {
            const cardId = `${rowIndex}-${cardIndex}`;
            const nextCardFromDeck = currentGame.deck?.[0];
            if (!nextCardFromDeck) throw new Error("Le deck est vide !");
            
            const updates = {
                [`pyramid/${rowIndex}/${cardIndex}/revealed`]: true,
                [`pyramid/${rowIndex}/${cardIndex}/value`]: nextCardFromDeck.value,
                [`pyramid/${rowIndex}/${cardIndex}/suit`]: nextCardFromDeck.suit,
                'deck': currentGame.deck.slice(1),
                'lastRevealedCardId': cardId
            };
            // Réinitialise le statut d'action pour tous les joueurs
            Object.keys(currentGame.players).forEach(pId => {
                updates[`players/${pId}/actedOnCard`] = null;
            });
            await gameRef.update(updates);
        } catch (error) { showToast(error.message, 'error'); } 
        finally { isProcessing = false; }
    }

    function renderPyramid() {
        UI.pyramidContainer.innerHTML = '';
        (currentGame.pyramid || []).forEach((row, rowIndex) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'pyramid-row';
            row.forEach((card, cardIndex) => {
                const cardEl = document.createElement('div');
                cardEl.className = `pyramid-card ${card.revealed ? 'revealed' : ''}`;
                const isRed = ['hearts', 'diamonds'].includes(card.suit);
                const suitSymbol = getSuitSymbol(card.suit);
                cardEl.innerHTML = `
                    <div class="card-inner">
                        <div class="card-front ${isRed ? 'red' : 'black'}">
                            <div class="corner top-left"><span class="value">${card.value || ''}</span><span class="suit">${suitSymbol}</span></div>
                            <div class="suit-center">${suitSymbol}</div>
                            <div class="corner bottom-right"><span class="value">${card.value || ''}</span><span class="suit">${suitSymbol}</span></div>
                        </div>
                        <div class="card-back"></div>
                    </div>`;
                if (currentGame.hostId === playerId && !card.revealed) {
                    cardEl.style.cursor = 'pointer';
                    cardEl.onclick = () => handlePyramidCardClick(rowIndex, cardIndex);
                }
                rowEl.appendChild(cardEl);
            });
            UI.pyramidContainer.appendChild(rowEl);
        });
    }

    function renderAllPlayersCards() {
        UI.playersCardsContainer.innerHTML = '';
        Object.entries(currentGame.players || {}).forEach(([id, player]) => {
            const isSelf = id === playerId;
            const section = document.createElement('div');
            section.className = 'player-cards-group';
            section.innerHTML = `<h3>${player.name} ${isSelf ? '(Vous)' : ''}</h3>`;
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'player-hand-main';
            if (player.cards) {
                player.cards.forEach((card, index) => {
                    const cardEl = document.createElement('div');
                    cardEl.className = 'pyramid-card'; // Utilise la même classe que les cartes de la pyramide
                    const isRed = ['hearts', 'diamonds'].includes(card.suit);
                    const suitSymbol = getSuitSymbol(card.suit);
                    const playerAvatar = player.avatar || '';
                    const backStyle = playerAvatar ? `style="background-image: url('${playerAvatar}')"` : '';
                    cardEl.innerHTML = `
                        <div class="card-inner">
                            <div class="card-front ${isRed ? 'red' : 'black'}">
                                <div class="corner top-left"><span class="value">${card.value}</span><span class="suit">${suitSymbol}</span></div>
                                <div class="suit-center">${suitSymbol}</div>
                                <div class="corner bottom-right"><span class="value">${card.value}</span><span class="suit">${suitSymbol}</span></div>
                            </div>
                            <div class="card-back" ${backStyle}></div>
                        </div>`;
                    if (player.isAccused && isSelf) {
                         cardEl.classList.add('clickable-accused');
                         cardEl.onclick = () => handleShowProofCard(index);
                    }
                    cardsContainer.appendChild(cardEl);
                });
            }
            section.appendChild(cardsContainer);
            UI.playersCardsContainer.appendChild(section);
        });
    }

    function renderDynamicActions() {
        const me = currentGame.players[playerId];
        UI.dynamicActionsContainer.innerHTML = '';
        UI.dynamicActionsContainer.classList.add('hidden');
        if (me?.sipsQueue) {
            const eventKeys = Object.keys(me.sipsQueue).sort((a, b) => me.sipsQueue[a].timestamp - me.sipsQueue[b].timestamp);
            const oldestEventKey = eventKeys[0];
            if (oldestEventKey) {
                const event = me.sipsQueue[oldestEventKey];
                const fromPlayerName = currentGame.players[event.fromId]?.name || "Un joueur";
                const sipsText = `${event.amount} gorgée(s)`;
                UI.dynamicActionsContainer.innerHTML = `<div class="action-prompt">${fromPlayerName} vous a donné ${sipsText}.</div><div class="action-buttons"><button class="action-button liar-button" onclick="handleLiarAccusation(${event.amount}, '${event.fromId}', '${oldestEventKey}')">Menteur!</button><button class="action-button drink-button" onclick="handleDrinkSips('${oldestEventKey}')">Boire</button></div>`;
                UI.dynamicActionsContainer.classList.remove('hidden');
                return;
            }
        }
        if (me?.isAccused) {
            const accuserName = currentGame.players[me.accusedBy]?.name || "un joueur";
            UI.dynamicActionsContainer.innerHTML = `<div class="action-prompt"><p>${accuserName} vous accuse de mentir sur la carte ${me.accusedOfCard}!</p><p><strong>Cliquez sur une de vos cartes pour prouver le contraire.</strong></p></div>`;
            UI.dynamicActionsContainer.classList.remove('hidden');
            return;
        }
        const lastCard = getLastRevealedCard();
        if (lastCard && me && (!me.actedOnCard || me.actedOnCard !== lastCard.id)) {
            const sips = lastCard.sips;
            const sipsText = `${sips} gorgée(s)`;
            UI.dynamicActionsContainer.innerHTML = `<div class="action-prompt">Carte retournée : ${lastCard.value}. ${sipsText} en jeu.</div><div class="action-buttons"><button class="action-button give-button" onclick="showTargetModal(${sips})">Donner</button><button class="action-button pass-button" onclick="handlePassTurn()">Passer</button></div>`;
            UI.dynamicActionsContainer.classList.remove('hidden');
        }
    }

    async function assignSipsToPlayer(targetPlayerId, sips) { if (isProcessing) return; isProcessing = true; hideTargetModal(); try { const sipsQueueRef = db.ref(`games/${gameId}/players/${targetPlayerId}/sipsQueue`).push(); const lastRevealedCard = getLastRevealedCard(); const updates = { [`players/${targetPlayerId}/sipsQueue/${sipsQueueRef.key}`]: { fromId: playerId, amount: sips, cardValue: lastRevealedCard.value, timestamp: firebase.database.ServerValue.TIMESTAMP }, [`players/${playerId}/actedOnCard`]: lastRevealedCard.id }; await gameRef.update(updates); showToast(`${sips} gorgée(s) donnée(s)`, 'success'); } catch (error) { showToast("Erreur.", 'error'); } finally { isProcessing = false; } }
    async function handlePassTurn() { if (isProcessing) return; isProcessing = true; try { const lastRevealedCard = getLastRevealedCard(); await gameRef.update({ [`players/${playerId}/actedOnCard`]: lastRevealedCard.id }); showToast("Vous avez passé.", "info"); } catch(error) { showToast("Erreur.", 'error'); } finally { isProcessing = false; } }
    async function handleLiarAccusation(sips, fromPlayerId, sipEventKey) { if (isProcessing) return; isProcessing = true; try { const eventData = currentGame.players[playerId].sipsQueue[sipEventKey]; const updates = { [`players/${fromPlayerId}/isAccused`]: true, [`players/${fromPlayerId}/accusedBy`]: playerId, [`players/${fromPlayerId}/accusedOfCard`]: eventData.cardValue, [`players/${fromPlayerId}/accusedSips`]: sips, [`players/${playerId}/sipsQueue/${sipEventKey}`]: null }; await gameRef.update(updates); } catch (error) { showToast("Erreur.", 'error'); } finally { isProcessing = false; } }
    async function handleDrinkSips(sipEventKey) { if (isProcessing) return; isProcessing = true; try { await gameRef.update({ [`players/${playerId}/sipsQueue/${sipEventKey}`]: null }); } catch (error) { showToast("Erreur.", 'error'); } finally { isProcessing = false; } }
    async function handleShowProofCard(cardIndex) { if (isProcessing) return; isProcessing = true; const me = currentGame.players[playerId]; const cardShown = me.cards[cardIndex]; const penalty = me.accusedSips * 2; const updates = { [`players/${playerId}/isAccused`]: null, [`players/${playerId}/accusedBy`]: null, [`players/${playerId}/accusedOfCard`]: null, [`players/${playerId}/accusedSips`]: null, }; if (cardShown.value === me.accusedOfCard) { const accuserSips = (currentGame.players[me.accusedBy]?.sipsToDrink || 0) + penalty; updates[`players/${me.accusedBy}/sipsToDrink`] = accuserSips; showToast("Vous aviez raison ! Il boit.", 'success'); } else { updates[`players/${playerId}/sipsToDrink`] = (me.sipsToDrink || 0) + penalty; showToast("Menteur ! Vous buvez.", 'error'); } try { await gameRef.update(updates); } catch (error) { showToast("Erreur.", 'error'); } finally { isProcessing = false; } }
    function showTargetModal(sips) { UI.sipsCount.textContent = sips; UI.targetPlayers.innerHTML = ''; Object.entries(currentGame.players).forEach(([id, player]) => { if (id !== playerId) { const btn = document.createElement('button'); btn.className = 'target-btn'; btn.textContent = player.name; btn.onclick = () => assignSipsToPlayer(id, sips); UI.targetPlayers.appendChild(btn); } }); UI.targetModal.classList.remove('hidden'); }
    function hideTargetModal() { if(UI.targetModal) UI.targetModal.classList.add('hidden'); }
    function renderPlayersList() { UI.playersContainer.innerHTML = ''; Object.entries(currentGame.players || {}).forEach(([id, player]) => { const playerEl = document.createElement('div'); playerEl.className = `player-item`; playerEl.innerHTML = `<div class="player-avatar">${player.avatar ? `<img src="${player.avatar}" alt="${player.name}">` : ''}</div><span class="player-name">${player.name}${id === playerId ?' (Vous)':''}</span><span class="sips-badge">${player.sipsToDrink||0} gorgées</span>`; UI.playersContainer.appendChild(playerEl); }); }
    function getLastRevealedCard() { const cardId = currentGame.lastRevealedCardId; if (!cardId) return null; const [r, c] = cardId.split('-').map(Number); const pyramid = currentGame.pyramid || []; const totalRows = pyramid.length; if(pyramid[r] && pyramid[r][c]) { const sips = totalRows - r; return { ...pyramid[r][c], id: cardId, sips: sips }; } return null; }
    function getSuitSymbol(suit) { return { 'hearts': '♥', 'diamonds': '♦', 'clubs': '♣', 'spades': '♠' }[suit] || ''; }
    function showToast(message, type = 'info') { UI.toastContent.textContent = message; UI.toast.className = `toast ${type} show`; setTimeout(() => UI.toast.classList.remove('show'), 3000); }
    function sendChatMessage() { const message = UI.chatInput.value.trim(); if(message){db.ref(`games/${gameId}/chat`).push({playerId, playerName:currentGame.players[playerId]?.name, avatar:currentGame.players[playerId]?.avatar, message, timestamp:Date.now()}); UI.chatInput.value='';} }
    function renderChatMessage(snapshot) { const msg = snapshot.val(); const messagesContainer = document.getElementById('chat-messages'); const msgEl = document.createElement('div'); msgEl.innerHTML = `<div><strong>${msg.playerName}:</strong> ${msg.message}</div>`; messagesContainer.appendChild(msgEl); messagesContainer.scrollTop = messagesContainer.scrollHeight; }
    async function handleLeaveGame() { await db.ref(`games/${gameId}/players/${playerId}`).remove(); window.location.href = 'index.html'; }

    // On expose les fonctions nécessaires aux boutons HTML
    window.handlePyramidCardClick = handlePyramidCardClick;
    window.assignSipsToPlayer = assignSipsToPlayer;
    window.handleLiarAccusation = handleLiarAccusation;
    window.handleDrinkSips = handleDrinkSips;
    window.handleShowProofCard = handleShowProofCard;
    window.showTargetModal = showTargetModal;
    window.handlePassTurn = handlePassTurn;
});