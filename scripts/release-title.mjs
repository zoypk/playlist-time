#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const tag = process.argv[2] || process.env.GITHUB_REF_NAME || "";

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error("Usage: node scripts/release-title.mjs v1.2.3");
  process.exit(1);
}

const [, major, minor, patch] = tag.match(/^v(\d+)\.(\d+)\.(\d+)$/).map(Number);

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function refExists(ref) {
  try {
    execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function previousTag(currentTag) {
  const parseTag = (candidate) => {
    const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(candidate);
    return match ? match.slice(1).map(Number) : null;
  };

  const compareTags = (left, right) =>
    left[0] - right[0] || left[1] - right[1] || left[2] - right[2];

  const current = parseTag(currentTag);

  const tags = git(["tag", "--list", "v[0-9]*.[0-9]*.[0-9]*", "--sort=-v:refname"])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((candidate) => candidate !== currentTag)
    .filter((candidate) => {
      const parsed = parseTag(candidate);
      return current && parsed && compareTags(parsed, current) < 0;
    });

  return tags[0] || "";
}

function changedFiles(fromTag, currentTag) {
  if (!fromTag) {
    return [];
  }

  const toRef = refExists(currentTag) ? currentTag : "HEAD";

  return git(["diff", "--name-only", `${fromTag}..${toRef}`])
    .split(/\r?\n/)
    .filter(Boolean);
}

function has(files, patterns) {
  return files.some((file) => patterns.some((pattern) => pattern.test(file)));
}

function releaseFocus(files) {
  const areas = [
    {
      label: "YouTube API reliability",
      patterns: [/^functions\/api\//, /^src\/shared\//],
    },
    {
      label: "playlist calculator UX",
      patterns: [/^src\/components\//, /^src\/pages\//, /^src\/styles\//],
    },
    {
      label: "Cloudflare deployment",
      patterns: [/^wrangler\.jsonc$/, /^astro\.config\.mjs$/, /^\.github\/workflows\/post-deploy-smoke\.yml$/],
    },
    {
      label: "CI and release automation",
      patterns: [/^\.github\//, /^scripts\//],
    },
    {
      label: "test coverage",
      patterns: [/^tests\//, /^playwright/, /\.test\./],
    },
    {
      label: "dependency refresh",
      patterns: [/^package\.json$/, /^bun\.lock$/],
    },
    {
      label: "documentation",
      patterns: [/^README\.md$/, /^SECURITY\.md$/, /^docs\//],
    },
  ].filter((area) => has(files, area.patterns));

  if (areas.length === 0) {
    return "maintenance";
  }

  return areas
    .slice(0, 2)
    .map((area) => area.label)
    .join(" and ");
}

function titleCase(text) {
  return text.replace(/\b[a-z]/g, (letter, offset) => {
    if (offset > 0 && text.slice(offset, offset + 3) === "and") {
      return letter;
    }

    return letter.toUpperCase();
  });
}

if (major === 1 && minor === 0 && patch === 0) {
  console.log("Public Launch: Playlist Watch-Time Calculator");
  process.exit(0);
}

const previous = previousTag(tag);
const files = changedFiles(previous, tag);
const focus = titleCase(releaseFocus(files));
const releaseType = major > 1 && minor === 0 && patch === 0
  ? "Major Release"
  : minor > 0 && patch === 0
    ? "Feature Release"
    : "Maintenance Release";

console.log(`${releaseType}: ${focus}`);
