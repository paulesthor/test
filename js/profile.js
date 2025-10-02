document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.database();

    // --- Références UI ---
    const usernameInput = document.getElementById('username-input');
    const emailDisplay = document.getElementById('email-display');
    const creationDateDisplay = document.getElementById('creation-date');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const successMessage = document.getElementById('success-message');
    
    let currentUser = null;
    let userRef = null;

    // Vérifie si l'utilisateur est connecté
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            userRef = db.ref(`users/${user.uid}`);
            loadUserProfile();
        } else {
            // Si non connecté, renvoyer à l'accueil
            window.location.href = 'index.html';
        }
    });

    // Fonction pour charger les données depuis la base de données
    function loadUserProfile() {
        userRef.on('value', (snapshot) => {
            const userData = snapshot.val();
            if (userData) {
                usernameInput.value = userData.username || '';
                emailDisplay.textContent = currentUser.email;

                // Afficher la date de création du compte
                if (userData.createdAt) {
                    const date = new Date(userData.createdAt);
                    creationDateDisplay.textContent = date.toLocaleDateString('fr-FR');
                }
                
                // Charger les stats (ex: partiesJouees)
                document.getElementById('stat-parties').textContent = userData.stats?.partiesJouees || 0;
            }
        });
    }
    
    // Gérer le clic sur le bouton "Enregistrer"
    saveProfileBtn.addEventListener('click', async () => {
        if (!currentUser) return;

        const newUsername = usernameInput.value.trim();
        if (newUsername.length < 3) {
            alert("Le pseudo doit contenir au moins 3 caractères.");
            return;
        }

        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'Sauvegarde...';

        try {
            await userRef.update({ username: newUsername });

            // Afficher un message de succès
            successMessage.classList.remove('hidden');
            setTimeout(() => successMessage.classList.add('hidden'), 3000);

        } catch (error) {
            console.error("Erreur lors de la mise à jour du pseudo:", error);
            alert("Une erreur est survenue.");
        } finally {
            saveProfileBtn.disabled = false;
            saveProfileBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer le pseudo';
        }
    });
});