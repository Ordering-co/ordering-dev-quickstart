const copy = document.querySelector('.copy-command');
const command = document.querySelector('#add-command');
const status = document.querySelector('.copy-status');

if (navigator.clipboard) {
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(command.textContent);
      status.textContent = 'Command copied.';
    } catch {
      status.textContent = 'Select and copy the command above.';
    }
  });
}
