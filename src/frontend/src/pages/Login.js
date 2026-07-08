import api from '../api.js';
import { navigate } from '../router.js';
import { showToast } from '../components/Toast.js';

export default class LoginPage {
  async afterRender() {
    const form = document.getElementById('login-form');
    const btn = document.getElementById('login-btn');
    const btnText = document.getElementById('login-btn-text');
    const spinner = document.getElementById('login-btn-spinner');
    const errorDiv = document.getElementById('login-error');

    try {
      const settings = await api.getSettings();
      const allSettings = [].concat(settings.general || [], settings.branding || []);
      const title = document.querySelector('.login-logo h1');
      const subtitle = document.querySelector('.login-logo p');
      const footer = document.querySelector('.login-footer');
      const appName = allSettings.find(s => s.key === 'app_name');
      const companyName = allSettings.find(s => s.key === 'branding_company_name' || s.key === 'company_name');
      const footerText = allSettings.find(s => s.key === 'branding_footer_text');
      if (title && appName) title.textContent = appName.value || 'IT Ticket System Pro';
      if (subtitle) subtitle.textContent = companyName ? `Sign in to ${companyName.value}` : 'Sign in to your account';
      if (footer && footerText) footer.textContent = `© ${new Date().getFullYear()} ${footerText.value}`;
    } catch {}

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      if (!username || !password) {
        errorDiv.textContent = 'Please enter username and password';
        errorDiv.style.display = 'block';
        return;
      }

      btn.disabled = true;
      btnText.textContent = 'Signing in...';
      spinner.style.display = 'inline-block';
      errorDiv.style.display = 'none';

      try {
        const data = await api.login(username, password);
        api.setToken(data.token);
        showToast('Welcome, ' + data.user.full_name + '!', 'success');
        navigate('/');
      } catch (err) {
        errorDiv.textContent = err.message || 'Login failed';
        errorDiv.style.display = 'block';
        btn.disabled = false;
        btnText.textContent = 'Sign In';
        spinner.style.display = 'none';
      }
    });
  }

  render() {
    return `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo">
            <div class="logo-circle"><i class="bi bi-ticket-perforated"></i></div>
            <h1>IT Ticket System Pro</h1>
            <p>Sign in to your account</p>
          </div>
          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="username">Username</label>
              <input class="form-input" id="username" type="text" placeholder="Enter your username" required autofocus />
            </div>
            <div class="form-group">
              <label class="form-label" for="password">Password</label>
              <input class="form-input" id="password" type="password" placeholder="Enter your password" required />
            </div>
            <button type="submit" class="btn btn-primary btn-lg" id="login-btn">
              <span id="login-btn-text">Sign In</span>
              <span id="login-btn-spinner" class="spinner" style="display:none"></span>
            </button>
            <div class="login-error" id="login-error"></div>
          </form>
          <div class="login-footer" style="text-align:center;margin-top:24px;font-size:12px;color:rgba(255,255,255,0.25)">
            &copy; 2026 IT Ticket System Pro
          </div>
        </div>
      </div>
    `;
  }
}
