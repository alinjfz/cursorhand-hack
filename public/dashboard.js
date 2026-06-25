const PIPELINE = ["NEW", "BUILDING", "SITE_READY", "CONTACTED", "INVOICED", "PAID"];

const STATUS_INDEX = {
  NEW: 0,
  BUILDING: 1,
  SITE_READY: 2,
  CONTACTED: 3,
  INTERESTED: 3,
  INVOICED: 4,
  PAID: 5,
  FAILED: -1,
};

function formatTimeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function renderPipeline(status) {
  const idx = STATUS_INDEX[status] ?? -1;
  if (idx < 0) return '<span class="status-badge status-FAILED">FAILED</span>';

  const dots = PIPELINE.map((step, i) => {
    let cls = "pipeline-dot";
    if (i < idx) cls += " done";
    if (i === idx) cls += " current";
    return `<span class="${cls}" title="${step}"></span>`;
  }).join("");

  return `<div class="pipeline-mini">${dots}</div>`;
}

function renderLeadRow(lead) {
  const siteCell = lead.deployment_url
    ? `<a class="site-link" href="${lead.deployment_url}" target="_blank" rel="noopener">View site ↗</a>`
    : '<span class="time-ago">—</span>';

  return `<tr>
    <td>
      <div class="lead-name">${escapeHtml(lead.name)}</div>
      <div class="lead-niche">${escapeHtml(lead.niche || lead.full_address || "")}</div>
    </td>
    <td><span class="status-badge status-${lead.status}">${lead.status}</span></td>
    <td>${renderPipeline(lead.status)}</td>
    <td>${siteCell}</td>
    <td class="time-ago">${formatTimeAgo(lead.updated_at)}</td>
  </tr>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function updateStats(stats) {
  if (!stats) return;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("stat-total", stats.total);
  set("stat-built", stats.sitesBuilt ?? stats.siteReady);
  set("stat-contacted", stats.outreachSent ?? stats.contacted);
  set("stat-paid", stats.paid);

  set("dash-total", stats.total);
  set("dash-built", stats.sitesBuilt ?? stats.siteReady);
  set("dash-outreach", stats.outreachSent ?? stats.contacted);
  set("dash-paid", stats.paid);
}

function highlightPipelineSteps(leads) {
  const counts = {};
  for (const lead of leads) {
    counts[lead.status] = (counts[lead.status] || 0) + 1;
  }

  document.querySelectorAll(".pipeline-step").forEach((step) => {
    const status = step.dataset.status;
    const active = counts[status] > 0 || (status === "INVOICED" && (counts.INTERESTED || 0) > 0);
    step.classList.toggle("active", Boolean(active));
  });
}

async function fetchLeads() {
  const indicator = document.getElementById("live-indicator");
  const updated = document.getElementById("last-updated");
  const banner = document.getElementById("setup-banner");
  const body = document.getElementById("leads-body");

  try {
    const res = await fetch("/api/leads");
    const data = await res.json();

    if (!data.configured) {
      banner?.classList.remove("hidden");
      const msg = document.getElementById("setup-message");
      if (msg) msg.textContent = data.message || "Supabase not configured.";
      body.innerHTML = '<tr class="empty-state"><td colspan="5">Connect Supabase to see live agent activity.</td></tr>';
      indicator?.classList.add("offline");
      if (updated) updated.textContent = "Not connected";
      return;
    }

    banner?.classList.add("hidden");
    indicator?.classList.remove("offline");
    if (updated) updated.textContent = `Updated ${new Date().toLocaleTimeString()}`;

    updateStats(data.stats);

    if (!data.leads?.length) {
      body.innerHTML = '<tr class="empty-state"><td colspan="5">No leads yet — run <code>npm run hunt -- --source csv</code></td></tr>';
    } else {
      body.innerHTML = data.leads.map(renderLeadRow).join("");
      highlightPipelineSteps(data.leads);
    }

    if (data.message && data.leads?.length === 0) {
      banner?.classList.remove("hidden");
      const msg = document.getElementById("setup-message");
      if (msg) msg.textContent = data.message;
    }
  } catch (err) {
    indicator?.classList.add("offline");
    if (updated) updated.textContent = "Fetch failed";
    body.innerHTML = `<tr class="empty-state"><td colspan="5">Could not load leads: ${escapeHtml(err.message)}</td></tr>`;
  }
}

fetchLeads();
setInterval(fetchLeads, 15000);
