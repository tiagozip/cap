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

.signin-button.active {
  animation: signin-button-pulse 1.6s ease-out 0s 2;
}

@keyframes signin-button-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--vp-c-brand-1) 65%, transparent);
  }
  70% {
    box-shadow: 0 0 0 14px color-mix(in srgb, var(--vp-c-brand-1) 0%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--vp-c-brand-1) 0%, transparent);
  }
}
</style>

<DemoTabs />

<div class="login-form" style="margin-top: 0.6em;">
  <div class="input" style="border-radius:8px;">
    <label for="comment">Comment</label>
    <textarea id="comment" rows="3" placeholder="Write a reply…" style="font-size:16px;padding:.375rem .75rem;padding-top:0;font-family:inherit;background:transparent;border:none;outline:none;resize:vertical;">Looks great, thanks for sharing!</textarea>
  </div>
</div>

<div style="margin-bottom: 1rem;--cap-widget-width:300px;">
  <Demo />
</div>

<DemoReply />

You can find more demos [in the GitHub repo](https://github.com/tiagozip/cap/tree/main/demo). Note that this demo is not a full implementation of Cap and uses a placeholder server.
