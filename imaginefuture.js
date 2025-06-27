const {
  generateBlogContent,
  postBlogToWebflow,
} = require("./genericFunctions");
require("dotenv").config();
const logopath = "./assets/whitelogo.png";

async function run() {
  const sites = {
    name: "imagine",
    token: process.env.WEBFLOW_API_TOKEN_IMAGINE,
    collectionId: process.env.WEBFLOW_COLLECTION_ID_IMAGINE,
    author: "ImagineFuture.ai",
    fields: {
      "post-body": generateBlogContent,
      "post-summary": null,
      imageField: "main-image",
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
              "post-summary": null,
              imageField: "main-image",
            },
  });
}

run().catch(console.error);
