// Test script to verify GCS bucket connectivity
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

async function testGCSConnection() {
  console.log('🔍 Testing GCS Connection...\n');
  
  const projectId = process.env.GCP_PROJECT_ID;
  const keyFilename = process.env.GCP_KEY_FILE;
  const bucketName = process.env.GCS_BUCKET_NAME || 'interview-videos';
  
  console.log(`Project ID: ${projectId}`);
  console.log(`Key File: ${keyFilename}`);
  console.log(`Bucket Name: ${bucketName}\n`);
  
  if (!projectId) {
    console.error('❌ GCP_PROJECT_ID is not set in environment variables');
    return;
  }
  
  if (!keyFilename) {
    console.error('❌ GCP_KEY_FILE is not set in environment variables');
    return;
  }
  
  try {
    // Initialize Storage
    const storage = new Storage({
      projectId,
      keyFilename
    });
    
    console.log('✅ Storage client initialized successfully');
    
    // Get bucket reference
    const bucket = storage.bucket(bucketName);
    
    // Check if bucket exists
    console.log(`\n🔍 Checking if bucket "${bucketName}" exists...`);
    const [exists] = await bucket.exists();
    
    if (!exists) {
      console.error(`❌ Bucket "${bucketName}" does not exist!`);
      console.log('\n💡 To create the bucket, run:');
      console.log(`   gsutil mb gs://${bucketName}`);
      console.log(`   Or create it in the GCP Console`);
      return;
    }
    
    console.log(`✅ Bucket "${bucketName}" exists`);
    
    // Try to get bucket metadata (verifies permissions)
    console.log(`\n🔍 Checking bucket permissions...`);
    const [metadata] = await bucket.getMetadata();
    console.log(`✅ Bucket metadata retrieved successfully`);
    console.log(`   Location: ${metadata.location}`);
    console.log(`   Storage Class: ${metadata.storageClass}`);
    
    // Try to list files (verifies read permissions)
    console.log(`\n🔍 Testing read permissions...`);
    const [files] = await bucket.getFiles({ maxResults: 5 });
    console.log(`✅ Read permissions verified (found ${files.length} file(s))`);
    
    // Try to create a test file (verifies write permissions)
    console.log(`\n🔍 Testing write permissions...`);
    const testFileName = `test-${Date.now()}.txt`;
    const testFile = bucket.file(testFileName);
    await testFile.save('Test file for GCS connectivity check', {
      metadata: {
        contentType: 'text/plain'
      }
    });
    console.log(`✅ Write permissions verified`);
    
    // Clean up test file
    await testFile.delete();
    console.log(`✅ Test file deleted`);
    
    console.log(`\n🎉 All GCS connectivity tests passed!`);
    console.log(`✅ Your bucket "${bucketName}" is properly configured and accessible.`);
    
  } catch (error) {
    console.error('\n❌ GCS Connection Test Failed!\n');
    console.error('Error details:', error.message);
    
    if (error.code === 403) {
      console.error('\n💡 This is a permissions error. Check:');
      console.error('   1. The service account has the "Storage Admin" or "Storage Object Admin" role');
      console.error('   2. The key file path is correct');
      console.error('   3. The service account email matches the one in your key file');
    } else if (error.code === 404) {
      console.error('\n💡 Bucket not found. Check:');
      console.error('   1. The bucket name is correct');
      console.error('   2. The bucket exists in the correct project');
      console.error('   3. The project ID is correct');
    } else if (error.code === 'ENOENT') {
      console.error('\n💡 Key file not found. Check:');
      console.error(`   1. The file exists at: ${keyFilename}`);
      console.error('   2. The path is relative to the backend directory');
      console.error('   3. The file has proper JSON format');
    } else {
      console.error('\n💡 Check:');
      console.error('   1. Your internet connection');
      console.error('   2. GCP service status');
      console.error('   3. Firewall/proxy settings');
    }
    
    process.exit(1);
  }
}

testGCSConnection();

