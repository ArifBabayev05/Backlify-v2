# Render.com Deployment Guide for Backlify-v2

This guide provides detailed step-by-step instructions for deploying your Backlify-v2 project to Render.com.

## Prerequisites

- A GitHub account with your Backlify-v2 repository
- Your Mistral AI API key
- Your Supabase URL, key, and connection string
- A Render.com account (free to sign up)

## Step-by-Step Deployment Process

### 1. Prepare Your Repository

Make sure your repository includes:
- A valid `package.json` with the correct dependencies
- The `render.yaml` file (for Blueprint deployment)
- All necessary code and configuration files

### 2. Log in to Render.com

- Go to [render.com](https://render.com)
- Sign up or log in to your account

### 3. Create a New Web Service

#### Option A: Manual Deployment

1. In the Render dashboard, click the "New +" button in the top right
2. Select "Web Service" from the dropdown menu

   ![Select Web Service](https://i.imgur.com/example1.png)

3. Connect your GitHub repository:
   - If this is your first time, you'll need to connect Render to your GitHub account
   - Search for and select your Backlify-v2 repository

4. Configure the basic settings:
   - **Name**: `backlify-v2` (or your preferred name)
   - **Environment**: Select "Node" from the dropdown
   - **Region**: Choose the region closest to your users
   - **Branch**: Select your main branch (usually "main" or "master")

   ![Configure Basic Settings](https://i.imgur.com/example2.png)

5. Configure the build settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

   ![Configure Build Settings](https://i.imgur.com/example3.png)

6. Add environment variables:
   - Scroll down to "Environment Variables"
   - Add each of these variables:
     - `PORT`: 10000
     - `NODE_ENV`: production
     - `MISTRAL_API_KEY`: Your Mistral API key
     - `MISTRAL_MODEL`: mistral-small-latest
     - `SUPABASE_URL`: Your Supabase URL
     - `SUPABASE_KEY`: Your Supabase key
     - `DB_CONNECTION_STRING`: Your Supabase database connection string

   ![Environment Variables](https://i.imgur.com/example4.png)

7. Review plan settings:
   - The free plan is fine for testing but has limitations
   - For production, consider a paid plan

8. Click "Create Web Service"

#### Option B: Blueprint Deployment

1. In the Render dashboard, click the "New +" button
2. Select "Blueprint" from the dropdown

   ![Select Blueprint](https://i.imgur.com/example5.png)

3. Connect to your repository that contains the `render.yaml` file
4. Render will parse the YAML file and show you the services to be created
5. Review the configuration and click "Apply"
6. You'll be prompted to enter values for environment variables marked with `sync: false`

### 4. Monitor the Deployment

1. Render will start deploying your service
2. You can monitor the build and deploy logs in real-time
3. The initial build may take 5-10 minutes

   ![Deployment Logs](https://i.imgur.com/example6.png)

### 5. Access Your Deployed Application

1. Once deployment is complete, Render will provide a URL for your service
   - Usually something like `https://backlify-v2.onrender.com`
2. Click the URL to open your deployed application
3. Test that everything is working correctly

## Troubleshooting Common Issues

### Build Fails

- **Problem**: The build process fails with errors
- **Solution**: 
  - Check the build logs for specific error messages
  - Verify package.json has all required dependencies
  - Make sure your Node.js version is compatible (add `"engines": {"node": ">=16.0.0"}` to package.json if needed)

### Application Crashes After Deployment

- **Problem**: The application deploys but crashes when accessed
- **Solution**:
  - Check the runtime logs in the Render dashboard
  - Verify all environment variables are correctly set
  - Make sure your Supabase database is accessible from external services
  - Check for any hardcoded localhost references in your code

### CORS Issues

- **Problem**: API requests fail due to CORS errors
- **Solution**:
  - Verify that your CORS configuration allows requests from your frontend domain
  - If testing locally, add your local frontend URL to allowed origins

### Memory Issues

- **Problem**: Application crashes with memory errors
- **Solution**:
  - Upgrade to a higher tier plan with more memory
  - Optimize your application to use less memory

## Scaling and Monitoring

### Scaling Up

1. In the Render dashboard, go to your web service
2. Click on "Settings"
3. Under "Instance Type", select a higher tier plan
4. Click "Save Changes"

### Setting Up Monitoring

1. In the "Settings" page, enable "Health Check Path"
2. Set it to `/health` (assuming you've implemented the health check endpoint)
3. This will allow Render to monitor your application's health

## Continuous Deployment

Render automatically deploys your application when you push changes to your repository. To disable this:

1. Go to "Settings"
2. Under "Auto-Deploy", select "No"
3. Click "Save Changes"

Now you'll need to manually deploy by clicking the "Manual Deploy" button.

## Custom Domains

To use a custom domain:

1. Go to "Settings"
2. Scroll to "Custom Domains"
3. Click "Add Custom Domain"
4. Follow the instructions to verify your domain

## Support and Resources

- [Render Docs](https://render.com/docs)
- [Render Status Page](https://status.render.com)
- [Render Support](https://render.com/support)

Good luck with your deployment! If you encounter any issues not covered in this guide, check the Render documentation or contact their support team. 