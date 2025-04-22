# Benchmark

Coming soon!

<!--
Press the button below to run a simple benchmark.

<style>
  .benchmark-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 300px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--vp-c-divider);
  }
  .benchmark-field {
    display: flex;
    flex-direction: column;
  }
  .benchmark-field label {
    margin: 0;
    font-size: 0.9rem;
    margin-bottom: 0.2rem;
    opacity: .9;
  }
  .benchmark-field input {
    padding: 0.5rem .8rem;
    border-radius: 6px;
    background-color: var(--vp-sidebar-bg-color);
    border: 1px solid var(--vp-c-divider);
    font-size: 16px;
    font-family: inherit;
  }
  .benchmark-field input:focus {
    border-color: var(--vp-c-brand-1);
    outline: none;
  }
  .benchmark-form button {
    background-color: var(--vp-c-brand-1);
    font-size: 14px;
    font-weight: 500;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    transition: background-color 0.2s ease;
  }

  .benchmark-form button:hover {
    background-color: var(--vp-c-brand-2);
  }
</style>

<div class="benchmark-form">
<div class="benchmark-field">
<label for="difficulty">Challenge difficulty</label>
<input type="number" id="difficulty" name="difficulty" min="1" max="10" value="4">
</div>
<div class="benchmark-field">
<label for="challenges">Number of challenges</label>
<input type="number" id="challenges" name="challenges" min="1" max="100" value="5">
</div>
<div class="benchmark-field">
<label for="workers">Number of workers</label>
<input type="number" id="workers" name="workers" min="1" max="28" value="8">
</div>
<button>Run</button>
</div>

<script>
window.window.CAP_CUSTOM_FETCH = function (a, b) {
    console.log({ a, b});

    return fetch(a, b);
}

console.log("hi");
</script>
-->