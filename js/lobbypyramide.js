document.addEventListener('DOMContentLoaded', () => {
    if (firebase.apps.length) {
        window.db = firebase.database();
    }

    const usernameInput = document.getElementById('username');
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarUpload = document.getElementById('avatar-upload');

    // Pré-remplit le pseudo et l'avatar si l'utilisateur est connecté
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("Utilisateur connecté, récupération du profil...");
            const userRef = db.ref(`users/${user.uid}`);
            userRef.once('value').then(snapshot => {
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    usernameInput.value = userData.username || '';
                    if (userData.avatar) {
                        avatarPreview.innerHTML = `<img src="${userData.avatar}" alt="avatar">`;
                    }
                }
            });
        } else {
            console.log("Utilisateur non connecté.");
        }
    });

    // Gère l'aperçu de l'avatar quand un fichier est choisi
    avatarUpload.addEventListener('change', event => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => {
                avatarPreview.innerHTML = `<img src="${e.target.result}" alt="avatar">`;
            };
            reader.readAsDataURL(file);
        }
    });
    
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('create-game').addEventListener('click', handleCreateGame);
    document.getElementById('join-game').addEventListener('click', () => {
        document.getElementById('join-form').classList.remove('hidden');
        document.getElementById('main-buttons').classList.add('hidden');
    });
    document.getElementById('confirm-join').addEventListener('click', handleJoinGame);
    document.getElementById('cancel-join').addEventListener('click', () => {
        document.getElementById('join-form').classList.add('hidden');
        document.getElementById('main-buttons').classList.remove('hidden');
    });
}

// Fonction pour récupérer les infos du joueur depuis la page
function getPlayerInfoFromPage() {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        showError("Veuillez choisir un pseudo pour jouer.");
        return null;
    }

    const user = firebase.auth().currentUser;
    const avatarImg = document.getElementById('avatar-preview').querySelector('img');
    const avatarUrl = avatarImg ? avatarImg.src : '';

    return {
        uid: user ? user.uid : null, // On stocke l'UID s'il est connecté
        name: username,
        avatar: avatarUrl,
        ready: false,
        online: true
    };
}

async function handleCreateGame() {
    const playerInfo = getPlayerInfoFromPage();
    if (!playerInfo) return; // Stoppe si le pseudo est vide

    try {
        const gameCode = generateGameCode();
        const gameRef = db.ref('games').push();
        
        await db.ref(`gameCodes/${gameCode}`).set({
            gameId: gameRef.key,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });

        const newPlayerId = db.ref(`games/${gameRef.key}/players`).push().key;

        await gameRef.set({
            gameCode,
            hostId: newPlayerId,
            players: { [newPlayerId]: playerInfo },
            status: "waiting",
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        window.location.href = `join.html?gameId=${gameRef.key}&playerId=${newPlayerId}`;

    } catch (error) {
        showError("Erreur: " + error.message);
        console.error("Create game error:", error);
    }
}

async function handleJoinGame() {
    const playerInfo = getPlayerInfoFromPage();
    if (!playerInfo) return; // Stoppe si le pseudo est vide

    const gameCode = document.getElementById('game-id-input').value.trim().toUpperCase();
    if (!gameCode || gameCode.length !== 4) return showError("Code invalide (4 lettres)");

    try {
        const codeSnapshot = await db.ref(`gameCodes/${gameCode}`).once('value');
        if (!codeSnapshot.exists()) return showError("Code incorrect");

        const gameId = codeSnapshot.val().gameId;
        const gameRef = db.ref(`games/${gameId}`);
        const gameSnapshot = await gameRef.once('value');
        if (!gameSnapshot.exists()) return showError("Partie introuvable");

        const playerRef = gameRef.child('players').push();
        await playerRef.set(playerInfo);

        window.location.href = `join.html?gameId=${gameId}&playerId=${playerRef.key}`;

    } catch (error) {
        showError("Erreur: " + error.message);
        console.error("Join game error:", error);
    }
}

function generateGameCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function showError(message) {
    const el = document.getElementById('error-message');
    if (el) {
        el.textContent = message;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
    } else {
        alert(message);
    }
}