// Load environment variables
require('dotenv').config();
const fs = require('fs').promises;
const axios = require('axios');

let blogtopic = '';
let blogdescr = '';
let imgprompt = '';
let newimageFilePath = '';
let generatedExcerpt = '';

//Function used to generate new topic on the basis of existing topic
async function generateNewBlogTopicUsingAi() {
	try {
		const apiKey = process.env.AZURE_OPENAI_API_KEY;
		const data = await fs.readFile('topics.json', 'utf8');
		const jsonData = JSON.parse(data);
		const topics = jsonData.blogTopics;

		const newBlogTopicPrompt =
			'Generate a new blog topic with a short description similar to the existing topics in this format: ' + JSON.stringify(topics) +
			`. Return the new topic in the same JSON format Please return the JSON without any code block markers or special formatting (e.g., no backticks)., including a key "excerpt". 
                  The excerpt should be between 100 to 180 characters, providing a concise overview of the blog topic.`;

		const response = await axios.post(
			process.env.AZURE_CHAT_ENDPOINT, //Azure OpenAI endpoint
			{
				messages: [
					{
						role: 'system',
						content: [
							{
								type: 'text',
								text: 'You are an AI assistant that helps write original blogs Topics which are insightful'
							}
						]
					},
					{
						role: 'user',
						content: [
							{
								type: 'text',
								text: newBlogTopicPrompt
							}
						]
					}
				],
				max_tokens: 500
			},
			{
				headers: {
					'Content-Type': 'application/json',
					'api-key': apiKey
				}
			}
		);
		const newFetchedTopics = JSON.parse(response.data.choices[0].message.content);
		generatedExcerpt = newFetchedTopics[0]?.Excerpt;
		return {
			success: true,
			blogtopic: newFetchedTopics?.Topic || null,
			blogdescr: newFetchedTopics?.Description || null
		};
	} catch (error) {
		console.error('Error generating new blog topic using AI:', error);
		return { success: false, error: error.message };
	}
}

// Azure OpenAI API function
async function generateBlogContent() {
	try {
		const apiKey = process.env.AZURE_OPENAI_API_KEY;
		const getTopicAndDesc = await generateNewBlogTopicUsingAi();
		// Retry if no topic or description found
		if (!getTopicAndDesc) {
			console.log('Initial attempt failed. Trying again...');
			getTopicAndDesc = await generateNewBlogTopicUsingAi();
			if (!getTopicAndDesc) {
				throw new Error('Failed to generate blog topic and description.');
			}
		}
		blogtopic = getTopicAndDesc?.blogtopic;
		blogdescr = getTopicAndDesc?.blogdescr;
		let blogtopic2 =
			`Write an original blog post of 2000 words with the topic "` +
			blogtopic +
			`.", ` +
			blogdescr +
			` Please return the content in valid HTML without any code block markers or special formatting (e.g., no backticks). Only provide the body content so that it can be used directly on a website. Ensure that body does not include main Topic.`;

		imgprompt = 'Generate image using abstract human form on topic ' + blogtopic + ' , using color theme of blue';

		const response = await axios.post(
			process.env.AZURE_CHAT_ENDPOINT, //Azure OpenAI endpoint
			{
				messages: [
					{
						role: 'system',
						content: [
							{
								type: 'text',
								text: 'You are an AI assistant that helps write original blogs which are insightful'
							}
						]
					},
					{
						role: 'user',
						content: [
							{
								type: 'text',
								text: blogtopic2
							}
						]
					}
				],
				max_tokens: 1500
			},
			{
				headers: {
					'Content-Type': 'application/json',
					'api-key': apiKey
				}
			}
		);
		return response.data.choices[0].message.content;
	} catch (error) {
		console.error('Error generating blog content:', error);
		throw error;
	}
} //end of function generatecontent

// Function to post content to Webflow
async function postBlogToWebflow(blogContent) {
	const webflowToken = process.env.WEBFLOW_API_TOKEN;
	const collectionId = process.env.WEBFLOW_COLLECTION_ID;

	const slug = blogtopic
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
	const blogPost = {
		fieldData: {
			name: blogtopic, // You can dynamically set this
			slug: slug, // Make sure this is unique or dynamically generated
			_draft: false,
			_archived: false,
			content: blogContent,
			excerpt: generatedExcerpt,
			// imageFilePath : newimageFilePath
			'image-featured': {
				url: newimageFilePath
			}
			//"eb0e42679c8435954fec13a7936cf826": "Azure AI",
			//"publishDate": new Date().toISOString() // ISO format
		}
	};

	try {
		const response = await axios.post(`https://api.webflow.com/v2/collections/${collectionId}/items`, blogPost, {
			headers: {
				Authorization: `Bearer ${webflowToken}`,
				'Content-Type': 'application/json',
				'accept-version': '1.0.0'
			}
		});
	} catch (error) {
		console.error('Error posting blog to Webflow:', error.response.data);
		// throw error;
	}
} //end of Function to post content to Webflow

// Function to generate an image
async function generateImage() {
	try {
		const response = await axios.post(
			process.env.AZURE_DALLE2_ENDPOINT,
			{
				prompt: imgprompt,
				n: 1,
				size: '1024x1024'
			},
			{
				headers: {
					'Content-Type': 'application/json',
					'api-key': process.env.AZURE_DALLE3_API_KEY
				}
			}
		);
		const imageUrl = response.data.data[0].url;
		newimageFilePath = imageUrl;
	} catch (error) {
		console.error('Error generating image:', error.response ? error.response.data : error.message);
	}
}


//executing both functions together
async function run() {
	try {
		console.log('Generating blog content...');
		const blogContent = await generateBlogContent();

		console.log('Generating blog image...');
		await generateImage();

		console.log('Posting blog content to Webflow...');
		await postBlogToWebflow(blogContent);

		console.log('Blog posted successfully!');
	} catch (error) {
		console.error('Failed to post blog:', error);
	}
}

run();
