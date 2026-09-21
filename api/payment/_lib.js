function getFirebaseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not configured."
    );
  }

  let value = String(raw).trim();
  let serviceAccount = null;

  // ============================================================
  // 1. NORMAL JSON
  // ============================================================

  try {
    serviceAccount = JSON.parse(value);

    // Handles JSON stored as a JSON string
    if (typeof serviceAccount === "string") {
      serviceAccount = JSON.parse(serviceAccount);
    }
  } catch {
    serviceAccount = null;
  }

  // ============================================================
  // 2. QUOTED / ESCAPED JSON
  // ============================================================

  if (!serviceAccount) {
    try {
      let unwrapped = value;

      // Remove accidental outer quotes
      if (
        unwrapped.startsWith('"') &&
        unwrapped.endsWith('"')
      ) {
        try {
          unwrapped = JSON.parse(unwrapped);
        } catch {
          unwrapped = unwrapped.slice(1, -1);
        }
      }

      // Convert escaped quotes if necessary
      if (
        typeof unwrapped === "string"
      ) {
        unwrapped = unwrapped
          .replace(/\\"/g, '"')
          .trim();
      }

      if (
        unwrapped.startsWith("{") &&
        unwrapped.endsWith("}")
      ) {
        serviceAccount =
          JSON.parse(unwrapped);
      }
    } catch {
      serviceAccount = null;
    }
  }

  // ============================================================
  // 3. BASE64 JSON
  // ============================================================

  if (!serviceAccount) {
    try {
      const decoded = Buffer
        .from(value, "base64")
        .toString("utf8")
        .trim();

      serviceAccount =
        JSON.parse(decoded);

      // Base64 may contain JSON string
      if (
        typeof serviceAccount === "string"
      ) {
        serviceAccount =
          JSON.parse(serviceAccount);
      }
    } catch {
      serviceAccount = null;
    }
  }

  // ============================================================
  // 4. VALIDATE SERVICE ACCOUNT
  // ============================================================

  if (
    !serviceAccount ||
    typeof serviceAccount !== "object" ||
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is invalid or missing project_id, client_email or private_key."
    );
  }

  // ============================================================
  // 5. FIX PRIVATE KEY NEWLINES
  // ============================================================

  serviceAccount.private_key =
    String(serviceAccount.private_key)
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n")
      .trim();

  return serviceAccount;
}