import { test, expect } from "@playwright/test";

test.describe("Login Functionality @login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("homepage loads successfully", async ({ page }) => {
    await expect(page).toHaveTitle(/KC Bitcoin/);
  });

  test("Connect Nostr button is visible for logged-out users", async ({
    page,
  }) => {
    const connectButton = page.getByRole("button", { name: /connect nostr/i });
    await expect(connectButton).toBeVisible();
  });

  test("clicking Connect Nostr opens login modal", async ({ page }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();

    // Modal should be visible
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();

    // Modal title
    await expect(page.getByText("Connect to Nostr")).toBeVisible();

    // Close button
    await expect(page.getByRole("button", { name: "×" })).toBeVisible();
  });

  test("login modal can be closed with X button", async ({ page }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();

    await page.getByRole("button", { name: "×" }).click();
    await expect(modal).not.toBeVisible();
  });

  test("clicking outside modal content does not close modal", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();

    // Click the overlay background (not the modal content)
    // The modal does NOT close on overlay click - must use X button
    await modal.click({ position: { x: 10, y: 10 } });
    await expect(modal).toBeVisible();
  });

  test("login modal shows expected content", async ({ page }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();

    await expect(page.getByText("Connect with Nostr")).toBeVisible();
    await expect(
      page.getByText("Sign in to access nostr features")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create new account/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /use existing key/i })
    ).toBeVisible();
  });

  test("Nostr extension button shows only when extension is available", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();

    // Without a Nostr extension installed, the extension button should NOT appear
    const extensionButton = page.getByRole("button", {
      name: /connect with nostr extension/i,
    });
    await expect(extensionButton).not.toBeVisible();
  });

  test("Create New Account button creates account successfully", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();

    const createButton = page.getByRole("button", {
      name: /create new account/i,
    });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // After creating account, modal closes and header shows UserProfile with npub
    await expect(page.locator("header").getByText(/npub1/)).toBeVisible({
      timeout: 10000,
    });

    // "Connect Nostr" button should no longer be visible
    await expect(
      page.getByRole("button", { name: /connect nostr/i })
    ).not.toBeVisible();
  });

  test("Use Existing Key reveals key input form", async ({ page }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();

    await page.getByRole("button", { name: /use existing key/i }).click();

    // Should show textarea for key input
    await expect(page.getByLabel(/private key or nsec/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^sign in$/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /cancel/i })
    ).toBeVisible();
  });

  test("Use Existing Key form can be cancelled", async ({ page }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();

    await page.getByRole("button", { name: /use existing key/i }).click();
    await expect(page.getByLabel(/private key or nsec/i)).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();

    // Should return to main login view
    await expect(
      page.getByRole("button", { name: /create new account/i })
    ).toBeVisible();
    await expect(page.getByLabel(/private key or nsec/i)).not.toBeVisible();
  });

  test("Sign In with empty key shows error", async ({ page }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();

    await page.getByRole("button", { name: /use existing key/i }).click();

    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(
      page.getByText("Please enter a private key or nsec")
    ).toBeVisible();
  });

  test("Sign In with invalid key shows error", async ({ page }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();

    await page.getByRole("button", { name: /use existing key/i }).click();

    await page.getByLabel(/private key or nsec/i).fill("invalid-key");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(
      page.getByText(/invalid|error|failed/i)
    ).toBeVisible();
  });

  test("keys stored locally disclaimer is shown", async ({ page }) => {
    await page.getByRole("button", { name: /connect nostr/i }).click();

    await expect(
      page.getByText("Your keys are stored locally in your browser")
    ).toBeVisible();
  });
});
