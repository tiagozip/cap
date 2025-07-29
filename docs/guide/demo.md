# Demo

<style>
.login-form {
  width: 300px;
  border: 1px solid var(--vp-c-divider);
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  margin-top: 1em;
}

.login-form .input {
  display: flex;
  flex-direction: column;
  cursor: text;
  transition: box-shadow .2s;
}

.login-form .input:has(input:focus) {
  box-shadow: 0 0 0 .25rem rgba(38, 181, 250, .25);
}

.login-form label {
  font-weight: 500;
  opacity: .65;
  padding-left: .75rem;
  padding-top: .375rem;
  font-size: 13px;
}

.login-form input {
  font-size: 16px;
  padding: .375rem .75rem;
  padding-top: 0px;
  font-family: inherit;
}

.signin-button {
  font-size: 1.25rem;
  width: 300px;
  background-color: var(--vp-c-brand-1);
  height: 48px;
  color: #1B1B1F;
  border-radius: 8px;
  font-weight: 500;
  transition: filter .2s;
  margin-bottom: 1em;
}

.signin-button:hover {
  filter: brightness(90%)
}

.signin-button:active {
  filter: brightness(80%)
}

.signin-button:not(.active) {
  opacity: .7;
  pointer-events: none;
  filter: grayscale(1);
}
</style>

<div class="login-form">
  <div class="input" style="border-top-left-radius:8px;border-top-right-radius:8px;border-bottom:1px solid var(--vp-c-divider);">
    <label for="username">Username</label>
    <input id="username" placeholder="example" autocomplete="off" />
  </div>

  <div class="input" style="border-bottom-left-radius:8px;border-bottom-right-radius:8px;">
    <label for="password">Password</label>
    <input type="password" id="pass" autocomplete="off" readonly="" value="Password123!" />
  </div>
</div>

<div style="margin-bottom: 1rem;--cap-widget-width:300px;">
  <Demo />
</div>

<button class="signin-button" onclick="alert('Success!')">Sign in</button>

You can find more demos [in the GitHub repo](https://github.com/tiagorangel1/cap/tree/main/demo). Note that this demo is not a full implementation of Cap and uses a placeholder server.

Note that the widget is also fully customizable! If you don't like how it looks, you can use CSS variables to change just about everything.
