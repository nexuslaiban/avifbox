// The failure window. The background opens it with the failure in the fragment of its address.
// First what closes it: it has to close whatever that fragment turns out to be.
document.querySelector('button')!.addEventListener('click', () => window.close());
addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.close();
});
document.querySelector('#failure')!.textContent = decodeURIComponent(location.hash.slice(1));
