Dashboard.registerWidget({
  type: "github-prs",
  name: "GitHub pull requests",
  entry: "index.html",
  defaultSize: { w: 4, h: 4 },
  minSize: { w: 3, h: 2 },
  settings: [
    {
      key: "query",
      label: "Search query",
      type: "text",
      default: "is:pr is:open author:@me",
      placeholder: "is:pr is:open review-requested:@me",
      required: true
    },
    { key: "token", label: "GitHub API token", type: "password", default: "", placeholder: "ghp_… or github_pat_…" },
    { key: "limit", label: "Max results", type: "number", default: 10, min: 1, max: 50 },
    { key: "refreshMinutes", label: "Refresh every (minutes, 0 = off)", type: "number", default: 5, min: 0, max: 1440 }
  ]
});
