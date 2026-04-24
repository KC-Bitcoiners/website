/**
 * Gallery upload debug tests.
 * Intercepts nostr.build upload to verify NIP-98 auth and end-to-end flow.
 */
import { test, expect } from "@playwright/test";
import { injectNostrExtension, getTestKeys } from "./helpers";
import * as fs from "fs";
import * as path from "path";

test.describe("@gallery @whitelist upload debug", () => {
  test.beforeEach(async ({ page }) => {
    await injectNostrExtension(page);
    await page.goto("/gallery");
    await page.waitForTimeout(2000);
  });

  test("upload sends NIP-98 auth with correct event structure", async ({
    page,
  }) => {
    const keys = getTestKeys();

    let capturedAuth: string | null = null;
    let capturedUrl: string | null = null;
    let capturedMethod: string | null = null;

    await page.route("**/nostr.build/**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && !capturedUrl) {
        capturedUrl = request.url();
        capturedMethod = request.method();
        const authHeader = request.headers()["authorization"];
        if (authHeader?.startsWith("Nostr ")) {
          capturedAuth = authHeader.slice(6);
        }
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          data: [{ url: "https://nostr.build/mock-test-image.png" }],
        }),
      });
    });

    await page.route("**/relay.*/**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, id: "mock" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByTestId("add-photo-btn").click();
    await expect(page.getByTestId("upload-modal")).toBeVisible();

    const loginBtn = page.getByRole("button", { name: /login with nostr extension/i });
    const loginVisible = await loginBtn.isVisible().catch(() => false);
    if (loginVisible) {
      await loginBtn.click();
      await page.waitForTimeout(1000);
    }

    const fixturesDir = path.join(__dirname, "fixtures");
    if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
    const testImagePath = path.join(fixturesDir, "test-image.png");
    if (!fs.existsSync(testImagePath)) {
      fs.writeFileSync(testImagePath, Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
        "base64",
      ));
    }

    await page.getByTestId("upload-file-input").setInputFiles(testImagePath);
    await page.getByTestId("upload-caption").fill("Debug test upload");
    await page.getByTestId("upload-submit").click();
    await page.waitForTimeout(3000);

    expect(capturedUrl).toContain("nostr.build");
    expect(capturedMethod).toBe("POST");
    expect(capturedAuth).toBeTruthy();

    const decoded = JSON.parse(Buffer.from(capturedAuth!, "base64").toString("utf-8"));
    expect(decoded.kind).toBe(27235);
    expect(decoded.pubkey).toBe(keys.pubkeyHex);
    expect(decoded.id).toBeTruthy();
    expect(decoded.sig).toBeTruthy();

    const tagNames = decoded.tags.map((t: string[]) => t[0]);
    expect(tagNames).toContain("u");
    expect(tagNames).toContain("method");
  });

  test("upload form works end-to-end with mocked nostr.build", async ({
    page,
  }) => {
    await page.route("**/nostr.build/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          data: [{ url: "https://nostr.build/mock-test-image.png" }],
        }),
      });
    });

    await page.route("**/relay.*/**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, id: "mock" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByTestId("add-photo-btn").click();
    await expect(page.getByTestId("upload-modal")).toBeVisible();

    const loginBtn = page.getByRole("button", { name: /login with nostr extension/i });
    const loginVisible = await loginBtn.isVisible().catch(() => false);
    if (loginVisible) {
      await loginBtn.click();
      await page.waitForTimeout(1000);
    }

    const fixturesDir = path.join(__dirname, "fixtures");
    if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
    const testImagePath = path.join(fixturesDir, "test-image.png");
    if (!fs.existsSync(testImagePath)) {
      fs.writeFileSync(testImagePath, Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
        "base64",
      ));
    }

    await page.getByTestId("upload-file-input").setInputFiles(testImagePath);
    await page.getByTestId("upload-caption").fill("E2E test upload");
    await page.getByTestId("upload-submit").click();

    await expect(page.getByTestId("upload-modal")).not.toBeVisible({ timeout: 10000 });
  });
});
