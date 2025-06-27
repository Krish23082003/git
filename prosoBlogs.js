const {
  generateBlogContent,
  postBlogToWebflow,
} = require("./genericFunctions");
require("dotenv").config();
const logopath = "./assets/whitelogo.png";

async function run() {
  const sites = {
    name: "proso",
    token: process.env.WEBFLOW_API_TOKEN_PROSO,
    collectionId: process.env.WEBFLOW_COLLECTION_ID_PROSO,
    author: "Proso.ai",
    fields: {
      "post-body": generateBlogContent,
      imageField: "image-featured",
    },
  };
  console.log(`\n🚀 Generating blog for ${sites.name}...`);
  const blog = await generateBlogContent();
  console.log("blog is", blog);
  await postBlogToWebflow({
    token: sites.token,
    collectionId: sites.collectionId,
    author: sites.author,
    name: sites.name,
    content: blog.content,
    topic: blog.topic,
    excerpt: blog.excerpt,
    imageUrl: blog.imageUrl,
    description: blog.description,
    fields: {
      "post-body": blog.content,
      imageField: "image-featured",
    },
  });
}

run().catch(console.error);
