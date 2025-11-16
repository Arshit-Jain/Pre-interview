# Google Cloud Storage Setup Guide

This guide will help you set up Google Cloud Storage for storing interview video recordings.

## Prerequisites

1. A Google Cloud Platform (GCP) account
2. A GCP project with billing enabled
3. Google Cloud Storage API enabled

## Setup Steps

### 1. Create a Google Cloud Storage Bucket

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Cloud Storage** > **Buckets**
3. Click **Create Bucket**
4. Choose a unique bucket name (e.g., `interview-videos-[your-project-id]`)
5. Select a location type (Regional or Multi-regional)
6. Choose a storage class (Standard is recommended)
7. Click **Create**

### 2. Create a Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Enter a name (e.g., `interview-video-uploader`)
4. Click **Create and Continue**
5. Grant the role: **Storage Object Admin** (or **Storage Object Creator** for write-only access)
6. Click **Continue** and then **Done**

### 3. Create and Download Service Account Key

1. Click on the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key**
4. Choose **JSON** format
5. Click **Create** - this will download a JSON key file
6. **Important**: Keep this file secure and never commit it to version control

### 4. Configure Environment Variables

Add the following to your `.env` file in the backend directory:

```env
# Google Cloud Storage Configuration
GCS_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name
GCS_KEY_FILE=./path/to/your-service-account-key.json

# OR use credentials as JSON string (alternative to key file)
# GCS_CREDENTIALS={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

### 5. Install Dependencies

The required package `@google-cloud/storage` is already in `package.json`. Run:

```bash
npm install
```

## Bucket Permissions

Make sure your bucket has the appropriate permissions:

- **Public Access**: If you want videos to be publicly accessible, the bucket or individual files need public read access
- **Private Access**: For private videos, use signed URLs (requires additional implementation)

The current implementation makes files publicly accessible. To change this:

1. Edit `backend/utils/gcsStorage.js`
2. Remove or comment out the `await file.makePublic();` line
3. Implement signed URL generation if you need private access

## Testing

1. Start your backend server
2. Complete an interview and record a video answer
3. Check your Google Cloud Storage bucket - you should see the video file
4. The video URL will be stored in the database

## Troubleshooting

### Error: "GCS_BUCKET_NAME is not configured"
- Make sure `GCS_BUCKET_NAME` is set in your `.env` file

### Error: "Failed to upload video to storage"
- Check that your service account key file path is correct
- Verify the service account has the correct permissions
- Ensure the bucket exists and is accessible

### Error: "Permission denied"
- Make sure your service account has **Storage Object Admin** or **Storage Object Creator** role
- Verify the bucket name is correct

## Development Mode

If GCS is not configured, the system will fall back to storing videos as base64 in the database (development mode only). This is not recommended for production as it will quickly fill your database.

## File Structure in GCS

Videos are stored with the following structure:
```
interviews/
  └── {interview-token}/
      ├── {question-id}-{email-slug}-{timestamp}.webm
      └── ...
```

Example:
```
interviews/
  └── abc123-def456-ghi789/
      ├── 1-john-doe-1234567890.webm
      └── 2-john-doe-1234567891.webm
```

