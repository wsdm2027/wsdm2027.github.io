(() => {
  const query = document.getElementById('member-query');
  const status = document.getElementById('search-status');
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  const groups = Array.from(document.querySelectorAll('.invited-group'), section => ({
    section,
    rows: Array.from(section.querySelectorAll('.member-row'), row => ({ row, text: normalize(row.textContent) }))
  }));
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  function filter() {
    const terms = normalize(query.value).split(/\s+/).filter(Boolean);
    let visibleTotal = 0;
    groups.forEach(({ section, rows }) => {
      let visible = 0;
      rows.forEach(({ row, text }) => {
        row.hidden = !terms.every(term => text.includes(term));
        if (!row.hidden) visible++;
      });
      visibleTotal += visible;
      section.querySelector('.member-count').textContent = terms.length
        ? `${visible.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} invited members`
        : `${rows.length.toLocaleString('en-US')} invited members`;
      section.querySelector('.no-matches').hidden = visible !== 0;
    });
    status.textContent = `Showing ${visibleTotal.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} invited members`;
  }
  document.getElementById('member-search').hidden = false;
  query.addEventListener('input', filter);
  filter();
})();
