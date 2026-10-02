const API_URL = "https://api.github.com/graphql";

const GRAPHQL_QUERY = `
  query PullRequests($q: String!, $n: Int!) {
    search(query: $q, type: ISSUE, first: $n) {
      issueCount
      nodes {
        ... on PullRequest {
          number
          title
          url
          state
          isDraft
          reviewDecision
          repository { nameWithOwner }
          author { login }
          commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
        }
      }
    }
  }
`;

const REVIEW_LABELS = {
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  REVIEW_REQUIRED: "Review required"
};

const summaryEl = document.querySelector("#summary");
const refreshButton = document.querySelector("#refresh");
const messageEl = document.querySelector("#message");
const listEl = document.querySelector("#list");

let settings = {};
let timer = 0;
let controller = null;

function showMessage(text, isError = false) {
  listEl.hidden = true;
  messageEl.hidden = false;
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
}

function normalizeQuery(query) {
  const trimmed = (query ?? "").trim();
  return /(^|\s)(is|type):pr(\s|$)/i.test(trimmed) ? trimmed : `is:pr ${trimmed}`.trim();
}

function prStatus(pr) {
  if (pr.state === "MERGED") return { key: "merged", label: "Merged" };
  if (pr.state === "CLOSED") return { key: "closed", label: "Closed" };
  if (pr.isDraft) return { key: "draft", label: "Draft" };
  return { key: "open", label: "Open" };
}

function renderPr(pr) {
  const item = document.createElement("li");
  item.className = "pr";

  const main = document.createElement("div");
  main.className = "pr-main";

  const title = document.createElement("a");
  title.className = "pr-title";
  title.href = pr.url;
  title.target = "_blank";
  title.rel = "noopener noreferrer";
  title.textContent = pr.title;
  title.title = pr.title;

  const meta = document.createElement("div");
  meta.className = "pr-meta";
  const checks = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state;
  if (checks) {
    const dot = document.createElement("span");
    dot.className = `checks ${checks.toLowerCase()}`;
    dot.title = `Checks: ${checks.toLowerCase()}`;
    meta.append(dot);
  }
  const parts = [`${pr.repository?.nameWithOwner ?? ""}#${pr.number}`];
  if (pr.author?.login) parts.push(pr.author.login);
  if (pr.state === "OPEN" && REVIEW_LABELS[pr.reviewDecision]) parts.push(REVIEW_LABELS[pr.reviewDecision]);
  meta.append(parts.join(" · "));

  main.append(title, meta);

  const status = prStatus(pr);
  const badge = document.createElement("span");
  badge.className = `badge ${status.key}`;
  badge.textContent = status.label;

  item.append(main, badge);
  return item;
}

async function fetchPullRequests({ token, query, limit }, signal) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: GRAPHQL_QUERY, variables: { q: query, n: limit } }),
    signal
  });

  if (response.status === 401) throw new Error("GitHub rejected the API token (401). Check it in settings.");
  if (!response.ok) throw new Error(`GitHub request failed (${response.status} ${response.statusText}).`);

  const body = await response.json();
  // GraphQL can return partial data (e.g. no access to checks); only fail when there is no data at all.
  if (!body.data?.search) throw new Error(body.errors?.map((e) => e.message).join("\n") || "Unexpected response from GitHub.");
  return body.data.search;
}

async function load() {
  controller?.abort();

  const token = (settings.token ?? "").trim();
  if (!token) {
    refreshButton.disabled = false;
    summaryEl.textContent = "Not configured";
    showMessage("Add a GitHub API token in the widget settings (⚙).");
    return;
  }

  const query = normalizeQuery(settings.query);
  const limit = Math.min(50, Math.max(1, Math.round(Number(settings.limit)) || 10));
  controller = new AbortController();
  const { signal } = controller;

  refreshButton.disabled = true;
  summaryEl.textContent = "Loading…";
  summaryEl.title = query;

  try {
    const result = await fetchPullRequests({ token, query, limit }, signal);
    const prs = result.nodes.filter((node) => node && node.url);
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    summaryEl.textContent = `${result.issueCount} PR${result.issueCount === 1 ? "" : "s"} · updated ${time}`;

    if (!prs.length) {
      showMessage("No pull requests match this query.");
      return;
    }
    messageEl.hidden = true;
    listEl.hidden = false;
    listEl.replaceChildren(...prs.map(renderPr));
  } catch (error) {
    if (signal.aborted) return;
    summaryEl.textContent = "Error";
    showMessage(error instanceof TypeError ? "Cannot reach GitHub. Check your connection." : error.message, true);
  } finally {
    if (!signal.aborted) refreshButton.disabled = false;
  }
}

function schedule() {
  clearInterval(timer);
  const minutes = Number(settings.refreshMinutes);
  if (minutes > 0) timer = setInterval(load, minutes * 60 * 1000);
}

function apply(state) {
  settings = state.settings;
  schedule();
  load();
}

refreshButton.addEventListener("click", load);

Widget.onInit(apply);
Widget.onSettings(apply);
Widget.ready();
