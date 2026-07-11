import api from '../api.js';
import { navigate } from '../router.js';
import { showToast } from '../components/Toast.js';

function setupPasswordToggle(inputId, toggleId) {
  const input = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);
  if (!input || !toggle) return;
  toggle.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.innerHTML = isPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
  });
}

function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['', 'var(--danger)', 'var(--orange)', 'var(--warning)', 'var(--success)', 'var(--teal)'];
  return { score, label: labels[score], color: colors[score] };
}

function createParticles() {
  const container = document.createElement('div');
  container.className = 'login-particles';
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'login-particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.width = p.style.height = (Math.random() * 4 + 2) + 'px';
    p.style.animationDelay = Math.random() * 6 + 's';
    p.style.animationDuration = (Math.random() * 4 + 4) + 's';
    p.style.opacity = Math.random() * 0.5 + 0.1;
    container.appendChild(p);
  }
  return container;
}

export default class LoginPage {
  async afterRender() {
    const settings = await this.loadBranding();
    const loginPage = document.querySelector('.login-page');
    if (loginPage) loginPage.prepend(createParticles());

    const usernameInput = document.getElementById('username');
    if (usernameInput) setTimeout(() => usernameInput.focus(), 400);

    setupPasswordToggle('password', 'toggle-password');
    setupPasswordToggle('reg-password', 'toggle-reg-password');
    setupPasswordToggle('reg-confirm', 'toggle-reg-confirm');

    const pwInput = document.getElementById('reg-password');
    const pwBar = document.getElementById('pw-strength-bar');
    const pwLabel = document.getElementById('pw-strength-label');
    const confirmInput = document.getElementById('reg-confirm');
    const matchEl = document.getElementById('pw-match');

    if (pwInput && pwBar && pwLabel) {
      pwInput.addEventListener('input', () => {
        const pw = pwInput.value;
        const { score, label, color } = getPasswordStrength(pw);
        pwBar.style.width = pw ? (score / 5 * 100) + '%' : '0%';
        pwBar.style.background = pw ? color : 'transparent';
        pwLabel.textContent = pw ? label : '';
        pwLabel.style.color = pw ? color : 'rgba(255,255,255,0.3)';
        if (confirmInput && confirmInput.value) checkPasswordMatch();
      });
    }

    if (confirmInput && matchEl) {
      confirmInput.addEventListener('input', checkPasswordMatch);
    }

    function checkPasswordMatch() {
      if (!confirmInput.value) {
        matchEl.textContent = '';
        matchEl.style.color = 'rgba(255,255,255,0.3)';
        return;
      }
      const match = confirmInput.value === pwInput.value;
      matchEl.textContent = match ? '✓ Passwords match' : '✗ Passwords do not match';
      matchEl.style.color = match ? 'var(--success)' : 'var(--danger)';
      confirmInput.style.borderColor = match ? 'var(--success)' : 'var(--danger)';
    }

    const selfReg = !!(settings.features || []).find(s => s.key === 'feature_self_registration' && s.value === true);
    const regLink = document.getElementById('register-link');
    const backLink = document.getElementById('back-to-login');
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');

    if (regLink) {
      regLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.opacity = '0'; loginForm.style.transform = 'translateY(10px)';
        setTimeout(() => {
          loginForm.style.display = 'none';
          if (regForm) {
            regForm.style.display = ''; regForm.style.opacity = '0'; regForm.style.transform = 'translateY(10px)';
            requestAnimationFrame(() => {
              regForm.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
              regForm.style.opacity = '1'; regForm.style.transform = 'translateY(0)';
            });
          }
          if (backLink) backLink.style.display = '';
          if (regLink) regLink.style.display = 'none';
        }, 250);
      });
    }

    if (backLink) {
      backLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (regForm) {
          regForm.style.opacity = '0'; regForm.style.transform = 'translateY(10px)';
        }
        setTimeout(() => {
          loginForm.style.display = '';
          requestAnimationFrame(() => {
            loginForm.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
            loginForm.style.opacity = '1'; loginForm.style.transform = 'translateY(0)';
          });
          if (regForm) regForm.style.display = 'none';
          if (backLink) backLink.style.display = 'none';
          if (regLink) regLink.style.display = '';
        }, 250);
      });
    }

    if (regLink && !selfReg) regLink.style.display = 'none';

    if (selfReg && regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('register-btn');
        const btnText = document.getElementById('register-btn-text');
        const spinner = document.getElementById('register-btn-spinner');
        const errorDiv = document.getElementById('register-error');
        const full_name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;

        if (!full_name || !email || !username || !password) {
          errorDiv.textContent = 'Please fill in all fields';
          errorDiv.style.display = 'block'; return;
        }
        if (password !== confirm) {
          errorDiv.textContent = 'Passwords do not match';
          errorDiv.style.display = 'block'; return;
        }

        btn.disabled = true; btnText.textContent = 'Creating Account...';
        spinner.style.display = 'inline-block'; errorDiv.style.display = 'none';

        try {
          const data = await api.register({ full_name, email, username, password });
          api.setToken(data.token);
          showToast('Welcome, ' + data.user.full_name + '!', 'success');
          navigate('/');
        } catch (err) {
          errorDiv.textContent = err.message || 'Registration failed';
          errorDiv.style.display = 'block';
          btn.disabled = false; btnText.textContent = 'Create Account';
          spinner.style.display = 'none';
        }
      });
    }

    const loginBtn = document.getElementById('login-btn');
    const loginBtnText = document.getElementById('login-btn-text');
    const loginSpinner = document.getElementById('login-btn-spinner');
    const loginError = document.getElementById('login-error');
    const rememberMe = document.getElementById('remember-me');

    if (rememberMe && usernameInput) {
      const saved = localStorage.getItem('remembered_username');
      if (saved) {
        usernameInput.value = saved;
        rememberMe.checked = true;
      }
    }

    const forgotLink = document.getElementById('forgot-password');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginError.textContent = 'Please contact your system administrator to reset your password.';
        loginError.style.display = 'block';
        setTimeout(() => { loginError.style.display = 'none'; }, 5000);
      });
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      if (!username || !password) {
        loginError.textContent = 'Please enter username and password';
        loginError.style.display = 'block';
        loginForm.querySelectorAll('.form-input').forEach(el => { el.classList.add('error'); setTimeout(() => el.classList.remove('error'), 600); });
        return;
      }

      if (rememberMe && rememberMe.checked) {
        localStorage.setItem('remembered_username', username);
      } else {
        localStorage.removeItem('remembered_username');
      }

      loginBtn.disabled = true;
      loginBtnText.textContent = 'Signing in...';
      loginSpinner.style.display = 'inline-block';
      loginError.style.display = 'none';

      try {
        const data = await api.login(username, password);
        api.setToken(data.token);
        showToast('Welcome, ' + data.user.full_name + '!', 'success');
        navigate('/');
      } catch (err) {
        loginError.textContent = err.message || 'Login failed';
        loginError.style.display = 'block';
        loginForm.classList.add('shake');
        setTimeout(() => loginForm.classList.remove('shake'), 500);
        setTimeout(() => { loginError.style.display = 'none'; }, 5000);
      } finally {
        loginBtn.disabled = false;
        loginBtnText.textContent = 'Sign In';
        loginSpinner.style.display = 'none';
      }
    });
  }

  async loadBranding() {
    try {
      const settings = await api.getSettings();
      const allSettings = [].concat(settings.general || [], settings.branding || []);
      const subtitle = document.querySelector('.login-logo p');
      const footer = document.querySelector('.login-footer');
      const appName = allSettings.find(s => s.key === 'app_name');
      const companyName = allSettings.find(s => s.key === 'branding_company_name' || s.key === 'company_name');
      const footerText = allSettings.find(s => s.key === 'branding_footer_text');

      const logoImg = document.getElementById('login-logo-img');
      const logoText = document.getElementById('login-logo-text');
      const logoCircle = logoText ? logoText.querySelector('.logo-circle') : null;
      const logoTitle = logoText ? logoText.querySelector('h1') : null;

      const img = logoImg ? logoImg.querySelector('img') : null;
      if (img) {
        img.onload = () => {
          if (logoImg) logoImg.style.display = '';
          if (logoText) logoText.style.display = 'none';
        };
        img.onerror = () => {
          if (logoImg) logoImg.style.display = 'none';
          if (logoText) logoText.style.display = '';
          if (appName && logoTitle) logoTitle.textContent = appName.value || 'Hubly';
        };
        img.src = '/api/settings/logo?' + Date.now();
      }

      if (subtitle) subtitle.textContent = companyName ? `Sign in to ${companyName.value}` : 'Sign in to your account';
      if (footer && footerText) footer.textContent = `© ${new Date().getFullYear()} ${footerText.value}`;

      const brand = {};
      (settings.branding || []).forEach(s => { brand[s.key] = s.value; });
      const theme = {};
      (settings.theme || []).forEach(s => { theme[s.key] = s.value; });
      if (brand.branding_primary_color) document.documentElement.style.setProperty('--primary', brand.branding_primary_color);
      if (brand.branding_secondary_color) document.documentElement.style.setProperty('--secondary', brand.branding_secondary_color);
      if (theme.theme_sidebar_color) document.documentElement.style.setProperty('--bg-sidebar', theme.theme_sidebar_color);
      if (theme.theme_accent_color) document.documentElement.style.setProperty('--purple', theme.theme_accent_color);

      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) favicon.href = '/api/settings/favicon?' + Date.now();

      return settings;
    } catch { return { features: [] }; }
  }

  render() {
    return `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo">
            <div class="logo-image" id="login-logo-img"><img src="/api/settings/logo" alt="Logo" onerror="this.style.display='none'" style="max-height:60px;max-width:200px" /></div>
            <div class="login-logo-text" id="login-logo-text">
              <div class="logo-circle"><i class="bi bi-ticket-perforated"></i></div>
              <h1>Hubly</h1>
            </div>
            <p id="login-subtitle" class="typing-text" data-text="Sign in to your account"></p>
          </div>
          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="username">Username</label>
              <input class="form-input" id="username" type="text" placeholder="Enter your username" required autofocus />
            </div>
            <div class="form-group">
              <label class="form-label" for="password">Password</label>
              <div class="form-input-wrapper">
                <input class="form-input" id="password" type="password" placeholder="Enter your password" required />
                <button type="button" id="toggle-password" class="form-input-icon" tabindex="-1"><i class="bi bi-eye"></i></button>
              </div>
            </div>
            <div class="login-checkbox-row">
              <label>
                <input type="checkbox" id="remember-me" />
                Remember me
              </label>
              <a href="#" id="forgot-password" class="forgot-link">Forgot password?</a>
            </div>
            <button type="submit" class="btn btn-primary btn-lg" id="login-btn" title="Ctrl+Enter">
              <span id="login-btn-text">Sign In</span>
              <span id="login-btn-spinner" class="spinner" style="display:none"></span>
            </button>
            <div class="login-error" id="login-error"></div>
            <div style="text-align:center;margin-top:16px">
              <a href="#" id="register-link" class="login-form-link">Create an account</a>
            </div>
          </form>
          <form id="register-form" style="display:none">
            <div class="form-group">
              <label class="form-label" for="reg-name">Full Name</label>
              <input class="form-input" id="reg-name" type="text" placeholder="Enter your full name" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-email">Email</label>
              <input class="form-input" id="reg-email" type="email" placeholder="Enter your email" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-username">Username</label>
              <input class="form-input" id="reg-username" type="text" placeholder="Choose a username" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-password">Password</label>
              <div class="form-input-wrapper">
                <input class="form-input" id="reg-password" type="password" placeholder="Choose a password" required autocomplete="new-password" />
                <button type="button" id="toggle-reg-password" class="form-input-icon" tabindex="-1"><i class="bi bi-eye"></i></button>
              </div>
              <div id="pw-strength" style="margin-top:8px;height:4px;border-radius:4px;background:rgba(255,255,255,0.1);overflow:hidden;transition:var(--transition)">
                <div id="pw-strength-bar" style="height:100%;width:0%;border-radius:4px;transition:width 0.4s ease,background 0.4s ease"></div>
              </div>
              <div id="pw-strength-label" style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;text-align:right;transition:color 0.3s ease"></div>
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-confirm">Confirm Password</label>
              <div class="form-input-wrapper">
                <input class="form-input" id="reg-confirm" type="password" placeholder="Confirm your password" required autocomplete="new-password" />
                <button type="button" id="toggle-reg-confirm" class="form-input-icon" tabindex="-1"><i class="bi bi-eye"></i></button>
              </div>
              <div id="pw-match" style="font-size:11px;margin-top:4px;text-align:right;min-height:16px"></div>
            </div>
            <button type="submit" class="btn btn-primary btn-lg" id="register-btn">
              <span id="register-btn-text">Create Account</span>
              <span id="register-btn-spinner" class="spinner" style="display:none"></span>
            </button>
            <div class="login-error" id="register-error"></div>
            <div style="text-align:center;margin-top:16px">
              <a href="#" id="back-to-login" class="login-form-link" style="display:none">Already have an account? Sign in</a>
            </div>
          </form>
          <div class="login-footer">
            &copy; 2026 Hubly
          </div>
        </div>
      </div>
    `;
  }
}
