// Load environment variables
require("dotenv").config();
const fs = require("fs").promises;
const axios = require("axios");
const { format } = require("date-fns");
const sharp = require("sharp"); // Image processing library
// const logopath = "./assets/image.png"; // Path to your logo
const upload = require("./gcpStorage");
const logopath = "./assets/whitelogo.png";
let blogtopic = "";
let blogdescr = "";
let imgprompt = "";
let newimageFilePath = "";
let generatedExcerpt = "";
let generateimgurl = "";

// Function to generate new topic on the basis of existing topic

async function generateNewBlogTopicUsingAi() {
  try {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const data = await fs.readFile("topics.json", "utf8");
    const jsonData = JSON.parse(data);
    const topics = jsonData.blogTopics;

    const newBlogTopicPrompt =
      "Generate an original and unique technical blog topic, different from the previously generated topics, with a short description. Take reference from these : " +
      JSON.stringify(topics) +
      `. Return the new original topic in the same JSON format. Please return the JSON without any code block markers or special formatting (e.g., no backticks), including a key "excerpt". 
            The excerpt should be between 100 to 180 characters, providing a concise overview of the blog topic. Ensure no word is repeated and topic is unique`;

    const response = await axios.post(
      // "https://erpbotaistrong.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2023-03-15-preview"
      process.env.AZURE_CHAT_ENDPOINT,
      {
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant that writes original blog post by adopting persona of a technical writer.",
          },
          {
            role: "user",
            content: newBlogTopicPrompt,
          },
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
    const newFetchedTopics = JSON.parse(
      response.data.choices[0].message.content
    );
    generatedExcerpt = newFetchedTopics[0]?.Excerpt;
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

// Azure OpenAI API function to generate blog content remains unchanged
async function generateBlogContent() {
  try {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const getTopicAndDesc = await generateNewBlogTopicUsingAi();
    if (!getTopicAndDesc) {
      throw new Error("Failed to generate blog topic and description.");
    }
    blogtopic = getTopicAndDesc?.blogtopic;
    blogdescr = getTopicAndDesc?.blogdescr;

    let blogtopic2 =
      `Write an original blog post in atleast 1000 words on topic related to technologies such as dynamics 365, Oracle cloud, Amazon Web Services, Google Cloud, Azure, Azure machine learning office 365, Data bricks, Open AI, Sales Force, Oracle ERP Cloud , SAP FI/CO , React Js, Flutter, Service Now, PeopleSoft , Dynamics 365 Finance and Operations` +
      blogtopic +
      `.", ` +
      blogdescr +
      `Please return content in valid HTML without any code block markers or special formatting (e.g., no backticks). Only provide body content so that it can be used directly on a website. Ensure that the body does not include title and content should be SEO Optimized and based on latest trends. Content should be based on instructions given. Break content into few sections with bullet points and numbered lists. First paragraph should always be introduction of the topic and what will be the content is about, then it should have sub headings, data or statistics to support points, and a conclusion. The content should include Workwall website as marketplace. Provide valuable insights about marketplace trends, tips, or industry news and add some humour to it. Blog post content should be in casual tone, business tone, from developer's,from functional user's,and one from end user perspective. Include these perspectives into the content so that each and every reader get what they want to know from blog. Mention that the blog will be updated regularly. Post should encourage readers to take specific action.`;

    const response = await axios.post(
      // "https://erpbotaistrong.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2023-03-15-preview"
      process.env.AZURE_CHAT_ENDPOINT ,
      {
        messages: [
          {
            role: "system",
            content:
              "You are an AI assistant that helps write original technical blogs which are insightful.",
          },
          {
            role: "user",
            content: blogtopic2,
          },
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
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating blog content:", error);
    throw error;
  }
}

// Function to combine the generated image with the logo and return the URL of the combined image
async function combineImageWithLogo(imageUrl, logoPath) {
  try {
    // Download the generated image from the URL
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

    // Simulate the final URL of the combined image (You can upload it to a storage service and use the URL)
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

// Function to generate the image using DALL-E, and then combine it with the logo
async function generateImage(imgprompt) {
  try {
    const response = await axios.post(
      // "https://erpbotaistrong.openai.azure.com/openai/deployments/dall-e-3/images/generations?api-version=2024-02-01"
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
    .replace(/(^-|-$)/g, "")
   ;
  const blogPost = {
    fieldData: {
      name: blogtopic , // You can dynamically set this
      slug: slug, // Make sure this is unique or dynamically generated
      _draft: false,
      _archived: false,
      content: blogContent,
      date: lastUpdated,

      "author-username": author, // Username of the author
      excerpt: generatedExcerpt ,
      // imageFilePath : newimageFilePath
      "image-featured": {
        url: newimageFilePath ,
      },
      //"eb0e42679c8435954fec13a7936cf826": "Azure AI",
      //"publishDate": new Date().toISOString() // ISO format
    },
  };


  // www.workwall.com/work-posts/work-post-page
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
    console.error("Error posting blog to Webflow:", error.response.data || error.message);
    // throw error;
  }
} //end of Function to post content to Webflow

// Running the full process
async function run() {
  try {
    imgprompt =
      "Create a realistic, unique original image based on" +
      blogtopic +
      "inspired by the abstract qualities of artists like Mark Rothko, without directly imitating their style. The image should reflect themes of innovation, technology, and connectivity, featuring realistic humans in a professional atmosphere. The color palette must strictly use shades of Blue and white, with a blue or light blue background. Ensure the image stays within 4000kb in size, adheres to the specified color theme, and avoids any unnecessary assumptions or deviations.";

    // imgprompt =
    //   "Generate a simple original realistic image of size lesser than 4000kb, inspired by the abstract qualities from paintings of famous artists like mark rothko, without directly copying their style of the paintings. The image should reflect innovation and technology, including realistic humans while maintaining a professional atmosphere to convey innovation and connectivity on topic " +
    //   blogtopic +
    //   " using only Brandeis Blue and white color theme with solid blue or light blue background. Do make sure about the color theme and avoid generating image based on assumptions.";

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
