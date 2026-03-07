import assert from "node:assert/strict";
import test from "node:test";

import { getLearnAboutLinks, getLearnGuideUrl } from "./learn-about.ts";

test("maps legacy help guide slugs to the current published Learn routes", () => {
  const cliLinks = getLearnAboutLinks("/docs/cli");
  assert.deepEqual(
    cliLinks.map((link) => link.slug),
    ["cli-masterclass", "opta-code-masterclass"],
  );

  const accountsLinks = getLearnAboutLinks("/docs/accounts");
  assert.deepEqual(
    accountsLinks.map((link) => link.slug),
    ["opta-accounts"],
  );
});

test("builds canonical Learn guide URLs for legacy aliases", () => {
  assert.equal(
    getLearnGuideUrl("cli"),
    "https://learn.optalocal.com/guides/cli-masterclass",
  );
  assert.equal(
    getLearnGuideUrl("code-desktop-masterclass"),
    "https://learn.optalocal.com/guides/opta-code-masterclass",
  );
});
