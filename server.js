const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

/*
 * Temporary news storage.
 * Later we will connect this to a real database
 * and automatic news collection.
 */
let news = [
  {
    id: 1,
    title: "Welcome to DEVHUB News",
    description: "DEVHUB is building a global news platform that brings important stories together in one place.",
    category: "World",
    source: "DEVHUB",
    publishedBy: "DEVHUB",
    publishedAt: new Date().toISOString()
  }
];

/*
 * Health check
 */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "DEVHUB News backend",
    message: "DEVHUB News API is running"
  });
});

/*
 * Get all news
 */
app.get("/api/news", (req, res) => {
  res.json({
    success: true,
    count: news.length,
    articles: news
  });
});

/*
 * Get one article
 */
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

/*
 * Get news by category
 */
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

/*
 * Search news
 */
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
    article.category.toLowerCase().includes(query)
  );

  res.json({
    success: true,
    count: results.length,
    articles: results
  });
});

/*
 * Add a news article.
 *
 * This is mainly for testing the backend.
 * Later, DEVHUB's news system will create
 * articles automatically from verified sources.
 */
app.post("/api/news", (req, res) => {
  const {
    title,
    description,
    category,
    source
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      success: false,
      message: "Title and description are required"
    });
  }

  const article = {
    id: news.length + 1,
    title: title,
    description: description,
    category: category || "General",
    source: source || "DEVHUB",
    publishedBy: "DEVHUB",
    publishedAt: new Date().toISOString()
  };

  news.unshift(article);

  res.status(201).json({
    success: true,
    article: article
  });
});

/*
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "DEVHUB News endpoint not found"
  });
});

/*
 * Start server
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`DEVHUB News backend running on port ${PORT}`);
});
