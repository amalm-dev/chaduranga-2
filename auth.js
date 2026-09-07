/* Chaduranga 2.0 — Login & Auth System */

const AUTH = {
    user: null,
    
    init() {
        // Check if user already logged in (localStorage)
        const saved = localStorage.getItem('chaduranga_user');
        if (saved) {
            try {
                this.user = JSON.parse(saved);
                this.onLogin(this.user);
            } catch(e) {
                localStorage.removeItem('chaduranga_user');
            }
        }
        
        // Setup login modal events
        document.getElementById('guest-play-btn')?.addEventListener('click', () => {
            this.loginAsGuest();
        });
        
        document.getElementById('google-signin-btn')?.addEventListener('click', () => {
            this.googleSignIn();
        });
        
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });
        
        // Show login overlay if not logged in
        if (!this.user) {
            this.showLoginOverlay();
        }
    },
    
    showLoginOverlay() {
        document.getElementById('login-overlay')?.classList.add('active');
    },
    
    hideLoginOverlay() {
        document.getElementById('login-overlay')?.classList.remove('active');
    },
    
    loginAsGuest() {
        const guestId = 'guest_' + Math.random().toString(36).substr(2, 8);
        const user = {
            id: guestId,
            name: 'Guest Player',
            email: null,
            photo: null,
            isGuest: true
        };
        this.user = user;
        localStorage.setItem('chaduranga_user', JSON.stringify(user));
        this.onLogin(user);
        this.hideLoginOverlay();
    },
    
    googleSignIn() {
        // Google Identity Services — Client-side only
        // Uses the popup flow
        if (typeof google === 'undefined' || !google.accounts) {
            alert('Google Sign-In is not available. Please check your internet connection or use Guest mode.');
            return;
        }
        
        google.accounts.id.initialize({
            client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // Replace with your Google Client ID
            callback: (response) => {
                const payload = this.decodeJWT(response.credential);
                if (payload) {
                    const user = {
                        id: payload.sub,
                        name: payload.name,
                        email: payload.email,
                        photo: payload.picture,
                        isGuest: false
                    };
                    this.user = user;
                    localStorage.setItem('chaduranga_user', JSON.stringify(user));
                    this.onLogin(user);
                    this.hideLoginOverlay();
                }
            }
        });
        
        google.accounts.id.prompt(); // Show the Google One Tap popup
    },
    
    decodeJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')));
        } catch(e) {
            return null;
        }
    },
    
    logout() {
        this.user = null;
        localStorage.removeItem('chaduranga_user');
        this.onLogout();
        this.showLoginOverlay();
    },
    
    onLogin(user) {
        // Update header with user info
        const userArea = document.getElementById('user-area');
        if (!userArea) return;
        
        if (user.photo) {
            userArea.innerHTML = `
                <img src="${user.photo}" class="user-avatar" alt="avatar" referrerpolicy="no-referrer">
                <span class="user-name">${user.name}</span>
                <button id="logout-btn" class="btn btn-ghost btn-sm" title="Logout">↪ Logout</button>
            `;
        } else {
            const initial = user.name.charAt(0).toUpperCase();
            userArea.innerHTML = `
                <div class="user-avatar user-avatar-placeholder">${initial}</div>
                <span class="user-name">${user.name}</span>
                <button id="logout-btn" class="btn btn-ghost btn-sm" title="Logout">↪ Logout</button>
            `;
        }
        
        // Re-attach logout listener
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });
    },
    
    onLogout() {
        const userArea = document.getElementById('user-area');
        if (userArea) {
            userArea.innerHTML = `<button id="login-btn" class="btn btn-ghost" onclick="AUTH.showLoginOverlay()">🔑 Login</button>`;
        }
    }
};

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    AUTH.init();
});
