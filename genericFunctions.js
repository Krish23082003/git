require("dotenv").config();
const axios = require("axios");
const fs = require("fs").promises;
const { format } = require("date-fns");
const sharp = require("sharp");
const upload = require("./gcpStorage");

async function generateNewBlogTopicUsingAi() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const data = await fs.readFile("topics.json", "utf8");
  const topics = JSON.parse(data).blogTopics;
  const prompt = `Based on these topics: ${JSON.stringify(
    topics
  )}, generate a unique technical blog topic. Avoid duplication. Return as JSON with keys: Topic, Description, Excerpt.`;

  const res = await axios.post(
    process.env.AZURE_CHAT_ENDPOINT,
    {
      messages: [
        {
          role: "system",
          content: "You write original technical blog topics.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 800,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
    }
  );
  return JSON.parse(res.data.choices[0].message.content);
}

async function generateBlogContent() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const topicData = await generateNewBlogTopicUsingAi();
  const { Topic, Description, Excerpt } = topicData;

  const prompts = [
    {
      role: "user",
      content: `Write an engaging intro for: ${Topic}. Return HTML only.`,
    },
    {
      role: "user",
      content: `Write 1000 words on: ${Topic}. Add '[IMAGE_PLACEHOLDER]' mid way. Return HTML only.`,
    },
    {
      role: "user",
      content: `Explain Workwall as a marketplace in ~250 words for topic: ${Topic}. Return HTML only.`,
    },
    {
      role: "user",
      content: `Conclude the blog on: ${Topic}. Talk about future and CTA. Return HTML only.`,
    },
  ];

  const sections = [];
  for (const p of prompts) {
    const res = await axios.post(
      process.env.AZURE_CHAT_ENDPOINT,
      {
        messages: [
          {
            role: "system",
            content: "Write engaging, technical blog sections.",
          },
          p,
        ],
        max_tokens: 1500,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );
    sections.push(res.data.choices[0].message.content);
  }

  let blogContent = sections.join("\n");
  const placeholderCount = (blogContent.match(/\[IMAGE_PLACEHOLDER\]/g) || [])
    .length;
  for (let i = 0; i < placeholderCount; i++) {
    const imageUrl = await generateInlineImage(`${Topic} - ${Description}`);
    blogContent = blogContent.replace(
      "[IMAGE_PLACEHOLDER]",
      `<img src=\"${imageUrl}\" alt=\"Blog image\" style=\"width:100%;margin:20px 0;\"/>`
    );
  }

  const coverImageUrl = await generateImage(`${Topic} - ${Description}`);
  return {
    content: blogContent,
    topic: Topic,
    excerpt:
      Excerpt.length > 100 ? Excerpt.slice(0, 100) : Excerpt.padEnd(100, "."),
    description: Description,
    imageUrl: coverImageUrl,
  };
}

async function generateInlineImage(prompt) {
  const res = await axios.post(
    process.env.AZURE_DALLE2_ENDPOINT,
    { prompt, n: 1, size: "1024x1024" },
    {
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.AZURE_DALLE3_API_KEY,
      },
    }
  );
  return res.data.data[0].url;
}

async function generateImage(prompt) {
  const res = await axios.post(
    process.env.AZURE_DALLE2_ENDPOINT,
    { prompt, n: 1, size: "1792x1024" },
    {
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.AZURE_DALLE3_API_KEY,
      },
    }
  );
  return res.data.data[0].url;
}

//function to post content on workwall

async function postBlogToWebflow({
  token,
  collectionId,
  author,
  name,
  content,
  topic,
  excerpt,
  imageUrl,
  description,
  fields,
}) {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const lastUpdated = format(new Date(), "yyyy-MM-dd");

  const fieldDataWorkWallAndProso = {
    name: topic,
    slug,
    date: lastUpdated,
    excerpt,
    _draft: false,
    _archived: false,
    ...(fields &&
      Object.fromEntries(
        Object.entries(fields).filter(([key]) => key !== "imageField")
      )),
    //...(description && { "subtitle-text": description }),
    ...(author && { "author-username": author }),
    ...(imageUrl &&
      fields.imageField && { [fields.imageField]: { url: imageUrl } }),
  };
  //   const fieldDataProso = {
  //     name: topic,
  //     slug,
  //     date: lastUpdated,
  //     excerpt,
  //     _draft: false,
  //     _archived: false,
  //     ...(fields &&
  //       Object.fromEntries(
  //         Object.entries(fields).filter(([key]) => key !== "imageField")
  //       )),
  //     //...(description && { "subtitle-text": description }),
  //     ...(author && { "author-username": author }),
  //     ...(imageUrl &&
  //       fields.imageField && { [fields.imageField]: { url: imageUrl } }),
  //   };

  const fieldDataImagine = {
    name: topic,
    slug,
    date: lastUpdated,
    // excerpt,
    _draft: false,
    _archived: false,
    ...(fields &&
      Object.fromEntries(
        Object.entries(fields).filter(([key]) => key !== "imageField")
      )),
    ...(description && { "subtitle-text": description }),
    // ...(author && { "author-username": author }),
    ...(imageUrl &&
      fields.imageField && { [fields.imageField]: { url: imageUrl } }),
  };

  const fieldData =
    name === "workwall" || name === "proso"
      ? fieldDataWorkWallAndProso
      : fieldDataImagine;

  try {
    const res = await axios.post(
      `https://api.webflow.com/v2/collections/${collectionId}/items`,
      { fieldData },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "accept-version": "1.0.0",
        },
      }
    );

    console.log(`✅ Blog posted: ${topic}`);
  } catch (error) {
    // 🔥 Add this block to see what exactly went wrong
    if (error.response) {
      console.error("❌ Webflow API Error:");
      console.error("Status:", error.response.status);
      console.error("Message:", error.response.data.message);
      console.error(
        "Details:",
        JSON.stringify(error.response.data.details, null, 2)
      ); // ⭐ KEY LINE
    } else {
      console.error("Unexpected Error:", error.message);
    }
  }
}

module.exports = {
  generateBlogContent,
  postBlogToWebflow,
};
