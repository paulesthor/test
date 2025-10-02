document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.database();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- Références UI ---
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');
    const profileBtn = document.getElementById('profile-btn');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const modal = document.getElementById('auth-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalTitle = document.getElementById('modal-title');
    const authForm = document.getElementById('auth-form');
    const usernameInput = document.getElementById('username-input');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const modalActionBtn = document.getElementById('modal-action-btn');
    const modalError = document.getElementById('modal-error');

    let isSignup = false;

    // --- GESTION DE L'ÉTAT DE CONNEXION ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // L'utilisateur EST connecté
            db.ref(`users/${user.uid}`).once('value').then(snapshot => {
                const userData = snapshot.val();
                if (userData && userData.username) {
                    userInfo.textContent = `Bienvenue, ${userData.username}`;
                } else {
                    userInfo.textContent = `Bienvenue !`;
                }
            });

            userInfo.classList.remove('hidden');
            profileBtn.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
            loginBtn.classList.add('hidden');
            signupBtn.classList.add('hidden');
        } else {
            // L'utilisateur N'EST PAS connecté
            userInfo.classList.add('hidden');
            profileBtn.classList.add('hidden');
            logoutBtn.classList.add('hidden');
            loginBtn.classList.remove('hidden');
            signupBtn.classList.remove('hidden');
        }
    });

    // --- GESTION DES CLICS ---
    loginBtn.addEventListener('click', () => openModal(false));
    signupBtn.addEventListener('click', () => openModal(true));
    closeModalBtn.addEventListener('click', closeModal);
    logoutBtn.addEventListener('click', () => auth.signOut());
    googleSignInBtn.addEventListener('click', signInWithGoogle);
    authForm.addEventListener('submit', handleFormSubmit);

    // --- FONCTIONS ---
    function openModal(isSignUpMode) {
        isSignup = isSignUpMode;
        modalTitle.textContent = isSignup ? 'Inscription' : 'Connexion';
        usernameInput.classList.toggle('hidden', !isSignup);
        modalActionBtn.textContent = isSignup ? 'Créer un compte' : 'Se connecter';
        modal.classList.remove('hidden');
        modalError.classList.add('hidden');
        authForm.reset();
    }

    function closeModal() {
        modal.classList.add('hidden');
    }

    async function signInWithGoogle() {
        modalError.classList.add('hidden');
        try {
            const result = await auth.signInWithPopup(googleProvider);
            const user = result.user;
            // Vérifie si l'utilisateur existe déjà dans la BDD
            const userRef = db.ref(`users/${user.uid}`);
            const snapshot = await userRef.once('value');
            if (!snapshot.exists()) {
                // Si c'est sa première connexion, on crée son profil
                await userRef.set({
                    username: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    avatar: user.photoURL || '',
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    stats: { partiesJouees: 0 }
                });
            }
            closeModal();
        } catch (error) {
            showModalError(error.message);
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        const username = usernameInput.value.trim();
        modalError.classList.add('hidden');

        try {
            if (isSignup) {
                if (username.length < 3) {
                    throw new Error("Le pseudo doit faire au moins 3 caractères.");
                }
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await db.ref(`users/${userCredential.user.uid}`).set({
                    username: username,
                    email: email,
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    stats: { partiesJouees: 0 }
                });
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
            authForm.reset();
            closeModal();
        } catch (error) {
            showModalError(error.message);
        }
    }

    function showModalError(message) {
        modalError.textContent = message;
        modalError.classList.remove('hidden');
    }
});