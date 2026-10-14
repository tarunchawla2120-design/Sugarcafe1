import { BetaAnalyticsDataClient } from "@google-analytics/data";
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }
  try {
    const credentials = JSON.parse(
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    );
    const client = new BetaAnalyticsDataClient({
      credentials,
    });
    const [report] = await client.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: "today",
          endDate: "today",
        },
      ],
      metrics: [
        {
          name: "totalUsers",
        },
      ],
    });
    const visitors = Number(
      report.rows?.[0]?.metricValues?.[0]?.value || 0
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      visitors,
    });
  } catch (error) {
    console.error("Analytics API error:", error.message);
    return res.status(500).json({
      error: "Unable to load website visitors",
    });
  }
}
