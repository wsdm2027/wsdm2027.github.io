// One set of daily agendas serves desktop and mobile, one selected day at a time.
(() => {
  const picker = document.querySelector('.program-day-picker');
  if (!picker) return;
  const buttons = [...picker.querySelectorAll('button[data-program-day]')];
  const days = [...document.querySelectorAll('.program-day')];

  function selectDay(value) {
    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.programDay === value));
    });
    days.forEach((day, index) => {
      day.hidden = value !== String(index);
    });
  }

  picker.hidden = false;
  selectDay('0');
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => selectDay(button.dataset.programDay));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      buttons[next].focus();
      selectDay(buttons[next].dataset.programDay);
    });
  });
})();
