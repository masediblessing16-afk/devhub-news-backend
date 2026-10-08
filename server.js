const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Serve the DEVHUB website from the public folder.
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "";

let news = [
  {
    id: 1,
    title: "Welcome to DEVHUB News",
    description:
      "DEVHUB is building a global news platform that brings important stories together in one place.",
    category: "World",
    source: "DEVHUB",
    sourceUrl: "",
    publishedBy: "DEVHUB",
    publishedAt: new Date().toISOString()
  }
];

let nextId = 2;

function cleanText(value) {
  if (!value) return "";
  return String(value).replace(/<[^>]*>/g, "").trim();
}

function mapCategory(category) {
  const allowed = [
    "World",
    "Nation",
    "Business",
    "Technology",
    "Entertainment",
    "Sports",
    "Science",
    "Health",
    "General"
  ];

  if (!category) return "General";

  const found = allowed.find(
    item => item.toLowerCase() === String(category).toLowerCase()
  );

  return found || "General";
}

async function fetchGNews(category, country) {
  if (!GNEWS_API_KEY) return [];

  const params = new URLSearchParams({
    category: category,
    lang: "en",
    max: "10",
    apikey: GNEWS_API_KEY
  });

  if (country) {
    params.set("country", country);
  }

  const response = await fetch(
    "https://gnews.io/api/v4/top-headlines?" + params.toString()
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error("GNews returned " + response.status + ": " + body);
  }

  const data = await response.json();

  if (!Array.isArray(data.articles)) return [];

  return data.articles.map(item => ({
    title: cleanText(item.title),
    description:
      cleanText(item.description) ||
      "Open the original source for the full story.",
    category: mapCategory(category),
    source:
      item.source && item.source.name
        ? item.source.name
        : "News source",
    sourceUrl: item.url || "",
    publishedAt: item.publishedAt || new Date().toISOString()
  }));
}

async function refreshNews() {
  if (!GNEWS_API_KEY) {
    return {
      success: false,
      message: "GNEWS_API_KEY is not configured yet.",
      added: 0
    };
  }

  const categories = [
    ["world", null],
    ["nation", "za"],
    ["business", null],
    ["technology", null],
    ["sports", null],
    ["health", null]
  ];

  const incoming = [];

  for (const [category, country] of categories) {
    try {
      const articles = await fetchGNews(category, country);
      incoming.push(...articles);
    } catch (error) {
      console.error("News refresh error:", error.message);
    }
  }

  const existingUrls = new Set(
    news.map(article => article.sourceUrl).filter(Boolean)
  );

  const unique = incoming.filter(article => {
    if (!article.sourceUrl || existingUrls.has(article.sourceUrl)) {
      return false;
    }

    existingUrls.add(article.sourceUrl);
    return true;
  });

  const created = unique.map(article => ({
    id: nextId++,
    title: article.title,
    description: article.description,
    category: article.category,
    source: article.source,
    sourceUrl: article.sourceUrl,
    publishedBy: "DEVHUB",
    publishedAt: article.publishedAt
  }));

  news = [...created, ...news]
    .sort((a, b) =>
      new Date(b.publishedAt) - new Date(a.publishedAt)
    )
    .slice(0, 200);

  return {
    success: true,
    added: created.length,
    total: news.length
  };
}

// Health check. The website is served by express.static above.
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "DEVHUB News backend",
    newsProviderConfigured: Boolean(GNEWS_API_KEY)
  });
});

// Get all news.
app.get("/api/news", (req, res) => {
  res.json({
    success: true,
    count: news.length,
    articles: news
  });
});

// Get one article.
app.get("/api/news/:id", (req, res) => {
  const id = Number(req.params.id);
  const article = news.find(item => item.id === id);

  if (!article) {
    return res.status(404).json({
      success: false,
      message: "Article not found"
    });
  }

  res.json({
    success: true,
    article: article
  });
});

// Get news by category.
app.get("/api/news/category/:category", (req, res) => {
  const category = req.params.category.toLowerCase();

  const results = news.filter(
    item => item.category.toLowerCase() === category
  );

  res.json({
    success: true,
    count: results.length,
    articles: results
  });
});

// Search news.
app.get("/api/search", (req, res) => {
  const query = (req.query.q || "").toLowerCase().trim();

  if (!query) {
    return res.json({
      success: true,
      count: 0,
      articles: []
    });
  }

  const results = news.filter(article =>
    article.title.toLowerCase().includes(query) ||
    article.description.toLowerCase().includes(query) ||
    article.category.toLowerCase().includes(query) ||
    article.source.toLowerCase().includes(query)
  );

  res.json({
    success: true,
    count: results.length,
    articles: results
  });
});

// Refresh real news.
app.post("/api/refresh", async (req, res) => {
  try {
    const result = await refreshNews();
    res.json(result);
  } catch (error) {
    console.error("Refresh failed:", error.message);

    res.status(500).json({
      success: false,
      message: "News refresh failed"
    });
  }
});

// Add an article for testing.
app.post("/api/news", (req, res) => {
  const {
    title,
    description,
    category,
    source,
    sourceUrl
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      success: false,
      message: "Title and description are required"
    });
  }

  const article = {
    id: nextId++,
    title: cleanText(title),
    description: cleanText(description),
    category: mapCategory(category),
    source: cleanText(source) || "DEVHUB",
    sourceUrl: sourceUrl || "",
    publishedBy: "DEVHUB",
    publishedAt: new Date().toISOString()
  };

  news.unshift(article);

  res.status(201).json({
    success: true,
    article: article
  });
});

// Refresh news on startup and every 30 minutes.
if (GNEWS_API_KEY) {
  setTimeout(() => {
    refreshNews().catch(error =>
      console.error("Initial news refresh failed:", error.message)
    );
  }, 5000);

  setInterval(() => {
    refreshNews().catch(error =>
      console.error("Scheduled news refresh failed:", error.message)
    );
  }, 30 * 60 * 1000);
}

// API fallback for unknown routes.
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "DEVHUB News endpoint not found"
  });
});

// Start server.
app.listen(PORT, "0.0.0.0", () => {
  console.log("DEVHUB News backend running on port " + PORT);
});
