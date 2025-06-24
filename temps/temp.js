const axios = require('axios');
require('dotenv').config();

const webflowToken = process.env.WEBFLOW_API_TOKEN;
const collectionId = process.env.WEBFLOW_COLLECTION_ID;
axios.get(`https://api.webflow.com/v2/collections/${collectionId}`, {
  headers: {
    'Authorization': `Bearer ${webflowToken}`,
    'accept-version': '1.0.0'
  }
})
.then(response => {
  console.log(response.data);
})
.catch(error => {
  console.error('Error fetching collection:', error);
});
