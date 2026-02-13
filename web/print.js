const params = new URLSearchParams(location.search);

document.getElementById('filters').textContent = `Filters: ${params.toString() || 'none'}`;

apiFetch(`/api/trades?${params.toString()}`)
  .then((r) => r.json())
  .then((json) => {
    document.getElementById('printRows').innerHTML = (json.data || []).map((r) => `
      <tr>
        <td>${r.impact_score?.toFixed(3) || '-'}</td>
        <td>${r.disclosed_date || '-'}</td>
        <td>${r.entity_name}</td>
        <td>${r.ticker || '-'}</td>
        <td>${r.type}</td>
        <td>$${Number(r.amount_min).toLocaleString()} - $${Number(r.amount_max).toLocaleString()}</td>
      </tr>
    `).join('');
  });
