//focusing on D365 //PROMPT SPECIFIC
//BLOG LENGTH INCREASED
//IMAGE ADDED BETWEEN CONTENT
// Load environment variables
require("dotenv").config();
const fs = require("fs").promises;
const axios = require("axios");
const { format } = require("date-fns");
const sharp = require("sharp");
const upload = require("./gcpStorage");
const logopath = "./assets/whitelogo.png";
let blogtopic = "";
let blogdescr = "";
let imgprompt = "";
let newimageFilePath = "";
let generatedExcerpt = "";
let generateimgurl = "";
let generatecontentimgurl = "";
// Function to generate new topic on the basis of existing topic

async function generateNewBlogTopicUsingAi() {
  try {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const data = await fs.readFile("topic1.json", "utf8");
    const jsonData = JSON.parse(data);
    const topics = jsonData.blogTopics;

    const newBlogTopicPrompt = `Based on these previously generated topics: +
      ${JSON.stringify(topics)} +
      Generate blog topic same as: Microsoft Dynamics 365 F&O
      Avoid using topics in same format as previously generated.
      Additionally:
      - Provide a description (30-50 words) explaining the topic and its relevance.
      - Write an excerpt (100-150 characters) summarizing the blog's value proposition for readers.
      Return response as a JSON object with keys: "Topic", "Description", and "Excerpt". 
      Ensure no code block markers, backticks, or special formatting in the output.
    `;

    const response = await axios.post(
      process.env.AZURE_CHAT_ENDPOINT,
      {
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant that writes original blog contents by adopting persona of a technical writer.",
          },
          {
            role: "user",
            content: newBlogTopicPrompt,
          },
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
    const newFetchedTopics = JSON.parse(
      response.data.choices[0].message.content
    );
    generatedExcerpt = newFetchedTopics[0]?.Excerpt;
    blogtopic = newFetchedTopics?.Topic || null;
    return {
      success: true,
      blogtopic: newFetchedTopics?.Topic || null,
      blogdescr: newFetchedTopics?.Description || null,
    };
  } catch (error) {
    console.error("Error generating new blog topic using AI:", error);
    return { success: false, error: error.message };
  }
}

async function generateBlogContent() {
  try {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    // Step 1: Generate a new blog topic
    const getTopicAndDesc = await generateNewBlogTopicUsingAi();
    if (!getTopicAndDesc.success) {
      throw new Error("Failed to generate blog topic and description.");
    }

    const blogTopic = getTopicAndDesc.blogtopic;
    const blogdescr = getTopicAndDesc.blogdescr;

    // Step 2: Generate Introduction
    const introductionPrompt =
      `
        Based on the topic:` +
      blogTopic +
      `and description: ` +
      blogdescr +
      "," +
      `Write an engaging introduction in approximately 300 words, strictly avoid including blog topic as heading in content.
      Include what topic is about and what blog will cover. Avoid unnecessarily complex or formal language. Use simpler, conversational phrasing where appropriate.
      Please return content in valid HTML without any code block markers or special formatting (e.g., no backticks) so that it can be used directly on a website. `;

    const introductionResponse = await axios.post(
      process.env.AZURE_CHAT_ENDPOINT,
      {
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant that adopts human persona and writes engaging and technical blogs.",
          },
          { role: "user", content: introductionPrompt },
        ],
        max_tokens: 1000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );

    const introductionContent =
      introductionResponse.data.choices[0].message.content;

    // Step 3: Generate Core Content with Images
    const coreContentPrompt = `
        Please return 800 words content in valid HTML without any code block markers or special formatting (e.g., no backticks) so that it can be used directly on a website.
        Avoid unnecessarily complex or formal language. Use simpler, conversational phrasing where appropriate.
        Do not conclude.
        Based on the same topic: "${blogTopic}" and description: "${blogdescr}",
        Use bullet points, lists or tables to showcase recent data or statistics. Attach links to useful websites and documentations.
        Give detailed process and analysis of: Developer tools-
Development tools in Visual Studio
Version control, metadata search, and navigation
Build automation using Azure.
   Add an engaging image prompt every 300-400 words to make the blog more visually appealing.
        When adding the image prompt, include the text '[IMAGE_PLACEHOLDER]' to denote where the image will be placed.`;

    const coreContentResponse = await axios.post(
      process.env.AZURE_CHAT_ENDPOINT,
      {
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant that adopts human persona and writes insightful and technical blogs. Keep the tone casual yet professional, adding a bit of humour. Link to authoritative sources or studies, which adds credibility and shows a human's involvement in research.",
          },
          { role: "user", content: coreContentPrompt },
        ],
        max_tokens: 2000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );

    let coreContent = coreContentResponse.data.choices[0].message.content;

    const imagePlaceholders = coreContent.match(/\[IMAGE_PLACEHOLDER\]/g) || [];
    for (let i = 0; i < imagePlaceholders.length; i++) {
      const imagePrompt = `Generate an image relevant to the following blog topic: "${blogTopic}" and description: "${blogdescr}". Ensure it visually represents the content around this section and matches a professional, tech-related theme.`;

      const imageUrl = await generateInlineImage(imagePrompt); // New function for inline images

      //   coreContent = coreContent.replace(
      //     "[IMAGE_PLACEHOLDER]",
      //     `<img src="${imageUrl}" alt="Inline blog image" width="600" height="400" style="display: inline-block; margin-top: 10px; margin-bottom: 10px;"/>`
      //   );
      coreContent = coreContent.replace(
        "[IMAGE_PLACEHOLDER]",
        `<div style="display: flex; justify-content: center; align-items: center; margin: 20px 0;">
           <img src="${imageUrl}" alt="Inline blog image" width="600" height="400"  style="display: block;"/>
         </div>`
      );
    }
    //Workwall as market place:
    const WWconclusionPrompt = `
    Based on the same topic: "${blogTopic}" and description: "${blogdescr}",
   before conclusion, mention Workwall website as a marketplace and explain its function with example.
   Encourage readers to visit website.
   Write approximately 250 words.
   Please return content in valid HTML without any code block markers or special formatting (e.g., no backticks).
   Only provide content so that it can be used directly on a website.`;

    const WWconclusionResponse = await axios.post(
      process.env.AZURE_CHAT_ENDPOINT,
      {
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant that writes informative and actionable conclusions for blogs. Keep tone casual yet professional, informative, adding a bit of humour.",
          },
          { role: "user", content: WWconclusionPrompt },
        ],
        max_tokens: 500,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );
    const WWconclusionContent =
      WWconclusionResponse.data.choices[0].message.content;

    // Step 5: Generate Conclusion
    const conclusionPrompt = `
         Based on the same topic, write in 300 words.: "${blogTopic}" and description: "${blogdescr}",
        conclude blog by discussing its future aspects and offerings. Encourage readers to take specific actions and mention that blog will be updated regularly. 
        Please return content in valid HTML without any code block markers or special formatting (e.g., no backticks). Only provide content so that it can be used directly on a website.`;

    const conclusionResponse = await axios.post(
      process.env.AZURE_CHAT_ENDPOINT,
      {
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant that writes informative and actionable conclusions for blogs. Keep the tone casual yet professional, adding a bit of humour.",
          },
          { role: "user", content: conclusionPrompt },
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

    const conclusionContent =
      conclusionResponse.data.choices[0].message.content;

    // Combine all parts
    const combinedContent = `
        ${introductionContent}
        ${coreContent}
        ${WWconclusionContent}
        ${conclusionContent}
      `;

    return combinedContent;
  } catch (error) {
    console.error("Error generating blog content:", error);
    throw error;
  }
}

// Function to generate images for inline content (without logo)
async function generateInlineImage(imgprompt) {
  try {
    const response = await axios.post(
      process.env.AZURE_DALLE2_ENDPOINT,
      {
        prompt: imgprompt,
        n: 1,
        size: "1024x1024",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.AZURE_DALLE3_API_KEY,
        },
      }
    );
    const imageUrl = response.data.data[0].url;
    console.log("Generated inline image URL:", imageUrl);
    return imageUrl;
  } catch (error) {
    console.error(
      "Error generating inline image:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

async function combineImageWithLogo(imageUrl, logoPath) {
  try {
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data, "binary");

    // Load and resize the logo
    const logo = await sharp(logoPath).resize(200).toBuffer();

    // Combine the logo with the generated image
    const combinedImagePath = "./combined_image.png";
    await sharp(imageBuffer)
      .composite([{ input: logo, top: 960, left: 1580 }])
      .jpeg({ quality: 80 })
      .toFile(combinedImagePath);

    console.log("Image combined successfully:", combinedImagePath);

    const combinedImageUrl = `https://yourimagestorage.com/${combinedImagePath}`;
    newimageFilePath = combinedImageUrl;
    console.log("Combined image URL:", combinedImageUrl);
    const uplaodImageToStorage = await upload.uploadFromMemory(
      combinedImagePath
    );
    console.log("this is the response genrated by ", uplaodImageToStorage);
    newimageFilePath = uplaodImageToStorage?.link;
    return combinedImageUrl;
  } catch (error) {
    console.error("Error combining image with logo:", error);
    throw error;
  }
}

async function generateImage(imgprompt) {
  try {
    const response = await axios.post(
      process.env.AZURE_DALLE2_ENDPOINT,
      {
        prompt: imgprompt,
        n: 1,
        size: "1792x1024",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.AZURE_DALLE3_API_KEY,
        },
      }
    );
    const imageUrl = response.data.data[0].url;
    console.log("Generated image URL:", imageUrl);
    generateimgurl = imageUrl;
    // Now combine the generated image with the logo and get the combined image URL
    const combinedImageUrl = await combineImageWithLogo(imageUrl, logopath);
    return combinedImageUrl;
  } catch (error) {
    console.error(
      "Error generating image:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}

// Function to post content to Webflow
async function postBlogToWebflow(blogContent) {
  const webflowToken = process.env.WEBFLOW_API_TOKEN;
  const collectionId = process.env.WEBFLOW_COLLECTION_ID;
  const author = "Proso.ai";
  const currentDate = new Date();
  const lastUpdated = format(currentDate, "yyyy-MM-dd");
  const slug = blogtopic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const blogPost = {
    fieldData: {
      name: blogtopic, // You can dynamically set this
      slug: slug, // Make sure this is unique or dynamically generated
      _draft: false,
      _archived: false,
      content: blogContent,
      date: lastUpdated,

      "author-username": author, // Username of the author
      excerpt: generatedExcerpt,

      "image-featured": {
        url: newimageFilePath,
      },
    },
  };

  // console.log(blogPost);

  try {
    const response = await axios.post(
      `https://api.webflow.com/v2/collections/${collectionId}/items`,
      blogPost,
      {
        headers: {
          Authorization: `Bearer ${webflowToken}`,
          "Content-Type": "application/json",
          "accept-version": "1.0.0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error posting blog to Webflow:",
      error.response.data || error.message
    );
    // throw error;
  }
}
//end of Function to post content to Webflow

// Running the full process
async function run() {
  try {
    imgprompt =
      "You are an AI that creates a real-life, unique and original image based on" +
      blogtopic +
      " and " +
      blogdescr +
      "The image should reflect themes of innovation, technology, and connectivity, featuring realistic humans in a professional atmosphere. The color palette must strictly use shades of Blue and white, with a blue or light blue background. Ensure the image stays within 4000kb in size, adheres to the specified color theme, and avoids any unnecessary assumptions or deviations.";

    console.log("Generating blog content...");
    const blogContent = await generateBlogContent();
    console.log("Generated Blog Content:", blogContent);

    console.log("Generating and combining blog image...");
    const combinedImageUrl = await generateImage(imgprompt);

    console.log("Posting blog content to Webflow...");
    await postBlogToWebflow(blogContent);

    console.log("Blog posted successfully!");
  } catch (error) {
    console.error("Failed to post blog:", error);
  }
}

run();
