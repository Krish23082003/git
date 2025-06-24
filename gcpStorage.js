const { Storage } = require('@google-cloud/storage');
const storage = new Storage({ keyFilename: './encryption/key.json' }); // Creates a client from a Google service account key
const bucketName = process.env.GCP_BUCKET; // The ID of your GCS bucket
const fs = require('fs');

async function uploadFromMemory(localFilePath) {
	try {
		const fileContents = fs.readFileSync(localFilePath);
		const destFileName = await generateUniqueName();
            const newPath = `webFlow/${destFileName}.png`
		await storage.bucket(bucketName).file(newPath).save(fileContents);
            console.log('this is link >>', `https://${bucketName}.storage.googleapis.com/${newPath}`);
		return {
			success: true,
			message: 'Image upload complete',
			link: `https://${bucketName}.storage.googleapis.com/${newPath}`
		};
	} catch (error) {
		console.log('error from services/gcp-storage/uploadFromMemory() :>> ', error);
		return { success: false, error: error.message };
	}
}

async function generateUniqueName() {
	const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e9);
	const uniqueFileName = `${uniquePrefix}`;
	return uniqueFileName;
}

module.exports = { uploadFromMemory, generateUniqueName };
